import React, { useMemo, useState } from 'react';
import { CheckCheck, Download, FileText, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

type ExportFormat = 'doc' | 'pdf';

function escapeHtml(value: string | null | undefined) {
  return (value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

export function buildApprovedArticleExportHtml(article: any) {
  const timestamp = (value: unknown) => value ? new Date(value as string | number | Date).toLocaleString('zh-CN') : '—';
  const sourceLabel = escapeHtml(article.sourceHeadline);
  const sourceUrl = escapeHtml(article.sourceUrl);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(article.aiTitle ?? article.sourceHeadline)}</title><style>body{font-family:Arial,"Microsoft YaHei",sans-serif;color:#0f172a;line-height:1.75;margin:48px;max-width:780px}h1{font-size:24px;line-height:1.4}h2{font-size:15px;margin-top:28px}.meta{color:#475569;font-size:12px;border-top:1px solid #cbd5e1;padding-top:14px}a{color:#0369a1;word-break:break-all}</style></head><body><h1>${escapeHtml(article.aiTitle ?? article.sourceHeadline)}</h1><p>${escapeHtml(article.aiSummary)}</p><h2>审核与来源信息</h2><div class="meta"><p>状态：已批准（未自动发布）</p><p>分类：${escapeHtml(article.category ?? '未分类')}；情绪：${escapeHtml(article.sentiment ?? '—')}</p><p>AI 生成时间：${timestamp(article.aiGeneratedAt)}；审核时间：${timestamp(article.reviewedAt)}</p><p>来源标题：${sourceLabel}</p><p>来源链接：<a href="${sourceUrl}">${sourceUrl}</a></p><p>来源发布日期：${timestamp(article.sourcePublishedAt)}</p><p>导出范围仅包括已保存的草稿与来源归属元数据，不包含或复制来源全文。</p></div></body></html>`;
}

async function downloadApprovedArticle(article: any, format: ExportFormat) {
  const filenameBase = (article.aiTitle ?? article.sourceHeadline ?? `approved-article-${article.id}`).replace(/[\\/:*?"<>|]/g, '_').slice(0, 72);
  const html = buildApprovedArticleExportHtml(article);
  let blob: Blob;
  let suffix: string;
  if (format === 'doc') {
    blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    suffix = 'doc';
  } else {
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;padding:48px;color:#0f172a;font-family:Arial,"Microsoft YaHei",sans-serif;z-index:-1;';
    host.innerHTML = html.replace(/<!doctype html>|<\/?html>|<head>[\s\S]*?<\/head>|<\/?body>/gi, '');
    document.body.appendChild(host);
    try {
      const canvas = await html2canvas(host, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = canvas.height * (pageWidth / canvas.width);
      const image = canvas.toDataURL('image/png');
      for (let offset = 0; offset < imageHeight; offset += pageHeight) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(image, 'PNG', 0, -offset, pageWidth, imageHeight, undefined, 'FAST');
      }
      blob = pdf.output('blob');
      suffix = 'pdf';
    } finally {
      host.remove();
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filenameBase}.${suffix}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AdminNewsReviewBatchPanel() {
  const utils = trpc.useUtils();
  const [draftIds, setDraftIds] = useState<number[]>([]);
  const [approvedIds, setApprovedIds] = useState<number[]>([]);
  const [approvedId, setApprovedId] = useState<number | null>(null);
  const draftsQuery = trpc.adminNewsIngestion.listArticles.useQuery({ status: 'draft', limit: 100 });
  const approvedQuery = trpc.adminNewsIngestion.listArticles.useQuery({ status: 'approved', limit: 100 });
  const refresh = () => void Promise.all([utils.adminNewsIngestion.listArticles.invalidate(), utils.adminNewsIngestion.listAuditEvents.invalidate(), utils.adminNewsIngestion.getAnalytics.invalidate()]);
  const batchReview = trpc.adminNewsIngestion.batchReview.useMutation({
    onSuccess: (result) => {
      toast.success(`已批量${result.decision === 'approved' ? '通过' : '驳回'} ${result.reviewed} 篇草稿；跳过 ${result.skipped} 篇状态已变化的记录。未自动发布。`);
      setDraftIds([]);
      refresh();
    },
    onError: (error) => toast.error(`批量审核未完成：${error.message}`),
  });
  const batchPublish = trpc.adminNewsIngestion.batchPublish.useMutation({
    onSuccess: (result) => {
      toast.success(`已批量发布 ${result.published} 篇已批准文章；跳过 ${result.skipped} 篇状态不符合的记录。`);
      setApprovedIds([]);
      refresh();
    },
    onError: (error) => toast.error(`批量发布未完成：${error.message}`),
  });
  const prepareExport = trpc.adminNewsIngestion.prepareApprovedExport.useMutation({ onError: (error) => toast.error(`文章导出未完成：${error.message}`) });
  const drafts = draftsQuery.data ?? [];
  const approved = approvedQuery.data ?? [];
  const activeDraftIds = useMemo(() => draftIds.filter((id) => drafts.some((article: any) => article.id === id)), [draftIds, drafts]);
  const activeApprovedIds = useMemo(() => approvedIds.filter((id) => approved.some((article: any) => article.id === id)), [approvedIds, approved]);
  const allSelected = drafts.length > 0 && drafts.every((article: any) => activeDraftIds.includes(article.id));
  const allApprovedSelected = approved.length > 0 && approved.every((article: any) => activeApprovedIds.includes(article.id));
  const selectedApproved = approved.find((article: any) => article.id === approvedId) ?? approved[0] ?? null;
  const toggleAll = () => setDraftIds(allSelected ? [] : drafts.map((article: any) => article.id));
  const toggleDraft = (id: number) => setDraftIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleApproved = (id: number) => setApprovedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const exportArticle = (format: ExportFormat) => {
    if (!selectedApproved) return;
    prepareExport.mutate({ id: selectedApproved.id, format }, { onSuccess: (article) => { void downloadApprovedArticle(article, format).then(() => { toast.success(`已导出 ${format.toUpperCase()}；审核与发布状态未改变。`); refresh(); }).catch(() => toast.error('浏览器未能生成导出文件；文章状态未改变。')); } });
  };
  const busy = batchReview.isPending || batchPublish.isPending || prepareExport.isPending;
  return <section className="rounded border border-gray-800 bg-gray-900/50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><CheckCheck className="h-4 w-4 text-violet-300" /><h4 className="text-xs font-semibold text-gray-100">批量审核、发布与已批准导出</h4></div><span className="text-[10px] text-gray-500">草稿须先批准；批量发布只处理 approved 状态</span></div><div className="mt-3 grid gap-3 xl:grid-cols-2"><div className="rounded border border-gray-800 bg-[#080a0d] p-3"><div className="flex flex-wrap items-center gap-2"><label className="inline-flex items-center gap-2 text-[10px] text-gray-300"><input aria-label="全选待审草稿" type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!drafts.length || busy} />全选待审草稿</label><span className="text-[10px] text-gray-500">已选 {activeDraftIds.length} / {drafts.length}</span><button type="button" disabled={!activeDraftIds.length || busy} onClick={() => batchReview.mutate({ ids: activeDraftIds, decision: 'approved' })} className="rounded bg-emerald-800 px-2 py-1 text-[10px] text-emerald-50 disabled:opacity-50"><CheckCheck className="mr-1 inline h-3 w-3" />批量通过</button><button type="button" disabled={!activeDraftIds.length || busy} onClick={() => batchReview.mutate({ ids: activeDraftIds, decision: 'rejected' })} className="rounded bg-rose-900/70 px-2 py-1 text-[10px] text-rose-100 disabled:opacity-50"><XCircle className="mr-1 inline h-3 w-3" />批量驳回</button></div>{draftsQuery.isLoading ? <div className="mt-3 text-[10px] text-gray-500"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />正在读取待审草稿…</div> : !drafts.length ? <div className="mt-3 text-[10px] text-gray-500">没有可批量处理的待审草稿。</div> : <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">{drafts.map((article: any) => <label key={article.id} className="flex cursor-pointer items-center gap-2 rounded border border-gray-800 px-2 py-1.5 text-[10px] text-gray-300"><input aria-label={`选择待审草稿 ${article.id}`} type="checkbox" checked={activeDraftIds.includes(article.id)} onChange={() => toggleDraft(article.id)} disabled={busy} /><span className="truncate">#{article.id} · {article.aiTitle ?? article.sourceHeadline}</span></label>)}</div>}</div><div className="rounded border border-gray-800 bg-[#080a0d] p-3"><div className="text-[10px] font-semibold text-gray-100">已批准文章发布与导出</div><p className="mt-1 text-[10px] leading-4 text-gray-500">批量发布逐篇记录审计；导出只包含草稿、审核信息与来源归属，不下载来源正文。</p>{approvedQuery.isLoading ? <div className="mt-3 text-[10px] text-gray-500">正在读取已批准文章…</div> : !approved.length ? <div className="mt-3 text-[10px] text-gray-500">尚无可批量发布或导出的已批准文章。</div> : <><div className="mt-3 flex flex-wrap items-center gap-2"><label className="inline-flex items-center gap-2 text-[10px] text-gray-300"><input aria-label="全选已批准文章" type="checkbox" checked={allApprovedSelected} onChange={() => setApprovedIds(allApprovedSelected ? [] : approved.map((article: any) => article.id))} disabled={busy} />全选已批准文章</label><span className="text-[10px] text-gray-500">已选 {activeApprovedIds.length} / {approved.length}</span><button type="button" disabled={!activeApprovedIds.length || busy} onClick={() => batchPublish.mutate({ ids: activeApprovedIds })} className="rounded bg-cyan-800 px-2 py-1 text-[10px] text-cyan-50 disabled:opacity-50"><CheckCheck className="mr-1 inline h-3 w-3" />批量发布</button></div><div className="mt-2 max-h-28 space-y-1 overflow-y-auto">{approved.map((article: any) => <label key={article.id} className="flex cursor-pointer items-center gap-2 rounded border border-gray-800 px-2 py-1.5 text-[10px] text-gray-300"><input aria-label={`选择已批准文章 ${article.id}`} type="checkbox" checked={activeApprovedIds.includes(article.id)} onChange={() => toggleApproved(article.id)} disabled={busy} /><span className="truncate">#{article.id} · {article.aiTitle ?? article.sourceHeadline}</span></label>)}</div><select aria-label="选择已批准文章导出" value={selectedApproved?.id ?? ''} onChange={(event) => setApprovedId(Number(event.target.value))} className="mt-3 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-[10px] text-gray-100">{approved.map((article: any) => <option key={article.id} value={article.id}>#{article.id} · {article.aiTitle ?? article.sourceHeadline}</option>)}</select><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => exportArticle('doc')} className="rounded border border-violet-700 px-2 py-1.5 text-[10px] text-violet-100 disabled:opacity-50"><FileText className="mr-1 inline h-3 w-3" />导出 Word</button><button type="button" disabled={busy} onClick={() => exportArticle('pdf')} className="rounded border border-violet-700 px-2 py-1.5 text-[10px] text-violet-100 disabled:opacity-50"><Download className="mr-1 inline h-3 w-3" />导出 PDF</button></div></>}</div></div></section>;
}

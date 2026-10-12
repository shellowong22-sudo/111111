import React, { FormEvent, useState } from 'react';
import { Globe2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export function ManualNewsSourceForm({ onCompleted }: { onCompleted?: () => void }) {
  const [form, setForm] = useState({ name: '', websiteUrl: '', feedUrl: '', maxItemsPerRun: 50, processingMode: 'queued' as 'queued' | 'immediate', isActive: true });
  const sync = trpc.adminNewsIngestion.syncSource.useMutation({
    onSuccess: (data) => {
      if (data.status === 'available') {
        const text = data.reason === 'SOURCE_FEED_EMPTY' ? `同步已完成：该订阅本次未提供可导入条目；已处理 ${data.processed} 条，草稿 ${data.drafted} 条，待处理 ${data.waiting} 条。` : `同步完成：新增 ${data.queued} 条，已处理 ${data.processed} 条，草稿 ${data.drafted} 条，待处理 ${data.waiting} 条。`;
        data.reason === 'SOURCE_FEED_EMPTY' ? toast.info(text) : toast.success(text);
      }
      else toast.error(`来源已保存，但同步未完成：${data.reason ?? '未返回可验证公开订阅数据'}`);
      onCompleted?.();
    },
    onError: (error) => { toast.error(`来源已保存，但同步失败：${error.message}`); onCompleted?.(); },
  });
  const create = trpc.adminNewsIngestion.createSource.useMutation({
    onSuccess: ({ sourceId, existed }) => { if (existed) toast.info('该公开订阅已在来源列表中，现将直接同步已有来源。'); sync.mutate({ sourceId }); },
    onError: (error) => toast.error(error.message),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ ...form, feedUrl: form.feedUrl.trim() || undefined }); };
  const busy = create.isPending || sync.isPending;

  return <section className="rounded-lg border border-cyan-400/20 bg-slate-900/70 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="flex items-center gap-2 text-base font-semibold text-white"><Globe2 className="h-4 w-4 text-cyan-300" />添加财经网站</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">填写网站名称和 HTTPS 网址；RSS／Atom 地址为选填。留空时系统只发现网站公开声明的订阅，填写时优先使用该公开订阅地址。系统不抓取普通网页正文；文章先进入 AI 草稿与人工审核流程，审核通过后才会同步到终端。</p></div><span className="w-fit rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">人工审核后才会发布</span></div>
    <form onSubmit={submit} className="mt-4 grid gap-3 lg:grid-cols-2">
      <label className="grid gap-1 text-xs text-slate-400"><span>网站名称 <b className="text-cyan-300">必填</b></span><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：财经数据中心" className="border-slate-700 bg-slate-950 text-slate-100" /></label>
      <label className="grid gap-1 text-xs text-slate-400"><span>网站网址 <b className="text-cyan-300">必填</b></span><Input required type="url" value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://example.com" className="border-slate-700 bg-slate-950 text-slate-100" /></label>
      <label className="grid gap-1 text-xs text-slate-400 lg:col-span-2"><span>RSS／Atom 地址 <span className="text-slate-500">选填，填写后优先使用</span></span><Input type="url" value={form.feedUrl} onChange={(event) => setForm({ ...form, feedUrl: event.target.value })} placeholder="例如：https://rss.sina.com.cn/roll/finance/hot_roll.xml" className="border-slate-700 bg-slate-950 text-slate-100" /></label>
      <label className="flex items-center gap-3 text-sm text-slate-300"><span className="text-xs text-slate-500">单次最多读取</span><select aria-label="每次最大读取条数" value={form.maxItemsPerRun} onChange={(event) => setForm({ ...form, maxItemsPerRun: Number(event.target.value) })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100">{[10, 25, 50].map((count) => <option key={count} value={count}>{count} 条</option>)}</select></label>
      <label className="flex items-center gap-3 text-sm text-slate-300"><span className="text-xs text-slate-500">AI 草稿模式</span><select aria-label="AI 草稿处理模式" value={form.processingMode} onChange={(event) => setForm({ ...form, processingMode: event.target.value as 'queued' | 'immediate' })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"><option value="queued">稳定队列（每轮分批）</option><option value="immediate">全量即时（尽力处理）</option></select></label>
      <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />保存后启用该网站</label>
      <div className="lg:col-span-2"><Button type="submit" disabled={busy} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{busy ? '正在验证订阅并同步…' : '保存并立即同步'}</Button></div>
    </form>
  </section>;
}

import { BookMarked, CheckCircle2, ClipboardCheck, Download, FileSearch, Filter, GitCompareArrows, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';

type Theme = 'all' | 'inflation' | 'labor' | 'credit' | 'uncertainty' | 'liquidity';
type WorkMode = 'anchor' | 'paired' | 'dossier';
type ResearchHighlight = { category: string; phrase: string; start: number; end: number; context: string };
type ResearchDocument = { url: string; retrievedAt: Date | string; text: string; highlights: ResearchHighlight[]; limitation: string };

const THEMES: Array<{ id: Theme; label: string; terms: string[] }> = [
  { id: 'all', label: '全部材料', terms: [] },
  { id: 'inflation', label: '定价语境', terms: ['inflation', 'pricing', 'price', 'phillips'] },
  { id: 'labor', label: '劳动市场', terms: ['labor', 'employment', 'unemployment', 'wage'] },
  { id: 'credit', label: '融资结构', terms: ['credit', 'repo', 'collateral', 'bond'] },
  { id: 'uncertainty', label: '风险度量', terms: ['uncertainty', 'volatility', 'risk', 'expectations'] },
  { id: 'liquidity', label: '流动性制度', terms: ['liquidity', 'lcr', 'bank', 'regulation'] },
];

const MODE_COPY: Record<WorkMode, { label: string; eyebrow: string; detail: string }> = {
  anchor: { label: '原文锚点', eyebrow: 'SOURCE ANCHORS', detail: '从一篇指定 FEDS 文本中定位研究问题、方法或报告发现的原文段落；不把目录简介重写成观点。' },
  paired: { label: '成对阅览', eyebrow: 'PAIRED READING', detail: '由你指定两篇材料后，分别读取正文并保留各自段落；只呈现文本，不输出系统比较结论。' },
  dossier: { label: '摘录册', eyebrow: 'EXCERPT DOSSIER', detail: '将你明确勾选的原文段落、读取时点和来源标识汇成 Markdown；不补写结论或立场。' },
};

function toEpoch(value: Date | string | null | undefined) {
  if (!value) return Number.NaN;
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function formatDate(value: Date | string | null | undefined) {
  const epoch = toEpoch(value);
  return Number.isFinite(epoch) ? new Date(epoch).toLocaleString() : '—';
}

function formatShortDate(value: Date | string | null | undefined) {
  const epoch = toEpoch(value);
  return Number.isFinite(epoch) ? new Date(epoch).toLocaleDateString() : '—';
}

function readableText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/&(?:#8217|#39);/g, "'")
    .replace(/&(?:#8211|ndash);/g, '–')
    .replace(/&(?:#8212|mdash);/g, '—')
    .replace(/&oacute;/g, 'ó')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceTopics(headline: string | null | undefined, excerpt: string | null | undefined) {
  const haystack = `${headline ?? ''} ${excerpt ?? ''}`.toLowerCase();
  return THEMES.filter((theme) => theme.id !== 'all' && theme.terms.some((term) => haystack.includes(term))).map((theme) => theme.label);
}

function highlightKey(url: string, highlight: ResearchHighlight) {
  return `${url}::${highlight.start}::${highlight.end}`;
}

function categoryLabel(category: string) {
  if (category === 'research_question') return '问题锚点';
  if (category === 'method') return '方法锚点';
  if (category === 'reported_finding') return '报告锚点';
  if (category === 'key_rate') return '利率用语';
  if (category === 'policy_action') return '行动用语';
  if (category === 'forward_guidance') return '前瞻用语';
  return category;
}

function statusTone(active: boolean) {
  return active ? 'border-cyan-700/80 bg-cyan-950/25 text-cyan-100' : 'border-slate-800 bg-slate-950/35 text-slate-500';
}

export default function OfficialResearchWorkbench() {
  const [draftKeyword, setDraftKeyword] = useState('');
  const [keyword, setKeyword] = useState('');
  const [theme, setTheme] = useState<Theme>('all');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [compareUrls, setCompareUrls] = useState<string[]>([]);
  const [mode, setMode] = useState<WorkMode>('anchor');
  const [documents, setDocuments] = useState<Record<string, ResearchDocument>>({});
  const [quotedKeys, setQuotedKeys] = useState<string[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const input = useMemo(() => ({ source: 'fed_research' as const, keyword, limit: 24 }), [keyword]);
  const feed = trpc.newsResearch.getOfficialFeed.useQuery(input, { staleTime: 300_000, refetchOnWindowFocus: false, retry: 1 });
  const documentEvidence = trpc.moneyMarketPolicy.inspectResearchDocument.useMutation();
  const rows = feed.data?.rows ?? [];
  const activeTheme = THEMES.find((item) => item.id === theme) ?? THEMES[0];
  const visibleRows = useMemo(() => {
    if (activeTheme.id === 'all') return rows;
    return rows.filter((row) => activeTheme.terms.some((term) => `${row.headline} ${row.excerpt}`.toLowerCase().includes(term)));
  }, [activeTheme, rows]);
  const selected = rows.find((row) => row.sourceUrl === selectedUrl) ?? visibleRows[0] ?? null;
  const selectedDocument = selected?.sourceUrl ? documents[selected.sourceUrl] : undefined;
  const comparisonRows = compareUrls.map((url) => rows.find((row) => row.sourceUrl === url)).filter(Boolean);
  const quoteEntries = useMemo(() => quotedKeys.flatMap((key) => {
    const [url, start, end] = key.split('::');
    const document = documents[url];
    const row = rows.find((item) => item.sourceUrl === url);
    const highlight = document?.highlights.find((item) => String(item.start) === start && String(item.end) === end);
    return row && highlight ? [{ key, row, document, highlight }] : [];
  }), [documents, quotedKeys, rows]);
  const selectedBreakdown = useMemo(() => {
    if (!selectedDocument) return [];
    const counts = selectedDocument.highlights.reduce<Record<string, number>>((current, item) => ({ ...current, [item.category]: (current[item.category] ?? 0) + 1 }), {});
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts).map(([category, count]) => ({ category, count, percent: Math.round((count / max) * 100) }));
  }, [selectedDocument]);
  const primarySource = feed.data?.sources.find((item) => item.id === 'fed_research');
  const sourceUnavailable = Boolean(feed.data && primarySource?.status !== 'available');
  const isEmpty = Boolean(feed.data) && visibleRows.length === 0;
  const readDocument = async (url: string, refresh = false) => {
    const stored = documents[url];
    if (stored && !refresh) return stored;
    const loaded = await documentEvidence.mutateAsync({ url });
    setDocuments((current) => ({ ...current, [url]: loaded }));
    return loaded;
  };
  const resetWorkspace = () => {
    setSelectedUrl(null);
    setCompareUrls([]);
    setDocuments({});
    setQuotedKeys([]);
    setCompareError(null);
    documentEvidence.reset();
  };
  const resetFilters = () => {
    setDraftKeyword('');
    setKeyword('');
    setTheme('all');
    resetWorkspace();
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setKeyword(draftKeyword.trim());
    resetWorkspace();
  };
  const selectForAnchoring = (url: string) => {
    setSelectedUrl(url);
    setMode('anchor');
    setCompareError(null);
    documentEvidence.reset();
  };
  const togglePair = (url: string) => {
    setCompareUrls((current) => {
      if (current.includes(url)) return current.filter((item) => item !== url);
      if (current.length < 2) return [...current, url];
      return [current[1], url];
    });
    setMode('paired');
    setCompareError(null);
  };
  const runPairedReading = async () => {
    if (compareUrls.length !== 2) return;
    setIsComparing(true);
    setCompareError(null);
    try {
      await Promise.all(compareUrls.map((url) => readDocument(url)));
    } catch {
      setCompareError('至少一篇选定 FEDS 原文当前不可读；系统未以目录简介、缓存或其他网页替代。');
    } finally {
      setIsComparing(false);
    }
  };
  const toggleQuote = (url: string, highlight: ResearchHighlight) => {
    const key = highlightKey(url, highlight);
    setQuotedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };
  const downloadDossier = () => {
    if (!quoteEntries.length) return;
    const markdown = [
      '# FEDS 原文摘录册',
      '',
      `生成时间：${new Date().toISOString()}`,
      '边界：本文件只收录用户在终端中选择的官方原文段落，不构成模型摘要、机构立场、预测、评级或投资建议。',
      '',
      ...quoteEntries.flatMap(({ row, document, highlight }, index) => [
        `## ${index + 1}. ${readableText(row.headline)}`,
        `- 机构：${row.institution ?? '—'}`,
        `- 发布：${formatDate(row.publishedAt)}`,
        `- 本次原文读取：${formatDate(document.retrievedAt)}`,
        `- 段落类别：${categoryLabel(highlight.category)}`,
        `- 定位词：${highlight.phrase}`,
        `- 内容编号：${row.sourceId}`,
        '',
        `> ${highlight.context.replace(/\n+/g, ' ')}`,
        '',
      ]),
    ].join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `feds-excerpt-dossier-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };
  const renderHighlight = (url: string, item: ResearchHighlight, index: number, compact = false) => {
    const isQuoted = quotedKeys.includes(highlightKey(url, item));
    return <article key={`${item.category}-${item.start}-${index}`} className={`rounded border ${isQuoted ? 'border-cyan-700 bg-cyan-950/20' : 'border-slate-800 bg-slate-950/45'} p-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1.5"><span className="rounded border border-cyan-900/70 px-1.5 py-0.5 font-mono text-[8px] text-cyan-200">{categoryLabel(item.category)}</span><span className="font-mono text-[9px] text-slate-300">{item.phrase}</span></div><button type="button" onClick={() => toggleQuote(url, item)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[8px] text-slate-400 hover:border-cyan-800 hover:text-cyan-100">{isQuoted ? '移出摘录册' : '收录本段'}</button></div>
      <p className={`mt-1.5 leading-4 text-slate-400 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{item.context}</p>
    </article>;
  };

  return <section className="mt-4 rounded-xl border border-cyan-900/70 bg-slate-950 p-4 shadow-[0_0_28px_rgba(34,211,238,0.09)]" data-official-research-workbench="true">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
      <div><p className="font-mono text-[10px] text-cyan-300">FEDS PRIMARY-TEXT READING DESK</p><h2 className="mt-1 text-sm font-semibold text-slate-100">FEDS 原文研读台</h2><p className="mt-1 max-w-4xl text-[10px] leading-4 text-slate-400">此处是 ZIP 原 29 项功能之后的独立文本研读区：先定位官方发布材料，再按需读取正文段落、成对阅览或制作摘录册。它不读取、不改写、不比较原经济日历、统计、预测或其他原始功能内容。</p></div>
      <button type="button" onClick={() => { feed.refetch(); resetWorkspace(); }} disabled={feed.isFetching} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2.5 py-1.5 text-[10px] text-cyan-200 hover:bg-cyan-950/30 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${feed.isFetching ? 'animate-spin' : ''}`} />更新 FEDS 目录</button>
    </header>

    <div className="mt-3 grid gap-2 md:grid-cols-4" aria-label="当前研读轨迹">
      <div className={`rounded border p-2 ${statusTone(Boolean(feed.data) && !sourceUnavailable)}`}><p className="font-mono text-[8px]">01 / 目录源</p><p className="mt-1 text-[10px]">{feed.isFetching ? '读取中' : sourceUnavailable ? '官方源不可读' : feed.data ? `${rows.length} 条本次材料` : '未取得响应'}</p></div>
      <div className={`rounded border p-2 ${statusTone(visibleRows.length > 0)}`}><p className="font-mono text-[8px]">02 / 当前筛选</p><p className="mt-1 text-[10px]">{activeTheme.label} · {visibleRows.length} 条匹配</p></div>
      <div className={`rounded border p-2 ${statusTone(Object.keys(documents).length > 0)}`}><p className="font-mono text-[8px]">03 / 正文读取</p><p className="mt-1 text-[10px]">{Object.keys(documents).length ? `${Object.keys(documents).length} 篇已定位` : '尚未读取正文'}</p></div>
      <div className={`rounded border p-2 ${statusTone(quoteEntries.length > 0)}`}><p className="font-mono text-[8px]">04 / 摘录册</p><p className="mt-1 text-[10px]">{quoteEntries.length ? `${quoteEntries.length} 段已收录` : '没有已选段落'}</p></div>
    </div>

    <form onSubmit={submitSearch} className="mt-3 flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-900/30 p-2" data-research-search="true"><Search className="h-4 w-4 text-cyan-300" /><label className="sr-only" htmlFor="official-research-keyword">检索 FEDS 发布材料</label><input id="official-research-keyword" value={draftKeyword} onChange={(event) => setDraftKeyword(event.target.value)} placeholder="输入原文术语，例如 credit、inflation、liquidity" className="min-w-[260px] flex-1 bg-transparent px-1 text-xs text-slate-100 outline-none placeholder:text-slate-600" /><button type="submit" className="rounded border border-cyan-800 px-2.5 py-1 text-[10px] text-cyan-200 hover:bg-cyan-950/30">应用检索</button>{keyword ? <button type="button" onClick={resetFilters} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200">移除检索条件</button> : null}</form>
    <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="FEDS 发布材料分类">{THEMES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={theme === item.id} onClick={() => { setTheme(item.id); resetWorkspace(); }} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] ${theme === item.id ? 'border-cyan-600 bg-cyan-950/40 text-cyan-100' : 'border-slate-700 text-slate-400 hover:border-cyan-800 hover:text-cyan-200'}`}><Filter className="h-3 w-3" />{item.label}</button>)}</div>

    {feed.isLoading ? <div className="mt-3 rounded border border-slate-800 bg-slate-900/35 p-3 text-[10px] text-slate-400">正在读取美联储 FEDS 官方目录；工作台不会以静态文章、经济日历或第三方内容填充。</div> : !feed.data ? <div className="mt-3 rounded border border-amber-900/60 bg-amber-950/15 p-3 text-[10px] text-amber-100"><p className="font-medium">FEDS 目录当前不可读</p><p className="mt-1 text-amber-100/70">保留真实不可用状态；可点击顶部“更新 FEDS 目录”重新发起官方读取。</p></div> : sourceUnavailable ? <div className="mt-3 grid gap-3 rounded border border-amber-900/60 bg-amber-950/15 p-3 lg:grid-cols-[1.35fr_0.65fr]" data-research-source-unavailable="true"><div><p className="font-mono text-[9px] text-amber-200">OFFICIAL SOURCE UNAVAILABLE</p><h3 className="mt-1 text-xs font-medium text-amber-100">FEDS 官方目录本次没有可读取的条目</h3><p className="mt-1 text-[10px] leading-4 text-amber-100/70">上游读取状态：{primarySource?.failure ?? 'SOURCE_UNAVAILABLE'}。这不是筛选无匹配，系统没有用静态文章、缓存目录或其他来源补齐。</p><div className="mt-2 flex flex-wrap gap-1"><span className="rounded border border-amber-900/60 px-2 py-1 font-mono text-[8px] text-amber-100/70">来源：{primarySource?.label ?? 'FEDS RSS/XML'}</span><span className="rounded border border-amber-900/60 px-2 py-1 font-mono text-[8px] text-amber-100/70">读取：{formatDate(primarySource?.cachedAt)}</span></div></div><div className="flex flex-wrap content-start gap-2 border-t border-amber-900/50 pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0"><button type="button" onClick={() => feed.refetch()} disabled={feed.isFetching} className="inline-flex items-center gap-1 rounded border border-amber-700 px-2.5 py-1.5 text-[9px] text-amber-100 hover:bg-amber-950/30"><RefreshCw className={`h-3 w-3 ${feed.isFetching ? 'animate-spin' : ''}`} />重新读取官方源</button></div></div> : isEmpty ? <div className="mt-3 grid gap-3 rounded border border-slate-800 bg-slate-900/25 p-3 lg:grid-cols-[1.35fr_0.65fr]" data-research-empty-state="true"><div><p className="font-mono text-[9px] text-cyan-300">NO MATCHING PRIMARY TEXT</p><h3 className="mt-1 text-xs font-medium text-slate-100">当前条件没有匹配 FEDS 发布材料</h3><p className="mt-1 text-[10px] leading-4 text-slate-400">来源已成功读取 {rows.length} 条材料，但“{keyword || '未填写关键词'}”与“{activeTheme.label}”组合未命中。系统不展示样例文章，也不会用摘要代替原文。</p><div className="mt-2 flex flex-wrap gap-1"><span className="rounded border border-slate-700 px-2 py-1 font-mono text-[8px] text-slate-400">关键词：{keyword || '无'}</span><span className="rounded border border-slate-700 px-2 py-1 font-mono text-[8px] text-slate-400">分类：{activeTheme.label}</span><span className="rounded border border-cyan-900/70 px-2 py-1 font-mono text-[8px] text-cyan-200">来源：{primarySource?.label ?? 'FEDS RSS/XML'}</span></div></div><div className="flex flex-wrap content-start gap-2 border-t border-slate-800 pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0"><button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2.5 py-1.5 text-[9px] text-cyan-100 hover:bg-cyan-950/30"><Filter className="h-3 w-3" />清除条件</button><button type="button" onClick={() => feed.refetch()} disabled={feed.isFetching} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1.5 text-[9px] text-slate-300 hover:border-cyan-800"><RefreshCw className={`h-3 w-3 ${feed.isFetching ? 'animate-spin' : ''}`} />重新读取</button></div></div> : <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="overflow-hidden rounded border border-slate-800" data-research-publication-catalogue="true"><div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-3 py-2"><div><p className="font-mono text-[9px] text-cyan-300">FEDS MATERIAL SHELF</p><p className="mt-0.5 text-[9px] text-slate-500">用于挑选一篇原文锚点，或放入两篇成对阅览槽。来源 {feed.data.sources[0]?.label ?? '美联储 FEDS 目录'}。</p></div><BookMarked className="h-4 w-4 text-cyan-300" /></div><div className="divide-y divide-slate-800/70">{visibleRows.map((row) => { const url = row.sourceUrl; const paired = Boolean(url && compareUrls.includes(url)); const topics = sourceTopics(row.headline, row.excerpt); return <article key={row.sourceId} className={`px-3 py-3 ${paired ? 'bg-cyan-950/15' : ''}`}><div className="flex flex-wrap items-start justify-between gap-2"><p className="pr-4 text-xs font-medium leading-5 text-slate-100">{row.headline}</p><time className="shrink-0 font-mono text-[9px] text-slate-500">{formatShortDate(row.publishedAt)}</time></div><p className="mt-1 text-[9px] text-slate-500">{row.institution ?? '美联储理事会 FEDS'} · 本次目录读取 {formatShortDate(row.retrievedAt)}</p><div className="mt-2 flex flex-wrap items-center gap-1">{topics.length ? topics.map((topic) => <span key={topic} className="rounded border border-cyan-900/70 px-1.5 py-0.5 text-[8px] text-cyan-200">{topic}</span>) : <span className="text-[8px] text-slate-600">未命中本地分类词</span>}<span className="mx-1 h-3 border-l border-slate-800" />{url ? <><button type="button" onClick={() => selectForAnchoring(url)} className="rounded border border-slate-700 px-1.5 py-0.5 text-[8px] text-slate-300 hover:border-cyan-800 hover:text-cyan-100">定位原文锚点</button><button type="button" onClick={() => togglePair(url)} className={`rounded border px-1.5 py-0.5 text-[8px] ${paired ? 'border-cyan-600 bg-cyan-950/30 text-cyan-100' : 'border-slate-700 text-slate-400 hover:border-cyan-800 hover:text-cyan-100'}`}>{paired ? '移出成对阅览' : '放入成对阅览'}</button></> : <span className="text-[8px] text-slate-600">该条目没有可审阅 URL</span>}</div></article>; })}</div></div>

      <aside className="rounded border border-slate-800 bg-slate-900/25 p-3" data-research-evidence-operations="true"><div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">{(Object.keys(MODE_COPY) as WorkMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[9px] ${mode === item ? 'border-cyan-600 bg-cyan-950/40 text-cyan-100' : 'border-slate-700 text-slate-400 hover:border-cyan-800 hover:text-cyan-100'}`}>{item === 'anchor' ? <FileSearch className="h-3 w-3" /> : item === 'paired' ? <GitCompareArrows className="h-3 w-3" /> : <Download className="h-3 w-3" />}{MODE_COPY[item].label}</button>)}</div><div className="mt-3"><p className="font-mono text-[9px] text-cyan-300">{MODE_COPY[mode].eyebrow}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{MODE_COPY[mode].detail}</p></div>
        {mode === 'anchor' ? <div className="mt-3" data-research-evidence-extractor="true">{selected && selected.sourceUrl ? <><div className="rounded border border-slate-800 bg-slate-950/45 p-2"><p className="text-[10px] font-medium leading-4 text-slate-100">{selected.headline}</p><p className="mt-1 text-[9px] text-slate-500">{selected.institution ?? '美联储理事会 FEDS'} · 发布 {formatDate(selected.publishedAt)}</p><button type="button" onClick={() => void readDocument(selected.sourceUrl!, true).catch(() => undefined)} disabled={documentEvidence.isPending} className="mt-2 inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[9px] text-cyan-200 hover:bg-cyan-950/30 disabled:opacity-50"><FileSearch className="h-3 w-3" />{documentEvidence.isPending ? '正在读取正文' : selectedDocument ? '刷新原文锚点' : '读取正文并定位锚点'}</button></div>{documentEvidence.error ? <p className="mt-2 rounded border border-amber-900/60 bg-amber-950/15 p-2 text-[9px] text-amber-100">官方正文当前不可读；不会以目录简介、缓存或第三方页面替代。</p> : selectedDocument ? <div className="mt-2 space-y-2"><div className="rounded border border-cyan-900/60 bg-cyan-950/10 p-2"><p className="font-mono text-[8px] text-cyan-300">READ RECEIPT</p><p className="mt-1 text-[9px] leading-4 text-slate-400">{selectedDocument.limitation}</p><p className="mt-1 font-mono text-[8px] text-slate-600">原文读取 {formatDate(selectedDocument.retrievedAt)} · 可收录段落 {selectedDocument.highlights.length} 条</p></div>{selectedBreakdown.length ? <div className="rounded border border-slate-800 bg-slate-950/35 p-2" data-anchor-breakdown="true"><div className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-cyan-300" /><p className="font-mono text-[8px] text-cyan-300">ANCHOR DISTRIBUTION</p></div><div className="mt-2 space-y-1.5">{selectedBreakdown.map((item) => <div key={item.category} className="grid grid-cols-[76px_1fr_26px] items-center gap-2 text-[8px]"><span className="text-slate-400">{categoryLabel(item.category)}</span><div className="h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full rounded bg-cyan-500/70" style={{ width: `${item.percent}%` }} /></div><span className="text-right font-mono text-cyan-200">{item.count}</span></div>)}</div></div> : null}<div className="space-y-2">{selectedDocument.highlights.length ? selectedDocument.highlights.map((item, index) => renderHighlight(selected.sourceUrl!, item, index)) : <p className="rounded border border-slate-800 p-2 text-[9px] text-slate-500">本次正文没有规则锚点；系统不生成替代结论。</p>}</div><details className="rounded border border-slate-800 bg-slate-950/45 p-2"><summary className="cursor-pointer text-[9px] text-slate-400">核验本次读取的正文片段</summary><pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-[9px] leading-4 text-slate-500">{selectedDocument.text.slice(0, 7_000)}</pre></details></div> : <p className="mt-2 text-[9px] leading-4 text-slate-500">从左侧材料架选择“定位原文锚点”，再由你显式发起正文读取。</p>}</> : <div className="rounded border border-slate-800 bg-slate-950/35 p-3 text-[9px] leading-4 text-slate-500"><ClipboardCheck className="mb-2 h-4 w-4 text-cyan-300" />先从左侧选一篇材料。此处不会自行填充或复制目录文字。</div>}</div> : null}
        {mode === 'paired' ? <div className="mt-3" data-research-comparison="true"><div className="rounded border border-slate-800 bg-slate-950/45 p-2"><p className="text-[9px] text-slate-400">已放入成对阅览槽：{compareUrls.length}/2 篇。只有两个槽位均由你选择后，才会分别读取原文。</p><button type="button" onClick={runPairedReading} disabled={compareUrls.length !== 2 || isComparing} className="mt-2 inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[9px] text-cyan-200 hover:bg-cyan-950/30 disabled:opacity-50"><GitCompareArrows className="h-3 w-3" />{isComparing ? '正在读取两篇正文' : '读取两篇并列段落'}</button></div>{compareError ? <p className="mt-2 rounded border border-amber-900/60 bg-amber-950/15 p-2 text-[9px] text-amber-100">{compareError}</p> : null}{comparisonRows.length ? <div className="mt-2 grid gap-2 2xl:grid-cols-2">{comparisonRows.map((row) => { const url = row?.sourceUrl ?? ''; const document = documents[url]; return <article key={url} className="rounded border border-slate-800 bg-slate-950/35 p-2"><p className="text-[9px] font-medium leading-4 text-slate-100">{row?.headline}</p><p className="mt-1 text-[8px] text-slate-500">发布 {formatShortDate(row?.publishedAt)} · {document ? `正文读取 ${formatShortDate(document.retrievedAt)}` : '尚未读取'}</p>{document ? <div className="mt-2 space-y-1.5">{document.highlights.length ? document.highlights.slice(0, 4).map((item, index) => renderHighlight(url, item, index, true)) : <p className="text-[8px] text-slate-600">本篇没有规则锚点。</p>}</div> : <p className="mt-2 text-[8px] text-slate-600">点击“读取两篇并列段落”后才读取正文。</p>}</article>; })}</div> : <div className="mt-2 rounded border border-slate-800 bg-slate-950/35 p-3 text-[9px] leading-4 text-slate-500"><GitCompareArrows className="mb-2 h-4 w-4 text-cyan-300" />从材料架放入两篇不同材料；系统不会自动把单篇内容复制成第二列。</div>}</div> : null}
        {mode === 'dossier' ? <div className="mt-3" data-research-citation-package="true"><div className="rounded border border-slate-800 bg-slate-950/45 p-2"><div className="flex items-center justify-between gap-2"><p className="text-[9px] text-slate-400">已收录原文段落 {quoteEntries.length} 条</p><button type="button" onClick={downloadDossier} disabled={!quoteEntries.length} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[9px] text-cyan-200 hover:bg-cyan-950/30 disabled:opacity-50"><Download className="h-3 w-3" />下载摘录册</button></div><p className="mt-1 text-[8px] leading-3 text-slate-600">文件只含你选择的段落、读取时间和来源标识；下载不会打开第三方页面。</p></div>{quoteEntries.length ? <div className="mt-2 space-y-2">{quoteEntries.map(({ key, row, document, highlight }, index) => <article key={key} className="rounded border border-cyan-900/60 bg-cyan-950/10 p-2"><div className="flex items-start justify-between gap-2"><div><p className="text-[9px] font-medium leading-4 text-slate-100">{index + 1}. {row.headline}</p><p className="mt-1 font-mono text-[8px] text-slate-500">{categoryLabel(highlight.category)} · {highlight.phrase} · 读取 {formatShortDate(document.retrievedAt)}</p></div><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" /></div><p className="mt-1.5 text-[9px] leading-4 text-slate-400">{highlight.context}</p></article>)}</div> : <div className="mt-2 rounded border border-slate-800 bg-slate-950/35 p-3 text-[9px] leading-4 text-slate-500"><Download className="mb-2 h-4 w-4 text-cyan-300" />摘录册为空。请从“原文锚点”或“成对阅览”中收录实际段落；不会生成样例引文。</div>}</div> : null}
      </aside>
    </div>}
    <footer className="mt-3 flex items-start gap-1.5 rounded border border-cyan-900/50 bg-cyan-950/10 p-2 text-[9px] leading-4 text-slate-400"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />数据边界：{feed.data?.boundary ?? '仅显示服务器实际读取的官方 FEDS 发布材料。'} 原文只从白名单官方 HTML/文本按需读取，并始终在终端内呈现；此追加区不覆盖 ZIP 原始 29 项功能。</footer>
  </section>;
}

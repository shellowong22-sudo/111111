import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileSearch, RefreshCw, Sparkles, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type TabId = 'catalog' | 'evidence' | 'ai' | 'audit';
type Issuer = { cik: string; ticker: string; name: string };
type Filing = { form: string; filingDate: string | null; accessionNumber: string | null; primaryDocument: string | null; category: string };

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'catalog', label: '研究目录' },
  { id: 'evidence', label: '来源证据' },
  { id: 'ai', label: 'AI 证据摘要' },
  { id: 'audit', label: '版本审计' },
];
const tooltip = { contentStyle: { background: '#05080d', border: '1px solid #334155', color: '#e2e8f0', fontSize: 10 } };

export default function StockRESPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<TabId>('catalog');
  const [draft, setDraft] = useState('AAPL');
  const [queryText, setQueryText] = useState('AAPL');
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [keyword, setKeyword] = useState('risk');
  const [lastSummary, setLastSummary] = useState<any>(null);

  const issuerQuery = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query: queryText || '_', limit: 12 },
    { enabled: queryText.trim().length >= 2, staleTime: 6 * 60 * 60 * 1000, retry: false },
  );
  const issuers = (issuerQuery.data?.results ?? []) as Issuer[];
  useEffect(() => {
    if (!selectedIssuer && issuers.length) setSelectedIssuer(issuers[0]);
  }, [issuers, selectedIssuer]);
  const filingQuery = trpc.stockMarketResearch.getIssuerFilings.useQuery(
    { cik: selectedIssuer?.cik ?? '0' },
    { enabled: Boolean(selectedIssuer?.cik), staleTime: 60_000, retry: false },
  );
  const filings = (filingQuery.data?.filings ?? []) as Filing[];
  const selectedFiling = filings.find((row) => `${row.accessionNumber}:${row.primaryDocument}` === selectedKey) ?? filings[0] ?? null;
  useEffect(() => {
    if (selectedFiling && !selectedKey) setSelectedKey(`${selectedFiling.accessionNumber}:${selectedFiling.primaryDocument}`);
  }, [selectedFiling, selectedKey]);

  const excerptQuery = trpc.stockMarketResearch.getFilingExcerpt.useQuery(
    {
      cik: selectedIssuer?.cik ?? '0',
      accessionNumber: selectedFiling?.accessionNumber ?? '0000000000',
      primaryDocument: selectedFiling?.primaryDocument ?? 'missing.htm',
      keyword,
    },
    { enabled: tab === 'evidence' && Boolean(selectedIssuer?.cik && selectedFiling?.accessionNumber && selectedFiling?.primaryDocument && keyword.trim().length >= 2), retry: false },
  );
  const summarize = trpc.stockMarketResearch.summarizeFiling.useMutation({ onSuccess: (result) => setLastSummary(result) });
  const formSummary = useMemo(() => Object.entries(filings.reduce((map: Record<string, number>, row) => { map[row.form] = (map[row.form] ?? 0) + 1; return map; }, {})).map(([form, count]) => ({ form, count })), [filings]);

  const submitSearch = () => {
    const next = draft.trim();
    if (next.length < 2) return;
    setQueryText(next);
    setSelectedIssuer(null);
    setSelectedKey('');
    setLastSummary(null);
  };
  const runSummary = () => {
    if (!selectedIssuer || !selectedFiling?.accessionNumber || !selectedFiling.primaryDocument) return;
    summarize.mutate({ cik: selectedIssuer.cik, accessionNumber: selectedFiling.accessionNumber, primaryDocument: selectedFiling.primaryDocument });
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#05080d] font-mono text-xs text-slate-200" aria-label="RES 研究报告主页">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2"><FileSearch className="h-4 w-4 text-cyan-300" /><b className="text-cyan-200">RES</b><span>研究报告主页</span><span className="hidden text-[10px] text-slate-500 md:inline">公开披露研究、证据摘要与版本审计</span></div>
        <div className="flex items-center gap-2 text-[9px] text-slate-500"><span>{filingQuery.isFetching ? '正在刷新 SEC 目录' : selectedIssuer ? `${selectedIssuer.ticker} · CIK ${selectedIssuer.cik}` : '等待主体'}</span>{onClose && <button type="button" aria-label="关闭研究报告主页" onClick={onClose}><X className="h-4 w-4" /></button>}</div>
      </header>

      <div role="toolbar" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 p-2">
        <input aria-label="RES 主体搜索" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitSearch(); }} className="h-7 min-w-56 flex-1 border border-slate-700 bg-black px-2 text-[11px] outline-none focus:border-cyan-600" placeholder="公司、股票代码或 CIK" />
        <button type="button" onClick={submitSearch} disabled={draft.trim().length < 2 || issuerQuery.isFetching} className="inline-flex h-7 items-center gap-1 border border-slate-700 px-2 text-[10px] disabled:opacity-40"><RefreshCw className={`h-3 w-3 ${issuerQuery.isFetching ? 'animate-spin' : ''}`} />查找并去重</button>
        <span className="text-[9px] text-slate-500">主体：SEC EDGAR · 报告：原始申报元数据与受限正文</span>
      </div>

      {issuers.length > 0 && <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 p-1">{issuers.map((issuer) => <button type="button" key={issuer.cik} onClick={() => { setSelectedIssuer(issuer); setSelectedKey(''); setLastSummary(null); }} className={`shrink-0 border px-2 py-1 text-[9px] ${selectedIssuer?.cik === issuer.cik ? 'border-cyan-600 bg-cyan-950/30 text-cyan-100' : 'border-slate-800 text-slate-500'}`}>{issuer.ticker} · {issuer.name}</button>)}</div>}

      <nav className="flex shrink-0 overflow-x-auto border-b border-slate-800" aria-label="RES 子功能">
        {tabs.map((item) => <button type="button" key={item.id} onClick={() => setTab(item.id)} className={`border-r border-slate-800 px-3 py-2 text-[10px] ${tab === item.id ? 'bg-cyan-950/40 text-cyan-100' : 'text-slate-500 hover:text-slate-200'}`}>{item.label}</button>)}
      </nav>

      <div className="min-h-0 flex-1 overflow-auto">
        {issuerQuery.isError ? <div role="alert" className="p-6 text-amber-200">SEC 主体目录读取失败；不显示缓存样例主体。</div> : !selectedIssuer ? <div role="status" className="p-6 text-slate-500">输入至少两个字符并选择唯一 SEC 上市主体。</div> : filingQuery.isLoading ? <div role="status" className="p-6 text-slate-500">正在读取实际 SEC 申报目录…</div> : filingQuery.isError ? <div role="alert" className="p-6 text-amber-200">SEC 申报目录读取失败；不显示静态研究报告。</div> : tab === 'catalog' ? (
          <div className="grid min-h-[430px] lg:grid-cols-[1.2fr_.8fr]">
            <div className="overflow-auto border-r border-slate-800">
              <table className="w-full min-w-[690px] text-left text-[10px]"><thead className="sticky top-0 bg-[#05080d] text-slate-500"><tr><th className="p-2">申报日</th><th>表单</th><th>研究职责</th><th>主文件</th><th className="p-2">唯一版本</th></tr></thead><tbody>{filings.map((row) => { const key = `${row.accessionNumber}:${row.primaryDocument}`; return <tr key={key} className={`border-t border-slate-800 ${selectedFiling === row ? 'bg-cyan-950/30' : ''}`}><td className="p-2">{row.filingDate ?? '—'}</td><td><button type="button" onClick={() => setSelectedKey(key)} className="text-cyan-200">{row.form}</button></td><td className="text-slate-400">{row.category === 'financial_report' ? '财务报告证据' : row.category === 'capital_markets' ? '资本市场申报' : row.category === 'event' ? '重大事项披露' : '其他公开披露'}</td><td>{row.primaryDocument ?? '—'}</td><td className="p-2 font-mono text-slate-500">{row.accessionNumber ?? '—'}</td></tr>; })}{!filings.length && <tr><td colSpan={5} className="p-6 text-amber-200">该主体当前没有符合本页研究口径的申报。</td></tr>}</tbody></table>
            </div>
            <div className="p-3"><div className="mb-2 text-[10px] text-cyan-200">申报类型分布</div><div className="h-[360px]">{formSummary.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={formSummary}><CartesianGrid stroke="#1e293b" strokeDasharray="2 3" /><XAxis dataKey="form" tick={{ fill: '#94a3b8', fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 9 }} /><Tooltip {...tooltip} /><Bar dataKey="count" name="实际申报数" fill="#22d3ee" isAnimationActive={false} /></BarChart></ResponsiveContainer> : <div role="status" className="p-6 text-slate-500">没有可绘制的申报目录。</div>}</div></div>
          </div>
        ) : tab === 'evidence' ? (
          <div className="grid min-h-[430px] lg:grid-cols-[.78fr_1.22fr]">
            <div className="overflow-auto border-r border-slate-800"><table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">申报</th><th>日期</th><th>版本</th></tr></thead><tbody>{filings.map((row) => { const key = `${row.accessionNumber}:${row.primaryDocument}`; return <tr key={key} className={`border-t border-slate-800 ${selectedKey === key ? 'bg-cyan-950/30' : ''}`}><td className="p-2"><button type="button" onClick={() => setSelectedKey(key)} className="text-cyan-200">{row.form}</button></td><td>{row.filingDate ?? '—'}</td><td className="font-mono text-slate-500">{row.accessionNumber ?? '—'}</td></tr>; })}</tbody></table></div>
            <div><div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"><label className="text-[10px] text-slate-500">原文关键词<input aria-label="RES 原文关键词" value={keyword} onChange={(event) => setKeyword(event.target.value)} className="ml-2 h-7 border border-slate-700 bg-black px-2 text-slate-200" /></label><span className="text-[9px] text-slate-500">{selectedFiling?.form ?? '—'} · {selectedFiling?.filingDate ?? '—'}</span></div>{excerptQuery.isLoading ? <div role="status" className="p-6 text-slate-500">正在读取 SEC 主文件并定位连续证据…</div> : excerptQuery.isError ? <div role="alert" className="p-6 text-amber-200">主文件读取失败；不显示替代摘录。</div> : excerptQuery.data?.excerpt ? <article className="max-h-[470px] overflow-auto whitespace-pre-wrap p-3 text-[10px] leading-5 text-slate-300">{excerptQuery.data.excerpt}</article> : <div role="status" className="p-6 text-slate-500">输入至少两个字符；未命中时保持空结果。</div>}</div>
          </div>
        ) : tab === 'ai' ? (
          <div className="grid min-h-[430px] lg:grid-cols-[.72fr_1.28fr]">
            <div className="border-r border-slate-800 p-3"><h3 className="text-cyan-200">证据约束处理</h3><table className="mt-2 w-full text-left text-[10px]"><tbody>{[['主体', `${selectedIssuer.ticker} · CIK ${selectedIssuer.cik}`], ['表单', selectedFiling?.form ?? '—'], ['申报日', selectedFiling?.filingDate ?? '—'], ['文件编号', selectedFiling?.accessionNumber ?? '—'], ['主文件', selectedFiling?.primaryDocument ?? '—']].map(([label, value]) => <tr key={label} className="border-t border-slate-800"><th className="w-24 p-2 font-normal text-slate-500">{label}</th><td className="p-2 break-all">{value}</td></tr>)}</tbody></table><button type="button" onClick={runSummary} disabled={!selectedFiling?.accessionNumber || !selectedFiling.primaryDocument || summarize.isPending} className="mt-3 inline-flex items-center gap-1 border border-cyan-700 px-3 py-2 text-[10px] text-cyan-100 disabled:opacity-40"><Sparkles className="h-3 w-3" />{summarize.isPending ? '正在校验证据并处理' : '生成可追溯摘要'}</button>{summarize.error && <p role="alert" className="mt-3 text-[10px] leading-5 text-amber-200">处理未完成：{summarize.error.message}</p>}<p className="mt-3 text-[9px] leading-5 text-slate-500">只有登录账户、可读原文、可用模型和逐字证据校验同时通过才会产生结果。不会显示假成功提示。</p></div>
            <div className="overflow-auto p-3">{lastSummary?.status === 'available' && lastSummary.summary ? <div><div className="border-b border-slate-800 pb-2"><h3 className="text-sm text-cyan-100">{lastSummary.summary.headline}</h3><blockquote className="mt-2 border-l border-cyan-800 pl-2 text-[10px] leading-5 text-slate-400">{lastSummary.summary.headlineEvidence}</blockquote></div><table className="mt-2 w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">类别</th><th>结论字段</th><th>连续原文证据</th></tr></thead><tbody>{(lastSummary.summary.keyPoints ?? []).map((row: any, index: number) => <tr key={`point-${index}`} className="border-t border-slate-800"><td className="p-2 text-cyan-200">要点</td><td>{row.point}</td><td className="p-2 text-slate-400">{row.evidence}</td></tr>)}{(lastSummary.summary.financialFacts ?? []).map((row: any, index: number) => <tr key={`fact-${index}`} className="border-t border-slate-800"><td className="p-2 text-emerald-300">事实</td><td>{row.label} · {row.period} · {row.value}</td><td className="p-2 text-slate-400">{row.evidence}</td></tr>)}{(lastSummary.summary.riskAlerts ?? []).map((row: any, index: number) => <tr key={`risk-${index}`} className="border-t border-slate-800"><td className="p-2 text-amber-200">风险</td><td>{row.category}</td><td className="p-2 text-slate-400">{row.evidence}</td></tr>)}</tbody></table><p className="mt-3 border-t border-slate-800 pt-2 text-[9px] text-slate-500">{lastSummary.summary.sourceLimitations}</p></div> : lastSummary ? <div role="status" className="p-6 text-amber-200">模型、原文或证据校验未完成；没有生成替代摘要。</div> : <div role="status" className="p-6 text-slate-500">选择申报并运行后，在此显示带逐字证据的结构化摘要。</div>}</div>
          </div>
        ) : (
          <div className="p-3"><table className="w-full max-w-5xl text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">审计字段</th><th>实际状态</th><th>用途</th></tr></thead><tbody>{[['主体 ID', selectedIssuer.cik, '唯一 SEC CIK'], ['申报版本', selectedFiling?.accessionNumber ?? '—', '唯一版本与去重键'], ['主文件', selectedFiling?.primaryDocument ?? '—', '正文边界'], ['来源指纹', lastSummary?.sourceFingerprint ?? '尚未处理', '原文内容哈希'], ['模型版本', lastSummary?.model ?? '尚未处理', '处理版本追踪'], ['读取时间', lastSummary?.retrievedAt ?? '尚未处理', '来源读取时点'], ['缓存命中', lastSummary?.status === 'available' ? (lastSummary.cached ? '是' : '否') : '尚未处理', '同一指纹不重复调用']].map(([field, value, duty]) => <tr key={field} className="border-t border-slate-800"><td className="p-2 text-cyan-200">{field}</td><td className="break-all font-mono">{value}</td><td className="p-2 text-slate-500">{duty}</td></tr>)}</tbody></table><p className="mt-3 max-w-5xl border-t border-slate-800 pt-2 text-[9px] leading-5 text-slate-500">研究报告页不展示静态分析师评级、虚构目标价或样例一致预期。分析师许可数据属于 ANR 的唯一职责；文件全文检索属于 DS；本页只负责公开披露证据形成研究摘要与版本审计。</p></div>
        )}
      </div>
      <footer className="shrink-0 border-t border-slate-800 px-3 py-1 text-[9px] leading-5 text-slate-500">{lastSummary?.sourceBoundary ?? filingQuery.data?.sourceBoundary ?? issuerQuery.data?.sourceBoundary ?? '唯一职责：将公开申报转换为可追溯、证据约束、可审计的研究摘要；不复刻分析师建议或文件检索。'}</footer>
    </section>
  );
}

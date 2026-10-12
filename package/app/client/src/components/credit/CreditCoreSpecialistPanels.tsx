import { useMemo, useState } from 'react';
import { Download, ExternalLink, FileSearch, Search } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Card, Metric, PanelShell } from '@/components/sovereign/PanelKit';
import { CreditEvidencePanel } from './CreditEvidencePanel';
import { CreditOasThresholdRules } from './CreditOasThresholdRules';

function csv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const quote = (v: string | number | null | undefined) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const blob = new Blob([`\uFEFF${[headers.map(quote).join(','), ...rows.map((row) => row.map(quote).join(','))].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function Blank({ children }: { children: string }) {
  return <div className="rounded border border-dashed border-slate-700 bg-slate-950/30 px-3 py-8 text-center text-xs text-slate-500">{children}</div>;
}

function MarketMonitorPanel() {
  const [rangeDays, setRangeDays] = useState<30 | 90 | 180>(90);
  const [selected, setSelected] = useState<string[]>(['IG', 'AAA', 'AA', 'BBB', 'HY']);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const query = trpc.creditResearch.getOasSnapshot.useQuery(undefined, { staleTime: 30_000, refetchInterval: autoRefresh ? 60_000 : false, refetchOnWindowFocus: false });
  const series = (query.data?.series ?? []).filter((item) => selected.includes(item.bucket));
  const chart = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - rangeDays);
    const rows: Record<string, Record<string, string | number>> = {};
    series.forEach((item) => item.history.forEach((point) => {
      if (new Date(point.date) >= cutoff) rows[point.date] = { ...(rows[point.date] ?? {}), date: point.date, [item.bucket]: point.valuePct * 100 };
    }));
    return Object.values(rows).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [rangeDays, series]);
  const palette: Record<string, string> = { IG: '#22d3ee', AAA: '#a78bfa', AA: '#60a5fa', BBB: '#f59e0b', HY: '#fb7185' };
  const ig = series.find((item) => item.bucket === 'IG'); const hy = series.find((item) => item.bucket === 'HY');
  const qualityGap = ig?.valueBps !== null && ig?.valueBps !== undefined && hy?.valueBps !== null && hy?.valueBps !== undefined ? hy.valueBps - ig.valueBps : null;
  const toggle = (bucket: string) => setSelected((current) => current.includes(bucket) ? current.filter((item) => item !== bucket) : [...current, bucket]);
  return <PanelShell ticker="2" title="当前市场" subtitle="信用市场脉冲与风险桶观察" onRefresh={() => query.refetch()}>
    {query.isLoading ? <div className="grid gap-3 md:grid-cols-3"><div className="h-28 animate-pulse rounded bg-slate-800" /><div className="h-28 animate-pulse rounded bg-slate-800" /><div className="h-28 animate-pulse rounded bg-slate-800" /></div> : query.error ? <Blank>公开 OAS 当前不可读取；不会使用静态样本或合成路径替代。请点击刷新重试。</Blank> : <div className="space-y-3"><Card title="观察控制" action={<label className="text-[11px] text-slate-400"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="mr-1" />每分钟刷新</label>}><div className="flex flex-wrap gap-1"><span className="mr-1 py-1 text-[11px] text-slate-500">窗口</span>{([30, 90, 180] as const).map((days) => <button key={days} type="button" onClick={() => setRangeDays(days)} className={`rounded border px-2 py-1 text-xs ${rangeDays === days ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{days}D</button>)}<span className="ml-3 mr-1 py-1 text-[11px] text-slate-500">风险桶</span>{['IG', 'AAA', 'AA', 'BBB', 'HY'].map((bucket) => <button key={bucket} type="button" onClick={() => toggle(bucket)} className={`rounded border px-2 py-1 text-xs ${selected.includes(bucket) ? 'border-cyan-800 text-cyan-200' : 'border-slate-700 text-slate-500'}`}>{bucket}</button>)}</div></Card><div className="grid gap-2 sm:grid-cols-3"><Card title="IG 指数级 OAS"><Metric label="最新观测" value={ig?.valueBps === null || ig?.valueBps === undefined ? '—' : ig.valueBps.toFixed(1)} unit="bp" tone="info" sub={ig?.observationDate ?? '未返回观察日'} /></Card><Card title="HY 指数级 OAS"><Metric label="最新观测" value={hy?.valueBps === null || hy?.valueBps === undefined ? '—' : hy.valueBps.toFixed(1)} unit="bp" tone="warn" sub={hy?.observationDate ?? '未返回观察日'} /></Card><Card title="HY - IG 风险差"><Metric label="同日指标差" value={qualityGap === null ? '—' : qualityGap.toFixed(1)} unit={qualityGap === null ? undefined : 'bp'} sub="不构成单券相对价值结论" /></Card></div><Card title="评级风险桶路径" action={<button type="button" onClick={() => csv('credit-market-pulse.csv', ['日期', ...series.map((item) => item.bucket)], chart.map((row) => [String(row.date), ...series.map((item) => row[item.bucket] as string | number | undefined)]))} disabled={!chart.length} className="text-[11px] text-cyan-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />导出</button>}><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={32} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} formatter={(value) => `${Number(value).toFixed(1)} bp`} />{series.map((item) => <Line key={item.bucket} type="monotone" dataKey={item.bucket} stroke={palette[item.bucket]} strokeWidth={1.8} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div><p className="mt-2 text-[10px] text-slate-500">指数级日度 OAS；不等同于单券报价、实时 TRACE 或 CDS。</p></Card><CreditOasThresholdRules series={query.data?.series ?? []} /></div>}
  </PanelShell>;
}

function DisclosurePanel() {
  const [ticker, setTicker] = useState('IBM'); const [filter, setFilter] = useState('ALL');
  const query = trpc.creditResearch.getIssuerFilings.useQuery({ ticker }, { enabled: false, retry: false });
  const filings = (query.data?.filings ?? []).filter((item) => filter === 'ALL' || item.form === filter);
  return <PanelShell ticker="8" title="新闻/研究报告" subtitle="监管文件筛选、原文证据摘录与审阅">
    <div className="grid gap-3 xl:grid-cols-[0.78fr_1.42fr]"><Card title="证据筛查条件"><label className="text-xs text-slate-400">美国发行人 ticker<input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z.\-]/g, ''))} className="input-terminal mt-1 w-full font-mono" /></label><label className="mt-2 block text-xs text-slate-400">文件类型<select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-terminal mt-1 w-full"><option value="ALL">全部文件</option><option value="10-K">10-K</option><option value="10-Q">10-Q</option><option value="8-K">8-K</option></select></label><button type="button" onClick={() => query.refetch()} disabled={!ticker.trim() || query.isFetching} className="mt-3 inline-flex items-center gap-1 rounded border border-cyan-800 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-40"><FileSearch className="h-3.5 w-3.5" />{query.isFetching ? '读取中' : '筛查 SEC 文件'}</button><span  className="mt-3 block text-xs text-cyan-300">SEC EDGAR 原始检索 <ExternalLink className="inline h-3.5 w-3.5" /></span></Card><Card title="披露证据时间线">{query.isFetching ? <div className="h-52 animate-pulse rounded bg-slate-800" /> : !query.data ? <Blank>开始筛查后显示 SEC 原始文件时间线。</Blank> : !query.data.available ? <Blank>{query.data.limitation}</Blank> : <div className="space-y-2">{filings.map((filing) => <span key={filing.sourceUrl}  className="flex items-center justify-between gap-3 rounded border border-slate-800 p-2 hover:border-cyan-800"><span><span className="font-mono text-cyan-200">{filing.form}</span><span className="ml-2 text-xs text-slate-300">{filing.description || '公开披露文件'}</span></span><span className="text-[10px] text-slate-500">{filing.filingDate || '—'} <ExternalLink className="ml-1 inline h-3 w-3" /></span></span>)}{filings.length === 0 && <Blank>当前筛选没有匹配文件。</Blank>}</div>}</Card></div>{query.data?.available && <div className="mt-3"><CreditEvidencePanel filingSet={{ issuer: query.data.issuer, ticker: query.data.ticker, filings: query.data.filings }} /></div>}
  </PanelShell>;
}

function SpreadCalculatorPanel() {
  const [bondYield, setBondYield] = useState(''); const [benchmarkYield, setBenchmarkYield] = useState(''); const [priorSpread, setPriorSpread] = useState(''); const [asOf, setAsOf] = useState('');
  const bond = Number(bondYield); const benchmark = Number(benchmarkYield); const prior = Number(priorSpread);
  const spread = bondYield.trim() && benchmarkYield.trim() && Number.isFinite(bond) && Number.isFinite(benchmark) ? (bond - benchmark) * 100 : null;
  const change = spread !== null && priorSpread.trim() && Number.isFinite(prior) ? spread - prior : null;
  return <PanelShell ticker="9" title="计算器与分析" subtitle="名义利差口径、观察日与前次变动复核">
    <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]"><Card title="计算输入"><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">债券到期收益率（%）<input inputMode="decimal" value={bondYield} onChange={(e) => setBondYield(e.target.value)} className="input-terminal mt-1 w-full" placeholder="5.20" /></label><label className="text-xs text-slate-400">同币种基准收益率（%）<input inputMode="decimal" value={benchmarkYield} onChange={(e) => setBenchmarkYield(e.target.value)} className="input-terminal mt-1 w-full" placeholder="4.35" /></label><label className="text-xs text-slate-400">前次名义利差（bp）<input inputMode="decimal" value={priorSpread} onChange={(e) => setPriorSpread(e.target.value)} className="input-terminal mt-1 w-full" placeholder="可选" /></label><label className="text-xs text-slate-400">观察日<input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input-terminal mt-1 w-full" /></label></div></Card><Card title="名义利差复核" action={<button type="button" onClick={() => csv('credit-nominal-spread-calculation.csv', ['观察日', '债券收益率%', '基准收益率%', '名义利差bp', '前次利差bp', '变动bp'], [[asOf, bondYield, benchmarkYield, spread?.toFixed(2), priorSpread, change?.toFixed(2)]])} disabled={spread === null} className="text-[11px] text-amber-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />导出</button>}>{spread === null ? <Blank>输入同币种、同期限债券和基准收益率后复核名义利差。</Blank> : <><div className="grid gap-3 sm:grid-cols-3"><Metric label="名义利差" value={spread.toFixed(2)} unit="bp" tone="warn" /><Metric label="较前次" value={change === null ? '—' : change.toFixed(2)} unit={change === null ? undefined : 'bp'} tone={change !== null && change > 0 ? 'neg' : 'pos'} /><Metric label="观察日期" value={asOf || '未填'} /></div><div className="mt-4 rounded border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">已按用户输入的同币种、同期限口径生成名义利差复核结果。请核验债券条款、基准口径与观察日期后使用。</div><p className="mt-3 text-[10px] text-slate-500">此结果不是 OAS、Z-spread、可成交利差、估值或投资建议。期限、税制和嵌入期权需要由用户自行核验。</p></>}</Card></div>
  </PanelShell>;
}

function IssuerNavigatorPanel() {
  const [ticker, setTicker] = useState('IBM'); const [term, setTerm] = useState('');
  const query = trpc.creditResearch.getIssuerFilings.useQuery({ ticker }, { enabled: false, retry: false });
  const files = (query.data?.filings ?? []).filter((item) => `${item.form} ${item.description ?? ''} ${item.filingDate ?? ''}`.toLowerCase().includes(term.toLowerCase()));
  return <PanelShell ticker="IN" title="佑诚信债浏览器" subtitle="发行人公开文件目录与原文跳转">
    <div className="grid gap-3 xl:grid-cols-[0.72fr_1.48fr]"><Card title="发行人文件目录"><label className="text-xs text-slate-400">Ticker<input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z.\-]/g, ''))} className="input-terminal mt-1 w-full font-mono" /></label><button type="button" onClick={() => query.refetch()} disabled={!ticker.trim() || query.isFetching} className="mt-3 inline-flex items-center gap-1 rounded border border-cyan-800 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-40"><Search className="h-3.5 w-3.5" />{query.isFetching ? '构建中' : '构建 SEC 目录'}</button><p className="mt-4 text-[10px] text-slate-500">目录导航的是发行人披露，并非债券证券主数据或实时价格屏幕。</p></Card><Card title="原始文件浏览">{query.data?.available ? <><div className="mb-2 flex items-center justify-between gap-2"><label className="relative flex-1"><Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={term} onChange={(e) => setTerm(e.target.value)} className="input-terminal w-full pl-7" placeholder="按类型、描述或日期筛选" /></label><span className="text-[10px] text-slate-500">{query.data.issuer} · CIK {query.data.cik}</span></div><div className="max-h-96 overflow-auto">{files.map((file) => <span key={file.sourceUrl}  className="flex items-center justify-between gap-3 border-b border-slate-800 px-2 py-2 text-xs hover:bg-slate-900/40"><span><span className="font-mono text-cyan-200">{file.form}</span><span className="ml-2 text-slate-300">{file.description || '公开文件'}</span></span><span className="text-[10px] text-slate-500">{file.filingDate || '—'} <ExternalLink className="ml-1 inline h-3 w-3" /></span></span>)}{files.length === 0 && <Blank>没有匹配的已返回文件。</Blank>}</div></> : query.data ? <Blank>{query.data.limitation}</Blank> : <Blank>输入 ticker 并构建 SEC 原始文件目录。</Blank>}</Card></div>
  </PanelShell>;
}

export default function CreditCoreSpecialistPanels({ moduleId }: { moduleId: string }) {
  if (moduleId === '2') return <MarketMonitorPanel />;
  if (moduleId === '8') return <DisclosurePanel />;
  if (moduleId === '9') return <SpreadCalculatorPanel />;
  if (moduleId === '10') return <IssuerNavigatorPanel />;
  return null;
}

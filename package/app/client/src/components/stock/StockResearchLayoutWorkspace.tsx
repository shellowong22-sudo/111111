import React, { useEffect, useId, useRef, useState } from 'react';
import { GripVertical, RotateCcw, Save, Sparkles } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { LoadingState } from '@/components/sovereign/PanelKit';

import { EnvironmentObservationDesk, TickerObservationDesk, ResearchSplit } from './StockObservationDesk';

type LayoutId = 'environment' | 'ticker' | 'issuer' | 'facts' | 'filing';
type LayoutItem = { id: LayoutId; visible: boolean };
type Filing = { form: string; filingDate: string | null; accessionNumber: string | null; primaryDocument: string | null; category: string };
const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: 'environment', visible: true }, { id: 'ticker', visible: true }, { id: 'issuer', visible: true }, { id: 'facts', visible: true }, { id: 'filing', visible: true },
];
const LAYOUT_LABELS: Record<LayoutId, string> = { environment: '市场环境矩阵', ticker: '证券报价与历史', issuer: 'SEC 主体', facts: '报告期事实', filing: '申报与证据' };

function compactLayout(value: unknown): LayoutItem[] {
  if (!Array.isArray(value)) return DEFAULT_LAYOUT.map((item) => ({ ...item }));
  const seen = new Set<string>(); const ordered: LayoutItem[] = [];
  for (const item of value) {
    if (!item || typeof item.visible !== 'boolean' || seen.has(item.id) || !DEFAULT_LAYOUT.some((base) => base.id === item.id)) continue;
    seen.add(item.id); ordered.push({ id: item.id, visible: item.visible });
  }
  DEFAULT_LAYOUT.forEach((item) => { if (!seen.has(item.id)) ordered.push({ ...item }); });
  if (!ordered.some((item) => item.visible)) ordered[0].visible = true;
  return ordered;
}

function EnvironmentPanel() { return <EnvironmentObservationDesk />; }

function TickerPanel({ linkedTicker }: { linkedTicker?: string }) { return <TickerObservationDesk linkedTicker={linkedTicker} />; }

function IssuerPanel({ cik, onIssuer }: { cik: string; onIssuer: (next: { cik: string; name: string; ticker: string }) => void }) {
  const [draft, setDraft] = useState('AAPL'); const search = trpc.stockMarketResearch.searchIssuers.useQuery({ query: draft || 'A', limit: 6 }, { enabled: draft.trim().length >= 2, staleTime: 6 * 60 * 60 * 1000 });
  return <><input aria-label="SEC 主体搜索" value={draft} onChange={(event) => setDraft(event.target.value)} className="input-terminal w-full text-xs" placeholder="名称、代码或 CIK" /><div className="mt-2 max-h-36 overflow-auto border-y border-slate-800">{search.isLoading ? <LoadingState text="正在读取 SEC 主体…" /> : (search.data?.results ?? []).map((issuer: any) => <button type="button" key={issuer.cik} onClick={() => onIssuer(issuer)} className={`block w-full border-b border-slate-800 p-2 text-left text-xs hover:bg-slate-900 ${cik === issuer.cik ? 'bg-cyan-950/30' : ''}`}><span className="font-mono text-cyan-200">{issuer.ticker}</span><span className="ml-2 text-slate-400">{issuer.name}</span></button>)}</div><p className="mt-2 text-[10px] text-slate-500">SEC 主体目录用于公开披露核验，不表示证券覆盖或可交易性。</p></>;
}

function FactsPanel({ cik }: { cik: string }) {
  const query = trpc.stockMarketResearch.getCompanyFacts.useQuery({ cik: cik || '0' }, { enabled: Boolean(cik), staleTime: 60_000 });
  const [metricId, setMetricId] = useState('RevenueFromContractWithCustomerExcludingAssessedTax');
  const [periodType, setPeriodType] = useState('all');
  const [form, setForm] = useState('all');
  useEffect(() => { setMetricId('RevenueFromContractWithCustomerExcludingAssessedTax'); setPeriodType('all'); setForm('all'); }, [cik]);
  if (!cik) return <p className="p-4 text-xs text-slate-500">选择左侧发行主体，读取同一 CIK 的报告期事实。</p>;
  if (query.isLoading) return <LoadingState text="正在读取 SEC XBRL 公司事实…" />;
  const metrics = query.data?.metrics ?? [];
  const metric = metrics.find((row: any) => row.id === metricId) ?? metrics.find((row: any) => row.id === 'RevenueFromContractWithCustomerExcludingAssessedTax') ?? metrics[0];
  const observations = (metric?.observations ?? []).filter((row: any) => (periodType === 'all' || row.periodType === periodType) && (form === 'all' || (row.accessionNumber ?? row.accn) === form)).slice().reverse();
  const forms: Array<[string, string]> = Array.from(
    new Map<string, string>(
      (metric?.observations ?? [])
        .filter((row: any) => row.accessionNumber ?? row.accn)
        .map((row: any): [string, string] => [
          String(row.accessionNumber ?? row.accn),
          `${row.form ?? 'SEC'} · ${row.accessionNumber ?? row.accn}`,
        ])
    ).entries()
  );
  const periodLabels: Record<string, string> = { all: '全部期间', quarter: '季度（约70–110日）', half_year: '半年（约150–210日）', nine_months: '九个月（约240–300日）', annual: '年度（约330–385日）', instant: '时点', unknown: '未判定期间', other: '其他期间' };
  return <>
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"><span className="text-xs text-cyan-100">{query.data?.issuer?.name ?? cik}</span><label className="text-[10px] text-slate-500">SEC 字段<select aria-label="SEC 报告指标" value={metric?.id ?? ''} onChange={(event) => { setMetricId(event.target.value); setPeriodType('all'); setForm('all'); }} className="input-terminal ml-1 h-7 max-w-[260px] text-[10px]">{metrics.map((item: any) => <option value={item.id} key={item.id}>{item.label} · {item.id}</option>)}</select></label><label className="text-[10px] text-slate-500">期间类型<select aria-label="期间类型筛选" value={periodType} onChange={(event) => setPeriodType(event.target.value)} className="input-terminal ml-1 h-7 text-[10px]">{Object.entries(periodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="text-[10px] text-slate-500">申报版本<select aria-label="申报版本筛选" value={form} onChange={(event) => setForm(event.target.value)} className="input-terminal ml-1 h-7 text-[10px]"><option value="all">全部版本</option>{forms.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
    <div className="border-b border-slate-800 px-2 py-1 text-[10px] text-slate-500">最新观测期末：{metric?.latestObservationDate ?? '—'} · 当前字段记录：{observations.length}/{metric?.totalObservations ?? 0} · 来源保留 {metric?.truncatedObservations ?? 0} 条较早记录未在本次响应展开</div>
    <div className="max-h-[330px] overflow-auto"><table className="w-full min-w-[880px] text-right text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="px-2 py-2 text-left">起始日</th><th className="px-2 text-left">结束日</th><th className="px-2">期间类型</th><th className="px-2">天数</th><th className="px-2">报告期 / 财年</th><th className="px-2">值 / {metric?.unit ?? '—'}</th><th className="px-2">表单</th><th className="px-2">申报版本 / 日期</th></tr></thead><tbody>{observations.map((row: any, index: number) => <tr key={`${metric?.id}-${row.id ?? row.periodId}-${row.accessionNumber ?? 'na'}-${index}`} className="border-t border-slate-800 font-mono"><td className="px-2 py-1.5 text-left text-slate-400">{row.start ?? '时点'}</td><td className="px-2 py-1.5 text-left text-cyan-200">{row.end ?? '—'}</td><td className="px-2 text-slate-300">{periodLabels[row.periodType] ?? row.periodType ?? '—'}</td><td className="px-2 text-slate-400">{row.durationDays ?? '—'}</td><td className="px-2 text-slate-400">{row.fp ?? '—'} / {row.fy ?? '—'}</td><td className="px-2 text-slate-100">{typeof row.value === 'number' ? row.value.toLocaleString('zh-CN', { maximumFractionDigits: 4 }) : '—'}</td><td className="px-2 text-slate-400">{row.form ?? '—'}</td><td className="px-2 text-slate-500"><span className="block">{row.accessionNumber ?? row.accn ?? '—'}</span><span className="block">{row.filed ?? row.filingDate ?? '—'}</span></td></tr>)}</tbody></table></div>
    {!metrics.length && <p className="p-3 text-xs text-amber-200">{query.error?.message ?? query.data?.sourceBoundary ?? '未取得可展示的 XBRL 事实。'}</p>}
    {metrics.length > 0 && !observations.length && <p className="p-3 text-xs text-amber-200">当前期间类型与申报版本筛选没有匹配记录；清空筛选后仍保留全部 SEC 申报版本。</p>}
    <footer className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">来源 SEC XBRL；合同客户收入默认优先展示。期间起止、持续天数、期间类型和申报版本均来自 SEC 字段，不混合季度、累计和时点事实；如需图表请先固定同一期间类型。{query.data?.sourceBoundary}</footer>
  </>;
}
function FilingSummary({ cik, filing }: { cik: string; filing: Filing | null }) {
  const { isAuthenticated } = useAuth(); const summary = trpc.stockMarketResearch.summarizeFiling.useMutation();
  if (!filing?.accessionNumber || !filing.primaryDocument) return <p className="p-3 text-xs text-slate-500">点击一份 SEC 申报，联动原文证据与智能摘要。</p>;
  const data = summary.data?.summary;
  const records = data ? [...data.financialFacts.map((item: any) => ({ type: '财务事实', text: `${item.label} · ${item.period} · ${item.value}`, evidence: item.evidence })), ...data.riskAlerts.map((item: any) => ({ type: '风险提示', text: item.category, evidence: item.evidence })), ...data.keyPoints.map((item: any) => ({ type: '阅读要点', text: item.point, evidence: item.evidence }))] : [];
  return <div className="border-t border-slate-800"><div className="flex flex-wrap items-center justify-between gap-2 p-2"><b className="text-xs text-violet-200"><Sparkles className="mr-1 inline h-3 w-3" />智能摘要与原文证据</b><button type="button" disabled={!isAuthenticated || summary.isPending} onClick={() => summary.mutate({ cik, accessionNumber: filing.accessionNumber!, primaryDocument: filing.primaryDocument! })} className="border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40">{!isAuthenticated ? '登录后生成' : summary.isPending ? '生成中…' : data ? '重新生成' : '生成摘要'}</button></div>{summary.isPending ? <LoadingState text="正在依据当前 SEC 主文件生成可核验摘要…" /> : data ? <><div className="border-y border-slate-800 px-2 py-2"><p className="text-xs text-slate-200">{data.headline}</p><p className="mt-1 text-[10px] text-slate-500">标题证据：{data.headlineEvidence}</p></div><table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">类别</th><th className="p-2">摘要</th><th className="p-2">原文证据</th></tr></thead><tbody>{records.map((row, index) => <tr key={index} className="border-t border-slate-800 align-top"><td className="p-2 whitespace-nowrap text-cyan-200">{row.type}</td><td className="p-2 text-slate-300">{row.text}</td><td className="p-2 text-slate-500">{row.evidence}</td></tr>)}</tbody></table></> : <p className="px-2 py-3 text-xs text-slate-500">{summary.isError ? summary.error.message : summary.data?.sourceBoundary ?? '按需生成，所有摘要须包含当前原文件证据；未生成时不展示替代内容。'}</p>}{summary.data && <p className="p-2 text-[9px] text-slate-500">模型 {summary.data.model ?? '未调用成功'} · 读取 {summary.data.retrievedAt ?? '—'} · {summary.data.sourceBoundary}</p>}</div>;
}

function FilingPanel({ cik }: { cik: string }) {
  const query = trpc.stockMarketResearch.getIssuerFilings.useQuery({ cik: cik || '0' }, { enabled: Boolean(cik), staleTime: 60_000 });
  const [selected, setSelected] = useState<Filing | null>(null); const [form, setForm] = useState('all');
  useEffect(() => { setSelected(null); setForm('all'); }, [cik]);
  const records = query.data?.filings ?? []; const filtered = records.filter((row: Filing) => form === 'all' || row.form === form);
  if (!cik) return <p className="p-3 text-xs text-slate-500">选择发行主体后读取 SEC 申报目录与证据。</p>;
  if (query.isLoading) return <LoadingState text="正在读取 SEC 申报目录…" />;
  return <><div className="flex items-center justify-between border-b border-slate-800 p-2"><b className="text-xs text-cyan-100">{query.data?.issuer?.name ?? cik}</b><select aria-label="申报表单类型" value={form} onChange={(event) => { setForm(event.target.value); setSelected(null); }} className="input-terminal h-7 text-[10px]"><option value="all">全部表单</option>{Array.from(new Set(records.map((row: Filing) => row.form))).map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
    <div className="max-h-[260px] overflow-auto"><table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">表单</th><th className="p-2">申报日</th><th className="p-2">主文件 / 编号</th></tr></thead><tbody>{filtered.map((row: Filing) => <tr key={`${row.accessionNumber}-${row.primaryDocument}`} className={`border-t border-slate-800 ${selected?.accessionNumber === row.accessionNumber ? 'bg-violet-950/35' : 'hover:bg-slate-900'}`}><td className="p-2 font-mono text-amber-200"><button type="button" onClick={() => setSelected(row)}>{row.form}</button></td><td className="p-2 text-slate-400">{row.filingDate ?? '—'}</td><td className="p-2 text-slate-400"><button type="button" onClick={() => setSelected(row)} className="text-left">{row.primaryDocument ?? '主文件未返回'}<span className="block font-mono text-[9px] text-slate-600">{row.accessionNumber}</span></button></td></tr>)}</tbody></table></div>
    {!filtered.length && <p className="p-3 text-xs text-amber-200">{query.error?.message ?? query.data?.sourceBoundary ?? '当前筛选未匹配申报。'}</p>}
    <FilingSummary key={`${cik}-${selected?.accessionNumber ?? "empty"}`} cik={cik} filing={selected} /><footer className="border-t border-slate-800 p-2 text-[9px] text-slate-500">{query.data?.sourceBoundary}</footer>
  </>;
}

export default function StockResearchLayoutWorkspace({ anchorId }: { anchorId?: string }) {
  const instanceId = useId();
  const tabPrefix = `${anchorId ?? 'stock-research'}-${instanceId}`;
  const { isAuthenticated } = useAuth();
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [active, setActive] = useState<LayoutId>('environment');
  const [isDirty, setIsDirty] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [issuer, setIssuer] = useState({ cik: '', name: '', ticker: '' });
  const dragId = useRef<LayoutId | null>(null);
  const layoutQuery = trpc.stockMarketResearch.getWorkspaceLayout.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const saveLayout = trpc.stockMarketResearch.saveWorkspaceLayout.useMutation();
  useEffect(() => { if (layoutQuery.data?.layout && !isDirty) setLayout(compactLayout(layoutQuery.data.layout)); }, [layoutQuery.data?.layout, isDirty]);
  const move = (from: LayoutId, to: LayoutId) => {
    setLayout((items) => { const next = [...items]; const a = next.findIndex((item) => item.id === from); const b = next.findIndex((item) => item.id === to); if (a < 0 || b < 0 || a === b) return items; const [moved] = next.splice(a, 1); next.splice(b, 0, moved); return next; });
    setIsDirty(true);
  };
  const visible = layout.filter((item) => item.visible);
  const hidden = layout.filter((item) => !item.visible);
  const current = visible.some((item) => item.id === active) ? active : visible[0]?.id ?? 'environment';
  const toggle = (id: LayoutId) => { if (visible.length === 1 && visible[0].id === id) return; setLayout((items) => items.map((item) => item.id === id ? { ...item, visible: !item.visible } : item)); setIsDirty(true); };
  const activate = (id: LayoutId) => { if (!visible.some((item) => item.id === id)) toggle(id); setActive(id); };
  const buttonClass = 'border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-40';
  return <section id={anchorId} aria-label="股票综合研究工作台" className="mx-4 mt-3 min-w-0 border-y border-violet-900/50 bg-slate-950/40">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 p-2">
      <div><b className="text-xs text-violet-100">股票综合研究工作台</b><span className="ml-2 text-[10px] text-slate-500">选行联动图表 · 单一数据工作区</span></div>
      <div className="flex flex-wrap gap-1">
        <button type="button" disabled={!isAuthenticated || saveLayout.isPending || !isDirty} onClick={() => saveLayout.mutate({ layout }, { onSuccess: (saved) => { setLayout(compactLayout(saved.layout)); setIsDirty(false); } })} className={buttonClass}><Save className="mr-1 inline h-3 w-3" />{!isAuthenticated ? '登录后保存' : saveLayout.isPending ? '保存中' : '保存布局'}</button>
        <button type="button" onClick={() => { setLayout(DEFAULT_LAYOUT.map((item) => ({ ...item }))); setActive('environment'); setIsDirty(true); }} className={buttonClass}><RotateCcw className="mr-1 inline h-3 w-3" />恢复默认</button>
        <button type="button" onClick={() => setShowHidden((value) => !value)} className={buttonClass}>显隐设置 {hidden.length}</button>
      </div>
    </header>
    <nav role="tablist" aria-label="股票研究工作区" className="flex overflow-auto border-b border-slate-800">
      {visible.map((item, index) => <button type="button" role="tab" id={`${tabPrefix}-tab-${item.id}`} aria-controls={`${tabPrefix}-panel-${item.id}`} tabIndex={current === item.id ? 0 : -1} aria-selected={current === item.id} key={item.id} draggable onDragStart={() => { dragId.current = item.id; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragId.current) move(dragId.current, item.id); dragId.current = null; }} onKeyDown={(event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length;
        if (event.altKey) move(current, visible[next].id);
        else { setActive(visible[next].id); (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus(); }
      }} onClick={() => setActive(item.id)} className={`flex shrink-0 items-center gap-1 border-r border-slate-800 px-3 py-2 text-[11px] ${current === item.id ? 'bg-violet-950/35 text-violet-100' : 'text-slate-400 hover:bg-slate-900'}`}><GripVertical className="h-3 w-3 text-slate-600" />{LAYOUT_LABELS[item.id]}</button>)}
    </nav>
    {showHidden && <div className="flex flex-wrap gap-3 border-b border-slate-800 p-2 text-[10px] text-slate-400">{layout.map((item) => <label key={item.id} className="flex items-center gap-1"><input type="checkbox" checked={item.visible} disabled={visible.length === 1 && item.visible} onChange={() => toggle(item.id)} />{LAYOUT_LABELS[item.id]}</label>)}</div>}
    <div role="tabpanel" id={`${tabPrefix}-panel-${current}`} aria-labelledby={`${tabPrefix}-tab-${current}`} tabIndex={0}>
      {current === 'environment' ? <EnvironmentPanel /> : current === 'ticker' ? <TickerPanel linkedTicker={issuer.ticker} /> : <ResearchSplit label="主体与披露" left={<IssuerPanel cik={issuer.cik} onIssuer={setIssuer} />} right={current === 'facts' ? <FactsPanel cik={issuer.cik} /> : current === 'filing' ? <FilingPanel cik={issuer.cik} /> : <div>
        <table className="w-full text-left text-[11px]"><tbody><tr className="border-b border-slate-800"><th className="p-3 text-slate-500">发行主体</th><td className="p-3 text-cyan-200">{issuer.name || '从左侧选择 SEC 主体'}</td></tr><tr className="border-b border-slate-800"><th className="p-3 text-slate-500">代码 / CIK</th><td className="p-3 font-mono text-slate-300">{issuer.ticker || '—'} / {issuer.cik || '—'}</td></tr><tr className="border-b border-slate-800"><th className="p-3 text-slate-500">来源与职责</th><td className="p-3 text-slate-400">SEC 主体目录 / 证券与披露关联</td></tr></tbody></table>
        <div className="flex flex-wrap gap-2 p-3">{(['ticker', 'facts', 'filing'] as const).map((id) => <button type="button" key={id} disabled={!issuer.cik} onClick={() => activate(id)} className={buttonClass}>联动{LAYOUT_LABELS[id]}</button>)}</div>
      </div>} />}
    </div>
    <footer role="status" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 px-2 py-1.5 text-[9px] text-slate-500">
      <span>{saveLayout.isError ? `布局保存失败：${saveLayout.error.message}` : isDirty ? '布局尚未保存' : saveLayout.isSuccess || layoutQuery.data?.layout ? '账户布局已读取 / 保存' : '默认布局'}</span>
      {layoutQuery.isError && <span className="text-amber-300">账户布局读取失败，当前操作保留</span>}
      <span>方向键切页 · Alt+方向键调整顺序 · 拖动分隔线改变宽度</span>
    </footer>
  </section>;
}






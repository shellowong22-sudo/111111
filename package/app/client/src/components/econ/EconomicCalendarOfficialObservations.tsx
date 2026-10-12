import { CalendarClock, CircleGauge, Database, RefreshCw, ShieldCheck, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';

type AnalysisView = 'coverage' | 'ledger' | 'lineage';
type LensId = 'activity' | 'labour' | 'prices' | 'policy' | 'other';
type OfficialObservation = {
  id: string;
  region: string;
  label: string;
  unit: string;
  status: 'available' | 'unavailable';
  observationDate: string | null;
  value: number | null;
  previousValue: number | null;
  institution: string;
  cadence: string;
  note: string | null;
  boundary: string;
  retrievedAt: string;
};

const LENSES: Array<{ id: LensId; label: string; description: string; matches: (id: string) => boolean }> = [
  { id: 'activity', label: '产出与需求', description: '产出、零售、贸易与企业景气的已发布观察。', matches: (id) => /GDP|INDPRO|RETAIL|EXPORTS|IMPORTS|TANKAN/.test(id) },
  { id: 'labour', label: '劳动力', description: '就业、失业、职位空缺与薪酬的已发布观察。', matches: (id) => /LNS|CES|JTS|EMPLOYMENT|UNEMPLOYMENT|AWE/.test(id) },
  { id: 'prices', label: '价格', description: 'CPI、HICP 与核心价格观察，不混同不同统计口径。', matches: (id) => /CUUR|HICP|CPI/.test(id) },
  { id: 'policy', label: '政策与流动性', description: '政策利率与货币存量的官方观察。', matches: (id) => /CALL_RATE|M2|M3/.test(id) },
  { id: 'other', label: '其他官方观察', description: '未归入前述经济透镜的可读官方字段。', matches: () => false },
];

function lensOf(item: OfficialObservation): LensId {
  return LENSES.find((lens) => lens.id !== 'other' && lens.matches(item.id))?.id ?? 'other';
}

function formatValue(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}${unit ? ` ${unit}` : ''}`;
}

function formatDelta(value: number | null, previousValue: number | null) {
  if (value === null || previousValue === null || !Number.isFinite(value) || !Number.isFinite(previousValue)) return '—';
  const delta = value - previousValue;
  return `${delta > 0 ? '+' : ''}${delta.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function latestDate(items: OfficialObservation[]) {
  return items.map((item) => item.observationDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? null;
}

function earliestDate(items: OfficialObservation[]) {
  return items.map((item) => item.observationDate).filter((date): date is string => Boolean(date)).sort().at(0) ?? null;
}

export default function EconomicCalendarOfficialObservations() {
  const observations = trpc.legacyMarketData.getEconomicCalendarOfficialObservations.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const [view, setView] = useState<AnalysisView>('coverage');
  const [lensFilter, setLensFilter] = useState<LensId | 'all'>('all');
  const items = (observations.data?.observations ?? []) as OfficialObservation[];
  const available = useMemo(() => items.filter((item) => item.status === 'available'), [items]);
  const regions = useMemo(() => Array.from(new Set(items.map((item) => item.region))).sort(), [items]);
  const sources = useMemo(() => Array.from(new Set(items.filter((item) => item.status === 'available').map((item) => item.institution))).length, [items]);
  const activeItems = useMemo(() => items.filter((item) => lensFilter === 'all' || lensOf(item) === lensFilter).sort((left, right) => (right.observationDate ?? '').localeCompare(left.observationDate ?? '') || left.label.localeCompare(right.label)), [items, lensFilter]);
  const retrievedAt = observations.data?.asOf ?? items.map((item) => item.retrievedAt).filter(Boolean).sort().at(-1) ?? null;
  const refresh = () => observations.refetch();

  return <section className="mt-4 rounded-xl border border-cyan-900/70 bg-slate-950 p-4 shadow-[0_0_26px_rgba(8,145,178,0.08)]" data-economic-calendar-analysis="true">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
      <div>
        <p className="font-mono text-[10px] text-cyan-300">ECONOMIC OBSERVATION ANALYTICS</p>
        <h2 className="mt-1 text-sm font-semibold text-slate-100">宏观观测版图与发布结构</h2>
        <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-400">此处只替换原“官方原始读数”的重复卡片区域。它把同一批已读取的官方观察转换为<strong className="font-medium text-slate-300">观测覆盖版图、同字段变化账本和来源谱系</strong>三种互不重叠的终端内研究视图；不改写上方 ZIP 原经济日历，也不生成预期、预测或交易结论。</p>
      </div>
      <button type="button" onClick={refresh} disabled={observations.isFetching} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2.5 py-1.5 text-[10px] text-cyan-200 hover:bg-cyan-950/30 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${observations.isFetching ? 'animate-spin' : ''}`} />重新读取</button>
    </header>

    {observations.isLoading ? <div className="mt-3 rounded border border-cyan-900/60 bg-cyan-950/10 p-3 text-[10px] leading-4 text-slate-400" data-official-calendar-reading-state="true"><p className="font-mono text-cyan-200">OBSERVATION ANALYTICS READ IN PROGRESS</p><p className="mt-1">正在读取实际公开观察并构建覆盖版图、变化账本和来源谱系。读取结束前不绘制逐字段空卡片或微型趋势，也不使用历史样例补齐。</p></div> : observations.error || !observations.data ? <div className="mt-3 rounded border border-rose-900/60 bg-rose-950/20 p-3 text-xs text-rose-200">官方观察分析当前不可读取；系统不以原日历保留值、模拟记录或外部网页替代。</div> : <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-calendar-analysis-summary="true">
        <div className="rounded border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] text-cyan-300">READABLE OBSERVATIONS</p><p className="mt-1 font-mono text-xl text-slate-100">{available.length}<span className="ml-1 text-[9px] text-slate-500">字段</span></p><p className="mt-1 text-[9px] text-slate-500">不把不可读字段纳入统计。</p></div>
        <div className="rounded border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] text-cyan-300">SOURCE INSTITUTIONS</p><p className="mt-1 font-mono text-xl text-slate-100">{sources}<span className="ml-1 text-[9px] text-slate-500">机构</span></p><p className="mt-1 text-[9px] text-slate-500">按本次实际可读来源去重。</p></div>
        <div className="rounded border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] text-cyan-300">OBSERVATION WINDOW</p><p className="mt-1 font-mono text-[11px] text-slate-100">{earliestDate(available) ?? '—'} → {latestDate(available) ?? '—'}</p><p className="mt-1 text-[9px] text-slate-500">不同发布周期不表示同一时点。</p></div>
        <div className="rounded border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] text-cyan-300">LAST READ</p><p className="mt-1 font-mono text-[11px] text-slate-100">{retrievedAt ? new Date(retrievedAt).toLocaleString() : '—'}</p><p className="mt-1 text-[9px] text-slate-500">读取时间不等于发布或观察时间。</p></div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="截图区域宏观分析视图">
        {[{ id: 'coverage' as const, label: '观测版图', icon: CircleGauge, description: '地区 × 经济透镜的可读覆盖与最近观察日。' }, { id: 'ledger' as const, label: '变化账本', icon: Table2, description: '仅同字段当前值与前期值的可复算差。' }, { id: 'lineage' as const, label: '来源谱系', icon: Database, description: '字段定义、频率、单位、机构与状态。' }].map(({ id, label, icon: Icon, description }) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`inline-flex items-start gap-2 rounded border px-3 py-2 text-left ${view === id ? 'border-cyan-600 bg-cyan-950/40 text-cyan-100' : 'border-slate-700 text-slate-400 hover:border-cyan-800 hover:text-cyan-200'}`}><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><span className="block text-[10px] font-medium">{label}</span><span className="mt-0.5 block text-[8px] opacity-80">{description}</span></span></button>)}
      </div>

      {view === 'coverage' && <div className="mt-3" data-calendar-analysis-view="coverage-matrix"><div className="rounded border border-cyan-900/60 bg-cyan-950/10 p-2 text-[10px] leading-4 text-slate-400">观测版图仅记录每个地区在每类经济透镜下的<strong className="font-medium text-slate-300">可读字段数和最近观察日</strong>；它不把不同单位或不同国家的数值标准化、排名或合成为指数。</div><div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="w-full min-w-[860px] text-left text-[10px]"><thead className="border-b border-slate-800 bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2 font-medium">地区</th>{LENSES.map((lens) => <th key={lens.id} className="px-3 py-2 font-medium"><span className="text-slate-300">{lens.label}</span><span className="mt-0.5 block text-[8px] font-normal text-slate-600">{lens.description}</span></th>)}</tr></thead><tbody>{regions.map((region) => <tr key={region} className="border-b border-slate-800/70"><td className="px-3 py-3 font-medium text-slate-200">{region}</td>{LENSES.map((lens) => { const subset = items.filter((item) => item.region === region && lensOf(item) === lens.id && item.status === 'available'); const last = latestDate(subset); return <td key={lens.id} className="px-3 py-3"><span className={`font-mono ${subset.length ? 'text-cyan-100' : 'text-slate-600'}`}>{subset.length ? `${subset.length} 项` : '—'}</span><span className="mt-1 block font-mono text-[8px] text-slate-500">{last ?? '无可读观察'}</span></td>; })}</tr>)}</tbody></table></div></div>}

      {view === 'ledger' && <div className="mt-3" data-calendar-analysis-view="change-ledger"><div className="flex flex-wrap items-center gap-2 rounded border border-cyan-900/60 bg-cyan-950/10 p-2"><span className="text-[10px] text-slate-400">经济透镜</span><button type="button" onClick={() => setLensFilter('all')} className={`rounded border px-2 py-1 text-[9px] ${lensFilter === 'all' ? 'border-cyan-600 bg-cyan-950/50 text-cyan-100' : 'border-slate-700 text-slate-500'}`}>全部字段</button>{LENSES.map((lens) => <button type="button" key={lens.id} onClick={() => setLensFilter(lens.id)} className={`rounded border px-2 py-1 text-[9px] ${lensFilter === lens.id ? 'border-cyan-600 bg-cyan-950/50 text-cyan-100' : 'border-slate-700 text-slate-500'}`}>{lens.label}</button>)}<span className="ml-auto text-[9px] text-slate-500">变化仅在同一字段内计算，不跨口径比较。</span></div><div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="w-full min-w-[980px] text-left text-[10px]"><thead className="border-b border-slate-800 bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2 font-medium">字段 / 经济透镜</th><th className="px-3 py-2 font-medium">当前已读值</th><th className="px-3 py-2 font-medium">同字段前期</th><th className="px-3 py-2 font-medium">字段内变化</th><th className="px-3 py-2 font-medium">观察期</th><th className="px-3 py-2 font-medium">状态</th></tr></thead><tbody>{activeItems.map((item) => <tr key={item.id} className="border-b border-slate-800/70"><td className="px-3 py-2"><p className="text-slate-200">{item.label}</p><p className="mt-0.5 font-mono text-[8px] text-cyan-400">{item.id} · {LENSES.find((lens) => lens.id === lensOf(item))?.label}</p></td><td className="px-3 py-2 font-mono text-slate-100">{formatValue(item.value, item.unit)}</td><td className="px-3 py-2 font-mono text-slate-300">{formatValue(item.previousValue, item.unit)}</td><td className="px-3 py-2 font-mono text-cyan-100">{formatDelta(item.value, item.previousValue)}<span className="ml-1 text-[8px] text-slate-600">{item.unit}</span></td><td className="px-3 py-2 font-mono text-slate-300">{item.observationDate ?? '—'}</td><td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[8px] ${item.status === 'available' ? 'border-emerald-900 text-emerald-300' : 'border-amber-900 text-amber-300'}`}>{item.status === 'available' ? '可读观察' : '当前不可读'}</span></td></tr>)}</tbody></table></div></div>}

      {view === 'lineage' && <div className="mt-3" data-calendar-analysis-view="source-lineage"><div className="rounded border border-cyan-900/60 bg-cyan-950/10 p-2 text-[10px] leading-4 text-slate-400">来源谱系用于查看字段是由哪个机构、以何种频率和单位读取；它不将数据带离终端，也不以来源网页代替分析结果。</div><div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="w-full min-w-[980px] text-left text-[10px]"><thead className="border-b border-slate-800 bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2 font-medium">字段</th><th className="px-3 py-2 font-medium">机构</th><th className="px-3 py-2 font-medium">频率 / 单位</th><th className="px-3 py-2 font-medium">最近观察</th><th className="px-3 py-2 font-medium">读取时间</th><th className="px-3 py-2 font-medium">来源边界</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-slate-800/70"><td className="px-3 py-2"><p className="text-slate-200">{item.label}</p><p className="mt-0.5 font-mono text-[8px] text-cyan-400">{item.id} · {item.region}</p></td><td className="px-3 py-2 text-slate-300">{item.institution}</td><td className="px-3 py-2 text-slate-300">{item.cadence}<span className="mx-1 text-slate-600">/</span>{item.unit || '未声明'}</td><td className="px-3 py-2 font-mono text-slate-300">{item.observationDate ?? '—'}</td><td className="px-3 py-2 font-mono text-slate-500">{item.retrievedAt ? new Date(item.retrievedAt).toLocaleString() : '—'}</td><td className="px-3 py-2 text-[9px] leading-4 text-slate-500">{item.note || item.boundary}</td></tr>)}</tbody></table></div></div>}

      <footer className="mt-3 flex items-start gap-1.5 rounded border border-cyan-900/50 bg-cyan-950/10 p-2 text-[9px] leading-4 text-slate-400"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />{observations.data.sourceBoundary} 本次读取 {retrievedAt ? new Date(retrievedAt).toLocaleString() : '—'}。本区只显示终端内已读取的官方观察及可复算的同字段差值；没有可读输入时保持真实空状态。</footer>
    </>}
  </section>;
}

import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, RefreshCw, ShieldCheck } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '@/lib/trpc';

type Observation = {
  id: string;
  label: string;
  unit: string;
  region: string;
  status: 'available' | 'unavailable';
  value: number | null;
  previousValue: number | null;
  observationDate: string | null;
  retrievedAt: string;
  institution: string;
  cadence: string;
  history: Array<{ observationDate: string; value: number }>;
  boundary: string;
};

function number(value: number | null) {
  return value === null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function PublicMacroObservationDesk() {
  const official = trpc.legacyMarketData.getEconomicCalendarOfficialObservations.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 });
  const observations = (official.data?.observations ?? []) as Observation[];
  const readable = observations.filter((item) => item.status === 'available' && item.value !== null && item.observationDate);
  const [selectedId, setSelectedId] = useState('');
  const selected = readable.find((item) => item.id === selectedId) ?? readable[0] ?? null;
  const change = selected?.value !== null && selected?.value !== undefined && selected.previousValue !== null && selected.previousValue !== undefined ? selected.value - selected.previousValue : null;
  const regions = useMemo(() => [...new Set(readable.map((item) => item.region))], [readable]);

  return <section className="rounded-xl border border-sky-900/70 bg-slate-950 p-4 shadow-[0_0_26px_rgba(14,165,233,0.08)]" data-public-macro-observation-desk="true">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-sky-300" /><div><p className="font-mono text-[10px] text-sky-300">PUBLIC OFFICIAL MACRO OBSERVATIONS</p><h2 className="mt-1 text-sm font-semibold text-slate-100">官方宏观观察</h2><p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-400">仅读取公开官方字段；不加载账户预设、提醒、私有规则或示例数据。指标显示机构、频率、单位、观察日与同字段历史，不能用于推断交易结论。</p></div></div><button type="button" onClick={() => void official.refetch()} disabled={official.isFetching} className="inline-flex items-center gap-1 rounded border border-sky-800 px-2.5 py-1.5 text-[10px] text-sky-200 hover:bg-sky-950/30 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${official.isFetching ? 'animate-spin' : ''}`} />读取官方观察</button></header>
    {official.isLoading ? <div className="mt-3 grid gap-2 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded border border-slate-800 bg-slate-900/50" />)}</div> : official.error ? <div className="mt-3 rounded border border-rose-900/60 bg-rose-950/20 p-3 text-xs text-rose-200">官方宏观观察当前不可读取；系统不以 BECO 固定指标、其他国家字段或相邻期数据替代。</div> : !readable.length ? <div className="mt-3 rounded border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-100">本次公开读取没有可显示的官方观察；系统不生成 GDP、CPI、利率、收益率或宏观比较数值。</div> : <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="overflow-x-auto rounded border border-slate-800 bg-slate-900/35 p-3"><div className="mb-2 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-sky-300" /><p className="text-[10px] text-sky-200">本次实际读取字段：{readable.length} 项 · 覆盖 {regions.join('、')}</p></div><table className="w-full min-w-[720px] text-left text-[10px]"><thead className="border-y border-slate-800 text-slate-500"><tr><th className="py-2 font-medium">字段</th><th className="py-2 font-medium">实际观察</th><th className="py-2 font-medium">前次同字段</th><th className="py-2 font-medium">观察日</th><th className="py-2 font-medium">机构 / 频率</th></tr></thead><tbody>{readable.map((item) => { const delta = item.previousValue === null ? null : item.value! - item.previousValue; const isSelected = selected?.id === item.id; return <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer border-b border-slate-800/70 ${isSelected ? 'bg-sky-950/30' : 'hover:bg-slate-900/70'}`}><td className="py-2 pr-3 text-slate-200">{item.label}<p className="mt-0.5 font-mono text-[8px] text-slate-600">{item.id} · {item.region}</p></td><td className="py-2 pr-3 font-mono text-sky-100">{number(item.value)} <span className="text-slate-500">{item.unit}</span></td><td className="py-2 pr-3 font-mono text-slate-300">{number(item.previousValue)}{delta === null ? null : <p className={`mt-0.5 text-[8px] ${delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-slate-500'}`}>同字段变化 {delta > 0 ? '+' : ''}{number(delta)}</p>}</td><td className="py-2 pr-3 font-mono text-slate-300">{item.observationDate}</td><td className="py-2 text-slate-500">{item.institution}<p className="mt-0.5">{item.cadence}</p></td></tr>; })}</tbody></table></section>
      <aside className="rounded border border-slate-800 bg-slate-900/35 p-3">{selected ? <><div className="flex items-start gap-2"><BarChart3 className="mt-0.5 h-4 w-4 text-cyan-300" /><div><p className="font-mono text-[10px] text-cyan-200">SAME-FIELD ACTUAL HISTORY</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{selected.label} · {selected.institution} · {selected.cadence}</p></div></div><div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded border border-slate-800 bg-slate-950/45 p-2"><p className="text-[8px] text-slate-500">当前实际观察</p><p className="mt-1 font-mono text-sm text-cyan-100">{number(selected.value)}</p><p className="text-[8px] text-slate-500">{selected.unit}</p></div><div className="rounded border border-slate-800 bg-slate-950/45 p-2"><p className="text-[8px] text-slate-500">观察日</p><p className="mt-1 font-mono text-[10px] text-slate-200">{selected.observationDate}</p></div><div className="rounded border border-slate-800 bg-slate-950/45 p-2"><p className="text-[8px] text-slate-500">相邻变化</p><p className="mt-1 font-mono text-sm text-slate-200">{change === null ? '—' : `${change > 0 ? '+' : ''}${number(change)}`}</p></div></div><div className="mt-3 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={selected.history}><XAxis dataKey="observationDate" tick={{ fill: '#64748b', fontSize: 8 }} minTickGap={22} /><YAxis width={56} tick={{ fill: '#94a3b8', fontSize: 8 }} tickFormatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #155e75', fontSize: 10 }} formatter={(value) => [number(Number(value)), selected.unit]} /><Line type="linear" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2, fill: '#a5f3fc', strokeWidth: 0 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div><p className="mt-2 text-[9px] leading-4 text-slate-500">{selected.boundary}</p></> : null}</aside>
    </div>}
  </section>;
}

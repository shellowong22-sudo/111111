import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Badge, Card, LoadingState, Metric } from '@/components/sovereign/PanelKit';

type Range = '1y' | '3y' | '5y' | 'max';
const colors = ['#38bdf8', '#f59e0b', '#a78bfa', '#22c55e', '#fb7185', '#2dd4bf', '#eab308', '#f97316'];
const chartTooltip = { contentStyle: { background: '#020617', border: '1px solid #854d0e', color: '#f8fafc', fontSize: 11 } };
const value = (input: number | null | undefined, digits = 4) => input == null ? '—' : Number(input).toLocaleString(undefined, { maximumFractionDigits: digits });
const pct = (input: number | null | undefined) => input == null ? '—' : `${input >= 0 ? '+' : ''}${Number(input).toFixed(3)}%`;

function Coverage({ data }: { data: any }) {
  return <div className="mt-3 overflow-x-auto"><table className="min-w-[780px] w-full text-left text-xs"><thead className="text-slate-500"><tr><th>公开资料</th><th>单位</th><th>最近实际观察</th><th>区间起点</th><th>历史点数</th><th>状态</th></tr></thead><tbody>{data.readings.map((row: any) => <tr key={row.id} className="border-t border-slate-800"><td className="py-2 text-amber-200">{row.label}</td><td className="text-slate-400">{row.unit}</td><td>{row.observationDate ?? '—'} · {value(row.value)}</td><td>{row.historyStart ?? '—'}</td><td>{row.historyPoints}</td><td><Badge tone={row.status === 'available' ? 'pos' : 'warn'}>{row.status === 'available' ? '实际可读' : '暂不可读'}</Badge></td></tr>)}</tbody></table></div>;
}

function History({ data }: { data: any }) {
  const available = data.readings.filter((row: any) => row.status === 'available' && row.historyPoints > 1).slice(0, 6);
  if (!available.length) return null;
  return <div className="mt-3 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.timeline}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={28} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} /><Tooltip {...chartTooltip} />{available.map((row: any, index: number) => <Line key={row.id} isAnimationActive={false} type="monotone" dataKey={`base100_${row.id}`} name={`${row.label}（窗口起点=100）`} stroke={colors[index]} strokeWidth={1.7} dot={false} connectNulls={false} />)}</LineChart></ResponsiveContainer></div>;
}

function Crosses({ data }: { data: any }) {
  return <div className="mt-3 overflow-x-auto"><table className="min-w-[620px] w-full text-left text-xs"><thead className="text-slate-500"><tr><th>推导交叉</th><th>共同观察日</th><th>同日数值</th><th>口径</th><th>状态</th></tr></thead><tbody>{data.crosses.map((row: any) => <tr key={row.pair} className="border-t border-slate-800"><td className="py-2 font-mono text-amber-200">{row.pair}</td><td className="font-mono text-slate-300">{row.observationDate}</td><td className="font-mono">{value(row.value, 6)}</td><td className="text-slate-400">以美元基准同日 H.10 观察推导</td><td><Badge tone="info">实际推导</Badge></td></tr>)}{!data.crosses.length && <tr><td colSpan={5} className="py-3 text-amber-200">所选窗口没有足以同日配对的公开观察；终端不插补交叉汇率。</td></tr>}</tbody></table></div>;
}

function Summary({ data }: { data: any }) {
  return <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{data.readings.map((row: any) => <div key={row.id} className="rounded border border-slate-800 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-200">{row.label}</p><Badge tone={row.status === 'available' ? 'info' : 'warn'}>{row.currency}</Badge></div><p className="mt-2 text-lg font-semibold text-slate-100">{value(row.value)}</p><p className="mt-1 text-[10px] text-slate-500">{row.observationDate ?? '无实际观察'} · {row.unit}</p><p className={`mt-1 text-xs ${row.windowChangePct == null ? 'text-slate-500' : row.windowChangePct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>所选窗口变化 {pct(row.windowChangePct)}</p></div>)}</div>;
}

export default function ForexResearchLayer({ moduleId }: { moduleId: string }) {
  const [range, setRange] = useState<Range>('3y');
  const input = useMemo(() => ({ moduleId: moduleId as any, range }), [moduleId, range]);
  const query = trpc.forexResearch.getModuleStudy.useQuery(input, { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 });
  const data = query.data;
  return <section className="mx-4 mt-4 pb-6"><Card title={data ? `FX RESEARCH · ${data.title}` : 'FX RESEARCH · 终端内公开资料'}><div className="flex flex-wrap items-end gap-2"><label className="text-[10px] text-slate-500">窗口<select value={range} onChange={(event) => setRange(event.target.value as Range)} className="input-terminal mt-1 text-xs"><option value="1y">1 年</option><option value="3y">3 年</option><option value="5y">5 年</option><option value="max">全部可读历史</option></select></label><Metric label="实际可读序列" value={data ? `${data.readings.filter((row: any) => row.status === 'available').length}/${data.readings.length}` : '—'} sub={data?.asOf ?? '读取中'} tone={data?.readings.some((row: any) => row.status === 'available') ? 'info' : 'warn'} /><Metric label="研究焦点" value={data?.mode === 'cross' ? '同日交叉' : data?.mode === 'coverage' ? '资料覆盖' : data?.mode === 'basis' ? '资料边界' : data?.mode === 'range' ? '已实现范围' : data?.mode === 'macro' ? '宏观环境' : '公开观察'} sub="仅追加于原工作区之后" tone="info" /></div>{query.isLoading ? <LoadingState text="正在读取终端内公开外汇参考资料…" /> : query.error || !data ? <p className="mt-3 rounded border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">当前无法读取所选公开外汇参考资料。终端不以静态样例、随机值或外部页面替代。</p> : !data.readings.length ? <p className="mt-3 rounded border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">{data.focus}</p> : !data.readings.some((row: any) => row.status === 'available') ? <p className="mt-3 rounded border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">所选窗口没有可读的公开观察。终端保留真实空状态，不补造报价、fixing、期权波动率、基点差、订单簿或预测。</p> : <><div className="mt-3 rounded border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs text-slate-200">{data.focus}</p><p className="mt-1 text-[10px] text-slate-500">公开资料 · {data.range} 窗口 · 各序列按自身实际发布日期保留。</p></div>{data.mode === 'coverage' || data.mode === 'orientation' || data.mode === 'catalog' || data.mode === 'source' ? <Coverage data={data} /> : <>{data.mode === 'cross' ? <Crosses data={data} /> : <History data={data} />}<Summary data={data} /></>}<p className="mt-3 text-[10px] text-slate-500">{data.sourceBoundary}</p></>}</Card></section>;
}

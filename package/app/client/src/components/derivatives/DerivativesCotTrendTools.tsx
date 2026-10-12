import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LoadingState } from '@/components/sovereign/PanelKit';

const CATEGORY_OPTIONS = {
  financial: ['资产管理人', '杠杆基金'],
  energy: ['管理资金', '掉期交易商'],
} as const;
const colors = ['#f59e0b', '#38bdf8'];
const tooltipStyle = { background: '#020617', border: '1px solid #854d0e', color: '#f8fafc', fontSize: 11 };

export function DerivativesCotTrendTools({ kind, rows, isLoading, weeks, setWeeks, categories, setCategories }: { kind: 'financial' | 'energy'; rows: any[]; isLoading: boolean; weeks: 4 | 12 | 26 | 52 | 104; setWeeks: (value: 4 | 12 | 26 | 52 | 104) => void; categories: string[]; setCategories: (value: string[]) => void }) {
  const options = CATEGORY_OPTIONS[kind];
  const selected = categories.filter((category) => options.includes(category as never));
  const shown = selected.length ? selected : [...options];
  const chart = rows.slice().reverse().map((snapshot) => ({ date: snapshot.reportDate, ...Object.fromEntries(snapshot.rows.map((row: any) => [row.category, row.net])) }));
  const toggle = (category: string) => setCategories(selected.includes(category) ? selected.filter((item) => item !== category) : [...selected, category]);
  return <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-3"><div className="flex flex-wrap items-end gap-3"><label className="text-[10px] text-slate-500">报告窗口<select value={weeks} onChange={(event) => setWeeks(Number(event.target.value) as 4 | 12 | 26 | 52 | 104)} className="input-terminal mt-1 text-xs"><option value={4}>近 4 周</option><option value={12}>近 12 周</option><option value={26}>近 26 周</option><option value={52}>近 52 周</option><option value={104}>近 104 周</option></select></label><div className="text-[10px] text-slate-500"><p>报告类别</p><div className="mt-1 flex flex-wrap gap-2">{options.map((category) => <label key={category} className="flex items-center gap-1 text-xs text-slate-300"><input type="checkbox" checked={!selected.length || selected.includes(category)} onChange={() => toggle(category)} />{category}</label>)}</div></div></div><p className="mt-3 text-xs font-medium text-amber-200">CFTC 周度净仓变化</p><p className="mt-1 text-[10px] text-slate-500">指定单一官方合约的报告类别多头减空头；不等同于实时资金流、期权成交或市场情绪结论。</p>{isLoading ? <LoadingState text="正在读取 CFTC 周度历史报告…" /> : !chart.length ? <p className="mt-3 rounded border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">所选类别或窗口没有可读取的实际报告；终端不补造持仓轨迹。</p> : <div className="mt-2 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={24} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} /><Tooltip contentStyle={tooltipStyle} />{shown.map((category, index) => <Line key={category} isAnimationActive={false} type="monotone" dataKey={category} name={`${category}净仓`} stroke={colors[index]} strokeWidth={1.8} dot={false} connectNulls={false} />)}</LineChart></ResponsiveContainer></div>}</div>;
}

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, CircleHelp, Clock3, Database, Focus, MousePointer2 } from 'lucide-react';
import { Card, Metric } from '@/components/sovereign/PanelKit';
import { trpc } from '@/lib/trpc';

type LocalRow = Record<string, string> & { id?: string };
type FocusPoint = { label: string; value: number; detail: string };

const LOCAL_CONFIG: Record<string, { key: string; title: string; metric: string; group: (rows: LocalRow[]) => FocusPoint[]; freshness?: (rows: LocalRow[]) => string }> = {
  '1': { key: 'mbs-dictionary-v1', title: '字段血缘覆盖', metric: '已定义字段', group: (rows) => countBy(rows, 'frequency', '频率') },
  '3': { key: 'mbs-pool-screen-v1', title: '贷款池特征完整度', metric: '登记池', group: (rows) => [
    { label: '含 FICO', value: rows.filter((row) => row.fico).length, detail: '具有用户核验 FICO 字段的池数' },
    { label: '含 LTV', value: rows.filter((row) => row.ltv).length, detail: '具有用户核验 LTV 字段的池数' },
    { label: '含 CPR', value: rows.filter((row) => row.cpr).length, detail: '具有已观察 CPR 字段的池数，不是预测 CPR' },
  ] },
  '5': { key: 'mbs-new-issues-v1', title: '发行阶段覆盖', metric: '已登记发行', group: (rows) => countBy(rows, 'stage', '发行阶段'), freshness: (rows) => newestDate(rows, 'announcedAt') },
  '7': { key: 'mbs-availability-v1', title: '数据授权状态', metric: '授权登记', group: (rows) => countBy(rows, 'access', '可得性'), freshness: (rows) => newestDate(rows, 'checkedAt') },
  '11': { key: 'mbs-hpi-observations-v1', title: '地域担保品观察', metric: 'HPI 观察', group: (rows) => rows.filter((row) => numeric(row.hpi) !== null).sort((a, b) => String(a.observationDate).localeCompare(String(b.observationDate))).map((row) => ({ label: row.observationDate, value: numeric(row.hpi) ?? 0, detail: `${row.region} · 用户绑定原始来源的 HPI/指标水平` })), freshness: (rows) => newestDate(rows, 'observationDate') },
  '13': { key: 'mbs-research-evidence-v1', title: '研究证据审阅状态', metric: '证据记录', group: (rows) => countBy(rows, 'status', '审阅状态'), freshness: (rows) => newestDate(rows, 'observedAt') },
  '15': { key: 'mbs-pipeline-v1', title: '结构融资管道阶段', metric: '管道项目', group: (rows) => countBy(rows, 'stage', '项目阶段'), freshness: (rows) => newestDate(rows, 'targetDate') },
  '20': { key: 'mbs-quote-governance-v1', title: '报价授权核验时效', metric: '报价来源', group: (rows) => countBy(rows, 'delay', '延迟/频率'), freshness: (rows) => newestDate(rows, 'checked') },
  '21': { key: 'mbs-cmbs-geo-v1', title: '地域暴露与 HPI 变化', metric: '地域记录', group: (rows) => rows.filter((row) => numeric(row.weight) !== null).map((row) => ({ label: row.region, value: numeric(row.weight) ?? 0, detail: `暴露 ${row.weight}% · HPI 变化 ${row.hpiChange || '未登记'}%` })) },
  '22': { key: 'mbs-index-governance-v1', title: '指数许可治理', metric: '指数登记', group: (rows) => countBy(rows, 'license', '许可状态') },
  '23': { key: 'mbs-tba-monitor-v1', title: 'TBA 用户核验观察', metric: '含价格记录', group: (rows) => rows.filter((row) => numeric(row.price) !== null).sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt))).map((row) => ({ label: row.observedAt, value: numeric(row.price) ?? 0, detail: `票息 ${row.coupon} · 成交量 ${row.volume || '未登记'} · 仅用户已授权/核验记录` })), freshness: (rows) => newestDate(rows, 'observedAt') },
  '26': { key: 'mbs-volume-performance-v1', title: '交易后成交量记录', metric: '含成交量记录', group: (rows) => rows.filter((row) => numeric(row.volume) !== null).sort((a, b) => String(a.date).localeCompare(String(b.date))).map((row) => ({ label: row.date, value: numeric(row.volume) ?? 0, detail: `${row.security} · 价格 ${row.price || '未登记'} · 用户核验交易后记录` })), freshness: (rows) => newestDate(rows, 'date') },
};

function numeric(value: string | undefined) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function countBy(rows: LocalRow[], field: string, descriptor: string): FocusPoint[] { const counters = new Map<string, number>(); rows.forEach((row) => { const key = row[field] || '未登记'; counters.set(key, (counters.get(key) || 0) + 1); }); return [...counters.entries()].map(([label, value]) => ({ label, value, detail: `${descriptor}：${label}，由已登记记录汇总` })); }
function newestDate(rows: LocalRow[], field: string) { const dates = rows.map((row) => row[field]).filter(Boolean).sort(); return dates.at(-1) || '无日期记录'; }
function useLocalLedger(key: string) { const [rows, setRows] = useState<LocalRow[]>([]); useEffect(() => { const read = () => { try { setRows(JSON.parse(localStorage.getItem(key) || '[]') as LocalRow[]); } catch { setRows([]); } }; read(); const id = window.setInterval(read, 1200); return () => window.clearInterval(id); }, [key]); return rows; }
function Help({ label, children }: { label: string; children: string }) { return <span title={children} className="inline-flex cursor-help items-center gap-1 text-[10px] text-slate-500 underline decoration-dotted underline-offset-2"><CircleHelp className="h-3 w-3" />{label}</span>; }
function EmptyInteractive({ label }: { label: string }) { return <div className="rounded border border-dashed border-slate-700 bg-slate-950/30 p-4 text-center text-xs text-slate-500"><MousePointer2 className="mx-auto mb-2 h-4 w-4 text-slate-600" />{label}</div>; }

function LocalLedgerChart({ moduleId, config }: { moduleId: string; config: (typeof LOCAL_CONFIG)[string] }) {
  const rows = useLocalLedger(config.key); const points = useMemo(() => config.group(rows), [config, rows]); const [focus, setFocus] = useState<string | null>(null); const selected = points.find((point) => point.label === focus) ?? points[0]; const isPath = ['11', '23', '26'].includes(moduleId);
  return <section className="mt-3"><Card title={`互动指标层 · ${config.title}`} action={<Help label="悬停说明">悬停图形查看指标定义；点击柱状或数据点可锁定焦点。该层只汇总已登记的用户记录，不生成缺失行情。</Help>}><div className="grid grid-cols-3 gap-2"><Metric label={config.metric} value={String(rows.length)} unit="项" /><Metric label="可视化点" value={String(points.length)} unit="个" tone="info" /><Metric label="最近记录" value={config.freshness?.(rows) || '依登记更新'} tone={rows.length ? 'pos' : 'neutral'} /></div>{points.length ? <><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%">{isPath ? <LineChart data={points} onClick={(state) => { const label = state?.activeLabel; if (label !== undefined) setFocus(String(label)); }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="label" minTickGap={28} tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} formatter={(value: number) => value.toLocaleString()} labelFormatter={(label) => `观察：${label}`} /><Line type="monotone" dataKey="value" name="已核验指标" stroke="#22d3ee" strokeWidth={2} activeDot={{ r: 6 }} /><Brush dataKey="label" height={20} stroke="#22d3ee" /></LineChart> : <BarChart data={points} onClick={(state) => { const label = state?.activeLabel; if (label !== undefined) setFocus(String(label)); }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} formatter={(value: number) => `${value} 项`} /><Bar dataKey="value" name="记录数" fill="#22d3ee" radius={[3, 3, 0, 0]} /></BarChart>}</ResponsiveContainer></div><div className="mt-2 rounded border border-cyan-900/60 bg-cyan-950/20 p-2 text-xs text-slate-300"><span className="font-mono text-cyan-200">焦点 · {selected?.label}</span><span className="ml-2">{selected?.detail}</span></div></> : <EmptyInteractive label="在本模块登记带有来源的记录后，互动指标层会自动汇总；当前不会以模拟数据填充图形。" />}</Card></section>;
}

function RateChart({ moduleId }: { moduleId: string }) {
  const snapshot = trpc.mortgageResearch.getRateSnapshot.useQuery(undefined, { refetchInterval: 60_000 }); const [term, setTerm] = useState('MORTGAGE30US'); const [range, setRange] = useState(90); const [focusDate, setFocusDate] = useState<string | null>(null); const series = snapshot.data?.series.find((item) => item.id === term) ?? snapshot.data?.series[0]; const history = (series?.history ?? []).slice(-range); const values = history.map((item) => item.valuePct).filter((value): value is number => typeof value === 'number'); const focus = history.find((item) => item.date === focusDate) ?? history.at(-1); const stats = values.length ? { min: Math.min(...values), max: Math.max(...values), avg: values.reduce((sum, value) => sum + value, 0) / values.length } : null;
  return <section className="mt-3"><Card title={moduleId === '9' ? '互动指标层 · 公开抵押利率窗口' : '互动指标层 · 宏观抵押利率时效'} action={<Help label="数据时效">每 60 秒重新查询公开 FRED / Freddie Mac 序列。观察日由原始序列返回，不等同 MBS 或 TBA 交易时间。</Help>}><div className="flex flex-wrap items-center gap-2"><select value={term} onChange={(event) => setTerm(event.target.value)} className="input-terminal text-xs">{snapshot.data?.series.map((item) => <option value={item.id} key={item.id}>{item.term}</option>)}</select>{[30, 90, 180].map((days) => <button type="button" onClick={() => setRange(days)} key={days} className={`rounded border px-2 py-1 text-xs ${range === days ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{days} 点窗口</button>)}<span className="ml-auto text-[10px] text-slate-500">{series?.observationDate ? `最新观察：${series.observationDate}` : '等待公开序列'}</span></div>{history.length && stats ? <><div className="mt-3 grid grid-cols-3 gap-2"><Metric label="窗口最低" value={`${stats.min.toFixed(3)}%`} /><Metric label="窗口平均" value={`${stats.avg.toFixed(3)}%`} tone="info" /><Metric label="窗口最高" value={`${stats.max.toFixed(3)}%`} tone="warn" /></div><div className="mt-3 h-52"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history} onClick={(state) => { const label = state?.activeLabel; if (label !== undefined) setFocusDate(String(label)); }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="date" minTickGap={36} tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} formatter={(value: number) => `${value.toFixed(3)}%`} labelFormatter={(label) => `观察日：${label}`} /><Area type="monotone" dataKey="valuePct" name={series?.label || '公开抵押利率'} stroke="#22d3ee" fill="#22d3ee22" activeDot={{ r: 6 }} /><Brush dataKey="date" height={20} stroke="#22d3ee" /></AreaChart></ResponsiveContainer></div><div className="mt-2 rounded border border-cyan-900/60 bg-cyan-950/20 p-2 text-xs text-slate-300"><Focus className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />焦点观察：<span className="font-mono text-cyan-200">{focus?.date || '—'} · {focus?.valuePct?.toFixed(3) || '—'}%</span><span className="ml-2 text-slate-500">点击数据点锁定；拖动底部窗口缩放。</span></div></> : <EmptyInteractive label="公开利率序列暂不可读取；不会用历史样例或模拟利率替代。" />}</Card></section>;
}

function ScenarioGuide({ moduleId }: { moduleId: string }) {
  const copy: Record<string, { title: string; text: string }> = {
    '4': { title: '现金流图形交互说明', text: 'PSA、余额、票息、期限和服务费输入会即时重算本金、提前还款与余额路径。悬停图形可查看月度拆分；导出 CSV 保留同一情景。' },
    '8': { title: '结构瀑布交互说明', text: '档级占比和情景损失输入会即时重算各档初始额、已分配损失和剩余额。悬停柱状图查看档级分解。' },
    '10': { title: 'Dollar-roll 交互说明', text: '当前月、下月、间隔天数和票息输入会即时更新月差和年化月差。所有数值来自用户输入，不连接实时 TBA 价格。' },
    '18': { title: '收益率现金流交互说明', text: '价格、票息、面值、期限和支付频率驱动二分法 YTM 与逐期现金流。悬停柱状图可查看利息与本金。' },
    '19': { title: '定价敏感性图交互说明', text: '票息、收益率、期限与频率输入会即时重算理论价格、久期、DV01 和 ±100bp 价格路径。悬停折线查看单点价格。' },
    '25': { title: '结构比较图交互说明', text: '四项研究者自定义维度即时更新 RMBS/CMBS 雷达图；悬停显示每一维度值。数值不是市场评分或评级。' },
  };
  const item = copy[moduleId]; if (!item) return null;
  return <section className="mt-3"><Card title={`互动指标层 · ${item.title}`} action={<Help label="悬停说明">所有主图均支持悬停读取具体数值；参数变化后即时更新，且未使用任何模拟市场数据。</Help>}><div className="flex items-start gap-3 rounded border border-cyan-900/60 bg-cyan-950/20 p-3 text-xs text-slate-300"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><p>{item.text}</p></div></Card></section>;
}

function StaticGuide({ moduleId }: { moduleId: string }) {
  const descriptions: Record<string, string> = {
    '2': '证券主数据卡随字段输入即时更新完整度与来源绑定状态；字段缺失不会被推断或由系统补全。',
    '6': '官方来源索引以原始机构页面为准；悬停来源限制说明可了解频率、可用性与非报价边界。',
    '14': 'EDGAR 查询仅在录入发行人代码后请求 SEC 原件；文件列表、数量与状态随真实响应动态变化。',
    '16': '命名证券卡在原始文件 URL 和观察日齐备后更新绑定状态；缺少证据时保持研究缺口提示。',
    '17': '条款事实卡随证券标识、票息、到期、担保、结构与来源输入更新；完整度不等同市场可交易性。',
    '24': '分类树用于研究导航。将鼠标停留在分类卡上可查看担保品、结构和核验文件类型，不生成风险排名。',
  };
  const text = descriptions[moduleId]; if (!text) return null;
  return <section className="mt-3"><Card title="互动指标层 · 核验状态说明"><div className="flex items-start gap-3 rounded border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300"><Database className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><p>{text}</p></div></Card></section>;
}

export default function MortgageVisualizationEnhancer({ moduleId }: { moduleId: string }) {
  if (moduleId === '9' || moduleId === '12') return <RateChart moduleId={moduleId} />;
  if (LOCAL_CONFIG[moduleId]) return <LocalLedgerChart moduleId={moduleId} config={LOCAL_CONFIG[moduleId]} />;
  if (['4', '8', '10', '18', '19', '25'].includes(moduleId)) return <ScenarioGuide moduleId={moduleId} />;
  return <StaticGuide moduleId={moduleId} />;
}

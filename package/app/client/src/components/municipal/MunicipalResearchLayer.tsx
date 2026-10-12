import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileSearch, Layers3, RefreshCw, ShieldAlert } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Badge, Card, LoadingState, Metric } from '@/components/sovereign/PanelKit';
import MunicipalRestrictedTools from './MunicipalRestrictedTools';
import MunicipalIssuerEvidenceWorkspace from './MunicipalIssuerEvidenceWorkspace';
import MunicipalIssuerEvidenceBatchUploader from './MunicipalIssuerEvidenceBatchUploader';
import MunicipalIssuerEvidenceSearchPanel from './MunicipalIssuerEvidenceSearchPanel';
import MunicipalDepthWorkbench from './MunicipalDepthWorkbench';

type Activity = { recordDate: string; newSubscriptionsAmount: number | null; newSubscriptionsCount: number | null; cancelledSubscriptionsAmount: number | null; cancelledSubscriptionsCount: number | null; demandDepositRedemptionsAmount: number | null; timeDepositRedemptionsAmount: number | null; buckets: Array<{ id: string; label: string; issuedAmount: number | null; issuedCount: number | null; outstandingAmount: number | null; outstandingCount: number | null }> };
type ModuleId = '1' | 'MSRC' | 'SMUN' | 'AAA' | 'BTMM' | 'PICK' | 'MBWD' | 'CDRN' | 'CDRC' | 'CDRA' | 'CNDS' | 'CDRV' | 'DEAL' | 'CACT' | 'MCAL' | 'MBIX' | 'VRDN' | 'BMA' | 'BOOM' | 'MSRB' | 'SLGS';

export const MUNICIPAL_MODULE_META: Record<ModuleId, { code: string; title: string; focus: string; kind: 'catalog' | 'curve' | 'flow' | 'structure' | 'restricted' | 'event' }> = {
  '1': { code: '1', title: '字段与资料口径', focus: '把可读范围、数据时点和不可读字段直接放在终端内。', kind: 'catalog' },
  MSRC: { code: 'MSRC', title: '检索证据范围', focus: '将检索条件与当前可验证资料覆盖分开呈现，避免将历史展示误作现时数据。', kind: 'catalog' },
  SMUN: { code: 'SMUN', title: '发行人资料覆盖', focus: '以已读取的公开财政文件覆盖状态支持发行人研究，不补造财务值。', kind: 'catalog' },
  AAA: { code: 'AAA', title: '期限结构参照', focus: '用财政部 SLGS 真实分期限未偿结构补充原曲线研究，不替代市政债 AAA 报价。', kind: 'curve' },
  BTMM: { code: 'BTMM', title: '短端活动交叉核验', focus: '将 SLGS 短期限未偿与新认购活动直接呈现，作为原有短端研究的补充。', kind: 'structure' },
  PICK: { code: 'PICK', title: '认购期限分布', focus: '直接查看财政部已披露 SLGS 新认购数量、金额和期限桶，不推断地方债发行计划。', kind: 'flow' },
  MBWD: { code: 'MBWD', title: '报价授权闸门', focus: '逐笔报价、买价和深度数据未获免费结构化授权时，终端明确保留空状态。', kind: 'restricted' },
  CDRN: { code: 'CDRN', title: '商议发行资料状态', focus: '将已验证资料范围与日期字段直接呈现；没有结构化官方日程时不生成事件。', kind: 'event' },
  CDRC: { code: 'CDRC', title: '竞价发行资料状态', focus: '核验竞价公告字段的可读范围，避免以样例竞价或虚构竞争度替代。', kind: 'event' },
  CDRA: { code: 'CDRA', title: '固定利率资料边界', focus: '固定利率与评级迁移原始展示保留，新增层只报告实际可读来源状态。', kind: 'catalog' },
  CNDS: { code: 'CNDS', title: '短期限再投资观察', focus: '以 0–6 月官方 SLGS 未偿与近期认购活动补充短期日程，不构造融资结论。', kind: 'structure' },
  CDRV: { code: 'CDRV', title: '可变利率资料闸门', focus: 'SIFMA/VRDN 受限字段不以替代样本填充；终端内显示来源可读状态。', kind: 'restricted' },
  DEAL: { code: 'DEAL', title: '执行资料授权状态', focus: '保留原执行工作区；未授权逐笔成交时不输出模拟价格、质量或交易商排名。', kind: 'restricted' },
  CACT: { code: 'CACT', title: '公司大事证据队列', focus: '事件研究只以已读取的原始文件与时间戳为基础；未收录时保持空状态。', kind: 'event' },
  MCAL: { code: 'MCAL', title: '结构融资期限构成', focus: '以实际 SLGS 新认购期限桶补充原日历，不将政府证券活动等同于地方债发行日程。', kind: 'flow' },
  MBIX: { code: 'MBIX', title: '指数资料许可边界', focus: '指数成分与当前指数值需要相应授权；本层不以未授权数据合成指数。', kind: 'restricted' },
  VRDN: { code: 'VRDN', title: '七天重设资料状态', focus: '原 VRDN 分析保留；若公开基准不可读，终端展示真实缺口而非替代利率。', kind: 'restricted' },
  BMA: { code: 'BMA', title: '税收等价研究输入', focus: '用户可将税率与免税收益率在终端内换算；不把输入值伪装为市场报价。', kind: 'curve' },
  BOOM: { code: 'BOOM', title: '库存数据授权闸门', focus: '库存、委托和客户数据只在已授权范围内展示；当前不生成虚构库存。', kind: 'restricted' },
  MSRB: { code: 'MSRB', title: '市场透明度资料状态', focus: '当前未订阅结构化成交资料。本平台不读取外部逐笔交易，也不补造成交统计、报价、收益率、库存或交易商字段。', kind: 'catalog' },
  SLGS: { code: 'SLGS', title: '财政部 SLGS 官方活动', focus: '直接展示财政部已发布的新认购、赎回及分期限未偿证券结构。', kind: 'flow' },
};

const currencyB = (value: number | null | undefined) => value == null ? '—' : `$${(value / 1_000_000_000).toFixed(2)}B`;
const count = (value: number | null | undefined) => value == null ? '—' : Math.round(value).toLocaleString();
const tooltip = { contentStyle: { background: '#020617', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11 } };

export function buildSlgsCsv(rows: Activity[]) {
  const header = ['record_date', 'new_subscriptions_amount', 'new_subscriptions_count', 'cancelled_subscriptions_amount', 'cancelled_subscriptions_count', 'demand_deposit_redemptions_amount', 'time_deposit_redemptions_amount', ...rows[0]?.buckets.flatMap((bucket) => [`${bucket.id}_issued_amount`, `${bucket.id}_issued_count`, `${bucket.id}_outstanding_amount`, `${bucket.id}_outstanding_count`]) ?? []];
  const body = rows.map((row) => [row.recordDate, row.newSubscriptionsAmount, row.newSubscriptionsCount, row.cancelledSubscriptionsAmount, row.cancelledSubscriptionsCount, row.demandDepositRedemptionsAmount, row.timeDepositRedemptionsAmount, ...row.buckets.flatMap((bucket) => [bucket.issuedAmount, bucket.issuedCount, bucket.outstandingAmount, bucket.outstandingCount])].map((value) => value ?? '').join(','));
  return `\uFEFF${[header.join(','), ...body].join('\n')}`;
}

function downloadSlgsCsv(rows: Activity[]) {
  const blob = new Blob([buildSlgsCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `slgs-official-activity-${rows.at(-1)?.recordDate ?? 'unavailable'}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

function SourceStatus({ sources }: { sources: Array<{ id: string; label: string; frequency: string; availability: string; scope: string; checkedAt: string }> }) {
  return <Card title="终端内来源状态"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{sources.map((source) => <div key={source.id} className="rounded border border-slate-800 bg-slate-950/50 p-2"><div className="flex items-start justify-between gap-2"><b className="text-[11px] text-slate-200">{source.label}</b><Badge tone={source.availability === 'available' ? 'pos' : source.availability === 'restricted' ? 'warn' : 'neutral'}>{source.availability === 'available' ? '可读' : source.availability === 'restricted' ? '受限' : source.availability === 'historical' ? '历史' : '暂不可读'}</Badge></div><p className="mt-1 text-[10px] text-slate-500">{source.frequency} · {source.scope}</p></div>)}</div><p className="mt-2 text-[10px] text-slate-500">数据、图表和研究依据优先在本终端显示。受限数据不会被样例、缓存或推断结果替代；原始网址不作为主要阅读路径。</p></Card>;
}

function DurationStructure({ latest, mode = 'outstanding' }: { latest: Activity; mode?: 'outstanding' | 'issued' }) {
  const [measure, setMeasure] = useState<'amount' | 'count'>('amount');
  const rows = latest.buckets.map((bucket) => ({ bucket: bucket.label, amount: (mode === 'outstanding' ? bucket.outstandingAmount : bucket.issuedAmount) ?? 0, count: (mode === 'outstanding' ? bucket.outstandingCount : bucket.issuedCount) ?? 0 }));
  const valueKey = measure;
  return <Card title={mode === 'outstanding' ? 'SLGS 分期限未偿结构' : 'SLGS 当日新认购期限结构'} action={<div className="flex gap-1"><button type="button" onClick={() => setMeasure('amount')} className={`rounded px-2 py-1 text-[10px] ${measure === 'amount' ? 'bg-cyan-900 text-cyan-100' : 'text-slate-500'}`}>金额</button><button type="button" onClick={() => setMeasure('count')} className={`rounded px-2 py-1 text-[10px] ${measure === 'count' ? 'bg-cyan-900 text-cyan-100' : 'text-slate-500'}`}>证券数</button></div>}><div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(value) => measure === 'amount' ? `$${(value / 1e9).toFixed(0)}B` : value.toLocaleString()} /><Tooltip {...tooltip} formatter={(value: number) => measure === 'amount' ? currencyB(value) : count(value)} /><Bar dataKey={valueKey} fill={mode === 'outstanding' ? '#22d3ee' : '#f59e0b'} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><p className="mt-2 text-[10px] text-slate-500">记录日：{latest.recordDate}。该结构来自财政部 SLGS 非流通证券活动，不是市政债指数权重、报价深度或地方政府债务余额。</p></Card>;
}

function FlowHistory({ rows }: { rows: Activity[] }) {
  const chart = rows.map((row) => ({ date: row.recordDate, subscriptions: (row.newSubscriptionsAmount ?? 0) / 1e9, cancellations: (row.cancelledSubscriptionsAmount ?? 0) / 1e9, redemptions: ((row.demandDepositRedemptionsAmount ?? 0) + (row.timeDepositRedemptionsAmount ?? 0)) / 1e9 }));
  return <Card title="SLGS 已发布活动轨迹（最近 30 个记录）"><div className="h-52"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} minTickGap={28} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(value) => `$${value.toFixed(0)}B`} /><Tooltip {...tooltip} formatter={(value: number) => `$${value.toFixed(3)}B`} /><Area type="monotone" dataKey="subscriptions" name="新认购" stroke="#22d3ee" fill="#155e75" fillOpacity={0.45} /><Area type="monotone" dataKey="redemptions" name="赎回" stroke="#f59e0b" fill="#78350f" fillOpacity={0.25} /><Line type="monotone" dataKey="cancellations" name="撤销" stroke="#fb7185" dot={false} /></AreaChart></ResponsiveContainer></div><p className="mt-2 text-[10px] text-slate-500">仅对财政部已经发布的 SLGS 记录做描述性可视化，不据此预测市政债供应、收益率或资金流。</p></Card>;
}

function RestrictedBoundary({ code, title, text }: { code: string; title: string; text: string }) {
  return <Card title={`${code} · ${title}`}><div className="rounded border border-dashed border-amber-800 bg-amber-950/15 p-3"><div className="flex items-center gap-2 text-xs text-amber-200"><ShieldAlert className="h-4 w-4" />本平台当前没有可展示的真实结构化字段</div><p className="mt-2 text-[11px] leading-5 text-slate-400">{text}</p><p className="mt-2 text-[10px] text-slate-500">原有工作区完整保留。该区块仅显示本平台实际可读字段；无法获得的成交、报价、库存、指数和交易商资料保持为空，不使用第三方网页、旧缓存、样例或推断结果替代。</p></div></Card>;
}

function CatalogView({ code, title, text, sources }: { code: string; title: string; text: string; sources: Array<{ id: string; label: string; availability: string; scope: string }> }) {
  const [query, setQuery] = useState('');
  const rows = sources.filter((source) => `${source.label} ${source.scope}`.toLowerCase().includes(query.toLowerCase()));
  return <Card title={`${code} · ${title}`} action={<FileSearch className="h-3.5 w-3.5 text-cyan-300" />}><p className="mb-2 text-[11px] text-slate-400">{text}</p><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选终端来源、范围或状态" className="input-terminal w-full text-xs" /><div className="mt-2 divide-y divide-slate-800 rounded border border-slate-800">{rows.map((source) => <div key={source.id} className="p-2 text-xs"><div className="flex justify-between gap-2"><span className="text-slate-200">{source.label}</span><span className="text-slate-500">{source.availability === 'available' ? '当前可读' : source.availability === 'restricted' ? '受限' : source.availability === 'historical' ? '历史' : '暂不可读'}</span></div><p className="mt-0.5 text-[10px] text-slate-500">{source.scope}</p></div>)}{!rows.length && <p className="p-3 text-xs text-slate-500">没有匹配的终端内来源条目。</p>}</div></Card>;
}

function BmaInputStudy({ latest }: { latest: Activity }) {
  const [yieldPct, setYieldPct] = useState('3.50');
  const [taxRatePct, setTaxRatePct] = useState('37');
  const yieldValue = Number(yieldPct); const rate = Number(taxRatePct) / 100;
  const taxableEquivalent = Number.isFinite(yieldValue) && rate >= 0 && rate < 1 ? yieldValue / (1 - rate) : null;
  const longBalance = latest.buckets.filter((bucket) => ['5-10y', '10y+'].includes(bucket.id)).reduce((sum, bucket) => sum + (bucket.outstandingAmount ?? 0), 0);
  return <Card title="BMA · 税收等价研究输入"><div className="grid gap-2 sm:grid-cols-3"><label className="text-xs text-slate-500">用户输入免税收益率 (%)<input value={yieldPct} onChange={(event) => setYieldPct(event.target.value)} type="number" min="0" step="0.01" className="input-terminal mt-1 w-full" /></label><label className="text-xs text-slate-500">用户输入边际税率 (%)<input value={taxRatePct} onChange={(event) => setTaxRatePct(event.target.value)} type="number" min="0" max="99.99" step="0.01" className="input-terminal mt-1 w-full" /></label><Metric label="税收等价收益率" value={taxableEquivalent == null ? '—' : `${taxableEquivalent.toFixed(3)}%`} tone="info" sub="仅由当前输入计算" /></div><div className="mt-3 rounded border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-400">SLGS 5 年以上官方未偿本金：<span className="ml-1 font-mono text-cyan-200">{currencyB(longBalance)}</span> · 记录日：{latest.recordDate}</div><p className="mt-2 text-[10px] text-slate-500">换算用于研究口径核验，不包含州/地方税、AMT、现金流、赎回条款或市场报价，也不构成税务或投资建议。</p></Card>;
}

function MunicipalIntegrityBoard({ sources }: { sources: Array<{ id: string; label: string; availability: string; scope: string }> }) {
  const [filter, setFilter] = useState<'all' | 'official' | 'restricted'>('all');
  const officialModules = new Set<ModuleId>(['AAA', 'BTMM', 'PICK', 'CNDS', 'MCAL', 'BMA', 'SLGS']);
  const rows = (Object.keys(MUNICIPAL_MODULE_META) as ModuleId[]).map((id) => {
    const meta = MUNICIPAL_MODULE_META[id];
    const category = meta.kind === 'restricted' || id === 'MSRB' ? 'restricted' : officialModules.has(id) ? 'official' : 'catalog';
    const status = category === 'restricted' ? '真实空状态/授权闸门' : category === 'official' ? '官方资料参照' : '资料范围与证据路径';
    return { id, ...meta, category, status };
  }).filter((row) => filter === 'all' || row.category === filter);
  const readable = sources.filter((source) => source.availability === 'available').length;
  return <Card title="地方债 21 项终端内完整性治理看板" action={<span className="text-[10px] text-slate-500">原内容后追加 · 不创建替代市场数据</span>}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1">{([{ id: 'all', label: '全部入口' }, { id: 'official', label: '官方资料参照' }, { id: 'restricted', label: '真实空状态' }] as const).map((item) => <button type="button" key={item.id} onClick={() => setFilter(item.id)} className={`rounded px-2 py-1 text-[10px] ${filter === item.id ? 'bg-cyan-900 text-cyan-100' : 'bg-slate-900 text-slate-500'}`}>{item.label}</button>)}</div><span className="text-[10px] text-slate-500">当前可读终端来源：{readable} 项</span></div>
    <div className="overflow-x-auto rounded border border-slate-800"><table className="min-w-[820px] w-full text-left text-[11px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="px-2 py-2">入口</th><th className="px-2 py-2">原研究焦点</th><th className="px-2 py-2">终端内状态</th><th className="px-2 py-2">实用研究路径</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-800 align-top"><td className="px-2 py-2 font-mono text-cyan-200">{row.code}</td><td className="px-2 py-2 text-slate-200">{row.title}</td><td className="px-2 py-2"><Badge tone={row.category === 'restricted' ? 'warn' : row.category === 'official' ? 'pos' : 'neutral'}>{row.status}</Badge></td><td className="max-w-[460px] px-2 py-2 leading-5 text-slate-400">{row.focus}</td></tr>)}</tbody></table></div>
    <p className="mt-2 text-[10px] leading-5 text-slate-500">本表仅展示本平台可用研究路径与资料边界：官方参照不等同于市政债实时报价；真实空状态不以示例、缓存或推断数据填充；所有原字段、卡片和交互均保留在上方工作区。</p>
  </Card>;
}

function RenderModule({ moduleId, latest, history, sources }: { moduleId: ModuleId; latest: Activity; history: Activity[]; sources: Array<{ id: string; label: string; frequency: string; availability: string; scope: string }> }) {
  const meta = MUNICIPAL_MODULE_META[moduleId];
  if (moduleId === '1') return <MunicipalIntegrityBoard sources={sources} />;
  if (moduleId === 'AAA') return <DurationStructure latest={latest} />;
  if (moduleId === 'BTMM' || moduleId === 'CNDS') return <DurationStructure latest={latest} />;
  if (moduleId === 'PICK' || moduleId === 'MCAL') return <DurationStructure latest={latest} mode="issued" />;
  if (moduleId === 'SLGS') return <><div className="grid gap-3 xl:grid-cols-2"><FlowHistory rows={history} /><DurationStructure latest={latest} /></div></>;
  if (moduleId === 'BMA') return <BmaInputStudy latest={latest} />;
  if (['MBWD', 'CDRV', 'DEAL', 'MBIX', 'VRDN', 'BOOM'].includes(moduleId)) return <><RestrictedBoundary code={meta.code} title={meta.title} text={meta.focus} /><div className="mt-3"><MunicipalRestrictedTools moduleId={moduleId as 'MBWD' | 'CDRV' | 'DEAL' | 'MBIX' | 'VRDN' | 'BOOM'} latest={latest} sources={sources} /></div></>;
  if (['CDRN', 'CDRC', 'CACT'].includes(moduleId)) return <CatalogView code={meta.code} title={meta.title} text={meta.focus} sources={sources} />;
  if (moduleId === 'MSRC' || moduleId === 'SMUN' || moduleId === 'CDRA' || moduleId === 'MSRB') return <CatalogView code={meta.code} title={meta.title} text={meta.focus} sources={sources} />;
  return <FlowHistory rows={history} />;
}

export default function MunicipalResearchLayer({ moduleId }: { moduleId: string }) {
  const knownId = (moduleId in MUNICIPAL_MODULE_META ? moduleId : '1') as ModuleId;
  const query = trpc.municipalResearch.getSnapshot.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const latest = query.data?.slgs.at(-1);
  const history = useMemo(() => query.data?.slgs ?? [], [query.data?.slgs]);
  const sources = query.data?.sources ?? [];
  const meta = MUNICIPAL_MODULE_META[knownId];
  if (query.isLoading) return <div className="border-t border-slate-800"><LoadingState text="正在读取地方债终端内官方资料…" /></div>;
  if (!latest) return <section className="h-fit rounded-lg border border-cyan-950/80 bg-slate-950/70 p-3"><RestrictedBoundary code={meta.code} title={meta.title} text="财政部官方 SLGS 活动当前暂不可读；系统不会使用旧缓存、示例发行、模拟曲线或虚构交易数据替代。" /><SourceStatus sources={sources} /></section>;
  const outstanding = latest.buckets.reduce((sum, bucket) => sum + (bucket.outstandingAmount ?? 0), 0);
  const evidenceMode = ['MSRC', 'SMUN', 'CDRN', 'CDRC', 'CDRA', 'CDRV', 'DEAL', 'CACT', 'MBIX', 'VRDN', 'BOOM', 'MSRB'].includes(knownId);
  const showSlgsSummary = ['1', 'AAA', 'BTMM', 'PICK', 'CNDS', 'MCAL', 'BMA', 'SLGS'].includes(knownId);
  return <section className="h-fit rounded-lg border border-cyan-950/80 bg-slate-950/70 p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-semibold text-cyan-100">{meta.code} · 终端内深化研究层</h3><Badge tone="info">本模块专属</Badge></div></div>{showSlgsSummary && <div className="flex items-center gap-1"><button type="button" onClick={() => downloadSlgsCsv(history)} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"><Download className="h-3 w-3" />导出官方活动 CSV</button><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-1 rounded border border-cyan-900 px-2 py-1 text-xs text-cyan-200 disabled:text-slate-600"><RefreshCw className={`h-3 w-3 ${query.isFetching ? 'animate-spin' : ''}`} />刷新官方资料</button></div>}</div>{showSlgsSummary && <div className="mb-3 grid gap-2 sm:grid-cols-2"><Metric label="SLGS 记录日" value={latest.recordDate} tone="info" /><Metric label="新认购" value={currencyB(latest.newSubscriptionsAmount)} sub={`${count(latest.newSubscriptionsCount)} 笔证券`} /><Metric label="赎回" value={currencyB((latest.demandDepositRedemptionsAmount ?? 0) + (latest.timeDepositRedemptionsAmount ?? 0))} /><Metric label="分期限未偿" value={currencyB(outstanding)} sub={`读取耗时 ${query.data?.sourceLatencyMs ?? '—'} ms`} /></div>}<RenderModule moduleId={knownId} latest={latest} history={history} sources={sources} />{!evidenceMode && <div className="mt-3"><MunicipalDepthWorkbench moduleId={knownId} latest={latest} history={history} sources={sources} /></div>}{knownId === 'SMUN' && <><div className="mt-3"><MunicipalIssuerEvidenceWorkspace /></div><div className="mt-3"><MunicipalIssuerEvidenceBatchUploader /></div><div className="mt-3"><MunicipalIssuerEvidenceSearchPanel /></div></>}{knownId === '1' && <div className="mt-3"><SourceStatus sources={sources} /></div>}</section>;
}

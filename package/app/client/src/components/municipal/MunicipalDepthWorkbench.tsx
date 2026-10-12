import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, DatabaseZap, FileCheck2, Gauge, Layers3 } from 'lucide-react';
import { Badge, Card, Metric } from '@/components/sovereign/PanelKit';
import MunicipalResearchPresetToolbar from './MunicipalResearchPresetToolbar';
import MunicipalResearchPresetExchangeToolbar from './MunicipalResearchPresetExchangeToolbar';

type ModuleId = '1' | 'MSRC' | 'SMUN' | 'AAA' | 'BTMM' | 'PICK' | 'MBWD' | 'CDRN' | 'CDRC' | 'CDRA' | 'CNDS' | 'CDRV' | 'DEAL' | 'CACT' | 'MCAL' | 'MBIX' | 'VRDN' | 'BMA' | 'BOOM' | 'MSRB' | 'SLGS';
type Bucket = { id: string; label: string; issuedAmount: number | null; issuedCount: number | null; outstandingAmount: number | null; outstandingCount: number | null };
type Activity = { recordDate: string; newSubscriptionsAmount: number | null; cancelledSubscriptionsAmount: number | null; demandDepositRedemptionsAmount: number | null; timeDepositRedemptionsAmount: number | null; buckets: Bucket[] };
type Source = { id: string; label: string; frequency: string; availability: string; scope: string; checkedAt?: string };

export const MUNICIPAL_DEEPENING_CATALOG: Record<ModuleId, { title: string; lens: string; mode: 'flow' | 'structure' | 'evidence' }> = {
  '1': { title: '全模块资料完整性透镜', lens: '对照当前可读来源、实际观察期与受限入口，协助判断下一步研究从何处开始。', mode: 'evidence' },
  MSRC: { title: '检索范围可复核透镜', lens: '将终端资料范围与当前可读状态分开呈现，避免把原工作区检索样式误解为已验证结果。', mode: 'evidence' },
  SMUN: { title: '发行人证据就绪度透镜', lens: '结合后方发行人证据工作区，显示可读资料范围而不合成发行人财务或评级指标。', mode: 'evidence' },
  AAA: { title: '期限结构集中度透镜', lens: '分析实际 SLGS 分期限未偿构成，作为非流通官方结构参照，不作为 AAA 市政债曲线。', mode: 'structure' },
  BTMM: { title: '短端活动透镜', lens: '追踪实际发布的短窗口认购、撤销与赎回，辅助短端资料核验而不代替货币市场成交。', mode: 'flow' },
  PICK: { title: '认购活动节奏透镜', lens: '汇总最近观察窗口的实际认购与撤销，支持资料节奏回顾而不推断地方债发行计划。', mode: 'flow' },
  MBWD: { title: '期限参照比较透镜', lens: '量化官方非流通期限桶的未偿构成，明确与买价、报价深度和可执行性无关。', mode: 'structure' },
  CDRN: { title: '商议发行证据透镜', lens: '展示当前终端资料目录覆盖，缺少结构化官方日程时不产生商议发行事件。', mode: 'evidence' },
  CDRC: { title: '竞价发行证据透镜', lens: '展示当前终端资料目录覆盖，缺少结构化官方日程时不产生竞价、投标或中标结论。', mode: 'evidence' },
  CDRA: { title: '固定利率资料透镜', lens: '审计固定利率和评级相关资料的可读边界，不将未核验字段提升为评级行动或报价。', mode: 'evidence' },
  CNDS: { title: '短期限再投资透镜', lens: '以 0–6 月实际 SLGS 结构和近期活动支撑短期限研究，不生成融资建议。', mode: 'flow' },
  CDRV: { title: '可变利率基准透镜', lens: '核验公开资料覆盖；SLGS 仅为期限背景，绝不替代 VRDN 或 SIFMA 基准。', mode: 'evidence' },
  DEAL: { title: '执行证据透镜', lens: '检查成交、报价和库存资料的实际读取状态；未授权时保留空状态且不创建执行质量评分。', mode: 'evidence' },
  CACT: { title: '公司大事证据透镜', lens: '以来源覆盖确认事件研究准备度；未附原始文件和时间戳时不创建事件记录。', mode: 'evidence' },
  MCAL: { title: '结构融资活动透镜', lens: '显示实际 SLGS 认购节奏作为结构研究参照，不等同于地方债发行日历。', mode: 'flow' },
  MBIX: { title: '指数许可透镜', lens: '辨识当前与历史资料覆盖，不合成指数、成分、行业利差或归因。', mode: 'evidence' },
  VRDN: { title: '七天重设资料透镜', lens: '核验可读短端资料；不以 SLGS 或任何替代序列标注为 VRDN 重设利率。', mode: 'evidence' },
  BMA: { title: '税收等价输入透镜', lens: '配合原有透明输入换算核验可读资料范围，不把用户输入转换为市场指数或税务结论。', mode: 'structure' },
  BOOM: { title: '库存授权透镜', lens: '审计库存、订单与客户字段的资料许可状态；不生成虚构可用量或委托。', mode: 'evidence' },
  MSRB: { title: '市场透明度覆盖透镜', lens: '明确 MSRB 结构化成交订阅状态与当前终端能力，不将网页可见性当成已授权数据接入。', mode: 'evidence' },
  SLGS: { title: 'SLGS 官方活动复核透镜', lens: '在已发布观察中复核净认购和期限构成，直接服务于官方活动研究。', mode: 'flow' },
};

const dollars = (value: number | null | undefined) => value == null ? '—' : `$${(value / 1_000_000_000).toFixed(2)}B`;
const tooltip = { contentStyle: { background: '#020617', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11 } };

export default function MunicipalDepthWorkbench({ moduleId, latest, history, sources }: { moduleId: ModuleId; latest: Activity; history: Activity[]; sources: Source[] }) {
  const [windowSize, setWindowSize] = useState<5 | 10 | 30>(10);
  const [bucketId, setBucketId] = useState(latest.buckets[0]?.id ?? '');
  const config = MUNICIPAL_DEEPENING_CATALOG[moduleId];
  const selectedBucket = latest.buckets.find((bucket) => bucket.id === bucketId) ?? latest.buckets[0];
  const windowRows = useMemo(() => history.slice(-windowSize), [history, windowSize]);
  const chart = useMemo(() => windowRows.map((row) => ({ date: row.recordDate, net: ((row.newSubscriptionsAmount ?? 0) - (row.cancelledSubscriptionsAmount ?? 0) - (row.demandDepositRedemptionsAmount ?? 0) - (row.timeDepositRedemptionsAmount ?? 0)) / 1e9, subscriptions: (row.newSubscriptionsAmount ?? 0) / 1e9 })), [windowRows]);
  const totals = useMemo(() => windowRows.reduce((acc, row) => ({ subscriptions: acc.subscriptions + (row.newSubscriptionsAmount ?? 0), redemptions: acc.redemptions + (row.demandDepositRedemptionsAmount ?? 0) + (row.timeDepositRedemptionsAmount ?? 0), cancellations: acc.cancellations + (row.cancelledSubscriptionsAmount ?? 0) }), { subscriptions: 0, redemptions: 0, cancellations: 0 }), [windowRows]);
  const totalOutstanding = latest.buckets.reduce((sum, bucket) => sum + (bucket.outstandingAmount ?? 0), 0);
  const bucketShare = selectedBucket && totalOutstanding > 0 ? ((selectedBucket.outstandingAmount ?? 0) / totalOutstanding) * 100 : null;
  const readable = sources.filter((source) => source.availability === 'available').length;
  const restricted = sources.filter((source) => source.availability === 'restricted' || source.availability === 'unavailable').length;

  return <Card title={`${moduleId} · ${config.title}`} action={<Badge tone={config.mode === 'evidence' ? 'neutral' : 'info'}>实际资料驱动</Badge>}>
    <p className="text-[11px] leading-5 text-slate-400">{config.lens}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2"><label className="text-[10px] text-slate-500">观察窗口<select value={windowSize} onChange={(event) => setWindowSize(Number(event.target.value) as 5 | 10 | 30)} className="input-terminal ml-1"><option value={5}>最近 5 条</option><option value={10}>最近 10 条</option><option value={30}>最近 30 条</option></select></label>{config.mode === 'structure' && <label className="text-[10px] text-slate-500">期限桶<select value={bucketId} onChange={(event) => setBucketId(event.target.value)} className="input-terminal ml-1">{latest.buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.label}</option>)}</select></label>}<span className="text-[10px] text-slate-600">记录终点：{latest.recordDate}</span></div>
    <MunicipalResearchPresetToolbar moduleId={moduleId} windowSize={windowSize} bucketId={bucketId} onApply={(settings) => { setWindowSize(settings.windowSize); if (settings.bucketId) setBucketId(settings.bucketId); }} />
    <MunicipalResearchPresetExchangeToolbar />
    {config.mode === 'flow' && <><div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="窗口认购" value={dollars(totals.subscriptions)} tone="info" sub={`${windowRows.length} 个实际记录`} /><Metric label="窗口赎回" value={dollars(totals.redemptions)} /><Metric label="窗口撤销" value={dollars(totals.cancellations)} tone="warn" /></div><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 9 }} minTickGap={28} /><YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(value) => `$${value.toFixed(0)}B`} /><Tooltip {...tooltip} formatter={(value: number) => `$${value.toFixed(3)}B`} /><Area type="monotone" dataKey="net" name="净认购（认购－撤销－赎回）" stroke="#22d3ee" fill="#155e75" fillOpacity={0.45} /><Area type="monotone" dataKey="subscriptions" name="新认购" stroke="#f59e0b" fill="#78350f" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div></>}
    {config.mode === 'structure' && <div className="mt-3 grid gap-2 sm:grid-cols-4"><Metric label="所选期限未偿" value={dollars(selectedBucket?.outstandingAmount)} tone="info" /><Metric label="未偿构成" value={bucketShare == null ? '—' : `${bucketShare.toFixed(2)}%`} /><Metric label="当日新认购" value={dollars(selectedBucket?.issuedAmount)} /><Metric label="当日发行笔数" value={selectedBucket?.issuedCount == null ? '—' : Math.round(selectedBucket.issuedCount).toLocaleString()} /></div>}
    {config.mode === 'evidence' && <div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="当前可读来源" value={readable} unit="项" tone={readable ? 'pos' : 'warn'} /><Metric label="受限或不可读来源" value={restricted} unit="项" tone={restricted ? 'warn' : 'info'} /><Metric label="最近实际 SLGS 记录" value={latest.recordDate} /></div>}
    <div className="mt-3 flex items-start gap-2 rounded border border-slate-800 bg-slate-950/50 p-2 text-[10px] leading-5 text-slate-500">{config.mode === 'flow' ? <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> : config.mode === 'structure' ? <Layers3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /> : <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />}<span>所有指标仅由当前终端实际返回的官方观察和资料状态计算。{config.mode === 'evidence' ? '该透镜不创建交易、报价、发行、评级、库存或指数事实。' : '该透镜是研究参照，不构成可交易价格、投资建议或预测。'}</span></div>
  </Card>;
}

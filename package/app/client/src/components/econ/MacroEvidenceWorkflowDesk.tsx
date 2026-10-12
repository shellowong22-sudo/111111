import { CalendarRange, FileSearch, Layers3, RefreshCw, ShieldCheck, TimerReset } from 'lucide-react';
import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';

type Workflow = 'chronology' | 'curve' | 'document' | 'audit';
type TreasuryTenor = '1 Mo' | '3 Mo' | '6 Mo' | '1 Yr' | '2 Yr' | '3 Yr' | '5 Yr' | '7 Yr' | '10 Yr' | '20 Yr' | '30 Yr';

const FED_MONETARY_INPUT = { source: 'fed_monetary' as const, keyword: '', limit: 18 };
const CURVE_SEGMENTS: Array<{ label: string; left: TreasuryTenor; right: TreasuryTenor }> = [
  { label: '3M → 2Y', left: '3 Mo', right: '2 Yr' },
  { label: '2Y → 10Y', left: '2 Yr', right: '10 Yr' },
  { label: '10Y → 30Y', left: '10 Yr', right: '30 Yr' },
];
const WORKFLOWS: Array<{ id: Workflow; label: string; description: string }> = [
  { id: 'chronology', label: '官方发布年表', description: '美联储货币政策发布的真实时间序列与原始标题。' },
  { id: 'curve', label: '期限结构剖面', description: '美国财政部同日 PAR 期限点与可复算的段间差。' },
  { id: 'document', label: '官方原文审阅', description: '终端内读取已选白名单官方发布的正文和命中上下文。' },
  { id: 'audit', label: '跨源时间审计', description: '仅核验政策发布与收益率观察是否可按日期并置。' },
];

function toEpoch(value: Date | string | null | undefined) {
  if (!value) return Number.NaN;
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function formatDate(value: Date | string | null | undefined) {
  const time = toEpoch(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString() : '—';
}

function dayGap(left: Date | string | null | undefined, right: string | null | undefined) {
  const leftTime = toEpoch(left);
  const rightTime = toEpoch(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) ? Math.abs(Math.round((leftTime - rightTime) / 86_400_000)) : null;
}

function policyKind(headline: string) {
  if (/FOMC statement/i.test(headline)) return '委员会声明';
  if (/economic projections/i.test(headline)) return '经济预测发布';
  if (/Minutes/i.test(headline)) return '会议纪要';
  return '官方政策发布';
}

function signed(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

export default function MacroEvidenceWorkflowDesk() {
  const [workflow, setWorkflow] = useState<Workflow>('chronology');
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string | null>(null);
  const policyFeed = trpc.newsResearch.getOfficialFeed.useQuery(FED_MONETARY_INPUT, { staleTime: 300_000, refetchOnWindowFocus: false, retry: 1 });
  const curve = trpc.treasuryDailyYield.getLatest.useQuery(undefined, { staleTime: 300_000, refetchOnWindowFocus: false, retry: 1 });
  const documentEvidence = trpc.moneyMarketPolicy.inspectDocument.useMutation();
  const policyRows = policyFeed.data?.rows ?? [];
  const curvePoints = curve.data?.points ?? [];
  const curveByTenor = useMemo(() => new Map(curvePoints.map((point) => [point.tenor, point.yield])), [curvePoints]);
  const segments = useMemo(() => CURVE_SEGMENTS.map((segment) => {
    const leftValue = curveByTenor.get(segment.left);
    const rightValue = curveByTenor.get(segment.right);
    return { ...segment, leftValue, rightValue, spread: leftValue === undefined || rightValue === undefined ? null : rightValue - leftValue };
  }), [curveByTenor]);
  const selectedPolicy = policyRows.find((row) => row.sourceUrl === (selectedSourceUrl ?? policyRows[0]?.sourceUrl)) ?? null;
  const latestPolicyPublication = policyRows.map((row) => row.publishedAt).filter((value): value is Date => value instanceof Date).sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const curveAvailable = curve.data?.available === true;
  const refresh = () => { policyFeed.refetch(); curve.refetch(); };
  const inspectSelectedDocument = () => { if (selectedPolicy?.sourceUrl) documentEvidence.mutate({ sourceId: 'FED', url: selectedPolicy.sourceUrl }); };

  return <section className="mt-4 rounded-xl border border-emerald-900/70 bg-slate-950 p-4 shadow-[0_0_26px_rgba(16,185,129,0.08)]" data-macro-evidence-workflow-desk="true">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
      <div><p className="font-mono text-[10px] text-emerald-300">OFFICIAL POLICY & CURVE TERMINAL</p><h2 className="mt-1 text-sm font-semibold text-slate-100">政策发布与期限结构终端</h2><p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-400">本终端不再读取或重列经济日历观测版图中的字段、趋势、来源目录或 BLS 卡片。它只使用独立的美联储官方发布流、美国财政部 PAR 曲线以及按需读取的白名单官方正文，分别生成发布年表、期限剖面、原文审阅和时间审计。</p></div>
      <button type="button" onClick={refresh} disabled={policyFeed.isFetching || curve.isFetching} className="inline-flex items-center gap-1 rounded border border-emerald-800 px-2.5 py-1.5 text-[10px] text-emerald-200 hover:bg-emerald-950/30 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${policyFeed.isFetching || curve.isFetching ? 'animate-spin' : ''}`} />重新读取终端</button>
    </header>

    <dl className="mt-3 grid divide-x divide-slate-800 overflow-hidden rounded border border-slate-800 bg-slate-900/25 sm:grid-cols-3" data-macro-terminal-summary="true">
      <div className="p-3"><dt className="font-mono text-[9px] text-emerald-300">POLICY PUBLICATIONS</dt><dd className="mt-1 font-mono text-lg text-slate-100">{policyRows.length}<span className="ml-1 text-[9px] text-slate-500">条</span></dd><p className="mt-1 text-[9px] text-slate-500">最近：{formatDate(latestPolicyPublication)}</p></div>
      <div className="p-3"><dt className="font-mono text-[9px] text-emerald-300">TREASURY TENORS</dt><dd className="mt-1 font-mono text-lg text-slate-100">{curvePoints.length}<span className="ml-1 text-[9px] text-slate-500">点</span></dd><p className="mt-1 text-[9px] text-slate-500">观察日：{curve.data?.observationDate ?? '—'}</p></div>
      <div className="p-3"><dt className="font-mono text-[9px] text-emerald-300">DOCUMENT REVIEW</dt><dd className="mt-1 font-mono text-lg text-slate-100">{documentEvidence.data ? '已读取' : '待选择'}</dd><p className="mt-1 text-[9px] text-slate-500">官方原文按需读取，不预填样例。</p></div>
    </dl>

    <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="政策与期限结构终端流程">{WORKFLOWS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={workflow === item.id} onClick={() => setWorkflow(item.id)} className={`rounded border px-3 py-2 text-left ${workflow === item.id ? 'border-emerald-600 bg-emerald-950/40 text-emerald-100' : 'border-slate-700 text-slate-400 hover:border-emerald-800 hover:text-emerald-200'}`}><span className="block text-[10px] font-medium">{item.label}</span><span className="mt-0.5 block text-[8px] opacity-80">{item.description}</span></button>)}</div>

    {workflow === 'chronology' && <div className="mt-3" data-macro-workflow="official-policy-chronology">
      <div className="flex items-start gap-2 rounded border border-cyan-900/60 bg-cyan-950/10 p-2 text-[10px] leading-4 text-slate-400"><CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />此表保留服务器本次从美联储官方 RSS/XML 读取的标题、机构、发布时间和读取时间。选择一条记录可在终端内进入原文审阅；不跳转来源网页，不推断政策立场、利率路径、市场反应或交易结果。</div>
      {policyFeed.isLoading ? <p className="mt-3 rounded border border-slate-800 bg-slate-900/35 p-3 text-[10px] text-slate-400">正在读取美联储官方货币政策发布流；不会使用经济日历观察、历史样例或第三方新闻补齐。</p> : !policyFeed.data ? <p className="mt-3 rounded border border-amber-900/60 bg-amber-950/15 p-3 text-[10px] text-amber-100">官方发布流当前不可读，年表保持真实空状态。</p> : <div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="w-full min-w-[1040px] text-left text-[10px]"><thead className="border-b border-slate-800 bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2 font-medium">发布类别</th><th className="px-3 py-2 font-medium">官方标题</th><th className="px-3 py-2 font-medium">机构</th><th className="px-3 py-2 font-medium">发布时间</th><th className="px-3 py-2 font-medium">本次读取</th><th className="px-3 py-2 font-medium">终端操作</th></tr></thead><tbody>{policyRows.map((row) => <tr key={row.sourceId} className="border-b border-slate-800/70"><td className="px-3 py-2 text-cyan-100">{policyKind(row.headline)}</td><td className="px-3 py-2 text-slate-200">{row.headline}<p className="mt-0.5 font-mono text-[8px] text-slate-600">{row.sourceKind}</p></td><td className="px-3 py-2 text-slate-300">{row.institution}</td><td className="px-3 py-2 font-mono text-slate-300">{formatDate(row.publishedAt)}</td><td className="px-3 py-2 font-mono text-slate-500">{formatDate(row.retrievedAt)}</td><td className="px-3 py-2"><button type="button" onClick={() => { documentEvidence.reset(); setSelectedSourceUrl(row.sourceUrl); setWorkflow('document'); }} className="rounded border border-emerald-800 px-2 py-1 text-[9px] text-emerald-200 hover:bg-emerald-950/30">在终端审阅</button></td></tr>)}</tbody></table></div>}
    </div>}

    {workflow === 'curve' && <div className="mt-3" data-macro-workflow="treasury-curve-profile">
      <div className="flex items-start gap-2 rounded border border-violet-900/60 bg-violet-950/10 p-2 text-[10px] leading-4 text-slate-400"><Layers3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />期限结构剖面只使用同一美国财政部观察日的实际 PAR 点。段间差等于右端期限减左端期限，单位为百分点；它不是衰退概率、利率预测、交易信号或政策解读。</div>
      {curve.isLoading ? <p className="mt-3 rounded border border-slate-800 bg-slate-900/35 p-3 text-[10px] text-slate-400">正在读取美国财政部当日 PAR 曲线；不使用经济日历字段、测试曲线或合成期限点替代。</p> : !curveAvailable ? <p className="mt-3 rounded border border-amber-900/60 bg-amber-950/15 p-3 text-[10px] text-amber-100">{curve.data?.limitation ?? '财政部本次没有返回可解析期限点；剖面保持真实空状态。'}</p> : <><div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="w-full min-w-[760px] text-left text-[10px]"><thead className="border-b border-slate-800 bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2 font-medium">曲线段</th><th className="px-3 py-2 font-medium">左端期限</th><th className="px-3 py-2 font-medium">右端期限</th><th className="px-3 py-2 font-medium">同日段间差</th><th className="px-3 py-2 font-medium">观察日</th></tr></thead><tbody>{segments.map((segment) => <tr key={segment.label} className="border-b border-slate-800/70"><td className="px-3 py-2 text-violet-100">{segment.label}</td><td className="px-3 py-2 font-mono text-slate-300">{segment.leftValue === undefined ? '—' : `${segment.leftValue.toFixed(2)}%`}</td><td className="px-3 py-2 font-mono text-slate-300">{segment.rightValue === undefined ? '—' : `${segment.rightValue.toFixed(2)}%`}</td><td className="px-3 py-2 font-mono text-violet-100">{segment.spread === null ? '—' : `${signed(segment.spread)} pct pts`}</td><td className="px-3 py-2 font-mono text-slate-500">{curve.data?.observationDate ?? '—'}</td></tr>)}</tbody></table></div><div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="w-full min-w-[860px] text-left text-[10px]"><thead className="border-b border-slate-800 bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2 font-medium">期限</th>{curvePoints.map((point) => <th key={point.tenor} className="px-3 py-2 font-medium">{point.tenor}</th>)}</tr></thead><tbody><tr><td className="px-3 py-2 text-slate-400">PAR 收益率</td>{curvePoints.map((point) => <td key={point.tenor} className="px-3 py-2 font-mono text-slate-200">{point.yield.toFixed(2)}%</td>)}</tr></tbody></table></div></>}
    </div>}

    {workflow === 'document' && <div className="mt-3" data-macro-workflow="official-document-inspection">
      <div className="flex items-start gap-2 rounded border border-emerald-900/60 bg-emerald-950/10 p-2 text-[10px] leading-4 text-slate-400"><FileSearch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />原文审阅使用独立的 `moneyMarketPolicy.inspectDocument` 契约，仅允许读取白名单机构的官方 HTML/文本。正文和关键词上下文直接呈现在终端内；不会跳转来源网页。</div>
      {!selectedPolicy ? <p className="mt-3 rounded border border-amber-900/60 bg-amber-950/15 p-3 text-[10px] text-amber-100">官方发布年表当前没有可选择记录；不会以样例正文替代。</p> : <><div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded border border-slate-800 bg-slate-900/35 p-3"><div><p className="font-mono text-[9px] text-emerald-300">SELECTED OFFICIAL RELEASE</p><p className="mt-1 text-xs text-slate-100">{selectedPolicy.headline}</p><p className="mt-1 text-[9px] text-slate-500">{selectedPolicy.institution} · {formatDate(selectedPolicy.publishedAt)}</p></div><button type="button" onClick={inspectSelectedDocument} disabled={documentEvidence.isPending} className="inline-flex items-center gap-1 rounded border border-emerald-800 px-2.5 py-1.5 text-[10px] text-emerald-200 hover:bg-emerald-950/30 disabled:opacity-50"><FileSearch className="h-3.5 w-3.5" />{documentEvidence.isPending ? '正在读取原文' : '读取官方正文'}</button></div>{documentEvidence.error ? <p className="mt-3 rounded border border-amber-900/60 bg-amber-950/15 p-3 text-[10px] text-amber-100">官方正文当前不可读取；不会使用摘要、缓存样例或第三方网页替代。</p> : documentEvidence.data && documentEvidence.variables?.url === selectedPolicy.sourceUrl ? <><div className="mt-3 grid gap-2 md:grid-cols-2"><div className="rounded border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] text-emerald-300">OFFICIAL DOCUMENT BOUNDARY</p><p className="mt-2 text-[10px] leading-4 text-slate-400">{documentEvidence.data.limitation}</p><p className="mt-2 font-mono text-[9px] text-slate-500">读取 {formatDate(documentEvidence.data.retrievedAt)}</p></div><div className="rounded border border-slate-800 bg-slate-900/35 p-3"><p className="font-mono text-[9px] text-emerald-300">KEYWORD CONTEXTS</p><p className="mt-2 text-[10px] text-slate-400">命中 {documentEvidence.data.highlights.length} 个规则关键词；仅显示原文邻近上下文，不将命中自动解释为政策立场。</p></div></div><div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="w-full min-w-[880px] text-left text-[10px]"><thead className="border-b border-slate-800 bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2 font-medium">类别</th><th className="px-3 py-2 font-medium">命中词</th><th className="px-3 py-2 font-medium">官方原文上下文</th></tr></thead><tbody>{documentEvidence.data.highlights.length ? documentEvidence.data.highlights.map((highlight, index) => <tr key={`${highlight.category}-${highlight.start}-${index}`} className="border-b border-slate-800/70"><td className="px-3 py-2 text-emerald-100">{highlight.category}</td><td className="px-3 py-2 font-mono text-slate-300">{highlight.phrase}</td><td className="px-3 py-2 leading-4 text-slate-400">{highlight.context}</td></tr>) : <tr><td colSpan={3} className="px-3 py-3 text-slate-500">本次正文没有规则关键词命中；系统不生成立场或结论。</td></tr>}</tbody></table></div><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-950/70 p-3 text-[10px] leading-5 text-slate-400">{documentEvidence.data.text.slice(0, 8_000)}</pre></> : <p className="mt-3 rounded border border-slate-800 bg-slate-900/35 p-3 text-[10px] text-slate-400">选择的官方发布已准备好。点击“读取官方正文”后才发起白名单来源读取，避免用旧内容或假文本预填。</p>}</>}
    </div>}

    {workflow === 'audit' && <div className="mt-3" data-macro-workflow="cross-source-time-audit">
      <div className="flex items-start gap-2 rounded border border-amber-900/60 bg-amber-950/10 p-2 text-[10px] leading-4 text-slate-400"><TimerReset className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />时间审计只计算美联储官方发布日与财政部曲线观察日的自然日距离，用于判断能否在同一终端视图中清楚标注时点；不解释领先、滞后、因果、影响或策略。</div>
      {policyFeed.isLoading || curve.isLoading ? <p className="mt-3 rounded border border-slate-800 bg-slate-900/35 p-3 text-[10px] text-slate-400">正在读取两条独立官方来源；任一来源未返回前不以历史页面或样例日期填补。</p> : <div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="w-full min-w-[900px] text-left text-[10px]"><thead className="border-b border-slate-800 bg-slate-900/60 text-slate-500"><tr><th className="px-3 py-2 font-medium">官方发布</th><th className="px-3 py-2 font-medium">发布时间</th><th className="px-3 py-2 font-medium">财政部曲线观察日</th><th className="px-3 py-2 font-medium">日期距离</th><th className="px-3 py-2 font-medium">并置边界</th></tr></thead><tbody>{policyRows.length ? policyRows.map((row) => { const gap = dayGap(row.publishedAt, curve.data?.observationDate); return <tr key={row.sourceId} className="border-b border-slate-800/70"><td className="px-3 py-2 text-slate-200">{row.headline}</td><td className="px-3 py-2 font-mono text-slate-300">{formatDate(row.publishedAt)}</td><td className="px-3 py-2 font-mono text-slate-300">{curve.data?.observationDate ?? '—'}</td><td className="px-3 py-2 font-mono text-amber-100">{gap === null ? '—' : `${gap} 天`}</td><td className="px-3 py-2 text-slate-500">{gap === null ? '至少一端不可读' : '已显示实际日期；不作关系推断'}</td></tr>; }) : <tr><td colSpan={5} className="px-3 py-3 text-slate-500">官方发布流当前不可读，系统不使用保存的示例标题或日期替代。</td></tr>}</tbody></table></div>}
    </div>}

    <footer className="mt-3 flex items-start gap-1.5 rounded border border-emerald-900/50 bg-emerald-950/10 p-2 text-[9px] leading-4 text-slate-400"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />终端内来源：{policyFeed.data?.boundary ?? '美联储官方 RSS/XML 发布流'}；美国财政部日度 PAR 收益率；用户选定的白名单官方政策正文。该模块不显示外部网页，不复刻经济日历字段、来源目录或趋势卡片。</footer>
  </section>;
}

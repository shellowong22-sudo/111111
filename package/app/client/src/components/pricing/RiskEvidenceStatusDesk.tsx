import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const REQUIRED_EVIDENCE = [
  ['持仓与名义金额', '未导入', '没有可验证的组合权重、币种或估值时点，不能计算组合 AUM、敞口或风险。'],
  ['衍生品合同与敏感度', '未导入', '没有合约、到期日、delta/vega、抵押品与保证金数据，不能推断衍生品风险。'],
  ['基准与风险模型参数', '未导入', '没有风险因子映射、置信度口径、估值规则或回测基准，不能生成监管或模型结论。'],
  ['对手方与流动性资料', '未导入', '没有交易对手、额度、结算、持仓期限和流动性资料，不能生成信用或流动性预警。'],
] as const;

export default function RiskEvidenceStatusDesk() {
  const observations = trpc.market.headerObservations.useQuery(undefined, { refetchInterval: 300_000, refetchOnWindowFocus: false, retry: 1 });
  const items = (observations.data?.items ?? []).filter((item) => item.available && item.price !== null && item.changePct !== null && item.source);
  return <section className="rounded border border-cyan-900/60 bg-[#0c1727] p-3 text-gray-100" data-risk-evidence-status-desk="true">
    <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-cyan-300" /><div><p className="text-sm font-bold text-cyan-200">DASH · 风险证据状态</p><p className="mt-0.5 max-w-4xl text-[10px] leading-4 text-gray-400">本窗口先显示已验证的公开市场观察和风险证据缺口。没有账户级持仓、衍生品、基准和对手方资料时，终端不计算组合 AUM、VaR、CVaR、夏普、回撤、风险贡献或预警。</p></div></div>
    <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1.25fr]"><div className="rounded border border-gray-800 bg-gray-950/45 p-2"><p className="text-[10px] text-cyan-200">本次公开市场观察</p>{observations.isLoading ? <p className="mt-2 text-[10px] text-gray-500">正在读取公开行情…</p> : items.length ? <div className="mt-2 space-y-1">{items.map((item) => <div key={item.symbol} className="rounded border border-gray-800 bg-[#0d1118] px-2 py-1.5"><div className="flex justify-between gap-2"><span className="font-mono text-[10px] text-gray-200">{item.label}</span><span className={item.changePct! >= 0 ? 'font-mono text-[10px] text-green-400' : 'font-mono text-[10px] text-red-400'}>{item.changePct! >= 0 ? '+' : ''}{item.changePct!.toFixed(3)}%</span></div><p className="mt-0.5 text-[9px] text-gray-400">{item.price!.toLocaleString(undefined, { maximumFractionDigits: 4 })} {item.currency} · {item.source} · 观测 {item.observedAt ?? '未提供'}</p></div>)}</div> : <p className="mt-2 text-[10px] leading-4 text-amber-200">公共行情源未返回可验证观察；终端不以固定市场快照替代。</p>}<p className="mt-2 text-[8px] leading-4 text-gray-600">这些是单一公开价格观察，不是用户组合、因子暴露、风险评分或可执行报价。</p></div><div className="rounded border border-gray-800 bg-gray-950/45 p-2"><p className="text-[10px] text-cyan-200">组合风险计算前提</p><div className="mt-2 space-y-1">{REQUIRED_EVIDENCE.map(([label, status, explanation]) => <div key={label} className="rounded border border-gray-800 bg-[#0d1118] px-2 py-1.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] text-gray-300">{label}</span><span className="rounded border border-amber-900/60 bg-amber-950/30 px-1.5 py-0.5 text-[8px] text-amber-200">{status}</span></div><p className="mt-1 text-[9px] leading-4 text-gray-500">{explanation}</p></div>)}</div><p className="mt-2 flex gap-1 rounded border border-amber-900/50 bg-amber-950/20 p-2 text-[9px] leading-4 text-amber-100"><TriangleAlert className="h-3.5 w-3.5 shrink-0" />风险管理需要具名且有估值时点的账户证据。用户可在 PORT 中录入单证券观察；它不自动形成组合风险账户。</p></div></div>
  </section>;
}

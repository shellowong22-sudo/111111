import { Leaf, LoaderCircle, TriangleAlert } from 'lucide-react';
import { trpc } from '@/lib/trpc';

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '不可用' : `${value.toFixed(2)}%`;
}

export default function PublicRenewableEnergyDesk() {
  const query = trpc.energyPublic.getRenewableObservations.useQuery(undefined, { staleTime: 30 * 60 * 1000 });
  if (query.isLoading) return <section className="rounded border border-emerald-900/60 bg-slate-950 p-4 text-xs text-slate-400" data-public-energy-observations="loading"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin text-emerald-300" />正在读取 World Bank 年度可再生能源观测…</section>;
  if (query.isError || !query.data || !query.data.available) return <section className="rounded border border-amber-900/60 bg-slate-950 p-4 text-xs text-slate-300" data-public-energy-observations="unavailable"><TriangleAlert className="mr-2 inline h-4 w-4 text-amber-300" />当前 World Bank 请求没有返回可验证的可再生能源观测；终端不会以固定行业增长、容量、成本或投资数据替代。</section>;
  const { countries, indicators, source, queriedAt, limitation } = query.data;
  return <section className="rounded border border-emerald-900/60 bg-slate-950 p-3 text-slate-100" data-public-energy-observations="ready"><div className="flex items-start gap-2"><Leaf className="mt-0.5 h-4 w-4 text-emerald-300" /><div><p className="text-sm font-bold text-emerald-200">BNEF · 公开能源观察</p><p className="mt-1 text-[10px] leading-4 text-slate-400">以下为 World Bank Open Data 的年度国家指标，不是 BNEF 专有研究。显示最近可用年份，按国家分别保留观测日期和缺失状态。</p></div></div><div className="mt-3 grid gap-2 lg:grid-cols-5">{countries.map((country) => <article key={country.code} className="rounded border border-slate-800 bg-slate-900/35 p-2"><p className="text-xs font-semibold text-slate-200">{country.label}</p><Metric label="可再生发电占比" point={country.electricity.latest} previous={country.electricity.previous} /><Metric label="最终能源消费占比" point={country.finalConsumption.latest} previous={country.finalConsumption.previous} /></article>)}</div><div className="mt-3 rounded border border-dashed border-slate-700 p-2 text-[10px] leading-4 text-slate-400"><p>来源：{source}；查询时间：{new Date(queriedAt).toLocaleString('zh-CN')}。</p><p>指标：{indicators.map((indicator) => `${indicator.code} ${indicator.label}（${indicator.unit}）`).join('；')}。</p><p className="mt-1 text-amber-200">限制：{limitation}</p></div></section>;
}

function Metric({ label, point, previous }: { label: string; point: { value: number; year: number } | null; previous: { value: number; year: number } | null }) {
  const delta = point && previous ? point.value - previous.value : null;
  return <div className="mt-2 border-t border-slate-800 pt-2"><p className="text-[9px] text-slate-500">{label}</p><p className="mt-0.5 text-sm font-medium text-emerald-200">{formatPercent(point?.value)}</p><p className="text-[9px] text-slate-500">观察年：{point?.year ?? '—'}{delta === null ? '；无可比上期' : `；对 ${previous?.year}：${delta >= 0 ? '+' : ''}${delta.toFixed(2)} 个百分点`}</p></div>;
}

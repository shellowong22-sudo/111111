import { FormEvent, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { STOCK_CAPABILITIES } from "@shared/threeModuleCapabilityCatalog";

type Capability = (typeof STOCK_CAPABILITIES)[number];

const METHOD: Record<string, { method: string; output: string; fields: string }> = {
  coverage: { method: "证券身份、交易所和可读性校验", output: "覆盖状态与来源边界", fields: "instrumentId, exchange, currency, source, observationDate" },
  wei: { method: "公共指数序列统一基期比较", output: "基准路径与观察时效", fields: "indicatorId, value, unit, observationDate, retrievedAt" },
  ftw: { method: "账户自选去重与观察覆盖", output: "唯一代码清单和覆盖缺口", fields: "userId, ticker, sortOrder, sourceStatus" },
  imap: { method: "证券日频量价观察", output: "收盘、区间收益与成交量", fields: "ticker, close, high, low, volume, observationDate" },
  evts: { method: "SEC 申报日期归并", output: "公司事件时间线", fields: "cik, accessionNumber, form, filingDate" },
  top: { method: "标题、主体、文件指纹去重", output: "唯一新闻与权威披露流", fields: "contentId, source, publishedAt, fingerprint" },
  tren: { method: "相同表单口径的期间计数", output: "申报事件频度变化", fields: "cik, form, filingMonth, count" },
  "8": { method: "横截面上涨、下跌与缺失状态聚合", output: "市场宽度和收益分布", fields: "instrumentId, changePct, status, observationDate" },
  eqs: { method: "用户条件与可读字段交集筛选", output: "可复核候选证券集", fields: "filterId, field, operator, value, sourceStatus" },
  eqbt: { method: "实际日频观察的区间路径复算", output: "收益、波动和最大回撤", fields: "date, adjustedClose, adjustment, source" },
  ds: { method: "SEC 原文关键词定位", output: "文件、段落与证据位置", fields: "cik, accessionNumber, primaryDocument, excerpt" },
  "bi-stox": { method: "行业分类与公司事实同报告期对齐", output: "同业事实横截面", fields: "sic, fiscalPeriod, metricId, value, filedAt" },
  res: { method: "主体、文件、数据和审计串联", output: "可重放研究路径", fields: "researchId, entityId, sourceId, decisionLog" },
  in: { method: "证券相对公共指数的共同窗口比较", output: "超额路径与风险差异", fields: "instrumentId, benchmarkId, date, return" },
  "15": { method: "账户持仓权重标准化", output: "集中度与风险输入完整性", fields: "accountId, instrumentId, quantity, marketValue" },
  tlts: { method: "持仓行业与因子字段完备性检查", output: "暴露缺口和权重覆盖", fields: "instrumentId, sectorId, factorId, weight" },
  port: { method: "收益来源与权重贡献复算", output: "组合归因桥", fields: "positionId, weight, return, benchmarkReturn" },
  "18": { method: "个股 OHLCV、财务和事件同证券联动", output: "单券研究证据链", fields: "ticker, date, ohlcv, fiscalPeriod, eventId" },
  "19": { method: "期权合约条款与模型输入校验", output: "Greeks 和透明情景", fields: "underlyingId, expiry, strike, optionType, impliedVolatility" },
  moso: { method: "期权链成交与未平仓排序", output: "活跃度和流动性", fields: "contractId, volume, openInterest, bid, ask, marketTimestamp" },
  "21": { method: "基金交易价格与官方净值分域", output: "基金价格覆盖和股票敞口缺口", fields: "fundId, price, nav, holdingsDate, source" },
  etf: { method: "ETF 价格与官方净值共同窗口比较", output: "溢折价和跟踪差异", fields: "etfId, price, nav, benchmarkId, date" },
  fsrc: { method: "证券清单逐项来源探测", output: "历史点数、最近观察日和失败原因", fields: "ticker, sourceStatus, pointCount, latestDate" },
  pe: { method: "授权、估值口径和报告期闸门", output: "私募资料可用边界", fields: "fundId, valuationDate, methodology, permission" },
  "25": { method: "订单字段、账户权限和风险规则校验", output: "可提交或阻断原因", fields: "orderId, accountId, side, quantity, limitPrice, checks" },
  emsx: { method: "订单与成交事件顺序复核", output: "状态生命周期和执行审计", fields: "orderId, eventId, status, sequence, timestamp" },
  "27": { method: "发行与融资 SEC 表单时间线", output: "资本市场活动证据", fields: "issuerId, form, filingDate, accessionNumber" },
  cact: { method: "公司行动类型与生效日对账", output: "分红、回购和拆并股事件", fields: "actionId, actionType, exDate, effectiveDate, source" },
  ma: { method: "并购相关文件和关键日期核验", output: "交易事件时间线", fields: "dealId, parties, form, announcedAt, filedAt" },
  ipo: { method: "发行申报版本与关键日期排序", output: "IPO 文件时间线", fields: "issuerId, form, accessionNumber, filingDate, version" },
  "31": { method: "来源授权和交付回执检查", output: "研究交付审计", fields: "deliveryId, targetId, sourcePermission, ackAt" },
  "32": { method: "同一观察窗内的因子定义、截面排序与稳健性复核", output: "因子暴露、价格路径与模型边界", fields: "factorId, instrumentId, asOfDate, exposure, rank, source, modelVersion" },
  factorlab: { method: "用户因子截面排序和稳定性检验", output: "权重贡献与模型限制", fields: "factorId, instrumentId, asOfDate, value, weight" },
  cockpit: { method: "账户观察规则与触发记录匹配", output: "唯一预警、状态和确认", fields: "alertId, rule, instrumentId, triggeredAt, ackAt" },
};

function statistics(history: Array<{ date: string; value: number; volume?: number | null }>) {
  const values = history.map(point => point.value).filter(Number.isFinite);
  if (values.length < 2) return null;
  const returns = values.slice(1).map((value, index) => value / values[index] - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.length > 1 ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1) : 0;
  let peak = values[0], maxDrawdown = 0;
  values.forEach(value => { peak = Math.max(peak, value); maxDrawdown = Math.min(maxDrawdown, value / peak - 1); });
  return { returnPct: (values.at(-1)! / values[0] - 1) * 100, annualizedVolPct: Math.sqrt(variance * 252) * 100, maxDrawdownPct: maxDrawdown * 100, points: values.length };
}

export default function StockCapabilityAnalysisTool({ moduleId }: { moduleId: string }) {
  const capability: Capability = STOCK_CAPABILITIES.find(item => item.id === moduleId) ?? STOCK_CAPABILITIES[0];
  const definition = METHOD[capability.id] ?? { method: capability.responsibility, output: "来源核验结果", fields: "source, observationDate, quality" };
  const [draft, setDraft] = useState("");
  const [ticker, setTicker] = useState("");
  const isPublicObservation = capability.sourceProfile === "market" || capability.sourceProfile === "official" || capability.sourceProfile === "filing";
  const observation = trpc.stockMarketResearch.getTickerObservation.useQuery({ ticker: ticker || "INVALID", range: "1y", assetClass: "stocks" }, { enabled: isPublicObservation && Boolean(ticker), retry: false, staleTime: 30_000, refetchOnReconnect: true });
  const fundamentals = trpc.stockMarketResearch.getWatchlistFundamentals.useQuery({ tickers: ticker ? [ticker] : ["INVALID"] }, { enabled: capability.sourceProfile === "filing" && Boolean(ticker), retry: false, staleTime: 30_000, refetchOnReconnect: true });
  const stats = useMemo(() => statistics((observation.data?.observation?.history ?? []) as Array<{ date: string; value: number; volume?: number | null }>), [observation.data?.observation?.history]);
  const chartData = useMemo(() => ((observation.data?.observation?.history ?? []) as Array<{ date: string; value: number; volume?: number | null }>).filter(point => Number.isFinite(point.value)).map(point => ({ date: point.date, value: point.value, volume: Number.isFinite(Number(point.volume)) ? Number(point.volume) : null })), [observation.data?.observation?.history]);
  const submit = (event: FormEvent) => { event.preventDefault(); const cleaned = draft.trim().toUpperCase().replace(/[^A-Z0-9.^=-]/g, "").slice(0, 15); setTicker(cleaned); };
  const sourceState = capability.sourceProfile === "licensed" ? "许可数据源未配置" : capability.sourceProfile === "account" ? "等待账户级输入" : !ticker ? "等待证券代码" : observation.isLoading || fundamentals.isLoading ? "正在读取" : observation.isError || fundamentals.isError ? "读取失败" : observation.data?.status === "available" ? "公共日频观察可读" : "公共来源当前不可读";
  const point = observation.data?.observation;
  const fact = fundamentals.data?.rows?.[0];

  return <section className="min-h-full bg-[#070b10] text-xs text-slate-200" aria-label={`${capability.code} ${capability.name}分析工具`}>
    <header className="border-b border-slate-800 px-2 py-2"><b className="font-mono text-cyan-200">{capability.code}</b><span className="ml-2">{capability.name}分析工具</span><p className="mt-1 text-[10px] text-slate-500">方法：{definition.method} · 输出：{definition.output}</p></header>
    <form role="toolbar" onSubmit={submit} className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-2">
      <label className="min-w-48 flex-1 text-[10px] text-slate-400">证券代码<input aria-label={`${capability.code} 证券代码`} value={draft} onChange={event => setDraft(event.target.value)} disabled={!isPublicObservation} placeholder={isPublicObservation ? "输入公开市场代码" : capability.sourceProfile === "licensed" ? "需许可数据源" : "需账户数据"} className="mt-1 h-7 w-full border border-slate-700 bg-black px-2 font-mono text-[11px] disabled:opacity-50" /></label>
      <button type="submit" disabled={!isPublicObservation || !draft.trim() || observation.isFetching || fundamentals.isFetching} className="inline-flex h-7 items-center gap-1 border border-cyan-800 px-2 text-[11px] text-cyan-200 disabled:opacity-40"><RefreshCw className={`h-3 w-3 ${observation.isFetching || fundamentals.isFetching ? "animate-spin" : ""}`} />读取并核验</button>
    </form>
    <table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">唯一分析职责</th><th>必需字段</th><th>来源类型</th><th>当前状态</th></tr></thead><tbody><tr className="border-t border-slate-800"><td className="p-2 text-cyan-200">{capability.responsibility}</td><td className="font-mono">{definition.fields}</td><td>{capability.sourceProfile}</td><td className="text-amber-200">{sourceState}</td></tr></tbody></table>
    {point ? <><table className="w-full text-left text-[10px]"><thead className="border-t border-slate-800 text-slate-500"><tr><th className="p-2">证券 / 来源</th><th>末值</th><th>观察日</th><th>区间收益</th><th>年化波动</th><th>最大回撤</th><th>点数</th></tr></thead><tbody><tr className="border-t border-slate-800"><td className="p-2"><b className="font-mono text-cyan-200">{point.ticker}</b><span className="block text-slate-500">{point.source}</span></td><td className="font-mono">{point.price?.toLocaleString()} {point.currency}</td><td>{point.observationDate}</td><td>{stats ? `${stats.returnPct.toFixed(4)}%` : "—"}</td><td>{stats ? `${stats.annualizedVolPct.toFixed(4)}%` : "—"}</td><td>{stats ? `${stats.maxDrawdownPct.toFixed(4)}%` : "—"}</td><td>{stats?.points ?? 0}</td></tr></tbody></table>
      {chartData.length > 1 ? <div className="border-t border-slate-800 px-2 py-2" aria-label={`${capability.code || capability.name}真实历史数据图层`}>
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500"><span>实际历史价格与成交量</span><span>{point.source} · {point.observationDate}</span></div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} minTickGap={32} />
            <YAxis yAxisId="price" domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 9 }} width={54} />
            <YAxis yAxisId="volume" orientation="right" tick={{ fill: "#64748b", fontSize: 9 }} width={54} tickFormatter={value => Number(value).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })} />
            <Tooltip contentStyle={{ background: "#070b10", border: "1px solid #334155", fontSize: 10 }} labelStyle={{ color: "#94a3b8" }} />
            <Bar yAxisId="volume" dataKey="volume" name="成交量" fill="#1d4ed8" fillOpacity={0.45} />
            <Line yAxisId="price" type="monotone" dataKey="value" name={`价格 (${point.currency})`} stroke="#22d3ee" strokeWidth={1.8} dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div> : <p role="status" className="border-t border-slate-800 p-2 text-[10px] text-amber-200">公共来源返回的有效历史点不足，无法绘制时间序列；不补齐或生成曲线。</p>}
      <p className="border-t border-slate-800 p-2 text-[10px] text-slate-500">公共日频历史用于研究复算，不是交易所实时报价、盘口、逐笔成交或含分红总回报。</p></> : null}
    {fact ? <table className="w-full text-left text-[10px]"><thead className="border-t border-slate-800 text-slate-500"><tr><th className="p-2">SEC 主体</th><th>CIK</th><th>事实状态</th><th>原因</th></tr></thead><tbody><tr className="border-t border-slate-800"><td className="p-2">{fact.issuerName ?? ticker}</td><td className="font-mono">{fact.cik ?? "—"}</td><td>{fact.status === "available" ? "可读" : "不可读"}</td><td>{fact.reason ?? "标准化公司事实已返回"}</td></tr></tbody></table> : null}
    {!point && ticker && isPublicObservation && !observation.isLoading ? <p role="status" className="border-t border-slate-800 p-3 text-amber-200">该代码当前没有可读公共日频观察；不加载样例证券或固定数值。</p> : null}
    <footer role="status" className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">{capability.sourceProfile === "licensed" ? "许可行情、订单簿、期权链或执行事件未配置时保持空状态。" : capability.sourceProfile === "account" ? "账户持仓、自选、订单或交付记录必须由已认证后端提供。" : "读取结果保留来源、观察日和日频非实时边界。"}</footer>
  </section>;
}

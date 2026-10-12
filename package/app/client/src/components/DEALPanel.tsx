import { useState } from "react";
import { Activity, AlertTriangle, Database, Gauge, X } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface Props {
  onClose?: () => void;
}

const ACCENT = "#f59e0b";
const tabs = ["trades", "intraday", "analysis"] as const;
const executionTabs = ["quality", "dealer", "cost"] as const;

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
      <Database className="mx-auto h-7 w-7 text-slate-600" />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function decimal(value: number | null | undefined, digits = 2) {
  return value == null ? "—" : value.toFixed(digits);
}

export default function DEALPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("trades");
  const [filterFlag, setFilterFlag] = useState("all");
  const [executionTab, setExecutionTab] =
    useState<(typeof executionTabs)[number]>("quality");
  const query = trpc.municipalResearch.getDealMunicipalTradeStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = query.data;
  const trades = data?.trades ?? [];
  const intraday = data?.intraday ?? [];
  const filtered = trades.filter(trade =>
    filterFlag === "flagged"
      ? trade.flag != null
      : filterFlag === "normal"
        ? trade.flag == null
        : true
  );
  const totalVolume = trades.reduce(
    (sum, trade) => sum + trade.sizeThousands,
    0
  );
  const priced = trades.filter(trade => trade.price != null);
  const averagePrice = priced.length
    ? priced.reduce((sum, trade) => sum + (trade.price ?? 0), 0) / priced.length
    : null;
  const flaggedCount = trades.filter(trade => trade.flag != null).length;
  const summary = data?.executionSummary;
  const limitation =
    data?.limitation ??
    "正在检查地方债逐笔成交与执行质量合同；失败时不会回退到静态成交或其他地方债模块。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            DEAL
          </span>
          <span className="text-sm font-semibold text-white">
            地方债交易记录
          </span>
          <span className="text-xs text-gray-400">Municipal Trade History</span>
          <span className="rounded border border-slate-600 bg-slate-700/30 px-2 py-0.5 text-[10px] text-slate-400">
            {data?.dataStatus === "restricted" ? "未接入" : "检查中"}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex items-start gap-2 border-b border-amber-900/70 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-amber-300/70">
            {data?.dataContractId ?? "municipal-deal-trade-execution"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-gray-800">
        {[
          {
            label: "今日成交量",
            value: trades.length
              ? "$" + (totalVolume / 1000).toFixed(1) + "M"
              : "—",
            sub: trades.length ? trades.length + "笔" : "未接入逐笔成交",
          },
          {
            label: "加权平均价",
            value: decimal(averagePrice),
            sub: "只按接入成交计算",
          },
          {
            label: "异常交易",
            value: trades.length ? flaggedCount + "笔" : "—",
            sub: trades.length ? "以正式标记统计" : "未接入异常标记",
          },
          {
            label: "最新成交",
            value: decimal(trades.at(0)?.price),
            sub: trades.at(0)?.occurredAt ?? "未接入成交时间",
          },
        ].map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "border-r border-gray-800/60 px-3 py-2",
              index === 3 && "border-r-0"
            )}
          >
            <div className="text-[10px] text-gray-500">{metric.label}</div>
            <div className="font-mono text-sm font-bold text-white">
              {metric.value}
            </div>
            <div className="text-[10px] text-gray-500">{metric.sub}</div>
          </div>
        ))}
      </div>

      <nav className="flex shrink-0 border-b border-gray-800 bg-gray-900">
        {tabs.map(item => (
          <button
            type="button"
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "border-b-2 px-4 py-2 text-xs font-medium transition-colors",
              tab === item
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {item === "trades"
              ? "成交记录"
              : item === "intraday"
                ? "日内走势"
                : "执行分析"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "trades" && (
          <div>
            <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900/50 px-4 py-2">
              {["all", "flagged", "normal"].map(filter => (
                <button
                  type="button"
                  key={filter}
                  onClick={() => setFilterFlag(filter)}
                  className={cn(
                    "rounded border px-2.5 py-1 text-[10px]",
                    filterFlag === filter
                      ? "border-amber-500 bg-amber-500/20 text-amber-400"
                      : "border-gray-700 bg-gray-800 text-gray-400"
                  )}
                >
                  {filter === "all"
                    ? "全部"
                    : filter === "flagged"
                      ? "异常交易"
                      : "正常交易"}
                </button>
              ))}
            </div>
            {trades.length ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50">
                    {[
                      "时间",
                      "CUSIP",
                      "发行人",
                      "规模",
                      "成交价",
                      "收益率",
                      "方向",
                      "交易商",
                      "偏差",
                      "标记",
                    ].map(header => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-2 py-2 text-left font-normal text-gray-500"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(trade => (
                    <tr
                      key={trade.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="px-2 py-2 font-mono text-gray-400">
                        {trade.occurredAt}
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px] text-gray-500">
                        {trade.cusip}
                      </td>
                      <td className="px-2 py-2 text-[11px] font-semibold text-white">
                        {trade.issuer}
                      </td>
                      <td className="px-2 py-2 font-mono text-white">
                        {"$"}
                        {trade.sizeThousands.toFixed(0)}K
                      </td>
                      <td className="px-2 py-2 font-mono font-bold text-amber-400">
                        {decimal(trade.price)}
                      </td>
                      <td className="px-2 py-2 font-mono text-green-400">
                        {trade.yieldPct == null
                          ? "—"
                          : trade.yieldPct.toFixed(2) + "%"}
                      </td>
                      <td className="px-2 py-2 text-gray-300">
                        {trade.side ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-gray-300">
                        {trade.dealer ?? "—"}
                      </td>
                      <td className="px-2 py-2 font-mono text-gray-400">
                        {decimal(trade.deviationPoints)}
                      </td>
                      <td className="px-2 py-2 text-amber-400">
                        {trade.flag ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4">
                <EmptyState
                  title="成交记录未接入"
                  detail="需要合法授权的逐笔时间、CUSIP、成交规模、价格、收益率、方向和交易商字段。当前不使用固定成交或询价记录替代。"
                />
              </div>
            )}
          </div>
        )}

        {tab === "intraday" && (
          <div className="p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">
              地方债日内价格走势
            </h3>
            {intraday.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={intraday}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="occurredAt"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="price"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    domain={["auto", "auto"]}
                  />
                  <YAxis
                    yAxisId="volume"
                    orientation="right"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                    }}
                  />
                  <Bar
                    yAxisId="volume"
                    dataKey="volumeThousands"
                    fill="#374151"
                    name="成交量($K)"
                  />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="price"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    name="成交价"
                    connectNulls={false}
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="日内走势未接入"
                detail="需要同一 CUSIP 的逐笔成交时间、价格和成交量。当前不生成固定日内曲线，也不从其他债券拼接走势。"
              />
            )}
          </div>
        )}

        {tab === "analysis" && (
          <div className="space-y-4 p-4">
            <h3 className="text-sm font-semibold text-white">执行质量分析</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                [
                  "平均执行偏差",
                  summary?.averageDeviationPoints == null
                    ? "—"
                    : summary.averageDeviationPoints.toFixed(2) + "pts",
                  "需匹配成交与同刻基准",
                ],
                [
                  "最大单笔偏差",
                  summary?.maximumDeviationPoints == null
                    ? "—"
                    : summary.maximumDeviationPoints.toFixed(2) + "pts",
                  "只按接入成交计算",
                ],
                [
                  "买卖价差",
                  summary?.bidAskSpreadPoints == null
                    ? "—"
                    : summary.bidAskSpreadPoints.toFixed(2) + "pts",
                  "需双边同刻报价",
                ],
                [
                  "执行效率评分",
                  summary?.efficiencyScore == null
                    ? "—"
                    : summary.efficiencyScore.toFixed(0) + "/100",
                  "需完整执行评价样本",
                ],
              ].map(metric => (
                <div
                  key={metric[0]}
                  className="rounded border border-gray-800 bg-gray-900 p-3"
                >
                  <div className="text-[10px] text-gray-500">{metric[0]}</div>
                  <div className="mt-1 font-mono text-base font-bold text-white">
                    {metric[1]}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    {metric[2]}
                  </div>
                </div>
              ))}
            </div>
            {summary?.anomalyDetail ? (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400">
                    异常交易提醒
                  </span>
                </div>
                <p className="text-[10px] text-gray-300">
                  {summary.anomalyDetail}
                </p>
              </div>
            ) : (
              <EmptyState
                title="异常交易结论未接入"
                detail="缺少成交、同刻基准和可审计异常规则时，不生成偏差结论、持仓建议或执行评分。"
              />
            )}
          </div>
        )}

        <section className="m-4 overflow-hidden rounded-lg bg-[#111827] p-4 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">
              地方债交易执行质量分析仪
            </h2>
          </div>
          <div className="flex border-b border-gray-700 bg-[#0d1117]">
            {executionTabs.map(item => (
              <button
                type="button"
                key={item}
                onClick={() => setExecutionTab(item)}
                className={cn(
                  "border-b-2 px-4 py-2 text-xs",
                  executionTab === item
                    ? "border-blue-400 text-blue-400"
                    : "border-transparent text-gray-400"
                )}
              >
                {item === "quality"
                  ? "执行质量"
                  : item === "dealer"
                    ? "交易商得分"
                    : "成本分析"}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {executionTab === "quality" &&
              (data?.qualityHistory.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-white">
                    交易执行质量指标历史趋势
                  </h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.qualityHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                      <XAxis
                        dataKey="period"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="priceImprovementPct"
                        stroke="#3b82f6"
                        name="价格改善率"
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="executionSeconds"
                        stroke="#f59e0b"
                        name="成交速度"
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="quoteValidityPct"
                        stroke="#10b981"
                        name="报价有效期"
                        connectNulls={false}
                      />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="执行质量历史未接入"
                  detail="需要真实成交、委托、报价有效期和执行时间戳才能计算历史趋势；不使用固定月份样例。"
                />
              ))}

            {executionTab === "dealer" &&
              (data?.dealerScores.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-white">
                    交易商多维度得分
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={data.dealerScores}>
                      <PolarGrid stroke="#2d3748" />
                      <PolarAngleAxis
                        dataKey="dealer"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                      />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar
                        name="价格改善"
                        dataKey="priceImprovement"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.2}
                      />
                      <Radar
                        name="成交速度"
                        dataKey="executionSpeed"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.2}
                      />
                      <Radar
                        name="报价覆盖率"
                        dataKey="quoteCoverage"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.2}
                      />
                      <Radar
                        name="市场份额"
                        dataKey="marketShare"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.2}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                        }}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="交易商得分未接入"
                  detail="需要合法授权的交易商报价覆盖、成交速度、价格改善和市场份额样本；不显示固定机构排名。"
                />
              ))}

            {executionTab === "cost" &&
              (data?.costBreakdown.length ? (
                <div className="p-4">
                  <h3 className="mb-4 text-sm font-semibold text-white">
                    交易成本分析
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {data.costBreakdown.map(item => (
                      <div
                        key={item.metric}
                        className="rounded border border-gray-800 bg-gray-900 p-3"
                      >
                        <div className="text-[10px] text-gray-500">
                          {item.metric}
                        </div>
                        <div className="mt-1 font-mono text-base font-bold text-white">
                          {item.valuePct == null
                            ? "—"
                            : item.valuePct.toFixed(3) + "%"}
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-500">
                          {item.description ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-400">
                    总交易成本是衡量交易效率的关键指标，通过分析各项成本构成，可以优化交易策略，降低投资摩擦。
                  </p>
                </div>
              ) : (
                <EmptyState
                  title="成本分析未接入"
                  detail="需要订单、成交、费用、基准与市场冲击字段才能拆分显性和隐性成本；不使用固定百分比。"
                />
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

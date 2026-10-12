import { useState } from "react";
import { AlertTriangle, Database, Shield, TrendingUp, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CustomCursor, EnhancedTooltip } from "@/components/ChartEnhancements";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface Props {
  onClose?: () => void;
}

const ACCENT = "#f59e0b";
const overviewTabs = ["stats", "issuers", "compliance"] as const;
const depthTabs = ["activity", "tradeType", "concentration"] as const;
const metricLabels = [
  "日均成交量",
  "日均成交笔数",
  "平均成交规模",
  "当月发行量",
] as const;
const metricColors = [
  "text-amber-400",
  "text-blue-400",
  "text-white",
  "text-green-400",
] as const;
const pieColors = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"];

const emptyCopy = {
  stats:
    "需要获准的一级发行统计、二级成交汇总与交易类型数据。当前不使用 SLGS 活动或其他地方债页面的数字替代。",
  issuers:
    "需要同一统计期的发行人、发行规模和发行笔数。当前没有可核验排名，不生成州别或发行人名次。",
  compliance:
    "需要获准的合规事件、证券标识、严重程度与处置状态。当前不生成告警、调查结论或报告状态。",
  activity:
    "需要连续统计期内的成交金额与交易笔数。当前没有可核验时间序列，不用固定历史曲线填充。",
  tradeType:
    "需要同一口径的客户买入、客户卖出、交易商间等分类统计。当前不推导虚构分布。",
  concentration:
    "需要获准的交易商份额和市场集中度统计。当前不生成前五、前十或 HHI 数值。",
} as const;

function EmptyData({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
      <Database className="mx-auto h-7 w-7 text-slate-600" />
      <h4 className="mt-3 text-sm font-semibold text-slate-200">{title}</h4>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function formatMetric(value: number, unit: string) {
  if (unit === "USD_B") return `$${value.toLocaleString()}B`;
  if (unit === "USD_K") return `$${value.toLocaleString()}K`;
  if (unit === "PCT") return `${value.toLocaleString()}%`;
  return value.toLocaleString();
}

export default function MSRBPanel({ onClose }: Props) {
  const [view, setView] = useState<(typeof overviewTabs)[number]>("stats");
  const [activeTab, setActiveTab] =
    useState<(typeof depthTabs)[number]>("activity");
  const status = trpc.municipalResearch.getMsrbMarketStatisticsStatus.useQuery(
    undefined,
    {
      staleTime: 60_000,
      refetchInterval: 60_000,
    }
  );
  const data = status.data;
  const limitation =
    data?.limitation ??
    "正在检查市政债市场统计数据契约；检查失败时不会回退到静态样例或其他市场数据。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            MSRB
          </span>
          <span className="text-sm font-semibold text-white">
            市政债券监管委员会统计
          </span>
          <span className="ml-2 text-[10px] text-gray-500">
            Municipal Securities Rulemaking Board
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-gray-700">
            {overviewTabs.map(tab => (
              <button
                type="button"
                key={tab}
                onClick={() => setView(tab)}
                className={cn(
                  "px-3 py-1 text-xs transition-colors",
                  view === tab
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                {tab === "stats"
                  ? "市场统计"
                  : tab === "issuers"
                    ? "发行人排名"
                    : "合规监控"}
              </button>
            ))}
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
        </div>
      </div>

      <div className="flex items-start gap-2 border-b border-amber-900/70 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-amber-300/70">
            {data?.dataContractId ?? "municipal-msrb-market-statistics"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-gray-800 bg-gray-900/50 px-4 py-2">
        {metricLabels.map((label, index) => {
          const metric = data?.marketStats.find(item => item.label === label);
          return (
            <div key={label} className="rounded bg-gray-800/60 p-2 text-center">
              <div
                className={cn(
                  "font-mono text-base font-bold",
                  metric ? metricColors[index] : "text-slate-500"
                )}
              >
                {metric ? formatMetric(metric.value, metric.unit) : "—"}
              </div>
              <div className="text-[9px] text-gray-500">{label}</div>
              <div
                className={cn(
                  "font-mono text-[9px]",
                  metric?.changePct != null && metric.changePct >= 0
                    ? "text-green-400"
                    : metric?.changePct != null
                      ? "text-red-400"
                      : "text-slate-600"
                )}
              >
                {metric?.changePct == null
                  ? "—"
                  : `${metric.changePct >= 0 ? "+" : ""}${metric.changePct.toFixed(1)}%`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {view === "stats" && (
          <div className="space-y-4">
            <section className="rounded border border-gray-800 bg-gray-900 p-3">
              <h3 className="mb-3 text-xs font-semibold text-gray-300">
                月度发行量 vs 二级市场成交量（$B）
              </h3>
              {data?.monthlyVolume.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.monthlyVolume} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <Tooltip
                      content={<EnhancedTooltip />}
                      cursor={CustomCursor}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar
                      dataKey="primaryVolumeBillions"
                      name="一级市场($B)"
                      fill="#f59e0b"
                    />
                    <Bar
                      dataKey="secondaryVolumeBillions"
                      name="二级市场($B)"
                      fill="#3b82f6"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyData
                  title="月度市场统计未接入"
                  detail={emptyCopy.stats}
                />
              )}
            </section>

            <div className="grid grid-cols-2 gap-3">
              <section className="rounded border border-gray-800 bg-gray-900 p-3">
                <h3 className="mb-3 text-xs font-semibold text-gray-300">
                  交易类型分布
                </h3>
                <table className="w-full text-[11px]">
                  <thead className="border-b border-gray-800">
                    <tr>
                      {["类型", "笔数", "成交量($B)", "均值($K)"].map(
                        header => (
                          <th
                            key={header}
                            className="px-2 py-1.5 text-left font-medium text-gray-400"
                          >
                            {header}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.tradeTypes.map(row => (
                      <tr
                        key={row.type}
                        className="border-b border-gray-800/50"
                      >
                        <td className="px-2 py-1.5 font-semibold text-white">
                          {row.type}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-gray-300">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 font-mono font-bold text-amber-400">
                          {row.volumeBillions}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-blue-400">
                          {row.averageSizeThousands}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data?.tradeTypes.length && (
                  <p className="py-5 text-center text-xs text-slate-500">
                    暂无可核验交易类型统计
                  </p>
                )}
              </section>
              <section className="rounded border border-gray-800 bg-gray-900 p-3">
                <h3 className="mb-2 text-xs font-semibold text-gray-300">
                  市场透明度指标
                </h3>
                {data?.transparency.length ? (
                  <div className="space-y-2">
                    {data.transparency.map((item, index) => (
                      <div key={item.label}>
                        <div className="mb-0.5 flex justify-between text-[10px]">
                          <span className="text-gray-400">{item.label}</span>
                          <span
                            className="font-mono font-bold"
                            style={{
                              color: pieColors[index % pieColors.length],
                            }}
                          >
                            {item.valuePct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, item.valuePct))}%`,
                              backgroundColor:
                                pieColors[index % pieColors.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-5 text-center text-xs text-slate-500">
                    暂无可核验透明度指标
                  </p>
                )}
              </section>
            </div>
          </div>
        )}

        {view === "issuers" && (
          <section className="overflow-hidden rounded border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-3 py-2 text-xs font-semibold text-gray-300">
              发行人排名（按发行规模）
            </div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-gray-800 bg-gray-900/80">
                <tr>
                  {[
                    "排名",
                    "州",
                    "发行人",
                    "发行规模($B)",
                    "发行笔数",
                    "平均规模($M)",
                  ].map(header => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left font-medium text-gray-400"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.issuers.map((issuer, index) => (
                  <tr
                    key={`${issuer.rank}-${issuer.name}`}
                    className={cn(
                      "border-b border-gray-800/50 hover:bg-gray-800/50",
                      index % 2 === 0 ? "bg-gray-950" : "bg-gray-900/30"
                    )}
                  >
                    <td className="px-3 py-2 font-mono font-bold text-amber-400">
                      #{issuer.rank}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-blue-400">
                      {issuer.state}
                    </td>
                    <td className="px-3 py-2 font-semibold text-white">
                      {issuer.name}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">
                      {issuer.amountBillions.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-300">
                      {issuer.count}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-400">
                      {issuer.averageSizeMillions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.issuers.length && (
              <EmptyData title="发行人排名未接入" detail={emptyCopy.issuers} />
            )}
          </section>
        )}

        {view === "compliance" && (
          <section className="overflow-hidden rounded border border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
              <Shield className="h-3 w-3 text-amber-400" />
              <span className="text-xs font-semibold text-gray-300">
                近期合规事件监控
              </span>
            </div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-gray-800 bg-gray-900/80">
                <tr>
                  {[
                    "日期",
                    "事件类型",
                    "发行人",
                    "CUSIP",
                    "详情",
                    "严重程度",
                    "状态",
                  ].map(header => (
                    <th
                      key={header}
                      className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-400"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.complianceEvents.map(event => (
                  <tr
                    key={`${event.date}-${event.type}-${event.issuer}`}
                    className="border-b border-gray-800/50 hover:bg-gray-800/50"
                  >
                    <td className="px-3 py-2 font-mono text-gray-400">
                      {event.date}
                    </td>
                    <td className="px-3 py-2 font-semibold text-white">
                      {event.type}
                    </td>
                    <td className="max-w-[120px] truncate px-3 py-2 text-gray-300">
                      {event.issuer}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-400">
                      {event.cusip ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-gray-400">
                      {event.detail}
                    </td>
                    <td className="px-3 py-2 text-gray-300">
                      {event.severity}
                    </td>
                    <td className="px-3 py-2 text-gray-300">{event.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.complianceEvents.length && (
              <EmptyData title="合规事件未接入" detail={emptyCopy.compliance} />
            )}
          </section>
        )}
      </div>

      <div className="border-t border-gray-800 bg-[#111827] p-4">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-bold text-purple-400">
            MSRB市场活跃度全景仪
          </h3>
        </div>
        <div className="mb-4 flex overflow-hidden rounded border border-gray-700">
          {depthTabs.map(tab => (
            <button
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1 text-xs transition-colors",
                activeTab === tab
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              {tab === "activity"
                ? "市场活跃度"
                : tab === "tradeType"
                  ? "交易类型"
                  : "市场集中度"}
            </button>
          ))}
        </div>

        {activeTab === "activity" && (
          <section className="rounded border border-gray-800 bg-gray-900 p-3">
            <h4 className="mb-3 text-xs font-semibold text-gray-300">
              MSRB市场成交量历史趋势
            </h4>
            {data?.activityTrend.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.activityTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#f59e0b"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#3b82f6"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                  />
                  <Tooltip
                    content={<EnhancedTooltip />}
                    cursor={CustomCursor}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="volumeBillions"
                    name="日成交金额 ($B)"
                    fill="#f59e0b"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="transactions"
                    name="交易笔数"
                    stroke="#3b82f6"
                    activeDot={{ r: 8 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyData title="市场活跃度未接入" detail={emptyCopy.activity} />
            )}
          </section>
        )}

        {activeTab === "tradeType" && (
          <section className="rounded border border-gray-800 bg-gray-900 p-3">
            <h4 className="mb-3 text-xs font-semibold text-gray-300">
              地方债交易类型分布
            </h4>
            {data?.tradeTypeDistribution.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.tradeTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="count"
                    nameKey="name"
                  >
                    {data.tradeTypeDistribution.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<EnhancedTooltip />}
                    cursor={CustomCursor}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyData
                title="交易类型分布未接入"
                detail={emptyCopy.tradeType}
              />
            )}
          </section>
        )}

        {activeTab === "concentration" && (
          <section className="rounded border border-gray-800 bg-gray-900 p-3">
            <h4 className="mb-2 text-xs font-semibold text-gray-300">
              市场集中度指标
            </h4>
            {data?.concentration.length ? (
              <div className="space-y-2">
                {data.concentration.map((item, index) => (
                  <div key={item.label}>
                    <div className="mb-0.5 flex justify-between text-[10px]">
                      <span className="text-gray-400">{item.label}</span>
                      <span
                        className="font-mono font-bold"
                        style={{ color: pieColors[index % pieColors.length] }}
                      >
                        {formatMetric(item.value, item.unit)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, item.unit === "PCT" ? item.value : item.value / 100))}%`,
                          backgroundColor: pieColors[index % pieColors.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyData
                title="市场集中度未接入"
                detail={emptyCopy.concentration}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

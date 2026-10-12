import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, Database, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
const tabs = ["calendar", "managers", "premium", "detail"] as const;
const filters = ["all", "Priced", "Roadshow", "Announced"] as const;

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="m-4 rounded border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
      <Database className="mx-auto h-7 w-7 text-slate-600" />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function statusColor(status: string) {
  if (status === "Priced")
    return "border-green-500/30 bg-green-500/20 text-green-400";
  if (status === "Roadshow")
    return "border-blue-500/30 bg-blue-500/20 text-blue-400";
  return "border-gray-600 bg-gray-700/50 text-gray-400";
}

export default function CDRNPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("calendar");
  const [filterStatus, setFilterStatus] =
    useState<(typeof filters)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const status =
    trpc.municipalResearch.getCdrnNegotiatedCalendarStatus.useQuery(undefined, {
      staleTime: 60_000,
      refetchInterval: 60_000,
    });
  const data = status.data;
  const events = data?.events ?? [];
  const filtered = useMemo(
    () =>
      events.filter(
        event => filterStatus === "all" || event.status === filterStatus
      ),
    [events, filterStatus]
  );
  const selected = events.find(event => event.id === selectedId) ?? null;
  const totalSize = events.reduce((sum, event) => sum + event.sizeMillions, 0);
  const completedBooks = events
    .map(event => event.bidCover)
    .filter((value): value is number => value != null);
  const averageBidCover = completedBooks.length
    ? completedBooks.reduce((sum, value) => sum + value, 0) /
      completedBooks.length
    : null;
  const limitation =
    data?.limitation ??
    "正在检查商议承销数据契约；失败时不会回退到 PICK 日历、静态承销商或预测值。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            CDRN
          </span>
          <span className="text-sm font-semibold text-white">商议承销日程</span>
          <span className="text-xs text-gray-400">
            Negotiated Underwriting Calendar
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
            {data?.dataContractId ?? "municipal-cdrn-negotiated-calendar"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-gray-800">
        {[
          {
            label: "本周商议承销",
            value: events.length ? `${events.length}笔` : "—",
            sub: events.length
              ? `$${(totalSize / 1000).toFixed(1)}B`
              : "无可核验项目",
          },
          {
            label: "已定价平均认购",
            value:
              averageBidCover == null ? "—" : `${averageBidCover.toFixed(1)}x`,
            sub: "仅统计已接入簿记结果",
          },
          {
            label: "路演中",
            value: events.some(event => event.status === "Roadshow")
              ? `${events.filter(event => event.status === "Roadshow").length}笔`
              : "—",
            sub: "无可核验路演项目",
          },
          {
            label: "平均历史溢价",
            value: "—",
            sub: "需同口径新券与二级参照",
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
            {item === "calendar"
              ? "承销日历"
              : item === "managers"
                ? "承销商排名"
                : item === "premium"
                  ? "溢价趋势"
                  : "交易详情"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "calendar" && (
          <div>
            <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900/50 px-4 py-2">
              {filters.map(filter => (
                <button
                  type="button"
                  key={filter}
                  onClick={() => setFilterStatus(filter)}
                  className={cn(
                    "rounded border px-2.5 py-1 text-[10px] transition-colors",
                    filterStatus === filter
                      ? "border-amber-500 bg-amber-500/20 text-amber-400"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
                  )}
                >
                  {filter === "all" ? "全部" : filter}
                </button>
              ))}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  {[
                    "日期",
                    "发行人",
                    "规模",
                    "承销商",
                    "评级",
                    "状态",
                    "路演天数",
                    "超额预测",
                    "历史溢价",
                  ].map(header => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left font-normal text-gray-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(event => (
                  <tr
                    key={event.id}
                    onClick={() => {
                      setSelectedId(event.id);
                      setTab("detail");
                    }}
                    className="cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-gray-800/40"
                  >
                    <td className="px-3 py-2 font-mono text-gray-400">
                      {event.date}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-white">
                        {event.issuer}
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {event.state} · {event.purpose ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-white">
                      ${event.sizeMillions}M
                    </td>
                    <td className="px-3 py-2 text-gray-300">
                      {event.manager ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-blue-400">
                      {event.rating ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-[10px]",
                          statusColor(event.status)
                        )}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-300">
                      {event.roadshowDays == null
                        ? "—"
                        : `${event.roadshowDays}天`}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-300">
                      {event.oversubscriptionEstimate == null
                        ? "—"
                        : `${event.oversubscriptionEstimate.toFixed(1)}x`}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-300">
                      {event.historicalPremiumBps == null
                        ? "—"
                        : `${event.historicalPremiumBps}bps`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <EmptyState
                title="商议承销日程未接入"
                detail="需要获准的商议发行、主承销商、路演状态与簿记进度。当前不复制 PICK 的发行项目，也不生成认购预测。"
              />
            )}
          </div>
        )}

        {tab === "managers" && (
          <div className="p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">
              承销商排名
            </h3>
            {data?.managerRankings.length ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.managerRankings} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      type="number"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111827",
                        border: "1px solid #374151",
                      }}
                    />
                    <Bar
                      dataKey="volumeMillions"
                      fill="#f59e0b"
                      name="承销规模($M)"
                    />
                  </BarChart>
                </ResponsiveContainer>
                <table className="mt-4 w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        "承销商",
                        "交易数",
                        "承销规模",
                        "平均超额认购",
                        "平均历史溢价",
                      ].map(header => (
                        <th
                          key={header}
                          className="px-3 py-2 text-left font-normal text-gray-500"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.managerRankings.map(manager => (
                      <tr
                        key={manager.name}
                        className="border-b border-gray-800/50"
                      >
                        <td className="px-3 py-2 font-semibold text-white">
                          {manager.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-300">
                          {manager.deals}
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-400">
                          ${manager.volumeMillions}M
                        </td>
                        <td className="px-3 py-2 font-mono text-green-400">
                          {manager.averageOversubscription == null
                            ? "—"
                            : `${manager.averageOversubscription.toFixed(1)}x`}
                        </td>
                        <td className="px-3 py-2 font-mono text-blue-400">
                          {manager.averagePremiumBps == null
                            ? "—"
                            : `${manager.averagePremiumBps}bps`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <EmptyState
                title="承销商排名未接入"
                detail="需要同一统计期的正式主承销角色、项目数、承销规模与簿记结果。当前不生成机构名称或排名。"
              />
            )}
          </div>
        )}

        {tab === "premium" && (
          <div className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">
              新发行溢价趋势
            </h3>
            <p className="mb-4 text-[10px] text-gray-400">
              溢价必须由同期限、评级、结构和观察时点的可核验二级参照计算。
            </p>
            {data?.premiumTrend.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.premiumTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
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
                    yAxisId="left"
                    dataKey="premiumBps"
                    fill="#ef4444"
                    fillOpacity={0.6}
                    name="新发行溢价(bps)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="oversubscription"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    name="超额认购(x)"
                  />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="新发行溢价趋势未接入"
                detail="需要真实新券最终定价、可比二级市场收益率与簿记结果。当前不生成趋势、需求强弱或投资建议。"
              />
            )}
          </div>
        )}

        {tab === "detail" &&
          (selected ? (
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selected.issuer}
                  </h3>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {selected.state} · {selected.purpose ?? "—"} · 商议承销
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded border px-2 py-1 text-xs",
                    statusColor(selected.status)
                  )}
                >
                  {selected.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["发行规模", `$${selected.sizeMillions}M`],
                  [
                    "票面利率",
                    selected.couponPct == null ? "—" : `${selected.couponPct}%`,
                  ],
                  ["到期日", selected.maturity ?? "—"],
                  ["评级", selected.rating ?? "—"],
                  ["税务状态", selected.taxStatus ?? "—"],
                  ["赎回日", selected.callDate ?? "—"],
                  ["主承销商", selected.manager ?? "—"],
                  [
                    "路演天数",
                    selected.roadshowDays == null
                      ? "—"
                      : `${selected.roadshowDays}天`,
                  ],
                  ["价格指导", selected.priceGuidance ?? "—"],
                  [
                    "超额认购预测",
                    selected.oversubscriptionEstimate == null
                      ? "—"
                      : `${selected.oversubscriptionEstimate.toFixed(1)}x`,
                  ],
                  [
                    "历史溢价",
                    selected.historicalPremiumBps == null
                      ? "—"
                      : `${selected.historicalPremiumBps}bps`,
                  ],
                  [
                    "最终收益率",
                    selected.finalYieldPct == null
                      ? "—"
                      : `${selected.finalYieldPct.toFixed(2)}%`,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded border border-gray-800 bg-gray-900 p-2"
                  >
                    <div className="text-[10px] text-gray-500">{label}</div>
                    <div className="mt-0.5 font-mono text-sm text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded border border-gray-800 bg-gray-900 p-3">
                <div className="mb-2 text-xs font-semibold text-white">
                  认购结构分布
                </div>
                {selected.retailOrderPct == null ||
                selected.institutionalOrderPct == null ? (
                  <p className="text-[10px] text-slate-500">
                    暂无获准的零售/机构订单结构。
                  </p>
                ) : (
                  <>
                    <div className="flex h-4 overflow-hidden rounded">
                      <div
                        className="bg-amber-500"
                        style={{ width: `${selected.retailOrderPct}%` }}
                      />
                      <div
                        className="bg-blue-500"
                        style={{ width: `${selected.institutionalOrderPct}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px]">
                      <span className="text-amber-400">
                        零售 {selected.retailOrderPct}%
                      </span>
                      <span className="text-blue-400">
                        机构 {selected.institutionalOrderPct}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              title="交易详情未接入"
              detail="请先从真实商议承销日程选择一项记录。当前没有项目，不生成承销商、路演、簿记或定价详情。"
            />
          ))}
      </div>
    </div>
  );
}

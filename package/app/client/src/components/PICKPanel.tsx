import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, Database, X } from "lucide-react";
import {
  Area,
  Bar,
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
const tabs = ["calendar", "volume", "pricing", "detail"] as const;
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

export default function PICKPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("calendar");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] =
    useState<(typeof filters)[number]>("all");
  const status = trpc.municipalResearch.getPickNewIssuanceStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = status.data;
  const issues = data?.issues ?? [];
  const filtered = useMemo(
    () =>
      issues.filter(
        issue => filterStatus === "all" || issue.status === filterStatus
      ),
    [filterStatus, issues]
  );
  const selected = issues.find(issue => issue.id === selectedId) ?? null;
  const totalWeek = issues.reduce((sum, issue) => sum + issue.sizeMillions, 0);
  const priced = issues.filter(issue => issue.status === "Priced");
  const roadshow = issues.filter(issue => issue.status === "Roadshow");
  const subscriptions = priced
    .map(issue => issue.oversubscribed)
    .filter((value): value is number => value != null);
  const averageOversubscription = subscriptions.length
    ? subscriptions.reduce((sum, value) => sum + value, 0) /
      subscriptions.length
    : null;
  const limitation =
    data?.limitation ??
    "正在检查地方债新发行数据契约；检查失败时不会回退到静态发行日历或其他债券数据。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            PICK
          </span>
          <span className="text-sm font-semibold text-white">
            地方债发行日历
          </span>
          <span className="text-xs text-gray-400">
            New Issue Calendar &amp; Pricing
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
            {data?.dataContractId ?? "municipal-pick-new-issuance"} · 最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-gray-800">
        {[
          {
            label: "本周发行总量",
            value: issues.length ? `$${(totalWeek / 1000).toFixed(1)}B` : "—",
            sub: issues.length ? `${issues.length}笔交易` : "无可核验发行记录",
          },
          {
            label: "已定价",
            value: priced.length ? `${priced.length}笔` : "—",
            sub: priced.length
              ? `$${priced.reduce((sum, issue) => sum + issue.sizeMillions, 0)}M`
              : "无可核验定价结果",
          },
          {
            label: "平均超额认购",
            value:
              averageOversubscription == null
                ? "—"
                : `${averageOversubscription.toFixed(1)}x`,
            sub: "仅统计已接入簿记结果",
          },
          {
            label: "路演中",
            value: roadshow.length ? `${roadshow.length}笔` : "—",
            sub: "无可核验待定价项目",
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
              ? "发行日历"
              : item === "volume"
                ? "发行量趋势"
                : item === "pricing"
                  ? "定价分析"
                  : "交易详情"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "calendar" && (
          <div className="h-full overflow-auto">
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
                    "类型",
                    "评级",
                    "状态",
                    "超额认购",
                    "最终收益率",
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
                {filtered.map(issue => (
                  <tr
                    key={issue.id}
                    onClick={() => {
                      setSelectedId(issue.id);
                      setTab("detail");
                    }}
                    className="cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-gray-800/40"
                  >
                    <td className="px-3 py-2 font-mono text-gray-400">
                      {issue.date}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-white">
                        {issue.issuer}
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {issue.state} · {issue.sector ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-white">
                      ${issue.sizeMillions}M
                    </td>
                    <td className="px-3 py-2 text-gray-300">{issue.type}</td>
                    <td className="px-3 py-2 font-mono text-blue-400">
                      {issue.rating ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-[10px]",
                          statusColor(issue.status)
                        )}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-300">
                      {issue.oversubscribed == null
                        ? "—"
                        : `${issue.oversubscribed.toFixed(1)}x`}
                    </td>
                    <td className="px-3 py-2 font-mono text-green-400">
                      {issue.finalYieldPct == null
                        ? (issue.priceGuidance ?? "—")
                        : `${issue.finalYieldPct.toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <EmptyState
                title="地方债发行日历未接入"
                detail="需要获准的新发行公告、发行人、规模、期限、评级和状态。当前不使用国债拍卖或 SLGS 认购活动冒充地方债发行。"
              />
            )}
          </div>
        )}

        {tab === "volume" && (
          <div className="p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">
              周度发行量与超额认购趋势
            </h3>
            {data?.weeklyVolume.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data.weeklyVolume}>
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
                    dataKey="volumeBillions"
                    fill="#f59e0b"
                    fillOpacity={0.7}
                    name="发行量($B)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="averageOversubscription"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="平均超额认购(x)"
                  />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="发行量趋势未接入"
                detail="需要按周汇总的地方债发行规模、项目数与同口径簿记认购结果。当前不生成固定趋势或推算同比。"
              />
            )}
          </div>
        )}

        {tab === "pricing" && (
          <div className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">
              定价让步分析（Pricing Concession）
            </h3>
            <p className="mb-4 text-[10px] text-gray-400">
              最终定价 vs
              初始指导价差异，负值表示最终收益率低于指导（发行人受益）
            </p>
            {data?.pricingHistory.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data.pricingHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
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
                  <Area
                    type="monotone"
                    dataKey="guidanceYieldPct"
                    stroke="#6b7280"
                    fill="#6b7280"
                    fillOpacity={0.1}
                    name="指导价"
                  />
                  <Line
                    type="monotone"
                    dataKey="finalYieldPct"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    name="最终定价"
                  />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="定价分析未接入"
                detail="需要同一发行项目的初始指导、最终收益率与定价时间。数据不足时不发布认购热度、报价缓冲或二级溢价建议。"
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
                    {selected.state} · {selected.sector ?? "—"} ·{" "}
                    {selected.type}
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
                  ["价格指导", selected.priceGuidance ?? "—"],
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
                  发行目的
                </div>
                <p className="text-[10px] text-gray-400">
                  {selected.purpose ?? "—"}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              title="交易详情未接入"
              detail="请先从已接入的发行日历选择一项真实发行记录。当前没有记录，不生成发行人、承销商、评级、认购或收益率详情。"
            />
          ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { AlertTriangle, Award, BarChart2, Database, X } from "lucide-react";
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

const ACCENT = "#3b82f6";
const tabs = ["calendar", "competition", "detail"] as const;

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
  if (status === "Awarded")
    return "border-green-500/30 bg-green-500/20 text-green-400";
  if (status === "Pending")
    return "border-amber-500/30 bg-amber-500/20 text-amber-400";
  return "border-gray-600 bg-gray-700/50 text-gray-400";
}

export default function CDRCPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("calendar");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const status =
    trpc.municipalResearch.getCdrcCompetitiveCalendarStatus.useQuery(
      undefined,
      { staleTime: 60_000, refetchInterval: 60_000 }
    );
  const data = status.data;
  const events = data?.events ?? [];
  const selected = events.find(event => event.id === selectedId) ?? null;
  const totalSize = events.reduce((sum, event) => sum + event.sizeMillions, 0);
  const bidderValues = events
    .map(event => event.bidderCount)
    .filter((value): value is number => value != null);
  const averageBidders = bidderValues.length
    ? bidderValues.reduce((sum, value) => sum + value, 0) / bidderValues.length
    : null;
  const spreadValues = events
    .map(event => event.winningSpreadBps)
    .filter((value): value is number => value != null);
  const averageSpread = spreadValues.length
    ? spreadValues.reduce((sum, value) => sum + value, 0) / spreadValues.length
    : null;
  const limitation =
    data?.limitation ??
    "正在检查竞价承销数据契约；失败时不会回退到商议承销或静态竞价样例。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            CDRC
          </span>
          <span className="text-sm font-semibold text-white">竞价承销日程</span>
          <span className="text-xs text-gray-400">
            Competitive Underwriting Calendar
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

      <div className="flex items-start gap-2 border-b border-blue-900/70 bg-blue-950/20 px-4 py-3 text-xs text-blue-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-blue-300/70">
            {data?.dataContractId ?? "municipal-cdrc-competitive-calendar"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-gray-800">
        {[
          {
            label: "本周竞价承销",
            value: events.length ? `${events.length}笔` : "—",
            sub: events.length
              ? `$${(totalSize / 1000).toFixed(1)}B`
              : "无可核验项目",
          },
          {
            label: "平均竞价商数",
            value:
              averageBidders == null ? "—" : `${averageBidders.toFixed(1)}家`,
            sub: "仅统计真实投标",
          },
          {
            label: "平均中标利差",
            value:
              averageSpread == null ? "—" : `${averageSpread.toFixed(1)}bps`,
            sub: "第1名 vs 第2名",
          },
          { label: "市场竞争指数", value: "—", sub: "需要完整竞价样本" },
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
                ? "border-blue-400 text-blue-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {item === "calendar"
              ? "竞价日历"
              : item === "competition"
                ? "竞争分析"
                : "中标详情"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "calendar" && (
          <div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  {[
                    "日期",
                    "发行人",
                    "规模",
                    "评级",
                    "竞价商数",
                    "中标方",
                    "中标收益率",
                    "利差",
                    "状态",
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
                {events.map(event => (
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
                    <td className="px-3 py-2 font-mono text-blue-400">
                      {event.rating ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-white">
                      {event.bidderCount == null
                        ? "—"
                        : `${event.bidderCount}家`}
                    </td>
                    <td className="px-3 py-2 text-gray-300">
                      {event.winner ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-green-400">
                      {event.winningYieldPct == null
                        ? "—"
                        : `${event.winningYieldPct.toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2 font-mono text-amber-400">
                      {event.winningSpreadBps == null
                        ? "—"
                        : `${event.winningSpreadBps}bps`}
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
                  </tr>
                ))}
              </tbody>
            </table>
            {!events.length && (
              <EmptyState
                title="竞价日历未接入"
                detail="需要获准的竞价公告、投标数量、中标方与结果字段。当前不复制 CDRN 商议承销或国债拍卖。"
              />
            )}
          </div>
        )}

        {tab === "competition" && (
          <div className="p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">
              竞价竞争度趋势
            </h3>
            {data?.competitionTrend.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.competitionTrend}>
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
                    dataKey="averageBidders"
                    fill="#3b82f6"
                    fillOpacity={0.7}
                    name="平均竞价商数"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="averageSpreadBps"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="平均利差(bps)"
                  />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="竞争分析未接入"
                detail="需要连续竞价统计期的投标数量、获胜/次优收益率和竞价价差。当前不生成趋势、竞争度或流动性结论。"
              />
            )}
          </div>
        )}

        {tab === "detail" &&
          (selected ? (
            <div className="space-y-4 p-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  {selected.issuer}
                </h3>
                <div className="mt-0.5 text-xs text-gray-400">
                  {selected.state} · {selected.purpose ?? "—"} · 竞价承销
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["发行规模", `$${selected.sizeMillions}M`],
                  ["评级", selected.rating ?? "—"],
                  ["税务状态", selected.taxStatus ?? "—"],
                  [
                    "竞价商数",
                    selected.bidderCount == null
                      ? "—"
                      : `${selected.bidderCount}家`,
                  ],
                  ["竞争度", selected.competitiveness ?? "—"],
                  ["报价区间", selected.bidRange ?? "—"],
                  ["中标方", selected.winner ?? "—"],
                  [
                    "中标收益率",
                    selected.winningYieldPct == null
                      ? "—"
                      : `${selected.winningYieldPct.toFixed(2)}%`,
                  ],
                  [
                    "第2名收益率",
                    selected.secondYieldPct == null
                      ? "—"
                      : `${selected.secondYieldPct.toFixed(2)}%`,
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
              {selected.winningSpreadBps != null && selected.winner && (
                <div className="rounded border border-green-500/30 bg-green-500/10 p-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-green-400" />
                    <span className="text-xs font-semibold text-green-400">
                      竞价结果：中标利差 {selected.winningSpreadBps}bps
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-300">
                    中标方 {selected.winner} 的正式结果已接入。
                  </p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="中标详情未接入"
              detail="请先从真实竞价日历选择一项记录。当前不生成中标方、收益率、次优报价或竞争结论。"
            />
          ))}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { AlertCircle, Calendar, Database, Filter, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
const views = ["list", "calendar", "analytics"] as const;

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

function statusTone(status: string | null) {
  if (status === "Priced") return "bg-green-500/20 text-green-400";
  if (status === "Pricing") return "bg-amber-500/20 text-amber-400";
  if (status === "Postponed") return "bg-red-500/20 text-red-400";
  return "bg-blue-500/20 text-blue-400";
}

function typeColor(type: string | null) {
  if (type === "Competitive") return "#3b82f6";
  if (type === "Short-term") return "#8b5cf6";
  return "#f59e0b";
}

export default function MCALPanel({ onClose }: Props) {
  const [view, setView] = useState<(typeof views)[number]>("list");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [filterTax, setFilterTax] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = trpc.municipalResearch.getMcalStructuredCalendarStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = query.data;
  const events = data?.events ?? [];
  const filtered = useMemo(
    () =>
      events.filter(event => {
        if (filterType !== "all" && event.dealType !== filterType) return false;
        if (filterStatus !== "all" && event.status !== filterStatus)
          return false;
        if (filterState !== "all" && event.state !== filterState) return false;
        if (filterTax !== "all" && event.taxStatus !== filterTax) return false;
        return true;
      }),
    [events, filterState, filterStatus, filterTax, filterType]
  );
  const states = Array.from(
    new Set(events.map(event => event.state).filter(Boolean))
  ).sort();
  const selected = events.find(event => event.id === selectedId) ?? null;
  const knownAmounts = filtered.filter(event => event.amountMillions != null);
  const totalVolume = knownAmounts.reduce(
    (sum, event) => sum + (event.amountMillions ?? 0),
    0
  );
  const knownSpreads = filtered.filter(
    event => event.benchmarkSpreadBps != null
  );
  const averageSpread = knownSpreads.length
    ? knownSpreads.reduce(
        (sum, event) => sum + (event.benchmarkSpreadBps ?? 0),
        0
      ) / knownSpreads.length
    : null;
  const calendarDates = Array.from(
    new Set(filtered.map(event => event.issuanceDate))
  )
    .sort()
    .slice(0, 5);
  const limitation =
    data?.limitation ??
    "正在检查市政结构融资发行日历合同；失败时不会回退到其他发行页面或静态日历。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            MCAL
          </span>
          <span className="text-sm font-semibold text-white">结构金融日历</span>
          <span className="ml-2 text-[10px] text-gray-500">
            Municipal New Issue Calendar
          </span>
          <span className="rounded border border-slate-600 bg-slate-700/30 px-2 py-0.5 text-[10px] text-slate-400">
            {data?.dataStatus === "restricted" ? "未接入" : "检查中"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-gray-700">
            {views.map(item => (
              <button
                type="button"
                key={item}
                onClick={() => setView(item)}
                className={cn(
                  "px-3 py-1 text-xs",
                  view === item
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                {item === "list"
                  ? "列表"
                  : item === "calendar"
                    ? "日历"
                    : "分析"}
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
      </header>

      <div className="flex items-start gap-2 border-b border-amber-900/70 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-amber-300/70">
            {data?.dataContractId ?? "municipal-mcal-structured-calendar"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-800 bg-gray-900/50 px-4 py-2">
        <Filter className="h-3 w-3 text-gray-500" />
        <select
          value={filterType}
          onChange={event => setFilterType(event.target.value)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-gray-300"
        >
          <option value="all">全部类型</option>
          <option value="Negotiated">商议承销</option>
          <option value="Competitive">竞价承销</option>
          <option value="Short-term">短期</option>
        </select>
        <select
          value={filterStatus}
          onChange={event => setFilterStatus(event.target.value)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-gray-300"
        >
          <option value="all">全部状态</option>
          <option value="Upcoming">即将发行</option>
          <option value="Pricing">定价中</option>
          <option value="Priced">已定价</option>
          <option value="Postponed">已推迟</option>
        </select>
        <select
          value={filterTax}
          onChange={event => setFilterTax(event.target.value)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-gray-300"
        >
          <option value="all">全部税务</option>
          <option value="Tax-Exempt">免税</option>
          <option value="Taxable">应税</option>
          <option value="AMT">AMT</option>
        </select>
        <select
          value={filterState}
          onChange={event => setFilterState(event.target.value)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] text-gray-300"
        >
          <option value="all">全部州</option>
          {states.map(state => (
            <option key={state} value={state ?? ""}>
              {state}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-4 text-[11px]">
          <span className="text-gray-400">
            共 <span className="font-bold text-white">{filtered.length}</span>{" "}
            笔
          </span>
          <span className="text-gray-400">
            总规模：
            <span className="font-bold text-amber-400">
              {knownAmounts.length
                ? "$" + (totalVolume / 1000).toFixed(2) + "B"
                : "—"}
            </span>
          </span>
          <span className="text-gray-400">
            均利差：
            <span className="font-bold text-blue-400">
              {averageSpread == null
                ? "—"
                : "+" + averageSpread.toFixed(0) + "bps"}
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={cn("flex-1 overflow-auto", selected && "w-1/2")}>
          {view === "list" &&
            (events.length ? (
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 border-b border-gray-800 bg-gray-900">
                  <tr>
                    {[
                      "日期",
                      "发行人",
                      "州",
                      "类型",
                      "用途",
                      "规模(M)",
                      "评级",
                      "承销商",
                      "票面",
                      "税务",
                      "利差",
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
                  {filtered.map(event => (
                    <tr
                      key={event.id}
                      onClick={() =>
                        setSelectedId(selectedId === event.id ? null : event.id)
                      }
                      className="cursor-pointer border-b border-gray-800/50 hover:bg-gray-800/50"
                    >
                      <td className="px-3 py-2 font-mono text-gray-400">
                        {event.issuanceDate}
                      </td>
                      <td className="px-3 py-2 font-medium text-white">
                        {event.issuer}
                      </td>
                      <td className="px-3 py-2 font-mono text-blue-400">
                        {event.state ?? "—"}
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{ color: typeColor(event.dealType) }}
                      >
                        {event.dealType ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-400">
                        {event.purpose ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">
                        {event.amountMillions?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-green-400">
                        {event.rating ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-400">
                        {event.underwriter ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white">
                        {event.couponPct == null
                          ? "—"
                          : event.couponPct.toFixed(2) + "%"}
                      </td>
                      <td className="px-3 py-2 text-gray-300">
                        {event.taxStatus ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-blue-400">
                        {event.benchmarkSpreadBps == null
                          ? "—"
                          : "+" + event.benchmarkSpreadBps}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px]",
                            statusTone(event.status)
                          )}
                        >
                          {event.status ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4">
                <EmptyState
                  title="结构融资发行列表未接入"
                  detail="需要获准的发行日、发行人、结构类型、规模、评级、定价和税务状态。当前不复制 PICK、CDRN 或 CDRC 的发行记录。"
                />
              </div>
            ))}

          {view === "calendar" && (
            <div className="p-4">
              {calendarDates.length ? (
                <div className="grid grid-cols-5 gap-2">
                  {calendarDates.map(date => {
                    const dayEvents = filtered.filter(
                      event => event.issuanceDate === date
                    );
                    return (
                      <div
                        key={date}
                        className="min-h-[200px] rounded border border-gray-800 bg-gray-900 p-2"
                      >
                        <div className="mb-2 text-[10px] font-semibold text-gray-400">
                          {date}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.map(event => (
                            <button
                              type="button"
                              key={event.id}
                              onClick={() => setSelectedId(event.id)}
                              className="block w-full rounded border-l-2 bg-gray-800/60 p-1.5 text-left"
                              style={{
                                borderLeftColor: typeColor(event.dealType),
                              }}
                            >
                              <div className="truncate text-[9px] font-semibold text-white">
                                {event.issuer}
                              </div>
                              <div className="text-[9px] text-gray-400">
                                {event.amountMillions == null
                                  ? "—"
                                  : "$" + event.amountMillions + "M"}{" "}
                                · {event.rating ?? "—"}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="结构融资日历未接入"
                  detail="没有可核验发行日期时不生成工作周、项目卡片或日规模，也不借用其他发行日历。"
                />
              )}
            </div>
          )}

          {view === "analytics" && (
            <div className="grid grid-cols-2 gap-4 p-4">
              <div className="rounded border border-gray-800 bg-gray-900 p-3">
                <h3 className="mb-3 text-xs font-semibold text-gray-300">
                  周度发行量（$M）
                </h3>
                {data?.weeklyIssuance.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.weeklyIssuance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                        }}
                      />
                      <Bar
                        dataKey="negotiatedMillions"
                        name="商议承销"
                        fill="#f59e0b"
                        stackId="a"
                      />
                      <Bar
                        dataKey="competitiveMillions"
                        name="竞价承销"
                        fill="#3b82f6"
                        stackId="a"
                      />
                      <Bar
                        dataKey="shortTermMillions"
                        name="短期"
                        fill="#8b5cf6"
                        stackId="a"
                      />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="周度发行量未接入"
                    detail="不使用固定周次和静态规模。"
                  />
                )}
              </div>
              <div className="rounded border border-gray-800 bg-gray-900 p-3">
                <h3 className="mb-3 text-xs font-semibold text-gray-300">
                  承销商市场份额
                </h3>
                {data?.underwriterShare.length ? (
                  <div className="space-y-2">
                    {data.underwriterShare.map(item => (
                      <div
                        key={item.underwriter}
                        className="flex items-center gap-2"
                      >
                        <span className="w-28 truncate text-[10px] text-gray-400">
                          {item.underwriter}
                        </span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{
                              width:
                                Math.max(0, Math.min(100, item.sharePct ?? 0)) +
                                "%",
                            }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-[10px] text-amber-400">
                          {item.sharePct == null
                            ? "—"
                            : item.sharePct.toFixed(1) + "%"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="承销商份额未接入"
                    detail="不显示固定机构排名或推算份额。"
                  />
                )}
              </div>
              <div className="col-span-2 rounded border border-gray-800 bg-gray-900 p-3">
                <h3 className="mb-3 text-xs font-semibold text-gray-300">
                  评级 vs 收益率（含MMD利差）
                </h3>
                {data?.ratingYield.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.ratingYield}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="rating"
                        tick={{ fontSize: 9, fill: "#9ca3af" }}
                      />
                      <YAxis
                        yAxisId="yield"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                      />
                      <YAxis
                        yAxisId="spread"
                        orientation="right"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                        }}
                      />
                      <Bar
                        yAxisId="yield"
                        dataKey="yieldPct"
                        name="收益率(%)"
                        fill="#f59e0b"
                      />
                      <Line
                        yAxisId="spread"
                        type="monotone"
                        dataKey="benchmarkSpreadBps"
                        name="MMD利差(bps)"
                        stroke="#3b82f6"
                        connectNulls={false}
                      />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="评级收益率未接入"
                    detail="缺少同日期、期限和结构口径时，不生成评级收益率或基准利差。"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {selected && (
          <aside className="w-72 shrink-0 overflow-auto border-l border-gray-800 bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
              <span className="text-xs font-semibold text-white">发行详情</span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2 p-3">
              <div className="text-sm font-semibold text-white">
                {selected.issuer}
              </div>
              {[
                ["发行日期", selected.issuanceDate],
                ["发行类型", selected.dealType ?? "—"],
                ["发行用途", selected.purpose ?? "—"],
                [
                  "发行规模",
                  selected.amountMillions == null
                    ? "—"
                    : "$" + selected.amountMillions + "M",
                ],
                ["信用评级", selected.rating ?? "—"],
                ["承销商", selected.underwriter ?? "—"],
                [
                  "票面利率",
                  selected.couponPct == null
                    ? "—"
                    : selected.couponPct.toFixed(2) + "%",
                ],
                ["到期日", selected.maturityDate ?? "—"],
                ["税务状态", selected.taxStatus ?? "—"],
                [
                  "MMD利差",
                  selected.benchmarkSpreadBps == null
                    ? "—"
                    : "+" + selected.benchmarkSpreadBps + " bps",
                ],
                ["当前状态", selected.status ?? "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-gray-800/50 py-1"
                >
                  <span className="text-[10px] text-gray-500">{label}</span>
                  <span className="font-mono text-[11px] font-semibold text-gray-200">
                    {value}
                  </span>
                </div>
              ))}
              <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                  <p className="text-[10px] text-amber-300">
                    仅显示后端清洗并核验的发行状态；没有获准簿记和认购数据时不生成参与、持仓或重新发行建议。
                  </p>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

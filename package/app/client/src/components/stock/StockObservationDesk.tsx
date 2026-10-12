import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { priceRiskPath } from "./stockRiskAnalytics";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { LoadingState } from "@/components/sovereign/PanelKit";
import {
  formatObservation as fmt,
  indexedObservationCurve,
  normalizeObservationHistory,
  observationChanges,
  observationDistribution,
  observationWindow,
  type ObservationPoint,
} from "./stockObservationModel";

const tooltip = {
  contentStyle: {
    background: "#070d18",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 11,
  },
};
const inputClass = "input-terminal h-7 px-2 text-[11px]";
const buttonClass =
  "border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40";
type ChartView =
  | "history"
  | "volume"
  | "distribution"
  | "heatmap"
  | "curve"
  | "drawdown"
  | "returns"
  | "rows";
export function environmentObservationUnit(
  row: { unit?: unknown; group?: string } | null | undefined
): string {
  if (typeof row?.unit === "string" && row.unit.trim())
    return row.unit === "index_points" ? "点" : row.unit.trim();
  // Older responses predate the explicit unit field; volatility is quoted in percent too.
  return row?.group === "equity"
    ? "点"
    : ["volatility", "rates", "credit"].includes(row?.group ?? "")
      ? "%"
      : "单位未返回";
}
export function ResearchSplit({
  left,
  right,
  label,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    // The terminal is frequently embedded in a ~620px work area. Keep the
    // matrix and chart side-by-side until the pane is genuinely narrow;
    // stacking at 720px made the chart disappear below the fold.
    const observer = new ResizeObserver(([entry]) =>
      setVertical(entry.contentRect.width > 0 && entry.contentRect.width < 560)
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root} className="min-w-0 border-y border-slate-800">
      <ResizablePanelGroup
        direction={vertical ? "vertical" : "horizontal"}
        style={{ minHeight: vertical ? 590 : 420 }}
      >
        <ResizablePanel defaultSize={38} minSize={24}>
          <div className="h-full min-w-0 overflow-auto">{left}</div>
        </ResizablePanel>
        <ResizableHandle
          aria-label={`${label}分栏调节`}
          withHandle
          className="bg-slate-700"
        />
        <ResizablePanel defaultSize={62} minSize={30}>
          <div className="h-full min-w-0 overflow-auto">{right}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function useNetworkStatus() {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function ObservationViews({
  id,
  title,
  history,
  unit,
  source,
  observedAt,
  queriedAt,
  initialView = "history",
  allowedViews,
}: {
  id: string;
  title: string;
  history: unknown;
  unit: string;
  source: string;
  observedAt?: string | null;
  queriedAt?: string | null;
  initialView?: ChartView;
  allowedViews?: ChartView[];
}) {
  const [view, setView] = useState<ChartView>(initialView);
  const [windowDays, setWindowDays] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const all = useMemo(() => normalizeObservationHistory(history), [history]);
  const points = useMemo(
    () => observationWindow(all, windowDays),
    [all, windowDays]
  );
  const changes = useMemo(() => observationChanges(points), [points]);
  const distribution = useMemo(() => observationDistribution(points), [points]);
  const indexed = useMemo(() => indexedObservationCurve(points), [points]);
  const risk = useMemo(() => priceRiskPath(points), [points]);
  const selected =
    changes.find(point => point.date === (hoveredDate ?? selectedDate)) ??
    changes.at(-1);
  const hasVolume = points.some(point => point.volume != null);
  const tabs: Array<[ChartView, string]> = [
    ["history", "时间序列"],
    ...(hasVolume ? [["volume", "量价联动"] as [ChartView, string]] : []),
    ["distribution", "历史分布"],
    ["heatmap", "数值热力图"],
    ["curve", "归一化曲线"],
    ...(allowedViews?.includes("drawdown")
      ? [["drawdown", "回撤路径"] as [ChartView, string]]
      : []),
    ...(allowedViews?.includes("returns")
      ? [["returns", "已实现收益"] as [ChartView, string]]
      : []),
    ["rows", "原始数据"],
  ];
  const visibleTabs = allowedViews
    ? tabs.filter(([key]) => allowedViews.includes(key))
    : tabs;
  const activeView =
    allowedViews && !allowedViews.includes(view)
      ? (allowedViews[0] ?? "history")
      : view;
  const heatRows = changes
    .slice(-60)
    .reduce<Array<typeof changes>>((rows, point, index) => {
      if (index % 10 === 0) rows.push([]);
      rows.at(-1)!.push(point);
      return rows;
    }, []);
  const maxAbs = Math.max(
    ...changes.map(point => Math.abs(point.changePct ?? 0)),
    0.001
  );
  useEffect(() => {
    setSelectedDate(null);
    setHoveredDate(null);
  }, [id]);
  const exportRows = () => {
    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      ["indicatorId", "date", "value", "unit", "volume", "source"],
      ...points.map(point => [
        id,
        point.date,
        point.value,
        unit,
        point.volume,
        source,
      ]),
    ]
      .map(row => row.map(escape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${id.replace(/[^a-zA-Z0-9.-]/g, "_")}-observations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="min-w-0" aria-label={`${title}联动数据视图`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-2 py-2">
        <strong className="text-xs text-cyan-100">
          {title} <span className="font-mono text-slate-500">{unit}</span>
        </strong>
        <div className="flex items-center gap-1">
          <select
            aria-label="观察时间范围"
            className={inputClass}
            value={windowDays ?? 0}
            onChange={event =>
              setWindowDays(Number(event.target.value) || null)
            }
          >
            <option value={0}>全部已读</option>
            <option value={30}>1M</option>
            <option value={90}>3M</option>
            <option value={180}>6M</option>
          </select>
          <button
            type="button"
            disabled={!points.length}
            className={buttonClass}
            onClick={exportRows}
            aria-label="导出当前观察数据"
          >
            <Download className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div
        role="tablist"
        aria-label="图表类型"
        className="flex overflow-x-auto border-b border-slate-800"
      >
        {visibleTabs.map(([key, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeView === key}
            key={key}
            onClick={() => setView(key)}
            className={`shrink-0 border-r border-slate-800 px-2 py-2 text-[10px] ${activeView === key ? "bg-cyan-950/40 text-cyan-100" : "text-slate-400 hover:bg-slate-900"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!points.length ? (
        <p
          role="status"
          className="px-3 py-16 text-center text-xs text-amber-200"
        >
          该序列未返回有效历史。没有图形或数值可展示。
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-800 px-2 py-1 font-mono text-[10px] text-slate-400">
            <span>{selected?.date ?? "—"}</span>
            <span>
              观察 {fmt(selected?.value)} {unit}
            </span>
            <span>较前观测 {fmt(selected?.change)}</span>
            <span>变化 {fmt(selected?.changePct)}%</span>
            {hasVolume && <span>成交量 {fmt(selected?.volume, 0)}</span>}
          </div>
          {(activeView === "history" ||
            (activeView === "volume" && hasVolume) ||
            activeView === "drawdown" ||
            activeView === "returns" ||
            activeView === "curve") && (
            <div className="h-[272px] py-2 pr-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={
                    activeView === "drawdown" || activeView === "returns"
                      ? risk
                      : activeView === "curve"
                        ? indexed
                        : changes
                  }
                  onMouseMove={(event: any) => {
                    if (typeof event?.activeLabel === "string")
                      setHoveredDate(event.activeLabel);
                  }}
                  onMouseLeave={() => setHoveredDate(null)}
                  onClick={(event: any) => {
                    if (typeof event?.activeLabel === "string")
                      setSelectedDate(event.activeLabel);
                  }}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="2 3" />
                  <XAxis
                    dataKey="date"
                    minTickGap={26}
                    tick={{ fill: "#94a3b8", fontSize: 9 }}
                  />
                  <YAxis
                    yAxisId="value"
                    width={62}
                    domain={["auto", "auto"]}
                    tick={{ fill: "#94a3b8", fontSize: 9 }}
                  />
                  {activeView === "volume" && (
                    <YAxis
                      yAxisId="volume"
                      orientation="right"
                      width={38}
                      tickFormatter={value =>
                        `${fmt(Number(value) / 1_000_000, 1)}m`
                      }
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                  )}
                  <Tooltip {...tooltip} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {activeView === "volume" && (
                    <Bar
                      yAxisId="volume"
                      dataKey="volume"
                      name="实际日成交量"
                      fill="#334155"
                    />
                  )}
                  <Line
                    yAxisId="value"
                    type="linear"
                    dataKey={
                      activeView === "drawdown"
                        ? "drawdown"
                        : activeView === "returns"
                          ? "cumulativeReturn"
                          : "value"
                    }
                    name={
                      activeView === "drawdown"
                        ? "距历史峰值回撤 %"
                        : activeView === "returns"
                          ? "区间收盘变化 %（非总回报）"
                          : activeView === "curve"
                            ? "起点=100（价格路径）"
                            : `${title}（${unit}）`
                    }
                    stroke="#22d3ee"
                    strokeWidth={1.5}
                    dot={points.length === 1}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Brush
                    dataKey="date"
                    height={17}
                    travellerWidth={7}
                    stroke="#155e75"
                    fill="#020617"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {activeView === "volume" && !hasVolume && (
            <p className="px-3 py-16 text-xs text-amber-200">
              该证券历史未返回有效成交量，量价图不补值；可切换时间序列读取真实价格。
            </p>
          )}
          {(activeView === "drawdown" || activeView === "returns") && (
            <p className="px-2 py-1 text-[10px] text-slate-500">
              仅根据有效正收盘观察计算；回撤=当前收盘/此前窗口峰值−1，累计变化=当前收盘/窗口首值−1。不含分红、费用或执行价格，不是策略回测。
            </p>
          )}
          {activeView === "curve" && !indexed.length && (
            <p className="px-2 text-xs text-amber-200">
              起点值非正，不能生成基准为 100 的价格曲线。
            </p>
          )}
          {activeView === "distribution" && (
            <>
              <div className="h-[250px] py-2 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="2 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                      minTickGap={20}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={36}
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <Tooltip {...tooltip} />
                    <Bar
                      dataKey="count"
                      name="实际观察次数"
                      fill="#38bdf8"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="px-2 py-1 text-[10px] text-slate-500">
                统计当前窗口内实际数值的频数，不是买卖盘深度、成交密度或预测概率。
              </p>
            </>
          )}
          {activeView === "heatmap" && (
            <div className="overflow-x-auto p-2">
              <table className="w-full min-w-[400px] border-collapse text-center text-[9px]">
                <tbody>
                  {heatRows.map((row, index) => (
                    <tr key={index}>
                      {row.map(point => (
                        <td
                          key={point.date}
                          className="border border-slate-800 p-0"
                        >
                          <button
                            type="button"
                            className="w-full px-1 py-3 focus:outline focus:outline-1 focus:outline-cyan-200"
                            onClick={() => setSelectedDate(point.date)}
                            style={{
                              background:
                                point.changePct == null
                                  ? "#0f172a"
                                  : `rgba(${point.changePct >= 0 ? "16,185,129" : "244,63,94"},${0.1 + Math.min(1, Math.abs(point.changePct) / maxAbs) * 0.55})`,
                            }}
                            title={`${point.date} / ${fmt(point.value)} ${unit} / 较前观测 ${fmt(point.changePct)}%`}
                          >
                            <span className="block text-slate-400">
                              {point.date.slice(5)}
                            </span>
                            <b className="block font-mono text-slate-100">
                              {fmt(point.value)}
                            </b>
                            <span className="block font-mono text-slate-400">
                              {fmt(point.changePct)}%
                            </span>
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="pt-2 text-[10px] text-slate-500">
                数值=实际观察值；颜色强度=较前观测变化幅度，绿=上升、红=下降。空缺不补值。点击单元格联动状态行。
              </p>
            </div>
          )}
          {activeView === "rows" && (
            <div className="max-h-[270px] overflow-auto">
              <table className="w-full text-right text-[10px]">
                <thead className="sticky top-0 bg-slate-950 text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-left">观察日期</th>
                    <th className="px-2">值 / {unit}</th>
                    <th className="px-2">变化</th>
                    <th className="px-2">变化%</th>
                    {hasVolume && <th className="px-2">成交量</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...changes].reverse().map(point => (
                    <tr
                      key={point.date}
                      onClick={() => setSelectedDate(point.date)}
                      className={`border-t border-slate-800 font-mono ${selectedDate === point.date ? "bg-cyan-950/30" : "hover:bg-slate-900"}`}
                    >
                      <td className="px-2 py-1.5 text-left">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(point.date)}
                          className="text-cyan-200"
                        >
                          {point.date}
                        </button>
                      </td>
                      <td className="px-2">{fmt(point.value)}</td>
                      <td className="px-2">{fmt(point.change)}</td>
                      <td className="px-2">{fmt(point.changePct)}</td>
                      {hasVolume && (
                        <td className="px-2">{fmt(point.volume, 0)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <footer className="border-t border-slate-800 px-2 py-1 text-[9px] leading-5 text-slate-500">
        观察时间 {observedAt ?? all.at(-1)?.date ?? "—"} · 查询{" "}
        {queriedAt ?? "未返回"} · 日频公开观察，非交易所实时行情。
      </footer>
    </div>
  );
}

export function EnvironmentObservationDesk({
  initialSeries,
  initialView = "history",
  mode = "environment",
}: {
  initialSeries?: string;
  initialView?: ChartView;
  mode?: "environment" | "index";
}) {
  const query = trpc.stockMarketResearch.getEnvironment.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnReconnect: true,
  });
  const [selectedId, setSelectedId] = useState(initialSeries ?? "SP500");
  const [filter, setFilter] = useState("");
  const online = useNetworkStatus();
  const rows = (query.data?.series ?? []) as any[];
  const selected = rows.find(row => row.id === selectedId) ?? rows[0];
  const filtered = rows.filter(row =>
    `${row.id} ${row.label}`.toLowerCase().includes(filter.toLowerCase())
  );
  const unit = environmentObservationUnit;
  return (
    <div aria-label="股市环境行情矩阵">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2">
        <input
          aria-label="筛选环境序列"
          className={`${inputClass} min-w-0 flex-1`}
          value={filter}
          onChange={event => setFilter(event.target.value)}
          placeholder={
            mode === "index" ? "指数序列代码 / 名称" : "环境序列代码 / 名称"
          }
        />
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching || !online}
          className={buttonClass}
        >
          <RefreshCw className="mr-1 inline h-3 w-3" />
          刷新来源
        </button>
        <span
          role="status"
          className={`text-[10px] ${!online || query.isError ? "text-amber-300" : "text-slate-500"}`}
        >
          {!online
            ? "网络已断开 · 保留旧观察"
            : query.isFetching
              ? "读取中"
              : query.isError
                ? "接口读取失败"
                : "每60秒核验 · 日频观察"}
        </span>
      </div>
      {query.isLoading ? (
        <LoadingState text="正在读取真实历史序列…" />
      ) : (
        <ResearchSplit
          label="行情矩阵与图表"
          left={
            <table className="w-full text-right text-[11px]">
              <thead className="bg-slate-950 text-[10px] text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left">
                    {mode === "index" ? "指数序列 / 来源" : "指标 / 来源"}
                  </th>
                  <th className="px-2">
                    {mode === "index" ? "基准值" : "观察值"}
                  </th>
                  <th className="px-2">
                    {mode === "index" ? "日变化" : "前值差"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-800 ${selected?.id === row.id ? "bg-cyan-950/35" : "hover:bg-slate-900"}`}
                  >
                    <td className="px-2 py-2 text-left">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className="w-full text-left"
                      >
                        <b className="block text-cyan-200">{row.label}</b>
                        <span className="block font-mono text-[9px] text-slate-500">
                          FRED:{row.id}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {row.observationDate ?? "来源未返回"}
                        </span>
                      </button>
                    </td>
                    <td className="px-2 font-mono text-slate-200">
                      {fmt(row.value)} {unit(row)}
                    </td>
                    <td className="px-2 font-mono text-slate-400">
                      {fmt(row.change)}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={3} className="p-3 text-left text-slate-500">
                      {query.isError
                        ? "接口失败，请刷新重试。"
                        : rows.length
                          ? "没有匹配的序列。"
                          : "未取得环境序列；不生成替代数据。"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          }
          right={
            <ObservationViews
              key={`${selected?.id ?? "empty"}-${initialView}`}
              id={selected?.id ?? "FRED"}
              title={selected?.label ?? "请选择指标"}
              history={selected?.history}
              unit={unit(selected)}
              source={query.data?.sourceLabel ?? "FRED"}
              observedAt={selected?.observationDate}
              queriedAt={query.data?.asOf}
              initialView={initialView}
            />
          }
        />
      )}
    </div>
  );
}

export function TickerObservationDesk({
  defaultTicker = "AAPL",
  title = "证券报价观察",
  initialView = "history",
  linkedTicker,
  focus = "quote",
}: {
  defaultTicker?: string;
  title?: string;
  initialView?: ChartView;
  linkedTicker?: string;
  focus?: "quote" | "volume" | "curve" | "etf" | "range";
}) {
  const [draft, setDraft] = useState(defaultTicker);
  const [ticker, setTicker] = useState(defaultTicker);
  const [range, setRange] = useState<
    "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y"
  >("6mo");
  const query = trpc.stockMarketResearch.getTickerObservation.useQuery(
    { ticker, range },
    { staleTime: 30_000, refetchInterval: 60_000, refetchOnReconnect: true }
  );
  const online = useNetworkStatus();
  const data = query.data?.observation;
  useEffect(() => {
    if (linkedTicker) {
      setDraft(linkedTicker);
      setTicker(linkedTicker);
    }
  }, [linkedTicker]);
  const points = normalizeObservationHistory(data?.history);
  const latest = points.at(-1);
  const previous = points.at(-2);
  const periodHigh = points.length
    ? Math.max(...points.map(point => point.value))
    : null;
  const periodLow = points.length
    ? Math.min(...points.map(point => point.value))
    : null;
  const volumes = points.filter(point => point.volume != null);
  const averageVolume = volumes.length
    ? volumes.reduce((sum, point) => sum + (point.volume ?? 0), 0) /
      volumes.length
    : null;
  const fields: Array<[string, unknown, string]> = data
    ? focus === "volume"
      ? [
          ["最新日频收盘", latest?.value, latest?.date ?? "—"],
          [
            "最新成交量",
            data.volume,
            data.regularMarketTime ?? "市场时点未返回",
          ],
          ["窗口平均成交量", averageVolume, `${volumes.length} 个有效观察`],
          ["成交量样本数", volumes.length, "缺失不补值"],
        ]
      : focus === "range"
        ? [
            ["区间末值", latest?.value, latest?.date ?? "—"],
            ["区间最高收盘", periodHigh, `${points.length} 个有效观察`],
            ["区间最低收盘", periodLow, `${points.length} 个有效观察`],
            [
              "区间振幅",
              periodHigh != null && periodLow != null
                ? periodHigh - periodLow
                : null,
              "最高收盘 − 最低收盘",
            ],
          ]
        : focus === "curve"
          ? [
              ["曲线起点", points[0]?.value, points[0]?.date ?? "—"],
              ["曲线终点", latest?.value, latest?.date ?? "—"],
              [
                "累计变化",
                points[0]?.value && latest
                  ? (latest.value / points[0].value - 1) * 100
                  : null,
                "起点=100 的路径",
              ],
              ["有效观察数", points.length, "不含无效日期/冲突记录"],
            ]
          : focus === "etf"
            ? [
                [
                  "ETF 交易价格观察",
                  data.price,
                  data.regularMarketTime ?? "市场时点未返回",
                ],
                ["最新日频收盘", latest?.value, latest?.date ?? "—"],
                [
                  "区间变化",
                  points[0]?.value && latest
                    ? (latest.value / points[0].value - 1) * 100
                    : null,
                  "同一 ETF 序列",
                ],
                ["历史有效点数", points.length, "公开日频观察"],
              ]
            : [
                [
                  "最新日频收盘",
                  data.price,
                  data.observationDate ?? latest?.date ?? "—",
                ],
                ["前一已读日收盘", previous?.value, previous?.date ?? "—"],
                [
                  "当期高价",
                  data.dayHigh,
                  data.observationDate ?? "观察日未返回",
                ],
                [
                  "当期低价",
                  data.dayLow,
                  data.observationDate ?? "观察日未返回",
                ],
                [
                  "当期成交量",
                  data.volume,
                  data.observationDate ?? "观察日未返回",
                ],
              ]
    : [];
  const allowedViews: ChartView[] =
    focus === "volume"
      ? ["volume", "history", "rows"]
      : focus === "curve"
        ? ["curve", "heatmap", "rows"]
        : focus === "range"
          ? ["curve", "distribution", "rows"]
          : focus === "etf"
            ? ["history", "curve", "distribution", "rows"]
            : ["history", "distribution", "heatmap", "rows"];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = draft.trim().toUpperCase();
    if (/^[A-Z0-9.^=-]{1,15}$/.test(next)) {
      if (ticker === next) query.refetch();
      else setTicker(next);
    }
  };
  return (
    <div aria-label={title}>
      <form
        onSubmit={submit}
        className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"
      >
        <b className="text-xs text-cyan-100">{title}</b>
        <input
          aria-label="证券观察代码"
          value={draft}
          onChange={event =>
            setDraft(event.target.value.toUpperCase().slice(0, 15))
          }
          className={`${inputClass} w-24`}
        />
        <button
          type="submit"
          disabled={
            !/^[A-Z0-9.^=-]{1,15}$/.test(draft.trim()) ||
            query.isFetching ||
            !online
          }
          className={buttonClass}
        >
          读取
        </button>
        <select
          aria-label="证券历史范围"
          value={range}
          onChange={event => setRange(event.target.value as typeof range)}
          className={inputClass}
        >
          <option value="1mo">1M</option>
          <option value="3mo">3M</option>
          <option value="6mo">6M</option>
          <option value="1y">1Y</option>
          <option value="2y">2Y</option>
          <option value="5y">5Y</option>
        </select>
        <span role="status" className="text-[10px] text-amber-200">
          {!online
            ? "已断线 · 旧观察"
            : query.isError
              ? "接口失败"
              : query.isFetching
                ? "读取中"
                : query.data?.status === "unavailable"
                  ? "来源不可用 · 无有效报价"
                  : "公共日频 / 非可执行报价"}
        </span>
      </form>
      {query.isLoading ? (
        <LoadingState text="正在读取证券历史与市场字段…" />
      ) : (
        <ResearchSplit
          label="报价列表与图层"
          left={
            <>
              <div className="border-b border-slate-800 px-2 py-2 text-[10px] text-slate-400">
                {data?.name ?? ticker} · {data?.exchange ?? "交易所未返回"} ·{" "}
                {data?.currency ?? "币种未返回"}
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-slate-950 text-left text-[10px] text-slate-500">
                  <tr>
                    <th className="px-2 py-2">报价字段</th>
                    <th className="px-2 text-right">值</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(([label, value, time]) => (
                    <tr key={label} className="border-t border-slate-800">
                      <td className="px-2 py-2 text-slate-400">
                        {label}
                        <span className="block break-all text-[9px] text-slate-600">
                          {time}
                        </span>
                      </td>
                      <td className="px-2 text-right font-mono text-slate-200">
                        {typeof value === "number"
                          ? fmt(value, label.includes("量") ? 0 : 4)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-800">
                    <td className="px-2 py-2 text-slate-500">
                      买价 / 卖价 / 深度盘口
                    </td>
                    <td className="px-2 text-right text-amber-300">未接入</td>
                  </tr>
                </tbody>
              </table>
              {!data && (
                <p className="p-3 text-xs leading-6 text-amber-200">
                  {query.error?.message ??
                    query.data?.sourceBoundary ??
                    "数据源没有返回有效观察。请重试或检查数据源授权。"}
                </p>
              )}
              <p className="px-2 py-2 text-[9px] leading-5 text-slate-500">
                收盘、高低价与成交量来自同一日频快照，不将抓取时刻当作市场成交时刻。缺失字段不估算。
              </p>
            </>
          }
          right={
            <ObservationViews
              key={`${ticker}-${initialView}`}
              id={ticker}
              title={data?.name ?? ticker}
              history={data?.history}
              unit={data?.currency ?? "未返回"}
              source={
                query.data && "sourceLabel" in query.data
                  ? (query.data.sourceLabel ?? "公开日频来源未返回")
                  : "公开日频来源未返回"
              }
              observedAt={data?.observationDate ?? latest?.date}
              queriedAt={data?.retrievedAt ?? null}
              initialView={initialView}
              allowedViews={allowedViews}
            />
          }
        />
      )}
    </div>
  );
}

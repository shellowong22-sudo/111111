import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  commonCurve,
  changeStatistics,
  distribution,
  seriesStatistics,
  windowHistory,
  type EnvironmentSeries,
} from "./environmentAnalytics";

type View = "series" | "distribution" | "heatmap" | "curve" | "depth";
type Environment = {
  series: EnvironmentSeries[];
  asOf: string;
  sourceStatus: string;
  sourceLabel: string;
};
const fmt = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
const tooltip = {
  contentStyle: {
    background: "#0b1320",
    border: "1px solid #334155",
    fontSize: 11,
  },
  labelStyle: { color: "#e2e8f0" },
};

export default function PreferredEnvironmentWorkbench({
  environment,
  scope = "all",
  initialView = "series",
  enabledViews,
}: {
  environment?: Environment;
  scope?: "all" | "rate" | "credit";
  initialView?: View;
  enabledViews?: View[];
}) {
  const uid = useId();
  const changesOnly =
    enabledViews?.length === 1 && enabledViews[0] === "heatmap";
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>(initialView);
  const [observations, setObservations] = useState(90);
  const [descending, setDescending] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 820px)").matches
  );
  useEffect(() => {
    const updateOnline = () => setOffline(!navigator.onLine);
    const media = window.matchMedia("(max-width: 820px)");
    const updateSize = () => setCompact(media.matches);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    media.addEventListener("change", updateSize);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      media.removeEventListener("change", updateSize);
    };
  }, []);
  const source = (environment?.series ?? []).filter(
    item => scope === "all" || item.group === scope
  );
  const rows = source
    .filter(item =>
      `${item.id} ${item.label}`.toLowerCase().includes(search.toLowerCase())
    )
    .map(item => ({
      ...item,
      stats: seriesStatistics(windowHistory(item.history, observations)),
      moves: changeStatistics(windowHistory(item.history, observations)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id) * (descending ? -1 : 1));
  const selected = rows.find(item => item.id === selectedId) ?? rows[0];
  const history = useMemo(
    () => windowHistory(selected?.history ?? [], observations),
    [selected?.history, observations]
  );
  const stats = seriesStatistics(history);
  const curve = commonCurve(source);
  const heatSource = changesOnly ? rows : source;
  const heatDates = [
    ...new Set(
      heatSource.flatMap(item => windowHistory(item.history, 12).map(p => p.date))
    ),
  ]
    .sort()
    .slice(-12);
  const selectedPosition = rows.findIndex(item => item.id === selected?.id);
  const views = (
    [
      ["series", "时间序列"],
      ["distribution", "历史分布"],
      ["heatmap", "变动热力图"],
      ...(scope !== "credit" ? [["curve", "期限曲线"] as [View, string]] : []),
      ["depth", "盘口深度"],
    ] as Array<[View, string]>
  ).filter(([id]) => !enabledViews || enabledViews.includes(id));
  const exportHistory = () => {
    if (!selected || !history.length) return;
    const csv = [
      "indicatorId,date,value,unit,source,retrievedAt",
      ...history.map(
        point =>
          `${selected.id},${point.date},${point.value},percent,FRED,${environment?.asOf ?? ""}`
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.id}-observations.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section
      aria-label="优先股环境分析工作台"
      className="min-w-0 border-y border-cyan-900 text-xs"
    >
      <div
        role="toolbar"
        aria-label="环境分析工具栏"
        className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-2 py-2"
      >
        <b className="text-cyan-100">
          {scope === "credit"
            ? "信用利差分布台"
            : scope === "rate"
              ? "期限结构分析台"
              : "利率与信用联动台"}
        </b>
        <input
          aria-label="筛选环境指标"
          placeholder="指标代码 / 名称"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-terminal max-w-44 text-xs"
        />
        <label className="text-slate-400">
          观察窗口{" "}
          <select
            aria-label="历史观察窗口"
            value={observations}
            onChange={e => setObservations(Number(e.target.value))}
            className="input-terminal text-xs"
          >
            <option value={30}>30 个观察</option>
            <option value={90}>90 个观察</option>
            <option value={180}>180 个观察</option>
          </select>
        </label>
        <button
          onClick={exportHistory}
          disabled={!history.length}
          className="border border-slate-700 px-2 py-1 text-cyan-200 disabled:opacity-40"
        >
          导出选中序列
        </button>
      </div>
      <ResizablePanelGroup
        direction={compact ? "vertical" : "horizontal"}
        className="min-h-[540px]"
        style={{ height: compact ? 940 : 610 }}
      >
        <ResizablePanel defaultSize={compact ? 32 : 40} minSize={22}>
          <div
            className="h-full overflow-auto"
            tabIndex={0}
            aria-label="行情参照矩阵，方向键选择指标"
            onKeyDown={e => {
              if (!rows.length || !["ArrowUp", "ArrowDown"].includes(e.key))
                return;
              e.preventDefault();
              setSelectedId(
                rows[
                  (selectedPosition +
                    (e.key === "ArrowDown" ? 1 : -1) +
                    rows.length) %
                    rows.length
                ].id
              );
            }}
          >
            <div className="sticky top-0 border-b border-slate-800 bg-slate-950 px-2 py-2 text-slate-400">
              {changesOnly
                ? "因子变动矩阵 · 公共日频变动 / 不复刻报价"
                : "行情参照矩阵 · 公共日频 / 非个券报价"}
            </div>
            <table className="w-full whitespace-nowrap text-left text-[11px]">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="p-2">
                    <button onClick={() => setDescending(value => !value)}>
                      指标 {descending ? "↓" : "↑"}
                    </button>
                  </th>
                  <th className="p-2 text-right">
                    {changesOnly ? "变动标准差 bp" : "观察值 %"}
                  </th>
                  <th className="p-2 text-right">
                    {changesOnly ? "最大绝对变动 bp" : "变动 bp"}
                  </th>
                  <th className="p-2">观察日</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(item => (
                  <tr
                    key={item.id}
                    aria-selected={selected?.id === item.id}
                    className={`border-b border-slate-800 ${selected?.id === item.id ? "bg-cyan-950/35" : ""}`}
                  >
                    <td className="p-2">
                      <button
                        className="text-left text-cyan-200"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className="font-mono">{item.id}</span>
                        <span className="block text-[10px] text-slate-400">
                          {item.label}
                        </span>
                      </button>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmt(
                        changesOnly
                          ? item.moves.standardDeviationBps
                          : item.stats.latest,
                        3
                      )}
                    </td>
                    <td
                      className={`p-2 text-right font-mono ${(item.stats.changeBps ?? 0) > 0 ? "text-amber-300" : "text-cyan-300"}`}
                    >
                      {fmt(
                        changesOnly
                          ? item.moves.maxAbsoluteBps
                          : item.stats.changeBps,
                        1
                      )}
                    </td>
                    <td className="p-2 font-mono text-slate-400">
                      {item.stats.date ?? "源不可用"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p role="status" className="p-4 text-amber-200">
                {source.length
                  ? "没有匹配的指标，清空筛选可恢复。"
                  : "数据源暂不可读；刷新资料可重试。"}
              </p>
            )}
            <div className="border-t border-slate-700 p-2 text-slate-400">
              选中序列区间统计 · {selected?.id ?? "未选择"}
            </div>
            <table className="w-full text-left text-[11px]">
              <tbody>
                {(changesOnly
                  ? [
                      ["有效变动数", String(selected?.moves.count ?? 0)],
                      [
                        "上升 / 下降",
                        `${selected?.moves.up ?? 0} / ${selected?.moves.down ?? 0}`,
                      ],
                      ["持平", String(selected?.moves.unchanged ?? 0)],
                      [
                        "变动标准差 bp",
                        fmt(selected?.moves.standardDeviationBps, 3),
                      ],
                    ]
                  : [
                      ["观察数", String(stats.count)],
                      [
                        "最小 / 最大 %",
                        `${fmt(stats.min, 3)} / ${fmt(stats.max, 3)}`,
                      ],
                      ["中位数 %", fmt(stats.median, 3)],
                      [
                        "最新值历史百分位",
                        `${fmt(stats.percentile, 1)}${stats.percentile === null ? "" : "%"}`,
                      ],
                    ]
                ).map(([key, value]) => (
                  <tr key={key} className="border-b border-slate-800">
                    <th className="px-2 py-2 font-normal text-slate-400">
                      {key}
                    </th>
                    <td className="px-2 py-2 text-right font-mono">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-2 text-[10px] leading-5 text-slate-400">
              {selected?.limitation} 变动按相邻有效观察计算，1 个百分点 = 100
              bp。
              {changesOnly
                ? "变动标准差使用样本标准差；不等同于个券波动率。"
                : "百分位为窗口内严格小于最新值的比例。"}
            </p>
          </div>
        </ResizablePanel>
        <ResizableHandle
          aria-label="调整矩阵与图表分栏"
          className={compact ? "h-2" : "w-2"}
          withHandle
        />
        <ResizablePanel defaultSize={compact ? 68 : 60} minSize={32}>
          <div className="flex h-full min-w-0 flex-col overflow-auto">
            <div
              role="tablist"
              aria-label="环境分析图层"
              className="flex shrink-0 overflow-x-auto border-b border-slate-800"
            >
              {views.map(([id, label], index) => (
                <button
                  role="tab"
                  aria-controls={`${uid}-plot`}
                  aria-selected={view === id}
                  tabIndex={view === id ? 0 : -1}
                  key={id}
                  onClick={() => setView(id)}
                  onKeyDown={e => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      const next =
                        (index +
                          (e.key === "ArrowRight" ? 1 : -1) +
                          views.length) %
                        views.length;
                      setView(views[next][0]);
                      (
                        e.currentTarget.parentElement?.children[
                          next
                        ] as HTMLElement
                      )?.focus();
                    }
                  }}
                  className={`whitespace-nowrap border-r border-slate-800 px-3 py-2 ${view === id ? "bg-cyan-950/40 text-cyan-200" : "text-slate-400"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              id={`${uid}-plot`}
              role="tabpanel"
              aria-label={views.find(([id]) => id === view)?.[1]}
              className="min-h-[310px] shrink-0"
            >
              {view === "depth" ? (
                <div className="p-3">
                  <h4 className="mb-3 text-cyan-100">报价列表与累计委托深度</h4>
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-700 text-slate-400">
                      <tr>
                        {["买量", "买价", "卖价", "卖量"].map(label => (
                          <th key={label} className="p-2">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          colSpan={4}
                          role="status"
                          className="py-8 text-center text-amber-200"
                        >
                          数据源未配置：需要授权的优先股逐档盘口。
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-3 text-slate-400">
                    公共利率序列没有委托量和买卖价，不能生成订单簿深度图。此处与历史分布图分别展示，避免将分布冒充盘口。
                  </p>
                </div>
              ) : view === "heatmap" ? (
                <div className="overflow-x-auto p-2">
                  <p className="mb-2 text-slate-400">
                    相邻观察变动（bp） · 青色下降 / 橙色上升 ·
                    点击单元格联动该序列
                  </p>
                  <table className="w-full whitespace-nowrap text-center text-[10px]">
                    <thead>
                      <tr>
                        <th className="p-1">指标</th>
                        {heatDates.map(date => (
                          <th
                            key={date}
                            className="p-1 font-normal text-slate-400"
                          >
                            {date.slice(5)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatSource.map(item => {
                        const full = windowHistory(item.history, 180);
                        const changes = new Map(
                          full.map((point, index) => [
                            point.date,
                            index
                              ? (point.value - full[index - 1].value) * 100
                              : null,
                          ])
                        );
                        return (
                          <tr key={item.id}>
                            <th className="p-1 text-left text-cyan-200">
                              {item.id}
                            </th>
                            {heatDates.map(date => {
                              const value = changes.get(date);
                              return (
                                <td
                                  key={date}
                                  className="border border-slate-800"
                                >
                                  <button
                                    aria-label={`${item.id} ${date} 变动 ${fmt(value, 1)} 基点`}
                                    onClick={() => {
                                      setSearch("");
                                      setSelectedId(item.id);
                                      if (views.some(([id]) => id === "series"))
                                        setView("series");
                                    }}
                                    className="w-full px-1 py-2"
                                    style={{
                                      background:
                                        value == null
                                          ? "transparent"
                                          : `rgba(${value > 0 ? "217,119,6" : "8,145,178"},${Math.min(0.85, 0.1 + Math.abs(value) / 15)})`,
                                    }}
                                  >
                                    {fmt(value, 1)}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : view === "curve" ? (
                <>
                  <div className="px-2 py-2 text-[10px] text-slate-400">
                    同日曲线 {curve.date ?? "无共同观察日"} / 对比{" "}
                    {curve.comparisonDate ?? "历史不足 21 个共同观察"} ·
                    数值期限轴
                  </div>
                  {curve.rows.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer>
                        <LineChart data={curve.rows}>
                          <CartesianGrid stroke="#263345" />
                          <XAxis
                            type="number"
                            dataKey="tenor"
                            domain={[0, 30]}
                            ticks={[2, 5, 10, 30]}
                            unit="年"
                          />
                          <YAxis
                            domain={["auto", "auto"]}
                            unit="%"
                            width={50}
                          />
                          <Tooltip {...tooltip} />
                          <Legend />
                          <Line
                            name="当前共同观察日"
                            dataKey="current"
                            stroke="#22d3ee"
                            type="linear"
                            isAnimationActive={false}
                          />
                          <Line
                            name="前20个共同观察"
                            dataKey="previous"
                            stroke="#f59e0b"
                            strokeDasharray="5 4"
                            type="linear"
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p role="status" className="p-4 text-amber-200">
                      未取得可对齐的期限数据。
                    </p>
                  )}
                </>
              ) : history.length ? (
                <>
                  <div className="px-2 py-2 font-mono text-cyan-200">
                    {selected?.id} · {history[0]?.date} → {history.at(-1)?.date}
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer>
                      {view === "series" ? (
                        <LineChart data={history}>
                          <CartesianGrid stroke="#263345" />
                          <XAxis
                            dataKey="date"
                            minTickGap={40}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis
                            domain={["auto", "auto"]}
                            unit="%"
                            width={50}
                          />
                          <Tooltip {...tooltip} />
                          <Line
                            type="linear"
                            dataKey="value"
                            name="官方观察值 %"
                            stroke="#22d3ee"
                            dot={history.length < 3}
                            isAnimationActive={false}
                          />
                          <Brush
                            dataKey="date"
                            height={22}
                            stroke="#357085"
                            fill="#0b1320"
                          />
                        </LineChart>
                      ) : (
                        <BarChart data={distribution(history)}>
                          <CartesianGrid stroke="#263345" />
                          <XAxis dataKey="label" tick={{ fontSize: 8 }} />
                          <YAxis allowDecimals={false} width={32} />
                          <Tooltip {...tooltip} />
                          <Bar
                            name="实际观察数"
                            dataKey="count"
                            fill="#22d3ee"
                            isAnimationActive={false}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p role="status" className="p-6 text-amber-200">
                  所选序列没有有效历史观察，图层不生成占位曲线。
                </p>
              )}
            </div>
            <div className="border-t border-slate-700 px-2 py-2 text-slate-400">
              {view === "depth"
                ? "逐档报价状态 · 仅在授权盘口源接入后显示"
                : view === "curve"
                  ? "曲线参考数据表 · 相同观察日"
                  : `${selected?.id ?? "指标"} · 历史参考数据表（最新在前）`}
            </div>
            <div className="min-h-24 flex-1 overflow-auto">
              {view === "depth" ? (
                <div
                  className="p-4 text-xs leading-6 text-amber-200"
                  role="status"
                >
                  当前数据源只提供 FRED
                  日频环境观察，不包含个券买价、卖价、盘口数量或成交队列。
                  <br />
                  已拦截历史序列向盘口深度的错误映射；接入获得授权的逐档行情后，此处才会显示可核验的报价、数量、时间戳与序号。
                </div>
              ) : changesOnly ? (
                <p role="status" className="p-3 text-[10px] text-slate-400">VIZ 只保留上方变动热力矩阵；原始值和历史表由 WB 唯一负责，避免在可视化页面重复展示。</p>
              ) : (
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-slate-950 text-slate-400">
                    <tr>
                      {(view === "curve"
                        ? ["期限", "当前 %", "对比 %", "变动 bp"]
                        : ["观察日", "观察值 %", "变动 bp", "来源"]
                      ).map(label => (
                        <th className="p-2" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view === "curve"
                      ? curve.rows.map(row => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-800"
                          >
                            <td className="p-2">{row.tenor} 年</td>
                            <td className="p-2">{fmt(row.current, 3)}</td>
                            <td className="p-2">{fmt(row.previous, 3)}</td>
                            <td className="p-2">
                              {fmt(
                                row.previous === null
                                  ? null
                                  : (row.current - row.previous) * 100,
                                1
                              )}
                            </td>
                          </tr>
                        ))
                      : history
                          .map((point, index) => ({
                            ...point,
                            change: index
                              ? (point.value - history[index - 1].value) * 100
                              : null,
                          }))
                          .reverse()
                          .map(point => (
                            <tr
                              key={point.date}
                              className="border-t border-slate-800 font-mono"
                            >
                              <td className="p-2">{point.date}</td>
                              <td className="p-2">{fmt(point.value, 3)}</td>
                              <td className="p-2">{fmt(point.change, 1)}</td>
                              <td className="p-2">FRED</td>
                            </tr>
                          ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <footer
        role="status"
        className="flex flex-wrap gap-x-4 border-t border-slate-700 px-2 py-2 text-[10px] text-slate-400"
      >
        <span className={offline ? "text-rose-300" : "text-amber-200"}>
          {offline ? "网络断开 · 非实时" : "日频发布 · 非实时行情"}
        </span>
        <span>来源：{environment?.sourceLabel ?? "尚未返回"}</span>
        <span>服务器读取 UTC：{environment?.asOf ?? "—"}</span>
        <span>市场观察日以矩阵各行日期为准；旧观察不会标为 LIVE。</span>
      </footer>
    </section>
  );
}

import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { priceRiskSummary } from "./stockRiskAnalytics";
import {
  formatObservation as fmt,
  normalizeObservationHistory,
} from "./stockObservationModel";
import { ResearchSplit } from "./StockObservationDesk";

const field = "input-terminal h-7 px-2 text-[11px]";
const button =
  "border border-slate-700 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40";
const tip = {
  contentStyle: {
    background: "#070d18",
    border: "1px solid #334155",
    fontSize: 11,
    color: "#e2e8f0",
  },
};

/** EQBT is a historical risk study, not another quote card or live market pane. */
export default function EqbtRiskWorkbench() {
  const paneId = useId();
  const [objectType, setObjectType] = useState<"index" | "security">("index");
  const [draft, setDraft] = useState("AAPL");
  const [ticker, setTicker] = useState("AAPL");
  const [range, setRange] = useState<
    "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y"
  >("1y");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [view, setView] = useState<"return" | "drawdown" | "rows">("drawdown");
  const [selectedDate, setSelectedDate] = useState("");
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  const security = trpc.stockMarketResearch.getTickerObservation.useQuery(
    { ticker, range },
    {
      enabled: objectType === "security",
      staleTime: 30_000,
      refetchInterval: objectType === "security" ? 60_000 : false,
      refetchOnReconnect: true,
    }
  );
  const environment = trpc.stockMarketResearch.getEnvironment.useQuery(
    undefined,
    {
      enabled: objectType === "index",
      staleTime: 30_000,
      refetchInterval: objectType === "index" ? 60_000 : false,
      refetchOnReconnect: true,
    }
  );
  const indexSeries = environment.data?.series.find((row: {id:string;history?:unknown}) => row.id === "SP500");
  const query =
    objectType === "index"
      ? {
          isFetching: environment.isFetching,
          isLoading: environment.isLoading,
          isError: environment.isError,
          error: environment.error,
          dataUpdatedAt: environment.dataUpdatedAt,
          refetch: environment.refetch,
          data: environment.data
            ? {
                status: indexSeries?.history?.length
                  ? "available"
                  : "unavailable",
                sourceBoundary: environment.data.sourceBoundary,
              }
            : undefined,
        }
      : security;
  const researchId = objectType === "index" ? "FRED:SP500" : ticker;
  const sourceName =
    objectType === "index"
      ? "FRED · S&P 500 公开指数日频观察"
      : "Yahoo Finance 公共日频观察";
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  useEffect(() => {
    setStart("");
    setEnd("");
    setSelectedDate("");
  }, [ticker, range, objectType]);
  const historyInput =
    objectType === "index"
      ? indexSeries?.history
      : security.data?.observation?.history;
  const all = useMemo(
    () => normalizeObservationHistory(historyInput),
    [historyInput]
  );
  const filtered = useMemo(
    () =>
      all.filter(
        row => (!start || row.date >= start) && (!end || row.date <= end)
      ),
    [all, start, end]
  );
  const result = useMemo(() => priceRiskSummary(filtered), [filtered]);
  const current =
    result.path.find(row => row.date === selectedDate) ?? result.path.at(-1);
  const currency =
    objectType === "index"
      ? "指数点"
      : (security.data?.observation?.currency ?? "币种未返回");
  const tabs = [
    ["drawdown", "峰值回撤"],
    ["return", "累计价格收益"],
    ["rows", "逐日风险明细"],
  ] as const;
  const exportRows = () => {
    const header = [
      "instrumentId",
      "date",
      "close",
      "currency",
      "cumulativePriceReturnPct",
      "drawdownPct",
      "adjacentPriceReturnPct",
      "source",
    ];
    const rows = result.path.map(row => [
      researchId,
      row.date,
      row.value,
      currency,
      row.cumulativeReturn,
      row.drawdown,
      row.returnPct,
      sourceName,
    ]);
    const csv = [header, ...rows]
      .map(row =>
        row
          .map(value => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `EQBT-${researchId.replace(":", "-")}-price-risk.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div aria-label="EQBT 历史收益与回撤工作台" className="min-w-0">
      <form
        onSubmit={event => {
          event.preventDefault();
          if (objectType === "index") {
            void environment.refetch();
            return;
          }
          const next = draft.trim().toUpperCase();
          if (/^[A-Z0-9.^=-]{1,15}$/.test(next)) {
            if (next === ticker) void security.refetch();
            else setTicker(next);
          }
        }}
        className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-2"
      >
        <label className="text-[10px] text-slate-500">
          研究对象
          <select
            aria-label="EQBT 研究对象"
            value={objectType}
            onChange={event =>
              setObjectType(event.target.value as typeof objectType)
            }
            className={`${field} ml-1`}
          >
            <option value="index">公开指数 S&amp;P 500（FRED）</option>
            <option value="security">指定证券（Yahoo 日频源）</option>
          </select>
        </label>
        {objectType === "security" && (
          <>
            <label className="text-[10px] text-slate-500">
              研究证券
              <input
                aria-label="EQBT 研究证券"
                value={draft}
                onChange={event => setDraft(event.target.value.toUpperCase())}
                className={`${field} ml-1 w-24`}
              />
            </label>
            <select
              aria-label="EQBT 历史读取范围"
              value={range}
              onChange={event => setRange(event.target.value as typeof range)}
              className={field}
            >
              {[
                ["1mo", "1M"],
                ["3mo", "3M"],
                ["6mo", "6M"],
                ["1y", "1Y"],
                ["2y", "2Y"],
                ["5y", "5Y"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="submit"
          disabled={
            !online ||
            query.isFetching ||
            (objectType === "security" &&
              !/^[A-Z0-9.^=-]{1,15}$/.test(draft.trim()))
          }
          className={button}
        >
          读取历史
        </button>
        <span role="status" className="text-[10px] text-amber-200">
          {!online
            ? "连接已断开 · 保留旧观察"
            : query.isFetching
              ? "正在读取"
              : query.isError
                ? "接口失败"
                : query.data?.status === "unavailable"
                  ? "来源不可用"
                  : "日频历史 · 每60秒核验来源"}
        </span>
      </form>
      {query.isLoading ? (
        <p role="status" className="p-6 text-xs text-slate-400">
          正在读取真实收盘历史…
        </p>
      ) : !all.length ? (
        <div
          role="status"
          className="border-b border-slate-800 p-6 text-xs leading-6 text-amber-200"
        >
          {query.error?.message ??
            query.data?.sourceBoundary ??
            "数据源未返回该证券有效历史。"}
          <p className="text-slate-500">
            EQBT
            需要至少两个有效收盘观察计算价格收益与回撤；当前不显示空报价表或虚构曲线。可调整证券代码与历史范围后重试。
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-2 py-2 text-[10px] text-slate-500">
            <label>
              研究起日
              <input
                aria-label="EQBT 研究起日"
                type="date"
                value={start}
                min={all[0]?.date}
                max={end || all.at(-1)?.date}
                onChange={event => setStart(event.target.value)}
                className={`${field} ml-1`}
              />
            </label>
            <label>
              研究止日
              <input
                aria-label="EQBT 研究止日"
                type="date"
                value={end}
                min={start || all[0]?.date}
                max={all.at(-1)?.date}
                onChange={event => setEnd(event.target.value)}
                className={`${field} ml-1`}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setStart("");
                setEnd("");
              }}
              className={button}
            >
              全部已读
            </button>
            <button
              type="button"
              disabled={!result.path.length}
              onClick={exportRows}
              className={button}
            >
              导出风险明细
            </button>
          </div>
          {!result.path.length ? (
            <p role="status" className="p-6 text-xs text-amber-200">
              当前起止日期没有有效观察，请调整研究区间。
            </p>
          ) : (
            <ResearchSplit
              label="EQBT 月度矩阵与风险曲线"
              left={
                <>
                  <table className="w-full text-[10px]">
                    <tbody>
                      {[
                        ["区间起止", `${result.start} → ${result.end}`],
                        ["有效收盘观察", result.sampleCount],
                        ["累计价格收益", `${fmt(result.cumulativeReturn)}%`],
                        ["最大峰值回撤", `${fmt(result.maxDrawdown)}%`],
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b border-slate-800">
                          <th className="px-2 py-2 text-left font-normal text-slate-500">
                            {label}
                          </th>
                          <td className="px-2 text-right font-mono text-slate-200">
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-b border-slate-800 p-2 text-xs text-cyan-100">
                    按月价格收益矩阵
                  </div>
                  <div className="max-h-[330px] overflow-auto">
                    <table className="w-full text-right text-[10px]">
                      <thead className="sticky top-0 bg-slate-950 text-slate-500">
                        <tr>
                          <th className="p-2 text-left">月份</th>
                          <th className="px-2">价格收益%</th>
                          <th className="px-2">观察数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.monthly.map(row => (
                          <tr
                            key={row.month}
                            className="border-b border-slate-800"
                          >
                            <td className="p-2 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  setStart(row.start);
                                  setEnd(row.end);
                                  setSelectedDate(row.end);
                                }}
                                className="text-cyan-200"
                                title={`${row.start} 至 ${row.end}；${row.partialStart ? "首月缺少前月基准，以首个观察计算" : "以前月最后观察为基准"}；当前月可能未结束`}
                              >
                                {row.month}
                                {row.partialStart ? " *" : ""}
                              </button>
                            </td>
                            <td
                              className="px-2 font-mono"
                              style={{
                                background:
                                  row.priceReturn >= 0
                                    ? "rgba(16,185,129,.18)"
                                    : "rgba(244,63,94,.18)",
                              }}
                            >
                              {fmt(row.priceReturn)}
                            </td>
                            <td className="px-2 text-slate-400">{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="p-2 text-[9px] leading-5 text-slate-500">
                    *
                    首月缺少前月观察，收益从首个观察开始；最后月份可能未结束。点击月份联动研究区间。无交易日不填零。
                  </p>
                </>
              }
              right={
                <>
                  <div
                    role="tablist"
                    aria-label="EQBT 风险图层"
                    className="flex overflow-x-auto border-b border-slate-800"
                  >
                    {tabs.map(([key, label], index) => (
                      <button
                        key={key}
                        id={`${paneId}-${key}`}
                        aria-controls={`${paneId}-plot`}
                        type="button"
                        role="tab"
                        aria-selected={view === key}
                        tabIndex={view === key ? 0 : -1}
                        onClick={() => setView(key)}
                        onKeyDown={event => {
                          if (
                            event.key === "ArrowRight" ||
                            event.key === "ArrowLeft"
                          ) {
                            event.preventDefault();
                            const next =
                              tabs[
                                (index +
                                  (event.key === "ArrowRight"
                                    ? 1
                                    : tabs.length - 1)) %
                                  tabs.length
                              ][0];
                            setView(next);
                            document
                              .getElementById(`${paneId}-${next}`)
                              ?.focus();
                          }
                        }}
                        className={`shrink-0 border-r border-slate-800 px-2 py-2 text-[11px] ${view === key ? "bg-cyan-950/30 text-cyan-100" : "text-slate-500"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 border-b border-slate-800 p-2 font-mono text-[10px] text-slate-400">
                    {current?.date} · 收盘 {fmt(current?.value)} {currency} ·
                    回撤 {fmt(current?.drawdown)}% · 累计{" "}
                    {fmt(current?.cumulativeReturn)}%
                  </div>
                  <div
                    id={`${paneId}-plot`}
                    role="tabpanel"
                    aria-labelledby={`${paneId}-${view}`}
                  >
                    {result.sampleCount < 2 ? (
                      <p className="p-6 text-xs text-amber-200">
                        只有一个有效观察，不足以展示收益或回撤曲线。
                      </p>
                    ) : view === "rows" ? (
                      <div className="max-h-[310px] overflow-auto">
                        <table className="w-full text-right text-[10px]">
                          <thead className="sticky top-0 bg-slate-950 text-slate-500">
                            <tr>
                              <th className="p-2 text-left">观察日</th>
                              <th>收盘</th>
                              <th>累计%</th>
                              <th>回撤%</th>
                              <th className="pr-2">相邻变化%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...result.path].reverse().map(row => (
                              <tr
                                key={row.date}
                                className="border-b border-slate-800"
                              >
                                <td className="p-2 text-left">
                                  <button
                                    className="text-cyan-200"
                                    type="button"
                                    onClick={() => setSelectedDate(row.date)}
                                  >
                                    {row.date}
                                  </button>
                                </td>
                                <td>{fmt(row.value)}</td>
                                <td>{fmt(row.cumulativeReturn)}</td>
                                <td>{fmt(row.drawdown)}</td>
                                <td className="pr-2">{fmt(row.returnPct)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="h-[300px] p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          {view === "drawdown" ? (
                            <AreaChart
                              data={result.path}
                              onMouseMove={(event: any) => {
                                if (typeof event?.activeLabel === "string")
                                  setSelectedDate(event.activeLabel);
                              }}
                            >
                              <CartesianGrid stroke="#1e293b" />
                              <XAxis
                                dataKey="date"
                                minTickGap={24}
                                tick={{ fill: "#94a3b8", fontSize: 9 }}
                              />
                              <YAxis
                                tick={{ fill: "#94a3b8", fontSize: 9 }}
                                tickFormatter={value => `${value}%`}
                              />
                              <Tooltip {...tip} />
                              <Area
                                dataKey="drawdown"
                                name="峰值回撤 %"
                                stroke="#fb7185"
                                fill="#881337"
                                isAnimationActive={false}
                              />
                              <Brush
                                dataKey="date"
                                height={18}
                                stroke="#334155"
                                fill="#020617"
                              />
                            </AreaChart>
                          ) : (
                            <LineChart
                              data={result.path}
                              onMouseMove={(event: any) => {
                                if (typeof event?.activeLabel === "string")
                                  setSelectedDate(event.activeLabel);
                              }}
                            >
                              <CartesianGrid stroke="#1e293b" />
                              <XAxis
                                dataKey="date"
                                minTickGap={24}
                                tick={{ fill: "#94a3b8", fontSize: 9 }}
                              />
                              <YAxis
                                tick={{ fill: "#94a3b8", fontSize: 9 }}
                                tickFormatter={value => `${value}%`}
                              />
                              <Tooltip {...tip} />
                              <Line
                                dataKey="cumulativeReturn"
                                name="累计价格收益 %"
                                stroke="#22d3ee"
                                dot={false}
                                isAnimationActive={false}
                              />
                              <Brush
                                dataKey="date"
                                height={18}
                                stroke="#334155"
                                fill="#020617"
                              />
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </>
              }
            />
          )}
        </>
      )}
      <footer className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">
        研究对象 {researchId} · 来源 {sourceName} · 市场观察{" "}
        {all.at(-1)?.date ?? "未返回"} · 查询 UTC{" "}
        {query.dataUpdatedAt
          ? new Date(query.dataUpdatedAt).toISOString()
          : "—"}
        。累计价格收益=期末/期初−1；回撤=当前/截至当前峰值−1。企业行动与分红调整未经独立核验，非总回报、非策略回测，不含费用或执行滑点。对象由用户显式选择，来源失败不会改成另一证券或指数。
      </footer>
    </div>
  );
}

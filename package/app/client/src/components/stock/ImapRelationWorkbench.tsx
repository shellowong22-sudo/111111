import React, { useEffect, useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import {
  ResearchSplit,
  environmentObservationUnit,
} from "./StockObservationDesk";
import {
  environmentRelationMatrix,
  type RelationSeries,
} from "./stockRelativeResearch";
import { formatObservation as fmt } from "./stockObservationModel";

const inputClass = "input-terminal h-7 px-2 text-[11px]";
const buttonClass =
  "border border-slate-700 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40";
const tooltip = {
  contentStyle: {
    background: "#070d18",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 10,
  },
};

export default function ImapRelationWorkbench() {
  const tabId = useId();
  const [windowDays, setWindowDays] = useState(90);
  const [minimumPairs, setMinimumPairs] = useState(20);
  const [selected, setSelected] = useState({ left: "SP500", right: "VIXCLS" });
  const [view, setView] = useState<"scatter" | "pairs">("scatter");
  const [period, setPeriod] = useState("");
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  const query = trpc.stockMarketResearch.getEnvironment.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnReconnect: true,
  });
  const series = (query.data?.series ?? []) as RelationSeries[];
  const matrix = useMemo(
    () => environmentRelationMatrix(series, windowDays, minimumPairs),
    [query.data?.series, windowDays, minimumPairs]
  );
  const selectedCell = matrix.find(
    row => row.leftId === selected.left && row.rightId === selected.right
  );
  const left = series.find(row => row.id === selected.left);
  const right = series.find(row => row.id === selected.right);
  const pairs = selectedCell?.pairs ?? [];
  const picked = pairs.find(row => row.period === period) ?? pairs.at(-1);
  const select = (left: string, right: string) => {
    setSelected({ left, right });
    setPeriod("");
  };
  const exportRows = () => {
    const rows = [
      [
        "leftIndicatorId",
        "rightIndicatorId",
        "observationInterval",
        "leftChange",
        "rightChange",
        "leftUnit",
        "rightUnit",
        "source",
      ],
      ...pairs.map(row => [
        selected.left,
        selected.right,
        row.period,
        row.x,
        row.y,
        environmentObservationUnit(left),
        environmentObservationUnit(right),
        "FRED",
      ]),
    ];
    const csv = rows
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
    link.download = `IMAP-${selected.left}-${selected.right}-intervals.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const empty =
    series.length === 0 ||
    !series.some(row => Array.isArray(row.history) && row.history.length > 1);
  return (
    <div aria-label="IMAP 跨市场关系工作台" className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2">
        <label className="text-[10px] text-slate-500">
          共同日期窗口
          <select
            aria-label="IMAP 共同日期窗口"
            value={windowDays}
            onChange={event => setWindowDays(Number(event.target.value))}
            className={`${inputClass} ml-1`}
          >
            <option value={30}>30 日历日</option>
            <option value={90}>90 日历日</option>
            <option value={180}>180 日历日</option>
            <option value={365}>365 日历日 / 全部已读</option>
          </select>
        </label>
        <label className="text-[10px] text-slate-500">
          最小配对样本
          <select
            aria-label="IMAP 最小配对样本"
            value={minimumPairs}
            onChange={event => setMinimumPairs(Number(event.target.value))}
            className={`${inputClass} ml-1`}
          >
            <option value={3}>3 个变化区间</option>
            <option value={20}>20 个变化区间</option>
            <option value={60}>60 个变化区间</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={!online || query.isFetching}
          className={buttonClass}
        >
          刷新关系数据
        </button>
        <span role="status" className="text-[10px] text-amber-200">
          {!online
            ? "断线 · 保留旧观察"
            : query.isFetching
              ? "读取共同来源"
              : query.isError
                ? "来源读取失败"
                : "日频变化 · 每60秒核验"}
        </span>
      </div>
      {query.isLoading ? (
        <p role="status" className="p-6 text-xs text-slate-400">
          正在读取真实跨市场历史观察…
        </p>
      ) : empty ? (
        <p
          role="status"
          className="border-b border-slate-800 p-6 text-xs text-amber-200"
        >
          {query.error?.message ??
            "FRED 未返回足够的有效历史，暂不能计算变化关系；不填充零值或生成假相关性。"}
        </p>
      ) : (
        <ResearchSplit
          label="IMAP 相关性矩阵与证据图层"
          left={
            <>
              <div className="border-b border-slate-800 p-2 text-xs text-cyan-100">
                跨序列变化相关性矩阵
              </div>
              <div className="max-h-[375px] overflow-auto">
                <table className="min-w-[560px] w-full text-center text-[9px]">
                  <thead className="sticky top-0 bg-slate-950">
                    <tr>
                      <th className="sticky left-0 bg-slate-950 px-2 text-left text-slate-500">
                        Δ 相关性
                      </th>
                      {series.map(row => (
                        <th
                          key={row.id}
                          className="px-1 py-2 font-mono text-slate-400"
                          title={row.label}
                        >
                          {row.id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {series.map(lhs => (
                      <tr key={lhs.id}>
                        <th
                          className="sticky left-0 border-t border-slate-800 bg-slate-950 p-2 text-left font-normal text-cyan-200"
                          title={lhs.label}
                        >
                          {lhs.id}
                        </th>
                        {series.map(rhs => {
                          const cell = matrix.find(
                            item =>
                              item.leftId === lhs.id && item.rightId === rhs.id
                          );
                          const value = cell?.correlation;
                          const chosen =
                            selected.left === lhs.id &&
                            selected.right === rhs.id;
                          if (!cell)
                            return (
                              <td
                                key={rhs.id}
                                aria-hidden="true"
                                className="border border-slate-800 bg-slate-950 text-slate-700"
                              >
                                {lhs.id === rhs.id ? "自身" : ""}
                              </td>
                            );
                          return (
                            <td
                              key={rhs.id}
                              className="border border-slate-800 p-0"
                            >
                              <button
                                type="button"
                                aria-label={`查看 ${lhs.id} 与 ${rhs.id} 变化关系`}
                                aria-pressed={chosen}
                                onClick={() => select(lhs.id, rhs.id)}
                                className={`w-full px-1 py-3 font-mono focus:outline focus:outline-1 focus:outline-cyan-100 ${chosen ? "outline outline-1 outline-cyan-200" : "text-slate-200"}`}
                                style={{
                                  background:
                                    value == null
                                      ? "#0b1323"
                                      : `rgba(${value >= 0 ? "16,185,129" : "244,63,94"},${0.08 + Math.abs(value) * 0.45})`,
                                }}
                                title={`${lhs.label} / ${rhs.label}；${cell?.count ?? 0} 个共同变化区间；${cell?.state === "constant" ? "常量序列不可计算" : cell?.state === "insufficient" ? "样本不足" : "Pearson相关性"}`}
                              >
                                {value == null ? "—" : fmt(value, 2)}
                                <span className="block text-[8px] text-slate-400">
                                  n={cell?.count ?? 0}
                                </span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-slate-800 p-2 text-[9px] leading-5 text-slate-500">
                颜色=变化相关性：绿为正、红为负；n
                为相同起止日期的变化区间数。这里只比较
                Δ序列，不比较报价高低、原始水平或因果关系。每对关系只展示一次，不重复镜像数据；点击上三角单元格联动散点与证据。
              </p>
            </>
          }
          right={
            <>
              <div className="border-b border-slate-800 p-2 text-[10px] leading-5 text-slate-400">
                <span className="text-cyan-100">
                  {left?.label ?? selected.left} ↔{" "}
                  {right?.label ?? selected.right}
                </span>
                <div>
                  r={fmt(selectedCell?.correlation, 4)} · n=
                  {selectedCell?.count ?? 0} · 窗口 {windowDays} 日历日 · 最低{" "}
                  {minimumPairs} 变化区间
                </div>
              </div>
              <div
                role="tablist"
                aria-label="IMAP 关系证据图层"
                className="flex border-b border-slate-800"
              >
                {(
                  [
                    ["scatter", "变化散点"],
                    ["pairs", "配对区间明细"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    type="button"
                    role="tab"
                    id={`${tabId}-${key}`}
                    aria-controls={`${tabId}-data`}
                    key={key}
                    aria-selected={view === key}
                    tabIndex={view === key ? 0 : -1}
                    onClick={() => setView(key)}
                    onKeyDown={event => {
                      if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowRight"
                      ) {
                        event.preventDefault();
                        const next = view === "scatter" ? "pairs" : "scatter";
                        setView(next);
                        document.getElementById(`${tabId}-${next}`)?.focus();
                      }
                    }}
                    className={`border-r border-slate-800 px-2 py-2 text-[10px] ${view === key ? "bg-cyan-950/30 text-cyan-100" : "text-slate-500"}`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!pairs.length}
                  onClick={exportRows}
                  className={`${buttonClass} ml-auto`}
                >
                  导出配对证据
                </button>
              </div>
              <div
                id={`${tabId}-data`}
                role="tabpanel"
                aria-labelledby={`${tabId}-${view}`}
              >
                {selectedCell?.state !== "available" && (
                  <p
                    role="status"
                    className="border-b border-slate-800 p-2 text-[10px] text-amber-200"
                  >
                    {selectedCell?.state === "constant"
                      ? "一条序列在当前样本中没有变化，相关系数没有定义。"
                      : "共同变化区间未达到最小样本要求，不显示相关系数。"}
                    有效原始区间仍可复核。
                  </p>
                )}
                {view === "pairs" ? (
                  <div className="max-h-[300px] overflow-auto">
                    <table className="w-full text-right text-[10px]">
                      <thead className="sticky top-0 bg-slate-950 text-slate-500">
                        <tr>
                          <th className="p-2 text-left">共同起止日</th>
                          <th>Δ {selected.left}</th>
                          <th className="pr-2">Δ {selected.right}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...pairs].reverse().map(row => (
                          <tr
                            key={row.period}
                            className="border-b border-slate-800"
                          >
                            <td className="p-2 text-left">
                              <button
                                type="button"
                                onClick={() => setPeriod(row.period)}
                                className="text-cyan-200"
                              >
                                {row.period.replace("/", " → ")}
                              </button>
                            </td>
                            <td>{fmt(row.x, 4)}</td>
                            <td className="pr-2">{fmt(row.y, 4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : pairs.length ? (
                  <div className="h-[290px] p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 10, right: 14, bottom: 18, left: 3 }}
                      >
                        <CartesianGrid stroke="#1e293b" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          name={`Δ ${selected.left}`}
                          tick={{ fill: "#94a3b8", fontSize: 9 }}
                          domain={["auto", "auto"]}
                          label={{
                            value: `Δ ${selected.left} (${environmentObservationUnit(left)})`,
                            position: "insideBottom",
                            offset: -14,
                            fill: "#94a3b8",
                            fontSize: 9,
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          name={`Δ ${selected.right}`}
                          tick={{ fill: "#94a3b8", fontSize: 9 }}
                          domain={["auto", "auto"]}
                        />
                        <ReferenceLine x={0} stroke="#475569" />
                        <ReferenceLine y={0} stroke="#475569" />
                        <Tooltip
                          {...tooltip}
                          cursor={{ strokeDasharray: "3 3" }}
                        />
                        <Scatter
                          name="同起止日观察变化"
                          data={pairs}
                          fill="#22d3ee"
                          isAnimationActive={false}
                          onClick={(point: any) => {
                            if (typeof point?.period === "string")
                              setPeriod(point.period);
                          }}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                {picked && (
                  <div className="border-t border-slate-800 p-2 font-mono text-[10px] text-slate-400">
                    {picked.period.replace("/", " → ")} · Δ{selected.left}{" "}
                    {fmt(picked.x, 4)} {environmentObservationUnit(left)} · Δ
                    {selected.right} {fmt(picked.y, 4)}{" "}
                    {environmentObservationUnit(right)}
                  </div>
                )}
              </div>
            </>
          }
        />
      )}
      <footer className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">
        共享来源 FRED · 读取 UTC {query.data?.asOf ?? "—"} · 当前配对观察日{" "}
        {left?.observationDate ?? "—"} / {right?.observationDate ?? "—"}
        。指标变化=当前观察−上一有效观察，仅相同起止日期配对，不向前填充。利率及利差的
        Δ
        单位为百分点，指数为指数点；相关性无量纲。缺失、常量及样本不足明确区分；不是资金流、因果或预测模型。
      </footer>
    </div>
  );
}

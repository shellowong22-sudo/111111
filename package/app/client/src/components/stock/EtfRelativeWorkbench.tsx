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
import { trpc } from "@/lib/trpc";
import { ResearchSplit } from "./StockObservationDesk";
import { compareEtfPrices } from "./stockRelativeResearch";
import { formatObservation as fmt } from "./stockObservationModel";

const inputClass = "input-terminal h-7 px-2 text-[11px]";
const buttonClass =
  "border border-slate-700 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40";
const tip = {
  contentStyle: {
    background: "#070d18",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 11,
  },
};
const validTicker = (value: string) =>
  /^[A-Z0-9.^=-]{1,15}$/.test(value.trim());

export default function EtfRelativeWorkbench() {
  const id = useId();
  const [draft, setDraft] = useState({ fund: "QQQ", reference: "SPY" });
  const [pair, setPair] = useState(draft);
  const [range, setRange] = useState<
    "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y"
  >("1y");
  const [view, setView] = useState<"relative" | "index" | "active" | "rows">(
    "relative"
  );
  const [selectedDate, setSelectedDate] = useState("");
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
  const fundInput = { ticker: pair.fund, range, assetClass: "etf" as const };
  const referenceInput = {
    ticker: pair.reference,
    range,
    assetClass: "etf" as const,
  };
  const options = {
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnReconnect: true,
  };
  const fund = trpc.stockMarketResearch.getTickerObservation.useQuery(
    fundInput,
    options
  );
  const reference = trpc.stockMarketResearch.getTickerObservation.useQuery(
    referenceInput,
    options
  );
  const result = useMemo(
    () =>
      compareEtfPrices(
        fund.data?.observation?.history,
        reference.data?.observation?.history
      ),
    [fund.data?.observation?.history, reference.data?.observation?.history]
  );
  const currencies = [
    fund.data?.observation?.currency,
    reference.data?.observation?.currency,
  ];
  const sameCurrency = currencies[0] != null && currencies[0] === currencies[1];
  const fetching = fund.isFetching || reference.isFetching;
  const current =
    result.rows.find(row => row.date === selectedDate) ?? result.rows.at(-1);
  const tabs = [
    ["relative", "相对价格路径"],
    ["index", "共同起点比较"],
    ["active", "区间超额变化"],
    ["rows", "对齐数据明细"],
  ] as const;
  const source = (data: typeof fund.data) =>
    data && "sourceLabel" in data ? data.sourceLabel : "公开 ETF 日频来源";
  const exportRows = () => {
    const rows = [
      [
        "date",
        "fund",
        "reference",
        "fundClose",
        "referenceClose",
        "fundCurrency",
        "referenceCurrency",
        "fundIndexed",
        "referenceIndexed",
        "relativeReturnPct",
        "activeIntervalReturnPct",
      ],
      ...result.rows.map(row => [
        row.date,
        pair.fund,
        pair.reference,
        row.left,
        row.right,
        currencies[0],
        currencies[1],
        row.leftIndex,
        row.rightIndex,
        row.relativeReturn,
        row.activeReturn,
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
    link.download = `ETF-${pair.fund}-vs-${pair.reference}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div aria-label="ETF 相对表现工作台" className="min-w-0">
      <form
        onSubmit={event => {
          event.preventDefault();
          const next = {
            fund: draft.fund.trim().toUpperCase(),
            reference: draft.reference.trim().toUpperCase(),
          };
          if (
            !validTicker(next.fund) ||
            !validTicker(next.reference) ||
            next.fund === next.reference
          )
            return;
          if (next.fund === pair.fund && next.reference === pair.reference) {
            void fund.refetch();
            void reference.refetch();
          } else {
            setPair(next);
            setSelectedDate("");
          }
        }}
        className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-2"
      >
        <label className="text-[10px] text-slate-500">
          研究 ETF
          <input
            aria-label="研究 ETF 代码"
            className={`${inputClass} ml-1 w-20`}
            value={draft.fund}
            onChange={event =>
              setDraft(current => ({
                ...current,
                fund: event.target.value.toUpperCase(),
              }))
            }
          />
        </label>
        <label className="text-[10px] text-slate-500">
          参考 ETF
          <input
            aria-label="参考 ETF 代码"
            className={`${inputClass} ml-1 w-20`}
            value={draft.reference}
            onChange={event =>
              setDraft(current => ({
                ...current,
                reference: event.target.value.toUpperCase(),
              }))
            }
          />
        </label>
        <select
          aria-label="ETF 历史范围"
          className={inputClass}
          value={range}
          onChange={event => setRange(event.target.value as typeof range)}
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
        <button
          type="submit"
          disabled={
            !online ||
            fetching ||
            !validTicker(draft.fund) ||
            !validTicker(draft.reference) ||
            draft.fund.trim() === draft.reference.trim()
          }
          className={buttonClass}
        >
          比较价格表现
        </button>
        <span role="status" className="text-[10px] text-amber-200">
          {!online
            ? "断线 · 保留旧观察"
            : fetching
              ? "正在读取两只 ETF"
              : fund.isError || reference.isError
                ? "来源读取失败"
                : result.count < 2
                  ? "共同历史不足"
                  : "公开日频 · 每60秒核验"}
        </span>
      </form>
      {draft.fund.trim() === draft.reference.trim() && (
        <p className="border-b border-slate-800 px-2 py-1 text-[10px] text-amber-200">
          研究与参考 ETF 必须不同，避免重复同一序列。
        </p>
      )}
      {fund.isLoading || reference.isLoading ? (
        <p role="status" className="p-6 text-xs text-slate-400">
          正在对齐实际 ETF 交易价格历史…
        </p>
      ) : result.count < 2 ? (
        <div
          role="status"
          className="border-b border-slate-800 p-6 text-xs leading-6 text-amber-200"
        >
          {pair.fund} / {pair.reference} 未取得至少两个共同日期观察。
          {fund.isError
            ? fund.error.message
            : reference.isError
              ? reference.error.message
              : null}
          <p className="text-slate-500">
            {!fund.data?.observation ? `${pair.fund} 来源无有效记录。` : ""}
            {!reference.data?.observation
              ? `${pair.reference} 来源无有效记录。`
              : ""}
            两边均须有真实交易价格；不以指数、另一基金或净值替换。可修改代码或范围后重新读取。
          </p>
        </div>
      ) : (
        <ResearchSplit
          label="ETF 比较口径与相对图层"
          left={
            <>
              <table className="w-full text-[11px]">
                <tbody>
                  {[
                    [
                      "研究 ETF",
                      `${pair.fund} · ${fund.data?.observation?.name ?? ""}`,
                    ],
                    [
                      "参考 ETF",
                      `${pair.reference} · ${reference.data?.observation?.name ?? ""}`,
                    ],
                    ["共同日期区间", `${result.start} → ${result.end}`],
                    [
                      "对齐观察 / 变化区间",
                      `${result.count} / ${result.intervalCount}`,
                    ],
                    ["研究 ETF 价格收益", `${fmt(result.fundReturn)}%`],
                    ["参考 ETF 价格收益", `${fmt(result.referenceReturn)}%`],
                    ["相对累计价格收益", `${fmt(result.relativeReturn)}%`],
                    [
                      "区间超额变化样本标准差",
                      `${fmt(result.activeDispersion)} 个百分点`,
                    ],
                  ].map(([label, value]) => (
                    <tr
                      key={label}
                      className="border-b border-slate-800 align-top"
                    >
                      <th className="p-2 text-left font-normal text-slate-500">
                        {label}
                      </th>
                      <td className="p-2 text-right font-mono text-slate-200">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-b border-slate-800 px-2 py-2 text-[10px] leading-5 text-slate-500">
                交易货币：{pair.fund} {currencies[0] ?? "未返回"} /{" "}
                {pair.reference} {currencies[1] ?? "未返回"}。
                {!sameCurrency && (
                  <span className="text-amber-200">
                    未统一币种，不是同一投资者币种回报。
                  </span>
                )}
                参考 ETF 是用户比较对象，不表示基金法定基准或复制指数。
              </div>
              <details className="border-b border-slate-800 p-2 text-[10px] text-slate-500">
                <summary className="cursor-pointer text-cyan-200">
                  净值与复制质量资料边界
                </summary>
                <p className="py-2 leading-5">
                  尚未提供同日
                  NAV、基金持仓、费用与分红事件，不能计算折溢价、持仓重合度或法定跟踪误差。此处均为交易价格，不把市场价格标成
                  NAV。
                </p>
              </details>
            </>
          }
          right={
            <>
              <div
                role="tablist"
                aria-label="ETF 比较数据图层"
                className="flex overflow-x-auto border-b border-slate-800"
              >
                {tabs.map(([key, label], index) => (
                  <button
                    id={`${id}-${key}`}
                    aria-controls={`${id}-plot`}
                    type="button"
                    role="tab"
                    key={key}
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
                        document.getElementById(`${id}-${next}`)?.focus();
                      }
                    }}
                    className={`shrink-0 border-r border-slate-800 px-2 py-2 text-[10px] ${view === key ? "bg-cyan-950/30 text-cyan-100" : "text-slate-500"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 p-2 text-[10px] text-slate-400">
                <span>
                  {current?.date} · {pair.fund} {fmt(current?.left)} /{" "}
                  {pair.reference} {fmt(current?.right)} · 相对{" "}
                  {fmt(current?.relativeReturn)}%
                </span>
                <button
                  type="button"
                  onClick={exportRows}
                  className={buttonClass}
                >
                  导出对齐数据
                </button>
              </div>
              <div
                id={`${id}-plot`}
                role="tabpanel"
                aria-labelledby={`${id}-${view}`}
              >
                {view === "rows" ? (
                  <div className="max-h-[330px] overflow-auto">
                    <table className="w-full min-w-[460px] text-right text-[10px]">
                      <thead className="sticky top-0 bg-slate-950 text-slate-500">
                        <tr>
                          <th className="p-2 text-left">共同观察日</th>
                          <th>{pair.fund}收盘</th>
                          <th>{pair.reference}收盘</th>
                          <th>相对累计%</th>
                          <th className="pr-2">超额变化百分点</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...result.rows].reverse().map(row => (
                          <tr
                            key={row.date}
                            className="border-b border-slate-800"
                          >
                            <td className="p-2 text-left">
                              <button
                                type="button"
                                onClick={() => setSelectedDate(row.date)}
                                className="text-cyan-200"
                              >
                                {row.date}
                              </button>
                            </td>
                            <td>{fmt(row.left)}</td>
                            <td>{fmt(row.right)}</td>
                            <td>{fmt(row.relativeReturn)}</td>
                            <td className="pr-2">{fmt(row.activeReturn)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-[310px] p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      {view === "active" ? (
                        <BarChart
                          data={result.rows}
                          onMouseMove={(event: any) => {
                            if (typeof event?.activeLabel === "string")
                              setSelectedDate(event.activeLabel);
                          }}
                        >
                          <CartesianGrid stroke="#1e293b" />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "#94a3b8", fontSize: 9 }}
                            minTickGap={22}
                          />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} />
                          <Tooltip {...tip} />
                          <Bar
                            dataKey="activeReturn"
                            name="相同日期区间价格变化差（百分点）"
                            fill="#a78bfa"
                            isAnimationActive={false}
                          />
                          <Brush
                            dataKey="date"
                            height={18}
                            stroke="#334155"
                            fill="#020617"
                          />
                        </BarChart>
                      ) : (
                        <LineChart
                          data={result.rows}
                          onMouseMove={(event: any) => {
                            if (typeof event?.activeLabel === "string")
                              setSelectedDate(event.activeLabel);
                          }}
                        >
                          <CartesianGrid stroke="#1e293b" />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: "#94a3b8", fontSize: 9 }}
                            minTickGap={22}
                          />
                          <YAxis
                            tick={{ fill: "#94a3b8", fontSize: 9 }}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip {...tip} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          {view === "index" ? (
                            <>
                              <Line
                                dataKey="leftIndex"
                                name={`${pair.fund} · 共同起点=100`}
                                stroke="#22d3ee"
                                dot={false}
                                isAnimationActive={false}
                              />
                              <Line
                                dataKey="rightIndex"
                                name={`${pair.reference} · 共同起点=100`}
                                stroke="#fbbf24"
                                dot={false}
                                isAnimationActive={false}
                              />
                            </>
                          ) : (
                            <Line
                              dataKey="relativeReturn"
                              name="相对累计价格收益 %"
                              stroke="#22d3ee"
                              dot={false}
                              isAnimationActive={false}
                            />
                          )}
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
      <footer className="border-t border-slate-800 p-2 text-[10px] leading-5 text-slate-500">
        来源：{pair.fund} {source(fund.data)} / {pair.reference}{" "}
        {source(reference.data)} · 市场观察{" "}
        {fund.data?.observation?.observationDate ?? "未返回"} /{" "}
        {reference.data?.observation?.observationDate ?? "未返回"} · 读取 UTC{" "}
        {fund.data?.observation?.retrievedAt ?? "—"} /{" "}
        {reference.data?.observation?.retrievedAt ?? "—"}
        。共同起点归一化；相对累计=(研究价格/研究首价)/(参考价格/参考首价)−1。区间超额变化=同起止日期两只
        ETF
        价格变化之差；样本标准差不年化，不称跟踪误差。非总回报、未核验分红及拆分调整，缺失日期不填充。
      </footer>
    </div>
  );
}

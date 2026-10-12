import React, { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookmarkPlus,
  Download,
  LayoutGrid,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { calculateStockResearchScore } from "@/lib/stockResearchScore";
import StockNCEOResearchWatchboard from "./StockNCEOResearchWatchboard";
import StockResearchBacktestPanel from "./StockResearchBacktestPanel";
import { CockpitKline, CockpitNews, CockpitQuote } from "@/components/live/CockpitLive";
import { NceoOptionsCard } from "@/components/live/NceoOptionsLive";

const cockpitSymbols = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY", "QQQ"];
const dailyRanges = ["5d", "1mo", "3mo"] as const;
type DailyRange = (typeof dailyRanges)[number];
type OptionLeg = "call" | "put";
type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  average: number;
  sma5: number | null;
  sma10: number | null;
  bollUpper: number | null;
  bollLower: number | null;
};
const boardColumns = [
  "symbol",
  "kind",
  "modelStatus",
  "sourceStatus",
  "updatedAt",
] as const;
type BoardColumn = (typeof boardColumns)[number];
const gridClass: Record<string, string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
};

const money = (value: number | null | undefined) =>
  Number.isFinite(value) ? `$${Number(value).toFixed(2)}` : "—";
const integer = (value: number | null | undefined) =>
  Number.isFinite(value)
    ? Math.round(Number(value)).toLocaleString("en-US")
    : "—";

function rollingAverage(values: number[], index: number, size: number) {
  if (index + 1 < size) return null;
  const sample = values.slice(index - size + 1, index + 1);
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

function makeStudy(
  raw: Array<{
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
  }>
): DailyBar[] {
  const valid = raw.filter(
    (
      row
    ): row is {
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number | null;
    } =>
      row.open != null &&
      row.high != null &&
      row.low != null &&
      row.close != null
  );
  const closes = valid.map(row => row.close);
  return valid.map((row, index) => {
    const sma5 = rollingAverage(closes, index, 5);
    const basis = rollingAverage(closes, index, 10);
    const sample = index + 1 < 10 ? [] : closes.slice(index - 9, index + 1);
    const standardDeviation = sample.length
      ? Math.sqrt(
          sample.reduce(
            (sum, value) => sum + (value - (basis ?? value)) ** 2,
            0
          ) / sample.length
        )
      : null;
    return {
      ...row,
      average: (row.high + row.low + row.close) / 3,
      sma5,
      sma10: basis,
      bollUpper:
        basis != null && standardDeviation != null
          ? basis + 2 * standardDeviation
          : null,
      bollLower:
        basis != null && standardDeviation != null
          ? basis - 2 * standardDeviation
          : null,
    };
  });
}

/** 股票智能驾驶舱：实时报价与多周期 K 线、日线评分与回测、期权摘要、新闻与自选看板；不发送交易订单。 */
export default function StockNCEOCockpitPanel({
  onClose,
  onOpenNceo,
}: {
  onClose?: () => void;
  onOpenNceo: (symbol: string) => void;
}) {
  const [symbol, setSymbol] = useState("AAPL");
  const [range, setRange] = useState<DailyRange>("3mo");
  const [leg, setLeg] = useState<OptionLeg>("call");
  const [thresholdInput, setThresholdInput] = useState("");
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const historyQuery = trpc.market.getHistory.useQuery(
    { symbol, range },
    { retry: false }
  );
  const benchmarkQuery = trpc.market.getHistory.useQuery(
    { symbol: "SPY", range },
    { retry: false }
  );
  const historyRows =
    historyQuery.data?.available && historyQuery.data.history?.length
      ? historyQuery.data.history
      : [];
  const study = useMemo(() => makeStudy(historyRows), [historyRows]);
  const latest = study.at(-1);
  const previous = study.at(-2);
  const changePct =
    latest && previous && previous.close
      ? ((latest.close - previous.close) / previous.close) * 100
      : null;
  const support = useMemo(
    () =>
      study.length ? Math.min(...study.slice(-20).map(bar => bar.low)) : null,
    [study]
  );
  const resistance = useMemo(
    () =>
      study.length ? Math.max(...study.slice(-20).map(bar => bar.high)) : null,
    [study]
  );
  const averageVolume = useMemo(() => {
    const values = study
      .slice(-20)
      .map(bar => bar.volume)
      .filter((value): value is number => value != null);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }, [study]);
  const volumeRatio =
    latest?.volume != null && averageVolume
      ? latest.volume / averageVolume
      : null;
  const amplitude = latest
    ? ((latest.high - latest.low) / latest.close) * 100
    : null;
  const trend =
    latest?.sma5 != null && latest.sma10 != null
      ? latest.close > latest.sma5 && latest.sma5 > latest.sma10
        ? "日频研究：偏强"
        : latest.close < latest.sma5 && latest.sma5 < latest.sma10
          ? "日频研究：偏弱"
          : "日频研究：震荡"
      : "日频研究：样本不足";
  const researchScore = useMemo(
    () => calculateStockResearchScore(study),
    [study]
  );
  const threshold = Number(thresholdInput);
  const thresholdState =
    thresholdEnabled && Number.isFinite(threshold) && latest
      ? latest.close >= threshold
        ? `当前日频收盘 ${money(latest.close)} 已触及或高于会话观察阈值 ${money(threshold)}。`
        : `当前日频收盘 ${money(latest.close)} 尚未触及会话观察阈值 ${money(threshold)}。`
      : "未设置会话观察阈值；不会创建后台持续告警。";
  const sourceBoundary = "日线数据暂未返回，请稍后刷新。";
  const hasHistory = study.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#080b13] text-slate-100">
      <div className="flex shrink-0 items-center justify-between border-b border-cyan-900/70 bg-[#101827] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-300" />
          <span className="truncate text-sm font-semibold text-cyan-100">
            股票智能驾驶舱 · NCEO 联动
          </span>
          <span className="hidden border border-cyan-900 px-1.5 py-0.5 text-[10px] text-cyan-100 sm:inline">
            实时
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="刷新股票驾驶舱观察"
            onClick={() => {
              void historyQuery.refetch();
              void benchmarkQuery.refetch();
            }}
            className="text-slate-400 hover:text-cyan-200"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              aria-label="关闭股票智能驾驶舱"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-px overflow-y-auto bg-slate-800 p-px pb-20">
        <section className="bg-[#0d1220] p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">投资标的选择</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {cockpitSymbols.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSymbol(item);
                      setThresholdEnabled(false);
                    }}
                    className={`border px-2 py-1 font-mono text-xs ${symbol === item ? "border-cyan-400 bg-cyan-950/40 text-cyan-100" : "border-slate-700 text-slate-400 hover:text-slate-100"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">日线评分区间</div>
              <div className="mt-2 flex gap-1">
                {dailyRanges.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setRange(item);
                    }}
                    className={`border px-2 py-1 text-[10px] ${range === item ? "border-cyan-500 bg-cyan-950/50 text-cyan-100" : "border-slate-700 bg-[#080b13] text-slate-400"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-slate-800 pt-2">
            <CockpitQuote symbol={symbol} />
          </div>
        </section>
        <CockpitKline symbol={symbol} />
        {historyQuery.isLoading && (
          <div className="border border-dashed border-slate-700 bg-[#0d1220] p-3 text-xs text-slate-500">
            正在读取 {symbol} 的日频 OHLCV；数据层准备完成后显示最新观察。
          </div>
        )}
        {!historyQuery.isLoading && !hasHistory && (
          <div className="border border-amber-900/70 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">
            <strong>{symbol} 日线数据暂未更新。</strong>
            <p className="mt-1">{sourceBoundary}</p>
          </div>
        )}
        {hasHistory && (
          <section
            className="overflow-x-auto bg-[#0d1220]"
            aria-label="股票标的研究评分"
          >
            <div className="border-b border-cyan-900/60 px-3 py-2">
              <h3 className="text-sm font-semibold text-cyan-100">
                {symbol} · 日线研究评分
              </h3>
              <p className="mt-1 max-w-4xl text-[10px] leading-4 text-slate-400">
                {researchScore.methodology}
              </p>
            </div>
            <table className="w-full min-w-[720px] table-fixed text-left text-[10px]">
              <thead className="bg-[#080b13] text-slate-500">
                <tr>
                  <th className="border-r border-slate-800 px-2 py-1.5">
                    研究总分
                  </th>
                  <th className="border-r border-slate-800 px-2 py-1.5">
                    趋势结构
                  </th>
                  <th className="border-r border-slate-800 px-2 py-1.5">
                    收盘动量
                  </th>
                  <th className="border-r border-slate-800 px-2 py-1.5">
                    日频量能
                  </th>
                  <th className="px-2 py-1.5">波动风险</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-800 font-mono text-cyan-100">
                  <td className="border-r border-slate-800 px-2 py-2">
                    {researchScore.total ?? "—"} / 100 ·{" "}
                    <span
                      className={
                        researchScore.label.includes("偏强")
                          ? "text-[#f2495c]"
                          : researchScore.label.includes("偏弱")
                            ? "text-[#1fbf75]"
                            : "text-amber-200"
                      }
                    >
                      {researchScore.label}
                    </span>
                  </td>
                  <td className="border-r border-slate-800 px-2 py-2">
                    {researchScore.trend ?? "—"} / 40
                  </td>
                  <td className="border-r border-slate-800 px-2 py-2">
                    {researchScore.momentum ?? "—"} / 25
                  </td>
                  <td className="border-r border-slate-800 px-2 py-2">
                    {researchScore.volume ?? "—"} / 15
                  </td>
                  <td className="px-2 py-2">
                    {researchScore.volatility ?? "—"} / 20
                  </td>
                </tr>
                <tr className="border-t border-amber-900/60 text-amber-100">
                  <td className="px-2 py-2 leading-4" colSpan={5}>
                    {researchScore.reason}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
        <CockpitNews symbol={symbol} />
        {hasHistory && (
          <>
            <section className="overflow-x-auto bg-[#0d1220]">
              <table className="w-full min-w-[860px] table-fixed text-left text-[10px]">
                <thead className="bg-[#080b13] text-[9px] text-slate-500">
                  <tr>
                    <th className="border-r border-slate-800 px-2 py-1.5">
                      标的名称／代码
                    </th>
                    <th className="border-r border-slate-800 px-2 py-1.5">
                      最新日收盘
                    </th>
                    <th className="border-r border-slate-800 px-2 py-1.5">
                      日内振幅／日频量比
                    </th>
                    <th className="border-r border-slate-800 px-2 py-1.5">
                      趋势标签
                    </th>
                    <th className="px-2 py-1.5">
                      20 日区间位置
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-800 align-top">
                    <td className="border-r border-slate-800 px-2 py-2">
                      <div className="font-mono text-sm text-cyan-100">
                        {symbol}
                      </div>
                    </td>
                    <td className="border-r border-slate-800 px-2 py-2">
                      <div className="font-mono text-sm text-slate-100">
                        {money(latest?.close)}
                      </div>
                      <div
                        className={
                          (changePct ?? 0) >= 0
                            ? "mt-1 text-[9px] text-[#f2495c]"
                            : "mt-1 text-[9px] text-[#1fbf75]"
                        }
                      >
                        {changePct == null
                          ? "样本不足"
                          : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% vs 前一日`}
                      </div>
                    </td>
                    <td className="border-r border-slate-800 px-2 py-2">
                      <div className="font-mono text-sm text-slate-100">
                        {amplitude == null ? "—" : `${amplitude.toFixed(2)}%`} /{" "}
                        {volumeRatio == null
                          ? "—"
                          : `${volumeRatio.toFixed(2)}x`}
                      </div>
                      <div className="mt-1 text-[9px] text-slate-500">
                        仅由日频 OHLCV 计算
                      </div>
                    </td>
                    <td className="border-r border-slate-800 px-2 py-2">
                      <div
                        className={
                          trend.includes("偏强")
                            ? "text-sm text-[#f2495c]"
                            : trend.includes("偏弱")
                              ? "text-sm text-[#1fbf75]"
                              : "text-sm text-amber-200"
                        }
                      >
                        {trend}
                      </div>
                      <div className="mt-1 text-[9px] text-slate-500">
                        不是投资评级或建议
                      </div>
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {support != null && resistance != null && latest ? (
                        <>
                          <div className="font-mono text-sm text-slate-100">
                            {resistance > support ? `${(((latest.close - support) / (resistance - support)) * 100).toFixed(0)}%` : "—"}
                          </div>
                          <div className="mt-1 text-[9px] text-slate-500">
                            收盘在 20 日高低区间中的位置
                          </div>
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
            <section className="grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
              <div className="border border-slate-800 bg-[#0d1220] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-cyan-100">
                      {symbol} · 日线关键价位
                    </h3>
                    <p className="mt-1 text-[10px] text-slate-500">
                      支撑 / 压力为近 20 日最低 / 最高价；均线与布林带按日收盘计算。
                    </p>
                  </div>
                  <span className="border border-cyan-900/70 bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-100">
                    {latest?.date}
                  </span>
                </div>
                <div className="mt-2 overflow-x-auto border border-slate-800 text-[10px]">
                  <table className="w-full min-w-[560px] table-fixed text-left">
                    <thead className="bg-[#080b13] text-slate-500">
                      <tr>
                        <th className="border-r border-slate-800 px-2 py-1">
                          日频支撑观察
                        </th>
                        <th className="border-r border-slate-800 px-2 py-1">
                          日频压力观察
                        </th>
                        <th className="border-r border-slate-800 px-2 py-1">
                          MA5 / MA10
                        </th>
                        <th className="px-2 py-1">BOLL 上／下</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-800 font-mono">
                        <td className="border-r border-slate-800 px-2 py-1.5 text-emerald-300">
                          {money(support)}
                        </td>
                        <td className="border-r border-slate-800 px-2 py-1.5 text-orange-300">
                          {money(resistance)}
                        </td>
                        <td className="border-r border-slate-800 px-2 py-1.5 text-slate-100">
                          {money(latest?.sma5)} / {money(latest?.sma10)}
                        </td>
                        <td className="px-2 py-1.5 text-slate-100">
                          {money(latest?.bollUpper)} /{" "}
                          {money(latest?.bollLower)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="divide-y divide-slate-800 border border-slate-800 bg-[#0d1220]">
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-300" />
                    <h3 className="text-sm font-semibold text-cyan-100">
                      日频量能观察
                    </h3>
                  </div>
                  <div className="mt-3 flex h-28 items-end gap-1">
                    {study.slice(-24).map(bar => {
                      const maxVolume = Math.max(
                        1,
                        ...study.slice(-24).map(item => item.volume ?? 0)
                      );
                      return (
                        <div
                          key={bar.date}
                          title={`${bar.date} · ${integer(bar.volume)}`}
                          className="min-w-1 flex-1 rounded-t bg-cyan-700/70"
                          style={{
                            height: `${Math.max(4, ((bar.volume ?? 0) / maxVolume) * 100)}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                    <span>最新量：{integer(latest?.volume)}</span>
                    <span>20 日均量：{integer(averageVolume)}</span>
                  </div>
                </div>
                <div className="bg-amber-950/20 p-3">
                  <h3 className="text-sm font-semibold text-amber-100">
                    关键价位会话观察
                  </h3>
                  <p className="mt-1 text-[10px] leading-4 text-amber-100">
                    仅在本浏览器会话按最新日收盘进行高亮检查；不产生后台推送、真实交易提醒或连续价格监控。
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      aria-label="日频会话观察阈值"
                      value={thresholdInput}
                      onChange={event => setThresholdInput(event.target.value)}
                      type="number"
                      placeholder="输入观察阈值"
                      className="min-w-0 flex-1 border border-amber-800 bg-[#080b13] px-2 py-1 text-xs text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setThresholdEnabled(
                          Number.isFinite(Number(thresholdInput)) &&
                            thresholdInput.trim() !== ""
                        )
                      }
                      className="border border-amber-700 bg-amber-950 px-2 py-1 text-[10px] text-amber-50 hover:bg-amber-900"
                    >
                      检查阈值
                    </button>
                  </div>
                  <p
                    className={`mt-2 text-[10px] ${thresholdEnabled && latest && latest.close >= threshold ? "text-amber-100" : "text-slate-400"}`}
                  >
                    {thresholdState}
                  </p>
                </div>
              </div>
            </section>
            <StockResearchBacktestPanel
              symbol={symbol}
              history={study.map(bar => ({ date: bar.date, close: bar.close }))}
              benchmarkHistory={(benchmarkQuery.data?.available
                ? benchmarkQuery.data.history
                : []
              )
                .map(bar => ({ date: bar.date, close: bar.close }))
                .filter(
                  (bar): bar is { date: string; close: number } =>
                    bar.close != null
                )}
              source={undefined}
              benchmarkSource={undefined}
              benchmarkLoading={benchmarkQuery.isLoading}
            />
            <NceoOptionsCard symbol={symbol} />
          </>
        )}
        <StockNCEOResearchWatchboard
          symbol={symbol}
          leg={leg}
          onSelectStock={nextSymbol => {
            setSymbol(nextSymbol);
            setThresholdEnabled(false);
          }}
          onOpenNceo={onOpenNceo}
        />
      </div>
    </div>
  );
}

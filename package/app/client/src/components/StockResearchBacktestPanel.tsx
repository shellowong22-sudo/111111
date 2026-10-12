import React, { useMemo, useState } from "react";
import { Download, History } from "lucide-react";
import {
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
  ResearchHoldingPeriod,
  runDailyTrendResearchBacktest,
} from "@/lib/stockResearchBacktest";

const pct = (value: number | null) =>
  value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const price = (value: number) => `$${value.toFixed(2)}`;
const holdingPeriods: ResearchHoldingPeriod[] = [1, 3, 5];
const costPresets = [0, 5, 10, 25];

export default function StockResearchBacktestPanel({
  symbol,
  history,
  benchmarkHistory,
  source,
  benchmarkSource,
  benchmarkLoading,
}: {
  symbol: string;
  history: Array<{ date: string; close: number }>;
  benchmarkHistory: Array<{ date: string; close: number }> | undefined;
  source: string | null | undefined;
  benchmarkSource: string | null | undefined;
  benchmarkLoading: boolean;
}) {
  const [holdingPeriod, setHoldingPeriod] = useState<ResearchHoldingPeriod>(1);
  const [transactionCostBps, setTransactionCostBps] = useState(5);
  const result = useMemo(
    () =>
      runDailyTrendResearchBacktest(history, {
        holdingPeriod,
        transactionCostBps,
        benchmarkHistory: benchmarkLoading ? undefined : benchmarkHistory,
        requireBenchmark: true,
      }),
    [
      benchmarkHistory,
      benchmarkLoading,
      history,
      holdingPeriod,
      transactionCostBps,
    ]
  );
  const download = () => {
    const rows = [
      "信号日,评估日,持有交易日,研究方向,信号收盘,评估收盘,标的收益,策略毛收益,双边成本bp,策略净收益,SPY毛收益,SPY净收益,超额收益,观察结果",
      ...result.signals.map(item =>
        [
          item.signalDate,
          item.evaluationDate,
          item.holdingPeriod,
          item.direction,
          item.closeAtSignal.toFixed(4),
          item.closeAtEvaluation.toFixed(4),
          item.nextDayReturnPct.toFixed(6),
          item.grossResearchReturnPct.toFixed(6),
          (item.transactionCostBps * 2).toFixed(2),
          item.researchReturnPct.toFixed(6),
          item.benchmarkGrossReturnPct?.toFixed(6) ?? "",
          item.benchmarkReturnPct?.toFixed(6) ?? "",
          item.excessReturnPct?.toFixed(6) ?? "",
          item.outcome,
        ]
          .map(value => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${symbol}-daily-research-backtest.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const benchmarkState = benchmarkLoading
    ? "正在读取 SPY 公共日频…"
    : benchmarkHistory?.length
      ? "标普 500 ETF（SPY）"
      : "SPY 日线暂未返回；不显示对比统计";

  return (
    <section className="border border-cyan-900/70 bg-[#0d1220] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <History className="h-4 w-4" />
            {symbol} · 日频趋势研究回测
          </h3>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            规则：{result.signalRule} 每条观察只使用信号日及此前收盘，并以选定的
            <strong className="text-slate-300">后续交易日</strong>
            收盘评估；不构成交易信号、预测、真实持仓或未来收益承诺。
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={!result.signals.length}
          className="inline-flex items-center gap-1 border border-cyan-800 bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3 w-3" />
          导出研究样本
        </button>
      </div>
      <div className="mt-3 grid divide-y divide-slate-800 border border-slate-800 bg-[#080b13] text-[10px] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <div className="p-2">
          <div className="text-slate-500">评估持有期</div>
          <div className="mt-1 flex gap-1">
            {holdingPeriods.map(period => (
              <button
                key={period}
                type="button"
                onClick={() => setHoldingPeriod(period)}
                className={`border px-2 py-1 ${holdingPeriod === period ? "border-cyan-500 bg-cyan-950 text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-cyan-100"}`}
              >
                {period} 个交易日
              </button>
            ))}
          </div>
        </div>
        <div className="p-2">
          <div className="text-slate-500">单边成本假设</div>
          <div className="mt-1 flex gap-1">
            {costPresets.map(bps => (
              <button
                key={bps}
                type="button"
                onClick={() => setTransactionCostBps(bps)}
                className={`border px-2 py-1 ${transactionCostBps === bps ? "border-cyan-500 bg-cyan-950 text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-cyan-100"}`}
              >
                {bps} bp
              </button>
            ))}
          </div>
        </div>
        <div className="p-2">
          <div className="text-slate-500">比较基准</div>
          <div
            className={`mt-1 ${benchmarkHistory?.length ? "text-emerald-300" : "text-amber-100"}`}
          >
            {benchmarkState}
          </div>
        </div>
      </div>
      <div className="mt-2 border border-slate-800 bg-[#080b13] p-2 text-[10px] leading-4 text-slate-400">
        <strong className="text-cyan-100">数据范围：</strong>
        {result.sampleStart ?? "—"} 至 {result.sampleEnd ?? "—"}。{result.informationCutoff}{" "}
        {result.costAssumption}
      </div>
      {result.status === "insufficient" ? (
        <div className="mt-3 border border-dashed border-amber-900/70 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">
          <strong>当前不生成回测统计。</strong>
          <p className="mt-1">{result.reason}</p>
          <p className="mt-1">
            该界面不会用模型期权链、固定示例、缺失的 SPY
            日期或未来数据补足样本；历史 NCEO
            期权链尚无可验证日序列，故不显示期权胜率、盈亏或最大回撤。
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto border border-slate-800 bg-[#080b13]">
            <table className="w-full min-w-[760px] table-fixed text-left text-[10px]">
              <thead className="text-[9px] text-slate-500">
                <tr>
                  <th className="border-r border-slate-800 px-2 py-1.5">
                    研究样本数／正收益观察
                  </th>
                  <th className="border-r border-slate-800 px-2 py-1.5">
                    策略累计／平均净研究收益
                  </th>
                  <th className="border-r border-slate-800 px-2 py-1.5">
                    SPY 累计／累计超额
                  </th>
                  <th className="px-2 py-1.5 text-rose-200">
                    最大回撤／不利观察
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-800 align-top">
                  <td className="border-r border-slate-800 px-2 py-2">
                    <div className="font-mono text-sm text-slate-100">
                      {result.statistics.sampleCount} /{" "}
                      <span className="text-emerald-300">
                        {result.statistics.positiveCount}
                      </span>
                    </div>
                    <div className="mt-1 text-[9px] text-slate-500">
                      正收益比例：{pct(result.statistics.positiveRatePct)}
                    </div>
                  </td>
                  <td className="border-r border-slate-800 px-2 py-2">
                    <div className="font-mono text-sm text-cyan-100">
                      {pct(result.statistics.strategyCumulativeReturnPct)}
                    </div>
                    <div className="mt-1 text-[9px] text-slate-500">
                      平均：{pct(result.statistics.averageReturnPct)}
                    </div>
                  </td>
                  <td className="border-r border-slate-800 px-2 py-2">
                    <div className="font-mono text-sm text-violet-200">
                      {pct(result.statistics.benchmarkCumulativeReturnPct)}
                    </div>
                    <div className="mt-1 text-[9px] text-slate-500">
                      超额：{pct(result.statistics.cumulativeExcessReturnPct)}
                    </div>
                  </td>
                  <td className="bg-rose-950/20 px-2 py-2 text-rose-200">
                    <div className="font-mono text-sm">
                      {pct(result.statistics.maximumDrawdownPct)} /{" "}
                      {pct(result.statistics.maximumAdverseReturnPct)}
                    </div>
                    <div className="mt-1 text-[9px]">已扣双边成本</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 h-56 border border-slate-800 bg-[#080b13] p-2">
            <div className="mb-1 text-[10px] text-slate-500">
              研究净值曲线（起点 100；策略与 SPY 仅按同一批信号日／结局日对齐）
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={result.netValueCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 9 }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 9 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0d1220",
                    border: "1px solid #334155",
                    fontSize: 10,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="strategyNetValue"
                  name="策略净值"
                  stroke="#22d3ee"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="benchmarkNetValue"
                  name="SPY 净值"
                  stroke="#a78bfa"
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[1080px] text-[10px]">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-500">
                  <th className="p-1.5">信号日</th>
                  <th>评估日</th>
                  <th>持有期</th>
                  <th>方向</th>
                  <th>信号／评估收盘</th>
                  <th>标的收益</th>
                  <th>成本</th>
                  <th>策略净收益</th>
                  <th>SPY 净收益</th>
                  <th>超额</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {result.signals
                  .slice(-24)
                  .reverse()
                  .map(signal => (
                    <tr
                      key={`${signal.signalDate}-${signal.direction}`}
                      className="border-b border-slate-800/60"
                    >
                      <td className="p-1.5 font-mono text-slate-300">
                        {signal.signalDate}
                      </td>
                      <td className="font-mono text-slate-400">
                        {signal.evaluationDate}
                      </td>
                      <td>{signal.holdingPeriod} 日</td>
                      <td
                        className={
                          signal.direction === "偏强"
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }
                      >
                        {signal.direction}
                      </td>
                      <td className="font-mono">
                        {price(signal.closeAtSignal)} /{" "}
                        {price(signal.closeAtEvaluation)}
                      </td>
                      <td className="font-mono">
                        {pct(signal.nextDayReturnPct)}
                      </td>
                      <td className="font-mono text-amber-200">
                        -{signal.roundTripCostPct.toFixed(2)}%
                      </td>
                      <td
                        className={`font-mono ${signal.researchReturnPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                      >
                        {pct(signal.researchReturnPct)}
                      </td>
                      <td className="font-mono text-violet-200">
                        {pct(signal.benchmarkReturnPct)}
                      </td>
                      <td className="font-mono text-cyan-200">
                        {pct(signal.excessReturnPct)}
                      </td>
                      <td
                        className={
                          signal.outcome === "正收益观察"
                            ? "text-emerald-300"
                            : signal.outcome === "负收益观察"
                              ? "text-rose-300"
                              : "text-slate-400"
                        }
                      >
                        {signal.outcome}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-amber-100">
            样本：候选信号 {result.candidateSignalCount} 条；因 SPY
            信号日或结局日不在公共日频交集而剔除{" "}
            {result.excludedForBenchmarkCount}{" "}
            条。此为研究统计，未计入滑点、停牌、复权差异、流动性或税费；正收益比例不是未来胜率，历史结果不代表未来收益。
          </p>
        </>
      )}
    </section>
  );
}

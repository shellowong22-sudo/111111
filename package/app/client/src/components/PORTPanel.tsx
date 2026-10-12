import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PieChart as PieIcon, RefreshCw, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import OpenBBModuleDataBand from "@/components/OpenBBModuleDataBand";

type View = "holdings" | "perf" | "risk";
type Position = { ticker: string; quantity: number; costBasis: number };
type MarketRow = {
  ticker: string;
  status: string;
  price: number | null;
  currency: string | null;
  latestDate: string | null;
  source: string | null;
  history: Array<{ date: string; value: number }>;
};
const control =
  "h-7 border border-slate-700 bg-black px-2 text-[10px] text-slate-200";
const fmt = (value: unknown, digits = 4) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";

export default function PORTPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState<View>("holdings");
  const [draft, setDraft] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [inputError, setInputError] = useState("");
  const [benchmark, setBenchmark] = useState("SPY");
  const tickers = [
    ...new Set([...positions.map(item => item.ticker), benchmark]),
  ].slice(0, 10);
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    {
      tickers: tickers.length ? tickers : ["INVALID"],
      range: "1y",
      includeHistory: true,
    },
    {
      enabled: positions.length > 0,
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      retry: false,
    }
  );
  const marketRows = (query.data?.rows ?? []) as MarketRow[];
  const marketMap = new Map(marketRows.map(row => [row.ticker, row]));
  const holdings = positions.map(item => {
    const quote = marketMap.get(item.ticker);
    const value = quote?.price == null ? null : quote.price * item.quantity;
    const cost = item.costBasis * item.quantity;
    return {
      ...item,
      quote,
      value,
      cost,
      pnl: value == null ? null : value - cost,
    };
  });
  const totalValue = holdings.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const totalCost = holdings.reduce((sum, item) => sum + item.cost, 0);
  const enriched = holdings.map(item => ({
    ...item,
    weight:
      item.value != null && totalValue > 0
        ? (item.value / totalValue) * 100
        : null,
    pnlPct:
      item.value != null && item.cost > 0
        ? (item.value / item.cost - 1) * 100
        : null,
  }));
  const performance = useMemo(
    () => buildPortfolioSeries(positions, marketRows, benchmark),
    [positions, marketRows, benchmark]
  );
  const returns = performance
    .map((row, index, all) =>
      index && all[index - 1].portfolio > 0
        ? row.portfolio / all[index - 1].portfolio - 1
        : null
    )
    .filter(
      (value): value is number => value != null && Number.isFinite(value)
    );
  const mean = returns.length
    ? returns.reduce((sum, value) => sum + value, 0) / returns.length
    : null;
  const volatility =
    mean == null || returns.length < 2
      ? null
      : Math.sqrt(
          returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
            (returns.length - 1)
        ) *
        Math.sqrt(252) *
        100;
  const var95 =
    returns.length >= 20 && totalValue > 0
      ? [...returns].sort((a, b) => a - b)[
          Math.floor((returns.length - 1) * 0.05)
        ] * totalValue
      : null;
  const maxDrawdown = performance.length
    ? calculateDrawdown(performance.map(row => row.portfolio)) * 100
    : null;
  const hhi = enriched.length
    ? enriched.reduce((sum, item) => sum + ((item.weight ?? 0) / 100) ** 2, 0)
    : null;
  const apply = () => {
    const parsed = parsePositions(draft);
    setInputError(parsed.error);
    if (!parsed.error) setPositions(parsed.rows);
  };

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#080d16] text-xs text-slate-200"
      aria-label="PORT 投资组合管理"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-700 px-2 py-2">
        <PieIcon className="h-4 w-4 text-blue-300" />
        <b className="font-mono text-blue-300">PORT</b>
        <span>投资组合管理</span>
        <span role="status" className="text-[10px] text-slate-500">
          {query.isFetching
            ? "正在读取公共日频数据"
            : positions.length
              ? `${positions.length} 项输入 · ${marketRows.filter(row => row.status === "available").length} 项可读`
              : "等待账户输入"}
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="关闭 PORT"
            onClick={onClose}
            className="ml-auto p-1 text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>
      <OpenBBModuleDataBand path="/terminal?open=port&module=stocks" title="PORT 持仓与所有权数据" />
      <div
        role="toolbar"
        className="grid gap-2 border-b border-slate-800 p-2 lg:grid-cols-[minmax(360px,1fr)_160px_auto_auto]"
      >
        <label className="text-[10px] text-slate-500">
          持仓 JSON（ticker、quantity、costBasis）
          <input
            aria-label="PORT 持仓输入"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder='[{"ticker":"AAPL","quantity":10,"costBasis":180}]'
            className={`${control} mt-1 w-full`}
          />
        </label>
        <label className="text-[10px] text-slate-500">
          基准
          <input
            aria-label="PORT 基准代码"
            value={benchmark}
            onChange={event =>
              setBenchmark(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9.^=-]/g, "")
                  .slice(0, 15)
              )
            }
            className={`${control} mt-1 w-full`}
          />
        </label>
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={apply}
          className={`${control} self-end`}
        >
          应用账户输入
        </button>
        <button
          type="button"
          disabled={!positions.length || query.isFetching}
          onClick={() => void query.refetch()}
          className={`${control} inline-flex items-center gap-1 self-end`}
        >
          <RefreshCw className="h-3 w-3" />
          刷新来源
        </button>
      </div>
      {inputError && (
        <p
          role="alert"
          className="border-b border-amber-900 px-2 py-1 text-[10px] text-amber-200"
        >
          {inputError}
        </p>
      )}
      <div className="grid grid-cols-3 border-b border-slate-800 text-[10px]">
        <Metric
          label="总市值"
          value={totalValue > 0 ? fmt(totalValue, 2) : "—"}
        />
        <Metric
          label="总成本"
          value={totalCost > 0 ? fmt(totalCost, 2) : "—"}
        />
        <Metric
          label="未实现盈亏"
          value={totalValue > 0 ? fmt(totalValue - totalCost, 2) : "—"}
        />
      </div>
      <nav
        role="tablist"
        aria-label="PORT 原功能"
        className="flex border-b border-slate-800"
      >
        {(["holdings", "perf", "risk"] as View[]).map(value => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            key={value}
            onClick={() => setTab(value)}
            className={`border-r border-slate-800 px-3 py-2 text-[10px] ${tab === value ? "border-b-2 border-b-blue-400 text-blue-200" : "text-slate-500"}`}
          >
            {value === "holdings"
              ? "持仓分布"
              : value === "perf"
                ? "业绩归因"
                : "风险分析"}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "holdings" && (
          <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[minmax(500px,1.2fr)_minmax(0,.8fr)]">
            <table className="h-fit w-full min-w-[760px] text-left text-[10px]">
              <thead className="text-slate-500">
                <tr>
                  {[
                    "证券",
                    "数量",
                    "单位成本",
                    "日频末值",
                    "市值",
                    "权重",
                    "未实现盈亏",
                    "观察日/来源",
                  ].map(label => (
                    <th key={label} className="p-2 font-normal">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map(item => (
                  <tr key={item.ticker} className="border-t border-slate-800">
                    <td className="p-2 font-mono text-blue-200">
                      {item.ticker}
                    </td>
                    <td>{fmt(item.quantity)}</td>
                    <td>{fmt(item.costBasis)}</td>
                    <td>{fmt(item.quote?.price)}</td>
                    <td>{fmt(item.value, 2)}</td>
                    <td>
                      {item.weight == null ? "—" : `${fmt(item.weight, 2)}%`}
                    </td>
                    <td
                      className={
                        (item.pnl ?? 0) >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      {fmt(item.pnl, 2)}
                    </td>
                    <td className="text-slate-500">
                      {item.quote?.latestDate ?? "—"}
                      <span className="block max-w-52 truncate">
                        {item.quote?.source ?? "来源未取得"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!enriched.length && (
                  <tr>
                    <td colSpan={8} className="p-5 text-center text-amber-200">
                      输入账户持仓后读取；不显示示例组合。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="h-[410px] border-t border-slate-800 p-2 lg:border-l lg:border-t-0">
              {enriched.some(item => item.weight != null) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enriched}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="2 3" />
                    <XAxis
                      dataKey="ticker"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} />
                    <Tooltip />
                    <Bar
                      dataKey="weight"
                      name="实际市值权重 %"
                      fill="#60a5fa"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p role="status" className="p-4 text-slate-500">
                  取得实际日频末值后显示市值权重。
                </p>
              )}
            </div>
          </div>
        )}
        {tab === "perf" && (
          <div className="grid min-h-[430px] grid-cols-1 lg:grid-cols-[minmax(300px,.55fr)_minmax(0,1.45fr)]">
            <table className="h-fit w-full text-left text-[10px]">
              <tbody>
                {[
                  ["共同观察日", performance.length],
                  ["组合起始市值", performance[0]?.portfolio],
                  ["组合末值", performance.at(-1)?.portfolio],
                  ["基准", benchmark],
                  ["基准起点", performance.length ? "100.0000" : "—"],
                  [
                    "组合收益",
                    performance.length > 1
                      ? `${fmt((performance.at(-1)!.portfolio / performance[0].portfolio - 1) * 100)}%`
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <tr key={String(label)} className="border-b border-slate-800">
                    <th className="p-2 font-normal text-slate-500">{label}</th>
                    <td className="p-2">
                      {typeof value === "number" ? fmt(value) : (value ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="h-[420px] border-t border-slate-800 p-2 lg:border-l lg:border-t-0">
              {performance.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performance}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="2 3" />
                    <XAxis
                      dataKey="date"
                      minTickGap={24}
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      dataKey="portfolioIndex"
                      name="组合归一值"
                      stroke="#60a5fa"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="benchmarkIndex"
                      name={`${benchmark} 归一值`}
                      stroke="#94a3b8"
                      strokeDasharray="4 2"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p role="status" className="p-4 text-slate-500">
                  需要所有持仓和基准在同一日期至少有两个实际观察点；不插值、不前填。
                </p>
              )}
            </div>
          </div>
        )}
        {tab === "risk" && (
          <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[minmax(360px,.7fr)_minmax(0,1.3fr)]">
            <table className="h-fit w-full text-left text-[10px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="p-2 font-normal">风险指标</th>
                  <th className="p-2 font-normal">值</th>
                  <th className="p-2 font-normal">口径</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["年化历史波动率", volatility, "共同日频组合收益"],
                  ["最大回撤", maxDrawdown, "共同观察区间"],
                  [
                    "历史 VaR 95%",
                    var95,
                    returns.length >= 20
                      ? "日收益经验 5% 分位 × 当前市值"
                      : "至少需要 20 个共同收益",
                  ],
                  ["HHI 集中度", hhi, "当前市值权重平方和"],
                  ["Beta", null, "未实现协方差估计"],
                  ["夏普比率", null, "无风险利率未配置"],
                ].map(([label, value, note]) => (
                  <tr key={String(label)} className="border-t border-slate-800">
                    <td className="p-2 text-blue-200">{label}</td>
                    <td>{fmt(value)}</td>
                    <td
                      className={
                        value == null ? "text-amber-200" : "text-slate-500"
                      }
                    >
                      {note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-800 p-4 text-[10px] leading-6 text-slate-400 lg:border-l lg:border-t-0">
              风险结果仅对用户提交的仓位、当前公共日频历史和共同日期复算。没有账户估值、公司行动调整、实时价格、协方差模型、无风险利率和授权基准时，不输出风险评级、建议或交易指令。
            </div>
          </div>
        )}
      </div>
      <footer className="border-t border-slate-800 px-2 py-1.5 text-[9px] leading-5 text-slate-500">
        {query.data?.sourceBoundary ?? "等待账户输入。"}{" "}
        价格是公共日频观察、非实时执行报价；账户输入只驻留当前页面。
      </footer>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-slate-800 px-2 py-1.5">
      <span className="text-slate-500">{label}</span>
      <b className="ml-2 font-mono text-slate-100">{value}</b>
    </div>
  );
}
function parsePositions(text: string): { rows: Position[]; error: string } {
  try {
    const raw = JSON.parse(text);
    if (!Array.isArray(raw))
      return { rows: [], error: "持仓必须是 JSON 数组。" };
    const rows = raw
      .map(item => ({
        ticker: String(item?.ticker ?? "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9.^=-]/g, "")
          .slice(0, 15),
        quantity: Number(item?.quantity),
        costBasis: Number(item?.costBasis),
      }))
      .filter(item => item.ticker && item.quantity > 0 && item.costBasis >= 0)
      .slice(0, 9);
    return rows.length
      ? { rows, error: "" }
      : { rows: [], error: "没有可计算的 ticker、正数量和非负成本记录。" };
  } catch {
    return { rows: [], error: "持仓 JSON 格式无效。" };
  }
}
function buildPortfolioSeries(
  positions: Position[],
  rows: MarketRow[],
  benchmark: string
) {
  if (!positions.length) return [];
  const maps = new Map(
    rows.map(row => [
      row.ticker,
      new Map(row.history.map(point => [point.date, point.value])),
    ])
  );
  const firstMap = maps.get(positions[0].ticker);
  const benchmarkMap = maps.get(benchmark);
  if (!firstMap || !benchmarkMap) return [];
  const dates = [...firstMap.keys()]
    .filter(
      date =>
        positions.every(position => maps.get(position.ticker)?.has(date)) &&
        benchmarkMap.has(date)
    )
    .sort();
  const values = dates
    .map(date => ({
      date,
      portfolio: positions.reduce(
        (sum, position) =>
          sum +
          position.quantity * Number(maps.get(position.ticker)!.get(date)),
        0
      ),
      benchmark: Number(benchmarkMap.get(date)),
    }))
    .filter(row => row.portfolio > 0 && row.benchmark > 0);
  const start = values[0];
  return start
    ? values.map(row => ({
        ...row,
        portfolioIndex: (row.portfolio / start.portfolio) * 100,
        benchmarkIndex: (row.benchmark / start.benchmark) * 100,
      }))
    : [];
}
function calculateDrawdown(values: number[]) {
  let peak = values[0] ?? 0;
  let minimum = 0;
  values.forEach(value => {
    peak = Math.max(peak, value);
    if (peak > 0) minimum = Math.min(minimum, value / peak - 1);
  });
  return minimum;
}

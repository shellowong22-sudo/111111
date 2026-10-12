/**
 * EQBT — 股票回溯测试（真实数据版）
 *
 * 功能：
 * 1. 真实历史价格图表（统一公开数据通道；缺失不模拟）
 * 2. 六种量化策略：均线交叉 / RSI / MACD / 布林带 / KDJ / 海龟
 * 3. 自定义策略参数（周期、阈值等）
 * 4. 回测结果可视化：净值曲线、回撤图、交易记录
 * 5. 绩效指标：总收益、夏普比率、最大回撤、胜率、卡玛比率
 * 6. 策略参数网格搜索优化（热力图）
 */
import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import {
  TrendingUp,
  RefreshCw,
  Play,
  AlertTriangle,
  Loader2,
  X,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  BarChart2,
  List,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { DataLoadingSkeleton } from "@/components/ChartSkeleton";

interface EQBTPanelProps {
  onClose?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POPULAR_TICKERS = [
  "NVDA",
  "AAPL",
  "MSFT",
  "TSLA",
  "META",
  "AMZN",
  "GOOGL",
  "AMD",
];

type StrategyId = "sma_cross" | "rsi" | "macd" | "bollinger" | "kdj" | "turtle";

const STRATEGIES: Array<{
  id: StrategyId;
  label: string;
  desc: string;
  params: Array<{
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    default: number;
  }>;
}> = [
  {
    id: "sma_cross",
    label: "均线交叉",
    desc: "快线上穿慢线买入，下穿卖出",
    params: [
      { key: "fast", label: "快线周期", min: 3, max: 50, step: 1, default: 10 },
      {
        key: "slow",
        label: "慢线周期",
        min: 10,
        max: 200,
        step: 1,
        default: 30,
      },
    ],
  },
  {
    id: "rsi",
    label: "RSI 超买超卖",
    desc: "RSI 从超卖区反弹买入，进入超买区卖出",
    params: [
      {
        key: "period",
        label: "RSI 周期",
        min: 5,
        max: 30,
        step: 1,
        default: 14,
      },
      {
        key: "oversold",
        label: "超卖阈值",
        min: 10,
        max: 40,
        step: 1,
        default: 30,
      },
      {
        key: "overbought",
        label: "超买阈值",
        min: 60,
        max: 90,
        step: 1,
        default: 70,
      },
    ],
  },
  {
    id: "macd",
    label: "MACD 金叉",
    desc: "MACD 线上穿信号线买入，下穿卖出",
    params: [
      { key: "fast", label: "快线 EMA", min: 5, max: 20, step: 1, default: 12 },
      {
        key: "slow",
        label: "慢线 EMA",
        min: 15,
        max: 50,
        step: 1,
        default: 26,
      },
      { key: "signal", label: "信号线", min: 5, max: 20, step: 1, default: 9 },
    ],
  },
  {
    id: "bollinger",
    label: "布林带",
    desc: "价格触及下轨买入，触及上轨卖出",
    params: [
      {
        key: "period",
        label: "均线周期",
        min: 10,
        max: 50,
        step: 1,
        default: 20,
      },
      {
        key: "stdMult",
        label: "标准差倍数",
        min: 1,
        max: 4,
        step: 0.5,
        default: 2,
      },
    ],
  },
  {
    id: "kdj",
    label: "KDJ 随机指标",
    desc: "K 线金叉 D 线且 J 处于超卖区买入，死叉卖出",
    params: [
      {
        key: "period",
        label: "KDJ 周期",
        min: 5,
        max: 20,
        step: 1,
        default: 9,
      },
      {
        key: "oversold",
        label: "超卖阈值",
        min: 10,
        max: 35,
        step: 1,
        default: 20,
      },
      {
        key: "overbought",
        label: "超买阈值",
        min: 65,
        max: 90,
        step: 1,
        default: 80,
      },
    ],
  },
  {
    id: "turtle",
    label: "海龟策略",
    desc: "唐奇安通道突破：N 日最高价突破入场，M 日最低价跌破出场",
    params: [
      {
        key: "entryPeriod",
        label: "入场周期 (N)",
        min: 10,
        max: 60,
        step: 1,
        default: 20,
      },
      {
        key: "exitPeriod",
        label: "出场周期 (M)",
        min: 5,
        max: 30,
        step: 1,
        default: 10,
      },
    ],
  },
];

const RANGES = [
  { id: "3mo", label: "3个月" },
  { id: "6mo", label: "6个月" },
  { id: "1y", label: "1年" },
  { id: "2y", label: "2年" },
  { id: "5y", label: "5年" },
];

// ─── Continuous metric table ──────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <tr className="border-b border-[#333]">
      <th className="py-1.5 px-2 text-left text-slate-300 font-normal">
        {label}
      </th>
      <td className={`px-2 text-right font-mono ${color ?? "text-[#eee]"}`}>
        {value}
      </td>
      <td className="px-2 text-slate-400">{sub ?? "—"}</td>
    </tr>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function EquityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#333] p-2 text-[10px]">
      <div className="text-[#888] mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2" style={{ background: p.color }} />
          <span className="text-[#aaa]">{p.name}:</span>
          <span className="text-[#eee] font-bold">
            ${p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Grid Heatmap Tooltip ─────────────────────────────────────────────────────

function GridTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      p1: number;
      p2: number;
      sharpe: number;
      totalReturn: number;
      maxDrawdown: number;
    };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-[#111] border border-[#333] p-2 text-[10px]">
      <div className="text-[#888] mb-1">参数组合</div>
      <div className="text-[#eee]">
        夏普:{" "}
        <span className="text-[#f5a623] font-bold">{d.sharpe.toFixed(3)}</span>
      </div>
      <div className="text-[#eee]">
        总收益:{" "}
        <span
          className={d.totalReturn >= 0 ? "text-green-400" : "text-red-400"}
        >
          {d.totalReturn.toFixed(1)}%
        </span>
      </div>
      <div className="text-[#eee]">
        最大回撤:{" "}
        <span className="text-red-400">{d.maxDrawdown.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function EQBTPanel({ onClose }: EQBTPanelProps) {
  const [ticker, setTicker] = useState("NVDA");
  const [tickerInput, setTickerInput] = useState("NVDA");
  const [range, setRange] = useState<"3mo" | "6mo" | "1y" | "2y" | "5y">("1y");
  const [strategyId, setStrategyId] = useState<StrategyId>("sma_cross");
  const [params, setParams] = useState<Record<string, number>>({});
  const [initialCapital, setInitialCapital] = useState(100000);
  const [activeTab, setActiveTab] = useState<
    "chart" | "equity" | "trades" | "settings" | "grid"
  >("chart");
  const [hasRun, setHasRun] = useState(false);
  const [gridMetric, setGridMetric] = useState<
    "sharpe" | "totalReturn" | "maxDrawdown"
  >("sharpe");

  const strategy = STRATEGIES.find(s => s.id === strategyId)!;

  // 当前策略的有效参数（合并默认值）
  const effectiveParams = useMemo(() => {
    const defaults = Object.fromEntries(
      strategy.params.map(p => [p.key, p.default])
    );
    return { ...defaults, ...params };
  }, [strategy, params]);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const {
    data: priceData,
    isLoading: priceLoading,
    refetch: refetchPrice,
  } = trpc.eqbt.getHistoricalPrices.useQuery(
    { ticker, range },
    {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 60_000,
    }
  );

  const backtest = trpc.eqbt.runBacktest.useMutation();
  const gridSearch = trpc.eqbt.gridSearch.useMutation();

  const handleRunBacktest = () => {
    setHasRun(true);
    setActiveTab("equity");
    backtest.mutate({
      ticker,
      range,
      strategy: strategyId,
      params: effectiveParams,
      initialCapital,
    });
  };

  // 网格搜索默认参数配置
  const gridDefaults = useMemo(() => {
    if (strategyId === "sma_cross")
      return {
        p1: { key: "fast", values: [5, 8, 10, 15, 20] },
        p2: { key: "slow", values: [20, 25, 30, 40, 50] },
      };
    if (strategyId === "rsi")
      return {
        p1: { key: "period", values: [7, 10, 14, 18, 21] },
        p2: { key: "oversold", values: [20, 25, 30, 35, 40] },
      };
    if (strategyId === "macd")
      return {
        p1: { key: "fast", values: [8, 10, 12, 14, 16] },
        p2: { key: "slow", values: [20, 22, 26, 30, 34] },
      };
    if (strategyId === "bollinger")
      return {
        p1: { key: "period", values: [10, 15, 20, 25, 30] },
        p2: { key: "stdMult", values: [1.5, 2, 2.5, 3] },
      };
    if (strategyId === "kdj")
      return {
        p1: { key: "period", values: [5, 7, 9, 12, 14] },
        p2: { key: "oversold", values: [15, 20, 25, 30] },
      };
    // turtle
    return {
      p1: { key: "entryPeriod", values: [10, 15, 20, 25, 30] },
      p2: { key: "exitPeriod", values: [5, 7, 10, 12, 15] },
    };
  }, [strategyId]);

  const handleGridSearch = () => {
    setActiveTab("grid");
    gridSearch.mutate({
      ticker,
      range,
      strategy: strategyId,
      param1: gridDefaults.p1,
      param2: gridDefaults.p2,
      initialCapital,
    });
  };

  const handleTickerSubmit = () => {
    const t = tickerInput.trim().toUpperCase();
    if (t) {
      setTicker(t);
      setHasRun(false);
    }
  };

  // ── Chart Data ─────────────────────────────────────────────────────────────

  const priceChartData = useMemo(() => {
    if (!priceData?.history) return [];
    const step = Math.max(1, Math.floor(priceData.history.length / 120));
    return priceData.history
      .filter((_, i) => i % step === 0)
      .map(h => ({ date: h.date, price: h.value }));
  }, [priceData]);

  const equityData = useMemo(() => {
    if (!backtest.data?.equityCurve) return [];
    const step = Math.max(
      1,
      Math.floor(backtest.data.equityCurve.length / 120)
    );
    return backtest.data.equityCurve
      .filter((_, i) => i % step === 0)
      .map(p => ({
        date: p.date,
        策略净值: p.portfolio,
        基准净值: p.benchmark,
      }));
  }, [backtest.data]);

  const drawdownData = useMemo(() => {
    if (!backtest.data?.equityCurve) return [];
    const step = Math.max(
      1,
      Math.floor(backtest.data.equityCurve.length / 120)
    );
    let peak = backtest.data.equityCurve[0]?.portfolio ?? initialCapital;
    return backtest.data.equityCurve
      .filter((_, i) => i % step === 0)
      .map(p => {
        if (p.portfolio > peak) peak = p.portfolio;
        const dd = ((peak - p.portfolio) / peak) * 100;
        return { date: p.date, 回撤: -parseFloat(dd.toFixed(2)) };
      });
  }, [backtest.data, initialCapital]);

  // 月度收益（从净值曲线聚合）
  const monthlyReturns = useMemo(() => {
    if (!backtest.data?.equityCurve) return [];
    const curve = backtest.data.equityCurve;
    const monthMap: Record<
      string,
      { first: number; last: number; bFirst: number; bLast: number }
    > = {};
    for (const p of curve) {
      const month = p.date.slice(0, 7);
      if (!monthMap[month])
        monthMap[month] = {
          first: p.portfolio,
          last: p.portfolio,
          bFirst: p.benchmark,
          bLast: p.benchmark,
        };
      monthMap[month].last = p.portfolio;
      monthMap[month].bLast = p.benchmark;
    }
    return Object.entries(monthMap)
      .slice(-12)
      .map(([month, v]) => ({
        month: month.slice(5),
        r: parseFloat((((v.last - v.first) / v.first) * 100).toFixed(2)),
        bm: parseFloat((((v.bLast - v.bFirst) / v.bFirst) * 100).toFixed(2)),
      }));
  }, [backtest.data]);

  // 网格搜索热力图数据（散点图形式）
  const gridHeatmapData = useMemo(() => {
    if (!gridSearch.data?.heatmap) return [];
    return gridSearch.data.heatmap.map(d => ({
      ...d,
      value:
        gridMetric === "sharpe"
          ? d.sharpe
          : gridMetric === "totalReturn"
            ? d.totalReturn
            : -d.maxDrawdown,
      label: `${d.p1} / ${d.p2}`,
    }));
  }, [gridSearch.data, gridMetric]);

  const metrics = backtest.data?.metrics;
  const trades = backtest.data?.trades ?? [];
  const priceChange = priceData?.changePct ?? 0;
  const priceColor = priceChange >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="flex flex-col h-full bg-[#080808] text-[#eee] font-mono overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#222] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[#f5a623] font-bold text-sm">EQBT</span>
          <span className="text-[#666] text-xs">股票回溯测试</span>
          {priceData?.available && priceData.price != null && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[#eee] font-bold">{ticker}</span>
              <span className="text-[#eee]">${priceData.price.toFixed(2)}</span>
              <span className={priceColor}>
                {priceChange >= 0 ? (
                  <ArrowUpRight size={10} className="inline" />
                ) : (
                  <ArrowDownRight size={10} className="inline" />
                )}
                {Math.abs(priceChange).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchPrice()}
            className="text-[#555] hover:text-[#f5a623] transition-colors"
          >
            <RefreshCw size={12} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[#555] hover:text-[#eee] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="px-4 py-2 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleTickerSubmit()}
            placeholder="股票代码"
            className="bg-[#111] border border-[#333] text-[#eee] text-[10px] px-2 py-1 w-20 placeholder-[#444] focus:outline-none focus:border-[#f5a623]"
          />
          <button
            onClick={handleTickerSubmit}
            className="px-2 py-1 border border-[#333] bg-[#1a1a1a] text-[#888] text-[10px] hover:text-[#f5a623] transition-colors"
          >
            确认
          </button>
        </div>

        <div className="flex gap-1">
          {POPULAR_TICKERS.slice(0, 5).map(t => (
            <button
              key={t}
              onClick={() => {
                setTicker(t);
                setTickerInput(t);
                setHasRun(false);
              }}
              className={`px-1.5 py-0.5 border border-[#222] text-[9px] font-bold transition-all ${
                ticker === t
                  ? "bg-[#f5a623] text-black"
                  : "bg-[#111] text-[#666] hover:text-[#f5a623]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.id}
              onClick={() => {
                setRange(r.id as typeof range);
                setHasRun(false);
              }}
              className={`px-2 py-0.5 border-b text-[9px] transition-all ${
                range === r.id
                  ? "border-[#f5a623] bg-[#222] text-[#eee]"
                  : "border-transparent text-[#555] hover:text-[#aaa]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleGridSearch}
            disabled={gridSearch.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a1a1a] border border-[#333] text-[#aaa] text-[10px] font-bold hover:border-[#f5a623] hover:text-[#f5a623] transition-colors disabled:opacity-50"
          >
            {gridSearch.isPending ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Search size={10} />
            )}
            网格优化
          </button>
          <button
            onClick={handleRunBacktest}
            disabled={backtest.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5a623] text-black text-[10px] font-bold hover:bg-[#e09515] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {backtest.isPending ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Play size={10} />
            )}
            {backtest.isPending ? "回测中..." : "运行回测"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a1a] shrink-0 bg-[#0a0a0a]">
        {[
          { id: "chart", label: "历史行情", icon: <Activity size={10} /> },
          { id: "equity", label: "净值曲线", icon: <TrendingUp size={10} /> },
          { id: "trades", label: "交易记录", icon: <List size={10} /> },
          { id: "settings", label: "策略参数", icon: <Settings size={10} /> },
          { id: "grid", label: "网格优化", icon: <Search size={10} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-[#f5a623] text-[#f5a623]"
                : "border-transparent text-[#555] hover:text-[#888]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: 历史行情 ── */}
      {activeTab === "chart" && (
        <div className="flex-1 overflow-y-auto">
          {priceLoading ? (
            <DataLoadingSkeleton
              variant="area"
              height={220}
              label="正在加载历史行情图表"
            />
          ) : priceChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[#555] text-xs">
              暂无历史数据
            </div>
          ) : (
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_250px]">
              <section className="bg-[#0d0d0d] border-b border-r border-[#222] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#888] text-[10px]">
                    {ticker} 历史收盘价
                  </span>
                  <span className={`text-[10px] font-bold ${priceColor}`}>
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)}% （
                    {RANGES.find(r => r.id === range)?.label}）
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={priceChartData}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="priceGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={priceChange >= 0 ? "#22c55e" : "#ef4444"}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={priceChange >= 0 ? "#22c55e" : "#ef4444"}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#555", fontSize: 8 }}
                      tickFormatter={v => v.slice(5)}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#555", fontSize: 8 }}
                      tickFormatter={v =>
                        `$${v >= 1000 ? (v / 1000).toFixed(1) + "K" : v}`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: "1px solid #333",
                        fontSize: 10,
                      }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, "收盘价"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={priceChange >= 0 ? "#22c55e" : "#ef4444"}
                      fill="url(#priceGrad)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </section>
              <aside className="bg-[#090909] border-b border-[#222] p-3">
                <div className="text-[#888] text-[10px] mb-2">
                  快速回测 — 当前策略:{" "}
                  <span className="text-[#f5a623]">{strategy.label}</span>
                </div>
                <table
                  className="w-full mb-3 text-[10px]"
                  aria-label="快速回测参数"
                >
                  <tbody className="divide-y divide-[#222]">
                    <tr>
                      <th className="py-1 text-left font-normal text-[#666]">
                        标的
                      </th>
                      <td className="py-1 text-right text-[#eee]">{ticker}</td>
                    </tr>
                    <tr>
                      <th className="py-1 text-left font-normal text-[#666]">
                        区间
                      </th>
                      <td className="py-1 text-right text-[#eee]">
                        {RANGES.find(r => r.id === range)?.label}
                      </td>
                    </tr>
                    <tr>
                      <th className="py-1 text-left font-normal text-[#666]">
                        初始资金
                      </th>
                      <td className="py-1 text-right text-[#eee]">
                        ${initialCapital.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <button
                  onClick={handleRunBacktest}
                  disabled={backtest.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#f5a623] text-black text-xs font-bold hover:bg-[#e09515] transition-colors disabled:opacity-50"
                >
                  {backtest.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  {backtest.isPending
                    ? "回测计算中..."
                    : `运行 ${strategy.label} 策略回测`}
                </button>
              </aside>
            </div>
          )}
        </div>
      )}

      <div
        role="status"
        className="px-2 py-1 border-b border-slate-700 text-[10px] text-slate-400"
      >
        {priceData?.available
          ? `观察日 ${priceData.observationDate} · 读取 ${priceData.retrievedAt} · 日频收盘`
          : "未取得公共历史观察"}
        {" · "}
        研究假设：收盘信号在下一观察日收盘执行；不含手续费/滑点/分红及复权核验。网格最优为样本内拟合，不代表样本外表现。
      </div>
      {/* ── Tab: 净值曲线 ── */}
      {activeTab === "equity" && (
        <div className="flex-1 overflow-y-auto">
          {backtest.isPending ? (
            <DataLoadingSkeleton
              variant="line"
              height={240}
              label={`正在计算 ${strategy.label} 策略回测`}
            />
          ) : backtest.error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <AlertTriangle size={32} className="text-red-400" />
              <p className="text-red-400 text-xs">{backtest.error.message}</p>
            </div>
          ) : !backtest.data ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <BarChart2 size={32} className="text-[#333]" />
              <p className="text-[#555] text-xs">
                请先在「策略参数」中配置策略，然后点击「运行回测」
              </p>
            </div>
          ) : (
            <div className="grid min-h-full lg:grid-cols-[minmax(320px,0.7fr)_minmax(0,1.3fr)]">
              <table
                aria-label="策略绩效与计算口径"
                className="w-full self-start text-[11px] border-r border-b border-[#222]"
              >
                <thead>
                  <tr className="border-b border-slate-600 text-slate-400">
                    <th className="text-left px-2">指标</th>
                    <th className="text-right px-2">结果</th>
                    <th className="text-left px-2">参照与假设</th>
                  </tr>
                </thead>
                <tbody>
                  <MetricRow
                    label="策略总收益"
                    value={`${metrics!.totalReturn >= 0 ? "+" : ""}${metrics!.totalReturn.toFixed(2)}%`}
                    sub={`基准: ${metrics!.benchmarkReturn.toFixed(2)}%`}
                    color={
                      metrics!.totalReturn >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  />
                  <MetricRow
                    label="区间超额收益（非回归α）"
                    value={`${metrics!.alpha >= 0 ? "+" : ""}${metrics!.alpha.toFixed(2)}%`}
                    color={
                      metrics!.alpha >= 0 ? "text-green-400" : "text-red-400"
                    }
                  />
                  <MetricRow
                    label="夏普比率"
                    value={metrics!.sharpe.toFixed(3)}
                    sub="当前未接入同币种无风险利率；结果为零利率基准的年化收益/波动率"
                    color={
                      metrics!.sharpe >= 1
                        ? "text-green-400"
                        : metrics!.sharpe >= 0
                          ? "text-[#f5a623]"
                          : "text-red-400"
                    }
                  />
                  <MetricRow
                    label="最大回撤"
                    value={`-${metrics!.maxDrawdown.toFixed(2)}%`}
                    color="text-red-400"
                  />
                  <MetricRow
                    label="胜率"
                    value={`${metrics!.winRate.toFixed(1)}%`}
                    sub={`共 ${metrics!.numTrades} 笔交易`}
                  />
                  <MetricRow
                    label="年化收益"
                    value={`${metrics!.annualizedReturn.toFixed(2)}%`}
                    sub={`波动率: ${metrics!.volatility.toFixed(2)}%`}
                  />
                </tbody>
              </table>

              <div className="min-w-0">
                {/* Equity Curve */}
                <section className="bg-[#0d0d0d] border-b border-[#222] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#888] text-[10px]">净值曲线</span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart
                      data={equityData}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="portfolioGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f5a623"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f5a623"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#555", fontSize: 8 }}
                        tickFormatter={v => v.slice(5)}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: "#555", fontSize: 8 }}
                        tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
                      />
                      <Tooltip content={<EquityTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="策略净值"
                        stroke="#f5a623"
                        fill="url(#portfolioGrad)"
                        strokeWidth={1.5}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="基准净值"
                        stroke="#555"
                        fill="none"
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="4 2"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </section>

                {/* Drawdown */}
                <section className="bg-[#0d0d0d] border-b border-[#222] p-3">
                  <div className="text-[#888] text-[10px] mb-2">回撤曲线</div>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart
                      data={drawdownData}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor="#ef4444"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="#ef4444"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#555", fontSize: 8 }}
                        tickFormatter={v => v.slice(5)}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fill: "#555", fontSize: 8 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          background: "#111",
                          border: "1px solid #333",
                          fontSize: 10,
                        }}
                        formatter={(v: number) => [`${v.toFixed(2)}%`, "回撤"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="回撤"
                        stroke="#ef4444"
                        fill="url(#ddGrad)"
                        strokeWidth={1}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </section>

                {/* Monthly Returns */}
                {monthlyReturns.length > 0 && (
                  <section className="bg-[#0d0d0d] border-b border-[#222] p-3">
                    <div className="text-[#888] text-[10px] mb-2">
                      近12个月收益对比（策略 vs 基准）
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart
                        data={monthlyReturns}
                        barGap={2}
                        margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "#888", fontSize: 8 }}
                        />
                        <YAxis
                          tick={{ fill: "#555", fontSize: 8 }}
                          tickFormatter={v => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#111",
                            border: "1px solid #333",
                            fontSize: 10,
                          }}
                          formatter={(v: number) => [`${v.toFixed(2)}%`]}
                        />
                        <ReferenceLine y={0} stroke="#333" />
                        <Bar dataKey="r" name="策略" radius={[2, 2, 0, 0]}>
                          {monthlyReturns.map((m, i) => (
                            <Cell
                              key={i}
                              fill={m.r >= 0 ? "#22c55e" : "#ef4444"}
                            />
                          ))}
                        </Bar>
                        <Bar
                          dataKey="bm"
                          name="基准"
                          fill="#444"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: 交易记录 ── */}
      {activeTab === "trades" && (
        <div className="flex-1 overflow-y-auto">
          {!backtest.data ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <List size={32} className="text-[#333]" />
              <p className="text-[#555] text-xs">请先运行回测以查看交易记录</p>
            </div>
          ) : trades.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-[#555] text-xs">
              该策略在此时间段内未产生任何交易信号
            </div>
          ) : (
            <table className="w-full text-[10px]" aria-label="回测交易记录">
              <thead className="sticky top-0 bg-[#0a0a0a] text-[#555]">
                <tr className="border-b border-[#333]">
                  <th className="px-3 py-2 text-left font-normal">日期</th>
                  <th className="px-3 py-2 text-left font-normal">类型</th>
                  <th className="px-3 py-2 text-right font-normal">价格</th>
                  <th className="px-3 py-2 text-right font-normal">数量</th>
                  <th className="px-3 py-2 text-right font-normal">盈亏</th>
                </tr>
              </thead>
              <tbody>
                {[...trades].reverse().map((t, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#1f1f1f] ${
                      t.type === "buy" ? "bg-[#0b130b]" : "bg-[#130b0b]"
                    }`}
                  >
                    <td className="px-3 py-1.5 text-[#666]">{t.date}</td>
                    <td
                      className={`px-3 py-1.5 font-bold ${t.type === "buy" ? "text-green-400" : "text-red-400"}`}
                    >
                      {t.type === "buy" ? "买入" : "卖出"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-[#eee]">
                      ${t.price.toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-[#aaa]">
                      {t.shares} 股
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-bold ${
                        t.pnl === null
                          ? "text-[#555]"
                          : t.pnl >= 0
                            ? "text-green-400"
                            : "text-red-400"
                      }`}
                    >
                      {t.pnl === null
                        ? "—"
                        : `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(0)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: 策略参数 ── */}
      {activeTab === "settings" && (
        <div className="flex-1 overflow-y-auto grid content-start lg:grid-cols-[minmax(260px,0.8fr)_minmax(360px,1.2fr)]">
          <section className="bg-[#0d0d0d] border-r border-b border-[#222] p-3">
            <div className="text-[#888] text-[10px] mb-2">选择策略</div>
            <div
              role="listbox"
              aria-label="回测策略"
              className="divide-y divide-slate-700"
            >
              {STRATEGIES.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStrategyId(s.id);
                    setParams({});
                    setHasRun(false);
                  }}
                  role="option"
                  aria-selected={strategyId === s.id}
                  className={`w-full px-2 py-1.5 flex items-center justify-between gap-3 text-left transition-colors ${
                    strategyId === s.id
                      ? "bg-[#1a1400]"
                      : "bg-[#111] hover:bg-[#151515]"
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${strategyId === s.id ? "text-[#f5a623]" : "text-[#aaa]"}`}
                  >
                    {s.label}
                  </div>
                  <div className="text-[9px] text-[#555] mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-[#0d0d0d] border-b border-[#222] p-3">
            <div className="text-[#888] text-[10px] mb-3">
              {strategy.label} — 参数配置
            </div>
            <div className="divide-y divide-[#222]">
              {strategy.params.map(p => (
                <div
                  key={p.key}
                  className="grid grid-cols-[minmax(90px,0.35fr)_minmax(160px,1fr)_80px] items-center gap-3 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#aaa] text-[10px]">{p.label}</span>
                  </div>
                  <div>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={effectiveParams[p.key] ?? p.default}
                      onChange={e =>
                        setParams(prev => ({
                          ...prev,
                          [p.key]: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full h-1 bg-[#222] appearance-none cursor-pointer accent-[#f5a623]"
                    />
                    <div className="flex justify-between text-[9px] text-[#444] mt-0.5">
                      <span>{p.min}</span>
                      <span>默认: {p.default}</span>
                      <span>{p.max}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() =>
                        setParams(prev => ({
                          ...prev,
                          [p.key]: Math.max(
                            p.min,
                            (effectiveParams[p.key] ?? p.default) - p.step
                          ),
                        }))
                      }
                      className="text-[#555] hover:text-[#eee] transition-colors"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <span className="text-[#f5a623] font-bold text-xs w-10 text-center">
                      {effectiveParams[p.key] ?? p.default}
                    </span>
                    <button
                      onClick={() =>
                        setParams(prev => ({
                          ...prev,
                          [p.key]: Math.min(
                            p.max,
                            (effectiveParams[p.key] ?? p.default) + p.step
                          ),
                        }))
                      }
                      className="text-[#555] hover:text-[#eee] transition-colors"
                    >
                      <ChevronUp size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2 bg-[#090909] border-b border-[#222] p-3 flex flex-wrap items-center gap-3">
            <div className="text-[#888] text-[10px] mb-2">初始资金</div>
            <div className="flex gap-2 flex-wrap">
              {[10000, 50000, 100000, 500000, 1000000].map(c => (
                <button
                  key={c}
                  onClick={() => setInitialCapital(c)}
                  className={`px-2 py-1 border border-[#222] text-[9px] font-bold transition-all ${
                    initialCapital === c
                      ? "bg-[#f5a623] text-black"
                      : "bg-[#111] text-[#666] hover:text-[#f5a623]"
                  }`}
                >
                  ${(c / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
          </section>

          <div className="lg:col-span-2 flex border-b border-[#222]">
            <button
              onClick={handleGridSearch}
              disabled={gridSearch.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1a1a1a] border-r border-[#333] text-[#aaa] text-xs font-bold hover:text-[#f5a623] transition-colors disabled:opacity-50"
            >
              {gridSearch.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Search size={12} />
              )}
              网格搜索优化
            </button>
            <button
              onClick={handleRunBacktest}
              disabled={backtest.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#f5a623] text-black text-xs font-bold hover:bg-[#e09515] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backtest.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
              {backtest.isPending
                ? "回测计算中..."
                : `运行 ${strategy.label} 策略回测`}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: 网格优化 ── */}
      {activeTab === "grid" && (
        <div className="flex-1 overflow-y-auto">
          {gridSearch.isPending ? (
            <DataLoadingSkeleton
              variant="bar"
              height={240}
              label={`正在搜索 ${strategy.label} 的最优参数组合`}
            />
          ) : gridSearch.error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <AlertTriangle size={32} className="text-red-400" />
              <p className="text-red-400 text-xs">{gridSearch.error.message}</p>
            </div>
          ) : !gridSearch.data ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <Search size={32} className="text-[#333]" />
              <p className="text-[#555] text-xs">
                点击「网格优化」按钮开始参数搜索
              </p>
              <p className="text-[#444] text-[9px]">
                将对 {gridDefaults.p1.key}（{gridDefaults.p1.values.join(", ")}
                ）× {gridDefaults.p2.key}（{gridDefaults.p2.values.join(", ")}
                ）进行穷举回测
              </p>
              <button
                onClick={handleGridSearch}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#333] text-[#aaa] text-xs font-bold hover:border-[#f5a623] hover:text-[#f5a623] transition-colors"
              >
                <Search size={12} /> 开始网格搜索
              </button>
            </div>
          ) : (
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
              {/* 最优参数 */}
              <section className="lg:col-span-2 bg-[#0d1a00] border-b border-[#2a3a00] p-3">
                <div className="text-[#888] text-[10px] mb-2">
                  最优参数组合（夏普比率最大化）
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {Object.entries(gridSearch.data.best.params).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1">
                      <span className="text-[#666] text-[10px]">{k}:</span>
                      <span className="text-[#f5a623] font-bold text-sm">
                        {v}
                      </span>
                    </div>
                  ))}
                  <div className="ml-auto flex items-center gap-3 text-[10px]">
                    <span className="text-[#666]">
                      夏普:{" "}
                      <span className="text-green-400 font-bold">
                        {gridSearch.data.best.sharpe.toFixed(3)}
                      </span>
                    </span>
                    <span className="text-[#666]">
                      收益:{" "}
                      <span
                        className={`font-bold ${gridSearch.data.best.totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {gridSearch.data.best.totalReturn.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setParams(gridSearch.data!.best.params);
                    setActiveTab("settings");
                  }}
                  className="mt-2 w-full py-1.5 bg-[#f5a623] text-black text-[10px] font-bold hover:bg-[#e09515] transition-colors"
                >
                  应用最优参数并运行回测
                </button>
              </section>

              {/* 指标切换 */}
              <div className="lg:col-span-2 flex gap-2 border-b border-[#222] bg-[#090909] px-3 py-2">
                {[
                  { id: "sharpe", label: "夏普比率" },
                  { id: "totalReturn", label: "总收益率" },
                  { id: "maxDrawdown", label: "最大回撤（越小越好）" },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setGridMetric(m.id as typeof gridMetric)}
                    className={`px-2 py-1 border-b text-[9px] font-bold transition-all ${
                      gridMetric === m.id
                        ? "border-[#f5a623] bg-[#222] text-[#f5a623]"
                        : "border-transparent bg-[#111] text-[#666] hover:text-[#f5a623]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* 热力图（散点图模拟） */}
              <section className="min-w-0 bg-[#0d0d0d] border-r border-b border-[#222] p-3">
                <div className="text-[#888] text-[10px] mb-2">
                  参数热力图 — {gridSearch.data.param1Label} ×{" "}
                  {gridSearch.data.param2Label}
                  <span className="text-[#555] ml-2">
                    （气泡大小 ={" "}
                    {gridMetric === "sharpe"
                      ? "夏普比率"
                      : gridMetric === "totalReturn"
                        ? "总收益"
                        : "回撤"}
                    ）
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart
                    margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="p1"
                      name={gridSearch.data.param1Label}
                      type="number"
                      tick={{ fill: "#555", fontSize: 8 }}
                      label={{
                        value: gridSearch.data.param1Label,
                        position: "insideBottom",
                        offset: -5,
                        fill: "#555",
                        fontSize: 9,
                      }}
                    />
                    <YAxis
                      dataKey="p2"
                      name={gridSearch.data.param2Label}
                      type="number"
                      tick={{ fill: "#555", fontSize: 8 }}
                      label={{
                        value: gridSearch.data.param2Label,
                        angle: -90,
                        position: "insideLeft",
                        fill: "#555",
                        fontSize: 9,
                      }}
                    />
                    <ZAxis dataKey="value" range={[40, 400]} />
                    <Tooltip content={<GridTooltip />} />
                    <Scatter
                      data={gridHeatmapData}
                      fill="#f5a623"
                      opacity={0.7}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </section>

              {/* 参数排行榜 */}
              <section className="bg-[#0d0d0d] border-b border-[#222] p-3">
                <div className="text-[#888] text-[10px] mb-2">
                  参数组合排行（按夏普比率）
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table
                    className="w-full text-[10px]"
                    aria-label="参数组合排行"
                  >
                    <thead className="sticky top-0 bg-[#0d0d0d] text-[#555]">
                      <tr className="border-b border-[#333]">
                        <th className="py-1 text-left font-normal">排名</th>
                        <th className="py-1 text-left font-normal">参数组合</th>
                        <th className="py-1 text-right font-normal">夏普</th>
                        <th className="py-1 text-right font-normal">收益</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...gridSearch.data.heatmap]
                        .sort((a, b) => b.sharpe - a.sharpe)
                        .slice(0, 10)
                        .map((d, i) => (
                          <tr
                            key={i}
                            className={`border-b border-[#222] ${i === 0 ? "bg-[#1a1400]" : "bg-[#111]"}`}
                          >
                            <td className="py-1.5 text-[#555]">#{i + 1}</td>
                            <td className="py-1.5 text-[#aaa]">
                              {gridSearch.data.param1Label}={d.p1},{" "}
                              {gridSearch.data.param2Label}={d.p2}
                            </td>
                            <td
                              className={`py-1.5 text-right font-bold ${d.sharpe >= 1 ? "text-green-400" : d.sharpe >= 0 ? "text-[#f5a623]" : "text-red-400"}`}
                            >
                              {d.sharpe.toFixed(3)}
                            </td>
                            <td
                              className={`py-1.5 text-right ${d.totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}
                            >
                              {d.totalReturn.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

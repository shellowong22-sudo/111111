/**
 * RES — 研究报告主页（完整版）
 *
 * Tab 1: 评级变更 — 实时分析师评级变更列表，点击触发 AI 总结
 * Tab 2: 一致预期 — 目标价区间、评级分布、上行空间可视化
 * Tab 3: 评级分布 — 全市场买/持/卖比例动态图表
 * Tab 4: 多股对比 — 选择 2-5 只股票，AI 横向对比投资价值，雷达图可视化
 * Tab 5: 历史档案 — AI 总结持久化历史，历史评级时间轴
 */
import { Fragment, useState, useCallback, useMemo } from "react";
import { usePanelExport } from "@/hooks/usePanelExport";
import AnalystRatingChart from "./AnalystRatingChart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  Legend,
  ReferenceLine,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  Target,
  Clock,
  BarChart2,
  Loader2,
  X,
  Plus,
  Check,
  Trophy,
  Star,
  History,
  GitCompare,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useModuleLiveFeed } from "@/hooks/useModuleLiveFeed";
import {
  formatFinancialAmount,
  selectCompanyFinancialDelivery,
} from "@/lib/openBBCompanyFinancial";
import type {
  AiReportSummary,
  ConsensusData,
  EquityCoverageObservation,
} from "../../../server/routers/res";

type AvailableConsensus = ConsensusData & {
  available: true;
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  targetHigh: number;
  targetLow: number;
  targetMean: number;
  targetMedian: number;
  currentPrice: number;
  numAnalysts: number;
  upside: number;
};

function hasConsensusValues(row: ConsensusData): row is AvailableConsensus {
  return (
    row.available &&
    [
      row.buy,
      row.hold,
      row.sell,
      row.strongBuy,
      row.strongSell,
      row.targetHigh,
      row.targetLow,
      row.targetMean,
      row.targetMedian,
      row.currentPrice,
      row.numAnalysts,
      row.upside,
    ].every(value => value !== null && Number.isFinite(value))
  );
}

interface RESPanelProps {
  onClose?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TICKERS = [
  "NVDA",
  "AAPL",
  "MSFT",
  "TSLA",
  "META",
  "AMZN",
  "GOOGL",
  "BABA",
];
const CONSENSUS_TICKERS = ["NVDA", "AAPL", "MSFT", "TSLA", "META"];
const COMPARE_POOL = [
  "NVDA",
  "AAPL",
  "MSFT",
  "TSLA",
  "META",
  "AMZN",
  "GOOGL",
  "AMD",
  "INTC",
  "NFLX",
];

const RATINGCOLOR: Record<string, string> = {
  买入: "text-green-400",
  增持: "text-green-400",
  强烈买入: "text-green-500",
  中性: "text-yellow-400",
  持有: "text-yellow-400",
  减持: "text-red-400",
  卖出: "text-red-500",
};

const CHG_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  upgrade: { bg: "bg-[#1a2a1a]", text: "text-green-400", label: "评级上调" },
  downgrade: { bg: "bg-[#2a1a1a]", text: "text-red-400", label: "评级下调" },
  target_up: { bg: "bg-[#1a1a2a]", text: "text-blue-400", label: "目标价↑" },
  target_down: {
    bg: "bg-[#2a1a1a]",
    text: "text-orange-400",
    label: "目标价↓",
  },
  initiate: { bg: "bg-[#1a2a2a]", text: "text-cyan-400", label: "首次覆盖" },
  maintain: { bg: "bg-[#1a1a1a]", text: "text-[#666]", label: "维持评级" },
};

const REC_LABEL: Record<string, { text: string; color: string }> = {
  strong_buy: { text: "强烈买入", color: "text-green-500" },
  buy: { text: "买入", color: "text-green-400" },
  hold: { text: "持有", color: "text-yellow-400" },
  sell: { text: "减持", color: "text-red-400" },
  strong_sell: { text: "强烈卖出", color: "text-red-500" },
};

// ─── AI Summary Panel (Overlay) ───────────────────────────────────────────────

interface AiSummaryPanelProps {
  ticker: string;
  name: string;
  rating: string;
  target?: number;
  prevTarget?: number;
  analyst: string;
  currentPrice?: number;
  consensusBuy?: number;
  consensusHold?: number;
  consensusSell?: number;
  targetMean?: number;
  targetHigh?: number;
  targetLow?: number;
  marketChangePct?: number;
  sessionOpen?: number;
  sessionHigh?: number;
  sessionLow?: number;
  volume?: number;
  averageVolume20d?: number;
  return5d?: number;
  return20d?: number;
  return60d?: number;
  realizedVolatility20d?: number;
  rangeHigh?: number;
  rangeLow?: number;
  maxDrawdown?: number;
  marketTimestamp?: string;
  source?: string;
  onClose: () => void;
}

function AiSummaryPanel(props: AiSummaryPanelProps) {
  const [summary, setSummary] = useState<AiReportSummary | null>(null);

  const saveSummary = trpc.res.saveSummary.useMutation();

  const summarize = trpc.res.summarizeReport.useMutation({
    onSuccess: data => {
      setSummary(data);
      // 自动持久化到数据库
      saveSummary.mutate({
        ticker: data.ticker,
        name: props.name,
        analyst: props.analyst,
        rating: props.rating,
        target: props.target,
        investmentThesis: data.investmentThesis,
        targetPriceRationale: data.targetPriceRationale,
        targetPrice: data.targetPrice ?? undefined,
        catalysts: data.catalysts,
        risks: data.risks,
        recommendation: data.recommendation,
        timeHorizon: data.timeHorizon,
        keyMetrics: data.keyMetrics,
        conclusion: data.conclusion,
      });
    },
  });

  const handleGenerate = useCallback(() => {
    summarize.mutate({
      ticker: props.ticker,
      name: props.name,
      rating: props.rating,
      target: props.target,
      prevTarget: props.prevTarget,
      analyst: props.analyst,
      currentPrice: props.currentPrice,
      consensusBuy: props.consensusBuy,
      consensusHold: props.consensusHold,
      consensusSell: props.consensusSell,
      targetMean: props.targetMean,
      targetHigh: props.targetHigh,
      targetLow: props.targetLow,
      marketChangePct: props.marketChangePct,
      sessionOpen: props.sessionOpen,
      sessionHigh: props.sessionHigh,
      sessionLow: props.sessionLow,
      volume: props.volume,
      averageVolume20d: props.averageVolume20d,
      return5d: props.return5d,
      return20d: props.return20d,
      return60d: props.return60d,
      realizedVolatility20d: props.realizedVolatility20d,
      rangeHigh: props.rangeHigh,
      rangeLow: props.rangeLow,
      maxDrawdown: props.maxDrawdown,
      marketTimestamp: props.marketTimestamp,
      source: props.source,
    });
  }, [props, summarize]);

  const rec = summary ? REC_LABEL[summary.recommendation] : null;

  return (
    <div className="absolute inset-0 z-50 bg-[#050505] border border-[#333] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-b border-[#222] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#f5a623]" />
          <span className="text-[#f5a623] font-bold text-sm">AI 投资总结</span>
          <span className="text-[#888] text-xs">
            — {props.ticker} {props.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {summary && saveSummary.isSuccess && (
            <span className="text-[10px] text-green-500 flex items-center gap-1">
              <Check size={10} /> 已保存到档案
            </span>
          )}
          <button
            onClick={props.onClose}
            className="text-[#555] hover:text-[#eee] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center gap-4 text-[10px] text-[#666] shrink-0">
        <span className="text-[#f5a623] font-bold">{props.ticker}</span>
        <span className={RATINGCOLOR[props.rating] || "text-[#aaa]"}>
          {props.rating}
        </span>
        {props.target && (
          <span>
            目标价 <span className="text-[#eee]">${props.target}</span>
          </span>
        )}
        {props.currentPrice && (
          <span>
            当前 <span className="text-[#eee]">${props.currentPrice}</span>
          </span>
        )}
        <span className="text-[#444]">{props.analyst}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!summary && !summarize.isPending && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-center">
              <Sparkles
                size={32}
                className="text-[#f5a623] mx-auto mb-3 opacity-60"
              />
              <p className="text-[#888] text-xs mb-1">
                AI 将分析并生成投资报告摘要，自动保存到历史档案
              </p>
              <div className="text-[#555] text-[10px] space-y-0.5 mt-2">
                <p>• 核心投资逻辑（3-4 条）</p>
                <p>• 目标价测算依据与估值方法</p>
                <p>• 未来关键催化剂</p>
                <p>• 主要下行风险</p>
                <p>• 关键估值指标</p>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-5 py-2 bg-[#f5a623] text-black text-xs font-bold hover:bg-[#e09515] transition-colors"
            >
              <Sparkles size={12} /> 生成 AI 投资总结
            </button>
          </div>
        )}

        {summarize.isPending && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 size={24} className="text-[#f5a623] animate-spin" />
            <p className="text-[#888] text-xs">AI 正在分析研究数据...</p>
            <p className="text-[#555] text-[10px]">
              提取投资逻辑 · 评估目标价 · 识别催化剂
            </p>
          </div>
        )}

        {summarize.isError && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <AlertTriangle size={24} className="text-red-400" />
            <p className="text-red-400 text-xs">
              生成失败：{summarize.error.message}
            </p>
            <button
              onClick={handleGenerate}
              className="px-4 py-1.5 border border-[#333] bg-[#1a1a1a] text-[#aaa] text-xs hover:text-[#eee] transition-colors"
            >
              重试
            </button>
          </div>
        )}

        {summary && (
          <div className="grid min-h-full lg:grid-cols-2">
            <div className="lg:col-span-2 flex items-center justify-between border-b border-[#222] px-3 py-2">
              <div className="flex items-center gap-3">
                {rec && (
                  <span className={`text-sm font-bold ${rec.color}`}>
                    {rec.text}
                  </span>
                )}
                {summary.targetPrice && (
                  <span className="text-[#eee] text-sm font-bold">
                    目标价 ${summary.targetPrice}
                  </span>
                )}
                <span className="text-[#555] text-[10px]">
                  {summary.timeHorizon}
                </span>
              </div>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#f5a623] transition-colors"
              >
                <RefreshCw size={10} /> 重新生成
              </button>
            </div>

            <section className="lg:col-span-2 bg-[#0d1a0d] border-b border-[#1a3a1a] p-3">
              <p className="text-green-300 text-xs font-medium">
                {summary.conclusion}
              </p>
            </section>

            <section className="bg-[#0d0d0d] border-r border-b border-[#222] p-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <BarChart2 size={11} className="text-[#f5a623]" />
                <span className="text-[#f5a623] text-[10px] font-bold">
                  核心投资逻辑
                </span>
              </div>
              <div className="space-y-2">
                {summary.investmentThesis.map((point, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[#f5a623] text-[10px] shrink-0 mt-0.5">
                      {i + 1}.
                    </span>
                    <p className="text-[#ccc] text-[11px] leading-relaxed">
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[#0d0d0d] border-b border-[#222] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={11} className="text-blue-400" />
                <span className="text-blue-400 text-[10px] font-bold">
                  目标价测算依据
                </span>
              </div>
              <p className="text-[#bbb] text-[11px] leading-relaxed">
                {summary.targetPriceRationale}
              </p>
            </section>

            {summary.keyMetrics.length > 0 && (
              <table
                className="lg:col-span-2 w-full border-b border-[#222] text-[10px]"
                aria-label="AI 总结关键估值指标"
              >
                <thead>
                  <tr className="border-b border-[#333] text-[#555]">
                    <th className="px-3 py-1.5 text-left font-normal">
                      关键估值指标
                    </th>
                    <th className="px-3 py-1.5 text-right font-normal">数值</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.keyMetrics.map((m, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="px-3 py-1.5 text-[#888]">{m.label}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#eee]">
                        {m.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="lg:col-span-2 grid grid-cols-2 border-b border-[#222]">
              <section className="bg-[#0d0d0d] border-r border-[#1a3a1a] p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp size={11} className="text-green-400" />
                  <span className="text-green-400 text-[10px] font-bold">
                    关键催化剂
                  </span>
                </div>
                <div className="space-y-1.5">
                  {summary.catalysts.map((c, i) => (
                    <div key={i} className="flex gap-1.5">
                      <ChevronRight
                        size={9}
                        className="text-green-600 shrink-0 mt-0.5"
                      />
                      <p className="text-[#aaa] text-[10px] leading-relaxed">
                        {c}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="bg-[#0d0d0d] p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={11} className="text-red-400" />
                  <span className="text-red-400 text-[10px] font-bold">
                    下行风险
                  </span>
                </div>
                <div className="space-y-1.5">
                  {summary.risks.map((r, i) => (
                    <div key={i} className="flex gap-1.5">
                      <ChevronRight
                        size={9}
                        className="text-red-600 shrink-0 mt-0.5"
                      />
                      <p className="text-[#aaa] text-[10px] leading-relaxed">
                        {r}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:col-span-2 flex items-center gap-1 px-3 py-1 text-[9px] text-[#444]">
              <Clock size={9} />
              <span>
                AI 生成于 {new Date(summary.generatedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Multi-Stock Compare Panel ────────────────────────────────────────────────

interface CompareResult {
  comparisons: Array<{
    ticker: string;
    name: string;
    score: number;
    rank: number;
    strengths: string[];
    weaknesses: string[];
    verdict: string;
  }>;
  winner: string;
  winnerReason: string;
  summary: string;
  radarData: Array<{ metric: string; [key: string]: number | string }>;
}

function CompareView({
  consensusBatch,
}: {
  consensusBatch: AvailableConsensus[] | undefined;
}) {
  const [selected, setSelected] = useState<string[]>(["NVDA", "AAPL", "MSFT"]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const { panelRef, exporting, exportPanel } = usePanelExport();

  const compareStocks = trpc.res.compareStocks.useMutation({
    onSuccess: data => setResult(data as CompareResult),
  });

  const toggleTicker = (t: string) => {
    setSelected(prev =>
      prev.includes(t)
        ? prev.length > 2
          ? prev.filter(x => x !== t)
          : prev
        : prev.length < 5
          ? [...prev, t]
          : prev
    );
    setResult(null);
  };

  const selectedConsensus = useMemo(
    () => (consensusBatch ?? []).filter(c => selected.includes(c.ticker)),
    [consensusBatch, selected]
  );
  const missingConsensus = selected.filter(
    ticker => !selectedConsensus.some(row => row.ticker === ticker)
  );

  const handleCompare = () => {
    compareStocks.mutate({
      tickers: selected,
      consensusData: selectedConsensus,
    });
  };

  const handleExportPDF = async () => {
    if (!result) return;
    await exportPanel("pdf", {
      title: "股票横向对比研究报告",
      code: "RES-COMPARE",
      subtitle: `对比标的：${selected.join(" / ")} | 综合最优：${result.winner}`,
      signals: result.comparisons
        .sort((a, b) => a.rank - b.rank)
        .map(c => ({
          label: `#${c.rank} ${c.ticker} (${c.name})`,
          value: `综合评分 ${c.score}/100`,
          status: (c.rank === 1
            ? "bullish"
            : c.rank <= 2
              ? "neutral"
              : "bearish") as "bullish" | "neutral" | "bearish",
        })),
      notes: result.summary,
    });
  };

  const RANK_COLORS = ["#f5a623", "#888", "#cd7f32", "#555", "#444"];

  return (
    <div ref={panelRef} className="flex-1 overflow-y-auto">
      {/* Stock Selector */}
      <div className="bg-[#0d0d0d] border-b border-[#222] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#888] text-[10px]">
            选择 2-5 只股票进行横向对比
          </span>
          <span className="text-[#555] text-[10px]">
            已选 {selected.length}/5
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {COMPARE_POOL.map(t => (
            <button
              key={t}
              onClick={() => toggleTicker(t)}
              className={`px-2.5 py-1 text-[10px] font-bold border transition-all ${
                selected.includes(t)
                  ? "bg-[#f5a623] text-black border-[#f5a623]"
                  : "bg-[#111] text-[#888] border-[#333] hover:border-[#f5a623] hover:text-[#f5a623]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleCompare}
            disabled={
              selected.length < 2 ||
              missingConsensus.length > 0 ||
              compareStocks.isPending
            }
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#f5a623] text-black text-xs font-bold hover:bg-[#e09515] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {compareStocks.isPending ? (
              <>
                <Loader2 size={12} className="animate-spin" /> AI 分析中...
              </>
            ) : (
              <>
                <GitCompare size={12} /> 开始 AI 横向对比
              </>
            )}
          </button>
          {result && (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              title="导出 PDF 研究报告"
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1a1a1a] border border-[#333] text-[#aaa] text-xs hover:border-[#f5a623] hover:text-[#f5a623] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              <span className="hidden sm:inline">导出 PDF</span>
            </button>
          )}
        </div>
        {missingConsensus.length > 0 && (
          <div className="mt-2 border-t border-[#332815] pt-2 text-[9px] text-[#b89a61]">
            缺少可核验一致预期：{missingConsensus.join("、")}；AI
            对比已禁用，不生成替代结论。
          </div>
        )}
      </div>

      {compareStocks.isError && (
        <div className="flex items-center gap-2 text-red-400 text-xs p-3 bg-[#1a0a0a] border-b border-red-900">
          <AlertTriangle size={12} /> 对比失败：{compareStocks.error.message}
        </div>
      )}

      {result && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
          {/* Winner Banner */}
          <div className="lg:col-span-2 bg-[#1a1200] border-b border-[#f5a623]/40 p-3 flex items-center gap-3">
            <Trophy size={18} className="text-[#f5a623] shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#f5a623] font-bold text-sm">
                  {result.winner}
                </span>
                <span className="text-[#888] text-[10px]">综合最优</span>
              </div>
              <p className="text-[#bbb] text-[10px] mt-0.5">
                {result.winnerReason}
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#0d0d0d] border-b border-[#222] p-3">
            <p className="text-[#999] text-[10px] leading-relaxed">
              {result.summary}
            </p>
          </div>

          {/* Radar Chart */}
          {result.radarData.length > 0 && (
            <section className="bg-[#0d0d0d] border-r border-b border-[#222] p-3">
              <div className="text-[#888] text-[10px] mb-2">
                多维度综合评分雷达图
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={result.radarData}>
                  <PolarGrid stroke="#222" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: "#666", fontSize: 9 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: "#444", fontSize: 8 }}
                  />
                  {selected.map((t, i) => (
                    <Radar
                      key={t}
                      name={t}
                      dataKey={t}
                      stroke={
                        ["#f5a623", "#60a5fa", "#22c55e", "#f87171", "#a78bfa"][
                          i
                        ]
                      }
                      fill={
                        ["#f5a623", "#60a5fa", "#22c55e", "#f87171", "#a78bfa"][
                          i
                        ]
                      }
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: "1px solid #333",
                      fontSize: 10,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Score table */}
          <div className="border-b border-[#222] overflow-x-auto">
            <table className="w-full text-[10px]" aria-label="多股综合评分">
              <thead>
                <tr className="border-b border-[#333] text-[#555]">
                  <th className="px-2 py-1.5 text-left font-normal">
                    排名/标的
                  </th>
                  <th className="px-2 py-1.5 text-right font-normal">评分</th>
                  <th className="px-2 py-1.5 text-left font-normal">
                    结论与依据
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...result.comparisons]
                  .sort((a, b) => a.rank - b.rank)
                  .map(c => (
                    <tr
                      key={c.ticker}
                      className="border-b border-[#222] align-top"
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span
                            className="font-bold text-xs"
                            style={{ color: RANK_COLORS[c.rank - 1] }}
                          >
                            #{c.rank}
                          </span>
                          <span className="text-[#f5a623] font-bold text-xs">
                            {c.ticker}
                          </span>
                          <span className="text-[#666] text-[10px]">
                            {c.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-[#f5a623]">
                        {c.score}
                      </td>
                      <td className="px-2 py-2">
                        <p className="text-[#aaa] leading-relaxed">
                          {c.verdict}
                        </p>
                        <div className="mt-1 text-green-500">
                          优势：{c.strengths.join("；")}
                        </div>
                        <div className="mt-1 text-red-500">
                          劣势：{c.weaknesses.join("；")}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Archive View ─────────────────────────────────────────────────────

function HistoryView() {
  const [historyTicker, setHistoryTicker] = useState("");
  const [ratingTicker, setRatingTicker] = useState("NVDA");

  const { data: summaryHistory, isLoading: histLoading } =
    trpc.res.getSummaryHistory.useQuery(
      {
        ticker: historyTicker || undefined,
        limit: 20,
      },
      { refetchInterval: 30000 }
    );

  const { data: ratingHistory, isLoading: ratingLoading } =
    trpc.res.getRatingHistory.useQuery({
      ticker: ratingTicker,
      limit: 30,
    });

  const summaries = (summaryHistory?.summaries ?? []) as Array<{
    id: number;
    ticker: string;
    name: string;
    analyst: string;
    rating: string;
    target: number | null;
    conclusion: string;
    recommendation: string;
    timeHorizon: string;
    createdAt: string;
    investmentThesis: string[];
    catalysts: string[];
    risks: string[];
    keyMetrics: Array<{ label: string; value: string }>;
  }>;

  const ratingRows = (ratingHistory?.history ?? []) as Array<{
    ticker: string;
    name: string;
    analyst: string;
    firm: string;
    rating: string;
    prevRating: string | null;
    target: number | null;
    prevTarget: number | null;
    chg: string;
    currentPrice: number | null;
    upside: number | null;
    date: string;
  }>;

  return (
    <div className="flex-1 overflow-y-auto grid content-start lg:grid-cols-2">
      {/* AI 总结档案 */}
      <section className="bg-[#0d0d0d] border-r border-b border-[#222] p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <History size={11} className="text-[#f5a623]" />
            <span className="text-[#f5a623] text-[10px] font-bold">
              AI 总结历史档案
            </span>
          </div>
          <div className="flex items-center gap-1">
            <input
              value={historyTicker}
              onChange={e => setHistoryTicker(e.target.value.toUpperCase())}
              placeholder="筛选股票..."
              className="bg-[#111] border border-[#333] text-[#eee] text-[10px] px-2 py-1 w-24 placeholder-[#444] focus:outline-none focus:border-[#f5a623]"
            />
          </div>
        </div>

        {histLoading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 size={16} className="text-[#f5a623] animate-spin" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="text-center py-6 text-[#444] text-xs">
            <History size={24} className="mx-auto mb-2 opacity-30" />
            <p>暂无 AI 总结记录</p>
            <p className="text-[9px] mt-1">
              在评级变更或一致预期视图中点击 AI 总结即可自动保存
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#222]">
            {summaries.map(s => (
              <div
                key={s.id}
                className="border-b border-[#1a1a1a] p-2.5 hover:bg-[#111] transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#f5a623] font-bold text-[10px]">
                      {s.ticker}
                    </span>
                    <span
                      className={`text-[9px] font-bold ${REC_LABEL[s.recommendation]?.color ?? "text-[#888]"}`}
                    >
                      {REC_LABEL[s.recommendation]?.text ?? s.recommendation}
                    </span>
                    {s.target && (
                      <span className="text-[#555] text-[9px]">
                        目标 ${s.target}
                      </span>
                    )}
                  </div>
                  <span className="text-[#444] text-[9px]">{s.createdAt}</span>
                </div>
                <p className="text-[#aaa] text-[10px] leading-relaxed">
                  {s.conclusion}
                </p>
                {s.investmentThesis?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.investmentThesis
                      .slice(0, 2)
                      .map((t: string, i: number) => (
                        <span
                          key={i}
                          className="text-[9px] text-[#666] bg-[#111] px-1.5 py-0.5 border border-[#1a1a1a] truncate max-w-[180px]"
                        >
                          {t}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 历史评级时间轴 */}
      <section className="bg-[#0d0d0d] border-b border-[#222] p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-blue-400" />
            <span className="text-blue-400 text-[10px] font-bold">
              历史评级时间轴
            </span>
          </div>
          <div className="flex gap-1">
            {["NVDA", "AAPL", "MSFT", "TSLA", "META"].map(t => (
              <button
                key={t}
                onClick={() => setRatingTicker(t)}
                className={`px-2 py-0.5 border-b text-[9px] font-bold transition-all ${
                  ratingTicker === t
                    ? "border-blue-500 bg-[#172554] text-white"
                    : "border-transparent bg-[#111] text-[#666] hover:text-[#aaa]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {ratingLoading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 size={16} className="text-blue-400 animate-spin" />
          </div>
        ) : ratingRows.length === 0 ? (
          <div className="text-center py-6 text-[#444] text-xs">
            <Clock size={24} className="mx-auto mb-2 opacity-30" />
            <p>暂无历史评级数据</p>
            <p className="text-[9px] mt-1">
              评级变更数据将在首次加载时自动缓存
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#222]" />
            <div className="divide-y divide-[#222] pl-5">
              {ratingRows.map((r, i) => {
                const style = CHG_STYLE[r.chg] ?? CHG_STYLE.maintain;
                return (
                  <div key={i} className="relative">
                    {/* Dot */}
                    <div
                      className={`absolute -left-5 top-1.5 w-2 h-2 border ${
                        r.chg === "upgrade" || r.chg === "initiate"
                          ? "bg-green-500 border-green-400"
                          : r.chg === "downgrade"
                            ? "bg-red-500 border-red-400"
                            : r.chg === "target_up"
                              ? "bg-blue-500 border-blue-400"
                              : r.chg === "target_down"
                                ? "bg-orange-500 border-orange-400"
                                : "bg-[#333] border-[#444]"
                      }`}
                    />
                    <div className={`p-2 ${style.bg}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-1 py-0.5 ${style.text} bg-[#0a0a0a]`}
                          >
                            {style.label}
                          </span>
                          <span className="text-[#888] text-[9px]">
                            {r.firm}
                          </span>
                          <span className="text-[#555] text-[9px]">
                            {r.analyst}
                          </span>
                        </div>
                        <span className="text-[#444] text-[9px]">{r.date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        {r.prevRating && (
                          <span className="text-[#555]">{r.prevRating} →</span>
                        )}
                        <span
                          className={RATINGCOLOR[r.rating] || "text-[#aaa]"}
                        >
                          {r.rating}
                        </span>
                        {r.prevTarget && r.target && (
                          <span className="text-[#555]">
                            ${r.prevTarget} →{" "}
                            <span
                              className={
                                r.target > r.prevTarget
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              ${r.target}
                            </span>
                          </span>
                        )}
                        {!r.prevTarget && r.target && (
                          <span className="text-[#aaa]">
                            目标价 ${r.target}
                          </span>
                        )}
                        {r.upside !== null && (
                          <span
                            className={
                              r.upside >= 0 ? "text-green-400" : "text-red-400"
                            }
                          >
                            {Number(r.upside) >= 0 ? "+" : ""}
                            {Number(r.upside)?.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function formatMarketNumber(value: number | null, digits = 2) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function formatMarketPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMarketVolume(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString();
}

function CoverageDataTable({
  rows,
  isLoading,
  onAnalyze,
}: {
  rows: EquityCoverageObservation[];
  isLoading: boolean;
  onAnalyze: (row: EquityCoverageObservation) => void;
}) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[#f5a623]" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky left-0 top-0 z-10 flex items-center justify-between border-b border-[#222] bg-[#0a0a0a] px-3 py-1.5 text-[9px]">
        <span className="text-[#777]">
          暂无评级变更数据；以下显示原有 8 个覆盖标的的真实行情数据层
        </span>
        <span className="text-[#f5a623]">
          {rows.filter(row => row.available).length}/{rows.length} 行情可用 ·
          延迟/收盘口径
        </span>
      </div>
      <table
        className="min-w-[1460px] w-full border-collapse text-[9px]"
        aria-label="RES 原有覆盖标的行情研究数据层"
      >
        <thead className="sticky top-[25px] z-10 bg-[#0b0b0b] text-[#666]">
          <tr className="border-b border-[#333]">
            <th className="w-7 px-1 py-1.5" aria-label="展开历史图" />
            <th className="px-2 py-1.5 text-left font-normal">代码 / 名称</th>
            <th className="px-2 py-1.5 text-right font-normal">最新价</th>
            <th className="px-2 py-1.5 text-right font-normal">涨跌幅</th>
            <th className="px-2 py-1.5 text-right font-normal">开 / 高 / 低</th>
            <th className="px-2 py-1.5 text-right font-normal">
              成交量 / 20日均量
            </th>
            <th className="px-2 py-1.5 text-right font-normal">5日</th>
            <th className="px-2 py-1.5 text-right font-normal">20日</th>
            <th className="px-2 py-1.5 text-right font-normal">60日</th>
            <th className="px-2 py-1.5 text-right font-normal">20日波动率</th>
            <th className="px-2 py-1.5 text-right font-normal">6月最大回撤</th>
            <th className="px-2 py-1.5 text-right font-normal">6月区间</th>
            <th className="px-2 py-1.5 text-left font-normal">
              市场时间 / 来源
            </th>
            <th className="px-2 py-1.5 text-center font-normal">研究操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const expanded = expandedTicker === row.ticker;
            const changeClass =
              (row.changePct ?? 0) > 0
                ? "text-green-400"
                : (row.changePct ?? 0) < 0
                  ? "text-red-400"
                  : "text-[#888]";
            return (
              <Fragment key={row.ticker}>
                <tr className="border-b border-[#191919] hover:bg-[#101010]">
                  <td className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      title={expanded ? "收起历史序列" : "展开历史序列"}
                      onClick={() =>
                        setExpandedTicker(expanded ? null : row.ticker)
                      }
                      className="text-[#666] hover:text-[#f5a623]"
                    >
                      <ChevronRight
                        size={11}
                        className={expanded ? "rotate-90" : ""}
                      />
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="font-bold text-[#f5a623]">
                      {row.ticker}
                    </span>
                    <span className="ml-1.5 text-[#777]">{row.name}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-[#eee]">
                    {formatMarketNumber(row.price)}{" "}
                    <span className="text-[#555]">{row.currency ?? ""}</span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-bold ${changeClass}`}
                  >
                    {formatMarketPercent(row.changePct)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[#aaa]">
                    {formatMarketNumber(row.open)} /{" "}
                    {formatMarketNumber(row.high)} /{" "}
                    {formatMarketNumber(row.low)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[#888]">
                    {formatMarketVolume(row.volume)} /{" "}
                    {formatMarketVolume(row.averageVolume20d)}
                  </td>
                  {[row.return5d, row.return20d, row.return60d].map(
                    (value, index) => (
                      <td
                        key={index}
                        className={`px-2 py-1.5 text-right ${(value ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {formatMarketPercent(value)}
                      </td>
                    )
                  )}
                  <td className="px-2 py-1.5 text-right text-[#aaa]">
                    {formatMarketPercent(row.realizedVolatility20d)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-red-400">
                    {formatMarketPercent(row.maxDrawdown)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[#888]">
                    {formatMarketNumber(row.rangeLow)} -{" "}
                    {formatMarketNumber(row.rangeHigh)}
                  </td>
                  <td className="max-w-[240px] px-2 py-1.5 text-left">
                    <div className="truncate text-[#777]">
                      {row.marketTimestamp ?? row.retrievedAt}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      disabled={!row.available}
                      onClick={() => onAnalyze(row)}
                      className="inline-flex items-center gap-1 border border-[#5f4617] px-2 py-1 text-[#f5a623] hover:bg-[#1a1400] disabled:border-[#222] disabled:text-[#444]"
                    >
                      <Sparkles size={10} /> AI 证据摘要
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-[#333] bg-[#090909]">
                    <td colSpan={14} className="px-3 py-2">
                      {row.history.length ? (
                        <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-3">
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={row.history.slice(-65)}>
                                <CartesianGrid
                                  stroke="#191919"
                                  strokeDasharray="3 3"
                                />
                                <XAxis
                                  dataKey="date"
                                  tick={{ fill: "#555", fontSize: 8 }}
                                  minTickGap={40}
                                />
                                <YAxis
                                  domain={["auto", "auto"]}
                                  tick={{ fill: "#555", fontSize: 8 }}
                                  width={50}
                                />
                                <Tooltip
                                  contentStyle={{
                                    background: "#0d0d0d",
                                    border: "1px solid #333",
                                    fontSize: 9,
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="close"
                                  name="收盘价"
                                  stroke="#f5a623"
                                  dot={false}
                                  strokeWidth={1.4}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <table
                            className="w-full border-collapse text-[9px]"
                            aria-label={`${row.ticker} 数据质量说明`}
                          >
                            <tbody>
                              <tr className="border-b border-[#222]">
                                <td className="py-1 text-[#555]">历史观察</td>
                                <td className="py-1 text-right text-[#aaa]">
                                  {row.history.length} 个交易日
                                </td>
                              </tr>
                              <tr className="border-b border-[#222]">
                                <td className="py-1 text-[#555]">数据状态</td>
                                <td className="py-1 text-right text-[#f5a623]">
                                  延迟或最近收盘
                                </td>
                              </tr>
                              <tr className="border-b border-[#222]">
                                <td className="py-1 text-[#555]">评级状态</td>
                                <td className="py-1 text-right text-[#888]">
                                  授权来源未配置
                                </td>
                              </tr>
                              <tr>
                                <td className="py-1 text-[#555]">边界</td>
                                <td className="py-1 pl-3 text-right leading-4 text-[#666]">
                                  {row.limitation}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-[#555]">
                          {row.limitation}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type ViewType =
  | "changes"
  | "consensus"
  | "distribution"
  | "compare"
  | "history"
  | "trend";

export default function RESPanel({ onClose }: RESPanelProps) {
  const [activeView, setActiveView] = useState<ViewType>("changes");
  const [selectedTicker, setSelectedTicker] = useState("NVDA");
  const [aiTarget, setAiTarget] = useState<null | Omit<
    AiSummaryPanelProps,
    "onClose"
  >>(null);
  const financialFeed = useModuleLiveFeed("/terminal?open=res&module=stocks", true);
  const financialDelivery = useMemo(
    () => selectCompanyFinancialDelivery(financialFeed.items),
    [financialFeed.items]
  );

  // ── Data ──────────────────────────────────────────────────────────────────

  const {
    data: ratingsData,
    isLoading: ratingsLoading,
    refetch: refetchRatings,
  } = trpc.res.getRatings.useQuery(
    { tickers: DEFAULT_TICKERS },
    { refetchInterval: 5 * 60 * 1000 }
  );

  const { data: consensusBatch, isLoading: consensusLoading } =
    trpc.res.getConsensusBatch.useQuery({ tickers: CONSENSUS_TICKERS });

  const { data: ratingHistorySummary, isLoading: ratingHistorySummaryLoading } =
    trpc.res.getRatingHistorySummary.useQuery(
      { tickers: DEFAULT_TICKERS },
      { enabled: activeView === "trend" }
    );

  const {
    data: singleConsensus,
    isLoading: consensusSingleLoading,
    error: consensusSingleError,
  } = trpc.res.getConsensus.useQuery({ ticker: selectedTicker });

  const ratings = ratingsData?.ratings ?? [];
  const coverage = ratingsData?.coverage ?? [];
  const consensus =
    singleConsensus && hasConsensusValues(singleConsensus)
      ? singleConsensus
      : null;
  const availableConsensusBatch = useMemo(
    () => (consensusBatch ?? []).filter(hasConsensusValues),
    [consensusBatch]
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const upgradeCount = ratings.filter(
    r => r.chg === "upgrade" || r.chg === "initiate"
  ).length;
  const downgradeCount = ratings.filter(r => r.chg === "downgrade").length;
  const targetUpCount = ratings.filter(r => r.chg === "target_up").length;

  const analyzeCoverage = useCallback((row: EquityCoverageObservation) => {
    setAiTarget({
      ticker: row.ticker,
      name: row.name,
      rating: "评级源未配置",
      analyst: row.source,
      currentPrice: row.price ?? undefined,
      marketChangePct: row.changePct ?? undefined,
      sessionOpen: row.open ?? undefined,
      sessionHigh: row.high ?? undefined,
      sessionLow: row.low ?? undefined,
      volume: row.volume ?? undefined,
      averageVolume20d: row.averageVolume20d ?? undefined,
      return5d: row.return5d ?? undefined,
      return20d: row.return20d ?? undefined,
      return60d: row.return60d ?? undefined,
      realizedVolatility20d: row.realizedVolatility20d ?? undefined,
      rangeHigh: row.rangeHigh ?? undefined,
      rangeLow: row.rangeLow ?? undefined,
      maxDrawdown: row.maxDrawdown ?? undefined,
      marketTimestamp: row.marketTimestamp ?? undefined,
      source: row.source,
    });
  }, []);

  const upside = consensus ? consensus.upside.toFixed(1) : null;

  const ratingDistData = useMemo(() => {
    if (!availableConsensusBatch.length) return [];
    const totals = { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 };
    availableConsensusBatch.forEach(c => {
      totals.strongBuy += c.strongBuy;
      totals.buy += c.buy - c.strongBuy;
      totals.hold += c.hold;
      totals.sell += c.sell - c.strongSell;
      totals.strongSell += c.strongSell;
    });
    return [
      { name: "强烈买入", value: totals.strongBuy, color: "#16a34a" },
      { name: "买入", value: totals.buy, color: "#22c55e" },
      { name: "持有", value: totals.hold, color: "#f59e0b" },
      { name: "减持", value: totals.sell, color: "#f87171" },
      { name: "强烈卖出", value: totals.strongSell, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [availableConsensusBatch]);

  const TABS: { id: ViewType; label: string; icon: React.ReactNode }[] = [
    { id: "changes", label: "评级变更", icon: <TrendingUp size={10} /> },
    { id: "consensus", label: "一致预期", icon: <Target size={10} /> },
    { id: "distribution", label: "评级分布", icon: <BarChart2 size={10} /> },
    { id: "compare", label: "多股对比", icon: <GitCompare size={10} /> },
    { id: "history", label: "历史档案", icon: <History size={10} /> },
    { id: "trend", label: "评级趋势", icon: <TrendingUp size={10} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-[#080808] text-[#eee] font-mono relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#222] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[#f5a623] font-bold text-sm">RES</span>
          <span className="text-[#666] text-xs">研究报告主页</span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-green-400">{upgradeCount} 上调</span>
            <span className="text-red-400">{downgradeCount} 下调</span>
            <span className="text-blue-400">{targetUpCount} 目标价↑</span>
            <span className="text-[#f5a623]">
              {ratingsData?.marketDataAvailable ?? 0}/{DEFAULT_TICKERS.length}{" "}
              行情
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchRatings()}
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

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a1a] shrink-0 bg-[#0a0a0a]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold border-b-2 transition-all ${
              activeView === tab.id
                ? "border-[#f5a623] text-[#f5a623]"
                : "border-transparent text-[#555] hover:text-[#888]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="status"
        className="border-b border-[#222] bg-[#090909] px-3 py-1 text-[9px] text-[#666]"
      >
        {ratingsData
          ? `评级事件 · ${ratingsData.available ? "可用" : "不可用"} · 读取 ${ratingsData.retrievedAt} · ${ratingsData.limitation}`
          : "正在读取评级事件状态"}
      </div>

      {/* ── View: 评级变更 ── */}
      {activeView === "changes" && (
        <div className="flex-1 overflow-y-auto">
          {financialDelivery && (
            <section aria-label="RES SEC 申报财务证据" className="border-b border-[#2b2112] bg-[#0b0905]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b2112] px-3 py-2 text-[10px]">
                <div><b className="text-[#f5a623]">SEC 申报财务证据</b><span className="ml-2 text-[#777]">{financialDelivery.symbol} · 仅作为研究报告事实底稿</span></div>
                <div className="text-[#666]">{financialDelivery.item.dataset?.metadata.provider.toUpperCase()} · {financialDelivery.rows.length} 期 · {financialDelivery.item.dataset?.columns.length} 字段 · {financialFeed.connection === "live" ? "实时投递" : "补收通道"}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-[10px]">
                  <thead className="bg-[#0e0d0a] text-[#666]"><tr><th className="px-3 py-2">申报期</th><th>财年</th><th>币种</th><th>收入事实</th><th>营业利润事实</th><th>净利润事实</th><th>基本 EPS</th><th>摊薄 EPS</th><th>每股股息</th></tr></thead>
                  <tbody>{[...financialDelivery.rows].reverse().map(row => <tr key={row.periodEnding} className="border-t border-[#221d13]"><td className="px-3 py-2 text-[#f5a623]">{row.periodEnding}</td><td>{row.fiscalYear ?? '—'} {row.fiscalPeriod}</td><td>{row.currency}</td><td>{formatFinancialAmount(row.revenue)}</td><td>{formatFinancialAmount(row.operatingIncome)}</td><td>{formatFinancialAmount(row.netIncome)}</td><td>{row.basicEps ?? '—'}</td><td>{row.dilutedEps ?? '—'}</td><td>{row.dividendsPerShare ?? '—'}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-t border-[#221d13] px-3 py-1.5 text-[9px] text-[#5f5a50]"><span>查询 {financialDelivery.item.dataset?.metadata.queriedAt ?? '—'} · 观测 {financialDelivery.item.dataset?.metadata.observedAt ?? '—'} · 时效 {financialDelivery.item.dataset?.metadata.realtimeStatus}</span><span className="font-mono">checksum {financialDelivery.item.dataset?.metadata.checksum.slice(0, 20)}</span></div>
            </section>
          )}
          {ratingsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="text-[#f5a623] animate-spin" />
            </div>
          ) : ratings.length === 0 ? (
            <CoverageDataTable
              rows={coverage}
              isLoading={ratingsLoading}
              onAnalyze={analyzeCoverage}
            />
          ) : (
            <div className="divide-y divide-[#111]">
              {ratings.map(r => {
                const style = CHG_STYLE[r.chg] ?? CHG_STYLE.maintain;
                return (
                  <div
                    key={r.id}
                    className={`px-4 py-2.5 cursor-pointer hover:bg-[#0d0d0d] transition-colors ${style.bg}`}
                    onClick={() =>
                      setAiTarget({
                        ticker: r.ticker,
                        name: r.name,
                        rating: r.rating,
                        target: r.target,
                        prevTarget: r.prevTarget ?? undefined,
                        analyst: `${r.analyst} (${r.firm})`,
                        currentPrice: r.currentPrice ?? undefined,
                        consensusBuy: consensus?.buy,
                        consensusHold: consensus?.hold,
                        consensusSell: consensus?.sell,
                        targetMean: consensus?.targetMean,
                        targetHigh: consensus?.targetHigh,
                        targetLow: consensus?.targetLow,
                      })
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[#f5a623] font-bold text-xs w-12 shrink-0">
                          {r.ticker}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 bg-[#0a0a0a] ${style.text}`}
                        >
                          {style.label}
                        </span>
                        <span
                          className={`text-xs font-bold ${RATINGCOLOR[r.rating] || "text-[#aaa]"}`}
                        >
                          {r.rating}
                        </span>
                        {r.prevRating && r.prevRating !== r.rating && (
                          <span className="text-[#444] text-[10px]">
                            ← {r.prevRating}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        {r.target && (
                          <span className="text-[#aaa]">
                            目标{" "}
                            <span className="text-[#eee] font-bold">
                              ${r.target}
                            </span>
                            {r.prevTarget && (
                              <span
                                className={
                                  r.target > r.prevTarget
                                    ? "text-green-400"
                                    : "text-red-400"
                                }
                              >
                                {" "}
                                ({r.target > r.prevTarget ? "+" : ""}
                                {(
                                  ((r.target - r.prevTarget) / r.prevTarget) *
                                  100
                                ).toFixed(0)}
                                %)
                              </span>
                            )}
                          </span>
                        )}
                        {r.upside !== null && (
                          <span
                            className={
                              r.upside >= 0 ? "text-green-400" : "text-red-400"
                            }
                          >
                            {r.upside >= 0 ? (
                              <ArrowUpRight size={10} className="inline" />
                            ) : (
                              <ArrowDownRight size={10} className="inline" />
                            )}
                            {Math.abs(r.upside).toFixed(1)}%
                          </span>
                        )}
                        <Sparkles
                          size={10}
                          className="text-[#f5a623] opacity-50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#555]">
                      <span>{r.name}</span>
                      <span className="text-[#333]">·</span>
                      <span>{r.analyst}</span>
                      <span className="text-[#333]">·</span>
                      <span>{r.firm}</span>
                      <span className="text-[#333]">·</span>
                      <span>{r.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── View: 一致预期 ── */}
      {activeView === "consensus" && (
        <div className="flex-1 overflow-y-auto">
          {/* Ticker Selector */}
          <div className="flex gap-1.5 flex-wrap border-b border-[#222] bg-[#0a0a0a] px-3 py-2">
            {CONSENSUS_TICKERS.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTicker(t)}
                className={`px-2.5 py-1 border-b text-[10px] font-bold transition-all ${
                  selectedTicker === t
                    ? "border-[#f5a623] bg-[#222] text-[#f5a623]"
                    : "border-transparent bg-[#111] text-[#666] hover:text-[#f5a623]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {consensusSingleLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="text-[#f5a623] animate-spin" />
            </div>
          ) : !consensus ? (
            <div className="border-y border-[#332815] bg-[#151109] px-3 py-3 text-[10px]">
              <div className="mb-1 font-bold text-[#f5a623]">
                {selectedTicker} 一致预期来源不可用
              </div>
              <div className="text-[#888]">
                {consensusSingleError?.message ??
                  singleConsensus?.limitation ??
                  "未取得可核验的一致预期；终端未生成替代数值。"}
              </div>
              {singleConsensus && (
                <div className="mt-1 text-[#555]">
                  读取{" "}
                  {singleConsensus.retrievedAt}
                </div>
              )}
            </div>
          ) : (
            <div className="grid lg:grid-cols-2">
              {/* Stats Row */}
              <table
                className="lg:col-span-2 w-full border-b border-[#222] text-[10px]"
                aria-label="一致预期统计"
              >
                <thead>
                  <tr className="border-b border-[#333] text-[#555]">
                    <th className="px-3 py-1.5 text-left font-normal">指标</th>
                    <th className="px-3 py-1.5 text-right font-normal">
                      观察值
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "当前价",
                      value: `$${consensus.currentPrice.toFixed(2)}`,
                      color: "text-[#eee]",
                    },
                    {
                      label: "目标均价",
                      value: `$${consensus.targetMean.toFixed(2)}`,
                      color: "text-[#f5a623]",
                    },
                    {
                      label: "潜在涨幅",
                      value: `${consensus.upside >= 0 ? "+" : ""}${upside}%`,
                      color:
                        consensus.upside >= 0
                          ? "text-green-400"
                          : "text-red-400",
                    },
                    {
                      label: "覆盖分析师",
                      value: `${consensus.numAnalysts} 家`,
                      color: "text-blue-400",
                    },
                  ].map((s, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="px-3 py-1.5 text-[#777]">{s.label}</td>
                      <td
                        className={`px-3 py-1.5 text-right font-bold ${s.color}`}
                      >
                        {s.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Rating Bar */}
              <section className="bg-[#0d0d0d] border-r border-b border-[#222] p-3">
                <div className="text-[#888] text-[10px] mb-3">评级分布</div>
                <div className="flex items-center gap-0 h-7 overflow-hidden">
                  {consensus.buy > 0 && (
                    <div
                      className="bg-green-600 flex items-center justify-center text-[10px] text-white font-bold h-full"
                      style={{
                        width: `${(consensus.buy / consensus.numAnalysts) * 100}%`,
                      }}
                    >
                      {consensus.buy}
                    </div>
                  )}
                  {consensus.hold > 0 && (
                    <div
                      className="bg-yellow-500 flex items-center justify-center text-[10px] text-black font-bold h-full"
                      style={{
                        width: `${(consensus.hold / consensus.numAnalysts) * 100}%`,
                      }}
                    >
                      {consensus.hold}
                    </div>
                  )}
                  {consensus.sell > 0 && (
                    <div
                      className="bg-red-500 flex items-center justify-center text-[10px] text-white font-bold h-full"
                      style={{
                        width: `${(consensus.sell / consensus.numAnalysts) * 100}%`,
                      }}
                    >
                      {consensus.sell}
                    </div>
                  )}
                </div>
                <div className="flex gap-4 mt-2 text-[10px]">
                  <span className="text-green-400">
                    买入 {consensus.buy} (
                    {((consensus.buy / consensus.numAnalysts) * 100).toFixed(0)}
                    %)
                  </span>
                  <span className="text-yellow-400">持有 {consensus.hold}</span>
                  <span className="text-red-400">卖出 {consensus.sell}</span>
                </div>
              </section>

              {/* Target Price Chart */}
              <section className="bg-[#0d0d0d] border-b border-[#222] p-3">
                <div className="text-[#888] text-[10px] mb-2">
                  目标价分布 vs 当前价
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart
                    data={[
                      {
                        name: "当前价",
                        val: consensus.currentPrice,
                        fill: "#888",
                      },
                      {
                        name: "最低目标",
                        val: consensus.targetLow,
                        fill: "#f87171",
                      },
                      {
                        name: "中位目标",
                        val: consensus.targetMedian,
                        fill: "#60a5fa",
                      },
                      {
                        name: "均值目标",
                        val: consensus.targetMean,
                        fill: "#f5a623",
                      },
                      {
                        name: "最高目标",
                        val: consensus.targetHigh,
                        fill: "#22c55e",
                      },
                    ]}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#555", fontSize: 9 }}
                    />
                    <YAxis
                      tick={{ fill: "#555", fontSize: 9 }}
                      domain={[
                        consensus.targetLow * 0.88,
                        consensus.targetHigh * 1.05,
                      ]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: "1px solid #333",
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      y={consensus.currentPrice}
                      stroke="#888"
                      strokeDasharray="4 2"
                    />
                    <Bar dataKey="val" radius={[2, 2, 0, 0]}>
                      {[
                        { fill: "#888" },
                        { fill: "#f87171" },
                        { fill: "#60a5fa" },
                        { fill: "#f5a623" },
                        { fill: "#22c55e" },
                      ].map((c, i) => (
                        <Cell key={i} fill={c.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </section>

              {/* AI Summary Button */}
              <button
                onClick={() =>
                  setAiTarget({
                    ticker: selectedTicker,
                    name: consensus.name,
                    rating:
                      consensus.buy > consensus.hold + consensus.sell
                        ? "买入"
                        : consensus.hold > consensus.sell
                          ? "持有"
                          : "减持",
                    target: consensus.targetMean,
                    analyst: "市场一致预期",
                    currentPrice: consensus.currentPrice,
                    consensusBuy: consensus.buy,
                    consensusHold: consensus.hold,
                    consensusSell: consensus.sell,
                    targetMean: consensus.targetMean,
                    targetHigh: consensus.targetHigh,
                    targetLow: consensus.targetLow,
                  })
                }
                className="lg:col-span-2 w-full flex items-center justify-center gap-2 py-2.5 bg-[#1a1400] border-b border-[#f5a623]/30 text-[#f5a623] text-xs hover:bg-[#2a2000] transition-colors"
              >
                <Sparkles size={12} /> 基于一致预期生成 AI
                投资总结（自动保存到档案）
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── View: 评级分布 ── */}
      {activeView === "distribution" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {consensusLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="text-[#f5a623] animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0d0d0d] border border-[#222] rounded p-3">
                  <div className="text-[#888] text-[10px] mb-2">
                    综合评级分布
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={ratingDistData}
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
                        innerRadius={30}
                        dataKey="value"
                        nameKey="name"
                        label={({ percent }) =>
                          `${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={{ stroke: "#444" }}
                      >
                        {ratingDistData.map((r, i) => (
                          <Cell key={i} fill={r.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#111",
                          border: "1px solid #333",
                          fontSize: 10,
                        }}
                      />
                      <Legend
                        iconSize={8}
                        wrapperStyle={{ fontSize: 9, color: "#888" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-[#0d0d0d] border border-[#222] rounded p-3">
                  <div className="text-[#888] text-[10px] mb-2">
                    各股票买入比例
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={availableConsensusBatch.map(c => ({
                        name: c.ticker,
                        buyPct:
                          c.numAnalysts > 0
                            ? Math.round((c.buy / c.numAnalysts) * 100)
                            : 0,
                      }))}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#888", fontSize: 9 }}
                      />
                      <YAxis
                        tick={{ fill: "#555", fontSize: 9 }}
                        unit="%"
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#111",
                          border: "1px solid #333",
                          fontSize: 10,
                        }}
                        formatter={(v: number) => [`${v}%`, "买入占比"]}
                      />
                      <Bar dataKey="buyPct" radius={[2, 2, 0, 0]}>
                        {availableConsensusBatch.map((c, i) => (
                          <Cell
                            key={i}
                            fill={
                              c.buy / c.numAnalysts > 0.6
                                ? "#22c55e"
                                : c.buy / c.numAnalysts > 0.4
                                  ? "#f5a623"
                                  : "#f87171"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#0d0d0d] border border-[#222] rounded p-3">
                <div className="text-[#888] text-[10px] mb-2">
                  目标价上行空间对比
                </div>
                <div className="space-y-1.5">
                  {availableConsensusBatch
                    .sort((a, b) => b.upside - a.upside)
                    .map(c => (
                      <div key={c.ticker} className="flex items-center gap-3">
                        <span className="text-[#f5a623] font-bold w-12 shrink-0">
                          {c.ticker}
                        </span>
                        <div className="flex-1 h-3 bg-[#111] rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-all ${c.upside >= 0 ? "bg-green-600" : "bg-red-600"}`}
                            style={{
                              width: `${Math.min(Math.abs(c.upside), 50) * 2}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-[10px] font-bold w-14 text-right shrink-0 ${c.upside >= 0 ? "text-green-400" : "text-red-400"}`}
                        >
                          {c.upside >= 0 ? "+" : ""}
                          {c.upside.toFixed(1)}%
                        </span>
                        <span className="text-[#555] text-[10px] w-20 text-right shrink-0">
                          ${c.currentPrice.toFixed(0)} → $
                          {c.targetMean.toFixed(0)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── View: 多股对比 ── */}
      {activeView === "compare" && (
        <CompareView consensusBatch={availableConsensusBatch} />
      )}

      {/* ── View: 历史档案 ── */}
      {activeView === "history" && <HistoryView />}

      {/* ── View: 评级趋势 ── */}
      {activeView === "trend" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#f5a623] text-[10px] font-bold">
              分析师评级趋势图表
            </span>
            <span className="text-[#555] text-[9px]">
              {ratingHistorySummaryLoading
                ? "正在统计历史评级数据…"
                : ratingHistorySummary?.available
                  ? `基于 ${ratingHistorySummary.tickerCount} 只热门股票的 ${ratingHistorySummary.total} 条历史评级数据`
                  : `覆盖 ${ratingHistorySummary?.tickerCount ?? DEFAULT_TICKERS.length} 只热门股票 · 历史评级源未配置 · 0 条`}
            </span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {DEFAULT_TICKERS.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTicker(t)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                  selectedTicker === t
                    ? "bg-[#f5a623] text-black"
                    : "bg-[#111] text-[#666] hover:text-[#f5a623] border border-[#222]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <AnalystRatingChart ticker={selectedTicker} />
        </div>
      )}

      {/* AI Summary Overlay */}
      {aiTarget && (
        <AiSummaryPanel {...aiTarget} onClose={() => setAiTarget(null)} />
      )}
    </div>
  );
}

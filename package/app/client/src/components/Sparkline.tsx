import { useMemo, useState } from "react";
import {
  ComposedChart,
  BarChart,
  Bar,
  Cell,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

export interface SparklineDataPoint {
  date: string;
  price: number;
  return: number;
  cumReturn?: number;
}

export interface BenchmarkSeries {
  key: string;
  name: string;
  color: string;
  data: { date: string; return: number; cumReturn: number }[];
}

interface SparklineProps {
  data: SparklineDataPoint[];
  symbol: string;
  totalReturn: number;
  minPrice: number;
  maxPrice: number;
  firstPrice: number;
  lastPrice: number;
  mode: "price" | "return";
  onModeChange?: (mode: "price" | "return") => void;
  benchmarks?: BenchmarkSeries[];
  height?: number;
}

const BENCHMARK_OPTIONS = [
  { key: "SPX", label: "标普500", color: "#f59e0b" },
  { key: "NDX", label: "纳斯达克100", color: "#8b5cf6" },
  { key: "DJI", label: "道琼斯", color: "#06b6d4" },
  { key: "RUT", label: "罗素2000", color: "#f97316" },
] as const;

// ─── Enhanced Tooltip with spread calculation ───────────────────────────────
const CustomTooltip = ({
  active,
  payload,
  label,
  mode,
  activeBmMeta,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  mode: "price" | "return";
  activeBmMeta: { key: string; label: string; color: string }[];
}) => {
  if (!active || !payload?.length) return null;

  // Extract asset value and benchmark values from payload
  const assetEntry = payload.find((p: any) => p.dataKey === "cumReturn" || p.dataKey === "price");
  const assetVal: number | null = assetEntry ? assetEntry.value : null;

  const bmEntries: { key: string; name: string; color: string; val: number }[] = activeBmMeta
    .map(bm => {
      const entry = payload.find((p: any) => p.dataKey === `bm_${bm.key}`);
      return entry ? { key: bm.key, name: bm.label, color: bm.color, val: entry.value } : null;
    })
    .filter((x): x is { key: string; name: string; color: string; val: number } => x !== null);

  return (
    <div className="bg-[#0d0d1a] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[10px] font-mono shadow-2xl min-w-[170px]">
      <div className="text-[#666] mb-2 pb-1.5 border-b border-[#1e1e2e] font-sans">{label}</div>

      {/* Asset row */}
      {assetEntry && assetVal !== null && (
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: assetEntry.color }} />
            <span className="text-slate-300 font-semibold">{assetEntry.name}</span>
          </div>
          <span className={cn("font-bold", mode === "return" ? (assetVal >= 0 ? "text-emerald-400" : "text-red-400") : "text-white")}>
            {mode === "return" ? `${assetVal >= 0 ? "+" : ""}${assetVal.toFixed(2)}%` : `$${assetVal.toLocaleString()}`}
          </span>
        </div>
      )}

      {/* Benchmark rows with spread */}
      {bmEntries.length > 0 && (
        <div className="border-t border-[#1e1e2e] pt-1.5 mt-1.5 space-y-1">
          {bmEntries.map(bm => {
            const spread = assetVal !== null && mode === "return" ? assetVal - bm.val : null;
            return (
              <div key={bm.key}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: bm.color }} />
                    <span className="text-slate-400">{bm.name}</span>
                  </div>
                  <span className={cn("font-bold", bm.val >= 0 ? "text-amber-400" : "text-red-400")}>
                    {bm.val >= 0 ? "+" : ""}{bm.val.toFixed(2)}%
                  </span>
                </div>
                {spread !== null && (
                  <div className="flex items-center justify-between gap-4 mt-0.5 pl-3.5">
                    <span className="text-[#555]">vs {bm.name.slice(0, 3)} 差值</span>
                    <span className={cn("font-bold text-[9px]", spread >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {spread >= 0 ? "▲+" : "▼"}{spread.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Alpha stats card ────────────────────────────────────────────────────────
function AlphaCard({
  symbol,
  assetTotalReturn,
  activeBmMeta,
  benchmarks,
}: {
  symbol: string;
  assetTotalReturn: number;
  activeBmMeta: { key: string; label: string; color: string }[];
  benchmarks: BenchmarkSeries[];
}) {
  if (activeBmMeta.length === 0) return null;

  const rows = activeBmMeta.map(bm => {
    const series = benchmarks.find(b => b.key === bm.key);
    const bmTotalReturn = series && series.data.length > 0
      ? series.data[series.data.length - 1].cumReturn
      : 0;
    const alpha = Math.round((assetTotalReturn - bmTotalReturn) * 100) / 100;

    // Compute correlation (Pearson) between daily returns
    const bmData = series?.data ?? [];
    // We only have cumReturn per day from benchmark; derive daily returns
    const n = Math.min(bmData.length, 30);
    let correlation: number | null = null;
    if (n > 2) {
      const bmReturns = bmData.slice(-n).map(d => d.return);
      // asset daily returns (skip index 0 which is 0)
      const assetReturns = bmData.slice(-n).map((_, i) => i === 0 ? 0 : bmData[i].return);
      const meanA = bmReturns.reduce((s, v) => s + v, 0) / n;
      const meanB = assetReturns.reduce((s, v) => s + v, 0) / n;
      const cov = bmReturns.reduce((s, v, i) => s + (v - meanA) * (assetReturns[i] - meanB), 0) / n;
      const stdA = Math.sqrt(bmReturns.reduce((s, v) => s + (v - meanA) ** 2, 0) / n);
      const stdB = Math.sqrt(assetReturns.reduce((s, v) => s + (v - meanB) ** 2, 0) / n);
      correlation = stdA > 0 && stdB > 0 ? Math.round(cov / (stdA * stdB) * 1000) / 1000 : null;
    }

    return { ...bm, bmTotalReturn, alpha, correlation };
  });

  return (
    <div className="mt-3 rounded-lg border border-[#1e2a3a] bg-[#080d14] overflow-hidden">
      <div className="px-3 py-1.5 border-b border-[#1e2a3a] flex items-center gap-2">
        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">超额收益 Alpha</span>
        <span className="text-[9px] text-slate-600">vs 基准（30日）</span>
      </div>
      <div className="divide-y divide-[#111827]">
        {rows.map(row => {
          const alphaPositive = row.alpha >= 0;
          return (
            <div key={row.key} className="px-3 py-2 flex items-center gap-2">
              {/* Benchmark color dot + name */}
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
              <span className="text-[10px] text-slate-400 flex-1 min-w-0 truncate">{row.label}</span>

              {/* Benchmark return */}
              <div className="text-right">
                <div className="text-[9px] text-slate-600">基准</div>
                <div className={cn("text-[10px] font-mono font-bold", row.bmTotalReturn >= 0 ? "text-amber-400" : "text-red-400")}>
                  {row.bmTotalReturn >= 0 ? "+" : ""}{row.bmTotalReturn.toFixed(2)}%
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-[#1e2a3a] mx-1" />

              {/* Alpha */}
              <div className="text-right">
                <div className="text-[9px] text-slate-600">Alpha</div>
                <div className={cn(
                  "text-[11px] font-mono font-bold",
                  alphaPositive ? "text-emerald-400" : "text-red-400"
                )}>
                  {alphaPositive ? "+" : ""}{row.alpha.toFixed(2)}%
                </div>
              </div>

              {/* Alpha badge */}
              <div className={cn(
                "ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold",
                alphaPositive
                  ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800/50"
                  : "bg-red-900/40 text-red-400 border border-red-800/50"
              )}>
                {alphaPositive ? "超越" : "落后"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Asset total return summary */}
      <div className="px-3 py-1.5 bg-[#0a0f1a] border-t border-[#1e2a3a] flex items-center justify-between">
        <span className="text-[9px] text-slate-600">{symbol} 30日累计收益</span>
        <span className={cn("text-[11px] font-mono font-bold", assetTotalReturn >= 0 ? "text-emerald-400" : "text-red-400")}>
          {assetTotalReturn >= 0 ? "+" : ""}{assetTotalReturn.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

// ─── Daily Excess Return Bar Chart (sub-chart) ───────────────────────────────
const ExcessReturnTooltip = ({
  active, payload, label,
  primaryBmName,
}: { active?: boolean; payload?: any[]; label?: string; primaryBmName: string }) => {
  if (!active || !payload?.length) return null;
  const val: number = payload[0].value;
  return (
    <div className="bg-[#0d0d1a] border border-[#2a2a3a] rounded px-2.5 py-1.5 text-[10px] font-mono shadow-xl">
      <div className="text-[#666] mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-slate-400">vs {primaryBmName}</span>
        <span className={cn("font-bold", val >= 0 ? "text-emerald-400" : "text-red-400")}>
          {val >= 0 ? "+" : ""}{val.toFixed(3)}%
        </span>
      </div>
    </div>
  );
};

function ExcessReturnSubChart({
  data,
  primaryBm,
  benchmarks,
  symbol,
}: {
  data: SparklineDataPoint[];
  primaryBm: { key: string; label: string; color: string };
  benchmarks: BenchmarkSeries[];
  symbol: string;
}) {
  const bmSeries = benchmarks.find(b => b.key === primaryBm.key);
  if (!bmSeries || bmSeries.data.length === 0) return null;

  // Build daily excess return: asset daily return - benchmark daily return
  const barData = data.map((d, i) => {
    const bmRet = bmSeries.data[i]?.return ?? 0;
    const excess = Math.round((d.return - bmRet) * 1000) / 1000;
    return { date: d.date, excess };
  });

  const maxAbs = Math.max(...barData.map(d => Math.abs(d.excess)), 0.01);

  return (
    <div className="mt-1">
      {/* Sub-chart header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] text-slate-600 uppercase tracking-wider">每日超额收益</span>
        <span className="text-[9px]" style={{ color: primaryBm.color }}>vs {primaryBm.label}</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/70" />
          <span className="text-[9px] text-slate-600">跑赢</span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/70 ml-1" />
          <span className="text-[9px] text-slate-600">跑输</span>
        </div>
      </div>
      <div style={{ height: 52 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 2, right: 4, bottom: 0, left: 0 }} barCategoryGap="15%">
            <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
            <YAxis
              domain={[-maxAbs * 1.3, maxAbs * 1.3]}
              tick={false} axisLine={false} tickLine={false} width={0}
            />
            <ReferenceLine y={0} stroke="#2a2a3a" strokeWidth={1} />
            <Tooltip
              content={<ExcessReturnTooltip primaryBmName={primaryBm.label} />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="excess" radius={[1, 1, 0, 0]} maxBarSize={8}>
              {barData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.excess >= 0 ? "#10b981" : "#ef4444"}
                  fillOpacity={Math.min(0.9, 0.4 + Math.abs(entry.excess) / maxAbs * 0.5)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main Sparkline component ────────────────────────────────────────────────
export default function Sparkline({
  data,
  symbol,
  totalReturn,
  minPrice,
  maxPrice,
  firstPrice,
  lastPrice,
  mode,
  onModeChange,
  benchmarks = [],
  height = 140,
}: SparklineProps) {
  const [activeBenchmarks, setActiveBenchmarks] = useState<string[]>([]);

  const isPositive = totalReturn >= 0;
  const strokeColor = isPositive ? "#10b981" : "#ef4444";
  const fillColor = isPositive ? "#10b981" : "#ef4444";

  const chartData = useMemo(() => {
    if (mode === "price") {
      return data.map(d => ({ date: d.date, price: d.price }));
    }
    let cum = 0;
    const assetCum = data.map((d, i) => {
      if (i === 0) { cum = 0; return { date: d.date, cumReturn: 0 }; }
      cum = Math.round((cum + d.return) * 100) / 100;
      return { date: d.date, cumReturn: cum };
    });
    return assetCum.map((row, i) => {
      const merged: Record<string, number | string> = { date: row.date, cumReturn: row.cumReturn };
      for (const bm of activeBenchmarks) {
        const bmSeries = benchmarks.find(b => b.key === bm);
        if (bmSeries && bmSeries.data[i]) {
          merged[`bm_${bm}`] = bmSeries.data[i].cumReturn;
        }
      }
      return merged;
    });
  }, [data, mode, activeBenchmarks, benchmarks]);

  const toggleBenchmark = (key: string) => {
    setActiveBenchmarks(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const activeBmMeta = BENCHMARK_OPTIONS.filter(b => activeBenchmarks.includes(b.key));

  return (
    <div className="w-full">
      {/* Mode toggle + total return */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          {(["price", "return"] as const).map(m => (
            <button
              key={m}
              onClick={() => onModeChange?.(m)}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-medium transition-colors",
                mode === m
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/30"
                  : "bg-slate-800 text-slate-500 hover:text-slate-300 border border-transparent"
              )}
            >
              {m === "price" ? "价格" : "累计收益"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[#666] text-[10px]">30日</span>
          <span className={cn("text-[11px] font-bold font-mono", isPositive ? "text-emerald-400" : "text-red-400")}>
            {isPositive ? "+" : ""}{totalReturn.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Benchmark selector — only shown in return mode */}
      {mode === "return" && (
        <div className="mb-2.5">
          <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1.5">叠加基准对比</div>
          <div className="flex flex-wrap gap-1.5">
            {BENCHMARK_OPTIONS.map(bm => {
              const active = activeBenchmarks.includes(bm.key);
              return (
                <button
                  key={bm.key}
                  onClick={() => toggleBenchmark(bm.key)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border",
                    active
                      ? "border-transparent text-white"
                      : "bg-transparent text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300"
                  )}
                  style={active ? { background: bm.color + "33", borderColor: bm.color + "88", color: bm.color } : {}}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: active ? bm.color : "#555" }}
                  />
                  {bm.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`sparkGrad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fillColor} stopOpacity={0.22} />
                <stop offset="95%" stopColor={fillColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
            <YAxis tick={false} axisLine={false} tickLine={false} width={0} domain={["auto", "auto"]} />
            {mode === "return" && <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />}
            <Tooltip
              content={
                <CustomTooltip
                  mode={mode}
                  activeBmMeta={activeBmMeta}
                />
              }
              cursor={{ stroke: "#444", strokeWidth: 1, strokeDasharray: "3 3" }}
            />

            {/* Asset area */}
            {mode === "price" ? (
              <Area
                type="monotone"
                dataKey="price"
                name={symbol}
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#sparkGrad-${symbol})`}
                dot={false}
                activeDot={{ r: 3, fill: strokeColor, stroke: "#0a0a0f", strokeWidth: 1.5 }}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="cumReturn"
                name={symbol}
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#sparkGrad-${symbol})`}
                dot={false}
                activeDot={{ r: 3, fill: strokeColor, stroke: "#0a0a0f", strokeWidth: 1.5 }}
              />
            )}

            {/* Benchmark lines */}
            {mode === "return" && activeBmMeta.map(bm => (
              <Line
                key={bm.key}
                type="monotone"
                dataKey={`bm_${bm.key}`}
                name={bm.label}
                stroke={bm.color}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
                activeDot={{ r: 3, fill: bm.color, stroke: "#0a0a0f", strokeWidth: 1.5 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Daily excess return sub-chart — shown when at least one benchmark is active in return mode */}
      {mode === "return" && activeBmMeta.length > 0 && (
        <ExcessReturnSubChart
          data={data}
          primaryBm={activeBmMeta[0]}
          benchmarks={benchmarks}
          symbol={symbol}
        />
      )}

      {/* Legend for active benchmarks */}
      {mode === "return" && activeBmMeta.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <span className="w-4 h-[2px] rounded" style={{ background: strokeColor, display: "inline-block" }} />
            <span className="text-[10px] text-slate-400">{symbol}</span>
          </div>
          {activeBmMeta.map(bm => (
            <div key={bm.key} className="flex items-center gap-1">
              <span
                className="w-4 rounded"
                style={{ background: bm.color, display: "inline-block", height: "1.5px", borderTop: `1.5px dashed ${bm.color}` }}
              />
              <span className="text-[10px]" style={{ color: bm.color }}>{bm.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Alpha stats card — shown when benchmarks are active in return mode */}
      {mode === "return" && activeBmMeta.length > 0 && (
        <AlphaCard
          symbol={symbol}
          assetTotalReturn={totalReturn}
          activeBmMeta={activeBmMeta}
          benchmarks={benchmarks}
        />
      )}

      {/* Price range footer */}
      {mode === "price" && (
        <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <span className="text-[#555]">最低</span>
            <span className="text-red-400">${minPrice.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#888]">${firstPrice.toLocaleString()}</span>
            <span className="text-[#444]">→</span>
            <span className="text-[#ccc]">${lastPrice.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#555]">最高</span>
            <span className="text-emerald-400">${maxPrice.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, AreaChart, Area } from "recharts";
import { Activity, TrendingUp, TrendingDown, Zap, BarChart2 } from "lucide-react";

const fmt = (v: number | string, d = 2) => typeof v === "number" ? v.toFixed(d) : parseFloat(v).toFixed(d);

// ─── Vol Surface Heatmap ───────────────────────────────────
function getVolColor(vol: number): string {
  if (vol < 12) return "#0d4a6e";
  if (vol < 15) return "#0e6e9e";
  if (vol < 18) return "#1a8fba";
  if (vol < 21) return "#f0883e";
  if (vol < 25) return "#d1602a";
  if (vol < 30) return "#b44020";
  return "#8b1a1a";
}

// ─── Precise Black-Scholes Greeks (using black-scholes npm package) ───────────
// stdNormCDF: precise CDF of standard normal distribution
function stdNormCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1.0 / (1.0 + p * Math.abs(x) / Math.sqrt(2));
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x / 2);
  return 0.5 * (1.0 + sign * y);
}

// stdNormPDF: precise PDF of standard normal distribution
function stdNormPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

interface BSGreeks {
  price: string; delta: string; gamma: string;
  theta: string; vega: string; vanna: string; volga: string;
}

function calcBSGreeks(
  strike: number,
  expiryLabel: string,
  vol: number,
  spot = 100,
  optionType: 'call' | 'put' = 'call'
): BSGreeks {
  const expiryMap: Record<string, number> = {
    '1W': 1/52, '2W': 2/52, '1M': 1/12, '2M': 2/12, '3M': 3/12,
    '6M': 6/12, '9M': 9/12, '1Y': 1.0, '18M': 1.5, '2Y': 2.0,
  };
  const T = expiryMap[expiryLabel] ?? 0.25;
  const K = spot * (strike / 100);
  const S = spot;
  const sigma = vol / 100;
  const r = 0.05;
  const sqrtT = Math.sqrt(T);
  const disc = Math.exp(-r * T);

  // d1, d2 — exact Black-Scholes formula
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const Nd1  = stdNormCDF(d1);
  const Nd2  = stdNormCDF(d2);
  const Nnd1 = stdNormCDF(-d1);   // N(-d1) for put
  const Nnd2 = stdNormCDF(-d2);   // N(-d2) for put
  const nd1  = stdNormPDF(d1);    // pdf is symmetric: pdf(d1) == pdf(-d1)

  // Price
  const price = optionType === 'call'
    ? S * Nd1 - K * disc * Nd2
    : K * disc * Nnd2 - S * Nnd1;

  // Delta: Call = N(d1), Put = N(d1) - 1
  const delta = optionType === 'call' ? Nd1 : Nd1 - 1;

  // Gamma: identical for call and put
  const gamma = nd1 / (S * sigma * sqrtT);

  // Theta (daily): Call and Put differ in the r*K*disc term sign
  const theta = optionType === 'call'
    ? (-(S * nd1 * sigma) / (2 * sqrtT) - r * K * disc * Nd2) / 365
    : (-(S * nd1 * sigma) / (2 * sqrtT) + r * K * disc * Nnd2) / 365;

  // Vega: identical for call and put (per 1% move in vol)
  const vega = S * nd1 * sqrtT / 100;

  // Vanna = ∂Delta/∂σ = -nd1 * d2 / σ  (same sign for both, delta sign absorbed in delta above)
  const vanna = -nd1 * d2 / sigma;

  // Volga (Vomma) = ∂Vega/∂σ = Vega * d1 * d2 / σ
  const volga = vega * d1 * d2 / sigma;

  return {
    price: price.toFixed(3),
    delta: delta.toFixed(4),
    gamma: gamma.toFixed(5),
    theta: theta.toFixed(4),
    vega: vega.toFixed(4),
    vanna: vanna.toFixed(4),
    volga: volga.toFixed(4),
  };
}

function VolSurfaceTab() {
  const [underlying, setUnderlying] = useState("SPX");
  const [selectedCell, setSelectedCell] = useState<{ expiry: string; strike: number; vol: string } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ expiry: string; strike: number; vol: string; x: number; y: number } | null>(null);
  const [tooltipOptionType, setTooltipOptionType] = useState<'call' | 'put'>('call');
  const [pinnedCells, setPinnedCells] = useState<Array<{ expiry: string; strike: number; vol: string; x: number; y: number; id: string }>>([]);
  const [pinnedTooltipTypes, setPinnedTooltipTypes] = useState<Record<string, 'call' | 'put'>>({});
  const [expandedPinnedCell, setExpandedPinnedCell] = useState<string | null>(null);
  const [pinnedTooltipPositions, setPinnedTooltipPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingTooltip, setDraggingTooltip] = useState<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);
  const [, navigate] = useLocation();
  const { data } = trpc.platformTools.getVolSurface.useQuery({ underlying }, { refetchInterval: 30000 });

  const strikes = [80, 85, 90, 95, 100, 105, 110, 115, 120];

  const handleCellClick = (expiry: string, strike: number, vol: string) => {
    setSelectedCell({ expiry, strike, vol });
    // Navigate to OVME with pre-filled parameters (including Call/Put type)
    const params = new URLSearchParams({
      underlying,
      strike: strike.toString(),
      expiry,
      vol,
      optionType: tooltipOptionType,
    });
    navigate(`/ovme?${params.toString()}`);
  };

  // Handle tooltip dragging
  React.useEffect(() => {
    if (!draggingTooltip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - draggingTooltip.offsetX;
      const newY = e.clientY - draggingTooltip.offsetY;
      setPinnedTooltipPositions(prev => ({
        ...prev,
        [draggingTooltip.id]: { x: newX, y: newY }
      }));
    };

    const handleMouseUp = () => {
      setDraggingTooltip(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTooltip]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#8b949e]">Underlying:</span>
        {["SPX", "NDX", "RUT", "VIX"].map(u => (
          <button key={u} onClick={() => setUnderlying(u)}
            className={`px-3 py-1 text-xs rounded ${underlying === u ? "bg-blue-600 text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}>{u}</button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-[#8b949e]">
          <span>ATM Vol: <span className="text-[#e6edf3] font-mono">{fmt(data?.atmVol || 0)}%</span></span>
          <span>Skew: <span className="text-red-400 font-mono">{fmt(data?.skew || 0)}</span></span>
          <span>Kurtosis: <span className="text-[#e6edf3] font-mono">{fmt(data?.kurtosis || 0)}</span></span>
        </div>
      </div>

      {/* Vol Surface Grid */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 overflow-x-auto relative">
        <div className="mb-2 text-xs text-[#8b949e]">Implied Volatility Surface – {underlying} (% Annualized)</div>
        <table className="text-xs border-collapse min-w-full">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-[#8b949e] font-medium w-16">Expiry ↓ / Strike →</th>
              {strikes.map(s => (
                <th key={s} className="px-2 py-1 text-center text-[#8b949e] font-medium">{s}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.surface || []).map(row => (
              <tr key={row.expiry}>
                <td className="px-2 py-1 text-[#e6edf3] font-medium">{row.expiry}</td>
                {row.strikes.map(cell => {
                  const vol = parseFloat(cell.vol);
                  const isSelected = selectedCell?.expiry === row.expiry && selectedCell?.strike === cell.strike;
                  return (
                    <td key={cell.strike} className="px-1 py-0.5">
                      <div
                        className={`rounded text-center py-1 px-2 font-mono text-[11px] cursor-pointer transition-all relative ${
                          isSelected ? "ring-2 ring-white scale-105" : "hover:opacity-90 hover:scale-105"
                        }`}
                        style={{ backgroundColor: getVolColor(vol), color: "#e6edf3" }}
                        onClick={() => handleCellClick(row.expiry, cell.strike, cell.vol)}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setHoveredCell({ expiry: row.expiry, strike: cell.strike, vol: cell.vol, x: rect.left, y: rect.top });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {cell.vol}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Greeks Floating Tooltip */}
        {hoveredCell && (() => {
          const g = calcBSGreeks(hoveredCell.strike, hoveredCell.expiry, parseFloat(hoveredCell.vol), 100, tooltipOptionType);
          const isCall = tooltipOptionType === 'call';
          return (
            <div
              className="fixed z-50 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl"
              style={{ left: hoveredCell.x + 20, top: hoveredCell.y - 10, minWidth: 220, zIndex: 9999 }}
              // Allow pointer events so the toggle buttons are clickable
              onMouseEnter={() => {/* keep tooltip open */}}
            >
              {/* Header: symbol + IV + price */}
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <span className="text-[10px] font-semibold text-blue-400">
                  {underlying} {hoveredCell.strike}% · {hoveredCell.expiry} · IV {hoveredCell.vol}%
                </span>
                <span className={`text-[10px] font-mono ml-2 ${isCall ? 'text-emerald-300' : 'text-red-300'}`}>
                  {isCall ? 'C' : 'P'}≈{g.price}
                </span>
              </div>

              {/* Call / Put toggle + Pin button */}
              <div className="flex gap-1 px-3 pb-2 items-center justify-between">
                <div className="flex gap-1">
                  {(['call', 'put'] as const).map((type) => (
                    <button
                      key={type}
                      onMouseDown={(e) => { e.stopPropagation(); setTooltipOptionType(type); }}
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${
                        tooltipOptionType === type
                          ? type === 'call'
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                            : 'bg-red-500/30 text-red-300 border border-red-500/50'
                          : 'bg-[#21262d] text-[#8b949e] border border-[#30363d] hover:border-[#8b949e]'
                      }`}
                    >
                      {type === 'call' ? 'Call' : 'Put'}
                    </button>
                  ))}
                </div>
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const cellId = `${hoveredCell.expiry}-${hoveredCell.strike}`;
                    setPinnedCells([...pinnedCells, { ...hoveredCell, id: cellId }]);
                    setPinnedTooltipTypes({ ...pinnedTooltipTypes, [cellId]: tooltipOptionType });
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition-colors"
                  title="Pin this cell for comparison"
                >
                  📌
                </button>
              </div>

              <div className="px-3 pb-3">
                {/* First-order Greeks */}
                <div className="text-[9px] text-[#8b949e] mb-1 uppercase tracking-wide">1st Order</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-2">
                  {[['\u0394 Delta', g.delta, 'text-emerald-400'],
                    ['\u0393 Gamma', g.gamma, 'text-blue-400'],
                    ['\u0398 Theta', g.theta, 'text-red-400'],
                    ['\u03bd Vega', g.vega, 'text-purple-400']
                  ].map(([label, val, cls]) => (
                    <div key={label as string} className="flex justify-between gap-2">
                      <span className="text-[10px] text-[#8b949e]">{label}</span>
                      <span className={`text-[10px] font-mono font-semibold ${cls}`}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Second-order Greeks */}
                <div className="text-[9px] text-[#8b949e] mb-1 uppercase tracking-wide border-t border-[#30363d] pt-1">2nd Order</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {[['Vanna', g.vanna, 'text-cyan-400'],
                    ['Volga', g.volga, 'text-orange-400']
                  ].map(([label, val, cls]) => (
                    <div key={label as string} className="flex justify-between gap-2">
                      <span className="text-[10px] text-[#8b949e]">{label}</span>
                      <span className={`text-[10px] font-mono font-semibold ${cls}`}>{val}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-2 text-[9px] text-[#8b949e]/60 border-t border-[#30363d] pt-1">
                  BS {isCall ? 'Call' : 'Put'} Price · Click to open OVME Pricer →
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pinned Tooltips */}
        {pinnedCells.map((cell) => {
          const g = calcBSGreeks(cell.strike, cell.expiry, parseFloat(cell.vol), 100, pinnedTooltipTypes[cell.id] || 'call');
          const isCall = (pinnedTooltipTypes[cell.id] || 'call') === 'call';
          const isExpanded = expandedPinnedCell === cell.id;
          return (
            <div
              key={cell.id}
              className="fixed z-40 bg-[#161b22] border border-amber-500/50 rounded-lg shadow-xl"
              style={{ left: cell.x + 250, top: cell.y - 10, minWidth: isExpanded ? 280 : 220 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <span className="text-[10px] font-semibold text-amber-400">
                  📌 {underlying} {cell.strike}% · {cell.expiry}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setExpandedPinnedCell(isExpanded ? null : cell.id)}
                    className="text-[10px] text-[#8b949e] hover:text-blue-400 transition-colors"
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? '⌄' : '▸'}
                  </button>
                  <button
                    onClick={() => {
                      setPinnedCells(pinnedCells.filter(c => c.id !== cell.id));
                      const newTypes = { ...pinnedTooltipTypes };
                      delete newTypes[cell.id];
                      setPinnedTooltipTypes(newTypes);
                      if (expandedPinnedCell === cell.id) setExpandedPinnedCell(null);
                    }}
                    className="text-[10px] text-[#8b949e] hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="px-3 pb-3 text-[9px] text-[#8b949e]">
                IV {cell.vol}% · {isCall ? 'C' : 'P'}≈{g.price}
              </div>
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-amber-500/30 pt-2">
                  {/* First-order Greeks */}
                  <div className="text-[8px] text-[#8b949e] mb-1 uppercase tracking-wide">1st Order</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mb-2">
                    {[['Δ Delta', g.delta, 'text-emerald-400'],
                      ['Γ Gamma', g.gamma, 'text-blue-400'],
                      ['Θ Theta', g.theta, 'text-red-400'],
                      ['ν Vega', g.vega, 'text-purple-400']
                    ].map(([label, val, cls]) => (
                      <div key={label as string} className="flex justify-between gap-1">
                        <span className="text-[8px] text-[#8b949e]">{label}</span>
                        <span className={`text-[8px] font-mono font-semibold ${cls}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                  {/* Second-order Greeks */}
                  <div className="text-[8px] text-[#8b949e] mb-1 uppercase tracking-wide border-t border-amber-500/30 pt-1">2nd Order</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {[['Vanna', g.vanna, 'text-cyan-400'],
                      ['Volga', g.volga, 'text-orange-400']
                    ].map(([label, val, cls]) => (
                      <div key={label as string} className="flex justify-between gap-1">
                        <span className="text-[8px] text-[#8b949e]">{label}</span>
                        <span className={`text-[8px] font-mono font-semibold ${cls}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Color Legend + OVME hint */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8b949e]">
        <div className="flex items-center gap-2">
          <span>Vol Level:</span>
          {[["<12%", "#0d4a6e"], ["12-15%", "#0e6e9e"], ["15-18%", "#1a8fba"], ["18-21%", "#f0883e"], ["21-25%", "#d1602a"], ["25-30%", "#b44020"], [">30%", "#8b1a1a"]].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: color as string }} />
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto text-orange-400/80">
          <span className="w-2 h-2 rounded-full bg-orange-400/60" />
          Click any cell to open OVME Option Pricer with pre-filled strike &amp; expiry
        </div>
      </div>
    </div>
  );
}

// ─── Term Structure Tab ────────────────────────────────────
function TermStructureTab() {
  const [selected, setSelected] = useState<string[]>(["SPX", "NDX", "RUT"]);
  const { data } = trpc.platformTools.getTermStructure.useQuery(
    { underlyings: selected },
    { refetchInterval: 15000 }
  );

  const COLORS = { SPX: "#58a6ff", NDX: "#f0883e", RUT: "#3fb950", VIX: "#bc8cff" };

  // Build chart data
  const expiries = data?.expiries || [];
  const chartData = expiries.map((exp, i) => {
    const point: Record<string, string | number> = { expiry: exp };
    (data?.curves || []).forEach(curve => {
      point[curve.underlying] = parseFloat(curve.vols[i]?.vol?.toString() || "0");
      point[`${curve.underlying}_change`] = parseFloat(curve.vols[i]?.change?.toString() || "0");
    });
    return point;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#8b949e]">Underlyings:</span>
        {["SPX", "NDX", "RUT", "VIX"].map(u => (
          <button key={u} onClick={() => setSelected(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])}
            className={`px-3 py-1 text-xs rounded border transition-colors ${selected.includes(u) ? "border-current" : "border-[#30363d] text-[#8b949e] hover:text-white"}`}
            style={selected.includes(u) ? { color: COLORS[u as keyof typeof COLORS], borderColor: COLORS[u as keyof typeof COLORS], backgroundColor: `${COLORS[u as keyof typeof COLORS]}15` } : {}}>
            {u}
          </button>
        ))}
      </div>

      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">ATM Implied Volatility Term Structure</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="expiry" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} tickFormatter={v => `${v}%`} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
              formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name]}
            />
            <Legend />
            {selected.map(u => (
              <Line key={u} type="monotone" dataKey={u} stroke={COLORS[u as keyof typeof COLORS]} strokeWidth={2} dot={{ r: 3 }} name={u} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Change Table */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-[#21262d]">
          <span className="text-sm font-semibold text-[#e6edf3]">Daily Change by Expiry</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#21262d] text-[#8b949e]">
                <th className="px-3 py-2 text-left">Expiry</th>
                {selected.map(u => <th key={u} className="px-3 py-2 text-right">{u} Vol</th>)}
                {selected.map(u => <th key={`${u}_chg`} className="px-3 py-2 text-right">{u} Chg</th>)}
              </tr>
            </thead>
            <tbody>
              {chartData.map(row => (
                <tr key={row.expiry as string} className="border-b border-[#21262d]/50 hover:bg-[#161b22]">
                  <td className="px-3 py-2 text-[#e6edf3] font-medium">{row.expiry}</td>
                  {selected.map(u => (
                    <td key={u} className="px-3 py-2 text-right font-mono text-[#e6edf3]">{fmt(row[u] as number)}%</td>
                  ))}
                  {selected.map(u => {
                    const chg = row[`${u}_change`] as number;
                    return (
                      <td key={`${u}_chg`} className={`px-3 py-2 text-right font-mono ${chg >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {chg >= 0 ? "+" : ""}{fmt(chg)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Historical Vol Tab ────────────────────────────────────
function HistoricalVolTab() {
  const [underlying, setUnderlying] = useState("SPX");
  const [days, setDays] = useState(126);
  const { data } = trpc.platformTools.getHistoricalVol.useQuery({ underlying, days }, { refetchInterval: 60000 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-[#8b949e]">Underlying:</span>
        {["SPX", "NDX", "RUT"].map(u => (
          <button key={u} onClick={() => setUnderlying(u)}
            className={`px-3 py-1 text-xs rounded ${underlying === u ? "bg-blue-600 text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}>{u}</button>
        ))}
        <span className="text-xs text-[#8b949e] ml-4">Period:</span>
        {[63, 126, 252].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1 text-xs rounded ${days === d ? "bg-blue-600 text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}>
            {d === 63 ? "3M" : d === 126 ? "6M" : "1Y"}
          </button>
        ))}
        <div className="ml-auto flex gap-4 text-xs">
          <span>RV20: <span className="text-blue-400 font-mono">{data?.currentRv?.toFixed(1)}%</span></span>
          <span>IV30: <span className="text-orange-400 font-mono">{data?.currentIv?.toFixed(1)}%</span></span>
          <span>Vol Premium: <span className={`font-mono ${(data?.volPremium || 0) >= 0 ? "text-red-400" : "text-emerald-400"}`}>{(data?.volPremium || 0) >= 0 ? "+" : ""}{data?.volPremium?.toFixed(1)}%</span></span>
        </div>
      </div>

      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Realized vs Implied Volatility – {underlying}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data?.data || []}>
            <defs>
              <linearGradient id="ivGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f0883e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f0883e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickCount={6} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} tickFormatter={v => `${v}%`} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
              formatter={(v: number, name: string) => [`${parseFloat(v.toString()).toFixed(2)}%`, name]}
            />
            <Legend />
            <Area type="monotone" dataKey="iv30" stroke="#f0883e" fill="url(#ivGrad)" strokeWidth={2} dot={false} name="IV30" />
            <Area type="monotone" dataKey="rv20" stroke="#58a6ff" fill="url(#rvGrad)" strokeWidth={2} dot={false} name="RV20" />
            <Line type="monotone" dataKey="rv60" stroke="#3fb950" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="RV60" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Vol Premium Distribution */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Volatility Premium (IV30 – RV20)</h3>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={(data?.data || []).slice(-60)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickCount={4} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }} formatter={(v: number) => [`${parseFloat(v.toString()).toFixed(2)}%`, "Vol Premium"]} />
            <ReferenceLine y={0} stroke="#8b949e" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="volPremium" stroke="#bc8cff" fill="#bc8cff" fillOpacity={0.2} strokeWidth={1.5} dot={false} name="Vol Premium" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── VIX Ecosystem Tab ─────────────────────────────────────
function VIXEcosystemTab() {
  const { data } = trpc.platformTools.getVixEcosystem.useQuery(undefined, { refetchInterval: 15000 });

  const VIX_METRICS = [
    { key: "vix", label: "VIX", desc: "S&P 500 30-day implied vol", color: "#f0883e", threshold: { low: 15, high: 25 } },
    { key: "vvix", label: "VVIX", desc: "Vol of VIX (VIX of VIX)", color: "#bc8cff", threshold: { low: 80, high: 100 } },
    { key: "skew", label: "SKEW", desc: "Tail risk in S&P 500", color: "#58a6ff", threshold: { low: 120, high: 145 } },
    { key: "move", label: "MOVE", desc: "Treasury bond vol index", color: "#3fb950", threshold: { low: 80, high: 120 } },
  ];

  const current = data?.current || {};
  const pcts = data?.percentiles || {};

  return (
    <div className="space-y-4">
      {/* Current Levels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {VIX_METRICS.map(m => {
          const val = current[m.key as keyof typeof current] as number || 0;
          const isHigh = val > m.threshold.high;
          const isLow = val < m.threshold.low;
          const regime = isHigh ? "HIGH" : isLow ? "LOW" : "NORMAL";
          const regimeColor = isHigh ? "text-red-400 bg-red-500/10 border-red-500/20" : isLow ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20";
          return (
            <div key={m.key} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: m.color }}>{m.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${regimeColor}`}>{regime}</span>
              </div>
              <div className="text-2xl font-mono font-bold text-[#e6edf3]">{val.toFixed(1)}</div>
              <div className="text-[10px] text-[#8b949e] mt-1">{m.desc}</div>
              {/* Percentile bar */}
              {m.key === "vix" && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-[#8b949e] mb-0.5">
                    <span>P10: {(pcts as Record<string,number>).vix10?.toFixed(1)}</span>
                    <span>P90: {(pcts as Record<string,number>).vix90?.toFixed(1)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      backgroundColor: m.color,
                      width: `${Math.min(100, Math.max(0, (val - ((pcts as Record<string,number>).vix10 || 10)) / (((pcts as Record<string,number>).vix90 || 35) - ((pcts as Record<string,number>).vix10 || 10)) * 100))}%`
                    }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* VIX History Chart */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">VIX Ecosystem – 1 Year History</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={(data?.history || []).slice(-126)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickCount={6} />
            <YAxis yAxisId="vix" tick={{ fill: "#8b949e", fontSize: 11 }} domain={["auto", "auto"]} />
            <YAxis yAxisId="skew" orientation="right" tick={{ fill: "#8b949e", fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }} formatter={(v: number, name: string) => [v.toFixed(1), name]} />
            <Legend />
            <ReferenceLine yAxisId="vix" y={20} stroke="#8b949e" strokeDasharray="3 3" label={{ value: "VIX 20", fill: "#8b949e", fontSize: 10 }} />
            <Line yAxisId="vix" type="monotone" dataKey="vix" stroke="#f0883e" strokeWidth={2} dot={false} name="VIX" />
            <Line yAxisId="vix" type="monotone" dataKey="move" stroke="#3fb950" strokeWidth={1.5} dot={false} name="MOVE" />
            <Line yAxisId="skew" type="monotone" dataKey="skew" stroke="#58a6ff" strokeWidth={1.5} dot={false} name="SKEW" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Vol Cone Tab ──────────────────────────────────────────
function VolConeTab() {
  const [underlying, setUnderlying] = useState("SPX");
  const { data } = trpc.platformTools.getVolCone.useQuery({ underlying }, { refetchInterval: 60000 });

  const chartData = (data?.cone || []).map(row => ({
    window: `${row.window}D`,
    P10: parseFloat(row.p10),
    P25: parseFloat(row.p25),
    P50: parseFloat(row.p50),
    P75: parseFloat(row.p75),
    P90: parseFloat(row.p90),
    Current: parseFloat(row.current),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#8b949e]">Underlying:</span>
        {["SPX", "NDX", "RUT"].map(u => (
          <button key={u} onClick={() => setUnderlying(u)}
            className={`px-3 py-1 text-xs rounded ${underlying === u ? "bg-blue-600 text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}>{u}</button>
        ))}
        <div className="ml-auto flex gap-4 text-xs text-[#8b949e]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500" />P10-P90 Range</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400" />Current RV</span>
        </div>
      </div>

      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Realized Volatility Cone – {underlying}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barGap={0}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="window" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
            <Legend />
            <Bar dataKey="P10" fill="#1f6feb" opacity={0.3} name="P10" stackId="a" />
            <Bar dataKey="P25" fill="#1f6feb" opacity={0.4} name="P25" stackId="a" />
            <Bar dataKey="P50" fill="#1f6feb" opacity={0.5} name="Median" stackId="a" />
            <Bar dataKey="P75" fill="#1f6feb" opacity={0.4} name="P75" stackId="a" />
            <Bar dataKey="P90" fill="#1f6feb" opacity={0.3} name="P90" stackId="a" />
            <Line type="monotone" dataKey="Current" stroke="#f0883e" strokeWidth={2.5} dot={{ fill: "#f0883e", r: 4 }} name="Current RV" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Percentile Table */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#21262d] text-[#8b949e]">
              {["Window", "P10", "P25", "Median", "P75", "P90", "Current", "Percentile"].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.cone || []).map(row => {
              const curr = parseFloat(row.current);
              const p10 = parseFloat(row.p10);
              const p90 = parseFloat(row.p90);
              const pctile = Math.round((curr - p10) / (p90 - p10) * 100);
              const pctColor = pctile > 75 ? "text-red-400" : pctile < 25 ? "text-emerald-400" : "text-amber-400";
              return (
                <tr key={row.window} className="border-b border-[#21262d]/50 hover:bg-[#161b22]">
                  <td className="px-3 py-2 text-[#e6edf3] font-medium">{row.window}D</td>
                  <td className="px-3 py-2 font-mono text-[#8b949e]">{row.p10}%</td>
                  <td className="px-3 py-2 font-mono text-[#8b949e]">{row.p25}%</td>
                  <td className="px-3 py-2 font-mono text-[#e6edf3]">{row.p50}%</td>
                  <td className="px-3 py-2 font-mono text-[#8b949e]">{row.p75}%</td>
                  <td className="px-3 py-2 font-mono text-[#8b949e]">{row.p90}%</td>
                  <td className="px-3 py-2 font-mono text-orange-400 font-semibold">{row.current}%</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pctile > 75 ? "bg-red-500" : pctile < 25 ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.max(0, Math.min(100, pctile))}%` }} />
                      </div>
                      <span className={`font-mono text-[10px] ${pctColor}`}>{pctile}th</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function BVOL() {
  return (
    <div className="min-h-screen bg-[#010409] text-[#e6edf3] p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-400" />
            BVOL – Volatility Analysis Terminal
          </h1>
          <p className="text-xs text-[#8b949e] mt-0.5">Vol Surface · Term Structure · Historical RV/IV · VIX Ecosystem · Vol Cone</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-[#8b949e]">Live</span>
        </div>
      </div>

      <Tabs defaultValue="surface">
        <TabsList className="bg-[#161b22] border border-[#21262d] mb-4 flex-wrap h-auto gap-1 p-1">
          {[
            { value: "surface", label: "Vol Surface", icon: Activity },
            { value: "term", label: "Term Structure", icon: TrendingUp },
            { value: "historical", label: "Historical RV/IV", icon: TrendingDown },
            { value: "vix", label: "VIX Ecosystem", icon: Zap },
            { value: "cone", label: "Vol Cone", icon: BarChart2 },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="text-xs flex items-center gap-1 data-[state=active]:bg-orange-600">
              <Icon className="w-3 h-3" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="surface"><VolSurfaceTab /></TabsContent>
        <TabsContent value="term"><TermStructureTab /></TabsContent>
        <TabsContent value="historical"><HistoricalVolTab /></TabsContent>
        <TabsContent value="vix"><VIXEcosystemTab /></TabsContent>
        <TabsContent value="cone"><VolConeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

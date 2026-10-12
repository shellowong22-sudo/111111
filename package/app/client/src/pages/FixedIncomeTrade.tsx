import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart2, ShoppingCart, Package } from "lucide-react";
import OpenBBModuleDataBand from "@/components/OpenBBModuleDataBand";
import type { ModuleLiveFeedItem } from "@/hooks/useModuleLiveFeed";
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from "@/lib/openbbDataset";

// ─── helpers ───────────────────────────────────────────────
const fmt = (v: number | null | undefined, d = 2) => v == null ? "—" : v.toFixed(d);
const pct = (v: number | null | undefined) => v == null ? "—" : `${v >= 0 ? "+" : ""}${fmt(v)}%`;
const clr = (v: number) => v >= 0 ? "text-emerald-400" : "text-red-400";

const STATUS_COLORS: Record<string, string> = {
  FILLED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  PARTIAL: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  PENDING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CANCELLED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const RATING_COLORS: Record<string, string> = {
  AAA: "text-emerald-400", "AA+": "text-emerald-400", "AA": "text-emerald-400", "AA-": "text-emerald-400",
  "A+": "text-blue-400", "A": "text-blue-400", "A-": "text-blue-400",
  "BBB+": "text-amber-400", "BBB": "text-amber-400", "BBB-": "text-amber-400",
};

// ─── FIT Tab ───────────────────────────────────────────────
function FITTab() {
  const urlCode = new URLSearchParams(window.location.search).get('code');
  const [sector, setSector] = useState<string>("all");
  const [currency, setCurrency] = useState<string>("all");
  const [country, setCountry] = useState<string>("US");
  const [highlightTicker, setHighlightTicker] = useState<string | null>(urlCode);
  const { data: universe } = trpc.fixedIncomeTrade.getBondUniverse.useQuery(
    { sector: sector !== "all" ? sector : undefined, currency: currency !== "all" ? currency : undefined },
    { refetchInterval: 10000 }
  );
  const { data: curve } = trpc.fixedIncomeTrade.getYieldCurve.useQuery({ country }, { refetchInterval: 15000 });

  return (
    <div className="space-y-4">
      {/* Yield Curve */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#e6edf3]">Yield Curve – {country}</h3>
          <div className="flex gap-2">
            {["US", "DE", "JP", "GB"].map(c => (
              <button key={c} onClick={() => setCountry(c)}
                className={`px-2 py-0.5 text-xs rounded ${country === c ? "bg-blue-600 text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}>{c}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={curve?.curve || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="label" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }} formatter={(v: number) => [`${fmt(v)}%`, "Yield"]} />
            <Line type="monotone" dataKey="yield" stroke="#58a6ff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="w-36 h-7 text-xs bg-[#161b22] border-[#30363d]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "Government", "Financial", "Technology", "Energy", "Healthcare"].map(s => (
              <SelectItem key={s} value={s}>{s === "all" ? "All Sectors" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-24 h-7 text-xs bg-[#161b22] border-[#30363d]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "USD", "EUR", "GBP", "JPY"].map(c => (
              <SelectItem key={c} value={c}>{c === "all" ? "All CCY" : c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-[#8b949e]">{universe?.bonds?.length || 0} bonds</span>
      </div>

      {/* Bond Universe Table */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#21262d] text-[#8b949e]">
                {["Ticker", "Issuer", "Coupon", "Maturity", "YTM", "Price", "Dur", "DV01", "Rating", "Bid", "Ask", "Spread", "CCY"].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(universe?.bonds || []).map((b, i) => {
                const isHighlighted = highlightTicker && (b.ticker.includes(highlightTicker) || b.issuer.toLowerCase().includes(highlightTicker.toLowerCase()));
                return (
                <tr key={b.isin}
                  onClick={() => setHighlightTicker(isHighlighted ? null : b.ticker)}
                  className={`border-b border-[#21262d]/50 hover:bg-[#161b22] cursor-pointer transition-colors ${
                    isHighlighted ? "bg-blue-900/30 border-l-2 border-l-blue-500" : i % 2 === 0 ? "" : "bg-[#0d1117]/50"
                  }`}>
                  <td className="px-3 py-2 text-blue-400 font-mono">{b.ticker}</td>
                  <td className="px-3 py-2 text-[#e6edf3]">{b.issuer}</td>
                  <td className="px-3 py-2 text-[#e6edf3]">{fmt(b.coupon)}%</td>
                  <td className="px-3 py-2 text-[#8b949e]">{b.maturity}</td>
                  <td className={`px-3 py-2 font-mono ${clr(b.ytm - 3)}`}>{fmt(b.ytm)}%</td>
                  <td className="px-3 py-2 font-mono text-[#e6edf3]">{fmt(b.price)}</td>
                  <td className="px-3 py-2 text-[#8b949e]">{fmt(b.duration, 1)}</td>
                  <td className="px-3 py-2 text-[#8b949e]">{fmt(b.dv01, 1)}</td>
                  <td className={`px-3 py-2 font-semibold ${RATING_COLORS[b.rating] || "text-[#8b949e]"}`}>{b.rating}</td>
                  <td className="px-3 py-2 font-mono text-emerald-400">{fmt(b.bid)}</td>
                  <td className="px-3 py-2 font-mono text-red-400">{fmt(b.ask)}</td>
                  <td className="px-3 py-2 text-[#8b949e]">{b.spread}</td>
                  <td className="px-3 py-2 text-[#8b949e]">{b.currency}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── FITG Tab ──────────────────────────────────────────────
function FITGTab({ items }: { items: ModuleLiveFeedItem[] }) {
  const { data: grid } = trpc.fixedIncomeTrade.getTradingGrid.useQuery(undefined, { refetchInterval: 15000 });
  const observed = collectOpenBBDatasetRows(items).map(row => ({
    sector: readDatasetText(row.values, ['sector', 'industry', 'issuer_sector'], ''),
    yieldValue: readDatasetNumber(row.values, ['yield', 'yield_rate', 'ytm', 'rate']),
    change: readDatasetNumber(row.values, ['change', 'change_value', 'daily_change']),
  })).filter(row => row.sector);
  const getColor = (yld: number) => {
    if (yld < 3) return "bg-blue-900/60 text-blue-300";
    if (yld < 4) return "bg-blue-700/60 text-blue-200";
    if (yld < 5) return "bg-emerald-800/60 text-emerald-300";
    if (yld < 6) return "bg-amber-800/60 text-amber-300";
    return "bg-red-900/60 text-red-300";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-[#8b949e]">
        <span>Yield Level:</span>
        {[["<3%", "bg-blue-900/60"], ["3-4%", "bg-blue-700/60"], ["4-5%", "bg-emerald-800/60"], ["5-6%", "bg-amber-800/60"], [">6%", "bg-red-900/60"]].map(([label, cls]) => (
          <span key={label} className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${cls}`} />{label}</span>
        ))}
      </div>
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#21262d]">
                <th className="px-3 py-2 text-left text-[#8b949e] font-medium w-32">Sector</th>
                {(grid?.maturities || []).map(m => (
                  <th key={m} className="px-2 py-2 text-center text-[#8b949e] font-medium">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(grid?.grid || []).map(row => (
                <tr key={row.sector} className="border-b border-[#21262d]/50">
                  <td className="px-3 py-2 text-[#e6edf3] font-medium">{row.sector}</td>
                  {row.yields.map(cell => (
                    <td key={cell.maturity} className="px-1 py-1">
                      <div className={`rounded px-2 py-1.5 text-center hover:opacity-80 transition-opacity ${getColor(parseFloat(cell.yield))}`}>
                        <div className="font-mono font-semibold">{cell.yield}%</div>
                        <div className={`text-[10px] ${parseFloat(cell.change) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {parseFloat(cell.change) >= 0 ? "+" : ""}{cell.change}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {["Government", "Financial", "Technology", "Energy"].map(s => {
          const row = observed.find(item => item.sector.toLocaleLowerCase().includes(s.toLocaleLowerCase()));
          return (
          <div key={s} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3">
            <div className="text-xs text-[#8b949e] mb-1">{s} 10Y</div>
            <div className="text-lg font-mono text-[#e6edf3]">{formatDatasetNumber(row?.yieldValue ?? null)}%</div>
            <div className={`text-xs ${(row?.change ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatDatasetNumber(row?.change ?? null, 3)}</div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BOLT Tab ──────────────────────────────────────────────
function BOLTTab() {
  const [selectedBond, setSelectedBond] = useState("US912828YV68");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState(5000);
  const [rfqActive, setRfqActive] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const { data: quotes, refetch } = trpc.fixedIncomeTrade.getBoltQuotes.useQuery(
    { isin: selectedBond, side, qty },
    { refetchInterval: rfqActive ? 5000 : false }
  );
  const submitTrade = trpc.fixedIncomeTrade.submitTrade.useMutation();

  const handleRFQ = () => {
    setRfqActive(true);
    setCountdown(30);
    refetch();
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); setRfqActive(false); return 30; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTrade = useCallback((dealer: string, price: number) => {
    submitTrade.mutate({ isin: selectedBond, side, qty, price, orderType: "LIMIT", dealer });
  }, [selectedBond, side, qty, submitTrade]);

  return (
    <div className="space-y-4">
      {/* RFQ Controls */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="text-xs text-[#8b949e] mb-1 block">Bond</label>
            <Select value={selectedBond} onValueChange={setSelectedBond}>
              <SelectTrigger className="h-8 text-xs bg-[#161b22] border-[#30363d]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="US912828YV68">T 2.875 05/15/32</SelectItem>
                <SelectItem value="US38141GXZ20">GS 4.25 10/21/29</SelectItem>
                <SelectItem value="US459200JZ71">IBM 3.625 02/12/31</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-[#8b949e] mb-1 block">Side</label>
            <div className="flex">
              <button onClick={() => setSide("BUY")} className={`px-4 py-1.5 text-xs rounded-l ${side === "BUY" ? "bg-emerald-600 text-white" : "bg-[#21262d] text-[#8b949e]"}`}>BUY</button>
              <button onClick={() => setSide("SELL")} className={`px-4 py-1.5 text-xs rounded-r ${side === "SELL" ? "bg-red-600 text-white" : "bg-[#21262d] text-[#8b949e]"}`}>SELL</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#8b949e] mb-1 block">Qty (000s)</label>
            <Input type="number" value={qty} onChange={e => setQty(Number(e.target.value))}
              className="w-24 h-8 text-xs bg-[#161b22] border-[#30363d]" />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleRFQ} disabled={rfqActive}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
              {rfqActive ? `RFQ Active (${countdown}s)` : "Send RFQ"}
            </Button>
          </div>
          {rfqActive && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                  style={{ width: `${(countdown / 30) * 100}%` }} />
              </div>
              <span className="text-xs text-blue-400">{countdown}s</span>
            </div>
          )}
        </div>
      </div>

      {/* Quote Comparison */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-[#21262d] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#e6edf3]">Dealer Quotes</span>
          <div className="flex gap-4 text-xs text-[#8b949e]">
            <span>Best Bid: <span className="text-emerald-400 font-mono">{fmt(quotes?.bestBid)}</span></span>
            <span>Best Ask: <span className="text-red-400 font-mono">{fmt(quotes?.bestAsk)}</span></span>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#21262d] text-[#8b949e]">
              <th className="px-4 py-2 text-left">Dealer</th>
              <th className="px-4 py-2 text-right">Bid</th>
              <th className="px-4 py-2 text-right">Bid Size</th>
              <th className="px-4 py-2 text-right">Ask</th>
              <th className="px-4 py-2 text-right">Ask Size</th>
              <th className="px-4 py-2 text-right">Score</th>
              <th className="px-4 py-2 text-right">Time</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {(quotes?.quotes || []).map((q, i) => (
              <tr key={q.dealer} className={`border-b border-[#21262d]/50 hover:bg-[#161b22] ${i === 0 ? "bg-emerald-950/20" : ""}`}>
                <td className="px-4 py-2 text-[#e6edf3] font-medium">
                  {i === 0 && <span className="text-[10px] bg-emerald-600 text-white px-1 rounded mr-1">BEST</span>}
                  {q.dealer}
                </td>
                <td className="px-4 py-2 text-right font-mono text-emerald-400">{fmt(q.bid)}</td>
                <td className="px-4 py-2 text-right text-[#8b949e]">{q.bidSize.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono text-red-400">{fmt(q.ask)}</td>
                <td className="px-4 py-2 text-right text-[#8b949e]">{q.askSize.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className="w-12 h-1 bg-[#21262d] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${q.score}%` }} />
                    </div>
                    <span className="text-[#8b949e]">{q.score}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-[#8b949e] font-mono">{q.time}</td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => handleTrade(q.dealer, side === "BUY" ? q.ask : q.bid)}
                    className={`px-3 py-1 text-[10px] rounded font-medium ${side === "BUY" ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40" : "bg-red-600/20 text-red-400 hover:bg-red-600/40"}`}>
                    {side === "BUY" ? "BUY" : "SELL"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── BLOT Tab ──────────────────────────────────────────────
function BLOTTab() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sideFilter, setSideFilter] = useState("ALL");
  const { data: blotter } = trpc.fixedIncomeTrade.getBlotter.useQuery(
    { status: statusFilter, side: sideFilter },
    { refetchInterval: 5000 }
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Trades", value: blotter?.stats?.total || 0, icon: Activity, color: "text-blue-400" },
          { label: "Fill Rate", value: `${blotter?.stats?.fillRate || 0}%`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Pending", value: blotter?.stats?.pending || 0, icon: BarChart2, color: "text-amber-400" },
          { label: "Total P&L", value: `$${(blotter?.stats?.totalPnl || 0).toLocaleString()}`, icon: DollarSign, color: (blotter?.stats?.totalPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${color}`} />
            <div>
              <div className="text-xs text-[#8b949e]">{label}</div>
              <div className={`text-lg font-mono font-semibold ${color}`}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["ALL", "FILLED", "PARTIAL", "PENDING"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded ${statusFilter === s ? "bg-blue-600 text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}>{s}</button>
        ))}
        <div className="w-px bg-[#21262d]" />
        {["ALL", "BUY", "SELL"].map(s => (
          <button key={s} onClick={() => setSideFilter(s)}
            className={`px-3 py-1 text-xs rounded ${sideFilter === s ? "bg-blue-600 text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}>{s}</button>
        ))}
      </div>

      {/* Blotter Table */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#21262d] text-[#8b949e]">
              {["ID", "Time", "Ticker", "Side", "Qty", "Price", "YTM", "Counterparty", "Venue", "Status", "P&L", "Settle", "Trader"].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(blotter?.trades || []).map(t => (
              <tr key={t.id} className="border-b border-[#21262d]/50 hover:bg-[#161b22]">
                <td className="px-3 py-2 font-mono text-[#8b949e]">{t.id}</td>
                <td className="px-3 py-2 font-mono text-[#8b949e]">{t.time}</td>
                <td className="px-3 py-2 text-blue-400">{t.ticker}</td>
                <td className={`px-3 py-2 font-semibold ${t.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{t.side}</td>
                <td className="px-3 py-2 text-[#e6edf3]">{t.qty.toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-[#e6edf3]">{fmt(t.price)}</td>
                <td className="px-3 py-2 font-mono text-[#8b949e]">{fmt(t.ytm)}%</td>
                <td className="px-3 py-2 text-[#e6edf3]">{t.counterparty}</td>
                <td className="px-3 py-2 text-[#8b949e]">{t.venue}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${STATUS_COLORS[t.status] || ""}`}>{t.status}</span>
                </td>
                <td className={`px-3 py-2 font-mono ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {t.pnl !== 0 ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toLocaleString()}` : "–"}
                </td>
                <td className="px-3 py-2 text-[#8b949e]">{t.settlementDate}</td>
                <td className="px-3 py-2 text-[#8b949e]">{t.trader}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TSOX Tab ──────────────────────────────────────────────
function TSOXTab() {
  const { data: analysis } = trpc.fixedIncomeTrade.getExecutionAnalysis.useQuery(undefined, { refetchInterval: 30000 });

  return (
    <div className="space-y-4">
      {/* Execution Quality KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "VWAP", value: fmt(analysis?.vwap), sub: "Volume-Weighted Avg" },
          { label: "TWAP", value: fmt(analysis?.twap), sub: "Time-Weighted Avg" },
          { label: "Arrival Price", value: fmt(analysis?.arrivalPrice), sub: "Decision Price" },
          { label: "Impl. Shortfall", value: analysis?.implementationShortfall == null ? "—" : `${analysis.implementationShortfall >= 0 ? "+" : ""}${fmt(analysis.implementationShortfall, 3)}`, sub: "vs Arrival", color: (analysis?.implementationShortfall ?? 0) >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Fill Rate", value: analysis?.fillRate == null ? "—" : `${fmt(analysis.fillRate)}%`, sub: "Execution Rate" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3">
            <div className="text-xs text-[#8b949e] mb-1">{label}</div>
            <div className={`text-xl font-mono font-semibold ${color || "text-[#e6edf3]"}`}>{value}</div>
            <div className="text-[10px] text-[#8b949e]">{sub}</div>
          </div>
        ))}
      </div>

      {/* Hourly Volume & VWAP */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Intraday Execution Profile</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={analysis?.hourlyVolume || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="hour" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis yAxisId="vol" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis yAxisId="price" orientation="right" tick={{ fill: "#8b949e", fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }} />
            <Bar yAxisId="vol" dataKey="volume" fill="#1f6feb" opacity={0.7} name="Volume" />
            <Line yAxisId="price" type="monotone" dataKey="vwap" stroke="#f0883e" strokeWidth={2} dot={false} name="VWAP" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Venue Breakdown */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-[#21262d]">
          <span className="text-sm font-semibold text-[#e6edf3]">Venue Performance</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#21262d] text-[#8b949e]">
              {["Venue", "Volume", "Avg Price", "Fill Rate", "Avg Latency (ms)"].map(h => (
                <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(analysis?.venueBreakdown || []).map(v => (
              <tr key={v.venue} className="border-b border-[#21262d]/50 hover:bg-[#161b22]">
                <td className="px-4 py-2 text-[#e6edf3]">{v.venue}</td>
                <td className="px-4 py-2 font-mono text-[#8b949e]">{v.volume.toLocaleString()}</td>
                <td className="px-4 py-2 font-mono text-[#e6edf3]">{fmt(v.avgPrice)}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-[#21262d] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${v.fillRate}%` }} />
                    </div>
                    <span className="text-emerald-400">{v.fillRate}%</span>
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-[#8b949e]">{v.avgLatency}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PTBB Tab ──────────────────────────────────────────────
function PTBBTab() {
  const { data: basket } = trpc.fixedIncomeTrade.getBasket.useQuery(undefined, { refetchInterval: 10000 });

  return (
    <div className="space-y-4">
      {/* Basket Header */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#e6edf3]">{basket?.name || "Portfolio Trading Basket"}</h3>
            <div className="text-xs text-[#8b949e]">ID: {basket?.basketId} · Created: {basket?.created}</div>
          </div>
          <span className={`px-2 py-1 text-xs rounded border ${STATUS_COLORS[basket?.status || "PENDING"]}`}>{basket?.status}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-[#8b949e]">Total DV01 Impact</div>
            <div className={`text-xl font-mono font-semibold ${(basket?.totalDv01Impact || 0) < 0 ? "text-emerald-400" : "text-red-400"}`}>
              {(basket?.totalDv01Impact || 0) > 0 ? "+" : ""}{basket?.totalDv01Impact?.toFixed(1) || "0"}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8b949e]">Estimated Cost</div>
            <div className="text-xl font-mono font-semibold text-[#e6edf3]">${(basket?.estimatedCost || 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-[#8b949e]">Items</div>
            <div className="text-xl font-mono font-semibold text-[#e6edf3]">{basket?.items?.length || 0}</div>
          </div>
        </div>
      </div>

      {/* Basket Items */}
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#21262d] text-[#8b949e]">
              {["Ticker", "Side", "Target Qty", "Filled Qty", "Fill %", "Avg Fill", "DV01 Impact", "Status"].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(basket?.items || []).map(item => {
              const fillPct = item.targetQty > 0 ? (item.filledQty / item.targetQty * 100) : 0;
              return (
                <tr key={item.isin} className="border-b border-[#21262d]/50 hover:bg-[#161b22]">
                  <td className="px-3 py-2 text-blue-400">{item.ticker}</td>
                  <td className={`px-3 py-2 font-semibold ${item.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{item.side}</td>
                  <td className="px-3 py-2 text-[#e6edf3]">{item.targetQty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-[#e6edf3]">{item.filledQty.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-[#21262d] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${fillPct}%` }} />
                      </div>
                      <span className="text-[#8b949e]">{fillPct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[#e6edf3]">{fmt(item.avgFillPrice)}</td>
                  <td className={`px-3 py-2 font-mono ${parseFloat(item.dv01Impact) < 0 ? "text-emerald-400" : "text-red-400"}`}>{item.dv01Impact}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${STATUS_COLORS[item.status]}`}>{item.status}</span>
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

// ─── IMGR Tab ──────────────────────────────────────────────
function IMGRTab() {
  const { data: inventory } = trpc.fixedIncomeTrade.getInventory.useQuery(undefined, { refetchInterval: 15000 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total DV01", value: inventory?.totalDv01 == null ? "—" : `$${inventory.totalDv01.toFixed(1)}`, color: "text-blue-400" },
          { label: "Total P&L", value: inventory?.totalPnl == null ? "—" : `$${inventory.totalPnl.toLocaleString()}`, color: (inventory?.totalPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Positions", value: inventory?.positions?.length || 0, color: "text-[#e6edf3]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3">
            <div className="text-xs text-[#8b949e]">{label}</div>
            <div className={`text-xl font-mono font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#21262d] text-[#8b949e]">
              {["Ticker", "Position", "Avg Cost", "Current Price", "P&L", "DV01", "Duration", "Rating"].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(inventory?.positions || []).map(p => (
              <tr key={p.isin} className="border-b border-[#21262d]/50 hover:bg-[#161b22]">
                <td className="px-3 py-2 text-blue-400">{p.ticker}</td>
                <td className={`px-3 py-2 font-mono ${p.position >= 0 ? "text-emerald-400" : "text-red-400"}`}>{p.position.toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-[#8b949e]">{fmt(p.avgCost)}</td>
                <td className="px-3 py-2 font-mono text-[#e6edf3]">{fmt(p.currentPrice)}</td>
                <td className={`px-3 py-2 font-mono ${p.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(0)}
                </td>
                <td className="px-3 py-2 text-[#8b949e]">{fmt(p.dv01, 1)}</td>
                <td className="px-3 py-2 text-[#8b949e]">{fmt(p.duration, 1)}</td>
                <td className={`px-3 py-2 font-semibold ${RATING_COLORS[p.rating] || "text-[#8b949e]"}`}>{p.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function FixedIncomeTrade() {
  return <OpenBBModuleDataBand path="/fixed-income-trade" title="固定收益交易数据">{delivery => <FixedIncomeTradeWorkspace {...delivery} />}</OpenBBModuleDataBand>;
}

function FixedIncomeTradeWorkspace({ items, connection, receivedAt }: { items: ModuleLiveFeedItem[]; connection: 'connecting' | 'live' | 'fallback'; receivedAt: string | null }) {
  const status = connection === 'live' ? '实时连接' : connection === 'connecting' ? '正在连接' : '轮询补收';
  return (
    <div className="min-h-screen bg-[#010409] text-[#e6edf3] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#e6edf3] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Fixed Income Trading Terminal
          </h1>
          <p className="text-xs text-[#8b949e] mt-0.5">FIT · FITG · BOLT · BLOT · TSOX · PTBB · IMGR</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connection === 'live' ? 'bg-emerald-400' : connection === 'connecting' ? 'bg-amber-400' : 'bg-rose-400'}`} />
          <span className="text-xs text-[#8b949e]">{status} · {receivedAt ? new Date(receivedAt).toLocaleString() : '未接收'}</span>
        </div>
      </div>

      <Tabs defaultValue="fit">
        <TabsList className="bg-[#161b22] border border-[#21262d] mb-4 flex-wrap h-auto gap-1 p-1">
          {[
            { value: "fit", label: "FIT Bond Universe", icon: BarChart2 },
            { value: "fitg", label: "FITG Trading Grid", icon: Activity },
            { value: "bolt", label: "BOLT Multi-Dealer", icon: ShoppingCart },
            { value: "blot", label: "BLOT E-Blotter", icon: Activity },
            { value: "tsox", label: "TSOX Execution", icon: TrendingUp },
            { value: "ptbb", label: "PTBB Portfolio Basket", icon: Package },
            { value: "imgr", label: "IMGR Inventory", icon: DollarSign },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="text-xs flex items-center gap-1 data-[state=active]:bg-blue-600">
              <Icon className="w-3 h-3" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="fit"><FITTab /></TabsContent>
        <TabsContent value="fitg"><FITGTab items={items} /></TabsContent>
        <TabsContent value="bolt"><BOLTTab /></TabsContent>
        <TabsContent value="blot"><BLOTTab /></TabsContent>
        <TabsContent value="tsox"><TSOXTab /></TabsContent>
        <TabsContent value="ptbb"><PTBBTab /></TabsContent>
        <TabsContent value="imgr"><IMGRTab /></TabsContent>
      </Tabs>
    </div>
  );
}

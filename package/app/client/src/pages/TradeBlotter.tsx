import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, TrendingDown, BarChart3, Activity, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart,
  Scatter, ReferenceLine, Legend, AreaChart, Area
} from "recharts";

function fmt(n: number | null | undefined, d = 2) {
  return typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";
}
function fmtM(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${(abs / 1e3).toFixed(1)}K`;
}

// ─── TBGS Tab ──────────────────────────────────────────────────────────────

function TBGSTab() {
  const { data, refetch } = trpc.tradeBlotter.getTBGSStats.useQuery();

  if (!data) return <div className="flex items-center justify-center h-40 text-slate-400">加载中...</div>;
  if (!data.available) {
    return (
      <Card className="bg-slate-800/60 border-amber-500/30">
        <CardContent className="p-5 text-sm text-amber-200">
          <div className="font-semibold mb-2">TBGS 需要私有执行数据源</div>
          <div className="text-slate-400">{data.limitation}</div>
        </CardContent>
      </Card>
    );
  }

  const { summary, venueBreakdown, assetBreakdown, hourlyActivity } = data;
  const marketMakingStats = data.marketMakingStats ?? {
    quotedPairs: null,
    avgBidAskSpread: null,
    inventoryTurnover: null,
    hedgeRatio: null,
    pnlToday: null,
  };

  const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "总成交量", value: fmtM(summary.totalVolume), color: "text-blue-400" },
          { label: "总成交笔数", value: fmt(summary.totalTrades, 0), color: "text-white" },
          { label: "平均成交规模", value: fmtM(summary.avgTradeSize), color: "text-purple-400" },
          { label: "成交率", value: `${fmt(summary.fillRate)}%`, color: "text-green-400" },
          { label: "平均延迟", value: `${fmt(summary.avgLatency)}ms`, color: "text-yellow-400" },
          { label: "市场份额", value: `${fmt(summary.marketShare)}%`, color: "text-orange-400" },
        ].map((c, i) => (
          <Card key={i} className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400 mb-1">{c.label}</div>
              <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hourly Activity */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm text-slate-300">日内成交量分布（按小时）</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-6 text-xs border-slate-600 text-slate-300">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </CardHeader>
        <CardContent className="p-2">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourlyActivity}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => `$${(v / 1e6).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                formatter={(v: number) => [fmtM(v), "成交量"]}
              />
              <Area type="monotone" dataKey="volume" stroke="#3b82f6" fill="url(#volGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Venue Breakdown */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300">各交易所成交分布</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={venueBreakdown} cx="50%" cy="50%" outerRadius={75} dataKey="volume"
                  nameKey="venue" label={({ venue, percent }) => `${venue} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {venueBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                  formatter={(v: number) => [fmtM(v), "成交量"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Asset Class Breakdown */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300">各资产类别 P&L</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={assetBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => fmtM(v)} />
                <YAxis dataKey="assetClass" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={80} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                  formatter={(v: number) => [fmtM(v), "P&L"]} />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}
                  fill="#22c55e"
                  label={{ position: "right", fill: "#94a3b8", fontSize: 9, formatter: (v: number) => fmtM(v) }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Market Making Stats */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm text-slate-300">做市商活动统计</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "报价对数", value: fmt(marketMakingStats.quotedPairs, 0), color: "text-white" },
              { label: "平均买卖价差", value: `${fmt(marketMakingStats.avgBidAskSpread, 3)}%`, color: "text-yellow-400" },
              { label: "库存周转率", value: `${fmt(marketMakingStats.inventoryTurnover)}x`, color: "text-blue-400" },
              { label: "对冲比率", value: `${fmt(typeof marketMakingStats.hedgeRatio === "number" ? marketMakingStats.hedgeRatio * 100 : null)}%`, color: "text-green-400" },
              { label: "今日P&L", value: fmtM(marketMakingStats.pnlToday), color: "text-green-400" },
            ].map((c, i) => (
              <div key={i} className="text-center">
                <div className="text-xs text-slate-400 mb-1">{c.label}</div>
                <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Venue Detail Table */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm text-slate-300">各交易所详细数据</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["交易所", "成交量", "成交笔数", "成交率", "平均价差", "市场份额"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {venueBreakdown.map((v, i) => (
                  <tr key={v.venue} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-white font-semibold">{v.venue}</td>
                    <td className="px-3 py-1.5 text-blue-400">{fmtM(v.volume)}</td>
                    <td className="px-3 py-1.5 text-slate-300">{v.trades.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-green-400">{fmt(v.fillRate)}%</td>
                    <td className="px-3 py-1.5 text-yellow-400">{fmt(v.avgSpread, 3)}%</td>
                    <td className="px-3 py-1.5 text-slate-300">{fmt(v.marketShare)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── BTFI Tab ──────────────────────────────────────────────────────────────

function BTFITab() {
  const [activeView, setActiveView] = useState<"positions" | "calendar" | "basis">("positions");
  const { data: posData } = trpc.tradeBlotter.getFuturesPositions.useQuery();
  const { data: calendarData } = trpc.tradeBlotter.getRollCalendar.useQuery();
  const { data: basisData } = trpc.tradeBlotter.getBasisAnalysis.useQuery();

  const positions = posData?.positions ?? [];
  const summary = posData?.summary;
  const calendar = calendarData?.data ?? [];
  const basis = basisData?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "多头名义", value: fmtM(summary?.totalLong ?? 0), color: "text-green-400" },
          { label: "空头名义", value: fmtM(summary?.totalShort ?? 0), color: "text-red-400" },
          { label: "未实现P&L", value: fmtM(summary?.totalUnrealizedPnl ?? 0), color: (summary?.totalUnrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400" },
          { label: "已实现P&L", value: fmtM(summary?.totalRealizedPnl ?? 0), color: (summary?.totalRealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400" },
          { label: "总保证金", value: fmtM(summary?.totalMargin ?? 0), color: "text-yellow-400" },
          { label: "净Delta", value: fmt(summary?.netDelta ?? 0, 0), color: "text-blue-400" },
        ].map((c, i) => (
          <Card key={i} className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400 mb-1">{c.label}</div>
              <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        {[
          { key: "positions" as const, label: "持仓明细" },
          { key: "calendar" as const, label: "展期日历" },
          { key: "basis" as const, label: "基差分析" },
        ].map(v => (
          <Button
            key={v.key}
            size="sm"
            variant={activeView === v.key ? "default" : "outline"}
            className={`text-xs h-7 ${activeView === v.key ? "bg-blue-600 hover:bg-blue-700" : "border-slate-600 text-slate-300"}`}
            onClick={() => setActiveView(v.key)}
          >
            {v.label}
          </Button>
        ))}
      </div>

      {activeView === "positions" && (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800/80">
                {["合约", "名称", "交易所", "到期月", "剩余天数", "当前价格", "均成本", "持仓", "名义价值", "未实现P&L", "已实现P&L", "保证金", "展期日"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={p.symbol} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                  <td className="px-3 py-1.5 text-white font-bold">{p.symbol}</td>
                  <td className="px-3 py-1.5 text-slate-300">{p.name}</td>
                  <td className="px-3 py-1.5 text-slate-400">{p.exchange}</td>
                  <td className="px-3 py-1.5 text-purple-400">{p.expiryMonth}</td>
                  <td className={`px-3 py-1.5 font-medium ${(p.daysToExpiry ?? 0) < 15 ? "text-red-400" : (p.daysToExpiry ?? 0) < 30 ? "text-yellow-400" : "text-slate-300"}`}>
                    {p.daysToExpiry == null ? "—" : `${p.daysToExpiry}天`}
                  </td>
                  <td className="px-3 py-1.5 text-slate-300">{fmt(p.currentPrice)}</td>
                  <td className="px-3 py-1.5 text-slate-400">{fmt(p.avgCost)}</td>
                  <td className={`px-3 py-1.5 font-semibold ${(p.position ?? 0) > 0 ? "text-green-400" : (p.position ?? 0) < 0 ? "text-red-400" : "text-slate-400"}`}>
                    {p.position == null ? "—" : p.position > 0 ? `+${p.position}` : p.position}
                  </td>
                  <td className="px-3 py-1.5 text-slate-300">{fmtM(p.notional)}</td>
                  <td className={`px-3 py-1.5 font-semibold ${(p.unrealizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmtM(p.unrealizedPnl)}
                  </td>
                  <td className={`px-3 py-1.5 ${(p.realizedPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmtM(p.realizedPnl)}
                  </td>
                  <td className="px-3 py-1.5 text-yellow-400">{fmtM(p.margin)}</td>
                    <td className="px-3 py-1.5 text-slate-400">{p.rollDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeView === "calendar" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-slate-300">展期紧迫程度</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={calendar ?? []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis dataKey="symbol" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={35} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }} />
                    <Bar dataKey="daysToExpiry" name="到期天数" radius={[0, 4, 4, 0]}
                      fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-slate-300">持仓量比率（当月/次月）</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={calendar ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="symbol" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                      formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "持仓量比率"]} />
                    <Bar dataKey="openInterestRatio" name="持仓量比率" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["合约", "当前合约", "下一合约", "到期日", "展期日", "剩余天数", "展期成本", "持仓量比率", "紧迫程度"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(calendar ?? []).map((c, i) => (
                  <tr key={c.symbol} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-white font-bold">{c.symbol}</td>
                    <td className="px-3 py-1.5 text-slate-300">{c.currentContract}</td>
                    <td className="px-3 py-1.5 text-blue-400">{c.nextContract}</td>
                    <td className="px-3 py-1.5 text-slate-400">{c.expiryDate}</td>
                    <td className="px-3 py-1.5 text-yellow-400">{c.rollDate}</td>
                    <td className={`px-3 py-1.5 font-semibold ${c.daysToExpiry < 10 ? "text-red-400" : c.daysToExpiry < 20 ? "text-yellow-400" : "text-green-400"}`}>
                      {c.daysToExpiry}天
                    </td>
                    <td className={`px-3 py-1.5 ${c.rollCost > 0 ? "text-red-400" : "text-green-400"}`}>
                      {c.rollCost > 0 ? "+" : ""}{(c.rollCost * 100).toFixed(3)}%
                    </td>
                    <td className="px-3 py-1.5 text-slate-300">{(c.openInterestRatio * 100).toFixed(1)}%</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.urgency === "High" ? "text-red-400 bg-red-500/10" : c.urgency === "Medium" ? "text-yellow-400 bg-yellow-500/10" : "text-green-400 bg-green-500/10"}`}>
                        {c.urgency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === "basis" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["期货合约", "现货标的", "基差", "日变化", "周变化", "理论基差", "富贵/廉价", "持有成本收益率", "便利收益率"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(basis ?? []).map((b, i) => (
                  <tr key={b.future} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-white font-semibold">{b.future}</td>
                    <td className="px-3 py-1.5 text-slate-300">{b.spot}</td>
                    <td className={`px-3 py-1.5 font-semibold ${b.basis > 0 ? "text-green-400" : "text-red-400"}`}>
                      {b.basis > 0 ? "+" : ""}{fmt(b.basis, 3)}
                    </td>
                    <td className={`px-3 py-1.5 ${b.basisChange1D > 0 ? "text-green-400" : "text-red-400"}`}>
                      {b.basisChange1D > 0 ? "+" : ""}{fmt(b.basisChange1D, 3)}
                    </td>
                    <td className={`px-3 py-1.5 ${(b.basisChange1W ?? 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                      {b.basisChange1W == null ? "—" : `${b.basisChange1W > 0 ? "+" : ""}${fmt(b.basisChange1W, 3)}`}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">{fmt(b.theoreticalBasis, 3)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs ${b.richCheap === "Rich" ? "text-red-400 bg-red-500/10" : "text-green-400 bg-green-500/10"}`}>
                        {b.richCheap}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-blue-400">{fmt(b.carryYield)}%</td>
                    <td className="px-3 py-1.5 text-purple-400">{fmt(b.convenienceYield)}%</td>
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

// ─── TBMI Tab ──────────────────────────────────────────────────────────────

function TBMITab() {
  const [bookFilter, setBookFilter] = useState("All");
  const [activeView, setActiveView] = useState<"books" | "trades" | "pnl" | "risk">("books");
  const { data: bookData } = trpc.tradeBlotter.getTradeBookSummary.useQuery();
  const { data: tradeData } = trpc.tradeBlotter.getTradeHistory.useQuery({ book: bookFilter });
  const { data: pnl } = trpc.tradeBlotter.getPnLAttribution.useQuery({});
  const { data: riskData } = trpc.tradeBlotter.getRiskExposure.useQuery();

  const books = bookData?.books ?? [];
  const aggregate = bookData?.aggregate;
  const trades = tradeData?.trades ?? [];
  const risk = riskData?.data ?? [];

  const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

  return (
    <div className="space-y-4">
      {/* Aggregate Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "总AUM", value: fmtM(aggregate?.totalAUM ?? 0), color: "text-blue-400" },
          { label: "今日总P&L", value: fmtM(aggregate?.totalDailyPnl ?? 0), color: (aggregate?.totalDailyPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400" },
          { label: "年初至今P&L", value: fmtM(aggregate?.totalYtdPnl ?? 0), color: (aggregate?.totalYtdPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400" },
          { label: "总持仓数", value: aggregate?.totalPositions ?? 0, color: "text-white" },
          { label: "加权夏普比率", value: fmt(aggregate?.weightedSharpe ?? 0), color: "text-purple-400" },
        ].map((c, i) => (
          <Card key={i} className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400 mb-1">{c.label}</div>
              <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "books" as const, label: "交易簿汇总" },
          { key: "trades" as const, label: "成交记录" },
          { key: "pnl" as const, label: "P&L归因" },
          { key: "risk" as const, label: "风险敞口" },
        ].map(v => (
          <Button
            key={v.key}
            size="sm"
            variant={activeView === v.key ? "default" : "outline"}
            className={`text-xs h-7 ${activeView === v.key ? "bg-blue-600 hover:bg-blue-700" : "border-slate-600 text-slate-300"}`}
            onClick={() => setActiveView(v.key)}
          >
            {v.label}
          </Button>
        ))}
      </div>

      {activeView === "books" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-slate-300">各交易簿今日P&L</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={books} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 9 }} tickFormatter={v => fmtM(v)} />
                    <YAxis dataKey="book" type="category" tick={{ fill: "#94a3b8", fontSize: 9 }} width={130} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                      formatter={(v: number) => [fmtM(v), "今日P&L"]} />
                    <ReferenceLine x={0} stroke="#475569" />
                    <Bar dataKey="dailyPnl" name="今日P&L" radius={[0, 4, 4, 0]}
                      fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-slate-300">各交易簿夏普比率</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={books}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="book" tick={{ fill: "#94a3b8", fontSize: 8 }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }} />
                    <ReferenceLine y={1} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "1.0", fill: "#f59e0b", fontSize: 10 }} />
                    <Bar dataKey="sharpe" name="夏普比率" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["交易簿", "策略", "AUM", "今日P&L", "今日收益率", "年初至今P&L", "年初至今收益率", "夏普", "最大回撤", "VaR 95%", "Beta", "持仓数"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {books.map((b, i) => (
                  <tr key={b.book} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-white font-semibold">{b.book}</td>
                    <td className="px-3 py-1.5 text-slate-400">{b.strategy}</td>
                    <td className="px-3 py-1.5 text-blue-400">{fmtM(b.aum)}</td>
                    <td className={`px-3 py-1.5 font-semibold ${b.dailyPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtM(b.dailyPnl)}</td>
                    <td className={`px-3 py-1.5 ${b.dailyReturn >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(b.dailyReturn, 3)}%</td>
                    <td className={`px-3 py-1.5 ${b.ytdPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtM(b.ytdPnl)}</td>
                    <td className={`px-3 py-1.5 ${b.ytdReturn >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(b.ytdReturn, 2)}%</td>
                    <td className="px-3 py-1.5 text-purple-400">{fmt(b.sharpe)}</td>
                    <td className="px-3 py-1.5 text-red-400">{fmt(b.maxDrawdown)}%</td>
                    <td className="px-3 py-1.5 text-orange-400">{fmtM(b.var95)}</td>
                    <td className="px-3 py-1.5 text-slate-300">{fmt(b.beta)}</td>
                    <td className="px-3 py-1.5 text-slate-300">{b.positions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === "trades" && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-400">交易簿筛选:</span>
            <Select value={bookFilter} onValueChange={setBookFilter}>
              <SelectTrigger className="h-7 w-48 text-xs bg-slate-800 border-slate-600 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {["All", "EQUITY_LONG_SHORT", "FIXED_INCOME_MACRO", "FX_CARRY", "COMMODITY_CTA", "STAT_ARB", "CREDIT_LONG", "DERIVATIVES_OVERLAY"].map(b => (
                  <SelectItem key={b} value={b} className="text-slate-200 text-xs">{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["成交ID", "证券", "方向", "数量", "价格", "名义价值", "P&L", "交易簿", "经纪商", "交易所", "成交时间", "结算日", "手续费", "滑点"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(trades ?? []).map((t, i) => (
                  <tr key={t.id} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-slate-300 font-mono">{t.id}</td>
                    <td className="px-3 py-1.5 text-white font-semibold">{t.security}</td>
                    <td className={`px-3 py-1.5 font-semibold ${t.side === "Buy" ? "text-green-400" : "text-red-400"}`}>
                      {t.side === "Buy" ? "▲" : "▼"} {t.side}
                    </td>
                    <td className="px-3 py-1.5 text-slate-300">{t.qty.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-slate-300">${fmt(t.price)}</td>
                    <td className="px-3 py-1.5 text-slate-300">{fmtM(t.notional)}</td>
                    <td className={`px-3 py-1.5 font-semibold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtM(t.pnl)}</td>
                    <td className="px-3 py-1.5 text-slate-400">{t.book}</td>
                    <td className="px-3 py-1.5 text-slate-400">{t.broker}</td>
                    <td className="px-3 py-1.5 text-slate-400">{t.venue}</td>
                    <td className="px-3 py-1.5 text-slate-500">{new Date(t.tradeTime).toLocaleTimeString()}</td>
                    <td className="px-3 py-1.5 text-slate-500">{t.settlementDate}</td>
                    <td className="px-3 py-1.5 text-slate-400">${fmt(t.commission)}</td>
                    <td className={`px-3 py-1.5 ${t.slippage > 0 ? "text-red-400" : "text-green-400"}`}>
                      {(t.slippage * 100).toFixed(3)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === "pnl" && pnl && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "总P&L", value: fmtM(pnl.totalPnl), color: (pnl.totalPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400" },
              { label: "总收益率", value: `${fmt(pnl.totalReturn, 3)}%`, color: (pnl.totalReturn ?? 0) >= 0 ? "text-green-400" : "text-red-400" },
              { label: "分析期间", value: `${pnl.periodStart} ~ ${pnl.periodEnd}`, color: "text-slate-300" },
            ].map((c, i) => (
              <Card key={i} className="bg-slate-800/60 border-slate-700">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-400 mb-1">{c.label}</div>
                  <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm text-slate-300">P&L 因子归因分解</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pnl.factors} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => fmtM(v)} />
                  <YAxis dataKey="factor" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={130} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }}
                    formatter={(v: number) => [fmtM(v), "贡献"]} />
                  <ReferenceLine x={0} stroke="#475569" />
                  <Bar dataKey="contribution" name="贡献" radius={[0, 4, 4, 0]}
                    fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === "risk" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["交易簿", "VaR 95%", "VaR 99%", "CVaR 95%", "Beta", "总敞口", "净敞口", "最大回撤", "集中度风险", "流动性风险"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(risk ?? []).map((r, i) => (
                  <tr key={r.book} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-white font-semibold">{r.book}</td>
                    <td className="px-3 py-1.5 text-orange-400">{fmtM(r.var95)}</td>
                    <td className="px-3 py-1.5 text-red-400">{fmtM(r.var99)}</td>
                    <td className="px-3 py-1.5 text-red-500">{fmtM(r.cvar95)}</td>
                    <td className="px-3 py-1.5 text-slate-300">{fmt(r.beta)}</td>
                    <td className="px-3 py-1.5 text-blue-400">{fmtM(r.grossExposure)}</td>
                    <td className={`px-3 py-1.5 ${(r.netExposure ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtM(r.netExposure)}</td>
                    <td className="px-3 py-1.5 text-red-400">{fmt(r.maxDrawdown)}%</td>
                    <td className={`px-3 py-1.5 ${(r.concentrationRisk ?? 0) > 20 ? "text-red-400" : (r.concentrationRisk ?? 0) > 15 ? "text-yellow-400" : "text-green-400"}`}>
                      {fmt(r.concentrationRisk)}%
                    </td>
                    <td className={`px-3 py-1.5 ${(r.liquidityRisk ?? 0) > 7 ? "text-red-400" : (r.liquidityRisk ?? 0) > 5 ? "text-yellow-400" : "text-green-400"}`}>
                      {fmt(r.liquidityRisk, 1)}/10
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

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function TradeBlotter() {
  const [activeTab, setActiveTab] = useState("tbgs");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4">
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">交易簿管理</h1>
            <p className="text-xs text-slate-400">Trade Blotter — TBGS · BTFI · TBMI</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/80 border border-slate-700 mb-4">
          {[
            { value: "tbgs", label: "TBGS 电子交易概览" },
            { value: "btfi", label: "BTFI 期货信息" },
            { value: "tbmi", label: "TBMI 交易簿信息" },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-400">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="tbgs"><TBGSTab /></TabsContent>
        <TabsContent value="btfi"><BTFITab /></TabsContent>
        <TabsContent value="tbmi"><TBMITab /></TabsContent>
      </Tabs>
    </div>
  );
}

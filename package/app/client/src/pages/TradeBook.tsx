import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Shield, BarChart2, DollarSign,
  Activity, RefreshCw, ChevronUp, ChevronDown, AlertTriangle, Layers
} from "lucide-react";

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, d = 2) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtM(n: number | null | undefined) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmt(n);
}
function pnlColor(v: number | null | undefined) {
  return typeof v !== "number" ? "text-slate-400" : v >= 0 ? "text-emerald-400" : "text-red-400";
}
function pnlBg(v: number | null | undefined) {
  return typeof v !== "number" ? "bg-slate-800 border-slate-700" : v >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20";
}

function UnavailableCard({ message }: { message?: string }) {
  return (
    <Card className="bg-slate-900 border-amber-500/30">
      <CardContent className="p-5 text-sm">
        <div className="font-semibold text-amber-200 mb-2">当前没有可核验的账户数据</div>
        <div className="text-slate-400">{message ?? "请配置经纪商/托管行授权或导入账本后刷新。"}</div>
      </CardContent>
    </Card>
  );
}

const ASSET_COLORS: Record<string, string> = {
  EQUITY: "#3b82f6", FIXED_INCOME: "#8b5cf6", FX: "#f59e0b",
  COMMODITY: "#f97316", DERIVATIVE: "#ec4899", FUND: "#06b6d4", CRYPTO: "#84cc16",
};

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#f97316", "#ec4899", "#06b6d4", "#84cc16", "#ef4444"];

// ─── 持仓明细面板 ──────────────────────────────────────────────────────────────

function PositionsPanel() {
  const [account, setAccount] = useState<string | undefined>(undefined);
  const [assetClass, setAssetClass] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<"marketValue" | "unrealizedPnL" | "dayPnL">("marketValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedPos, setSelectedPos] = useState<string | null>(null);

  const { data, refetch } = trpc.tradebook.getPositions.useQuery({
    account, assetClass, showFlat: false,
  }, { refetchInterval: 10000 });

  const { data: detail } = trpc.tradebook.getPositionDetail.useQuery(
    { positionId: selectedPos! },
    { enabled: !!selectedPos }
  );

  if (data && !data.available) return <UnavailableCard message={data.limitation} />;

  const sorted = data?.positions.slice().sort((a, b) => {
    const va = (a as any)[sortBy] ?? 0;
    const vb = (b as any)[sortBy] ?? 0;
    return sortDir === "desc" ? vb - va : va - vb;
  }) ?? [];

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(field); setSortDir("desc"); }
  };

  return (
    <div className="space-y-4">
      {/* 汇总卡片 */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "总市值", value: data.summary.totalMarketValue, fmt: fmtM, prefix: "$" },
            { label: "未实现P&L", value: data.summary.totalUnrealizedPnL, fmt: fmtM, prefix: "$", pnl: true },
            { label: "已实现P&L", value: data.summary.totalRealizedPnL, fmt: fmtM, prefix: "$", pnl: true },
            { label: "日内P&L", value: data.summary.totalDayPnL, fmt: fmtM, prefix: "$", pnl: true },
            { label: "总成本", value: data.summary.totalCostBasis, fmt: fmtM, prefix: "$" },
            { label: "总收益率", value: data.summary.returnPct, fmt: (v: number | null | undefined) => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`, prefix: "", pnl: true },
            { label: "持仓数量", value: data.summary.positionCount, fmt: (v: number | null | undefined) => v == null ? "—" : v.toString(), prefix: "" },
          ].map((m, i) => (
            <Card key={i} className="bg-slate-900 border-slate-700">
              <CardContent className="p-3">
                <div className="text-xs text-slate-400">{m.label}</div>
                <div className={`text-base font-mono font-bold mt-1 ${m.pnl ? pnlColor(m.value) : "text-white"}`}>
                  {m.prefix}{m.fmt(m.value)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 过滤栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={account ?? "all"} onValueChange={v => setAccount(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-36 h-8 bg-slate-800 border-slate-700 text-white text-xs">
            <SelectValue placeholder="全部账户" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-slate-200 text-xs">全部账户</SelectItem>
            {["ACC-001", "ACC-002", "ACC-003"].map(a => <SelectItem key={a} value={a} className="text-slate-200 text-xs">{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assetClass ?? "all"} onValueChange={v => setAssetClass(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-40 h-8 bg-slate-800 border-slate-700 text-white text-xs">
            <SelectValue placeholder="全部资产类别" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-slate-200 text-xs">全部资产类别</SelectItem>
            {["EQUITY", "FIXED_INCOME", "FX", "COMMODITY", "DERIVATIVE"].map(a => (
              <SelectItem key={a} value={a} className="text-slate-200 text-xs">{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 bg-slate-800 border-slate-700 text-slate-400">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* 持仓表格 */}
        <div className="xl:col-span-2 rounded-lg border border-slate-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 bg-slate-800/50">
                <TableHead className="text-slate-400 text-xs">标的</TableHead>
                <TableHead className="text-slate-400 text-xs">类别</TableHead>
                <TableHead className="text-slate-400 text-xs text-right">数量</TableHead>
                <TableHead className="text-slate-400 text-xs text-right">均成本</TableHead>
                <TableHead className="text-slate-400 text-xs text-right">现价</TableHead>
                <TableHead
                  className="text-slate-400 text-xs text-right cursor-pointer hover:text-white"
                  onClick={() => toggleSort("marketValue")}
                >
                  市值 {sortBy === "marketValue" && (sortDir === "desc" ? <ChevronDown className="inline w-3 h-3" /> : <ChevronUp className="inline w-3 h-3" />)}
                </TableHead>
                <TableHead
                  className="text-slate-400 text-xs text-right cursor-pointer hover:text-white"
                  onClick={() => toggleSort("unrealizedPnL")}
                >
                  未实现P&L {sortBy === "unrealizedPnL" && (sortDir === "desc" ? <ChevronDown className="inline w-3 h-3" /> : <ChevronUp className="inline w-3 h-3" />)}
                </TableHead>
                <TableHead
                  className="text-slate-400 text-xs text-right cursor-pointer hover:text-white"
                  onClick={() => toggleSort("dayPnL")}
                >
                  日内P&L {sortBy === "dayPnL" && (sortDir === "desc" ? <ChevronDown className="inline w-3 h-3" /> : <ChevronUp className="inline w-3 h-3" />)}
                </TableHead>
                <TableHead className="text-slate-400 text-xs text-right">权重</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(pos => (
                <TableRow
                  key={pos.id}
                  className={`border-slate-800 cursor-pointer transition-colors ${selectedPos === pos.id ? "bg-blue-900/20" : "hover:bg-slate-800/30"}`}
                  onClick={() => setSelectedPos(selectedPos === pos.id ? null : pos.id)}
                >
                  <TableCell>
                    <div className="text-xs font-mono font-bold text-white">{pos.symbol}</div>
                    <div className="text-xs text-slate-500 truncate max-w-28">{pos.name}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${ASSET_COLORS[pos.assetClass]}20`, color: ASSET_COLORS[pos.assetClass] }}>
                      {pos.assetClass.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right">
                    <span className={pos.quantity < 0 ? "text-red-400" : "text-white"}>{pos.quantity.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right text-slate-300">{fmt(pos.avgCost, 4)}</TableCell>
                  <TableCell className="text-xs font-mono text-right text-white">{fmt(pos.currentPrice, 4)}</TableCell>
                  <TableCell className="text-xs font-mono text-right text-white">${fmtM(pos.marketValue)}</TableCell>
                  <TableCell className="text-xs font-mono text-right">
                    <div className={pnlColor(pos.unrealizedPnL)}>${fmtM(pos.unrealizedPnL)}</div>
                    <div className={`text-xs ${pnlColor(pos.unrealizedPnLPct)}`}>{pos.unrealizedPnLPct == null ? "—" : `${pos.unrealizedPnLPct >= 0 ? "+" : ""}${pos.unrealizedPnLPct.toFixed(2)}%`}</div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right">
                    <span className={pnlColor(pos.dayPnL)}>{pos.dayPnL == null ? "—" : `${pos.dayPnL >= 0 ? "+" : ""}$${fmtM(pos.dayPnL)}`}</span>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right text-slate-400">{pos.weight == null ? "—" : `${Math.abs(pos.weight).toFixed(1)}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 持仓详情 / 分布图 */}
        <div className="space-y-4">
          {selectedPos && detail?.position ? (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200">{detail.position.symbol} 持仓历史</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={detail.history.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }} />
                    <Area type="monotone" dataKey="pnl" stroke="#3b82f6" fill="#3b82f620" strokeWidth={1.5} name="P&L" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  {[
                    { label: "Beta", value: detail.position.beta?.toFixed(2) },
                    { label: "Delta", value: detail.position.delta?.toLocaleString() },
                    ...(detail.position.assetClass === "DERIVATIVE" ? [
                      { label: "Gamma", value: (detail.position as any).gamma?.toLocaleString() },
                      { label: "Vega", value: (detail.position as any).vega?.toLocaleString() },
                      { label: "Theta", value: (detail.position as any).theta?.toLocaleString() },
                      { label: "IV", value: `${((detail.position as any).impliedVol * 100).toFixed(1)}%` },
                    ] : []),
                    ...(detail.position.assetClass === "FIXED_INCOME" ? [
                      { label: "久期", value: (detail.position as any).duration?.toFixed(2) },
                      { label: "DV01", value: `$${(detail.position as any).dv01?.toLocaleString()}` },
                      { label: "到期收益率", value: `${((detail.position as any).yieldToMaturity * 100).toFixed(3)}%` },
                    ] : []),
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-800/60 rounded p-2">
                      <div className="text-slate-500">{item.label}</div>
                      <div className="text-white font-mono">{item.value ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-200">资产类别分布</CardTitle>
              </CardHeader>
              <CardContent>
                {data && (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={Object.entries(
                          data.positions.reduce((acc, p) => {
                            acc[p.assetClass] = (acc[p.assetClass] || 0) + Math.abs(p.marketValue ?? 0);
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([name, value]) => ({ name, value }))}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                        dataKey="value"
                      >
                        {data.positions.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => `$${fmtM(v)}`} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="text-xs text-slate-500 text-center mt-1">点击持仓行查看详情</div>
              </CardContent>
            </Card>
          )}

          {/* 期货持仓 */}
          <FuturesPositionsMini />
        </div>
      </div>
    </div>
  );
}

// ─── 期货持仓迷你面板 ──────────────────────────────────────────────────────────

function FuturesPositionsMini() {
  const { data } = trpc.tradebook.getFuturesPositions.useQuery();
  if (!data) return null;
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400" />
          期货持仓 (BTFI)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((f: any) => (
          <div key={f.symbol} className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <span className="text-xs font-mono font-bold text-white">{f.symbol}</span>
                <span className="ml-2 text-xs font-bold text-slate-400">
                  市场参考行情（非账户持仓）
                </span>
              </div>
              <span className={`text-xs font-mono font-bold ${pnlColor(f.dayPnL)}`}>
                {typeof f.dayPnL === "number" && f.dayPnL >= 0 ? "+" : ""}{fmt(f.dayPnL, 4)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div><span className="text-slate-500">均价 </span><span className="text-slate-300 font-mono">—</span></div>
              <div><span className="text-slate-500">现价 </span><span className="text-white font-mono">{fmt(f.currentPrice, 2)}</span></div>
              <div><span className="text-slate-500">到期 </span><span className="text-slate-400">{f.expiry ?? "—"}</span></div>
            </div>
            <div className="text-xs text-slate-500 mt-1">变化: {fmt(f.changePct, 3)}%</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── P&L 分析面板 ──────────────────────────────────────────────────────────────

function PnLAnalysisPanel() {
  const [period, setPeriod] = useState<"1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y">("1M");
  const { data } = trpc.tradebook.getPnLAnalysis.useQuery({ period }, { refetchInterval: 30000 });

  if (!data) return <div className="animate-pulse space-y-4"><div className="h-64 bg-slate-800 rounded-lg" /></div>;
  if (!data.available || !data.summary) return <UnavailableCard message={data.limitation} />;

  const { history, summary, attribution } = data;

  return (
    <div className="space-y-4">
      {/* 期间选择 & 关键指标 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5">
          {(["1D", "1W", "1M", "3M", "6M", "YTD", "1Y"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${period === p ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "总P&L", value: `$${fmtM(summary.totalPnL)}`, pnl: true, v: summary.totalPnL },
          { label: "最大回撤", value: `$${fmtM(summary.maxDrawdown)}`, pnl: true, v: summary.maxDrawdown },
          { label: "夏普比率", value: summary.sharpeRatio.toFixed(2), pnl: summary.sharpeRatio >= 0, v: summary.sharpeRatio },
          { label: "胜率", value: `${summary.winRate}%`, pnl: summary.winRate >= 50, v: summary.winRate - 50 },
          { label: "日均P&L", value: `$${fmtM(summary.avgDailyPnL)}`, pnl: true, v: summary.avgDailyPnL },
          { label: "日波动率", value: `$${fmtM(summary.stdDev)}`, pnl: false, v: 0 },
          { label: "最佳日", value: `$${fmtM(summary.bestDay)}`, pnl: true, v: 1 },
          { label: "最差日", value: `$${fmtM(summary.worstDay)}`, pnl: true, v: summary.worstDay },
        ].map((m, i) => (
          <Card key={i} className="bg-slate-900 border-slate-700">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400">{m.label}</div>
              <div className={`text-sm font-mono font-bold mt-1 ${m.pnl ? pnlColor(m.v) : "text-white"}`}>{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 累计P&L曲线 */}
        <Card className="bg-slate-900 border-slate-700 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200">累计P&L曲线</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tickFormatter={v => `$${fmtM(v)}`} tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(v: any) => [`$${fmtM(v)}`, ""]}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
                <Area type="monotone" dataKey="cumulativePnL" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="累计P&L" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* P&L 归因 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200">P&L 归因分析</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attribution.map((a: any, i: number) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">{a.category}</span>
                  <span className={`font-mono ${pnlColor(a.pnl)}`}>${fmtM(a.pnl)}</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.abs(a.contribution)}%`, background: PIE_COLORS[i] }}
                  />
                </div>
                <div className="text-xs text-slate-500 text-right">{a.contribution}%</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 日度P&L柱状图 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-200">日度P&L分布</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={history.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={d => d.slice(5)} />
              <YAxis tickFormatter={v => `$${fmtM(v)}`} tick={{ fill: "#64748b", fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }}
                formatter={(v: any) => [`$${fmtM(v)}`, "日P&L"]}
              />
              <ReferenceLine y={0} stroke="#475569" />
              <Bar dataKey="dailyPnL" name="日P&L" radius={[2, 2, 0, 0]}>
                {history.slice(-30).map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.dailyPnL >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 风险敞口面板 ──────────────────────────────────────────────────────────────

function RiskExposurePanel() {
  const [account, setAccount] = useState<string | undefined>(undefined);
  const { data } = trpc.tradebook.getRiskExposure.useQuery({ account }, { refetchInterval: 15000 });

  if (!data) return <div className="animate-pulse space-y-4"><div className="h-64 bg-slate-800 rounded-lg" /></div>;
  if (!data.available || !data.greeks || !data.var || !data.concentration) return <UnavailableCard message={data.limitation} />;
  const greeks = data.greeks;
  const varMetrics = data.var;
  const concentration = data.concentration;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={account ?? "all"} onValueChange={v => setAccount(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-36 h-8 bg-slate-800 border-slate-700 text-white text-xs">
            <SelectValue placeholder="全部账户" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-slate-200 text-xs">全部账户</SelectItem>
            {["ACC-001", "ACC-002", "ACC-003"].map(a => <SelectItem key={a} value={a} className="text-slate-200 text-xs">{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Greeks */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Greeks 汇总
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "净 Delta", value: greeks.totalDelta.toLocaleString(), desc: "价格敏感度" },
              { label: "净 Gamma", value: greeks.totalGamma.toLocaleString(), desc: "Delta变化率" },
              { label: "净 Vega", value: greeks.totalVega.toLocaleString(), desc: "波动率敏感度" },
              { label: "净 Theta", value: greeks.totalTheta.toLocaleString(), desc: "时间价值敏感度/日" },
              { label: "净 Beta", value: greeks.netBeta.toFixed(3), desc: "市场敏感度" },
              { label: "DV01", value: fmt(data.dv01), desc: "利率1bp敏感度" },
              { label: "修正久期", value: data.duration == null ? "—" : `${fmt(data.duration)}年`, desc: "利率风险" },
            ].map((g, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                <div>
                  <div className="text-xs text-slate-300">{g.label}</div>
                  <div className="text-xs text-slate-500">{g.desc}</div>
                </div>
                <div className="text-sm font-mono font-bold text-white">{g.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* VaR */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              风险价值 (VaR)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <div className="text-xs text-slate-400 mb-1">组合总价值</div>
              <div className="text-2xl font-mono font-bold text-white">${fmtM(varMetrics.portfolioValue)}</div>
            </div>
            <Separator className="bg-slate-800" />
            {[
              { label: "VaR (95%, 1日)", value: varMetrics.var95, desc: "5%概率超过此损失" },
              { label: "VaR (99%, 1日)", value: varMetrics.var99, desc: "1%概率超过此损失" },
              { label: "CVaR (95%)", value: varMetrics.cvar95, desc: "超过VaR时的期望损失" },
            ].map((v, i) => (
              <div key={i} className={`rounded-lg p-3 border ${pnlBg(-1)}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-slate-300">{v.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{v.desc}</div>
                  </div>
                  <div className="text-red-400 font-mono font-bold">-${fmtM(v.value)}</div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {v.value == null || varMetrics.portfolioValue === 0 ? "占组合 —" : `占组合 ${(v.value / varMetrics.portfolioValue * 100).toFixed(2)}%`}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 压力测试 */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              压力测试情景
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.stressTests.map((s: any, i: number) => (
              <div key={i} className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-300">{s.scenario}</span>
                  <span className="text-xs text-slate-500">P={s.probability}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${s.impact == null || varMetrics.portfolioValue === 0 ? 0 : Math.min(Math.abs(s.impact / varMetrics.portfolioValue) * 100 * 3, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-red-400 w-20 text-right">-${fmtM(Math.abs(s.impact))}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 集中度分析 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200">资产类别集中度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {concentration.byAssetClass.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-slate-300 w-28 truncate">{a.name}</span>
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${a.weight}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                  <span className="text-xs font-mono text-slate-300 w-12 text-right">{a.weight}%</span>
                  <span className="text-xs font-mono text-slate-500 w-20 text-right">${fmtM(a.value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
              前5大集中度: <span className="text-white font-mono">{concentration.top5Concentration}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-200">行业集中度</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={concentration.bySector} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} width={90} />
                <Tooltip formatter={(v: any) => [`${v}%`, "权重"]} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "11px" }} />
                <Bar dataKey="weight" radius={[0, 3, 3, 0]}>
                  {concentration.bySector.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── 账户管理面板 ──────────────────────────────────────────────────────────────

function AccountsPanel() {
  const { data: accountData } = trpc.tradebook.getAccounts.useQuery(undefined, { refetchInterval: 15000 });
  const { data: cashFlowData } = trpc.tradebook.getCashFlows.useQuery({ days: 30 });
  if (accountData && !accountData.available) return <UnavailableCard message={accountData.limitation} />;
  const accounts = accountData?.accounts ?? [];
  const cashFlows = cashFlowData?.cashFlows ?? [];

  return (
    <div className="space-y-4">
      {/* 账户卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts?.map((acc: any) => (
          <Card key={acc.id} className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm text-white">{acc.name}</CardTitle>
                  <div className="text-xs text-slate-400 mt-0.5">{acc.id} · {acc.broker}</div>
                </div>
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-xs">{acc.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">净资产 (NAV)</div>
                  <div className="text-lg font-mono font-bold text-white">${fmtM(acc.nav)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">现金</div>
                  <div className="text-lg font-mono font-bold text-emerald-400">${fmtM(acc.cash)}</div>
                </div>
              </div>
              <Separator className="bg-slate-800" />
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">保证金已用</span>
                  <span className="text-white font-mono">${fmtM(acc.marginUsed)}</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${acc.marginUtilization > 80 ? "bg-red-500" : acc.marginUtilization > 60 ? "bg-yellow-500" : "bg-blue-500"}`}
                    style={{ width: `${acc.marginUtilization}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">保证金利用率</span>
                  <span className={`font-mono ${acc.marginUtilization > 80 ? "text-red-400" : "text-slate-300"}`}>{acc.marginUtilization}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800/60 rounded p-2">
                  <div className="text-slate-500">购买力</div>
                  <div className="text-white font-mono">${fmtM(acc.buyingPower)}</div>
                </div>
                <div className="bg-slate-800/60 rounded p-2">
                  <div className="text-slate-500">杠杆倍数</div>
                  <div className="text-white font-mono">{acc.leverage.toFixed(1)}x</div>
                </div>
                <div className={`bg-slate-800/60 rounded p-2 border ${pnlBg(acc.dayPnL)}`}>
                  <div className="text-slate-500">日内P&L</div>
                  <div className={`font-mono ${pnlColor(acc.dayPnL)}`}>{acc.dayPnL >= 0 ? "+" : ""}${fmtM(acc.dayPnL)}</div>
                </div>
                <div className={`bg-slate-800/60 rounded p-2 border ${pnlBg(acc.totalPnL)}`}>
                  <div className="text-slate-500">总P&L</div>
                  <div className={`font-mono ${pnlColor(acc.totalPnL)}`}>{acc.totalPnL >= 0 ? "+" : ""}${fmtM(acc.totalPnL)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 资金流水 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            资金流水（近30日）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-800/50">
                  {["流水号", "账户", "类型", "金额", "币种", "日期", "描述", "状态"].map(h => (
                    <TableHead key={h} className="text-slate-400 text-xs">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashFlows?.slice(0, 20).map((cf: any) => (
                  <TableRow key={cf.id} className="border-slate-800 hover:bg-slate-800/30">
                    <TableCell className="text-xs font-mono text-slate-400">{cf.id}</TableCell>
                    <TableCell className="text-xs text-slate-300">{cf.account}</TableCell>
                    <TableCell>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{cf.type.replace("_", " ")}</span>
                    </TableCell>
                    <TableCell className={`text-xs font-mono font-bold ${cf.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {cf.amount >= 0 ? "+" : ""}${fmtM(Math.abs(cf.amount))}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{cf.currency}</TableCell>
                    <TableCell className="text-xs text-slate-400">{cf.date}</TableCell>
                    <TableCell className="text-xs text-slate-400 max-w-40 truncate">{cf.description}</TableCell>
                    <TableCell>
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{cf.status}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 文字映射表 ────────────────────────────────────────────────────────────

const TAB_LABELS: Record<string, { t1: string; t2: string; t3: string; t4: string }> = {
  // 交易簿股票：聚焦个股Alpha、技术信号、板块轮动、融资融券
  STOCK:   { t1: '个股Alpha',   t2: '技术信号',   t3: '板块轮动',   t4: '融资融券'   },
  // 交易簿期货：聚焦展期日历、基差结构、保证金压力、交割监控
  FUTURES: { t1: '展期日历',    t2: '基差结构',   t3: '保证金压力', t4: '交割监控'   },
  // 交易簿期权：聚焦波动率曲面、行权管理、Gamma敞口、到期日历
  OPTIONS: { t1: '波动率曲面',  t2: '行权管理',   t3: 'Gamma敞口',  t4: '到期日历'   },
  // TBGS汇总：聚焦跨资产净值、归因分析、压力测试、流动性覆盖
  TBGS:    { t1: '跨资产净值',  t2: '归因分析',   t3: '压力测试',   t4: '流动性覆盖' },
  // BTFI期货持仓：聚焦合约明细、保证金占用、强平预警、展期建议
  BTFI:    { t1: '合约明细',    t2: '保证金占用',  t3: '强平预警',   t4: '展期建议'   },
  // TBMI市场影响：聚焦冲击成本、VWAP偏差、流动性评分、最优拆单
  TBMI:    { t1: '冲击成本',    t2: 'VWAP偏差',   t3: '流动性评分', t4: '最优拆单'   },
  // AIM资产指令：聚焦指令队列、分配方案、合规检查、执行回报
  AIM:     { t1: '指令队列',    t2: '分配方案',   t3: '合规检查',   t4: '执行回报'   },
  // TOMS订单管理：聚焦委托流水、成交明细、拒单分析、路由追踪
  TOMS:    { t1: '委托流水',    t2: '成交明细',   t3: '拒单分析',   t4: '路由追踪'   },
  // TSDM结算交收：聚焦待交割、净额轧差、失败处理、结算日历
  TSDM:    { t1: '待交割',      t2: '净额轧差',   t3: '失败处理',   t4: '结算日历'   },
  DEFAULT: { t1: '持仓明细',    t2: 'P&L 分析',   t3: '风险敞口',   t4: '账户管理'   },
};

// ─── 主页面 ────────────────────────────────────────────────────────────────────

export default function TradeBook() {
  const [location] = useLocation();
  const panel = new URLSearchParams(window.location.search).get('panel') ?? 'DEFAULT';
  const tabs = TAB_LABELS[panel] ?? TAB_LABELS['DEFAULT'];
  const { data: summary } = trpc.tradebook.getTradebookSummary.useQuery(undefined, { refetchInterval: 10000 });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* 顶部状态栏 */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">交易账簿管理</span>
            </div>
            <Separator orientation="vertical" className="h-4 bg-slate-700" />
            <span className="text-xs text-slate-400">TBGS · BTFI · TBMI · AIM · TOMS · TSDM</span>
          </div>
          {summary && (
            <div className="flex items-center gap-4 text-xs flex-wrap">
              {[
                { label: "总NAV", value: `$${fmtM(summary.totalNav)}`, color: "text-white" },
                { label: "多头", value: `$${fmtM(summary.totalLong)}`, color: "text-emerald-400" },
                { label: "空头", value: `$${fmtM(summary.totalShort)}`, color: "text-red-400" },
                { label: "净敞口", value: `$${fmtM(summary.netExposure)}`, color: pnlColor(summary.netExposure) },
                { label: "日P&L", value: `${summary.dayPnL == null ? "" : summary.dayPnL >= 0 ? "+" : ""}$${fmtM(summary.dayPnL)}`, color: pnlColor(summary.dayPnL) },
                { label: "总P&L", value: `${summary.totalPnL == null ? "" : summary.totalPnL >= 0 ? "+" : ""}$${fmtM(summary.totalPnL)}`, color: pnlColor(summary.totalPnL) },
                { label: "持仓", value: `${summary.positionCount}个`, color: "text-blue-400" },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-slate-500">{m.label}</span>
                  <span className={`font-mono font-bold ${m.color}`}>{m.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 主内容 */}
      <div className="p-6">
        <Tabs defaultValue="positions" className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-700 p-1">
            <TabsTrigger value="positions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">{tabs.t1}</TabsTrigger>
            <TabsTrigger value="pnl" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">{tabs.t2}</TabsTrigger>
            <TabsTrigger value="risk" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">{tabs.t3}</TabsTrigger>
            <TabsTrigger value="accounts" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">{tabs.t4}</TabsTrigger>
          </TabsList>

          <TabsContent value="positions"><PositionsPanel /></TabsContent>
          <TabsContent value="pnl"><PnLAnalysisPanel /></TabsContent>
          <TabsContent value="risk"><RiskExposurePanel /></TabsContent>
          <TabsContent value="accounts"><AccountsPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

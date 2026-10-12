import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Activity, AlertCircle, CheckCircle2,
  XCircle, Clock, RefreshCw, Search, Filter, Plus, Send,
  BarChart3, Shield, Zap, Globe, Server, Wifi, WifiOff
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Partial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Filled: "bg-green-500/20 text-green-400 border-green-500/30",
    Cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    Rejected: "bg-red-500/20 text-red-400 border-red-500/30",
    Active: "bg-green-500/20 text-green-400 border-green-500/30",
    Done: "bg-green-500/20 text-green-400 border-green-500/30",
    Expired: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    "In Progress": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Completed: "bg-green-500/20 text-green-400 border-green-500/30",
    Failed: "bg-red-500/20 text-red-400 border-red-500/30",
    Submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
      {status}
    </span>
  );
}

function fmt(n: number | null | undefined, decimals = 2) {
  return typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : "—";
}
function fmtM(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${(n / 1e3).toFixed(1)}K`;
}

// ─── AIM Tab ───────────────────────────────────────────────────────────────

function AIMTab() {
  const [statusFilter, setStatusFilter] = useState("All");
  const [sideFilter, setSideFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    security: "AAPL", side: "Buy" as "Buy" | "Sell", qty: 1000,
    orderType: "TWAP", limitPrice: 189.5, account: "FUND_A", broker: "Goldman Sachs", algo: "TWAP"
  });

  const { data, refetch } = trpc.orderManagement.getAIMOrders.useQuery({ status: statusFilter, side: sideFilter });
  const submitMutation = trpc.orderManagement.submitAIMOrder.useMutation({
    onSuccess: (result) => {
      toast.success(`订单 ${result.orderId} 已提交`, {
        description: result.message,
      });
      setOrderDialogOpen(false);
      refetch();
    },
    onError: () => toast.error("订单提交失败"),
  });
  const complianceMutation = trpc.orderManagement.runComplianceCheck.useMutation({
    onSuccess: (result) => {
      const icon = result.overallStatus === "Approved" ? "✅" : result.overallStatus === "Warning" ? "⚠️" : "❌";
      toast(icon + " 合规检查: " + result.overallStatus, {
        description: `${result.checks.filter(c => c.status === "Pass").length}/${result.checks.length} 项通过`,
      });
    },
  });

  const orders = data?.orders ?? [];
  const summary = data?.summary;
  const filtered = orders.filter(o =>
    search === "" || o.security.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase())
  );

  const COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6"];

  const statusData = ["Pending", "Partial", "Filled", "Cancelled", "Rejected"].map((s, i) => ({
    name: s, value: orders.filter(o => o.status === s).length, fill: COLORS[i]
  }));

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "总委托数", value: summary?.totalOrders ?? 0, sub: "今日", icon: <Activity className="w-4 h-4" /> },
          { label: "待执行", value: summary?.pendingOrders ?? 0, sub: "Pending", icon: <Clock className="w-4 h-4 text-yellow-400" /> },
          { label: "已成交", value: summary?.filledOrders ?? 0, sub: "Filled", icon: <CheckCircle2 className="w-4 h-4 text-green-400" /> },
          { label: "总名义价值", value: fmtM(summary?.totalNotional ?? 0), sub: "Notional", icon: <BarChart3 className="w-4 h-4 text-blue-400" /> },
        ].map((c, i) => (
          <Card key={i} className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">{c.label}</span>
                {c.icon}
              </div>
              <div className="text-xl font-bold text-white">{c.value}</div>
              <div className="text-xs text-slate-500">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300">委托状态分布</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300">算法类型分布</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={["Market", "Limit", "TWAP", "VWAP", "IS", "POV"].map(t => ({
                type: t,
                count: orders.filter(o => o.orderType === t).length,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="type" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters + New Order */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索证券/委托ID..." className="pl-7 h-8 text-xs bg-slate-800 border-slate-600 text-slate-200" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32 text-xs bg-slate-800 border-slate-600 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {["All", "Pending", "Partial", "Filled", "Cancelled", "Rejected"].map(s => (
              <SelectItem key={s} value={s} className="text-slate-200 text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sideFilter} onValueChange={setSideFilter}>
          <SelectTrigger className="h-8 w-24 text-xs bg-slate-800 border-slate-600 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {["All", "Buy", "Sell"].map(s => (
              <SelectItem key={s} value={s} className="text-slate-200 text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs border-slate-600 text-slate-300">
          <RefreshCw className="w-3 h-3 mr-1" /> 刷新
        </Button>
        <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
              <Plus className="w-3 h-3 mr-1" /> 新建委托
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-slate-100">AIM 委托录入</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {[
                { label: "证券代码", key: "security", type: "text" },
                { label: "数量", key: "qty", type: "number" },
                { label: "限价", key: "limitPrice", type: "number" },
              ].map(f => (
                <div key={f.key}>
                  <Label className="text-xs text-slate-400">{f.label}</Label>
                  <Input
                    type={f.type}
                    value={(orderForm as Record<string, unknown>)[f.key] as string | number}
                    onChange={e => setOrderForm(prev => ({ ...prev, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                    className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 mt-1"
                  />
                </div>
              ))}
              <div>
                <Label className="text-xs text-slate-400">买卖方向</Label>
                <Select value={orderForm.side} onValueChange={v => setOrderForm(prev => ({ ...prev, side: v as "Buy" | "Sell" }))}>
                  <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="Buy" className="text-green-400 text-xs">Buy 买入</SelectItem>
                    <SelectItem value="Sell" className="text-red-400 text-xs">Sell 卖出</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400">委托类型</Label>
                <Select value={orderForm.orderType} onValueChange={v => setOrderForm(prev => ({ ...prev, orderType: v }))}>
                  <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {["Market", "Limit", "TWAP", "VWAP", "IS", "POV"].map(t => (
                      <SelectItem key={t} value={t} className="text-slate-200 text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400">账户</Label>
                <Select value={orderForm.account} onValueChange={v => setOrderForm(prev => ({ ...prev, account: v }))}>
                  <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {["FUND_A", "FUND_B", "PENSION_1", "HEDGE_X", "ENDOW_Y"].map(a => (
                      <SelectItem key={a} value={a} className="text-slate-200 text-xs">{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400">经纪商</Label>
                <Select value={orderForm.broker} onValueChange={v => setOrderForm(prev => ({ ...prev, broker: v }))}>
                  <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {["Goldman Sachs", "Morgan Stanley", "JPMorgan", "Barclays", "Deutsche Bank"].map(b => (
                      <SelectItem key={b} value={b} className="text-slate-200 text-xs">{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs border-slate-600 text-slate-300"
                onClick={() => complianceMutation.mutate({
                  security: orderForm.security,
                  side: orderForm.side,
                  qty: orderForm.qty,
                  price: orderForm.limitPrice,
                  account: orderForm.account,
                })}
                disabled={complianceMutation.isPending}
              >
                <Shield className="w-3 h-3 mr-1" /> 合规预检
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700"
                onClick={() => submitMutation.mutate(orderForm)}
                disabled={submitMutation.isPending}
              >
                <Send className="w-3 h-3 mr-1" /> 提交委托
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/80">
              {["委托ID", "证券", "方向", "数量", "已成交", "限价", "均成交价", "类型", "状态", "账户", "经纪商", "手续费", "滑点"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => (
              <tr key={o.id} className={`border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                <td className="px-3 py-1.5 text-slate-300 font-mono">{o.id}</td>
                <td className="px-3 py-1.5 text-white font-semibold">{o.security}</td>
                <td className={`px-3 py-1.5 font-semibold ${o.side === "Buy" ? "text-green-400" : "text-red-400"}`}>
                  {o.side === "Buy" ? "▲ Buy" : "▼ Sell"}
                </td>
                <td className="px-3 py-1.5 text-slate-300">{o.qty.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-blue-400">{o.filled.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-slate-300">${fmt(o.limitPrice)}</td>
                <td className="px-3 py-1.5 text-slate-300">{o.avgFillPrice ? `$${fmt(o.avgFillPrice)}` : "—"}</td>
                <td className="px-3 py-1.5 text-purple-400">{o.orderType}</td>
                <td className="px-3 py-1.5"><StatusBadge status={o.status} /></td>
                <td className="px-3 py-1.5 text-slate-400">{o.account}</td>
                <td className="px-3 py-1.5 text-slate-400">{o.broker}</td>
                <td className="px-3 py-1.5 text-slate-400">${fmt(o.commission)}</td>
                <td className={`px-3 py-1.5 ${o.slippage > 0 ? "text-red-400" : "text-green-400"}`}>
                  {o.slippage !== 0 ? `${(o.slippage * 100).toFixed(3)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TOMS Tab ──────────────────────────────────────────────────────────────

function TOMSTab() {
  const [sideFilter, setSideFilter] = useState("All");
  const { data } = trpc.orderManagement.getTOMSOrders.useQuery({ side: sideFilter });
  const { data: quoteData } = trpc.orderManagement.getMarketMakingQuotes.useQuery();

  const orders = data?.orders ?? [];
  const risk = data?.riskMetrics;
  const quotes = quoteData?.quotes ?? [];

  return (
    <div className="space-y-4">
      {/* Risk Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "总DV01", value: `$${fmt(risk?.totalDV01 ?? 0 / 1000)}K`, color: "text-orange-400" },
          { label: "总名义", value: fmtM(risk?.totalNotional ?? 0), color: "text-blue-400" },
          { label: "活跃委托", value: risk?.activeOrders ?? 0, color: "text-green-400" },
          { label: "平均价差", value: `${fmt(risk?.avgSpread ?? 0, 1)} bps`, color: "text-purple-400" },
          { label: "风险利用率", value: `${((risk?.riskUtilization ?? 0) * 100).toFixed(1)}%`, color: "text-yellow-400" },
        ].map((c, i) => (
          <Card key={i} className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400 mb-1">{c.label}</div>
              <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Market Making Quotes */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm text-slate-300">做市报价 — 国债市场</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["债券", "买入收益率", "卖出收益率", "买入价格", "卖出价格", "买入规模", "卖出规模", "价差(bps)", "最近成交"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(quotes ?? []).map((q, i) => (
                  <tr key={q.bond} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-white font-semibold">{q.bond}</td>
                    <td className="px-3 py-1.5 text-green-400">{fmt(q.bidYield)}%</td>
                    <td className="px-3 py-1.5 text-red-400">{fmt(q.offerYield)}%</td>
                    <td className="px-3 py-1.5 text-green-400">{fmt(q.bidPrice)}</td>
                    <td className="px-3 py-1.5 text-red-400">{fmt(q.offerPrice)}</td>
                    <td className="px-3 py-1.5 text-slate-300">{fmtM(q.bidSize)}</td>
                    <td className="px-3 py-1.5 text-slate-300">{fmtM(q.offerSize)}</td>
                    <td className="px-3 py-1.5 text-yellow-400">{fmt(q.spread, 1)}</td>
                    <td className="px-3 py-1.5 text-slate-500 text-xs">{new Date(q.lastTrade).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* TOMS Orders */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-slate-400">方向筛选:</span>
        <Select value={sideFilter} onValueChange={setSideFilter}>
          <SelectTrigger className="h-7 w-24 text-xs bg-slate-800 border-slate-600 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {["All", "Bid", "Offer"].map(s => (
              <SelectItem key={s} value={s} className="text-slate-200 text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/80">
              {["委托ID", "债券", "方向", "名义金额", "价格", "收益率", "价差(bps)", "DV01", "状态", "客户", "交易员"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                <td className="px-3 py-1.5 text-slate-300 font-mono">{o.id}</td>
                <td className="px-3 py-1.5 text-white font-semibold">{o.bond}</td>
                <td className={`px-3 py-1.5 font-semibold ${o.side === "Bid" ? "text-green-400" : "text-red-400"}`}>{o.side}</td>
                <td className="px-3 py-1.5 text-slate-300">{fmtM(o.notional)}</td>
                <td className="px-3 py-1.5 text-slate-300">{fmt(o.price)}</td>
                <td className="px-3 py-1.5 text-blue-400">{fmt(o.yield)}%</td>
                <td className={`px-3 py-1.5 ${o.spread > 0 ? "text-yellow-400" : "text-green-400"}`}>{fmt(o.spread, 1)}</td>
                <td className="px-3 py-1.5 text-orange-400">${fmt(o.dv01 / 1000, 1)}K</td>
                <td className="px-3 py-1.5"><StatusBadge status={o.status} /></td>
                <td className="px-3 py-1.5 text-slate-400">{o.client}</td>
                <td className="px-3 py-1.5 text-slate-400">{o.trader}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── BSKT Tab ──────────────────────────────────────────────────────────────

function BSKTTab() {
  const { data: basket } = trpc.orderManagement.getETFBasket.useQuery({});
  const { data: arbData } = trpc.orderManagement.getArbitrageMonitor.useQuery();
  const arb = arbData?.items ?? [];
  const [selectedETF, setSelectedETF] = useState("SPY");
  const [creationType, setCreationType] = useState<"Creation" | "Redemption">("Creation");
  const [units, setUnits] = useState(1);
  const submitMutation = trpc.orderManagement.submitETFOrder.useMutation({
    onSuccess: (result) => {
      toast.success(`ETF ${result.type} 委托已提交`, {
        description: `${result.orderId} — ${result.units} 创建单位 ${result.etf}，名义价值 ${fmtM(result.totalValue)}`,
      });
    },
  });

  return (
    <div className="space-y-4">
      {/* Basket Overview */}
      {basket && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "ETF 代码", value: basket.etfTicker, color: "text-white" },
            { label: "NAV/份额", value: `$${fmt(basket.navPerShare)}`, color: "text-blue-400" },
            { label: "市场价格", value: `$${fmt(basket.marketPrice)}`, color: (basket.premium ?? 0) > 0 ? "text-red-400" : "text-green-400" },
            { label: "溢折价", value: `${(basket.premium ?? 0) > 0 ? "+" : ""}${fmt(basket.premium, 3)}%`, color: (basket.premium ?? 0) > 0 ? "text-red-400" : "text-green-400" },
          ].map((c, i) => (
            <Card key={i} className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-3">
                <div className="text-xs text-slate-400 mb-1">{c.label}</div>
                <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basket Components */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300">一篮子成分股 — {basket?.etfTicker}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["代码", "权重", "股数", "价格", "市值"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(basket?.components ?? []).map((c, i) => (
                  <tr key={c.ticker} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-white font-semibold">{c.ticker}</td>
                    <td className="px-3 py-1.5 text-blue-400">{fmt(c.weight)}%</td>
                    <td className="px-3 py-1.5 text-slate-300">{c.shares.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-slate-300">${fmt(c.price)}</td>
                    <td className="px-3 py-1.5 text-slate-300">{fmtM(c.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Creation/Redemption Form */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300">创建/赎回委托</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-slate-400">ETF 代码</Label>
              <Select value={selectedETF} onValueChange={setSelectedETF}>
                <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {["SPY", "QQQ", "IWM", "EFA", "EEM", "GLD", "TLT", "HYG", "LQD", "VTI"].map(e => (
                    <SelectItem key={e} value={e} className="text-slate-200 text-xs">{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">操作类型</Label>
              <div className="flex gap-2 mt-1">
                {(["Creation", "Redemption"] as const).map(t => (
                  <Button
                    key={t}
                    size="sm"
                    variant={creationType === t ? "default" : "outline"}
                    className={`flex-1 text-xs h-8 ${creationType === t ? (t === "Creation" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700") : "border-slate-600 text-slate-300"}`}
                    onClick={() => setCreationType(t)}
                  >
                    {t === "Creation" ? "创建" : "赎回"}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">创建单位数量（1单位=50,000份）</Label>
              <Input
                type="number"
                value={units}
                onChange={e => setUnits(Number(e.target.value))}
                min={1}
                className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 mt-1"
              />
            </div>
            <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">总份额</span>
                <span className="text-white">{(units * 50000).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">预估NAV</span>
                <span className="text-blue-400">{fmtM(units * 50000 * (basket?.navPerShare ?? 485))}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">现金成分</span>
                <span className="text-yellow-400">${fmt(basket?.cashComponent ?? 12450, 0)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">预估手续费</span>
                <span className="text-slate-300">${fmt(units * 50000 * (basket?.navPerShare ?? 485) * 0.0003, 0)}</span>
              </div>
            </div>
            <Button
              className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700"
              onClick={() => submitMutation.mutate({ etf: selectedETF, type: creationType, units, inKind: true })}
              disabled={submitMutation.isPending}
            >
              <Send className="w-3 h-3 mr-1" /> 提交 {creationType === "Creation" ? "创建" : "赎回"} 委托
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Arbitrage Monitor */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm text-slate-300">套利监控 — 溢折价实时追踪</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["ETF", "NAV", "市价", "溢折价", "成交量", "均量", "价差", "套利信号", "预估收益"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(arb ?? []).map((a, i) => (
                  <tr key={a.etf} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-1.5 text-white font-semibold">{a.etf}</td>
                    <td className="px-3 py-1.5 text-slate-300">${fmt(a.nav)}</td>
                    <td className="px-3 py-1.5 text-slate-300">${fmt(a.marketPrice)}</td>
                    <td className={`px-3 py-1.5 font-semibold ${a.premium > 0 ? "text-red-400" : "text-green-400"}`}>
                      {a.premium > 0 ? "+" : ""}{fmt(a.premium, 3)}%
                    </td>
                    <td className="px-3 py-1.5 text-slate-400">{(a.volume / 1000).toFixed(0)}K</td>
                    <td className="px-3 py-1.5 text-slate-400">{(a.avgVolume / 1000).toFixed(0)}K</td>
                    <td className="px-3 py-1.5 text-slate-400">{fmt(a.spread, 3)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.arbitrageSignal === "Neutral" ? "text-slate-400" : a.arbitrageSignal === "Short ETF" ? "text-red-400 bg-red-500/10" : "text-green-400 bg-green-500/10"}`}>
                        {a.arbitrageSignal}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-yellow-400">{a.profitEstimate > 0 ? fmtM(a.profitEstimate) : "—"}</td>
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

// ─── BSKAAP Tab ────────────────────────────────────────────────────────────

function BSKAAPTab() {
  const { data: orderData, refetch } = trpc.orderManagement.getETFOrders.useQuery();
  const orders = orderData?.orders ?? [];

  const summary = {
    total: orders?.length ?? 0,
    creation: orders?.filter(o => o.type === "Creation").length ?? 0,
    redemption: orders?.filter(o => o.type === "Redemption").length ?? 0,
    totalValue: orders?.reduce((sum, o) => sum + o.totalValue, 0) ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "总委托", value: summary.total, color: "text-white" },
          { label: "创建委托", value: summary.creation, color: "text-green-400" },
          { label: "赎回委托", value: summary.redemption, color: "text-red-400" },
          { label: "总名义价值", value: fmtM(summary.totalValue), color: "text-blue-400" },
        ].map((c, i) => (
          <Card key={i} className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400 mb-1">{c.label}</div>
              <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 text-xs border-slate-600 text-slate-300">
          <RefreshCw className="w-3 h-3 mr-1" /> 刷新
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/80">
              {["委托ID", "ETF", "类型", "创建单位", "份额", "NAV/份", "总价值", "状态", "授权参与者", "结算日", "现金成分", "实物交换"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o, i) => (
              <tr key={o.id} className={`border-t border-slate-700/50 hover:bg-slate-700/30 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                <td className="px-3 py-1.5 text-slate-300 font-mono">{o.id}</td>
                <td className="px-3 py-1.5 text-white font-semibold">{o.etf}</td>
                <td className={`px-3 py-1.5 font-semibold ${o.type === "Creation" ? "text-green-400" : "text-red-400"}`}>{o.type}</td>
                <td className="px-3 py-1.5 text-slate-300">{o.units}</td>
                <td className="px-3 py-1.5 text-slate-300">{o.shares.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-blue-400">${fmt(o.navPerShare)}</td>
                <td className="px-3 py-1.5 text-slate-300">{fmtM(o.totalValue)}</td>
                <td className="px-3 py-1.5"><StatusBadge status={o.status} /></td>
                <td className="px-3 py-1.5 text-slate-400">{o.authorizedParticipant}</td>
                <td className="px-3 py-1.5 text-slate-400">{o.settlementDate}</td>
                <td className="px-3 py-1.5 text-yellow-400">${fmt(o.cashComponent, 0)}</td>
                <td className="px-3 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${o.inKind ? "text-green-400 bg-green-500/10" : "text-slate-400"}`}>
                    {o.inKind ? "实物" : "现金"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TSDM Tab ──────────────────────────────────────────────────────────────

function TSDMTab() {
  const { data, refetch } = trpc.orderManagement.getSystemStatus.useQuery();
  const testMutation = trpc.orderManagement.runConnectivityTest.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.venue} 连接测试成功`, {
          description: `延迟: ${result.latency == null ? "—" : `${result.latency.toFixed(2)}ms`}`,
        });
      } else {
        toast.error(`${result.venue} 连接测试失败`, {
          description: result.details,
        });
      }
    },
  });

  const systems = data?.systems ?? [];
  const connections = data?.connections ?? [];

  const onlineCount = systems.filter(s => s.status === "Online").length;

  return (
    <div className="space-y-4">
      {/* System Health Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "系统在线", value: `${onlineCount}/${systems.length}`, color: onlineCount === systems.length ? "text-green-400" : "text-yellow-400" },
          { label: "平均延迟", value: `${(systems.reduce((s, x) => s + x.latency, 0) / Math.max(1, systems.length)).toFixed(1)}ms`, color: "text-blue-400" },
          { label: "交易所连接", value: `${connections.filter(c => c.status === "Connected").length}/${connections.length}`, color: "text-purple-400" },
          { label: "总消息速率", value: `${connections.reduce((s, c) => s + c.msgRate, 0).toLocaleString()}/s`, color: "text-orange-400" },
        ].map((c, i) => (
          <Card key={i} className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-3">
              <div className="text-xs text-slate-400 mb-1">{c.label}</div>
              <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* System Status */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-slate-300">系统状态监控</CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-6 text-xs border-slate-600 text-slate-300">
              <RefreshCw className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["系统", "状态", "延迟", "可用率"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {systems.map((s, i) => (
                  <tr key={s.name} className={`border-t border-slate-700/50 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-2 text-slate-300">{s.name}</td>
                    <td className="px-3 py-2">
                      <span className={`flex items-center gap-1 text-xs ${s.status === "Online" ? "text-green-400" : s.status === "Standby" ? "text-yellow-400" : "text-red-400"}`}>
                        {s.status === "Online" ? <CheckCircle2 className="w-3 h-3" /> : s.status === "Standby" ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-blue-400">{s.latency.toFixed(1)}ms</td>
                    <td className="px-3 py-2 text-slate-300">{s.uptime.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Exchange Connections */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300">交易所连接测试</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80">
                  {["交易所", "协议", "状态", "消息/秒", "测试"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {connections.map((c, i) => (
                  <tr key={c.venue} className={`border-t border-slate-700/50 ${i % 2 === 0 ? "" : "bg-slate-800/20"}`}>
                    <td className="px-3 py-2 text-white font-semibold">{c.venue}</td>
                    <td className="px-3 py-2 text-slate-400">{c.protocol}</td>
                    <td className="px-3 py-2">
                      <span className={`flex items-center gap-1 text-xs ${c.status === "Connected" ? "text-green-400" : c.status === "Degraded" ? "text-yellow-400" : "text-red-400"}`}>
                        {c.status === "Connected" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-blue-400">{c.msgRate.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 text-xs border-slate-600 text-slate-300 px-2"
                        onClick={() => testMutation.mutate({ venue: c.venue })}
                        disabled={testMutation.isPending}
                      >
                        <Zap className="w-2.5 h-2.5 mr-1" /> 测试
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* FIX Message Activity */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm text-slate-300">FIX 消息活动 — 各交易所消息速率</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={connections}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="venue" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0" }} />
              <Bar dataKey="msgRate" name="消息/秒" fill="#3b82f6" radius={[4, 4, 0, 0]}
                label={{ position: "top", fill: "#94a3b8", fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
import TOMSOverviewPanel from "@/components/order-management/TOMSOverviewPanel";
import CKAPPanel from "@/components/order-management/CKAPPanel";
import AIMTOMSLinkPanel from "@/components/order-management/AIMTOMSLinkPanel";
import OrderTimelineReplay from "@/components/order-management/OrderTimelineReplay";
import { LedgerAIM, LedgerTOMS } from "@/components/live/LedgerLive";
import { BbsLive, BssLive, BsktLive } from "@/components/live/OmsLive2";
import { WorkflowLive } from "@/components/live/EmsxLive2";
import { PortVaRLive, IntegrationMonitorLive } from "@/components/live/PortOpsLive";
import { StpMIFI } from "@/components/live/STPLive2";
import { useSearch, useLocation } from "wouter";

const PANEL_TABS = [
  { value: "AIM",      label: "1) AIM 买方组合委托" },
  { value: "TOMS",     label: "2) TOMS 卖方委托簿" },
  { value: "BBS",      label: "3) BBS 买方概览" },
  { value: "BSS",      label: "4) BSS 卖方概览" },
  { value: "TWC",      label: "5) TWC 交易限额配置" },
  { value: "TOMS6",    label: "6) TOMS 总览与执行质量" },
  { value: "RISK",     label: "7) RISK 风险价值" },
  { value: "MIFI",     label: "8) MIFI 最佳执行" },
  { value: "EC",       label: "9) EC 接口与线路" },
  { value: "BSKT",     label: "10) BSKT ETF 跟踪偏离" },
  { value: "CKAP",     label: "11) CKAP 做市商" },
  { value: "AIMTOMS",  label: "12) AIM↔TOMS 联动总览" },
  { value: "REPLAY",   label: "13) 委托时间线回放" },
];

function renderPanel(panel: string) {
  switch (panel) {
    case "AIM":      return <LedgerAIM />;
    case "TOMS":     return <LedgerTOMS />;
    case "BBS":      return <BbsLive />;
    case "BSS":      return <BssLive />;
    case "TWC":      return <WorkflowLive />;
    case "TOMS6":    return <TOMSOverviewPanel />;
    case "RISK":     return <PortVaRLive />;
    case "MIFI":     return <StpMIFI />;
    case "EC":       return <IntegrationMonitorLive />;
    case "BSKT":     return <BsktLive />;
    case "CKAP":     return <CKAPPanel />;
    case "AIMTOMS":  return <AIMTOMSLinkPanel />;
    case "REPLAY":   return <OrderTimelineReplay />;
    default:         return <LedgerAIM />;
  }
}

export default function OrderManagement() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const urlPanel = params.get("panel") ?? "AIM";
  const [activeTab, setActiveTab] = useState(urlPanel);

  // Sync URL → tab when navigating from menu
  useEffect(() => {
    setActiveTab(urlPanel);
  }, [urlPanel]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setLocation(`/order-management?panel=${val}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">交易委托管理系统</h1>
            <p className="text-xs text-slate-400">平台模拟账户 · 委托与成交按实时行情撮合并永久入库</p>
          </div>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-auto">
        {renderPanel(activeTab)}
      </div>
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Activity, TrendingUp, TrendingDown, Zap, Globe, BarChart2 } from "lucide-react";

const COLORS = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444","#06b6d4","#f97316","#ec4899","#84cc16","#a78bfa"];
const QUERY_OPTIONS = { staleTime: 120_000, refetchInterval: 120_000, retry: false } as const;
const formatValue = (value: number | null | undefined, digits = 2) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
const percentChange = (rows: Array<{ value: number }> | undefined) => {
  if (!rows || rows.length < 2) return null;
  const current = rows.at(-1)!.value;
  const prior = rows.at(-2)!.value;
  return prior ? ((current - prior) / Math.abs(prior)) * 100 : null;
};
const latestValue = (rows: Array<{ value: number }> | null | undefined) => rows?.at(-1)?.value ?? null;

export default function CryptoMarket({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState("overview");
  const [selectedCoin, setSelectedCoin] = useState("BTC");
  const [selectedCoinId, setSelectedCoinId] = useState("bitcoin");
  const [priceDays, setPriceDays] = useState(90);

  const { data: overview } = trpc.crypto.getMarketOverview.useQuery(undefined, QUERY_OPTIONS);
  const { data: coins } = trpc.crypto.getCoinList.useQuery(undefined, QUERY_OPTIONS);
  const { data: priceHistory, isFetching: priceFetching } = trpc.crypto.getPriceHistory.useQuery(
    { symbol: selectedCoin, coinId: selectedCoinId, days: priceDays }, QUERY_OPTIONS,
  );
  const { data: dominance } = trpc.crypto.getDominanceHistory.useQuery({ days: 90 }, QUERY_OPTIONS);
  const { data: fearGreed } = trpc.crypto.getFearGreedHistory.useQuery({ days: 30 }, QUERY_OPTIONS);
  const { data: onChain } = trpc.crypto.getOnChainMetrics.useQuery({ symbol: selectedCoin }, QUERY_OPTIONS);
  const { data: defi } = trpc.crypto.getDefiMetrics.useQuery(undefined, QUERY_OPTIONS);
  const { data: exchanges } = trpc.crypto.getExchangeVolume.useQuery(undefined, QUERY_OPTIONS);
  const { data: liveTradeState } = trpc.crypto.getLiveTrade.useQuery(
    { coinId: selectedCoinId },
    {
      staleTime: 0,
      refetchInterval: 1_000,
      refetchIntervalInBackground: false,
      refetchOnReconnect: true,
      retry: false,
    },
  );
  const liveTrade = liveTradeState?.trade?.coinId === selectedCoinId ? liveTradeState.trade : null;

  const chartVolumes = new Map((priceHistory?.volumes ?? []).map(point => [point.date, point.volume]));
  const chartData = (priceHistory?.prices ?? []).map((p, i) => ({
    date: p.date,
    price: p.price,
    volume: chartVolumes.get(p.date) ?? null,
    ma7: priceHistory?.ma7[i]?.value,
    ma30: priceHistory?.ma30[i]?.value,
  }));

  const fearGreedColor = (val: number | null) => {
    if (val === null) return "#64748b";
    if (val >= 75) return "#10b981";
    if (val >= 55) return "#84cc16";
    if (val >= 45) return "#f59e0b";
    if (val >= 25) return "#f97316";
    return "#ef4444";
  };
  const fearGreedLabel = (val: number | null) => {
    if (val === null) return "未接入";
    if (val >= 75) return "极度贪婪";
    if (val >= 55) return "贪婪";
    if (val >= 45) return "中性";
    if (val >= 25) return "恐惧";
    return "极度恐惧";
  };

  const latestFG = fearGreed?.[fearGreed.length - 1]?.value ?? null;

  return (
    <div className={`${embedded ? "min-w-0" : "min-h-screen"} bg-slate-950 p-4 text-slate-100`} aria-label="加密货币市场数据">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 flex items-center gap-2">
            <Zap size={24} className="text-yellow-400" />
            加密货币市场
          </h1>
          <p className="text-slate-400 text-sm">公开行情观察 · 链上数据 · DeFi · 恐贪指数 · 市场主导</p>
          <p className="mt-1 text-xs text-cyan-200" aria-label="当前币种实际现货成交">
            {liveTrade
              ? `${liveTrade.pair} 实际成交 ${liveTrade.price.toLocaleString("en-US", { maximumFractionDigits: 8 })} USDT · ${new Date(liveTrade.observedAt).toLocaleString("zh-CN", { hour12: false })} · Binance 现货流（1 秒显示复查）`
              : `${selectedCoin} 实际现货成交：${liveTradeState?.limitation ?? "连接交易所中…"} `}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-green-400">
            <Activity size={12} className="animate-pulse" />
            每 2 分钟刷新
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-xs">总市值</div>
            <div className="text-slate-100 font-bold">{overview?.totalMarketCap}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-xs">24h成交量</div>
            <div className="text-slate-100 font-bold">{overview?.totalVolume24h}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-xs">BTC主导</div>
            <div className="text-yellow-400 font-bold">{overview?.btcDominance == null ? "—" : `${overview.btcDominance.toFixed(2)}%`}</div>
          </div>
        </div>
      </div>

      {/* 快速行情条 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {(coins ?? []).slice(0, 8).map(c => (
          <button type="button" key={c.id}
            className={`flex-shrink-0 bg-slate-900 border rounded px-3 py-2 min-w-[120px] cursor-pointer transition-colors ${
              selectedCoinId === c.id ? "border-yellow-500/60 bg-yellow-900/10" : "border-slate-700 hover:border-slate-600"
            }`}
            onClick={() => { setSelectedCoin(c.symbol); setSelectedCoinId(c.id); setTab("chart"); }}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-slate-400 text-xs">#{c.rank}</span>
              <span className="text-slate-200 font-bold text-sm">{c.symbol}</span>
            </div>
            <div className="text-slate-100 font-bold">{selectedCoinId === c.id && liveTrade
              ? `${liveTrade.price.toLocaleString("en-US", { maximumFractionDigits: 6 })} USDT`
              : c.price == null ? "—" : `$${c.price >= 1000 ? (c.price / 1000).toFixed(1) + "K" : c.price.toFixed(2)}`}</div>
            <div className="text-[10px] text-slate-500">{selectedCoinId === c.id && liveTrade
              ? `实时成交 · ${new Date(liveTrade.observedAt).toLocaleTimeString("zh-CN", { hour12: false })}`
              : `${c.observedAt ?? "时间未知"}`}</div>
            <div className={`text-xs font-semibold ${typeof c.changePct !== "number" ? "text-slate-500" : c.changePct >= 0 ? "text-[#f2495c]" : "text-[#1fbf75]"}`}>
              {typeof c.changePct === "number" ? `${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(2)}%` : "—"}
            </div>
          </button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-900 border border-slate-700 mb-4">
          <TabsTrigger value="overview" className="text-xs"><Globe size={12} className="mr-1" />市场概览</TabsTrigger>
          <TabsTrigger value="coins" className="text-xs"><BarChart2 size={12} className="mr-1" />币种列表</TabsTrigger>
          <TabsTrigger value="chart" className="text-xs"><Activity size={12} className="mr-1" />价格图表</TabsTrigger>
          <TabsTrigger value="dominance" className="text-xs">市场主导</TabsTrigger>
          <TabsTrigger value="feargreed" className="text-xs">恐贪指数</TabsTrigger>
          <TabsTrigger value="onchain" className="text-xs">链上数据</TabsTrigger>
          <TabsTrigger value="defi" className="text-xs">DeFi</TabsTrigger>
        </TabsList>

        {/* ─── 市场概览 ─── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "总市值", value: overview?.totalMarketCap ?? "—", color: "text-slate-100" },
              { label: "24h成交量", value: overview?.totalVolume24h ?? "—", color: "text-blue-400" },
              { label: "BTC主导率", value: overview?.btcDominance == null ? "—" : `${overview.btcDominance.toFixed(2)}%`, color: "text-yellow-400" },
              { label: "ETH主导率", value: overview?.ethDominance == null ? "—" : `${overview.ethDominance.toFixed(2)}%`, color: "text-purple-400" },
              { label: "活跃币种", value: overview?.activeCoins == null ? "—" : `${overview.activeCoins}`, color: "text-slate-100" },
              { label: "活跃交易所", value: overview?.exchanges == null ? "—" : `${overview.exchanges}`, color: "text-slate-100" },
              { label: "市场情绪", value: fearGreedLabel(latestFG), color: fearGreedColor(latestFG) },
              { label: "恐贪指数", value: latestFG === null ? "—" : String(latestFG), color: fearGreedColor(latestFG) },
            ].map(m => (
              <Card key={m.label} className="bg-slate-900 border-slate-700 p-3">
                <div className="text-slate-400 text-xs mb-1">{m.label}</div>
                <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
              </Card>
            ))}
          </div>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">交易所24h成交量（BTC）</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={exchanges ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={80} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                <Bar dataKey="volume24h" name="24h成交量(BTC)" radius={[0, 3, 3, 0]}>
                  {(exchanges ?? []).map((_e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        {/* ─── 币种列表 ─── */}
        <TabsContent value="coins">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["#","代码","名称","价格","1h%","24h%","7d%","市值","24h量","流通量","ATH","ATH跌幅"].map(h => (
                      <th key={h} className="text-right py-2 px-1.5 text-slate-400 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(coins ?? []).map(c => (
                    <tr key={c.id}
                      className={`border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer ${selectedCoinId === c.id ? "bg-yellow-900/10" : ""}`}
                      onClick={() => { setSelectedCoin(c.symbol); setSelectedCoinId(c.id); setTab("chart"); }}>
                      <td className="py-2 px-1.5 text-slate-500">{c.rank}</td>
                      <td className="py-2 px-1.5 text-yellow-400 font-bold">{c.symbol}</td>
                      <td className="py-2 px-1.5 text-slate-200">{c.name}</td>
                      <td className="py-2 px-1.5 text-right text-slate-100 font-semibold">
                        {c.price == null ? "—" : `$${c.price >= 1000 ? c.price.toLocaleString() : c.price.toFixed(4)}`}
                        <span className="block text-[10px] font-normal text-slate-500">{c.observedAt ?? "时间未知"}</span>
                      </td>
                      {[c.change1h, c.changePct, c.change7d].map((v, i) => (
                        <td key={i} className={`py-2 px-1.5 text-right font-semibold ${typeof v !== "number" ? "text-slate-500" : v >= 0 ? "text-[#f2495c]" : "text-[#1fbf75]"}`}>
                          {typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—"}
                        </td>
                      ))}
                      <td className="py-2 px-1.5 text-right text-slate-300">{c.mktCap}</td>
                      <td className="py-2 px-1.5 text-right text-slate-300">{c.volume24h}</td>
                      <td className="py-2 px-1.5 text-right text-slate-400">{c.circulatingSupply}</td>
                      <td className="py-2 px-1.5 text-right text-[#f2495c]">{c.ath == null ? "—" : `$${c.ath >= 1000 ? c.ath.toLocaleString() : c.ath.toFixed(2)}`}</td>
                      <td className="py-2 px-1.5 text-right text-[#1fbf75]">{c.athDropPct == null ? "—" : `${c.athDropPct.toFixed(1)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ─── 价格图表 ─── */}
        <TabsContent value="chart">
          <div className="flex items-center gap-3 mb-3">
            <Select value={selectedCoinId} onValueChange={id => {
              const coin = coins?.find(item => item.id === id);
              if (coin) { setSelectedCoin(coin.symbol); setSelectedCoinId(coin.id); }
            }}>
              <SelectTrigger className="w-56 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {(coins ?? []).map(coin => (
                  <SelectItem key={coin.id} value={coin.id}>{coin.symbol} · {coin.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {[30, 60, 90, 180, 365].map(d => (
              <button key={d} onClick={() => setPriceDays(d)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  priceDays === d ? "border-yellow-500 bg-yellow-500/20 text-yellow-300" : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500"
                }`}>
                {d === 365 ? "1Y" : `${d}D`}
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs text-slate-400">
            {priceFetching ? "正在核验该币种独立历史…" : chartData.length
              ? `最近观察 ${priceHistory?.observedAt ?? "未知"} · ${chartData.length} 个不同观察日`
              : "该币种暂无可核验的历史曲线"}
            {priceHistory?.limitation ? `；${priceHistory.limitation}` : ""}
            {liveTrade ? `；当前 ${liveTrade.pair} 成交 ${liveTrade.price.toLocaleString("en-US", { maximumFractionDigits: 8 })} USDT，逐笔源与下方 USD 日频历史分别展示` : ""}
          </p>
          <div className="grid grid-cols-1 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">{selectedCoin} 价格 + MA7/MA30</h3>
              {chartData.length >= 2 ? <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="price" stroke="#f59e0b" fill="url(#priceGrad)" strokeWidth={2} dot={false} name={selectedCoin} />
                  <Line type="monotone" dataKey="ma7" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MA7" />
                  <Line type="monotone" dataKey="ma30" stroke="#10b981" strokeWidth={1.5} dot={false} name="MA30" />
                </ComposedChart>
              </ResponsiveContainer> : <p className="py-10 text-center text-xs text-amber-300">独立历史观察不足，不生成价格曲线或均线。</p>}
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">{selectedCoin} 成交量</h3>
              {chartData.some(point => point.volume !== null) ? <ResponsiveContainer width="100%" height={130}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Bar dataKey="volume" name="成交量" fill="#3b82f6" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer> : <p className="py-10 text-center text-xs text-amber-300">该历史未返回成交量，不以零值填充。</p>}
            </Card>
          </div>
        </TabsContent>

        {/* ─── 市场主导 ─── */}
        <TabsContent value="dominance">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">BTC/ETH 市场主导率（90天）</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dominance ?? []}>
                <defs>
                  <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ethGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="othGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={14} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="btc" stroke="#f59e0b" fill="url(#btcGrad)" strokeWidth={2} name="BTC" />
                <Area type="monotone" dataKey="eth" stroke="#8b5cf6" fill="url(#ethGrad)" strokeWidth={2} name="ETH" />
                <Area type="monotone" dataKey="others" stroke="#06b6d4" fill="url(#othGrad)" strokeWidth={2} name="其他" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        {/* ─── 恐贪指数 ─── */}
        <TabsContent value="feargreed">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-6 flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">当前恐贪指数</h3>
              <div className="relative w-36 h-36 mb-3">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={fearGreedColor(latestFG)}
                    strokeWidth="3" strokeDasharray={`${latestFG} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl font-bold" style={{ color: fearGreedColor(latestFG) }}>{latestFG ?? "—"}</div>
                  <div className="text-xs text-slate-400">{fearGreedLabel(latestFG)}</div>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                {[
                  { label: "极度恐惧", color: "#ef4444", range: "0-24" },
                  { label: "恐惧", color: "#f97316", range: "25-44" },
                  { label: "中性", color: "#f59e0b", range: "45-54" },
                  { label: "贪婪", color: "#84cc16", range: "55-74" },
                  { label: "极度贪婪", color: "#10b981", range: "75-100" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-slate-400">{l.range}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4 md:col-span-2">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">恐贪指数历史（30天）</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={fearGreed ?? []}>
                  <defs>
                    <linearGradient id="fgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={4} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 4" label={{ value: "极度贪婪", fill: "#10b981", fontSize: 9 }} />
                  <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "极度恐惧", fill: "#ef4444", fontSize: 9 }} />
                  <Area type="monotone" dataKey="value" stroke="#f59e0b" fill="url(#fgGrad)" strokeWidth={2} name="恐贪指数" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        {/* ─── 链上数据 ─── */}
        <TabsContent value="onchain">
          <div className="flex items-center gap-3 mb-3">
            <Select value={selectedCoin} onValueChange={setSelectedCoin}>
              <SelectTrigger className="w-28 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {["BTC","ETH","SOL","BNB"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {([
              { name: "活跃地址数", value: latestValue(onChain?.activeAddresses)?.toLocaleString() ?? "—", change: percentChange(onChain?.activeAddresses) },
              { name: "交易笔数", value: latestValue(onChain?.transactionCount)?.toLocaleString() ?? "—", change: percentChange(onChain?.transactionCount) },
              { name: "哈希率(EH/s)", value: latestValue(onChain?.hashRate)?.toFixed(0) ?? "—", change: percentChange(onChain?.hashRate ?? undefined) },
              { name: "交易所净流入", value: latestValue(onChain?.exchangeNetflow)?.toLocaleString() ?? "—", change: percentChange(onChain?.exchangeNetflow) },
            ] as { name: string; value: string; change: number | null }[]).map(m => (
              <Card key={m.name} className="bg-slate-900 border-slate-700 p-3">
                <div className="text-slate-400 text-xs mb-1">{m.name}</div>
                <div className="text-lg font-bold text-slate-100">{m.value}</div>
                <div className={`text-xs ${m.change == null ? "text-slate-500" : m.change >= 0 ? "text-[#f2495c]" : "text-[#1fbf75]"}`}>
                  {m.change == null ? "未接入可验证变化" : `${m.change >= 0 ? "+" : ""}${m.change.toFixed(2)}% 相邻观察`}
                </div>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">活跃地址数（30天）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={onChain?.activeAddresses ?? []}>
                  <defs>
                    <linearGradient id="addrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={6} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                    formatter={(v: number) => [v?.toLocaleString(), '活跃地址']} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#addrGrad)" strokeWidth={2} name="活跃地址" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">交易笔数（30天）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={onChain?.transactionCount ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={6} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                    formatter={(v: number) => [v?.toLocaleString(), '交易笔数']} />
                  <Bar dataKey="value" name="交易笔数" fill="#3b82f6" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            {onChain?.hashRate && (
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">哈希率（EH/s）30天）</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={onChain.hashRate}>
                    <defs>
                      <linearGradient id="hashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={6} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                      formatter={(v: number) => [`${v?.toFixed(0)} EH/s`, '哈希率']} />
                    <Area type="monotone" dataKey="value" stroke="#f59e0b" fill="url(#hashGrad)" strokeWidth={2} name="哈希率" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">交易所净流入（30天）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={onChain?.exchangeNetflow ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={6} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                    formatter={(v: number) => [v?.toLocaleString(), '净流入']} />
                  <ReferenceLine y={0} stroke="#6b7280" />
                  <Bar dataKey="value" name="净流入">
                    {((onChain?.exchangeNetflow ?? []) as Array<{ value: number }>).map((d, i) => (
                      <Cell key={i} fill={d.value >= 0 ? "#ef4444" : "#10b981"} opacity={0.8} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        {/* ─── DeFi ─── */}
        <TabsContent value="defi">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-slate-900 border-slate-700 p-3">
              <div className="text-slate-400 text-xs mb-1">总锁仓量(TVL)</div>
              <div className="text-xl font-bold text-blue-400">{defi?.totalTvl == null ? "—" : `$${(defi.totalTvl / 1e9).toFixed(2)}B`}</div>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-3">
              <div className="text-slate-400 text-xs mb-1">24h DEX成交量</div>
              <div className="text-xl font-bold text-green-400">{defi?.dexVolume24h}</div>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-3">
              <div className="text-slate-400 text-xs mb-1">活跃协议数</div>
              <div className="text-xl font-bold text-slate-100">{defi?.activeProtocols}</div>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-3">
              <div className="text-slate-400 text-xs mb-1">稳定币总市值</div>
              <div className="text-xl font-bold text-yellow-400">{defi?.stablecoinMktCap}</div>
            </Card>
          </div>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">DeFi 协议 TVL 排行</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["#","协议","链","TVL","24h变化","7d变化","类别","代币"].map(h => (
                      <th key={h} className="text-right py-2 px-2 text-slate-400 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(defi?.protocols ?? []).map((p, i) => (
                    <tr key={p.name} className="border-b border-slate-800 hover:bg-slate-800/40">
                      <td className="py-2 px-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 px-2 text-slate-200 font-medium">{p.name}</td>
                      <td className="py-2 px-2 text-right text-slate-400">{p.chain}</td>
                      <td className="py-2 px-2 text-right text-slate-100 font-bold">${(p.tvl / 1e9).toFixed(2)}B</td>
                      <td className={`py-2 px-2 text-right font-semibold ${typeof p.change24h !== "number" ? "text-slate-500" : p.change24h >= 0 ? "text-[#f2495c]" : "text-[#1fbf75]"}`}>
                        {typeof p.change24h === "number" ? `${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(2)}%` : "—"}
                      </td>
                      <td className={`py-2 px-2 text-right font-semibold ${typeof p.change7d !== "number" ? "text-slate-500" : p.change7d >= 0 ? "text-[#f2495c]" : "text-[#1fbf75]"}`}>
                        {typeof p.change7d === "number" ? `${p.change7d >= 0 ? "+" : ""}${p.change7d.toFixed(2)}%` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Badge variant="outline" className="text-[9px] border-blue-500/50 text-blue-400">{p.category}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right text-yellow-400 font-bold">{p.token}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useMemo } from "react";
import { AdvancedFilterBar, SortableTh } from '@/components/AdvancedFilterBar';
import { useTableSort, buildInitialFilterState } from '@/components/filterUtils';
import type { FilterBarConfig, FilterState } from '@/components/filterUtils';
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Search, Activity, BarChart2, Globe, ArrowUpDown } from "lucide-react";
import OpenBBModuleDataBand from "@/components/OpenBBModuleDataBand";

const SECTORS = ["全部", "科技", "金融", "医疗", "消费", "工业", "能源", "公用事业", "材料", "房地产", "通信", "半导体"];
const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#84cc16","#a78bfa","#fb7185"];
const NCEO_MODEL_SYMBOLS = new Set(['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'AAPL', 'TSLA', 'NVDA']);

function downloadNceoCoverage(rows: Array<{ symbol: string; name: string; price: number; changePct: number }>) {
  const lines = [['symbol', 'name', 'stock_price_basis', 'change_pct', 'nceo_status', 'boundary'], ...rows.map((row) => [row.symbol, row.name, String(row.price), String(row.changePct), NCEO_MODEL_SYMBOLS.has(row.symbol) ? 'model_coverage' : 'no_model_coverage', 'simulation_model_only_not_executable'])];
  const blob = new Blob([lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `nceo-stock-screen-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}

// ─── 股票筛选配置 ─────────────────────────────────────────────────────────────
const EQUITY_FILTER_CONFIG: FilterBarConfig = {
  searchPlaceholder: '搜索代码或名称...',
  selects: [
    {
      key: 'sector',
      label: '板块',
      width: 'w-28',
      options: SECTORS.filter(s => s !== '全部').map(s => ({ value: s, label: s })),
    },
    {
      key: 'signal',
      label: '信号',
      width: 'w-24',
      options: [
        { value: 'buy',  label: '🟢 买入' },
        { value: 'sell', label: '🔴 卖出' },
        { value: 'hold', label: '🟡 持有' },
      ],
    },
  ],
  ranges: [
    { key: 'price',     label: '股价 ($)',      min: 0,    max: 1000, step: 10,  unit: '$' },
    { key: 'changePct', label: '涨跌幅 (%)',    min: -15,  max: 15,   step: 0.5, unit: '%' },
    { key: 'pe',        label: 'P/E 市盈率',    min: 0,    max: 200,  step: 5,   unit: 'x' },
    { key: 'beta',      label: 'Beta 系数',     min: 0,    max: 3,    step: 0.1, unit: '' },
  ],
};

function SectorHeatCell({ name, returnVal, weight }: { name: string; returnVal: number | null; weight: number | null }) {
  const intensity = returnVal === null ? 0 : Math.min(Math.abs(returnVal) / 5, 1);
  const bg = returnVal === null
    ? 'rgba(71,85,105,0.25)'
    : returnVal >= 0
      ? `rgba(16,185,129,${0.15 + intensity * 0.7})`
      : `rgba(239,68,68,${0.15 + intensity * 0.7})`;
  return (
    <div className="rounded p-3 flex flex-col justify-between hover:opacity-90 transition-opacity"
      style={{ backgroundColor: bg, minHeight: `${Math.max(60, (weight ?? 10) * 6)}px` }}>
      <div className="text-xs font-bold text-white">{name}</div>
      <div className={`text-lg font-bold ${returnVal !== null && returnVal >= 0 ? "text-green-300" : "text-red-300"}`}>
        {returnVal === null ? "—" : `${returnVal >= 0 ? "+" : ""}${returnVal.toFixed(2)}%`}
      </div>
      <div className="text-[10px] text-white/60">{weight === null ? "权重未接入" : `${weight.toFixed(1)}%权重`}</div>
    </div>
  );
}

export default function EquityMarket() {
  const [, navigate] = useLocation();
  // Read code param from BSRCH deep-link
  const urlCode = new URLSearchParams(window.location.search).get('code');
  const [tab, setTab] = useState(urlCode ? "chart" : "overview");
  const [sector, setSector] = useState("全部");
  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState(urlCode || "AAPL");
  const [candleDays, setCandleDays] = useState(90);

  const { data: overview } = trpc.equity.getMarketOverview.useQuery();
  const { data: stocks } = trpc.equity.getStockList.useQuery({ sector: sector === "全部" ? undefined : sector, search: search || undefined });
  const { data: detail } = trpc.equity.getStockDetail.useQuery({ symbol: selectedSymbol });
  const { data: candles } = trpc.equity.getCandlestickData.useQuery({ symbol: selectedSymbol, days: candleDays });
  const { data: sectors } = trpc.equity.getSectorHeatmap.useQuery();
  const { data: movers } = trpc.equity.getTopMovers.useQuery();
  const { data: moneyFlow } = trpc.equity.getMoneyFlow.useQuery({ symbol: selectedSymbol });

  // Merge candle + MA + Bollinger data
  const chartData = (candles?.candles ?? []).map((c, i) => ({
    ...c,
    ma5: candles?.ma5[i]?.value,
    ma20: candles?.ma20[i]?.value,
    ma60: candles?.ma60[i]?.value,
    bbUpper: candles?.bollinger?.[i]?.upper,
    bbMiddle: candles?.bollinger?.[i]?.middle,
    bbLower: candles?.bollinger?.[i]?.lower,
  }));
  const macdData = (candles?.macd ?? []).filter(d => d.macd !== null);
  const [showIndicator, setShowIndicator] = useState<'rsi' | 'macd' | 'bollinger'>('rsi');
  const [nceoExpiryDays, setNceoExpiryDays] = useState(30);
  const [nceoLeg, setNceoLeg] = useState<'call' | 'put'>('call');
  const [onlyNceoCoverage, setOnlyNceoCoverage] = useState(false);
  const nceoChain = trpc.futuresOptions.getOptionChain.useQuery({ symbol: selectedSymbol, expiryDays: nceoExpiryDays }, { retry: false });
  const nceoAtm = nceoChain.data?.chain[Math.floor((nceoChain.data?.chain.length ?? 0) / 2)];
  const nceoHistory = trpc.futuresOptions.getContractIVHistory.useQuery({
    symbol: selectedSymbol,
    strike: nceoAtm?.strike ?? 1,
    expiryDays: nceoExpiryDays,
    isCall: nceoLeg === 'call',
  }, { enabled: Boolean(nceoAtm), retry: false });
  const nceoBid = nceoLeg === 'call' ? nceoAtm?.callBid : nceoAtm?.putBid;
  const nceoAsk = nceoLeg === 'call' ? nceoAtm?.callAsk : nceoAtm?.putAsk;
  const nceoIv = nceoLeg === 'call' ? nceoAtm?.callIV : nceoAtm?.putIV;
  const nceoDelta = nceoLeg === 'call' ? nceoAtm?.callDelta : nceoAtm?.putDelta;
  const nceoSpread = nceoBid != null && nceoAsk != null ? Math.max(0, nceoAsk - nceoBid) : null;
  const nceoShortOpen = Boolean(nceoAtm && nceoExpiryDays > 7 && nceoSpread != null && nceoSpread <= Math.max(0.5, (nceoLeg === 'call' ? nceoAtm.callLast : nceoAtm.putLast) * 0.15));

  // 多条件筛选和列排序
  const [eqFilter, setEqFilter] = useState<FilterState>(() => buildInitialFilterState(EQUITY_FILTER_CONFIG));
  const { sort: eqSort, handleSort: handleEqSort } = useTableSort<'price' | 'changePct' | 'pe' | 'beta' | 'high52w' | 'low52w' | 'eps' | 'dividend'>('changePct', 'desc');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 flex items-center gap-2">
            <BarChart2 size={24} className="text-blue-400" />
            股票市场
          </h1>
          <p className="text-slate-400 text-sm">全球股票行情 · 板块分析 · 资金流向 · 技术指标</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Activity size={12} />
          {overview?.freshness ?? '正在读取行情'}{overview?.observedAt ? ` · ${overview.observedAt}` : ''}
        </div>
      </div>

      <OpenBBModuleDataBand path="/equity-market" title="股票市场已核验数据" />

      {/* 指数概览条 */}
      <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
        {(overview?.indices ?? []).map(idx => (
          <div key={idx.name} className="flex-shrink-0 bg-slate-900 border border-slate-700 rounded px-3 py-2 min-w-[130px]">
            <div className="text-slate-400 text-xs">{idx.name}</div>
            <div className="text-slate-100 font-bold">{idx.value.toLocaleString()}</div>
            <div className={`text-xs font-semibold ${idx.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {idx.changePct >= 0 ? "+" : ""}{idx.changePct.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-900 border border-slate-700 mb-4">
          <TabsTrigger value="overview" className="text-xs"><Globe size={12} className="mr-1" />市场概览</TabsTrigger>
          <TabsTrigger value="stocks" className="text-xs"><Search size={12} className="mr-1" />股票列表</TabsTrigger>
          <TabsTrigger value="chart" className="text-xs"><Activity size={12} className="mr-1" />行情图表</TabsTrigger>
          <TabsTrigger value="sector" className="text-xs">板块热力图</TabsTrigger>
          <TabsTrigger value="movers" className="text-xs">涨跌榜</TabsTrigger>
          <TabsTrigger value="flow" className="text-xs">资金流向</TabsTrigger>
        </TabsList>

        {/* ─── 市场概览 ─── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">市场宽度</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">上涨 {overview?.breadth.advancing}</span>
                  <span className="text-slate-400">平盘 {overview?.breadth.unchanged}</span>
                  <span className="text-red-400">下跌 {overview?.breadth.declining}</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="bg-green-500 h-full transition-all" style={{ width: `${(overview?.breadth.advancing ?? 0) / ((overview?.breadth.advancing ?? 0) + (overview?.breadth.declining ?? 0) + (overview?.breadth.unchanged ?? 0)) * 100}%` }} />
                  <div className="bg-slate-500 h-full" style={{ width: `${(overview?.breadth.unchanged ?? 0) / ((overview?.breadth.advancing ?? 0) + (overview?.breadth.declining ?? 0) + (overview?.breadth.unchanged ?? 0)) * 100}%` }} />
                  <div className="bg-red-500 h-full flex-1" />
                </div>
                <div className="text-xs text-slate-400">涨跌比: <span className="text-slate-200 font-semibold">{overview?.breadth.advanceDeclineRatio.toFixed(2)}</span></div>
              </div>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">市场情绪</h3>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={
                      (overview?.sentiment.bullish ?? 0) > 50 ? "#10b981" : "#ef4444"
                    } strokeWidth="3" strokeDasharray={`${overview?.sentiment.bullish ?? 0} 100`} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-100">
                    {overview?.sentiment.bullish}%
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex gap-2"><span className="text-green-400">● 看多</span><span className="text-slate-200">{overview?.sentiment.bullish}%</span></div>
                  <div className="flex gap-2"><span className="text-red-400">● 看空</span><span className="text-slate-200">{overview?.sentiment.bearish}%</span></div>
                  <div className="flex gap-2"><span className="text-slate-400">● 中性</span><span className="text-slate-200">{overview?.sentiment.neutral}%</span></div>
                </div>
              </div>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">成交量</h3>
              <div className="text-3xl font-bold text-slate-100 mb-1">{overview?.volume.total}</div>
              <div className="text-xs text-slate-400">相对20日均量: <span className={`font-semibold ${(overview?.volume.above20dAvg ?? 0) > 1 ? "text-green-400" : "text-red-400"}`}>
                {overview?.volume.above20dAvg == null ? '—' : `${(overview.volume.above20dAvg * 100).toFixed(0)}%`}
              </span></div>
            </Card>
          </div>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">板块表现</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sectors ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(2)}%`]} />
                <ReferenceLine x={0} stroke="#6b7280" />
                <Bar dataKey="return1d" name="今日涨跌" radius={[0, 3, 3, 0]}>
                  {(sectors ?? []).map((entry, i) => (
                    <Cell key={i} fill={entry.return1d !== null && entry.return1d >= 0 ? "#10b981" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        {/* ─── 股票列表 ─── */}
        <TabsContent value="stocks">
          {/* 多条件筛选栏 */}
          <div className="mb-3">
            <AdvancedFilterBar
              config={EQUITY_FILTER_CONFIG}
              state={eqFilter}
              onChange={setEqFilter}
            />
          </div>
          <Card className="bg-slate-900 border-slate-700 p-4">
            {(() => {
              const raw = (stocks ?? []).filter((stock) => !onlyNceoCoverage || NCEO_MODEL_SYMBOLS.has(stock.symbol));
              const { search: qs, selects, ranges } = eqFilter;
              const filtered = raw.filter(s => {
                if (qs.trim()) {
                  const k = qs.toLowerCase();
                  if (!s.symbol.toLowerCase().includes(k) && !s.name.toLowerCase().includes(k)) return false;
                }
                if (selects.sector && selects.sector !== 'All' && s.sector !== selects.sector) return false;
                if (selects.signal && selects.signal !== 'All') {
                  const sig = s.changePct > 1 ? 'buy' : s.changePct < -1 ? 'sell' : 'hold';
                  if (sig !== selects.signal) return false;
                }
                if (ranges.price) { const [lo, hi] = ranges.price; if (s.price < lo || s.price > hi) return false; }
                if (ranges.changePct) { const [lo, hi] = ranges.changePct; if (s.changePct < lo || s.changePct > hi) return false; }
                if (ranges.pe) { const [lo, hi] = ranges.pe; if (s.pe < lo || s.pe > hi) return false; }
                if (ranges.beta) { const [lo, hi] = ranges.beta; if (s.beta < lo || s.beta > hi) return false; }
                return true;
              }).sort((a, b) => {
                let va: number, vb: number;
                switch (eqSort.field) {
                  case 'price':     va = a.price;     vb = b.price;     break;
                  case 'changePct': va = a.changePct; vb = b.changePct; break;
                  case 'pe':        va = a.pe;        vb = b.pe;        break;
                  case 'beta':      va = a.beta;      vb = b.beta;      break;
                  case 'high52w':   va = a.high52w;   vb = b.high52w;   break;
                  case 'low52w':    va = a.low52w;    vb = b.low52w;    break;
                  case 'eps':       va = a.eps;       vb = b.eps;       break;
                  case 'dividend':  va = a.dividend;  vb = b.dividend;  break;
                  default:          va = a.changePct; vb = b.changePct;
                }
                return eqSort.dir === 'desc' ? vb - va : va - vb;
              });
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">显示 <span className="text-slate-300 font-semibold">{filtered.length}</span> / {raw.length} 只股票</span><button type="button" onClick={() => setOnlyNceoCoverage((value) => !value)} className={`rounded border px-2 py-1 text-[10px] ${onlyNceoCoverage ? 'border-violet-500 bg-violet-950/50 text-violet-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>{onlyNceoCoverage ? '仅 NCEO 模型覆盖：开' : '仅 NCEO 模型覆盖：关'}</button><button type="button" onClick={() => downloadNceoCoverage(filtered)} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-violet-600 hover:text-violet-200">导出 NCEO 覆盖清单</button></div>
                    <span className="text-[10px] text-slate-600">点击行查看图表及 NCEO 模拟联动</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 px-1.5 text-slate-400">代码</th>
                          <th className="text-left py-2 px-1.5 text-slate-400">名称</th>
                          <th className="text-left py-2 px-1.5 text-slate-400">板块</th>
                          <SortableTh field="price" label="价格" sort={eqSort} onSort={handleEqSort} />
                          <th className="text-right py-2 px-1.5 text-slate-400">涨跌</th>
                          <SortableTh field="changePct" label="涨跌%" sort={eqSort} onSort={handleEqSort} />
                          <th className="text-right py-2 px-1.5 text-slate-400">成交量</th>
                          <th className="text-right py-2 px-1.5 text-slate-400">市值</th>
                          <SortableTh field="pe" label="PE" sort={eqSort} onSort={handleEqSort} />
                          <SortableTh field="eps" label="EPS" sort={eqSort} onSort={handleEqSort} />
                          <SortableTh field="dividend" label="股息" sort={eqSort} onSort={handleEqSort} />
                          <SortableTh field="beta" label="Beta" sort={eqSort} onSort={handleEqSort} />
                          <SortableTh field="high52w" label="52W高" sort={eqSort} onSort={handleEqSort} />
                          <SortableTh field="low52w" label="52W低" sort={eqSort} onSort={handleEqSort} />
                          <th className="text-center py-2 px-1.5 text-slate-400">评级</th>
                          <th className="text-center py-2 px-1.5 text-slate-400">NCEO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(s => (
                          <tr key={s.symbol}
                            className={`border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors ${
                              selectedSymbol === s.symbol ? "bg-blue-900/20" : ""
                            }`}
                            onClick={() => { setSelectedSymbol(s.symbol); setTab("chart"); }}>
                            <td className="py-2 px-1.5 text-blue-400 font-bold">{s.symbol}</td>
                            <td className="py-2 px-1.5 text-slate-200">{s.name}</td>
                            <td className="py-2 px-1.5 text-slate-400">{s.sector}</td>
                            <td className="py-2 px-1.5 text-right text-slate-100 font-semibold">${s.price.toFixed(2)}</td>
                            <td className={`py-2 px-1.5 text-right font-semibold ${
                              s.change >= 0 ? "text-green-400" : "text-red-400"
                            }`}>{s.change >= 0 ? "+" : ""}{s.change.toFixed(2)}</td>
                            <td className={`py-2 px-1.5 text-right font-bold ${
                              s.changePct >= 0 ? "text-green-400" : "text-red-400"
                            }`}>{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%</td>
                            <td className="py-2 px-1.5 text-right text-slate-300">{s.volume}</td>
                            <td className="py-2 px-1.5 text-right text-slate-300">{s.mktCap}</td>
                            <td className="py-2 px-1.5 text-right text-slate-300">{s.pe.toFixed(1)}</td>
                            <td className="py-2 px-1.5 text-right text-slate-300">${s.eps.toFixed(2)}</td>
                            <td className="py-2 px-1.5 text-right text-slate-300">{s.dividend > 0 ? `$${s.dividend.toFixed(2)}` : "—"}</td>
                            <td className="py-2 px-1.5 text-right text-slate-300">{s.beta.toFixed(2)}</td>
                            <td className="py-2 px-1.5 text-right text-green-400">${s.high52w.toFixed(2)}</td>
                            <td className="py-2 px-1.5 text-right text-red-400">${s.low52w.toFixed(2)}</td>
                            <td className="py-2 px-1.5 text-center">
                              <Badge variant="outline" className={`text-[9px] ${
                                s.changePct > 1 ? "border-green-500 text-green-400" :
                                s.changePct < -1 ? "border-red-500 text-red-400" :
                                "border-slate-500 text-slate-400"
                              }`}>
                                {s.changePct > 1 ? "买入" : s.changePct < -1 ? "卖出" : "持有"}
                              </Badge>
                            </td>
                            <td className="py-2 px-1.5 text-center"><Badge variant="outline" className={`text-[9px] ${NCEO_MODEL_SYMBOLS.has(s.symbol) ? 'border-violet-500/70 text-violet-300' : 'border-slate-600 text-slate-500'}`}>{NCEO_MODEL_SYMBOLS.has(s.symbol) ? '模型覆盖' : '无模型覆盖'}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </Card>
        </TabsContent>

        {/* ─── 行情图表 ─── */}
        <TabsContent value="chart">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="w-32 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","JPM","JNJ","V"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              {[30, 60, 90, 180].map(d => (
                <button key={d} onClick={() => setCandleDays(d)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    candleDays === d ? "border-blue-500 bg-blue-500/20 text-blue-300" : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500"
                  }`}>
                  {d}天
                </button>
              ))}
            </div>
            <div className="flex gap-1 ml-2">
              {(["rsi", "macd", "bollinger"] as const).map(ind => (
                <button key={ind} onClick={() => setShowIndicator(ind)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    showIndicator === ind ? "border-amber-500 bg-amber-500/20 text-amber-300" : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500"
                  }`}>
                  {ind === 'rsi' ? 'RSI' : ind === 'macd' ? 'MACD' : '布林带'}
                </button>
              ))}
            </div>
            {detail && (
              <div className="flex gap-3 text-xs ml-auto">
                <span className="text-slate-400">市值: <span className="text-slate-200">{detail.mktCap}</span></span>
                <span className="text-slate-400">PE: <span className="text-slate-200">{detail.pe?.toFixed(1) ?? '—'}</span></span>
                <span className="text-slate-400">目标价: <span className="text-green-400">—</span></span>
                <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-400">{detail.analystRating}</Badge>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {/* 价格 + 均线 / 布林带 */}
            <Card className="bg-slate-900 border-slate-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-200">{selectedSymbol} 价格走势</h3>
                <div className="flex gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block" />MA5</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block" />MA20</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-400 inline-block" />MA60</span>
                  {showIndicator === 'bollinger' && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block" />布林带</span>}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                    formatter={(val: number, name: string) => [val?.toFixed(2), name]} />
                  <Bar dataKey="close" name="收盘价" fill="#3b82f6" opacity={0.5} />
                  <Line type="monotone" dataKey="ma5" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA5" />
                  <Line type="monotone" dataKey="ma20" stroke="#10b981" strokeWidth={1.5} dot={false} name="MA20" />
                  <Line type="monotone" dataKey="ma60" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="MA60" />
                  {showIndicator === 'bollinger' && (
                    <>
                      <Line type="monotone" dataKey="bbUpper" stroke="#06b6d4" strokeWidth={1} strokeDasharray="4 2" dot={false} name="布林上轨" />
                      <Line type="monotone" dataKey="bbMiddle" stroke="#06b6d4" strokeWidth={1} dot={false} name="布林中轨" />
                      <Line type="monotone" dataKey="bbLower" stroke="#06b6d4" strokeWidth={1} strokeDasharray="4 2" dot={false} name="布林下轨" />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-slate-900 border-violet-900/70 p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-violet-200">NCEO · {selectedSymbol} 模拟期权联动</h3>
                  <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-500">随当前股票驾驶舱选择同步。合约、价差、IV、Delta 和状态均来自 NCEO 模型链，不是交易所行情、真实可开仓权限或投资建议。</p>
                </div>
                <button type="button" onClick={() => navigate('/terminal?module=derivatives&open=nceo')} className="rounded border border-violet-700 bg-violet-950/40 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-900/60">在终端打开 NCEO</button>
              </div>
              <div className="mb-3 flex flex-wrap gap-1">
                {[7, 30, 60, 90].map(days => <button key={days} type="button" onClick={() => setNceoExpiryDays(days)} className={`rounded px-2 py-1 text-[10px] ${nceoExpiryDays === days ? 'bg-violet-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{days}D</button>)}
                <span className="mx-1 border-l border-slate-700" />
                <button type="button" onClick={() => setNceoLeg('call')} className={`rounded px-2 py-1 text-[10px] ${nceoLeg === 'call' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'}`}>Call 模型</button>
                <button type="button" onClick={() => setNceoLeg('put')} className={`rounded px-2 py-1 text-[10px] ${nceoLeg === 'put' ? 'bg-rose-900 text-rose-100' : 'bg-slate-800 text-slate-400'}`}>Put 模型</button>
              </div>
              {nceoChain.isLoading ? <div className="grid min-h-36 place-items-center rounded border border-dashed border-slate-700 text-xs text-slate-500">正在计算 NCEO 模型合约…</div> : nceoChain.isError ? <div className="rounded border border-amber-900/70 bg-amber-950/20 p-3 text-xs text-amber-100">NCEO 模型合约当前不可读取；不以未核验报价替代。</div> : !nceoAtm ? <div className="rounded border border-dashed border-slate-700 p-3 text-xs text-slate-500">当前股票没有可读的 NCEO 模型合约，保持空状态。</div> : <div className="grid gap-3 lg:grid-cols-[.9fr_1.1fr]"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded bg-slate-950 p-2"><div className="text-[9px] text-slate-500">ATM 行权价</div><div className="mt-1 font-mono text-xs text-slate-100">${nceoAtm.strike.toFixed(2)}</div></div><div className="rounded bg-slate-950 p-2"><div className="text-[9px] text-slate-500">模型 Bid/Ask</div><div className="mt-1 font-mono text-xs text-slate-100">${nceoBid?.toFixed(2)} / ${nceoAsk?.toFixed(2)}</div></div><div className="rounded bg-slate-950 p-2"><div className="text-[9px] text-slate-500">模型 IV / Delta</div><div className="mt-1 font-mono text-xs text-slate-100">{nceoIv?.toFixed(2)}% / {nceoDelta?.toFixed(3)}</div></div><div className="rounded bg-slate-950 p-2"><div className="text-[9px] text-slate-500">剩余天数</div><div className="mt-1 font-mono text-xs text-slate-100">{nceoAtm.daysToExpiry}D</div></div><div className="col-span-2 rounded border border-emerald-900/60 bg-emerald-950/20 p-2 text-[10px] text-emerald-200">模拟可做多／可新开</div><div className={`col-span-2 rounded border p-2 text-[10px] ${nceoShortOpen ? 'border-rose-900/60 bg-rose-950/20 text-rose-200' : 'border-amber-900/60 bg-amber-950/20 text-amber-100'}`}>{nceoShortOpen ? '模拟可做空／可新开' : '模拟开空受限：期限或模型价差条件不满足'}</div></div><div className="min-h-40 rounded bg-slate-950 p-2"><div className="mb-1 text-[10px] text-slate-400">NCEO 模型 IV 轨迹</div>{nceoHistory.isLoading ? <div className="grid h-32 place-items-center text-[10px] text-slate-500">正在计算 IV 轨迹…</div> : nceoHistory.data?.ivHistory?.length ? <ResponsiveContainer width="100%" height={132}><LineChart data={nceoHistory.data.ivHistory}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 8 }} /><YAxis tick={{ fill: '#64748b', fontSize: 8 }} width={34} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 10 }} /><Line type="monotone" dataKey="iv" name="模型 IV" stroke="#a78bfa" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <div className="grid h-32 place-items-center text-[10px] text-slate-500">模型 IV 轨迹暂不可用。</div>}</div></div>}
            </Card>

            {/* 成交量 */}
            <Card className="bg-slate-900 border-slate-700 p-3">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">成交量</h3>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                    formatter={(val: number) => [val?.toLocaleString(), '成交量']} />
                  <Bar dataKey="volume" name="成交量">
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.close >= d.open ? "#10b981" : "#ef4444"} opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* 技术指标 */}
            <Card className="bg-slate-900 border-slate-700 p-4">
              <div className="mb-3 rounded border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-200">技术指标辅助</h3>
                  <span className={`text-xs font-semibold ${
                    candles?.technicalSummary?.signal === "偏强"
                      ? "text-emerald-300"
                      : candles?.technicalSummary?.signal === "偏弱"
                        ? "text-rose-300"
                        : "text-slate-300"
                  }`}>
                    {candles?.technicalSummary?.signal ?? "数据不足"} · 分数 {candles?.technicalSummary?.score ?? "—"}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-[10px] text-slate-400 sm:grid-cols-2">
                  {(candles?.technicalSummary?.evidence ?? []).map(item => (
                    <div key={item.indicator}>
                      <span className="text-slate-300">{item.indicator}</span>
                      <span className="mx-1">·</span>
                      <span>{item.state}</span>
                      {item.value != null ? <span className="ml-1 font-mono text-slate-300">{item.value.toFixed(2)}</span> : null}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">
                  {candles?.technicalSummary?.boundary ?? "仅在有可验证 OHLCV 时计算，不补模拟值。"}
                </p>
              </div>
              {showIndicator === 'rsi' && (
                <>
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">RSI 相对强弱指标（14日）</h3>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={(candles?.rsi ?? []).filter(r => r.value !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={Math.floor((candles?.rsi.length ?? 1) / 6)} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "超买70", fill: "#ef4444", fontSize: 9 }} />
                      <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" label={{ value: "超卖30", fill: "#10b981", fontSize: 9 }} />
                      <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} name="RSI" />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
              {showIndicator === 'macd' && (
                <>
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">MACD（12,26,9）</h3>
                  <ResponsiveContainer width="100%" height={120}>
                    <ComposedChart data={macdData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={Math.floor(macdData.length / 6)} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                        formatter={(val: number) => [val?.toFixed(4), '']} />
                      <ReferenceLine y={0} stroke="#6b7280" />
                      <Bar dataKey="histogram" name="柱状">
                        {macdData.map((d, i) => (
                          <Cell key={i} fill={(d.histogram ?? 0) >= 0 ? "#10b981" : "#ef4444"} opacity={0.8} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MACD" />
                      <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="信号线" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </>
              )}
              {showIndicator === 'bollinger' && (
                <>
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">布林带宽度（价格偏离中轨）</h3>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData.filter(d => d.bbUpper != null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={Math.floor(chartData.length / 6)} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                        formatter={(val: number) => [val?.toFixed(2), '']} />
                      <Line type="monotone" dataKey="bbUpper" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="上轨" />
                      <Line type="monotone" dataKey="bbMiddle" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="中轨" />
                      <Line type="monotone" dataKey="bbLower" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="下轨" />
                      <Line type="monotone" dataKey="close" stroke="#94a3b8" strokeWidth={1} dot={false} name="收盘价" />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ─── 板块热力图 ─── */}
        <TabsContent value="sector">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">板块热力图（按权重 + 涨跌幅）</h3>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {(sectors ?? []).map(s => (
                <SectorHeatCell key={s.name} name={s.name} returnVal={s.return1d} weight={s.weight} />
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["板块","权重","今日","本周","本月","年初至今","PE","动量"].map(h => (
                      <th key={h} className="text-right py-2 px-2 text-slate-400 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(sectors ?? []).map(s => (
                    <tr key={s.name} className="border-b border-slate-800 hover:bg-slate-800/40">
                      <td className="py-2 px-2 text-slate-200 font-medium">{s.name}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{(s.weight as unknown) == null ? "—" : `${Number(s.weight).toFixed(1)}%`}</td>
                      {[s.return1d, s.return1w, s.return1m, s.returnYtd].map((v, i) => (
                        <td key={i} className={`py-2 px-2 text-right font-semibold ${v == null ? "text-slate-500" : v >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
                        </td>
                      ))}
                      <td className="py-2 px-2 text-right text-slate-300">{(s.pe as unknown) == null ? "—" : Number(s.pe).toFixed(1)}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className={`text-[9px] ${
                          s.momentum === "strong" ? "border-green-500 text-green-400" :
                          s.momentum === "weak" ? "border-red-500 text-red-400" :
                          "border-slate-500 text-slate-400"
                        }`}>
                          {s.momentum === "strong" ? "强势" : s.momentum === "weak" ? "弱势" : "中性"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ─── 涨跌榜 ─── */}
        <TabsContent value="movers">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "涨幅榜", data: movers?.gainers ?? [], color: "text-green-400", bgColor: "border-green-500/30" },
              { title: "跌幅榜", data: movers?.losers ?? [], color: "text-red-400", bgColor: "border-red-500/30" },
              { title: "成交活跃", data: movers?.mostActive ?? [], color: "text-blue-400", bgColor: "border-blue-500/30" },
            ].map(({ title, data, color, bgColor }) => (
              <Card key={title} className={`bg-slate-900 border-slate-700 ${bgColor} p-4`}>
                <h3 className={`text-sm font-semibold mb-3 ${color}`}>{title}</h3>
                <div className="space-y-2">
                  {data.map((s, i) => (
                    <div key={s.symbol} className="flex items-center justify-between py-1.5 border-b border-slate-800 cursor-pointer hover:bg-slate-800/40 rounded px-1"
                      onClick={() => { setSelectedSymbol(s.symbol); setTab("chart"); }}>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs w-4">{i + 1}</span>
                        <div>
                          <div className="text-slate-200 font-bold text-sm">{s.symbol}</div>
                          <div className="text-slate-400 text-xs">{s.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-100 font-semibold text-sm">${s.price.toFixed(2)}</div>
                        <div className={`text-xs font-bold ${s.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── 资金流向 ─── */}
        <TabsContent value="flow">
          <div className="flex items-center gap-3 mb-3">
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="w-32 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","JPM"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">{selectedSymbol} 方向成交量代理（30天）</h3>
              <p className="mb-3 text-[10px] text-slate-500">上涨量与下跌量由真实 OHLCV 的收盘方向和成交量计算，不代表真实资金流。</p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={moneyFlow ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={4} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#6b7280" />
                  <Bar dataKey="inflow" name="上涨量" fill="#10b981" opacity={0.7} />
                  <Bar dataKey="outflow" name="下跌量" fill="#ef4444" opacity={0.7} />
                  <Line type="monotone" dataKey="net" stroke="#f59e0b" strokeWidth={2} dot={false} name="方向净量" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">订单规模分层</h3>
              <p className="mb-3 text-[10px] text-slate-500">当前公开 OHLCV 不包含逐笔订单规模字段，保持空状态，不用模拟数据替代。</p>
              {(moneyFlow ?? []).some(row => row.largeOrder != null || row.smallOrder != null) ? <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={moneyFlow ?? []}>
                  <defs>
                    <linearGradient id="largeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="smallGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={4} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="largeOrder" stroke="#3b82f6" fill="url(#largeGrad)" strokeWidth={2} name="大单" />
                  <Area type="monotone" dataKey="smallOrder" stroke="#f59e0b" fill="url(#smallGrad)" strokeWidth={2} name="小单" />
                </AreaChart>
              </ResponsiveContainer> : <div className="grid h-36 place-items-center rounded border border-dashed border-slate-700 text-xs text-slate-500">暂无可验证的订单规模数据</div>}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

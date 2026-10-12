import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { ArrowLeft, Search, Filter, TrendingUp, TrendingDown, Zap, Bell, BookOpen, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import DerivativesAIPanel from "@/components/DerivativesAIPanel";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NewsItem {
  id: number; time: string; headline: string; source: string;
  category: string; sentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number; impact: "high" | "medium" | "low";
  keywords: string[]; summary: string; read: boolean;
}

interface KeywordTrend { keyword: string; count24h: number; count7d: number; trend: number; }
interface SentimentPoint { time: string; bullish: number; bearish: number; neutral: number; }
interface EventImpact { event: string; asset: string; priceChange: number; volumeChange: number; timeToRevert: string; }

// ─── Static Data ─────────────────────────────────────────────────────────────
const NEWS_ITEMS: NewsItem[] = [
  {
    id: 1, time: "09:42", headline: "OPEC+意外宣布延长减产至2025年Q1，油价期货跳涨3.2%",
    source: "Reuters", category: "商品衍生品", sentiment: "bullish", sentimentScore: 82,
    impact: "high", keywords: ["OPEC+", "减产", "原油期货", "WTI"], summary: "OPEC+联合部长级监督委员会决定将每日200万桶减产延长至2025年第一季度，超出市场预期，WTI期货盘前大涨。",
    read: false
  },
  {
    id: 2, time: "09:15", headline: "美联储鲍威尔暗示年内降息窗口仍开放，利率衍生品重新定价",
    source: "Ucheer", category: "利率衍生品", sentiment: "bullish", sentimentScore: 75,
    impact: "high", keywords: ["美联储", "降息", "利率互换", "SOFR期货"], summary: "鲍威尔在国会听证会上表示，若通胀继续降温，年内降息仍是可能选项，利率互换市场迅速重新定价，2024年降息预期升至2次。",
    read: false
  },
  {
    id: 3, time: "08:55", headline: "中国恒大清盘令引发亚洲信用衍生品市场波动，CDS利差走阔",
    source: "FT", category: "信用衍生品", sentiment: "bearish", sentimentScore: -68,
    impact: "high", keywords: ["恒大", "CDS", "信用利差", "亚洲高收益"], summary: "香港高等法院颁布恒大清盘令，亚洲高收益CDS指数CDX.EM走阔15bp，市场担忧传染效应蔓延至其他中国房企。",
    read: true
  },
  {
    id: 4, time: "08:30", headline: "VIX指数跌破15，股票期权隐含波动率创年内新低",
    source: "WSJ", category: "股票衍生品", sentiment: "neutral", sentimentScore: 12,
    impact: "medium", keywords: ["VIX", "隐含波动率", "期权", "标普500"], summary: "CBOE波动率指数VIX跌至14.8，为2023年以来最低水平，期权市场定价显示投资者对短期风险预期大幅下降。",
    read: true
  },
  {
    id: 5, time: "08:10", headline: "欧元区PMI超预期，欧元/美元期权隐含波动率上升",
    source: "Refinitiv", category: "外汇衍生品", sentiment: "bullish", sentimentScore: 58,
    impact: "medium", keywords: ["欧元区PMI", "EUR/USD", "外汇期权", "ECB"], summary: "欧元区综合PMI升至52.3，超出预期的50.8，欧元/美元1个月隐含波动率从6.2%升至6.8%，市场押注欧元走强。",
    read: false
  },
  {
    id: 6, time: "07:45", headline: "LME铜库存连续5日增加，铜期货空头头寸创三个月新高",
    source: "Metal Bulletin", category: "商品衍生品", sentiment: "bearish", sentimentScore: -52,
    impact: "medium", keywords: ["LME铜", "库存", "期货空头", "工业金属"], summary: "伦敦金属交易所铜库存连续第五个交易日增加，累计增幅达12%，与此同时CFTC数据显示铜期货净空头头寸升至三个月高位。",
    read: false
  },
  {
    id: 7, time: "07:20", headline: "日本央行意外维持YCC政策不变，日元汇率期权波动率飙升",
    source: "Nikkei", category: "外汇衍生品", sentiment: "bearish", sentimentScore: -45,
    impact: "medium", keywords: ["日本央行", "YCC", "日元", "外汇期权"], summary: "日本央行货币政策会议决定维持收益率曲线控制政策不变，与市场预期调整相悖，USD/JPY 1周隐含波动率从8.5%跳升至11.2%。",
    read: false
  },
  {
    id: 8, time: "06:55", headline: "美国EIA原油库存数据超预期增加，原油看跌期权成交量激增",
    source: "EIA", category: "商品衍生品", sentiment: "bearish", sentimentScore: -38,
    impact: "low", keywords: ["EIA", "原油库存", "看跌期权", "WTI"], summary: "EIA周度原油库存数据显示库存增加480万桶，远超预期的150万桶，WTI看跌期权成交量较日均水平高出230%。",
    read: true
  },
];

const KEYWORD_TRENDS: KeywordTrend[] = [
  { keyword: "降息预期", count24h: 142, count7d: 856, trend: 23.5 },
  { keyword: "CDS利差", count24h: 98, count7d: 612, trend: 15.2 },
  { keyword: "隐含波动率", count24h: 87, count7d: 543, trend: -8.3 },
  { keyword: "OPEC+", count24h: 76, count7d: 428, trend: 45.8 },
  { keyword: "利率互换", count24h: 65, count7d: 398, trend: 12.1 },
  { keyword: "期权溢价", count24h: 54, count7d: 321, trend: -5.7 },
  { keyword: "期货曲线", count24h: 48, count7d: 287, trend: 8.9 },
  { keyword: "VIX", count24h: 43, count7d: 265, trend: -18.4 },
];

const SENTIMENT_TIMELINE: SentimentPoint[] = [
  { time: "06:00", bullish: 45, bearish: 35, neutral: 20 },
  { time: "07:00", bullish: 52, bearish: 28, neutral: 20 },
  { time: "08:00", bullish: 38, bearish: 42, neutral: 20 },
  { time: "09:00", bullish: 60, bearish: 25, neutral: 15 },
  { time: "10:00", bullish: 55, bearish: 30, neutral: 15 },
  { time: "11:00", bullish: 48, bearish: 35, neutral: 17 },
  { time: "12:00", bullish: 50, bearish: 32, neutral: 18 },
];

const EVENT_IMPACTS: EventImpact[] = [
  { event: "OPEC+减产延期", asset: "WTI原油期货", priceChange: 3.2, volumeChange: 185, timeToRevert: "2-3天" },
  { event: "美联储暗示降息", asset: "利率互换2Y", priceChange: -8.5, volumeChange: 220, timeToRevert: "1-2天" },
  { event: "恒大清盘令", asset: "亚洲CDS指数", priceChange: 15.0, volumeChange: 340, timeToRevert: "5-7天" },
  { event: "VIX跌破15", asset: "SPX期权", priceChange: -12.0, volumeChange: 95, timeToRevert: "持续" },
  { event: "欧元区PMI超预期", asset: "EUR/USD期权", priceChange: 0.8, volumeChange: 145, timeToRevert: "1天" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "商品衍生品": "#f59e0b",
  "利率衍生品": "#3b82f6",
  "信用衍生品": "#ef4444",
  "股票衍生品": "#22c55e",
  "外汇衍生品": "#a855f7",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NIDRVNewsAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"feed" | "sentiment" | "keywords" | "impact" | "ai">("feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedImpact, setSelectedImpact] = useState("全部");
  const [readItems, setReadItems] = useState<Set<number>>(new Set([3, 4, 8]));
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<number>>(new Set());
  const [alertKeywords, setAlertKeywords] = useState<string[]>(["OPEC+", "降息"]);
  const [newAlertKw, setNewAlertKw] = useState("");

  const categories = useMemo(() => ["全部", ...Array.from(new Set(NEWS_ITEMS.map(n => n.category)))], []);

  const filtered = useMemo(() => {
    return NEWS_ITEMS.filter(n => {
      const matchSearch = !searchQuery || n.headline.includes(searchQuery) || n.keywords.some(k => k.includes(searchQuery));
      const matchCat = selectedCategory === "全部" || n.category === selectedCategory;
      const matchImpact = selectedImpact === "全部" || n.impact === selectedImpact;
      return matchSearch && matchCat && matchImpact;
    });
  }, [searchQuery, selectedCategory, selectedImpact]);

  const toggleRead = useCallback((id: number) => {
    setReadItems(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }, []);

  const toggleBookmark = useCallback((id: number) => {
    setBookmarkedItems(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }, []);

  const addAlertKeyword = useCallback(() => {
    if (newAlertKw.trim() && !alertKeywords.includes(newAlertKw.trim())) {
      setAlertKeywords(prev => [...prev, newAlertKw.trim()]);
      setNewAlertKw("");
    }
  }, [newAlertKw, alertKeywords]);

  const liveMetrics = useMemo(() => ({
    "今日新闻总量": "142条",
    "高影响新闻": "8条",
    "看多情绪": "55%",
    "看空情绪": "30%",
    "热门关键词": "降息预期",
    "最活跃品类": "利率衍生品",
  }), []);

  const TABS = [
    { id: "feed" as const, label: "新闻流" },
    { id: "sentiment" as const, label: "情绪分析" },
    { id: "keywords" as const, label: "关键词追踪" },
    { id: "impact" as const, label: "事件影响评估" },
    { id: "ai" as const, label: "🧠 AI摘要" },
  ];

  const sentimentColor = (s: NewsItem["sentiment"]) =>
    s === "bullish" ? "text-green-400" : s === "bearish" ? "text-red-400" : "text-gray-400";
  const impactBadge = (i: NewsItem["impact"]) =>
    i === "high" ? "bg-red-500/20 text-red-400 border-red-500/40"
    : i === "medium" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
    : "bg-gray-500/20 text-gray-400 border-gray-500/40";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-4">
      <Button variant="ghost" onClick={() => setLocation("/")} className="mb-4 text-gray-400 hover:text-white">
        <ArrowLeft className="w-4 h-4 mr-2" />返回
      </Button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-blue-400 font-mono">NI DRV — 衍生品新闻深度分析</h1>
          <p className="text-xs text-gray-500 mt-0.5">实时新闻流 · 情绪分析 · 关键词追踪 · 事件影响评估 · AI摘要</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />实时
          </div>
          <div className="text-xs text-gray-500 bg-gray-900 border border-gray-700 px-2 py-1 rounded">
            今日 <span className="text-white font-mono">142</span> 条
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 text-xs font-mono rounded-t transition-colors ${activeTab === t.id ? "bg-blue-500/10 text-blue-400 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: 新闻流 ── */}
      {activeTab === "feed" && (
        <div className="space-y-4">
          {/* Search + Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-48 relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索新闻、关键词..."
                className="w-full bg-gray-900 border border-gray-700 text-xs text-gray-300 pl-7 pr-3 py-1.5 rounded focus:border-blue-500 outline-none" />
            </div>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-xs text-gray-300 px-2 py-1.5 rounded">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={selectedImpact} onChange={e => setSelectedImpact(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-xs text-gray-300 px-2 py-1.5 rounded">
              {["全部", "high", "medium", "low"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* News List */}
          <div className="space-y-2">
            {filtered.map(news => (
              <div key={news.id}
                className={`bg-gray-900/50 border rounded p-4 transition-all cursor-pointer hover:border-gray-600 ${readItems.has(news.id) ? "border-gray-800 opacity-70" : "border-gray-700"}`}
                onClick={() => toggleRead(news.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 font-mono">{news.time}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded border" style={{ borderColor: CATEGORY_COLORS[news.category] + "60", color: CATEGORY_COLORS[news.category], backgroundColor: CATEGORY_COLORS[news.category] + "15" }}>{news.category}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${impactBadge(news.impact)}`}>{news.impact === "high" ? "高影响" : news.impact === "medium" ? "中影响" : "低影响"}</span>
                      {!readItems.has(news.id) && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                    </div>
                    <h3 className={`text-sm font-medium mb-1 ${readItems.has(news.id) ? "text-gray-400" : "text-white"}`}>{news.headline}</h3>
                    <p className="text-xs text-gray-500 mb-2">{news.summary}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {news.keywords.map(kw => (
                        <span key={kw} className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded border border-gray-700">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`text-xs font-bold ${sentimentColor(news.sentiment)}`}>
                      {news.sentiment === "bullish" ? "↑ 看多" : news.sentiment === "bearish" ? "↓ 看空" : "→ 中性"}
                    </div>
                    <div className="text-xs text-gray-500">{news.source}</div>
                    <button onClick={e => { e.stopPropagation(); toggleBookmark(news.id); }}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${bookmarkedItems.has(news.id) ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                      {bookmarkedItems.has(news.id) ? "★" : "☆"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Alert Keyword Manager */}
          <div className="bg-gray-900/50 border border-yellow-800/40 rounded p-4">
            <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2"><Bell size={14} />关键词预警设置</h3>
            <div className="flex gap-2 mb-3">
              <input value={newAlertKw} onChange={e => setNewAlertKw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addAlertKeyword()}
                placeholder="输入关键词，回车添加..."
                className="flex-1 bg-gray-800 border border-gray-700 text-xs text-gray-300 px-2 py-1.5 rounded focus:border-yellow-500 outline-none" />
              <button onClick={addAlertKeyword}
                className="text-xs px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 rounded hover:bg-yellow-500/30">添加</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {alertKeywords.map(kw => (
                <span key={kw} className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded">
                  {kw}
                  <button onClick={() => setAlertKeywords(prev => prev.filter(k => k !== kw))} className="text-yellow-600 hover:text-yellow-300 ml-0.5">×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: 情绪分析 ── */}
      {activeTab === "sentiment" && (
        <div className="space-y-4">
          {/* Sentiment Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "看多新闻", value: "55%", count: 78, color: "#22c55e" },
              { label: "看空新闻", value: "30%", count: 43, color: "#ef4444" },
              { label: "中性新闻", value: "15%", count: 21, color: "#6b7280" },
            ].map(s => (
              <div key={s.label} className="bg-gray-900/50 border border-gray-800 rounded p-4 text-center">
                <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-1">{s.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.count}条</div>
              </div>
            ))}
          </div>

          {/* Sentiment Timeline */}
          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">今日情绪时序分布（%）</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={SENTIMENT_TIMELINE}>
                <defs>
                  <linearGradient id="bullGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="bullish" name="看多%" stroke="#22c55e" fill="url(#bullGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="bearish" name="看空%" stroke="#ef4444" fill="url(#bearGrad)" strokeWidth={1.5} />
                <Line type="monotone" dataKey="neutral" name="中性%" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sentiment by Category */}
          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">各衍生品类别情绪分布</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { cat: "商品", bullish: 60, bearish: 25, neutral: 15 },
                { cat: "利率", bullish: 70, bearish: 15, neutral: 15 },
                { cat: "信用", bullish: 20, bearish: 65, neutral: 15 },
                { cat: "股票", bullish: 55, bearish: 30, neutral: 15 },
                { cat: "外汇", bullish: 50, bearish: 35, neutral: 15 },
              ]} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="cat" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="bullish" name="看多" stackId="a" fill="#22c55e" />
                <Bar dataKey="bearish" name="看空" stackId="a" fill="#ef4444" />
                <Bar dataKey="neutral" name="中性" stackId="a" fill="#374151" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Tab 3: 关键词追踪 ── */}
      {activeTab === "keywords" && (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">热门关键词 — 24小时出现频次</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={KEYWORD_TRENDS} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis type="category" dataKey="keyword" tick={{ fill: "#9ca3af", fontSize: 10 }} width={80} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="count24h" name="24h频次" fill="#3b82f6" radius={[0, 2, 2, 0]}>
                  {KEYWORD_TRENDS.map((entry, i) => (
                    <Cell key={i} fill={entry.trend > 0 ? "#3b82f6" : "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">关键词趋势变化（24h vs 7天均值）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left p-2">关键词</th>
                    <th className="text-right p-2">24h频次</th>
                    <th className="text-right p-2">7天均值</th>
                    <th className="text-right p-2">趋势变化</th>
                    <th className="p-2">趋势图</th>
                  </tr>
                </thead>
                <tbody>
                  {KEYWORD_TRENDS.map((kw, i) => (
                    <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30">
                      <td className="p-2 font-medium text-white">{kw.keyword}</td>
                      <td className="p-2 text-right font-mono text-blue-400">{kw.count24h}</td>
                      <td className="p-2 text-right font-mono text-gray-400">{Math.round(kw.count7d / 7)}</td>
                      <td className={`p-2 text-right font-mono font-bold ${kw.trend > 0 ? "text-green-400" : "text-red-400"}`}>
                        {kw.trend > 0 ? "↑" : "↓"} {Math.abs(kw.trend).toFixed(1)}%
                      </td>
                      <td className="p-2">
                        <div className="w-16 h-2 bg-gray-800 rounded">
                          <div className="h-2 rounded" style={{ width: `${Math.min(100, (kw.count24h / 150) * 100)}%`, backgroundColor: kw.trend > 0 ? "#3b82f6" : "#6b7280" }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Keyword Co-occurrence */}
          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">关键词共现网络（高频组合）</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { pair: "降息 + 利率互换", count: 45, strength: "强" },
                { pair: "OPEC+ + 原油期货", count: 38, strength: "强" },
                { pair: "CDS + 信用利差", count: 32, strength: "强" },
                { pair: "VIX + 隐含波动率", count: 28, strength: "中" },
                { pair: "日元 + 外汇期权", count: 22, strength: "中" },
                { pair: "LME铜 + 期货空头", count: 18, strength: "中" },
              ].map((co, i) => (
                <div key={i} className="bg-gray-800 rounded p-3">
                  <div className="text-xs text-gray-300 font-medium mb-1">{co.pair}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">共现{co.count}次</span>
                    <span className={co.strength === "强" ? "text-green-400" : "text-yellow-400"}>{co.strength}相关</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: 事件影响评估 ── */}
      {activeTab === "impact" && (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">今日重大事件价格影响矩阵</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left p-2">事件</th>
                    <th className="text-left p-2">影响资产</th>
                    <th className="text-right p-2">价格变化</th>
                    <th className="text-right p-2">成交量变化</th>
                    <th className="text-right p-2">预计回归</th>
                    <th className="p-2">影响强度</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENT_IMPACTS.map((evt, i) => (
                    <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30">
                      <td className="p-2 text-white font-medium">{evt.event}</td>
                      <td className="p-2 text-gray-400">{evt.asset}</td>
                      <td className={`p-2 text-right font-mono font-bold ${evt.priceChange > 0 ? "text-green-400" : "text-red-400"}`}>
                        {evt.priceChange > 0 ? "+" : ""}{evt.priceChange.toFixed(1)}{evt.asset.includes("bp") ? "bp" : "%"}
                      </td>
                      <td className="p-2 text-right font-mono text-blue-400">+{evt.volumeChange}%</td>
                      <td className="p-2 text-right text-yellow-400">{evt.timeToRevert}</td>
                      <td className="p-2">
                        <div className="w-20 h-2 bg-gray-800 rounded">
                          <div className="h-2 rounded bg-blue-400" style={{ width: `${Math.min(100, evt.volumeChange / 3.5)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Impact Chart */}
          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">事件驱动成交量异常（vs 日均水平）</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={EVENT_IMPACTS.map(e => ({ name: e.event.slice(0, 8), volumeChange: e.volumeChange, priceChange: Math.abs(e.priceChange) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6b7280", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #374151", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="volumeChange" name="成交量变化%" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="priceChange" name="价格变化幅度" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Historical Impact Patterns */}
          <div className="bg-gray-900/50 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">历史相似事件影响模式</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: "OPEC+减产延期（历史6次）", avgImpact: "+2.8%", duration: "3-5天", reliability: "82%" },
                { title: "美联储暗示降息（历史12次）", avgImpact: "-12bp利率互换", duration: "1-3天", reliability: "75%" },
                { title: "主权信用事件（历史8次）", avgImpact: "+18bp CDS", duration: "5-10天", reliability: "88%" },
                { title: "VIX跌破15（历史15次）", avgImpact: "-15%期权溢价", duration: "持续", reliability: "70%" },
              ].map((p, i) => (
                <div key={i} className="bg-gray-800 rounded p-3">
                  <div className="text-xs font-medium text-white mb-2">{p.title}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-gray-500">平均影响</div><div className="text-blue-400 font-mono">{p.avgImpact}</div></div>
                    <div><div className="text-gray-500">持续时间</div><div className="text-yellow-400">{p.duration}</div></div>
                    <div><div className="text-gray-500">可靠性</div><div className="text-green-400 font-mono">{p.reliability}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: AI摘要 ── */}
      {activeTab === "ai" && (
        <DerivativesAIPanel moduleCode="NI DRV" moduleName="衍生品新闻" accentColor="blue" liveMetrics={liveMetrics} />
      )}
    </div>
  );
}

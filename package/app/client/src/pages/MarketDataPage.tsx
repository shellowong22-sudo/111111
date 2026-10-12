import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, Search, BarChart2, Activity,
  Globe, RefreshCw, X, Settings, Clock, Star, SlidersHorizontal,
  ChevronDown, ChevronUp, Wifi, WifiOff, BookmarkCheck, Info,
  Volume2, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine
} from 'recharts';
import { useRealtimePrices } from '@/hooks/useRealtimePrices';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useMarketWebSocket } from '@/hooks/useMarketWebSocket';
import { useWsFlash } from '@/hooks/useWsFlash';
import { PriceChartModal } from '@/components/PriceChartModal';
import TechnicalChart from '@/components/TechnicalChart';
import PublicMarketObservationDesk from '@/components/PublicMarketObservationDesk';
import ImportedMarketSnapshotLedger from '@/components/market/ImportedMarketSnapshotLedger';

// ─── 常量 ───────────────────────────────────────────────────────────────────

const MARKET_TYPES = [
  { value: 'all', label: '全部' },
  { value: 'stock', label: '股票' },
  { value: 'option', label: '期权' },
  { value: 'fund', label: '基金' },
  { value: 'bond', label: '债券' },
  { value: 'forex', label: '外汇' },
  { value: 'commodity', label: '商品' },
  { value: 'index', label: '指数' },
  { value: 'derivative', label: '衍生品' },
];

const MARKET_LABELS: Record<string, string> = {
  stock: '股票', option: '期权', fund: '基金', bond: '债券',
  forex: '外汇', commodity: '商品', index: '指数', derivative: '衍生品',
};

const SORT_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'pct_desc', label: '涨幅↓' },
  { value: 'pct_asc', label: '跌幅↓' },
  { value: 'price_desc', label: '价格↓' },
  { value: 'price_asc', label: '价格↑' },
  { value: 'volume_desc', label: '成交量↓' },
];

const WATCHLIST_KEY = 'finance_hub_watchlist';

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function fmtVol(vol: string | number | undefined): string {
  const n = typeof vol === 'string' ? parseInt(vol) : (vol ?? 0);
  if (isNaN(n) || n === 0) return '-';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

function fmtPrice(price: number, decimals?: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const d = decimals ?? (price >= 100 ? 2 : 4);
  return price.toFixed(d);
}

// ─── 小组件 ──────────────────────────────────────────────────────────────────

/** 实时时钟 */
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-xs text-slate-400 tabular-nums">
      {time.toLocaleTimeString('zh-CN', { hour12: false })}
    </span>
  );
}

/** 连接状态指示器 */
function ConnectionIndicator({ status }: { status: 'connecting' | 'connected' | 'disconnected' | 'error' }) {
  const isLive = status === 'connected';
  const isConnecting = status === 'connecting';
  return (
    <div className="flex items-center gap-1.5">
      {isLive
        ? <Wifi className="w-3.5 h-3.5 text-green-400" />
        : isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
      <span className={cn("text-xs font-medium", isLive ? "text-green-400" : isConnecting ? "text-amber-400" : "text-red-400")}>
        {isLive ? "LIVE" : isConnecting ? "CONNECTING" : "OFFLINE"}
      </span>
      {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />}
    </div>
  );
}

/** 自动刷新倒计时圆环 */
function RefreshCountdown({ interval, onRefresh }: { interval: number; onRefresh: () => void }) {
  const [remaining, setRemaining] = useState(interval);
  const startRef = useRef(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const rem = interval - (elapsed % interval);
      setRemaining(rem);
      if (elapsed > 0 && elapsed % interval === 0) onRefresh();
    }, 1000);
    return () => clearInterval(t);
  }, [interval, onRefresh]);
  const pct = (remaining / interval) * 100;
  return (
    <div className="flex items-center gap-1" title={`${remaining}s 后自动刷新`}>
      <svg width="16" height="16" viewBox="0 0 16 16" className="rotate-[-90deg]">
        <circle cx="8" cy="8" r="6" fill="none" stroke="#1e293b" strokeWidth="2" />
        <circle cx="8" cy="8" r="6" fill="none" stroke="#3b82f6" strokeWidth="2"
          strokeDasharray={`${2 * Math.PI * 6}`}
          strokeDashoffset={`${2 * Math.PI * 6 * (1 - pct / 100)}`}
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>
      <span className="text-xs text-slate-500 tabular-nums w-6">{remaining}s</span>
    </div>
  );
}

/** 价格单元格，带闪烁动画 */
function PriceCell({ price, dir, flashKey, decimals }: {
  price: number; dir: 'up' | 'down' | 'neutral'; flashKey: number; decimals?: number;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevFlashKey = useRef(flashKey);
  useEffect(() => {
    if (flashKey !== prevFlashKey.current && spanRef.current) {
      const cls = dir === 'up' ? 'price-flash-up' : dir === 'down' ? 'price-flash-down' : '';
      if (cls) {
        spanRef.current.classList.remove('price-flash-up', 'price-flash-down');
        void spanRef.current.offsetWidth;
        spanRef.current.classList.add(cls);
      }
      prevFlashKey.current = flashKey;
    }
  }, [flashKey, dir]);
  return (
    <span
      ref={spanRef}
      className={cn(
        "font-mono font-semibold tabular-nums px-1 rounded transition-colors",
        dir === 'up' ? 'text-green-300' : dir === 'down' ? 'text-red-300' : 'text-slate-100'
      )}
    >
      {fmtPrice(price, decimals)}
    </span>
  );
}

/**
 * 单元格闪烁包装器（用于涨跌额/涨跌幅/成交量）
 * wsFlashKey 变化时重新触发 CSS animation
 */
function FlashCell({ dir, wsFlashKey, className, children }: {
  dir: 'up' | 'down' | 'neutral';
  wsFlashKey: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevKey = useRef(wsFlashKey);
  useEffect(() => {
    if (wsFlashKey !== prevKey.current && ref.current) {
      const cls = dir === 'up' ? 'cell-flash-up' : dir === 'down' ? 'cell-flash-down' : '';
      if (cls) {
        ref.current.classList.remove('cell-flash-up', 'cell-flash-down');
        void ref.current.offsetWidth; // reflow 重启动画
        ref.current.classList.add(cls);
      }
      prevKey.current = wsFlashKey;
    }
  }, [wsFlashKey, dir]);
  return (
    <span ref={ref} className={cn('inline-block px-1', className)}>
      {children}
    </span>
  );
}

/**
 * 整行闪烁包装器（替代 <tr>）
 * 当 wsFlashKey 变化时，对整行背景施加短暂闪烁动画
 */
const FlashRow = React.forwardRef<
  HTMLTableRowElement,
  {
    wsFlashKey: number;
    wsFlashDir: 'up' | 'down' | 'neutral';
    isSelected: boolean;
    isWatched: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }
>(({ wsFlashKey, wsFlashDir, isSelected, isWatched, onClick, children }, _ref) => {
  const trRef = useRef<HTMLTableRowElement>(null);
  const prevKey = useRef(wsFlashKey);
  useEffect(() => {
    if (wsFlashKey !== prevKey.current && trRef.current) {
      const cls = wsFlashDir === 'up' ? 'row-flash-up' : wsFlashDir === 'down' ? 'row-flash-down' : '';
      if (cls) {
        trRef.current.classList.remove('row-flash-up', 'row-flash-down');
        void trRef.current.offsetWidth; // reflow 重启动画
        trRef.current.classList.add(cls);
      }
      prevKey.current = wsFlashKey;
    }
  }, [wsFlashKey, wsFlashDir]);
  return (
    <tr
      ref={trRef}
      className={cn(
        'hover:bg-slate-800/50 cursor-pointer group',
        isSelected && 'bg-blue-950/30 border-l-2 border-l-blue-500',
        isWatched && !isSelected && 'bg-yellow-950/10'
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
});
FlashRow.displayName = 'FlashRow';

/** 涨跌幅徽章 */
function ChangePctCell({ pct, dir }: { pct: number; dir: 'up' | 'down' | 'neutral' }) {
  const pos = pct > 0;
  const neg = pct < 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium font-mono",
      pos ? 'bg-green-400/10 text-green-400' : neg ? 'bg-red-400/10 text-red-400' : 'bg-slate-700 text-slate-400'
    )}>
      {pos ? <ArrowUpRight className="w-3 h-3" /> : neg ? <ArrowDownRight className="w-3 h-3" /> : null}
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

/** 行情滚动条 */
function TickerTape({ items }: { items: { symbol: string; price: number; changePct: number; tickDir: 'up' | 'down' | 'neutral' }[] }) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];
  return (
    <div className="bg-slate-900/80 border-b border-slate-800 overflow-hidden py-1.5">
      <div className="ticker-scroll flex gap-8 w-max">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <span className="font-mono text-blue-400 font-medium">{item.symbol}</span>
            <span className={cn("font-mono tabular-nums", item.tickDir === 'up' ? 'text-green-400' : item.tickDir === 'down' ? 'text-red-400' : 'text-slate-300')}>
              {fmtPrice(item.price)}
            </span>
            <span className={cn("text-xs", item.changePct > 0 ? 'text-green-500' : item.changePct < 0 ? 'text-red-500' : 'text-slate-500')}>
              {item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** 迷你 Sparkline 折线图 */
function Sparkline({ data, positive }: { data: { t: number; v: number }[]; positive: boolean }) {
  return (
    <ResponsiveContainer width={80} height={32}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={positive ? '#22c55e' : '#ef4444'}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** 星号收藏按钮 */
function StarButton({ symbol, watchlist, onToggle }: {
  symbol: string;
  watchlist: Set<string>;
  onToggle: (symbol: string) => void;
}) {
  const isWatched = watchlist.has(symbol);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(symbol); }}
      className={cn(
        "p-1 rounded transition-all hover:scale-110 active:scale-95",
        isWatched ? "text-yellow-400 hover:text-yellow-300" : "text-slate-600 hover:text-slate-400"
      )}
      title={isWatched ? "取消收藏" : "加入自选"}
    >
      <Star className={cn("w-4 h-4", isWatched && "fill-yellow-400")} />
    </button>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function MarketDataPage() {
  const [, navigate] = useLocation();
  const chartTheme = useChartTheme();

  // ── 筛选状态 ──
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ── 自选股（localStorage 持久化） ──
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(WATCHLIST_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleWatchlist = useCallback((symbol: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(Array.from(next))); } catch { }
      return next;
    });
  }, []);

  // ── 侧边栏详情 ──
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('symbol');
    } catch { return null; }
  });
  const [sidebarTab, setSidebarTab] = useState<'chart' | 'detail'>('chart');

  // 监听 URL 中 symbol 参数变化（来自跑马灯/命令栏跳转）
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartModalSymbol, setChartModalSymbol] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<'5d' | '1mo' | '3mo'>('1mo');
  useEffect(() => {
    const handler = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const sym = params.get('symbol');
        if (sym) setSelectedSymbol(sym);
      } catch { /* noop */ }
    };
    window.addEventListener('popstate', handler);
    window.addEventListener('market-symbol-change', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('market-symbol-change', handler);
    };
  }, []);

  // ── WebSocket 实时行情 ──
  const {
    priceMap: wsMap,
    status: wsStatus,
    reconnect: wsReconnect,
    lastMessageAt,
    lastLatencyMs,
    reconnectCount,
  } = useMarketWebSocket();
  const dataAgeMs = lastMessageAt ? Math.max(0, Date.now() - lastMessageAt) : null;
  const freshnessLabel = dataAgeMs === null ? '等待首条消息' : dataAgeMs < 3000 ? '数据新鲜' : dataAgeMs < 10000 ? '数据稍旧' : '数据滞后';
  const freshnessClass = dataAgeMs === null ? 'text-slate-500' : dataAgeMs < 3000 ? 'text-emerald-400' : dataAgeMs < 10000 ? 'text-amber-400' : 'text-rose-400';
  // ── WS 闪烁状态：记录哪些 symbol 刚被 WS 推送更新 ──
  const wsFlashMap = useWsFlash(wsMap, 900);

  // ── 数据查询（初始加载 + 兜底） ──
  const allQuery = trpc.market.getAll.useQuery(undefined, { refetchInterval: 60000 });
  const allData = allQuery.data ?? [];
  const isLoading = allQuery.isLoading;

  const typeQuery = trpc.market.getByType.useQuery(
    { type: selectedType },
    { enabled: selectedType !== 'all', refetchInterval: 60000 }
  );
  const typeData = typeQuery.data ?? [];
  const searchQueryResult = trpc.market.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 1 }
  );
  const searchData = searchQueryResult.data ?? [];
  const { data: detailData } = trpc.market.getBySymbol.useQuery(
    { symbol: selectedSymbol || '' },
    { enabled: !!selectedSymbol }
  );
  const isRefreshing = allQuery.isFetching && !allQuery.isLoading || typeQuery.isFetching || searchQueryResult.isFetching;
  const snapshotUpdatedAt = allQuery.dataUpdatedAt ? new Date(allQuery.dataUpdatedAt) : null;
  const refetch = useCallback(async () => {
    const activeQuery = searchQuery.length > 1 ? searchQueryResult : selectedType !== 'all' ? typeQuery : allQuery;
    await Promise.all([allQuery.refetch(), activeQuery === allQuery ? Promise.resolve() : activeQuery.refetch()]);
    wsReconnect();
  }, [allQuery, searchQuery.length, searchQueryResult, selectedType, typeQuery, wsReconnect]);

  // ── 价格：优先使用服务端 WebSocket，回退到数据库/公开观测快照 ──
  const allRealtimeMap = useRealtimePrices(allData, { tickInterval: 2000 });
  // 合并 WS 数据和服务端快照（WS 优先，并递增 flashKey 以触发闪烁）
  const mergedRealtimeMap = useMemo(() => {
    if (wsMap.size === 0) return allRealtimeMap;
    const merged = new Map(allRealtimeMap);
    for (const [sym, tick] of Array.from(wsMap.entries())) {
      const existing = merged.get(sym);
      if (existing) {
        const wsFlash = wsFlashMap.get(sym);
        merged.set(sym, {
          ...existing,
          price: tick.price,
          changeVal: tick.changeVal,
          changePct: tick.changePct,
          volume: tick.volume,
          tickDir: tick.tickDir,
          // WS 推送时递增 flashKey，确保 PriceCell 闪烁动画被触发
          flashKey: wsFlash ? wsFlash.key : existing.flashKey,
        });
      }
    }
    return merged;
  }, [wsMap, allRealtimeMap, wsFlashMap]);

  // ── 基础显示数据 ──
  const baseDisplayData = useMemo(() => {
    if (searchQuery.length > 1) return searchData;
    if (selectedType === 'all') return allData;
    return typeData;
  }, [searchQuery, searchData, selectedType, allData, typeData]);

  // ── 应用 Watchlist 过滤 + 排序 + 置顶 ──
  const displayData = useMemo(() => {
    let data = showWatchlistOnly
      ? baseDisplayData.filter(item => watchlist.has(item.symbol))
      : baseDisplayData;

    // 排序
    if (sortBy !== 'default') {
      data = [...data].sort((a, b) => {
        const rtA = mergedRealtimeMap.get(a.symbol);
        const rtB = mergedRealtimeMap.get(b.symbol);
        const pctA = rtA ? rtA.changePct : parseFloat(a.changePct);
        const pctB = rtB ? rtB.changePct : parseFloat(b.changePct);
        const priceA = rtA ? rtA.price : parseFloat(a.price);
        const priceB = rtB ? rtB.price : parseFloat(b.price);
        const volA = rtA ? rtA.volume : parseInt(a.volume);
        const volB = rtB ? rtB.volume : parseInt(b.volume);
        switch (sortBy) {
          case 'pct_desc': return pctB - pctA;
          case 'pct_asc': return pctA - pctB;
          case 'price_desc': return priceB - priceA;
          case 'price_asc': return priceA - priceB;
          case 'volume_desc': return volB - volA;
          default: return 0;
        }
      });
    }

    // 自选股置顶
    if (!showWatchlistOnly && watchlist.size > 0) {
      const watched = data.filter(item => watchlist.has(item.symbol));
      const rest = data.filter(item => !watchlist.has(item.symbol));
      data = [...watched, ...rest];
    }

    return data;
  }, [wsMap, allRealtimeMap]);

  const realtimeMap = useRealtimePrices(displayData, { tickInterval: 1200 });

  // ── 市场统计 ──
  const marketStats = useMemo(() => {
    const stats: Record<string, { count: number; up: number; down: number }> = {};
    for (const item of allData) {
      if (!stats[item.market]) stats[item.market] = { count: 0, up: 0, down: 0 };
      stats[item.market].count++;
      const rt = mergedRealtimeMap.get(item.symbol);
      const pct = rt ? rt.changePct : parseFloat(item.changePct);
      if (pct > 0) stats[item.market].up++;
      else if (pct < 0) stats[item.market].down++;
    }
    return stats;
  }, [wsMap, allRealtimeMap]);

  const upCount = useMemo(() => allData.filter(d => {
    const rt = mergedRealtimeMap.get(d.symbol);
    return (rt ? rt.changePct : parseFloat(d.changePct)) > 0;
  }).length, [wsMap, allRealtimeMap]);

  const downCount = useMemo(() => allData.filter(d => {
    const rt = mergedRealtimeMap.get(d.symbol);
    return (rt ? rt.changePct : parseFloat(d.changePct)) < 0;
  }).length, [wsMap, allRealtimeMap]);

  const topMovers = useMemo(() => {
    return [...allData]
      .map(item => {
        const rt = mergedRealtimeMap.get(item.symbol);
        return { ...item, _rtPct: rt ? rt.changePct : parseFloat(item.changePct) };
      })
      .sort((a, b) => Math.abs(b._rtPct) - Math.abs(a._rtPct))
      .slice(0, 5);
  }, [wsMap, allRealtimeMap]);

  // ── ticker tape ──
  const tickerItems = useMemo(() => allData.map(item => {
    const rt = mergedRealtimeMap.get(item.symbol);
    return {
      symbol: item.symbol,
      price: rt ? rt.price : parseFloat(item.price),
      changePct: rt ? rt.changePct : parseFloat(item.changePct),
      tickDir: rt ? rt.tickDir : 'neutral' as const,
    };
  }), [wsMap, allRealtimeMap]);

  const selectedRt = selectedSymbol ? mergedRealtimeMap.get(selectedSymbol) : null;
  const historySymbol = chartModalSymbol ?? selectedSymbol ?? '';
  const historyQuery = trpc.market.getHistory.useQuery({ symbol: historySymbol, range: historyRange }, { enabled: !!historySymbol, staleTime: 300000, refetchOnWindowFocus: false });
  const chartData = useMemo(() => (historyQuery.data?.history ?? []).map((point) => ({ time: point.date, price: point.close ?? point.value, open: point.open!, high: point.high!, low: point.low! })), [historyQuery.data]);
  const latestHistory = chartData.at(-1);
  const isDetailPos = detailData ? parseFloat(detailData.changePct) > 0 : true;

  // 打开价格走势弹窗
  const openChartModal = useCallback((symbol: string) => {
    setChartModalSymbol(symbol);
    setChartModalOpen(true);
  }, []);

  const fmt = (num: string | number, d = 2) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '0.00';
    return fmtPrice(n, d);
  };

  // 关闭排序菜单（点击外部）
  const sortMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <ImportedMarketSnapshotLedger />
      <PublicMarketObservationDesk />
      <div className="mx-auto max-w-screen-2xl border border-slate-800 bg-slate-950 pointer-events-none select-none opacity-80" data-market-data-historical-content="true"><p className="m-4 rounded border border-amber-700/60 bg-amber-950/30 p-3 text-xs leading-5 text-amber-200" data-market-data-historical-boundary="true">保留原行情数据中心展示（非事实）：以下区域完整保留原导航、字段、筛选、固定快照、客户端模拟实时流、市场统计、详情、技术指标和图表布局；它们不是当前可验证行情、成交、新闻、因果判断或投资依据。为避免假搜索、假排序、假刷新和静态详情跳转，保留区已禁用交互。可验证行情仅限上方公开观察。</p>
      {/* ── 顶部导航栏 ── */}
      <div className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Activity className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-lg font-bold text-slate-50">金融行情数据中心</h1>
              <p className="text-xs text-slate-500">实时多市场品种行情</p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-end">
            <ConnectionIndicator status={wsStatus} />
            <div className="flex items-center gap-2 text-[10px] font-mono" title="实时行情消息状态">
              <span className={freshnessClass}>{freshnessLabel}</span>
              <span className="text-slate-500">延迟 {lastLatencyMs === null ? '--' : `${lastLatencyMs}ms`}</span>
              <span className="text-slate-500">重连 {reconnectCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono" role="status" aria-live="polite">
              {isRefreshing && <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />}
              <span className={isRefreshing ? 'text-blue-300' : 'text-slate-500'}>{isRefreshing ? '正在更新数据库快照' : `快照 ${snapshotUpdatedAt ? snapshotUpdatedAt.toLocaleTimeString('zh-CN', { hour12: false }) : '待载入'}`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <LiveClock />
            </div>
            <div className="text-xs text-slate-400 font-mono">
              <span className="text-green-400">▲{upCount}</span>
              <span className="mx-1 text-slate-600">|</span>
              <span className="text-red-400">▼{downCount}</span>
              <span className="mx-1 text-slate-600">|</span>
              <span className="text-slate-400">{allData.length} 条</span>
            </div>
            <RefreshCountdown interval={30} onRefresh={() => { void refetch(); }} />
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200 h-7 w-7 p-0" onClick={() => { void refetch(); }} disabled={isRefreshing} aria-label="刷新当前行情数据" title="刷新当前行情数据">
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
            <Button size="sm" variant="outline" className="text-slate-300 border-slate-600 hover:bg-slate-700" onClick={() => navigate('/market-manage')}>
              <Settings className="w-4 h-4 mr-1" />数据管理
            </Button>
          </div>
        </div>
      </div>

      {/* ── 行情滚动条 ── */}
      <TickerTape items={tickerItems} />

      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {/* ── 市场概览卡片 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          {Object.entries(marketStats).map(([market, stat]) => (
            <Card
              key={market}
              className={cn(
                "bg-slate-900 border-slate-700 cursor-pointer transition-all hover:border-blue-500/50",
                selectedType === market && "border-blue-500 bg-slate-800"
              )}
              onClick={() => { setSelectedType(market); setShowWatchlistOnly(false); setSearchQuery(''); }}
            >
              <CardContent className="p-3">
                <p className="text-xs text-slate-500 mb-1">{MARKET_LABELS[market] || market}</p>
                <p className="text-lg font-bold text-slate-100">{stat.count}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-green-400">▲{stat.up}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-red-400">▼{stat.down}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* ── 左侧主内容 ── */}
          <div className="xl:col-span-3 space-y-4">

            {/* 搜索栏 + 工具栏 */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* 搜索框 */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="搜索品种代码或名称..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowWatchlistOnly(false); }}
                  className="pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-blue-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 自选股切换 */}
              <Button
                size="sm"
                variant={showWatchlistOnly ? "default" : "outline"}
                className={cn(
                  "h-10 gap-2 shrink-0",
                  showWatchlistOnly
                    ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/30"
                    : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                )}
                onClick={() => { setShowWatchlistOnly(v => !v); setSearchQuery(''); }}
              >
                <Star className={cn("w-4 h-4", showWatchlistOnly && "fill-yellow-400")} />
                自选股
                {watchlist.size > 0 && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full", showWatchlistOnly ? "bg-yellow-400/20 text-yellow-300" : "bg-slate-700 text-slate-400")}>
                    {watchlist.size}
                  </span>
                )}
              </Button>

              {/* 排序按钮 */}
              <div className="relative shrink-0" ref={sortMenuRef}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 gap-2 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                  onClick={() => setShowSortMenu(v => !v)}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {SORT_OPTIONS.find(s => s.value === sortBy)?.label || '排序'}
                  {showSortMenu ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[120px]">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm transition-colors",
                          sortBy === opt.value
                            ? "bg-blue-600/20 text-blue-400"
                            : "text-slate-300 hover:bg-slate-800"
                        )}
                        onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 类型筛选按钮 */}
            <div className="flex flex-wrap gap-2">
              {MARKET_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => { setSelectedType(type.value); setSearchQuery(''); setShowWatchlistOnly(false); }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all border",
                    selectedType === type.value && !showWatchlistOnly && !searchQuery
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  )}
                >
                  {type.label}
                  <span className="ml-1.5 text-xs opacity-70">
                    {type.value === 'all' ? allData.length : (marketStats[type.value]?.count ?? 0)}
                  </span>
                </button>
              ))}
            </div>

            {/* 自选股置顶提示 */}
            {watchlist.size > 0 && !showWatchlistOnly && !searchQuery && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                <BookmarkCheck className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="text-xs text-yellow-400/80">
                  已收藏 {watchlist.size} 个品种，置顶显示在列表顶部
                </span>
                <button
                  className="ml-auto text-xs text-yellow-500/60 hover:text-yellow-400 underline"
                  onClick={() => setShowWatchlistOnly(true)}
                >
                  仅看自选
                </button>
              </div>
            )}

            {/* 行情表格 */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="px-4 py-3 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-300">
                    {showWatchlistOnly ? `⭐ 自选股 (${watchlist.size})` :
                      searchQuery ? `搜索: "${searchQuery}"` :
                        (MARKET_TYPES.find(t => t.value === selectedType)?.label + ' 行情')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
                    <span className="text-xs text-slate-500">{displayData.length} 条记录 · 实时更新</span>
                  </div>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 w-8"></th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">代码</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">名称</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">最新价</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">涨跌额</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">涨跌幅</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">成交量</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase">走势</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase">类型</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase">详情</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 10 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                          ))}
                        </tr>
                      ))
                    ) : displayData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            {showWatchlistOnly
                              ? <><Star className="w-8 h-8 text-slate-700" /><p className="text-slate-500 text-sm">暂无自选品种</p><p className="text-slate-600 text-xs">点击行情列表中的 ☆ 星号收藏品种</p></>
                              : <><Search className="w-8 h-8 text-slate-700" /><p className="text-slate-500 text-sm">未找到匹配品种</p></>
                            }
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayData.map((item) => {
                        const rt = realtimeMap.get(item.symbol);
                        const price = rt ? rt.price : parseFloat(item.price);
                        const changeVal = rt ? rt.changeVal : parseFloat(item.changeVal);
                        const changePct = rt ? rt.changePct : parseFloat(item.changePct);
                        const volume = rt ? rt.volume : parseInt(item.volume);
                        const dir = rt ? rt.tickDir : 'neutral';
                        const flashKey = rt ? rt.flashKey : 0;
                        const pos = changePct > 0;
                        const neg = changePct < 0;
                        const isWatched = watchlist.has(item.symbol);
                        const isSelected = selectedSymbol === item.symbol;
                        const sparkData = selectedSymbol === item.symbol
                          ? chartData.map(point => ({ t: Date.parse(point.time) || 0, v: point.price }))
                          : [];
                        // WS 闪烁状态：当有 WS 推送时提供整行和单元格闪烁
                        const wsFlash = wsFlashMap.get(item.symbol);
                        const wsFlashKey = wsFlash ? wsFlash.key : 0;
                        const wsFlashDir = wsFlash ? wsFlash.dir : 'neutral';

                        return (
                          <FlashRow
                            key={item.id}
                            wsFlashKey={wsFlashKey}
                            wsFlashDir={wsFlashDir}
                            isSelected={isSelected}
                            isWatched={isWatched}
                            onClick={() => setSelectedSymbol(isSelected ? null : item.symbol)}
                          >
                            {/* 星号 */}
                            <td className="px-3 py-3">
                              <StarButton symbol={item.symbol} watchlist={watchlist} onToggle={toggleWatchlist} />
                            </td>
                            {/* 代码 */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {isWatched && <span className="w-1 h-1 rounded-full bg-yellow-400 shrink-0" />}
                                <span className="font-mono text-blue-400 font-medium">{item.symbol}</span>
                              </div>
                            </td>
                            {/* 名称 */}
                            <td className="px-4 py-3 text-slate-200 max-w-[160px] truncate">{item.name}</td>
                            {/* 最新价 */}
                            <td className="px-4 py-3 text-right">
                              <PriceCell price={price} dir={dir} flashKey={flashKey} decimals={price >= 100 ? 2 : 4} />
                            </td>
                            {/* 涨跌额 */}
                            <td className={cn("px-4 py-3 text-right font-mono text-xs", pos ? 'text-green-400' : neg ? 'text-red-400' : 'text-slate-400')}>
                              <FlashCell dir={wsFlashDir} wsFlashKey={wsFlashKey} className="font-mono tabular-nums">
                                {pos ? '+' : ''}{changeVal.toFixed(4)}
                              </FlashCell>
                            </td>
                            {/* 涨跌幅 */}
                            <td className="px-4 py-3 text-right">
                              <FlashCell dir={wsFlashDir} wsFlashKey={wsFlashKey}>
                                <ChangePctCell pct={changePct} dir={dir} />
                              </FlashCell>
                            </td>
                            {/* 成交量 */}
                            <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">
                              <FlashCell dir={wsFlashDir} wsFlashKey={wsFlashKey} className="font-mono tabular-nums text-slate-400">
                                {fmtVol(volume)}
                              </FlashCell>
                            </td>
                            {/* Sparkline */}
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                <Sparkline data={sparkData} positive={pos || (!neg)} />
                              </div>
                            </td>
                            {/* 类型 */}
                            <td className="px-4 py-3 text-center">
                              <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                {MARKET_LABELS[item.market] || item.market}
                              </Badge>
                            </td>
                            {/* 详情按钮 */}
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-xs h-6 px-1.5 text-slate-500 hover:text-blue-400"
                                  onClick={(e) => { e.stopPropagation(); openChartModal(item.symbol); }}
                                  title="查看走势图"
                                >
                                  📈
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className={cn("text-xs h-6 px-2", isSelected ? "text-blue-300 bg-blue-500/20" : "text-slate-500 hover:text-blue-400")}
                                  onClick={(e) => { e.stopPropagation(); setSelectedSymbol(isSelected ? null : item.symbol); }}
                                >
                                  {isSelected ? '收起' : '详情'}
                                </Button>
                              </div>
                            </td>
                          </FlashRow>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

        {/* 价格走势弹窗 */}
        {chartModalSymbol && (() => {
          const item = allData.find(d => d.symbol === chartModalSymbol);
          if (!item) return null;
          const rt = mergedRealtimeMap.get(chartModalSymbol);
          const price = rt ? rt.price : parseFloat(item.price);
          const changeVal = rt ? rt.changeVal : parseFloat(item.changeVal);
          const changePct = rt ? rt.changePct : parseFloat(item.changePct);
          return (
            <PriceChartModal
              open={chartModalOpen}
              onOpenChange={setChartModalOpen}
              symbol={chartModalSymbol}
              name={item.name}
              currentPrice={price}
              changePct={changePct}
              changeVal={changeVal}
              chartData={chartData}
              timeRange={historyRange}
              onTimeRangeChange={setHistoryRange}
              available={historyQuery.data?.available ?? false}
              limitation={historyQuery.data?.limitation}
            />
          );
        })()}

          {/* ── 右侧面板 ── */}
          <div className="space-y-4">

            {/* 详情侧边栏 */}
            {selectedSymbol && detailData ? (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="px-4 py-3 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-slate-100">{detailData.symbol}</p>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
                        <StarButton symbol={detailData.symbol} watchlist={watchlist} onToggle={toggleWatchlist} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[160px]">{detailData.name}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-slate-500 hover:text-slate-300 h-7 w-7 p-0" onClick={() => setSelectedSymbol(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Tab 切换 */}
                  <div className="flex gap-1 mt-2">
                    {(['chart', 'detail'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setSidebarTab(tab)}
                        className={cn(
                          "px-3 py-1 rounded text-xs font-medium transition-colors",
                          sidebarTab === tab ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                        )}
                      >
                        {tab === 'chart' ? '走势图' : '详细数据'}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* 实时价格 */}
                  <div>
                    {selectedRt ? (
                      <>
                        <PriceCell price={selectedRt.price} dir={selectedRt.tickDir} flashKey={selectedRt.flashKey} decimals={selectedRt.price >= 100 ? 2 : 4} />
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-sm font-medium font-mono", selectedRt.changeVal > 0 ? 'text-green-400' : 'text-red-400')}>
                            {selectedRt.changeVal > 0 ? '+' : ''}{selectedRt.changeVal.toFixed(4)}
                          </span>
                          <ChangePctCell pct={selectedRt.changePct} dir={selectedRt.tickDir} />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-slate-100 font-mono">{fmt(detailData.price, 4)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-sm font-medium font-mono", parseFloat(detailData.changeVal) > 0 ? 'text-green-400' : 'text-red-400')}>
                            {parseFloat(detailData.changeVal) > 0 ? '+' : ''}{fmt(detailData.changeVal, 4)}
                          </span>
                          <ChangePctCell pct={parseFloat(detailData.changePct)} dir="neutral" />
                        </div>
                      </>
                    )}
                  </div>

                  {sidebarTab === 'chart' ? (
                    <>
                      {/* 真实历史迷你图；没有历史观测时保持空态 */}
                      <div>
                        <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <Activity className="w-3 h-3" />近期真实走势
                        </p>
                        {chartData.length > 0 ? (
                          <div className="h-16 rounded-lg overflow-hidden" style={{ backgroundColor: chartTheme.background }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData.map(point => ({ t: point.time, v: point.price }))} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                                <Area type="monotone" dataKey="v" stroke={isDetailPos ? chartTheme.colors.positive : chartTheme.colors.negative} strokeWidth={1.5} fill={isDetailPos ? chartTheme.colors.positive : chartTheme.colors.negative} fillOpacity={0.15} dot={false} isAnimationActive={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : <div className="h-16 rounded-lg border border-slate-800 flex items-center justify-center text-[11px] text-slate-500">暂无可验证历史数据</div>}
                      </div>

                      {/* 技术分析图表（含 MA/MACD 指标切换） */}
                      <div>
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                          <BarChart2 className="w-3 h-3" />技术分析（日内）
                        </p>
                        <TechnicalChart
                          data={chartData}
                          isPositive={isDetailPos}
                          height={220}
                        />
                        <Button size="sm" variant="outline" className="mt-2 w-full border-blue-800 text-blue-300 hover:bg-blue-950" onClick={() => openChartModal(selectedSymbol)}>
                          <BarChart2 className="mr-1 h-3.5 w-3.5" />打开交互式 K 线图
                        </Button>
                      </div>
                    </>
                  ) : (
                    /* 详细数据 Tab */
                    <div className="space-y-2">
                      {[
                        { label: '品种代码', value: detailData.symbol },
                        { label: '品种名称', value: detailData.name },
                        { label: '品种类型', value: MARKET_LABELS[detailData.market] || detailData.market },
                        { label: '最新价', value: selectedRt ? fmtPrice(selectedRt.price, 4) : fmt(detailData.price, 4) },
                        { label: '涨跌额', value: selectedRt ? (selectedRt.changeVal > 0 ? '+' : '') + selectedRt.changeVal.toFixed(4) : fmt(detailData.changeVal, 4) },
                        { label: '涨跌幅', value: (selectedRt ? (selectedRt.changePct > 0 ? '+' : '') + selectedRt.changePct.toFixed(2) : fmt(detailData.changePct, 2)) + '%' },
                        { label: '成交量', value: fmtVol(selectedRt ? selectedRt.volume : parseInt(detailData.volume)) },
                        { label: '开盘价', value: latestHistory?.open != null ? fmtPrice(latestHistory.open, 4) : '—' },
                        { label: '最高价', value: latestHistory?.high != null ? fmtPrice(latestHistory.high, 4) : '—' },
                        { label: '最低价', value: latestHistory?.low != null ? fmtPrice(latestHistory.low, 4) : '—' },
                        { label: '更新时间', value: detailData.updatedAt ? new Date(detailData.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '-' },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
                          <span className="text-xs text-slate-500">{label}</span>
                          <span className="text-xs text-slate-200 font-mono">{value}</span>
                        </div>
                      ))}
                      {/* 收藏操作 */}
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "w-full mt-2 gap-2",
                          watchlist.has(detailData.symbol)
                            ? "border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                            : "border-slate-700 text-slate-400 hover:text-slate-200"
                        )}
                        onClick={() => toggleWatchlist(detailData.symbol)}
                      >
                        <Star className={cn("w-4 h-4", watchlist.has(detailData.symbol) && "fill-yellow-400")} />
                        {watchlist.has(detailData.symbol) ? '取消收藏' : '加入自选股'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-900 border-slate-700 p-6 text-center">
                <Info className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-slate-500 text-sm">点击任意品种</p>
                <p className="text-slate-600 text-xs mt-1">查看 Sparkline 走势图及详细数据</p>
                {watchlist.size === 0 && (
                  <p className="text-slate-700 text-xs mt-3">点击 ☆ 星号收藏品种到自选股</p>
                )}
              </Card>
            )}

            {/* 涨跌幅排行 */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="px-4 py-3 border-b border-slate-700">
                <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" />涨跌幅排行
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {topMovers.map((item, idx) => {
                  const rt = mergedRealtimeMap.get(item.symbol);
                  const price = rt ? rt.price : parseFloat(item.price);
                  const pct = rt ? rt.changePct : parseFloat(item.changePct);
                  const dir = rt ? rt.tickDir : 'neutral';
                  const pos = pct > 0;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedSymbol(item.symbol === selectedSymbol ? null : item.symbol)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-4">{idx + 1}</span>
                        <div>
                          <p className="text-xs font-mono text-blue-400">{item.symbol}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[80px]">{item.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-xs font-mono", dir === 'up' ? 'text-green-300' : dir === 'down' ? 'text-red-300' : 'text-slate-200')}>
                          {fmtPrice(price, price >= 100 ? 2 : 4)}
                        </p>
                        <p className={cn("text-xs font-mono font-medium", pos ? 'text-green-400' : 'text-red-400')}>
                          {pos ? '+' : ''}{pct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 市场涨跌分布 */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="px-4 py-3 border-b border-slate-700">
                <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />市场涨跌分布
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={Object.entries(marketStats).map(([market, stat]) => ({
                        market: MARKET_LABELS[market] || market,
                        涨: stat.up,
                        跌: stat.down,
                      }))}
                      margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis dataKey="market" stroke={chartTheme.axis} tick={{ fontSize: 10, fill: chartTheme.axisLabel }} tickLine={false} />
                      <YAxis stroke={chartTheme.axis} tick={{ fontSize: 10, fill: chartTheme.axisLabel }} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: chartTheme.tooltip.background, border: `1px solid ${chartTheme.tooltip.border}`, borderRadius: '6px', fontSize: '11px' }} />
                      <Area type="monotone" dataKey="涨" stroke={chartTheme.colors.positive} fill={chartTheme.gradients.positive} strokeWidth={1.5} />
                      <Area type="monotone" dataKey="跌" stroke={chartTheme.colors.negative} fill={chartTheme.gradients.negative} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div></div>
  );
}

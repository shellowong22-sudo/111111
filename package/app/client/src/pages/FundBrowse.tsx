import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart2, Filter, Search, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useModuleLiveFeed, type ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { trpc } from '@/lib/trpc';
import {
  collectOpenBBDatasetRows,
  formatDatasetNumber,
  readDatasetNumber,
  readDatasetText,
} from '@/lib/openbbDataset';

type FundRow = {
  key: string;
  id: string;
  name: string;
  category: string;
  manager: string;
  aum: number | null;
  nav: number | null;
  navChange: number | null;
  navChangePercent: number | null;
  yieldValue: number | null;
  expense: number | null;
  rating: string;
  stars: number | null;
  region: string;
  currency: string;
  date: string | null;
  provider: string;
  observedAt: string | null;
  realtimeStatus: string;
  quality: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  债券: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  股票: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  ETF: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  混合: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  另类: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

const ETF_WATCHLIST = ['SPY', 'QQQ', 'IWM', 'EFA', 'EEM', 'TLT', 'GLD', 'HYG', 'LQD', 'VTI', 'XLF', 'XLK'] as const;

function mapFunds(items: ModuleLiveFeedItem[]) {
  const rawRows = collectOpenBBDatasetRows(items);
  const allRows: FundRow[] = rawRows.map(row => {
    const values = row.values;
    const id = readDatasetText(values, ['symbol', 'ticker', 'fund_symbol', 'fund_id', 'isin', 'cusip', 'id'], row.key);
    return {
      key: row.key,
      id,
      name: readDatasetText(values, ['name', 'fund_name', 'security_name', 'long_name', 'title'], id),
      category: readDatasetText(values, ['category', 'fund_type', 'asset_class', 'security_type', 'style'], '未分类'),
      manager: readDatasetText(values, ['manager', 'fund_manager', 'issuer', 'company', 'investment_company']),
      aum: readDatasetNumber(values, ['aum', 'assets_under_management', 'total_assets', 'net_assets']),
      nav: readDatasetNumber(values, ['nav', 'net_asset_value', 'price', 'close', 'last_price', 'last']),
      navChange: readDatasetNumber(values, ['nav_change', 'change', 'change_value', 'price_change']),
      navChangePercent: readDatasetNumber(values, ['nav_change_percent', 'change_percent', 'percent_change', 'change_pct', 'return_1d']),
      yieldValue: readDatasetNumber(values, ['yield', 'distribution_yield', 'dividend_yield', 'yield_percent', 'return_ytd']),
      expense: readDatasetNumber(values, ['expense', 'expense_ratio', 'net_expense_ratio', 'management_fee']),
      rating: readDatasetText(values, ['rating', 'credit_rating', 'morningstar_rating'], '未评级'),
      stars: readDatasetNumber(values, ['stars', 'star_rating', 'morningstar_stars']),
      region: readDatasetText(values, ['region', 'country', 'domicile', 'market', 'exchange'], '未提供'),
      currency: readDatasetText(values, ['currency', 'currency_code'], ''),
      date: (() => {
        const value = readDatasetText(values, ['date', 'as_of_date', 'period_ending', 'timestamp'], '');
        return value || null;
      })(),
      provider: row.provider,
      observedAt: row.observedAt,
      realtimeStatus: row.realtimeStatus,
      quality: row.quality,
    };
  });

  const canonical = new Map<string, FundRow>();
  for (const row of allRows) {
    const identity = row.id.toLocaleUpperCase();
    const existing = canonical.get(identity);
    if (!existing) canonical.set(identity, row);
    else canonical.set(identity, {
      ...existing,
      ...Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null && value !== '' && value !== '未提供' && value !== '未分类' && value !== '未评级')),
      key: existing.key,
      id: existing.id,
    } as FundRow);
  }

  const history = new Map<string, Array<{ date: string; value: number }>>();
  for (const row of allRows) {
    if (!row.date || row.nav === null) continue;
    const key = row.id.toLocaleUpperCase();
    const values = history.get(key) ?? [];
    values.push({ date: row.date, value: row.nav });
    history.set(key, values);
  }
  history.forEach(values => values.sort((a, b) => Date.parse(a.date) - Date.parse(b.date)));
  return { funds: [...canonical.values()], history };
}

type Delivery = {
  items: ModuleLiveFeedItem[];
  connection: 'connecting' | 'live' | 'fallback';
  receivedAt: string | null;
  isLoading: boolean;
  refetch: () => unknown;
};

export function buildFundDetailHistory(points: Array<{ date: string; value: number | null }>) {
  const byDate = new Map<string, number>();
  for (const point of points) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(point.date) &&
      typeof point.value === 'number' && Number.isFinite(point.value) && point.value > 0) {
      byDate.set(point.date, point.value);
    }
  }
  const ordered = [...byDate].sort(([a], [b]) => a.localeCompare(b));
  return ordered.map(([date, value], index) => ({
    date,
    value,
    changePercent: index > 0
      ? (value / ordered[index - 1][1] - 1) * 100
      : null,
  }));
}

export function chooseFundPageCandidates<T extends { id: string; name: string; category: string }>(
  archiveRows: T[],
  mappedRows: T[],
  category: string,
  query: string,
  archivePage: number,
) {
  if (category !== 'all' && category !== '开放式基金') {
    return { rows: mappedRows.filter(row => row.category === category) };
  }
  // The archive endpoint is already paginated. Never append the entire mapped
  // catalogue to every archive page. An explicit search can add matching
  // overseas ETFs to page one without duplicating an archived identifier.
  const supplemental = query && archivePage === 0 && category === 'all'
    ? mappedRows.filter(row => row.category === 'ETF' &&
        `${row.id} ${row.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    : [];
  const seen = new Set(archiveRows.map(row => row.id.toLocaleUpperCase()));
  return { rows: [...archiveRows, ...supplemental.filter(row => !seen.has(row.id.toLocaleUpperCase()))] };
}

export function selectVisibleFund<T extends { id: string }>(visibleFunds: T[], selectedId: string | null): T | null {
  return visibleFunds.find(fund => fund.id === selectedId) ?? null;
}

function FundWorkspace({ items, connection, receivedAt, isLoading, refetch }: Delivery) {
  const [, navigate] = useLocation();
  const initialSearch = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('search') ?? '').trim().slice(0, 80)
    : '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [archiveQuery, setArchiveQuery] = useState(initialSearch);
  const [archivePage, setArchivePage] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setArchiveQuery(searchQuery.trim());
      setArchivePage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('aum');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  useEffect(() => {
    setSelectedFundId(null);
  }, [archivePage, categoryFilter, regionFilter, searchQuery]);
  const archiveSearch = trpc.freeMarketData.searchFundArchive.useQuery(
    { query: archiveQuery, page: archivePage, limit: 50 },
    { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const etfQuotes = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    { tickers: [...ETF_WATCHLIST], range: '1mo', includeHistory: true },
    { staleTime: 60_000, refetchInterval: 5 * 60_000, refetchOnWindowFocus: true, retry: 1 },
  );
  const mapped = useMemo(() => {
    const base = mapFunds(items);
    const supplementRows: FundRow[] = [];
    const supplementHistory = new Map<string, Array<{ date: string; value: number }>>();
    for (const row of etfQuotes.data?.rows ?? []) {
      if (row.status !== 'available' || typeof row.price !== 'number' || !Number.isFinite(row.price)) continue;
      const ticker = String(row.ticker ?? '').trim().toUpperCase();
      if (!ticker) continue;
      const history = Array.isArray(row.history)
        ? row.history.flatMap((point: any) => typeof point?.date === 'string' && typeof point?.value === 'number' && Number.isFinite(point.value) ? [{ date: point.date, value: point.value }] : [])
        : [];
      if (history.length) supplementHistory.set(ticker, history);
      supplementRows.push({
        key: `watchlist-etf-${ticker}`,
        id: ticker,
        name: row.securityName || ticker,
        category: 'ETF',
        manager: '',
        aum: null,
        nav: row.price,
        navChange: null,
        navChangePercent: typeof row.changePct === 'number' && Number.isFinite(row.changePct) ? row.changePct : null,
        yieldValue: null,
        expense: null,
        rating: '未评级',
        stars: null,
        region: '全球',
        currency: row.currency ?? '',
        date: row.latestDate ?? null,
        provider: '公开行情观察',
        observedAt: row.latestDate ?? null,
        realtimeStatus: row.realtime ? 'realtime' : 'daily',
        quality: row.quality ?? 'source-observed',
      });
    }
    const canonical = new Map(base.funds.map(fund => [fund.id.toLocaleUpperCase(), fund]));
    for (const row of supplementRows) {
      if (!canonical.has(row.id.toLocaleUpperCase())) canonical.set(row.id.toLocaleUpperCase(), row);
    }
    const history = new Map(base.history);
    for (const [key, values] of supplementHistory) if (!history.has(key)) history.set(key, values);
    return { funds: [...canonical.values()], history };
  }, [items, etfQuotes.data]);
  const availableEtfQuotes = (etfQuotes.data?.rows ?? []).filter((row) => row.status === 'available').length;
  const datedEtfNavs = mapped.funds.filter(fund => fund.category === 'ETF' && fund.nav !== null).length;
  const archiveRows: FundRow[] = (archiveSearch.data?.rows ?? []).map(row => ({
    key: `open-fund-${row.code}`, id: row.code, name: row.name, category: '开放式基金',
    manager: '', aum: null, nav: row.netAssetValue, navChange: null,
    navChangePercent: null, yieldValue: null, expense: null, rating: '未评级',
    stars: null, region: '中国', currency: row.currency, date: row.observationDate,
    provider: '基金净值观察', observedAt: row.observationDate, realtimeStatus: '交易日净值',
    quality: '已归档',
  }));
  const categories = useMemo(() => [...new Set(mapped.funds.map(fund => fund.category))].sort(), [mapped.funds]);
  const regions = useMemo(() => [...new Set(mapped.funds.map(fund => fund.region))].sort(), [mapped.funds]);
  const stats = useMemo(() => {
    const byCategory = new Map<string, { count: number; yields: number[]; returns: number[] }>();
    for (const fund of mapped.funds) {
      const current = byCategory.get(fund.category) ?? { count: 0, yields: [], returns: [] };
      current.count += 1;
      if (fund.yieldValue !== null) current.yields.push(fund.yieldValue);
      if (fund.navChangePercent !== null) current.returns.push(fund.navChangePercent);
      byCategory.set(fund.category, current);
    }
    const aumValues = mapped.funds.map(fund => fund.aum).filter((value): value is number => value !== null);
    const expenseValues = mapped.funds.map(fund => fund.expense).filter((value): value is number => value !== null);
    return {
      byCategory: [...byCategory.entries()],
      totalAum: aumValues.length ? aumValues.reduce((sum, value) => sum + value, 0) : null,
      avgExpense: expenseValues.length ? expenseValues.reduce((sum, value) => sum + value, 0) / expenseValues.length : null,
    };
  }, [mapped.funds]);

  const sortedFunds = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const candidates = chooseFundPageCandidates(archiveRows, mapped.funds, categoryFilter, query, archivePage);
    const filtered = candidates.rows.filter(fund => {
      const matchSearch = !query || [fund.name, fund.manager, fund.id].some(value => value.toLocaleLowerCase().includes(query));
      return matchSearch && (categoryFilter === 'all' || fund.category === categoryFilter) && (regionFilter === 'all' || fund.region === regionFilter);
    });
    const numeric = (fund: FundRow) => {
      if (sortBy === 'yield') return fund.yieldValue;
      if (sortBy === 'return') return fund.navChangePercent;
      if (sortBy === 'expense') return fund.expense;
      if (sortBy === 'nav') return fund.nav;
      if (sortBy === 'stars') return fund.stars;
      return fund.aum;
    };
    return filtered.slice().sort((left, right) => {
      const a = numeric(left);
      const b = numeric(right);
      if (a === null && b === null) return left.name.localeCompare(right.name);
      if (a === null) return 1;
      if (b === null) return -1;
      return sortDir === 'desc' ? b - a : a - b;
    });
  }, [mapped.funds, archiveRows, searchQuery, categoryFilter, regionFilter, sortBy, sortDir, archivePage]);
  const localCategory = categoryFilter !== 'all' && categoryFilter !== '开放式基金';
  const displayedFunds = localCategory ? sortedFunds.slice(archivePage * 50, (archivePage + 1) * 50) : sortedFunds;
  const fundPageTotal = localCategory ? sortedFunds.length : archiveSearch.data?.total ?? 0;
  const selectedFund = selectVisibleFund(displayedFunds, selectedFundId);
  const etfSessionQuery = trpc.equityListings.etfSessionQuote.useQuery(
    { symbol: selectedFund?.category === 'ETF' && /^[A-Za-z]{1,6}$/.test(selectedFund.id) ? selectedFund.id : 'SPY' },
    {
      enabled: selectedFund?.category === 'ETF' && /^[A-Za-z]{1,6}$/.test(selectedFund.id),
      staleTime: 0,
      refetchInterval: query => {
        const quote = query.state.data?.quote;
        return quote?.providerRealtime && Date.now() - Date.parse(quote.observedAt) <= 90_000 ? 1_000 : 15_000;
      },
      refetchIntervalInBackground: false,
      refetchOnReconnect: true,
      retry: false,
    },
  );
  const etfQuote = etfSessionQuery.data?.quote;
  const currentEtfTrade = etfQuote && etfQuote.symbol === selectedFund?.id?.toUpperCase() &&
    Date.now() - Date.parse(etfQuote.observedAt) <= 90_000 ? etfQuote : null;
  const archiveDetail = trpc.freeMarketData.fundArchiveDetail.useQuery(
    { code: selectedFund?.category === '开放式基金' && /^\d{6}$/.test(selectedFund.id) ? selectedFund.id : '000000' },
    { enabled: Boolean(selectedFund?.category === '开放式基金' && /^\d{6}$/.test(selectedFund.id)), staleTime: 60_000 },
  );
  const selectedFundHistory = selectedFund?.category === '开放式基金'
    ? (archiveDetail.data ?? []).map(point => ({ date: point.observationDate, value: point.netAssetValue }))
    : selectedFund ? mapped.history.get(selectedFund.id.toLocaleUpperCase()) ?? [] : [];
  const detailHistory = buildFundDetailHistory(selectedFundHistory);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(direction => direction === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };
  const SortIcon = ({ col }: { col: string }) => <span className={sortBy === col ? 'ml-1 text-emerald-400' : 'ml-1 text-slate-600'}>{sortBy === col ? sortDir === 'desc' ? '↓' : '↑' : '↕'}</span>;

  return <div className="bg-slate-950 text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
      <div><h1 className="flex items-center gap-2 text-lg font-bold"><BarChart2 className="h-5 w-5 text-emerald-400" />基金浏览</h1><p className="mt-0.5 text-xs text-slate-400">浏览、筛选和对比全球各类基金产品</p></div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400"><span>开放式基金归档 <b className="text-slate-100">{archiveSearch.data?.total?.toLocaleString() ?? '读取中'}</b> 只{archiveSearch.data?.partial ? '（部分归档）' : ''}</span><span>ETF净值 <b className="text-cyan-300">{datedEtfNavs}</b> 条</span><span>海外ETF价格 <b className="text-cyan-300">{availableEtfQuotes}</b> 条</span><span className={connection === 'live' ? 'text-emerald-300' : connection === 'connecting' ? 'text-amber-300' : 'text-rose-300'}>{connection === 'live' ? '归档连接' : connection === 'connecting' ? '连接中' : '轮询补收'}</span><span>接收 {receivedAt ? new Date(receivedAt).toLocaleString() : '未接收'}</span><Button type="button" size="sm" variant="outline" onClick={() => { void refetch(); void etfQuotes.refetch(); void archiveSearch.refetch(); }} className="h-7 border-gray-700 bg-transparent text-[11px]">刷新</Button></div>
    </header>

    <div className="overflow-x-auto border-b border-slate-800 bg-black/30"><table className="min-w-full text-left text-[11px]"><thead className="text-slate-500"><tr><th className="px-3 py-1.5">类型</th><th>基金数</th><th>平均收益率</th><th>平均日涨跌</th><th>总管理规模</th><th>均费用率</th></tr></thead><tbody>{stats.byCategory.length ? stats.byCategory.map(([category, value], index) => <tr key={category} className="border-t border-slate-900"><td className="px-3 py-1.5"><button type="button" onClick={() => { setCategoryFilter(categoryFilter === category ? 'all' : category); setArchivePage(0); }} className="text-cyan-300 hover:underline">{category}基金</button></td><td className="font-mono">{value.count}</td><td className="font-mono">{value.yields.length ? `${formatDatasetNumber(value.yields.reduce((sum, item) => sum + item, 0) / value.yields.length)}%` : '—'}</td><td className="font-mono">{value.returns.length ? `${formatDatasetNumber(value.returns.reduce((sum, item) => sum + item, 0) / value.returns.length)}%` : '—'}</td>{index === 0 && <><td rowSpan={stats.byCategory.length} className="border-l border-slate-800 font-mono">{stats.totalAum === null ? '—' : stats.totalAum.toLocaleString()}</td><td rowSpan={stats.byCategory.length} className="font-mono">{stats.avgExpense === null ? '—' : `${formatDatasetNumber(stats.avgExpense)}%`}</td></>}</tr>) : <tr><td colSpan={6} className="px-3 py-3 text-slate-500">当前数据源未返回可计算的基金统计。</td></tr>}</tbody></table></div>

    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
      <Filter className="h-4 w-4 text-emerald-400" /><span className="mr-2 text-xs text-slate-400">筛选条件</span>
      <div className="relative min-w-64 flex-1"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" /><Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="搜索全库基金代码/名称..." className="h-8 border-slate-700 bg-black pl-8 text-xs" /></div>
      <Button type="button" size="sm" variant="outline" className="h-8 border-slate-700 bg-black text-xs" disabled={archivePage === 0 || (!localCategory && archiveSearch.isFetching)} onClick={() => setArchivePage(page => Math.max(0, page - 1))}>上一页</Button>
      <span className="text-[11px] text-slate-400">第 {archivePage + 1} 页 · 每页 50 只{!localCategory && ' · 当前页排序'}</span>
      <Button type="button" size="sm" variant="outline" className="h-8 border-slate-700 bg-black text-xs" disabled={(archivePage + 1) * 50 >= fundPageTotal || (!localCategory && archiveSearch.isFetching)} onClick={() => setArchivePage(page => page + 1)}>下一页</Button>
      <Select value={categoryFilter} onValueChange={value => { setCategoryFilter(value); setArchivePage(0); }}><SelectTrigger className="h-8 w-40 border-slate-700 bg-black text-xs"><SelectValue placeholder="基金类型" /></SelectTrigger><SelectContent><SelectItem value="all">全部类型</SelectItem>{[...new Set([...categories, '开放式基金'])].map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
      <Select value={regionFilter} onValueChange={value => { setRegionFilter(value); setArchivePage(0); }}><SelectTrigger className="h-8 w-40 border-slate-700 bg-black text-xs"><SelectValue placeholder="投资地区" /></SelectTrigger><SelectContent><SelectItem value="all">全部地区</SelectItem>{regions.map(region => <SelectItem key={region} value={region}>{region}</SelectItem>)}</SelectContent></Select>
      <Select value={sortBy} onValueChange={value => { setSortBy(value); setSortDir('desc'); }}><SelectTrigger className="h-8 w-40 border-slate-700 bg-black text-xs"><SelectValue placeholder="排序方式" /></SelectTrigger><SelectContent><SelectItem value="aum">规模排序</SelectItem><SelectItem value="yield">收益率排序</SelectItem><SelectItem value="return">日涨跌排序</SelectItem><SelectItem value="expense">费用率排序</SelectItem><SelectItem value="nav">净值排序</SelectItem><SelectItem value="stars">评星排序</SelectItem></SelectContent></Select>
    </div>

    <div className="overflow-auto"><Table className="min-w-[1320px]"><TableHeader><TableRow className="border-slate-800 hover:bg-transparent"><TableHead>基金名称</TableHead><TableHead>类型</TableHead><TableHead>地区</TableHead><TableHead onClick={() => handleSort('aum')} className="cursor-pointer text-right">规模<SortIcon col="aum" /></TableHead><TableHead onClick={() => handleSort('nav')} className="cursor-pointer text-right">净值<SortIcon col="nav" /></TableHead><TableHead onClick={() => handleSort('return')} className="cursor-pointer text-right">日涨跌<SortIcon col="return" /></TableHead><TableHead>近12月走势</TableHead><TableHead onClick={() => handleSort('yield')} className="cursor-pointer text-right">收益率<SortIcon col="yield" /></TableHead><TableHead onClick={() => handleSort('expense')} className="cursor-pointer text-right">费用率<SortIcon col="expense" /></TableHead><TableHead>评级</TableHead><TableHead onClick={() => handleSort('stars')} className="cursor-pointer">评星<SortIcon col="stars" /></TableHead><TableHead>数据状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{displayedFunds.length ? displayedFunds.map(fund => {
      const history = mapped.history.get(fund.id.toLocaleUpperCase()) ?? [];
      return <TableRow key={fund.id} className="border-slate-900 hover:bg-cyan-950/20"><TableCell><p className="font-semibold">{fund.name}</p><p className="text-[10px] text-slate-500">{fund.id} · {fund.manager}</p></TableCell><TableCell><Badge className={`text-[10px] ${CATEGORY_COLORS[fund.category] ?? 'bg-slate-800 text-slate-300'}`}>{fund.category}</Badge></TableCell><TableCell className="text-xs text-slate-400">{fund.region}</TableCell><TableCell className="text-right font-mono">{formatDatasetNumber(fund.aum, 0)}</TableCell><TableCell className="text-right font-mono">{fund.currency} {formatDatasetNumber(fund.nav, 4)}</TableCell><TableCell className={`text-right font-mono ${fund.navChangePercent !== null && fund.navChangePercent >= 0 ? 'text-[#f2495c]' : fund.navChangePercent !== null ? 'text-[#1fbf75]' : 'text-slate-500'}`}>{fund.navChangePercent !== null && (fund.navChangePercent >= 0 ? <TrendingUp className="mr-1 inline h-3 w-3" /> : <TrendingDown className="mr-1 inline h-3 w-3" />)}{fund.navChangePercent === null ? '—' : `${fund.navChangePercent >= 0 ? '+' : ''}${formatDatasetNumber(fund.navChangePercent)}%`}</TableCell><TableCell>{history.length >= 2 ? <ResponsiveContainer width={90} height={30}><LineChart data={history}><Line type="monotone" dataKey="value" stroke={fund.navChangePercent !== null && fund.navChangePercent < 0 ? '#1fbf75' : '#f2495c'} dot={false} strokeWidth={1.5} /></LineChart></ResponsiveContainer> : <span className="text-[10px] text-slate-600">历史数据不足</span>}</TableCell><TableCell className="text-right font-mono">{fund.yieldValue === null ? '—' : `${formatDatasetNumber(fund.yieldValue)}%`}</TableCell><TableCell className="text-right font-mono">{fund.expense === null ? '—' : `${formatDatasetNumber(fund.expense)}%`}</TableCell><TableCell>{fund.rating}</TableCell><TableCell>{fund.stars === null ? '—' : <span className="inline-flex">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-3 w-3 ${index < Math.max(0, Math.min(5, Math.round(fund.stars!))) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />)}</span>}</TableCell><TableCell className="text-[10px]"><span className={fund.realtimeStatus === 'realtime' ? 'text-emerald-300' : 'text-amber-300'}>{fund.realtimeStatus}</span><br /><span className="text-slate-500">{fund.quality}<br />{fund.observedAt ?? '观测时间未提供'}</span></TableCell><TableCell><div className="flex gap-1"><Button variant="outline" size="sm" className="h-7 border-slate-700 bg-transparent text-[10px]" onClick={() => setSelectedFundId(current => current === fund.id ? null : fund.id)}>详情</Button>{fund.category === '开放式基金' && <><Button variant="outline" size="sm" className="h-7 border-emerald-800 bg-transparent text-[10px]" onClick={() => navigate(`/fund-compare?fund=${encodeURIComponent(fund.id)}`)}>对比</Button><Button variant="outline" size="sm" className="h-7 border-cyan-800 bg-transparent text-[10px]" onClick={() => navigate(`/fund-holdings?id=${encodeURIComponent(fund.id)}`)}>持仓</Button></>}</div></TableCell></TableRow>;
    }) : <TableRow><TableCell colSpan={13} className="py-12 text-center text-slate-500">{isLoading ? '正在加载基金数据…' : items.length ? '当前数据集没有符合基金字段合同的记录，请调整筛选条件。' : '基金数据源未配置或暂不可用；系统未使用静态数字填充。'}</TableCell></TableRow>}</TableBody></Table></div>
    {selectedFund && <section className="border-t border-emerald-900 px-3 py-3 text-xs" aria-label={`${selectedFund.name}实际观察详情`}>
      <div className="flex flex-wrap justify-between gap-2"><strong className="text-emerald-300">{selectedFund.id} · {selectedFund.name}</strong><button type="button" onClick={() => setSelectedFundId(null)} className="text-slate-400 hover:text-white">收起</button></div>
      {selectedFund.category === 'ETF' && <p className="mt-2 text-cyan-200" aria-label="所选 ETF 交易所实际成交">
        {currentEtfTrade
          ? `交易所成交 ${currentEtfTrade.price.toLocaleString('en-US', { maximumFractionDigits: 4 })} USD · ${currentEtfTrade.session === 'pre_market' ? '盘前' : currentEtfTrade.session === 'after_hours' ? '盘后' : '常规'} · ${currentEtfTrade.providerTimestamp} · Nasdaq 来源${currentEtfTrade.providerRealtime ? '标记即时，1 秒复查' : '未标记即时'}；与基金净值分别展示`
          : etfSessionQuery.isFetching ? '正在核验该 ETF 的当前交易所成交…'
            : etfSessionQuery.data?.limitation ?? '该 ETF 当前没有可验证的秒级交易所成交；历史净值不冒充盘中价格。'}
      </p>}
      {archiveDetail.isFetching && selectedFund.category === '开放式基金' ? <p className="mt-3 text-slate-400">正在读取该基金的独立历史归档…</p>
        : detailHistory.length >= 2 ? <>
          <p className="mt-2 text-slate-400">{detailHistory.length} 个不同观察日 · {detailHistory[0].date} 至 {detailHistory.at(-1)?.date} · 相邻变化仅由本基金实际归档净值计算</p>
          <div className="mt-2 h-44" aria-label={`${selectedFund.name}历史净值曲线`}>
            <ResponsiveContainer width="100%" height="100%"><LineChart data={detailHistory}>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={24} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 10 }} width={52} />
              <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155' }} />
              <Line type="monotone" dataKey="value" name="实际净值" stroke="#34d399" dot={false} connectNulls={false} />
            </LineChart></ResponsiveContainer>
          </div>
          <div className="mt-2 max-h-48 overflow-auto"><table className="w-full max-w-lg text-left font-mono text-[11px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="py-1">观察日</th><th className="text-right">实际净值</th><th className="text-right">相邻变化</th></tr></thead><tbody>{detailHistory.slice(-30).reverse().map(point => <tr key={`${selectedFund.id}-${point.date}`} className="border-t border-slate-900"><td className="py-1">{point.date}</td><td className="text-right">{formatDatasetNumber(point.value, 4)}</td><td className={`text-right ${point.changePercent == null ? 'text-slate-500' : point.changePercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{point.changePercent == null ? '—' : `${point.changePercent >= 0 ? '+' : ''}${point.changePercent.toFixed(2)}%`}</td></tr>)}</tbody></table></div>
        </> : <p className="mt-3 text-amber-300">{detailHistory.length === 1 ? `仅有 ${detailHistory[0].date} 一条实际净值观察，无法计算历史变化。` : '该标的尚无已归档净值历史；不生成替代曲线。'}</p>}
    </section>}
    <footer className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-600">* 开放式基金及中国 ETF 单位净值按交易日归档；所选海外 ETF 的当前交易所成交在详情中单独显示。净值并非交易所成交价，缺失字段保持空值。</footer>
  </div>;
}

export default function FundBrowse() {
  const delivery = useModuleLiveFeed('/fund-browse');
  return <FundWorkspace {...delivery} />;
}

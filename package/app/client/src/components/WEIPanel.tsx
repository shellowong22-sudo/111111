import { EnhancedTooltip, CustomCursor } from "@/components/ChartEnhancements";
import {
  useChartLoading,
  ChartWithSkeleton,
  AreaChartSkeleton,
  BarChartSkeleton,
  LineChartSkeleton,
  DashboardSkeleton,
} from "@/components/ChartSkeleton";
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Globe,
  TrendingUp,
  BarChart2,
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Activity,
  BarChart3,
  Newspaper,
  ArrowUpDown,
  Wifi,
  WifiOff,
  Clock3,
  Radio,
  Layers3,
  MapPinned,
  CalendarDays,
  Home,
  LayoutGrid,
  Star,
  CircleDollarSign,
  Diamond,
  Coins,
  Bitcoin,
  Settings2,
  BookOpen,
  FileText,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import CryptoMarket from "@/pages/CryptoMarket";
import WeiMarketScreen from "@/uc/market/WeiMarketScreen";
import { ListingKline, MiniKline } from "@/uc/market/WeiInsights";
import { ReaderDrawer, toNews } from "@/uc/news/kit";
import EconCalendar, { EventDetail, type EconEvent } from "@/uc/news/EconCalendar";
import { fmtPct, fmtPrice, listingToSymbol, toneOf, useNews, usePolled, useTicks } from "@/uc/market/live";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
interface WEIPanelProps {
  onClose?: () => void;
}
const EQUITY_PAGE_SIZE = 30;
const EQUITY_CATALOG_BASELINE_LABEL = "48,756 条证券记录按 40 个国家或地区归入对应市场";
type EquitySortKey = "symbol" | "price" | "changePct" | "volume";
const formatMarketNumber = (
  value: number | null | undefined,
  maximumFractionDigits = 2
) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits });
const formatCompactNumber = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : Intl.NumberFormat("zh-CN", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(value);
const formatTerminalSource = (source: unknown, fallback = "授权行情源") => {
  if (typeof source !== "string" || !source.trim()) return fallback;
  return /ifind|同花顺/i.test(source) ? "授权行情源" : source;
};
const sparkHeights = (history: unknown, changePct: number | null | undefined) => {
  const values = Array.isArray(history)
    ? history.map((point: any) => Number(point?.value)).filter(Number.isFinite).slice(-5)
    : [];
  if (values.length < 2) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map(value => Math.max(3, Math.round(4 + ((value - min) / span) * 9)));
};

type EquityCountryRow = {
  country: string;
  countryCode: string;
  listingCount: number;
};

const EQUITY_REGION_DEFINITIONS = [
  { id: "AMERICAS", label: "美洲", codes: ["US", "CA", "MX", "BR"] },
  {
    id: "EUROPE",
    label: "欧洲",
    codes: ["AT", "CH", "DE", "DK", "ES", "FI", "FR", "GB", "IE", "IS", "IT", "NL", "NO", "PT", "RU", "SE"],
  },
  {
    id: "APAC",
    label: "亚太",
    codes: ["AU", "CN", "HK", "ID", "IN", "JP", "KH", "KR", "LA", "MM", "MY", "NZ", "PH", "SG", "TH", "TW", "VN"],
  },
  { id: "MEA", label: "中东 / 非洲", codes: ["AE", "IL", "SA"] },
] as const;

const REGION_ID_BY_MARKET_NODE: Record<string, string> = {
  美股: "AMERICAS",
  欧洲: "EUROPE",
  欧股: "EUROPE",
  亚太: "APAC",
  A股: "APAC",
  港股: "APAC",
};

const WEI_SIDEBAR_ITEMS = [
  { label: "首页", icon: Home },
  { label: "市场概览", icon: LayoutGrid },
  { label: "自选股", icon: Star },
  { label: "美股", icon: CircleDollarSign },
  { label: "A股", icon: Diamond },
  { label: "港股", icon: CircleDollarSign },
  { label: "欧股", icon: LayoutGrid },
  { label: "亚太", icon: Globe },
  { label: "期货", icon: BarChart2 },
  { label: "外汇", icon: CircleDollarSign },
  { label: "大宗商品", icon: Coins },
  { label: "加密货币", icon: Bitcoin },
  { label: "新闻资讯", icon: Newspaper },
  { label: "经济日历", icon: CalendarDays },
  { label: "研报", icon: FileText },
  { label: "设置", icon: Settings2 },
] as const;
/** WEI 行情综合大屏板块与左侧导航的对应关系 */
const SIDEBAR_TO_BOARD: Record<string, string> = {
  首页: "global", 市场概览: "global", 自选股: "global", 美股: "us", A股: "cn", 港股: "hk",
  欧股: "eu", 亚太: "apac", 期货: "futures", 外汇: "fx", 大宗商品: "commodity",
};
const BOARD_TO_SIDEBAR: Record<string, string> = {
  global: "市场概览", us: "美股", cn: "A股", hk: "港股", eu: "欧股", apac: "亚太",
  futures: "期货", fx: "外汇", commodity: "大宗商品",
};
const HEADER_TICKERS = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^DJI", label: "道琼斯" },
  { symbol: "^FTSE", label: "FTSE 100" },
  { symbol: "^GDAXI", label: "DAX" },
  { symbol: "^N225", label: "日经225" },
  { symbol: "^HSI", label: "恒生指数" },
  { symbol: "000001.SH", label: "上证指数" },
];

function readInitialEquitySelection() {
  if (typeof window === "undefined")
    return {
      tab: "chart" as const,
      countryCode: "ALL",
      query: "",
      selectedEquityKey: null as string | null,
    };
  const params = new URLSearchParams(window.location.search);
  const countryCode = params.get("country")?.trim().toUpperCase() ?? "ALL";
  const symbol = params.get("symbol")?.trim() ?? "";
  return {
    tab: "chart" as const,
    countryCode,
    query: symbol,
    selectedEquityKey:
      symbol && countryCode !== "ALL" ? `${countryCode}-${symbol}` : null,
  };
}
export default function WEIPanel({ onClose }: WEIPanelProps) {
  const [initialSelection] = useState(readInitialEquitySelection);
  // The workbench is intentionally single-entry; legacy content branches stay
  // compiled for data compatibility but have no reachable navigation entry.
  const [tab] = useState<"chart" | "components" | "equities">(initialSelection.tab);
  const [countryCode, setCountryCode] = useState(initialSelection.countryCode);
  const [equitySearch, setEquitySearch] = useState(initialSelection.query);
  const [equityPage, setEquityPage] = useState(0);
  const [selectedEquityKey, setSelectedEquityKey] = useState<string | null>(
    initialSelection.selectedEquityKey
  );
  const [quoteRange, setQuoteRange] = useState<
    "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y"
  >("1mo");
  const [newsRequested, setNewsRequested] = useState(false);
  const [equitySort, setEquitySort] = useState<{
    key: EquitySortKey;
    direction: "asc" | "desc";
  }>({ key: "symbol", direction: "asc" });
  const [wideEquityDesk, setWideEquityDesk] = useState(true);
  const [deskRange, setDeskRange] = useState<"1mo" | "3mo" | "6mo" | "1y">("1mo");
  const [deskRegion, setDeskRegion] = useState("全部");
  const [deskUniverse, setDeskUniverse] = useState<"ALL" | "US" | "CN" | "HK">("ALL");
  const [deskSearch, setDeskSearch] = useState("");
  const [activeSidebarItem, setActiveSidebarItem] = useState("市场概览");
  const [weiBoard, setWeiBoard] = useState("global");
  useEffect(() => {
    const board = SIDEBAR_TO_BOARD[activeSidebarItem];
    if (board) setWeiBoard(board);
  }, [activeSidebarItem]);
  const headerTicks = useTicks(HEADER_TICKERS.map(item => item.symbol));
  const globalNews = useNews("^GSPC", "全球股市 财经");
  const [newsReading, setNewsReading] = useState<ReturnType<typeof toNews> | null>(null);
  const [econPick, setEconPick] = useState<EconEvent | null>(null);
  const [expandedCountryRegions, setExpandedCountryRegions] = useState<Record<string, boolean>>({});
  const [selectedDeskId, setSelectedDeskId] = useState("SPX");
  const loading = useChartLoading(600);
  const environmentQuery = trpc.stockMarketResearch.getEnvironment.useQuery(
    undefined,
    {
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
    }
  );
  const environmentSeries = (environmentQuery.data?.series ?? []) as Array<any>;
  const equitySeries = environmentSeries.find(row => row.id === "SP500");
  const currentIndexValue =
    typeof equitySeries?.value === "number" ? equitySeries.value : null;
  const weiHistory = useMemo(() => {
    const points = Array.isArray(equitySeries?.history)
      ? equitySeries.history.slice(-52)
      : [];
    return points
      .map((point: any, index: number, rows: any[]) => {
        const value = Number(point.value);
        const trendWindow = rows
          .slice(Math.max(0, index - 3), index + 1)
          .map((row: any) => Number(row.value))
          .filter(Number.isFinite);
        return {
          w: point.date,
          wei: Number.isFinite(value) ? value : null,
          trend: trendWindow.length
            ? trendWindow.reduce((sum, item) => sum + item, 0) /
              trendWindow.length
            : null,
        };
      })
      .filter((point: any) => Number.isFinite(point.wei));
  }, [equitySeries?.history]);
  const componentRows = environmentSeries.map((row: any) => ({
    name: row.label ?? row.id,
    value: Number.isFinite(Number(row.value)) ? Number(row.value) : null,
    change: Number.isFinite(Number(row.change)) ? Number(row.change) : null,
    date: row.observationDate ?? "观察日未返回",
    source: row.source ?? environmentQuery.data?.sourceLabel ?? "来源未返回",
  }));
  const globalDeskProcedure = (trpc.equityListings as any).globalDesk;
  const globalDeskQuery = globalDeskProcedure?.useQuery
    ? globalDeskProcedure.useQuery(
        { range: deskRange },
        { staleTime: 30_000, refetchInterval: 60_000, refetchOnReconnect: true }
      )
    : {
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: () => Promise.resolve(),
      };
  const economicCalendarProcedure = (trpc.legacyMarketData as any)?.getEconomicCalendarOfficialObservations;
  const economicCalendarQuery = economicCalendarProcedure?.useQuery
    ? economicCalendarProcedure.useQuery(undefined, {
        enabled: tab === "chart",
        staleTime: 60_000,
        refetchInterval: 60_000,
        refetchOnReconnect: true,
      })
    : { data: undefined, isFetching: false };
  const deskIndices = useMemo(() => {
    const raw = (globalDeskQuery.data?.indices ?? []) as Array<any>;
    const fallbackSeries: Record<string, string> = { SPX: "SP500", IXIC: "NASDAQCOM" };
    return raw.map(row => {
      if (row.status === "available") return row;
      const fallback = environmentSeries.find(item => item.id === fallbackSeries[row.id]);
      const latest = fallback?.history?.at?.(-1);
      const prior = fallback?.history?.at?.(-2);
      if (!fallback || fallback.status !== "available" || !Number.isFinite(Number(fallback.value))) return row;
      const change = Number.isFinite(Number(fallback.change))
        ? Number(fallback.change)
        : latest && prior ? Number(latest.value) - Number(prior.value) : null;
      const changePct = change !== null && prior && Number(prior.value) !== 0
        ? (change / Number(prior.value)) * 100
        : null;
      return {
        ...row,
        status: "available",
        price: Number(fallback.value),
        change,
        changePct,
        currency: null,
        source: fallback.source ?? environmentQuery.data?.sourceLabel ?? "FRED",
        realtime: false,
        observedAt: fallback.observationDate ?? latest?.date ?? null,
        retrievedAt: fallback.retrievedAt ?? null,
        history: (fallback.history ?? []).map((point: any) => ({ date: point.date, value: point.value })),
      };
    });
  }, [environmentQuery.data?.sourceLabel, environmentSeries, globalDeskQuery.data?.indices]);
  const deskFunds = (globalDeskQuery.data?.funds ?? []) as Array<any>;
  const deskMarkets = (globalDeskQuery.data?.markets ?? {}) as Record<string, Array<any>>;
  const allDeskMarketRows = Object.values(deskMarkets).flat();
  const deskMarketRows = deskUniverse === "ALL"
    ? Object.values(deskMarkets).flat()
    : (deskMarkets[deskUniverse] ?? []);
  const deskRegionNodes = useMemo(() => {
    const indexRegions = ["美股", "欧洲", "亚太"].map(region => {
      const rows = deskIndices.filter(row => row.region === region);
      return {
        id: region,
        label: region,
        total: rows.length,
        available: rows.filter(row => row.status === "available").length,
        latest: rows.find(row => row.status === "available")?.observedAt ?? null,
        source: rows.find(row => row.status === "available")?.source ?? null,
      };
    });
    const marketRegions = ["A股", "港股"].map(region => {
      const rows = allDeskMarketRows.filter(row => row.region === region);
      return { id: region, label: region, total: rows.length, available: rows.filter(row => row.status === "available").length, latest: rows.find(row => row.status === "available")?.observedAt ?? null, source: rows.find(row => row.status === "available")?.source ?? null };
    });
    return [...indexRegions, ...marketRegions];
  }, [allDeskMarketRows, deskIndices]);
  const economicRows = useMemo(
    () => (economicCalendarQuery.data?.observations ?? [])
      .filter((row: any) => row.status === "available" && row.value !== null)
      .sort((left: any, right: any) => String(right.observationDate).localeCompare(String(left.observationDate)))
      .slice(0, 8),
    [economicCalendarQuery.data?.observations],
  );
  const selectedDesk =
    deskIndices.find(row => row.id === selectedDeskId) ?? deskIndices[0] ?? null;
  const selectedDeskHistory = Array.isArray(selectedDesk?.history)
    ? selectedDesk.history
    : [];
  const deskHistory = selectedDeskHistory.length > 1
    ? selectedDeskHistory
    : selectedDesk?.id === "SPX"
      ? weiHistory.map((point: { w: string; wei: number | null }) => ({ date: point.w, value: point.wei, close: point.wei }))
      : [];
  const visibleDeskIndices = deskIndices.filter(row => {
    if (deskUniverse === "CN") return row.id === "SSEC";
    if (deskUniverse === "HK") return row.id === "HSI";
    if (deskUniverse === "US") return row.region === "美股";
    return deskRegion === "全部" || row.region === deskRegion;
  });
  const equityListInput = useMemo(
    () => ({
      countryCode: countryCode === "ALL" ? undefined : countryCode,
      query: equitySearch.trim() || undefined,
      offset: equityPage * EQUITY_PAGE_SIZE,
      limit: EQUITY_PAGE_SIZE,
    }),
    [countryCode, equityPage, equitySearch]
  );
  const countriesQuery = trpc.equityListings.countries.useQuery(undefined, {
    enabled: true,
    staleTime: 300_000,
    refetchOnReconnect: true,
  });
  const equityQuery = trpc.equityListings.list.useQuery(equityListInput, {
    enabled: true,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnReconnect: true,
  });
  const equityRows = equityQuery.data?.rows ?? [];
  const equityTotal = equityQuery.data?.total ?? 0;
  const equityTotalLabel = equityQuery.isLoading
    ? "读取中"
    : equityQuery.isError
      ? "读取失败"
      : `${equityTotal.toLocaleString()} 条`;
  const importedListingCount = useMemo(
    () =>
      (countriesQuery.data ?? []).reduce(
        (total, country) => total + Number(country.listingCount ?? 0),
        0,
      ),
    [countriesQuery.data],
  );
  const countryRows = (countriesQuery.data ?? []) as EquityCountryRow[];
  const catalogCoverageLabel =
    importedListingCount === 48_756 && countryRows.length === 40
      ? EQUITY_CATALOG_BASELINE_LABEL
      : `${importedListingCount.toLocaleString()} 条证券记录按 ${countryRows.length} 个国家或地区归入对应市场`;
  const countryRowsByCode = useMemo(
    () => new Map(countryRows.map(country => [country.countryCode.toUpperCase(), country])),
    [countryRows],
  );
  const countryRegions = useMemo(
    () => EQUITY_REGION_DEFINITIONS.map(region => {
      const countries = region.codes
        .map(code => countryRowsByCode.get(code))
        .filter(Boolean) as EquityCountryRow[];
      return {
        ...region,
        countries,
        listingCount: countries.reduce((sum, country) => sum + Number(country.listingCount ?? 0), 0),
      };
    }),
    [countryRowsByCode],
  );
  const toggleCountryRegion = (regionId: string) =>
    setExpandedCountryRegions(current => ({ ...current, [regionId]: !current[regionId] }));
  const selectCountryFromRegion = (country: EquityCountryRow) => {
    setCountryCode(country.countryCode.toUpperCase());
    setEquityPage(0);
    setSelectedEquityKey(null);
    setNewsRequested(false);
  };
  const selectedCountryLabel =
    countryCode === "ALL"
      ? "全球全部国家/地区"
      : countriesQuery.data?.find(item => item.countryCode === countryCode)?.country ?? countryCode;
  const totalPages = Math.max(1, Math.ceil(equityTotal / EQUITY_PAGE_SIZE));
  const marketMatrixInput = useMemo(
    () => ({
      instruments: equityRows.map(listing => ({
        countryCode: listing.countryCode,
        symbol: listing.symbol,
      })),
    }),
    [equityRows]
  );
  const marketMatrixQuery = trpc.equityListings.marketMatrix.useQuery(
    marketMatrixInput,
    {
      enabled: marketMatrixInput.instruments.length > 0,
      staleTime: 20_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    }
  );
  const marketByKey = useMemo(
    () =>
      new Map(
        (marketMatrixQuery.data?.rows ?? []).map(row => [
          `${row.countryCode}|${row.symbol}`,
          row.market,
        ])
      ),
    [marketMatrixQuery.data?.rows]
  );
  const sortedEquityRows = useMemo(() => {
    const rows = [...equityRows];
    const direction = equitySort.direction === "asc" ? 1 : -1;
    return rows.sort((left, right) => {
      if (equitySort.key === "symbol")
        return left.symbol.localeCompare(right.symbol) * direction;
      const leftMarket = marketByKey.get(`${left.countryCode}|${left.symbol}`);
      const rightMarket = marketByKey.get(
        `${right.countryCode}|${right.symbol}`
      );
      const leftValue = leftMarket?.[equitySort.key] ?? null;
      const rightValue = rightMarket?.[equitySort.key] ?? null;
      if (leftValue == null && rightValue == null)
        return left.symbol.localeCompare(right.symbol);
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      return (leftValue - rightValue) * direction;
    });
  }, [equityRows, equitySort, marketByKey]);
  const selectedListing =
    equityRows.find(
      listing =>
        `${listing.countryCode}-${listing.symbol}` === selectedEquityKey
    ) ?? null;
  const selectedMarket = selectedListing
    ? (marketByKey.get(
        `${selectedListing.countryCode}|${selectedListing.symbol}`
      ) ?? null)
    : null;
  const quoteInput = useMemo(
    () => ({
      countryCode: selectedListing?.countryCode ?? "ZZ",
      symbol: selectedListing?.symbol ?? "__NOT_SELECTED__",
      range: quoteRange,
    }),
    [quoteRange, selectedListing?.countryCode, selectedListing?.symbol]
  );
  const newsInput = useMemo(
    () => ({
      countryCode: selectedListing?.countryCode ?? "ZZ",
      symbol: selectedListing?.symbol ?? "__NOT_SELECTED__",
    }),
    [selectedListing?.countryCode, selectedListing?.symbol]
  );
  const quoteQuery = trpc.equityListings.quote.useQuery(quoteInput, {
    enabled: Boolean(selectedListing),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const sessionQuoteQuery = trpc.equityListings.sessionQuote.useQuery(
    {
      countryCode: selectedListing?.countryCode ?? "ZZ",
      symbol: selectedListing?.symbol ?? "__NOT_SELECTED__",
    },
    {
      enabled: selectedListing?.countryCode === "US",
      staleTime: 0,
      refetchInterval: query => {
        const quote = query.state.data?.quote;
        return quote?.providerRealtime && Date.now() - Date.parse(quote.observedAt) <= 90_000 ? 1_000 : 15_000;
      },
      refetchIntervalInBackground: false,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  );
  const sessionQuote = sessionQuoteQuery.data?.quote &&
    Date.now() - Date.parse(sessionQuoteQuery.data.quote.observedAt) <= 15 * 60_000
    ? sessionQuoteQuery.data.quote : null;
  const liveSessionQuote = sessionQuote?.providerRealtime &&
    Date.now() - Date.parse(sessionQuote.observedAt) <= 90_000 ? sessionQuote : null;
  const newsQuery = trpc.equityListings.news.useQuery(newsInput, {
    enabled: Boolean(selectedListing) && newsRequested,
    refetchOnWindowFocus: false,
  });
  const selectedSecurityHistory = quoteQuery.data?.available && Array.isArray(quoteQuery.data.history)
    ? quoteQuery.data.history
    : [];
  const activeChartHistory = selectedListing ? selectedSecurityHistory : deskHistory;
  const activeChartLabel = selectedListing
    ? `${selectedListing.symbol} · ${selectedListing.name}`
    : (selectedDesk?.label ?? "指数");
  const activeChartSource = selectedListing
    ? formatTerminalSource(quoteQuery.data?.source, selectedListing.country)
    : formatTerminalSource(selectedDesk?.source ?? environmentQuery.data?.sourceLabel);
  const equityMarketRows = useMemo(
    () =>
      sortedEquityRows.map(listing => ({
        id: `${listing.countryCode}-${listing.symbol}`,
        ticker: listing.symbol,
        label: listing.name,
        country: listing.country,
        countryCode: listing.countryCode,
        exchange: listing.exchange,
        market: marketByKey.get(`${listing.countryCode}|${listing.symbol}`) ?? null,
      })),
    [marketByKey, sortedEquityRows],
  );
  // 证券清单当前页的实时报价：价格、涨跌、成交随行情每 3 秒刷新
  const equityLiveTicks = useTicks(equityMarketRows.map(row => listingToSymbol(row.countryCode, row.ticker)));
  const usListingSyms = useMemo(() => equityMarketRows.filter(row => row.countryCode === "US").map(row => listingToSymbol(row.countryCode, row.ticker)).slice(0, 60), [equityMarketRows]);
  const listingSessions = usePolled<Record<string, { pre: { price: number; changePct: number } | null; post: { price: number; changePct: number } | null } | null>>("ucMarket.sessions", usListingSyms.length ? { symbols: usListingSyms } : null, 30_000);
  const liveEquityRows = useMemo(
    () =>
      equityMarketRows.map(row => {
        const tick = equityLiveTicks[listingToSymbol(row.countryCode, row.ticker)];
        if (!tick) return row;
        return {
          ...row,
          market: {
            ...(row.market ?? {}),
            price: tick.price,
            changePct: tick.changePct,
            preClose: tick.prevClose,
            open: tick.open,
            high: tick.high,
            low: tick.low,
            volume: tick.volume,
            amount: tick.amount,
            observedAt: new Date(tick.time).toLocaleString("zh-CN", { hour12: false }),
          } as unknown as NonNullable<typeof row.market>,
        };
      }),
    [equityMarketRows, equityLiveTicks],
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(min-width: 900px)");
    const update = () => setWideEquityDesk(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const changeEquitySort = (key: EquitySortKey) =>
    setEquitySort(current => ({
      key,
      direction:
        current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  const moveEquitySelection = (currentKey: string, delta: number) => {
    const index = sortedEquityRows.findIndex(
      row => `${row.countryCode}-${row.symbol}` === currentKey
    );
    const next = sortedEquityRows[index + delta];
    if (!next) return;
    setSelectedEquityKey(`${next.countryCode}-${next.symbol}`);
    setNewsRequested(false);
  };
  const selectCountryUniverse = (nextCountryCode: string) => {
    setCountryCode(nextCountryCode);
    setEquityPage(0);
    setSelectedEquityKey(null);
    setNewsRequested(false);
  };
  const selectDeskMarket = (market: string) => {
    if (market === "美股") {
      setDeskRegion("美股");
      setDeskUniverse("US");
      setSelectedDeskId("SPX");
      selectCountryUniverse("US");
      return;
    }
    if (market === "欧洲" || market === "欧股") {
      setDeskRegion("欧洲");
      setDeskUniverse("ALL");
      setSelectedDeskId("DAX");
      selectCountryUniverse(
        EQUITY_REGION_DEFINITIONS.find(region => region.id === "EUROPE")?.codes.includes(countryCode as never)
          ? countryCode
          : "GB",
      );
      return;
    }
    if (market === "A股") {
      setDeskRegion("A股");
      setDeskUniverse("CN");
      setSelectedDeskId("SSEC");
      selectCountryUniverse("CN");
      return;
    }
    if (market === "港股") {
      setDeskRegion("港股");
      setDeskUniverse("HK");
      setSelectedDeskId("HSI");
      selectCountryUniverse("HK");
      return;
    }
    if (market === "亚太") {
      setDeskRegion("亚太");
      setDeskUniverse("ALL");
      setSelectedDeskId("N225");
      selectCountryUniverse(
        EQUITY_REGION_DEFINITIONS.find(region => region.id === "APAC")?.codes.includes(countryCode as never)
          ? countryCode
          : "JP",
      );
      return;
    }
    setDeskRegion("全部");
    setDeskUniverse("ALL");
    setSelectedDeskId("SPX");
    selectCountryUniverse("ALL");
  };
  const selectDeskMarketAndReveal = (market: string) => {
    const sidebarMarket = market === "商品" ? "大宗商品" : market === "全球" ? "市场概览" : market;
    if (WEI_SIDEBAR_ITEMS.some(item => item.label === sidebarMarket)) {
      setActiveSidebarItem(sidebarMarket);
    }
    selectDeskMarket(market);
    const regionId = REGION_ID_BY_MARKET_NODE[market];
    if (regionId) {
      setExpandedCountryRegions(current =>
        current[regionId] ? current : { ...current, [regionId]: true }
      );
    }
  };
  const focusWorkbenchSection = (id: string) => {
    if (typeof document === "undefined") return;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const activateSidebarItem = (item: (typeof WEI_SIDEBAR_ITEMS)[number]["label"]) => {
    setActiveSidebarItem(item);
    switch (item) {
      case "首页":
        selectDeskMarketAndReveal("全球");
        focusWorkbenchSection("wei-workbench-root");
        break;
      case "市场概览":
        selectDeskMarketAndReveal("全球");
        focusWorkbenchSection("wei-market-overview");
        break;
      case "自选股":
        selectCountryUniverse("ALL");
        setEquitySearch("");
        focusWorkbenchSection("wei-market-securities");
        break;
      case "美股":
      case "A股":
      case "港股":
      case "欧股":
      case "亚太":
        selectDeskMarketAndReveal(item);
        focusWorkbenchSection("wei-market-overview");
        break;
      case "期货":
      case "外汇":
      case "大宗商品":
        selectDeskMarketAndReveal(item === "大宗商品" ? "商品" : item);
        focusWorkbenchSection("wei-market-overview");
        break;
      case "加密货币":
        focusWorkbenchSection("wei-crypto-market");
        break;
      case "新闻资讯":
        focusWorkbenchSection("wei-global-news");
        break;
      case "经济日历":
        focusWorkbenchSection("wei-economic-calendar");
        break;
      case "研报":
        focusWorkbenchSection("wei-global-news");
        break;
      case "设置":
        focusWorkbenchSection("wei-workbench-status");
        break;
    }
  };
  const deskMarketActive = (market: string) => {
    if (market === "美股") return deskRegion === "美股" && deskUniverse === "US";
    if (market === "欧股") return deskRegion === "欧洲";
    if (market === "A股") return deskUniverse === "CN";
    if (market === "港股") return deskUniverse === "HK";
    if (market === "亚太") return deskRegion === "亚太" && deskUniverse === "ALL";
    return deskRegion === "全部" && deskUniverse === "ALL";
  };
  const topTickerIndices = ["SPX", "IXIC", "DJI", "FTSE", "DAX", "N225"]
    .map(id => deskIndices.find(row => row.id === id))
    .filter(Boolean) as Array<any>;
  const terminalAsOf = globalDeskQuery.data?.queriedAt ?? environmentQuery.data?.retrievedAt ?? null;
  return (
    <div className="flex flex-col h-full bg-[#0a0e1a] text-white text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1220] border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-400" />
          <span className="font-bold text-sm text-teal-400">WEI</span>
          <span className="text-gray-300">全球股票指数</span>
        </div>
        {onClose && (
          <button onClick={onClose}>
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>
      <div className="border-b border-cyan-950 bg-[#061426] px-2 py-1.5">
        <div className="flex min-w-0 items-stretch gap-2 overflow-x-auto">
          <div className="flex min-w-[190px] shrink-0 items-center gap-2 border-r border-cyan-900/70 pr-3">
            <Globe className="h-8 w-8 text-cyan-300" />
            <div className="leading-none">
              <div className="text-[15px] font-semibold tracking-tight text-slate-100">全球股市工作台</div>
              <div className="mt-1 text-[8px] tracking-[0.2em] text-cyan-400">GLOBAL STOCK MARKET TERMINAL</div>
            </div>
          </div>
          {HEADER_TICKERS.map(item => {
            const t = headerTicks[item.symbol];
            const tone = toneOf(t?.changePct);
            return (
              <button
                key={`header-${item.symbol}`}
                type="button"
                onClick={() => setWeiBoard(item.symbol === "000001.SH" ? "cn" : item.symbol === "^HSI" ? "hk" : item.symbol.startsWith("^") && ["^FTSE", "^GDAXI"].includes(item.symbol) ? "eu" : item.symbol === "^N225" ? "apac" : "us")}
                className="min-w-[112px] shrink-0 border-r border-cyan-900/60 px-2 text-left hover:bg-cyan-950/25"
                aria-label={`${item.label}行情`}
              >
                <span className="block truncate text-[9px] font-medium text-slate-300">{item.label}</span>
                <span className="mt-1 block font-mono text-[14px] font-semibold leading-none" style={{ color: tone }}>{fmtPrice(t?.price)}</span>
                <span className="mt-1 block font-mono text-[9px]" style={{ color: tone }}>
                  {t?.change == null ? "—" : `${t.change >= 0 ? "+" : ""}${fmtPrice(t.change)}`} {fmtPct(t?.changePct)}
                </span>
              </button>
            );
          })}
          <div className="ml-auto flex min-w-[210px] shrink-0 flex-col justify-center gap-1 pl-1">
            <div className="flex items-center gap-1 border border-cyan-800/80 bg-[#071c31] px-2 py-1">
              <Search className="h-3.5 w-3.5 text-cyan-300" />
              <input
                value={deskSearch}
                onChange={event => setDeskSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && deskSearch.trim()) {
                    setEquitySearch(deskSearch.trim());
                    setEquityPage(0);
                  }
                }}
                placeholder="搜索股票、指数、代码、新闻…"
                aria-label="搜索股票指数代码或新闻"
                className="h-4 min-w-0 flex-1 bg-transparent text-[9px] text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 text-[8px] text-slate-500">
              <span>{terminalAsOf ? new Date(terminalAsOf).toLocaleString("zh-CN", { hour12: false }) : "数据时间等待"}</span>
              <span>北京时间</span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-teal-950/20 border-b border-teal-800/30 px-3 py-1.5 flex items-center justify-between">
        <span className="text-gray-400 text-[9px]">标普 500 最新观察</span>
        <span className="font-bold text-[14px] font-mono" style={{ color: toneOf(headerTicks["^GSPC"]?.changePct) }}>
          {fmtPrice(headerTicks["^GSPC"]?.price)} <span className="text-[10px]">{fmtPct(headerTicks["^GSPC"]?.changePct)}</span>
        </span>
        <span className="text-gray-500 text-[8px]">
          实时行情 · {headerTicks["^GSPC"]?.time ? new Date(headerTicks["^GSPC"]!.time).toLocaleString("zh-CN", { hour12: false }) : "等待行情"}
        </span>
      </div>
      <div className="flex items-center border-b border-gray-700 bg-[#0b1220] px-3 py-1.5">
        <span className="border-b border-cyan-300 bg-cyan-950/60 px-3 py-1 text-[10px] font-semibold text-cyan-100">佑诚行情终端</span>
        <span className="ml-3 text-[8px] text-slate-500">工作区 / 全球股市 / {activeSidebarItem}</span>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[126px] shrink-0 flex-col border-r border-cyan-950 bg-[#061426] sm:w-[150px]" aria-label="全球股市工作台导航">
          <div className="border-b border-cyan-900/70 px-2 py-3 sm:px-3">
            <div className="flex items-center gap-1.5 text-cyan-100">
              <Globe className="h-5 w-5 shrink-0 text-cyan-300" />
              <span className="truncate text-[11px] font-semibold sm:text-[12px]">全球市场</span>
            </div>
            <div className="mt-1 truncate pl-0.5 text-[7px] tracking-[0.16em] text-cyan-500">GLOBAL MARKET</div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto py-1" aria-label="市场与研究入口">
            {WEI_SIDEBAR_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isSectionBreak = item.label === "新闻资讯";
              return (
                <div key={item.label} className={isSectionBreak ? "mt-2 border-t border-cyan-900/60 pt-2" : ""}>
                  <button
                    type="button"
                    title={item.label}
                    aria-current={activeSidebarItem === item.label ? "page" : undefined}
                    onClick={() => activateSidebarItem(item.label)}
                    className={`flex w-full items-center gap-2 border-l-2 px-2 py-2 text-left text-[10px] transition-colors sm:px-3 sm:text-[11px] ${activeSidebarItem === item.label ? "border-cyan-300 bg-[#0d4b70] text-cyan-50" : "border-transparent text-slate-300 hover:border-cyan-800 hover:bg-[#082d49] hover:text-cyan-100"}`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${activeSidebarItem === item.label ? "text-cyan-200" : "text-cyan-400"}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                </div>
              );
            })}
            <div className="mt-2 border-t border-cyan-900/60 pt-2" aria-label="国家和地区市场树">
              <div className="px-2 pb-1 text-[8px] tracking-[0.16em] text-cyan-500 sm:px-3">国家 / 地区市场</div>
              {countryRegions.map(region => {
                const expanded = Boolean(expandedCountryRegions[region.id]);
                return (
                  <div key={`sidebar-region-${region.id}`}>
                    <button
                      type="button"
                      onClick={() => toggleCountryRegion(region.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-1 px-2 py-1.5 text-left text-[9px] text-slate-300 hover:bg-[#082d49] hover:text-cyan-100 sm:px-3"
                    >
                      <span className="truncate">{expanded ? "▾" : "▸"} {region.label}</span>
                      <span className="shrink-0 font-mono text-[8px] text-slate-600">{region.countries.length}国 · {region.listingCount.toLocaleString()}</span>
                    </button>
                    {expanded && (
                      <div className="border-y border-cyan-950/70 bg-[#05101d] py-0.5">
                        {region.countries.map(country => (
                          <button
                            key={`sidebar-country-${country.countryCode}`}
                            type="button"
                            onClick={() => selectCountryFromRegion(country)}
                            className={`flex w-full items-center justify-between gap-1 px-3 py-1 text-left text-[8px] hover:bg-cyan-950/50 hover:text-cyan-100 sm:px-4 ${countryCode === country.countryCode ? "bg-cyan-950/55 text-cyan-200" : "text-slate-500"}`}
                          >
                            <span className="truncate">{country.country}</span>
                            <span className="shrink-0 font-mono">{Number(country.listingCount).toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto">
        {activeSidebarItem === "加密货币" ? (
          <div id="wei-crypto-market" className="min-w-0" aria-label="WEI 加密货币">
            <CryptoMarket embedded />
          </div>
        ) : tab === "chart" && (
          <div id="wei-workbench-root" className="flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[#07111e] text-[10px] text-slate-200">
            <div id="wei-market-overview" className="order-1 border-b border-cyan-950 bg-[#081a2b] px-2 py-1.5">
              <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap">
                <span className="flex shrink-0 items-center gap-1 border-r border-slate-700 pr-2 text-[11px] font-semibold text-cyan-200">
                  <Globe className="h-3.5 w-3.5 text-cyan-300" /> 全球市场总览
                </span>
                {[
                  "全球", "美股", "A股", "港股", "欧股", "亚太", "期货", "外汇", "商品", "加密货币",
                ].map(label => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => selectDeskMarketAndReveal(label)}
                    className={`shrink-0 border-r border-slate-800 px-2 text-[9px] ${deskMarketActive(label) ? "text-cyan-200" : "text-slate-500 hover:text-slate-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="order-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0a1524] px-2 py-1.5">
              <div className="flex min-w-0 items-center gap-1.5 text-slate-400">
                <Radio className="h-3 w-3 shrink-0 text-cyan-300" />
                <span className="shrink-0">全球股票指数工作台</span>
                <span className="shrink-0 text-slate-600">·</span>
                <span className="min-w-0 truncate">美国每周经济指数（52周）历史观察仍保留在同一工作区</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <select
                  aria-label="全球指数区域"
                  value={deskRegion}
                  onChange={event => selectDeskMarketAndReveal(event.target.value === "全部" ? "全球" : event.target.value)}
                  className="h-6 border border-slate-700 bg-slate-950 px-1.5 text-[9px] text-slate-200"
                >
                  {["全部", "美股", "欧洲", "亚太", "A股", "港股"].map(region => <option key={region}>{region}</option>)}
                </select>
                <select
                  aria-label="全球指数观察区间"
                  value={deskRange}
                  onChange={event => setDeskRange(event.target.value as typeof deskRange)}
                  className="h-6 border border-slate-700 bg-slate-950 px-1.5 text-[9px] text-slate-200"
                >
                  <option value="1mo">1个月</option><option value="3mo">3个月</option><option value="6mo">6个月</option><option value="1y">1年</option>
                </select>
                <button
                  type="button"
                  aria-label="刷新全球指数工作台"
                  onClick={() => { void globalDeskQuery.refetch(); void environmentQuery.refetch(); }}
                  disabled={globalDeskQuery.isFetching || environmentQuery.isFetching}
                  className="flex h-6 items-center gap-1 border border-cyan-800 px-2 text-[9px] text-cyan-100 disabled:opacity-40"
                >
                  <RefreshCw className={`h-3 w-3 ${globalDeskQuery.isFetching ? "animate-spin" : ""}`} />刷新
                </button>
              </div>
            </div>

            <div className="order-3 min-w-0 border-b border-slate-800">
              <WeiMarketScreen
                boardId={weiBoard}
                onBoardChange={id => {
                  setWeiBoard(id);
                  const label = BOARD_TO_SIDEBAR[id];
                  if (label) setActiveSidebarItem(label);
                }}
                focusSymbol={selectedListing ? listingToSymbol(selectedListing.countryCode, selectedListing.symbol) : null}
                focusName={selectedListing?.name ?? null}
              />
            </div>

            <div className="order-4 grid min-w-0 gap-px border-b border-slate-800 bg-slate-800">
              <ReaderDrawer item={newsReading} onClose={() => setNewsReading(null)} />
              <section id="wei-global-news" className="min-w-0 bg-[#07111e]">
                <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1.5"><span className="font-semibold text-cyan-100">全球新闻</span><span className="text-[8px] text-slate-500">实时检索</span></div>
                <div className="max-h-[286px] divide-y divide-slate-800 overflow-auto">{(globalNews.data ?? []).slice(0, 14).map(item => <button type="button" key={item.id} onClick={() => setNewsReading(toNews(item))} className="grid w-full grid-cols-[42px_minmax(0,1fr)] gap-2 px-2 py-1.5 text-left hover:bg-slate-900/60"><span className="font-mono text-[8px] text-slate-500">{new Date(item.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</span><span className="min-w-0"><span className="block truncate text-slate-200">{item.title}</span><span className="block truncate text-[8px]" style={{ color: item.tone > 0 ? "#f2495c" : item.tone < 0 ? "#1fbf75" : "#64748b" }}>{item.tone > 0 ? "利好" : item.tone < 0 ? "利空" : "中性"}{item.tags.length ? ` · ${item.tags.join(" · ")}` : ""}</span></span></button>)}{!globalNews.data?.length && <p className="px-2 py-12 text-center text-slate-500">{globalNews.loading ? "新闻读取中…" : "暂无新闻"}</p>}</div>
              </section>
            </div>

            <div className="order-5 grid min-w-0 gap-px border-b border-slate-800 bg-slate-800 xl:grid-cols-[minmax(0,1.5fr)_minmax(390px,.85fr)]">
              <section id="wei-market-securities" className="min-w-0 overflow-hidden bg-[#07111e]" aria-label="当前国家市场证券行情">
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 px-2 py-1.5">
                  <span className="mr-auto min-w-0 truncate font-semibold text-cyan-100">国家 / 地区个股行情 <span className="ml-1 font-normal text-slate-400">{selectedCountryLabel} · 证券行情 <span className="font-mono text-[8px] text-slate-500">{equityTotalLabel}</span></span></span>
                  <select aria-label="当前市场国家筛选" value={countryCode} onChange={event => event.target.value === "ALL" ? selectDeskMarketAndReveal("全球") : selectCountryFromRegion(countryRows.find(row => row.countryCode === event.target.value)!)} className="h-5 max-w-[170px] border border-cyan-900 bg-slate-950 px-1 text-[8px] text-slate-200">
                    <option value="ALL">全球 · {importedListingCount.toLocaleString()}</option>
                    {countryRows.map(country => <option key={country.countryCode} value={country.countryCode}>{country.country} · {Number(country.listingCount).toLocaleString()}</option>)}
                  </select>
                  <input aria-label="当前市场证券检索" value={equitySearch} onChange={event => { setEquitySearch(event.target.value); setEquityPage(0); setSelectedEquityKey(null); }} placeholder="代码 / 名称" className="h-5 min-w-[120px] border border-slate-700 bg-slate-950 px-1.5 text-[8px] text-slate-100 outline-none placeholder:text-slate-600" />
                  <button type="button" aria-label="刷新当前国家市场行情" onClick={() => { void equityQuery.refetch(); if (marketMatrixInput.instruments.length) void marketMatrixQuery.refetch(); }} disabled={equityQuery.isFetching || marketMatrixQuery.isFetching} className="flex h-5 items-center gap-1 border border-cyan-900 px-1.5 text-[8px] text-cyan-200 disabled:opacity-40"><RefreshCw className={`h-2.5 w-2.5 ${equityQuery.isFetching || marketMatrixQuery.isFetching ? "animate-spin" : ""}`} />刷新</button>
                </div>
                <div className="max-h-[260px] min-w-0 overflow-auto">
                  <table className="w-full min-w-[920px] table-fixed text-left text-[8px]" aria-label="当前国家市场证券行情表">
                    <thead className="sticky top-0 z-10 bg-[#0b1b2d] text-slate-500"><tr><th className="w-[84px] px-2 py-1.5">国家/地区</th><th className="w-[105px]"><button type="button" onClick={() => changeEquitySort("symbol")} className="inline-flex items-center gap-1 hover:text-white">代码 <ArrowUpDown className="h-2.5 w-2.5" /></button></th><th className="w-[170px]">证券名称</th><th className="w-[104px]">日K</th><th className="w-[110px]">交易所</th><th className="w-[70px] text-right"><button type="button" onClick={() => changeEquitySort("price")} className="ml-auto inline-flex items-center gap-1 hover:text-white">最新 <ArrowUpDown className="h-2.5 w-2.5" /></button></th><th className="w-[64px] text-right"><button type="button" onClick={() => changeEquitySort("changePct")} className="ml-auto inline-flex items-center gap-1 hover:text-white">涨跌% <ArrowUpDown className="h-2.5 w-2.5" /></button></th><th className="w-[116px] text-right">{usListingSyms.length ? "盘前 / 盘后" : "买一 / 卖一"}</th><th className="w-[82px] text-right"><button type="button" onClick={() => changeEquitySort("volume")} className="ml-auto inline-flex items-center gap-1 hover:text-white">成交量 <ArrowUpDown className="h-2.5 w-2.5" /></button></th><th className="w-[90px] text-right">成交额</th><th className="w-[130px] px-2">行情时间</th></tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {equityQuery.isLoading && <tr><td colSpan={11} className="px-2 py-8 text-center text-slate-500">正在读取当前市场证券…</td></tr>}
                      {equityQuery.isError && <tr><td colSpan={10} className="px-2 py-8 text-center text-amber-200">当前市场证券读取失败；未使用静态数据替代。</td></tr>}
                      {!equityQuery.isLoading && !equityQuery.isError && liveEquityRows.map(row => { const market = row.market; return <tr key={row.id} onClick={() => { setSelectedEquityKey(row.id); setNewsRequested(false); }} className={`cursor-pointer ${selectedEquityKey === row.id ? "bg-cyan-950/55" : "hover:bg-slate-900"}`}><td className="truncate px-2 py-1.5 text-slate-500">{row.country}</td><td className="truncate"><button type="button" aria-label={`选择 ${row.ticker} ${row.label} 并联动走势图`} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); moveEquitySelection(row.id, 1); } if (event.key === "ArrowUp") { event.preventDefault(); moveEquitySelection(row.id, -1); } }} className="block w-full truncate text-left font-mono text-cyan-200 outline-none focus:bg-cyan-950 focus:ring-1 focus:ring-inset focus:ring-cyan-500">{row.ticker}</button></td><td className="truncate text-slate-200">{row.label}</td><td className="py-0.5"><MiniKline symbol={listingToSymbol(row.countryCode, row.ticker)} /></td><td className="truncate text-slate-500">{row.exchange}</td><td className="text-right font-mono text-slate-100" title={`前收 ${formatMarketNumber(market?.preClose, 2)} / 开 ${formatMarketNumber(market?.open, 2)} / 高 ${formatMarketNumber(market?.high, 2)} / 低 ${formatMarketNumber(market?.low, 2)}`}>{formatMarketNumber(market?.price, 2)}</td><td className={`text-right font-mono ${market?.changePct == null ? "text-slate-600" : market.changePct >= 0 ? "text-rose-400" : "text-emerald-400"}`}>{market?.changePct == null ? "—" : `${market.changePct >= 0 ? "+" : ""}${market.changePct.toFixed(2)}%`}</td><td className="text-right font-mono text-slate-400">{row.countryCode === "US" ? (() => { const ss = listingSessions.data?.[listingToSymbol(row.countryCode, row.ticker)]; const ext = ss?.post ?? ss?.pre; return ext ? <span style={{ color: toneOf(ext.changePct) }}>{ss?.post ? "后" : "前"} {fmtPrice(ext.price)} {fmtPct(ext.changePct)}</span> : "—"; })() : <>{formatMarketNumber(market?.bid1, 2)} / {formatMarketNumber(market?.ask1, 2)}</>}</td><td className="text-right font-mono text-slate-500">{formatCompactNumber(market?.volume)}</td><td className="text-right font-mono text-slate-500">{formatCompactNumber(market?.amount)}</td><td className="truncate px-2 font-mono text-slate-600">{market?.observedAt ?? "未返回"}</td></tr>; })}
                      {!equityQuery.isLoading && !equityQuery.isError && !equityMarketRows.length && <tr><td colSpan={10} className="px-2 py-8 text-center text-amber-200">当前国家和检索条件没有证券记录。</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 px-2 py-1 text-[8px] text-slate-500"><span>第 {equityTotal ? equityPage + 1 : 0} / {equityTotal ? totalPages : 0} 页 · 实时 {Object.values(equityLiveTicks).filter(Boolean).length} / {equityMarketRows.length} · 选择个股联动上方K线</span><div className="flex items-center gap-1"><button type="button" aria-label="上一页当前市场证券" disabled={equityPage <= 0 || equityQuery.isFetching} onClick={() => setEquityPage(page => Math.max(0, page - 1))} className="border border-slate-700 px-2 py-0.5 disabled:opacity-30"><ChevronLeft className="h-3 w-3" /></button><button type="button" aria-label="下一页当前市场证券" disabled={equityPage + 1 >= totalPages || equityQuery.isFetching} onClick={() => setEquityPage(page => Math.min(totalPages - 1, page + 1))} className="border border-slate-700 px-2 py-0.5 disabled:opacity-30"><ChevronRight className="h-3 w-3" /></button></div></div>
              </section>
              <section id="wei-economic-calendar" className="min-w-0 bg-[#07111e]" aria-label="全球经济日历">
                <EconCalendar compact />
                <div className="border-t border-slate-800 px-2 py-1 text-[10px] font-semibold text-cyan-100">官方最新实际值</div>
                <div className="max-h-[200px] overflow-auto"><table className="w-full min-w-[430px] text-left text-[10px]" aria-label="全球经济数据最新实际观察"><tbody className="divide-y divide-slate-800">{economicRows.map((row: any) => <tr key={row.id} onClick={() => setEconPick({ id: String(row.id), date: String(row.observationDate ?? ""), time: null, country: String(row.region), region: String(row.region), name: String(row.label), nameZh: String(row.label), actual: `${Number(row.value).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${row.unit ?? ""}`, consensus: null, previous: null, importance: 2, surprise: null, released: true })} className="cursor-pointer hover:bg-slate-900"><td className="px-2 py-1 text-slate-400">{row.region}</td><td className="max-w-[190px] truncate text-slate-200" title={`${row.institution} · ${row.cadence}`}>{row.label}</td><td className="text-right font-mono text-cyan-200">{Number(row.value).toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-slate-600">{row.unit}</span></td><td className="px-2 text-slate-500">{row.observationDate ?? ""}</td></tr>)}</tbody></table></div>
                {econPick && <EventDetail e={econPick} onClose={() => setEconPick(null)} />}
              </section>
            </div>
            <div id="wei-workbench-status" className="order-6 border-t border-slate-800 px-2 py-1.5 text-[8px] leading-4 text-slate-600">数据链路：授权行情与官方公开数据 → 服务端校验、标准化及去重 → 佑诚行情终端。{catalogCoverageLabel}；缺失值保持为空。</div>
          </div>
        )}
        {tab === "components" && (
          <div className="p-2 overflow-x-auto">
            <div className="mb-1 text-[9px] text-gray-500">
              分项贡献 · 基准矩阵（沿用原 WEI
              口径，仅展示服务器实际返回的环境序列）
            </div>
            <table className="w-full min-w-[640px] text-left text-[10px]">
              <thead className="text-gray-500">
                <tr>
                  <th className="px-2 py-2">环境序列</th>
                  <th>最新值</th>
                  <th>前值差</th>
                  <th>观察日</th>
                </tr>
              </thead>
              <tbody>
                {componentRows.map(row => (
                  <tr key={row.name} className="border-t border-gray-800">
                    <td className="px-2 py-2 text-gray-200">{row.name}</td>
                    <td className="font-mono">
                      {row.value == null ? "—" : row.value.toFixed(4)}
                    </td>
                    <td
                      className={`font-mono ${row.change == null ? "text-gray-500" : row.change >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {row.change == null
                        ? "—"
                        : `${row.change >= 0 ? "+" : ""}${row.change.toFixed(4)}`}
                    </td>
                    <td className="text-gray-500">{row.date}</td>
                  </tr>
                ))}
                {!componentRows.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-8 text-center text-amber-200"
                    >
                      公开环境源未返回分项，不生成固定权重或贡献值。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {tab === "equities" && (
          <div className="flex min-h-full flex-col bg-gray-800 p-px">
            <div className="bg-teal-950/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Database className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-teal-200">
                      全球股票行情工作台
                    </p>
                    <p className="text-[8px] text-gray-500">
                      全球证券按国家市场归档；行情矩阵优先读取已授权行情源。
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[8px]">
                  <span className="font-mono text-teal-300" aria-live="polite">
                    清单 {equityTotalLabel}
                  </span>
                  <span
                    role="status"
                    className={
                      marketMatrixQuery.isError
                        ? "text-red-300"
                        : (marketMatrixQuery.data?.realtimeCount ?? 0) > 0
                          ? "text-green-300"
                          : "text-amber-300"
                    }
                  >
                    {(marketMatrixQuery.data?.realtimeCount ?? 0) > 0 ? (
                      <Wifi className="mr-1 inline h-3 w-3" />
                    ) : (
                      <WifiOff className="mr-1 inline h-3 w-3" />
                    )}
                    授权行情{" "}
                    {marketMatrixQuery.isFetching
                      ? "更新中"
                      : `${marketMatrixQuery.data?.realtimeCount ?? 0} 实时 / ${marketMatrixQuery.data?.dailyCount ?? 0} 日线 / ${marketMatrixQuery.data?.requestedCount ?? equityRows.length} 请求`}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Select
                  value={countryCode}
                  onValueChange={value => {
                    setCountryCode(value);
                    setEquityPage(0);
                    setSelectedEquityKey(null);
                    setNewsRequested(false);
                  }}
                >
                  <SelectTrigger className="h-7 w-[152px] border-gray-700 bg-gray-900 text-[10px]">
                    <SelectValue placeholder="全部国家/地区" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="ALL" className="text-[10px]">
                      全部国家/地区
                    </SelectItem>
                    {(countriesQuery.data ?? []).map(country => (
                      <SelectItem
                        key={country.countryCode}
                        value={country.countryCode}
                        className="text-[10px]"
                      >
                        {country.country} (
                        {Number(country.listingCount).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2 top-1/2 w-3 h-3 -translate-y-1/2 text-gray-500" />
                  <Input
                    value={equitySearch}
                    onChange={event => {
                      setEquitySearch(event.target.value);
                      setEquityPage(0);
                      setSelectedEquityKey(null);
                      setNewsRequested(false);
                    }}
                    placeholder="代码或名称"
                    className="h-7 border-gray-700 bg-gray-900 pl-6 text-[10px]"
                  />
                </div>
                <button
                  type="button"
                  aria-label="刷新证券清单和授权行情矩阵"
                  onClick={() => {
                    void equityQuery.refetch();
                    if (marketMatrixInput.instruments.length)
                      void marketMatrixQuery.refetch();
                  }}
                  disabled={
                    equityQuery.isFetching || marketMatrixQuery.isFetching
                  }
                  className="flex h-7 items-center gap-1 border border-teal-800 bg-teal-950/30 px-2 text-[9px] text-teal-100 disabled:opacity-40"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${equityQuery.isFetching || marketMatrixQuery.isFetching ? "animate-spin" : ""}`}
                  />
                  刷新行情
                </button>
              </div>
            </div>

            <ResizablePanelGroup
              direction={wideEquityDesk ? "horizontal" : "vertical"}
              className="min-h-[520px] bg-gray-800"
              aria-label="全球股票清单与行情详情分栏"
            >
              <ResizablePanel defaultSize={58} minSize={35}>
                <div className="h-full min-w-0">
                  {equityQuery.isLoading ? (
                    <div className="bg-gray-900 px-3 py-6 text-center text-[10px] text-gray-500">
                      正在读取已导入清单...
                    </div>
                  ) : equityQuery.isError ? (
                    <div className="bg-red-950/20 px-3 py-3 text-[10px] text-red-300">
                      清单读取失败；原 WEI 内容未受影响。
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[430px] flex-col overflow-hidden bg-gray-900">
                      <div className="min-h-0 flex-1 overflow-auto">
                        <table
                          className="w-full min-w-[1020px] table-fixed text-left text-[9px]"
                          aria-label="全球股票授权行情矩阵"
                        >
                          <thead className="sticky top-0 z-10 bg-gray-950 text-[8px] text-gray-500">
                            <tr className="border-b border-gray-700">
                              <th className="w-[92px] px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() => changeEquitySort("symbol")}
                                  className="flex items-center gap-1 hover:text-white"
                                >
                                  代码 <ArrowUpDown className="h-2.5 w-2.5" />
                                </button>
                              </th>
                              <th className="w-[142px] px-2 py-1">证券名称</th>
                              <th className="w-[112px] px-2 py-1">市场</th>
                              <th className="w-[88px] px-2 py-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => changeEquitySort("price")}
                                  className="ml-auto flex items-center gap-1 hover:text-white"
                                >
                                  最新 <ArrowUpDown className="h-2.5 w-2.5" />
                                </button>
                              </th>
                              <th className="w-[78px] px-2 py-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => changeEquitySort("changePct")}
                                  className="ml-auto flex items-center gap-1 hover:text-white"
                                >
                                  涨跌% <ArrowUpDown className="h-2.5 w-2.5" />
                                </button>
                              </th>
                              <th className="w-[82px] px-2 py-1 text-right">
                                买一
                              </th>
                              <th className="w-[82px] px-2 py-1 text-right">
                                卖一
                              </th>
                              <th className="w-[92px] px-2 py-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => changeEquitySort("volume")}
                                  className="ml-auto flex items-center gap-1 hover:text-white"
                                >
                                  成交量 <ArrowUpDown className="h-2.5 w-2.5" />
                                </button>
                              </th>
                              <th className="w-[92px] px-2 py-1 text-right">
                                成交额
                              </th>
                              <th className="w-[120px] px-2 py-1">数据状态</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {sortedEquityRows.map(listing => {
                              const listingKey = `${listing.countryCode}-${listing.symbol}`;
                              const isSelected =
                                selectedEquityKey === listingKey;
                              const market = marketByKey.get(
                                `${listing.countryCode}|${listing.symbol}`
                              );
                              return (
                                <tr
                                  key={listingKey}
                                  onClick={() => {
                                    setSelectedEquityKey(listingKey);
                                    setNewsRequested(false);
                                  }}
                                  className={`cursor-pointer transition-colors ${isSelected ? "bg-teal-950/60" : "hover:bg-gray-800/80"}`}
                                >
                                  <td className="px-2 py-1">
                                    <button
                                      type="button"
                                      aria-label={`查看 ${listing.symbol} 真实行情`}
                                      onKeyDown={event => {
                                        if (event.key === "ArrowDown") {
                                          event.preventDefault();
                                          moveEquitySelection(listingKey, 1);
                                        }
                                        if (event.key === "ArrowUp") {
                                          event.preventDefault();
                                          moveEquitySelection(listingKey, -1);
                                        }
                                      }}
                                      className="block w-full truncate text-left font-mono font-semibold text-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                      title={listing.symbol}
                                    >
                                      {listing.symbol}
                                    </button>
                                  </td>
                                  <td
                                    className="truncate px-2 py-1 text-gray-200"
                                    title={listing.name}
                                  >
                                    {listing.name}
                                  </td>
                                  <td
                                    className="truncate px-2 py-1 text-gray-500"
                                    title={`${listing.country} · ${listing.exchange}`}
                                  >
                                    {listing.countryCode} · {listing.exchange}
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono text-gray-100">
                                    {formatMarketNumber(market?.price, 6)}
                                  </td>
                                  <td
                                    className={`px-2 py-1 text-right font-mono ${market?.changePct == null ? "text-gray-600" : market.changePct >= 0 ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {market?.changePct == null
                                      ? "—"
                                      : `${market.changePct >= 0 ? "+" : ""}${market.changePct.toFixed(2)}`}
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono text-gray-300">
                                    {formatMarketNumber(market?.bid1, 6)}
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono text-gray-300">
                                    {formatMarketNumber(market?.ask1, 6)}
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono text-gray-400">
                                    {formatCompactNumber(market?.volume)}
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono text-gray-400">
                                    {formatCompactNumber(market?.amount)}
                                  </td>
                            <td
                              className={`truncate px-2 py-1 ${market?.realtime ? "text-green-300" : "text-amber-300"}`}
                            >
                              {market
                                ? `授权行情 ${market.realtime ? "实时" : "日线"} · ${market.currency}`
                                : marketMatrixQuery.isFetching
                                        ? "请求中"
                                        : "行情源未返回"}
                                  </td>
                                </tr>
                              );
                            })}
                            {equityRows.length === 0 && (
                              <tr>
                                <td
                                  colSpan={10}
                                  className="px-3 py-6 text-center text-[10px] text-gray-500"
                                >
                                  当前条件下没有原始清单记录。
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between border-t border-gray-800 px-2 py-1.5 text-[8px] text-gray-500">
                        <span>
                          第 {equityPage + 1} / {totalPages} 页
                        </span>
                        <div className="flex gap-1">
                          <button
                            aria-label="上一页股票清单"
                            disabled={equityPage === 0}
                            onClick={() =>
                              setEquityPage(page => Math.max(0, page - 1))
                            }
                            className="border border-gray-700 p-1 text-gray-400 disabled:opacity-40 hover:text-white"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <button
                            aria-label="下一页股票清单"
                            disabled={equityPage + 1 >= totalPages}
                            onClick={() =>
                              setEquityPage(page =>
                                Math.min(totalPages - 1, page + 1)
                              )
                            }
                            className="border border-gray-700 p-1 text-gray-400 disabled:opacity-40 hover:text-white"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="bg-gray-700"
                aria-label="调整全球股票清单与行情详情分栏"
              />
              <ResizablePanel defaultSize={42} minSize={30}>
                <div className="h-full min-w-0">
                  {selectedListing ? (
                    <div className="overflow-hidden bg-[#0d1220]">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-800 px-2 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-teal-400" />
                            <span className="font-mono text-[11px] font-bold text-teal-300">
                              {selectedListing.symbol}
                            </span>
                            <span className="text-[10px] text-gray-200 truncate">
                              {selectedListing.name}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[8px] text-gray-500">
                            {selectedListing.country} ·{" "}
                            {selectedListing.exchange}
                            {selectedMarket
                              ? ` · 行情代码 ${selectedMarket.providerSymbol}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={quoteRange}
                            onValueChange={value =>
                              setQuoteRange(value as typeof quoteRange)
                            }
                          >
                            <SelectTrigger className="h-7 w-[76px] border-gray-700 bg-gray-900 text-[9px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-700">
                              <SelectItem value="1mo" className="text-[9px]">
                                1个月
                              </SelectItem>
                              <SelectItem value="3mo" className="text-[9px]">
                                3个月
                              </SelectItem>
                              <SelectItem value="6mo" className="text-[9px]">
                                6个月
                              </SelectItem>
                              <SelectItem value="1y" className="text-[9px]">
                                1年
                              </SelectItem>
                              <SelectItem value="2y" className="text-[9px]">
                                2年
                              </SelectItem>
                              <SelectItem value="5y" className="text-[9px]">
                                5年
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => quoteQuery.refetch()}
                            disabled={quoteQuery.isFetching}
                            className="flex h-7 items-center gap-1 border border-teal-800 bg-teal-950/30 px-2 text-[9px] text-teal-200 hover:bg-teal-900/40 disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${quoteQuery.isFetching ? "animate-spin" : ""}`}
                            />
                            {quoteQuery.isFetching ? "读取中" : "刷新真实行情"}
                          </button>
                        </div>
                      </div>

                      {quoteQuery.isLoading || quoteQuery.isFetching ? (
                        <div className="px-3 py-8 text-center text-[10px] text-gray-500">
                          正在按授权行情源 → 可验证公开源顺序读取实际行情...
                        </div>
                      ) : quoteQuery.isError ? (
                        <div className="px-3 py-4 text-[10px] text-red-300">
                          真实行情请求失败；终端不会显示缓存样例或合成价格。
                        </div>
                      ) : quoteQuery.data && !quoteQuery.data.available ? (
                        <div className="px-3 py-4 text-[10px] text-amber-200">
                          {quoteQuery.data.limitation}
                        </div>
                      ) : quoteQuery.data?.quote ? (
                        <div className="space-y-px bg-gray-800 p-px">
                          <div className="overflow-x-auto bg-gray-900">
                            <table className="w-full min-w-[760px] table-fixed text-left">
                              <thead className="text-[8px] text-gray-500">
                                <tr>
                                  <th className="border-r border-gray-800 px-2 py-1">
                                    最新价
                                  </th>
                                  <th className="border-r border-gray-800 px-2 py-1">
                                    涨跌
                                  </th>
                                  <th className="border-r border-gray-800 px-2 py-1">
                                    开 / 高 / 低
                                  </th>
                                  <th className="border-r border-gray-800 px-2 py-1">
                                    买一 / 卖一
                                  </th>
                                  <th className="border-r border-gray-800 px-2 py-1">
                                    成交量 / 成交额
                                  </th>
                                  <th className="px-2 py-1">数据状态</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t border-gray-800">
                                  <td className="border-r border-gray-800 px-2 py-1.5 font-mono text-[12px] font-bold text-gray-100">
                                    {quoteQuery.data.quote.price.toLocaleString(
                                      undefined,
                                      { maximumFractionDigits: 8 }
                                    )}
                                  </td>
                                  <td
                                    className={`border-r border-gray-800 px-2 py-1.5 font-mono text-[12px] font-bold ${quoteQuery.data.quote.change >= 0 ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {quoteQuery.data.quote.change >= 0
                                      ? "+"
                                      : ""}
                                    {quoteQuery.data.quote.change.toLocaleString(
                                      undefined,
                                      { maximumFractionDigits: 8 }
                                    )}{" "}
                                    (
                                    {quoteQuery.data.quote.changePct >= 0
                                      ? "+"
                                      : ""}
                                    {quoteQuery.data.quote.changePct.toFixed(3)}
                                    %)
                                  </td>
                                  <td className="border-r border-gray-800 px-2 py-1.5 font-mono text-[9px] text-gray-200">
                                    {formatMarketNumber(
                                      quoteQuery.data.quote.open,
                                      6
                                    )}{" "}
                                    /{" "}
                                    {formatMarketNumber(
                                      quoteQuery.data.quote.high,
                                      6
                                    )}{" "}
                                    /{" "}
                                    {formatMarketNumber(
                                      quoteQuery.data.quote.low,
                                      6
                                    )}
                                  </td>
                                  <td className="border-r border-gray-800 px-2 py-1.5 font-mono text-[9px] text-gray-200">
                                    <span className="text-green-300">
                                      {formatMarketNumber(
                                        quoteQuery.data.quote.bid1,
                                        6
                                      )}
                                    </span>{" "}
                                    /{" "}
                                    <span className="text-red-300">
                                      {formatMarketNumber(
                                        quoteQuery.data.quote.ask1,
                                        6
                                      )}
                                    </span>
                                  </td>
                                  <td className="border-r border-gray-800 px-2 py-1.5 font-mono text-[9px] text-gray-200">
                                    {formatCompactNumber(
                                      quoteQuery.data.quote.volume
                                    )}{" "}
                                    /{" "}
                                    {formatCompactNumber(
                                      quoteQuery.data.quote.amount
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-[9px] text-gray-200">
                                    {quoteQuery.data.quote.currency} ·{" "}
                                    {quoteQuery.data.quote.marketState} ·{" "}
                                    {quoteQuery.data.history.length.toLocaleString()}{" "}
                                    条
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            <table
                              className="w-full min-w-[760px] table-fixed border-t border-gray-800 text-left text-[8px]"
                              aria-label="所选股票一档盘口与资金流"
                            >
                              <thead className="text-gray-500">
                                <tr>
                                  <th className="px-2 py-1">昨收</th>
                                  <th className="px-2 py-1">买一量</th>
                                  <th className="px-2 py-1">卖一量</th>
                                  <th className="px-2 py-1">买卖价差</th>
                                  <th className="px-2 py-1">流入</th>
                                  <th className="px-2 py-1">流出</th>
                                  <th className="px-2 py-1">行情代码</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t border-gray-800 font-mono text-gray-300">
                                  <td className="px-2 py-1">
                                    {formatMarketNumber(
                                      quoteQuery.data.quote.preClose,
                                      6
                                    )}
                                  </td>
                                  <td className="px-2 py-1">
                                    {formatCompactNumber(
                                      quoteQuery.data.quote.bidSize1
                                    )}
                                  </td>
                                  <td className="px-2 py-1">
                                    {formatCompactNumber(
                                      quoteQuery.data.quote.askSize1
                                    )}
                                  </td>
                                  <td className="px-2 py-1">
                                    {quoteQuery.data.quote.bid1 != null &&
                                    quoteQuery.data.quote.ask1 != null
                                      ? formatMarketNumber(
                                          quoteQuery.data.quote.ask1 -
                                            quoteQuery.data.quote.bid1,
                                          6
                                        )
                                      : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-green-300">
                                    {formatCompactNumber(
                                      quoteQuery.data.quote.inflow
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-red-300">
                                    {formatCompactNumber(
                                      quoteQuery.data.quote.outflow
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-teal-300">
                                    {quoteQuery.data.quote.providerSymbol}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <ListingKline symbol={selectedListing ? listingToSymbol(selectedListing.countryCode, selectedListing.symbol) : null} />
                          <div className="border-t border-gray-800 px-2 py-1.5 text-[8px] text-gray-500">
                            查询时间：
                            {new Date(quoteQuery.data.queriedAt).toLocaleString(
                              "zh-CN",
                              { hour12: false }
                            )}
                            ；市场观测时间：
                            {quoteQuery.data.observedAt
                              ? new Date(
                                  quoteQuery.data.observedAt
                                ).toLocaleString("zh-CN", { hour12: false })
                              : "未提供"}
                            。{quoteQuery.data.limitation}
                          </div>
                        </div>
                      ) : null}
                      <div className="border-t border-gray-800 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Newspaper className="h-3.5 w-3.5 text-teal-400" />
                            <span className="text-[10px] font-semibold text-gray-200">
                              免费公开搜索的关联新闻
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setNewsRequested(true);
                              if (newsRequested) newsQuery.refetch();
                            }}
                            disabled={newsQuery.isFetching}
                            className="flex h-7 items-center gap-1 border border-teal-800 bg-teal-950/30 px-2 text-[9px] text-teal-200 hover:bg-teal-900/40 disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${newsQuery.isFetching ? "animate-spin" : ""}`}
                            />
                            {newsQuery.isFetching
                              ? "读取中"
                              : newsRequested
                                ? "刷新新闻"
                                : "读取新闻"}
                          </button>
                        </div>
                        {!newsRequested ? (
                          <p className="mt-1.5 text-[8px] text-gray-500">
                            点击“读取新闻”后，仅显示本次实际返回且关联代码匹配的标题、发布者、时间与来源定位；它可能是市场关联报道，不等同于公司专属公告，也不会自动打开外部网页。
                          </p>
                        ) : newsQuery.isLoading || newsQuery.isFetching ? (
                          <p className="mt-1.5 text-[8px] text-gray-500">
                            正在读取可验证新闻条目...
                          </p>
                        ) : newsQuery.isError ? (
                          <p className="mt-1.5 text-[8px] text-red-300">
                            新闻请求失败；终端不生成摘要或替代新闻。
                          </p>
                        ) : newsQuery.data && !newsQuery.data.available ? (
                          <p className="mt-1.5 text-[8px] text-amber-200">
                            {newsQuery.data.limitation}
                          </p>
                        ) : (
                          <div className="mt-1.5 divide-y divide-gray-800">
                            {(newsQuery.data?.items ?? []).map(item => (
                              <div key={item.id} className="py-1.5">
                                <p className="text-[9px] leading-4 text-gray-200">
                                  {item.title}
                                </p>
                                <p className="mt-0.5 text-[8px] text-gray-500">
                                  {item.publisher ?? "发布者未提供"} ·{" "}
                                  {item.publishedAt
                                    ? new Date(item.publishedAt).toLocaleString(
                                        "zh-CN",
                                        { hour12: false }
                                      )
                                    : "发布时间未提供"}
                                  {item.sourceUrl
                                    ? " · 来源地址已保留于终端记录"
                                    : ""}
                                </p>
                                <p className="mt-0.5 text-[8px] text-gray-500">
                                  来源类型：{item.itemType ?? "未提供"} ·
                                  来源关联代码：
                                  {item.relatedTickers.length
                                    ? item.relatedTickers.join("、")
                                    : "未提供"}
                                </p>
                                <p className="mt-1 border-l border-teal-800 bg-teal-950/20 px-1.5 py-1 text-[8px] leading-4 text-teal-100">
                                  白话解读：{item.plainLanguage}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[360px] items-center justify-center bg-[#0d1220] px-6 text-center">
                      <div>
                        <Activity className="mx-auto mb-2 h-5 w-5 text-teal-500" />
                        <p className="text-[11px] font-medium text-gray-300">
                          选择一只证券以加载真实详情
                        </p>
                        <p className="mt-1 text-[9px] text-gray-500">
                          点击左侧任意股票行后，这里将显示实际行情、价格与成交量图表、来源和时间；不支持时会明确说明原因。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>
      </div>
      </div>
  );
}

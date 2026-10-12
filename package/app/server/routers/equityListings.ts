import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import {
  adminNewsIngestionArticles,
  adminNewsIngestionSources,
  equityListings,
} from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { fetchYahooNews } from "../realDataService";
import { fetchPublicTicker } from "../stockTickerObservation";
import {
  fetchIfindLicensedDataset,
  fetchIfindMarketSnapshots,
  getIfindProviderStatus,
} from "../ifindMarketData";
import { getIfindDataCatalog } from "../ifindDataCatalog";
import { fetchNasdaqPublicSnapshot } from '../nasdaqPublicSnapshot';
import { fetchNasdaqExtendedSession, fetchNasdaqSessionQuote } from '../nasdaqExtendedSession';

const pageInput = z.object({
  countryCode: z.string().trim().min(2).max(4).optional(),
  query: z.string().trim().min(1).max(128).optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(1000).default(100),
});

const quoteInput = z.object({
  countryCode: z.string().trim().min(2).max(4),
  symbol: z.string().trim().min(1).max(32),
  range: z.enum(["1mo", "3mo", "6mo", "1y", "2y", "5y"]).default("1mo"),
});

const matrixInput = z.object({
  instruments: z
    .array(
      z.object({
        countryCode: z.string().trim().min(2).max(4),
        symbol: z.string().trim().min(1).max(40),
      })
    )
    .min(1)
    .max(30),
});

const finiteMetaNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const GLOBAL_DESK_INDICES = [
  { id: "SPX", label: "S&P 500", ticker: "^GSPC", region: "美股" },
  { id: "IXIC", label: "NASDAQ", ticker: "^IXIC", region: "美股" },
  { id: "DJI", label: "道琼斯", ticker: "^DJI", region: "美股" },
  { id: "FTSE", label: "FTSE 100", ticker: "^FTSE", region: "欧洲" },
  { id: "DAX", label: "DAX", ticker: "^GDAXI", region: "欧洲" },
  { id: "N225", label: "日经225", ticker: "^N225", region: "亚太" },
  { id: "HSI", label: "恒生指数", ticker: "^HSI", region: "亚太" },
  { id: "SSEC", label: "上证指数", ticker: "000001.SS", region: "亚太" },
] as const;

const GLOBAL_DESK_FUNDS = [
  { id: "SPY", label: "SPDR S&P 500 ETF", ticker: "SPY", region: "美股" },
  { id: "QQQ", label: "Invesco QQQ", ticker: "QQQ", region: "美股" },
  { id: "EFA", label: "MSCI EAFE ETF", ticker: "EFA", region: "全球" },
  { id: "EEM", label: "MSCI Emerging Markets ETF", ticker: "EEM", region: "新兴市场" },
  { id: "2800.HK", label: "盈富基金", ticker: "2800.HK", region: "港股" },
] as const;

// The workbench watchlists are a bounded view over real instruments. They are
// not a replacement for the imported 48,756-row universe below; rows remain
// visible even when the licensed provider does not return a quote.
const GLOBAL_DESK_MARKETS = {
  US: [
    { id: "AAPL", label: "Apple", ticker: "AAPL", region: "美股" },
    { id: "MSFT", label: "Microsoft", ticker: "MSFT", region: "美股" },
    { id: "NVDA", label: "NVIDIA", ticker: "NVDA", region: "美股" },
    { id: "AMZN", label: "Amazon", ticker: "AMZN", region: "美股" },
    { id: "TSLA", label: "Tesla", ticker: "TSLA", region: "美股" },
  ],
  CN: [
    { id: "600519.SH", label: "贵州茅台", ticker: "600519.SH", region: "A股" },
    { id: "600036.SH", label: "招商银行", ticker: "600036.SH", region: "A股" },
    { id: "000858.SZ", label: "五粮液", ticker: "000858.SZ", region: "A股" },
    { id: "300750.SZ", label: "宁德时代", ticker: "300750.SZ", region: "A股" },
    { id: "601318.SH", label: "中国平安", ticker: "601318.SH", region: "A股" },
  ],
  HK: [
    { id: "0700.HK", label: "腾讯控股", ticker: "0700.HK", region: "港股" },
    { id: "9988.HK", label: "阿里巴巴", ticker: "9988.HK", region: "港股" },
    { id: "3690.HK", label: "美团", ticker: "3690.HK", region: "港股" },
    { id: "1299.HK", label: "友邦保险", ticker: "1299.HK", region: "港股" },
    { id: "2318.HK", label: "中国平安", ticker: "2318.HK", region: "港股" },
  ],
} as const;

type GlobalDeskMarketDefinition = (typeof GLOBAL_DESK_MARKETS)[keyof typeof GLOBAL_DESK_MARKETS][number];

type GlobalDeskRange = "1mo" | "3mo" | "6mo" | "1y";
const globalDeskInput = z.object({
  range: z.enum(["1mo", "3mo", "6mo", "1y"]).default("1mo"),
});

const ifindDatasetInput = z.object({
  categoryId: z.enum([
    "global-data",
    "bonds",
    "indices",
    "funds",
    "forex",
    "futures",
    "spot",
    "options",
    "companies",
    "cn-sectors",
    "hk-sectors",
    "us-sectors",
    "functions",
  ]),
  mode: z.enum(["realtime", "history", "basic", "edb", "iwencai"]),
  symbols: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  fields: z
    .array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/))
    .max(40)
    .optional(),
  indicators: z
    .array(z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{1,39}$/))
    .max(40)
    .optional(),
  begin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  domain: z.enum(["stock", "fund", "bond", "index", "future", "option"]).optional(),
});

let globalDeskCache: {
  key: string;
  expiresAt: number;
  value: any;
} | null = null;

async function readGlobalDeskQuote(
  definition: (typeof GLOBAL_DESK_INDICES)[number] | (typeof GLOBAL_DESK_FUNDS)[number] | GlobalDeskMarketDefinition,
  range: GlobalDeskRange,
  assetClass: "stocks" | "etf"
) {
  try {
    const result = await fetchPublicTicker(definition.ticker, range, assetClass);
    if (!result?.history?.length) {
      return {
        ...definition,
        status: "unavailable" as const,
        price: null,
        change: null,
        changePct: null,
        currency: null,
        source: null,
        realtime: false,
        observedAt: null,
        retrievedAt: null,
        history: [],
      };
    }
    const latest = result.history.at(-1) ?? null;
    return {
      ...definition,
      status: "available" as const,
      price: result.price,
      change: result.change,
      changePct: result.changePct,
      currency: result.currency,
      source: result.source,
      realtime: result.meta?.realtime === true,
      observedAt: latest?.date ?? null,
      retrievedAt:
        typeof result.meta?.retrievedAt === "string"
          ? result.meta.retrievedAt
          : new Date().toISOString(),
      history: result.history.slice(-120),
    };
  } catch {
    return {
      ...definition,
      status: "unavailable" as const,
      price: null,
      change: null,
      changePct: null,
      currency: null,
      source: null,
      realtime: false,
      observedAt: null,
      retrievedAt: null,
      history: [],
    };
  }
}

async function readGlobalDeskNews() {
  const results = await Promise.all(
    ["SPY", "QQQ", "EEM"].map(symbol =>
      fetchYahooNews(symbol, 8, "US").catch(() => ({
        available: false,
        source: "Yahoo Finance public search",
        items: [],
        limitation: "公开新闻源当前不可读取。",
      }))
    )
  );
  const seen = new Set<string>();
  const items = results
    .flatMap(result => result.items)
    .filter(item => {
      const key = `${item.title}|${item.publisher ?? ""}`.toLowerCase();
      if (!item.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      String(right.publishedAt ?? "").localeCompare(String(left.publishedAt ?? ""))
    )
    .slice(0, 18);
  return {
    available: items.length > 0,
    source: "Yahoo Finance public search",
    items,
    limitation:
      items.length > 0
        ? "新闻按标题与发布者去重；仅展示公开搜索本次返回的元数据，不重写来源正文。"
        : "免费公开新闻源当前没有返回可验证条目；终端不生成替代新闻。",
  };
}

function unavailableGlobalDeskRow(definition: (typeof GLOBAL_DESK_INDICES)[number] | (typeof GLOBAL_DESK_FUNDS)[number] | GlobalDeskMarketDefinition) {
  return {
    ...definition,
    status: "unavailable" as const,
    price: null,
    change: null,
    changePct: null,
    currency: null,
    source: null,
    realtime: false,
    observedAt: null,
    retrievedAt: null,
    history: [],
  };
}

function mapGlobalDeskSnapshot(
  definition: (typeof GLOBAL_DESK_INDICES)[number] | (typeof GLOBAL_DESK_FUNDS)[number] | GlobalDeskMarketDefinition,
  snapshot: Awaited<ReturnType<typeof fetchIfindMarketSnapshots>>[number] | undefined,
) {
  if (!snapshot) return unavailableGlobalDeskRow(definition);
  return {
    ...definition,
    status: "available" as const,
    price: snapshot.price,
    change: snapshot.change,
    changePct: snapshot.changePct,
    currency: snapshot.currency,
    source: snapshot.source,
    realtime: snapshot.realtime,
    observedAt: snapshot.observedAt,
    retrievedAt: snapshot.retrievedAt,
    history: [],
  };
}

export const equityListingsRouter = router({
  ifindCatalog: protectedProcedure.query(() => ({
    ...getIfindDataCatalog(),
    provider: getIfindProviderStatus(),
    queriedAt: new Date().toISOString(),
  })),

  ifindDataset: protectedProcedure
    .input(ifindDatasetInput)
    .query(({ input }) => fetchIfindLicensedDataset(input)),

  countries: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    return db
      .select({
        country: equityListings.country,
        countryCode: equityListings.countryCode,
        listingCount: count(equityListings.id),
      })
      .from(equityListings)
      .groupBy(equityListings.country, equityListings.countryCode)
      .orderBy(asc(equityListings.countryCode));
  }),

  list: publicProcedure.input(pageInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const conditions = [];
    if (input.countryCode)
      conditions.push(
        eq(equityListings.countryCode, input.countryCode.toUpperCase())
      );
    if (input.query) {
      const wildcard = `%${input.query}%`;
      conditions.push(
        or(
          like(equityListings.symbol, wildcard),
          like(equityListings.name, wildcard)
        )
      );
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const base = db
      .select({
        country: equityListings.country,
        countryCode: equityListings.countryCode,
        exchange: equityListings.exchange,
        symbol: equityListings.symbol,
        name: equityListings.name,
        sourceFile: equityListings.sourceFile,
        sourceSheet: equityListings.sourceSheet,
        sourceRow: equityListings.sourceRow,
      })
      .from(equityListings);
    const rows = whereClause
      ? await base
          .where(whereClause)
          .orderBy(asc(equityListings.countryCode), asc(equityListings.symbol))
          .limit(input.limit)
          .offset(input.offset)
      : await base
          .orderBy(asc(equityListings.countryCode), asc(equityListings.symbol))
          .limit(input.limit)
          .offset(input.offset);
    const totalBase = db
      .select({ total: count(equityListings.id) })
      .from(equityListings);
    const totalRows = whereClause
      ? await totalBase.where(whereClause)
      : await totalBase;
    return {
      rows,
      total: Number(totalRows[0]?.total ?? 0),
      offset: input.offset,
      limit: input.limit,
    };
  }),

  /**
   * WEI 全球股票工作台聚合读取。
   * 只返回本次真实来源成功读取的指数、ETF 和新闻；缺失项保持 null/空数组，
   * 不用固定样例、随机数或期权模型报价填充市场行情。
   */
  globalDesk: publicProcedure.input(globalDeskInput).query(async ({ input }) => {
    const cacheKey = input.range;
    if (globalDeskCache && globalDeskCache.key === cacheKey && globalDeskCache.expiresAt > Date.now()) {
      return globalDeskCache.value;
    }
    // One bounded SDK snapshot keeps the workbench responsive. Historical
    // series remain available through the dedicated environment/quote views.
    const allDefinitions = [
      ...GLOBAL_DESK_INDICES,
      ...GLOBAL_DESK_FUNDS,
      ...Object.values(GLOBAL_DESK_MARKETS).flat(),
    ];
    // Independent public quotes must not wait for the licensed SDK bridge:
    // when that bridge times out, WEI should still return its verified US
    // quotes and official environment series in the same page load.
    const publicDefinitions = allDefinitions.filter(definition =>
      definition.ticker === "^IXIC" || /^[A-Z]{1,6}$/.test(definition.ticker));
    const [snapshots, news, publicRows] = await Promise.all([
      getIfindProviderStatus().configured
        ? fetchIfindMarketSnapshots(allDefinitions.map(definition => definition.ticker))
        : Promise.resolve([]),
      readGlobalDeskNews(),
      Promise.all(publicDefinitions.map(async definition => {
        const assetClass = GLOBAL_DESK_INDICES.some(item => item.ticker === definition.ticker) ? 'index'
          : GLOBAL_DESK_FUNDS.some(item => item.ticker === definition.ticker) ? 'etf' : 'stocks';
        return [definition.ticker, await fetchNasdaqPublicSnapshot(definition.ticker, assetClass)] as const;
      })),
    ]);
    const snapshotBySymbol = new Map(snapshots.map(snapshot => [snapshot.requestedSymbol.toUpperCase(), snapshot]));
    const snapshotFor = (ticker: string) => snapshotBySymbol.get(ticker.toUpperCase());
    const freeQuotes = new Map(publicRows);
    const mapQuote = (definition: typeof allDefinitions[number]) => {
      const licensed = snapshotFor(definition.ticker);
      if (licensed) return { ...mapGlobalDeskSnapshot(definition, licensed), source: null, delayStatus: licensed.realtime ? 'realtime' : 'delayed' };
      const quote = freeQuotes.get(definition.ticker);
      return quote ? { ...definition, ...quote, source: null, status: 'available' as const, history: [] }
        : { ...unavailableGlobalDeskRow(definition), delayStatus: 'unavailable' };
    };
    const indices = GLOBAL_DESK_INDICES.map(mapQuote);
    const funds = GLOBAL_DESK_FUNDS.map(mapQuote);
    const markets = Object.fromEntries(Object.entries(GLOBAL_DESK_MARKETS).map(([group, definitions]) => [
      group,
      definitions.map(mapQuote),
    ]));
    const value = {
      schemaVersion: 1,
      queriedAt: new Date().toISOString(),
      range: input.range,
      indices,
      funds,
      markets,
      news,
      options: {
        available: false as const,
        provider: null as string | null,
        reason: "未配置可授权的期权实时/延迟行情源；终端不把 Black-Scholes 或确定性模型链当作市场报价。",
      },
      sourceBoundary: "报价按各市场实际观察时间展示；标记为日终、延迟或历史的数据不代表实时可执行价格。",
    };
    globalDeskCache = { key: cacheKey, expiresAt: Date.now() + 30_000, value };
    return value;
  }),

  marketMatrix: publicProcedure.input(matrixInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const instruments = input.instruments.map(item => ({
      countryCode: item.countryCode.toUpperCase(),
      symbol: item.symbol.toUpperCase(),
    }));
    const conditions = instruments.map(item =>
      and(
        eq(equityListings.countryCode, item.countryCode),
        eq(equityListings.symbol, item.symbol)
      )
    );
    const listings = await db
      .select({
        country: equityListings.country,
        countryCode: equityListings.countryCode,
        exchange: equityListings.exchange,
        symbol: equityListings.symbol,
        name: equityListings.name,
      })
      .from(equityListings)
      .where(or(...conditions));
    const listingByKey = new Map(
      listings.map(listing => [
        `${listing.countryCode}|${listing.symbol.toUpperCase()}`,
        listing,
      ])
    );
    const orderedListings = instruments.flatMap(item => {
      const listing = listingByKey.get(`${item.countryCode}|${item.symbol}`);
      return listing ? [listing] : [];
    });
    const snapshots = await fetchIfindMarketSnapshots(
      orderedListings.map(listing => listing.symbol)
    );
    const snapshotBySymbol = new Map(
      snapshots.map(snapshot => [snapshot.requestedSymbol, snapshot])
    );
    const provider = getIfindProviderStatus();
    const rows = orderedListings.map(listing => ({
      ...listing,
      market: snapshotBySymbol.get(listing.symbol.toUpperCase()) ?? null,
    }));
    return {
      rows,
      requestedCount: instruments.length,
      availableCount: rows.filter(row => row.market !== null).length,
      realtimeCount: rows.filter(row => row.market?.realtime === true).length,
      dailyCount: rows.filter(row => row.market && !row.market.realtime).length,
      queriedAt: new Date().toISOString(),
      source: "Tonghuashun iFinD SDK" as const,
      provider: {
        configured: provider.configured,
        sdkInstalled: provider.sdkInstalled,
        credentialsConfigured: provider.credentialsConfigured,
        updateBoundary: provider.updateBoundary,
      },
    };
  }),

  extendedSession: publicProcedure
    .input(quoteInput.pick({ countryCode: true, symbol: true }))
    .query(async ({ input }) => {
      const queriedAt = new Date().toISOString();
      if (input.countryCode.toUpperCase() !== 'US') {
        return { queriedAt, session: null, limitation: '仅查询美国股票的交易所盘前/盘后观察；指数及其他市场不套用美股时段。' };
      }
      const db = await getDb();
      if (!db) throw new Error('DATABASE_UNAVAILABLE');
      const symbol = input.symbol.toUpperCase();
      const listing = (await db.select({ id: equityListings.id }).from(equityListings)
        .where(and(eq(equityListings.countryCode, 'US'), eq(equityListings.symbol, symbol))).limit(1))[0];
      if (!listing) return { queriedAt, session: null, limitation: '所选证券不在美国股票清单中。' };
      // The imported iFinD catalog uses AAPL.O / MSFT.O / NYSE .N while
      // Nasdaq's public quote uses the bare US ticker. Reject other suffixes
      // rather than guessing a different instrument's extended-hours trade.
      const providerSymbol = /^([A-Z]{1,6})(?:\.(?:O|N))?$/.exec(symbol)?.[1] ?? null;
      if (!providerSymbol) return { queriedAt, session: null, limitation: '该证券代码尚无可验证的 Nasdaq 标的映射，不显示其他证券的盘前盘后价。' };
      const session = await fetchNasdaqExtendedSession(providerSymbol);
      return {
        queriedAt,
        session,
        limitation: session
          ? null
          : '当前来源没有返回十五分钟内、带美东时间戳的盘前或盘后成交；不沿用前一交易日或常规时段价格。',
      };
    }),

  sessionQuote: publicProcedure
    .input(quoteInput.pick({ countryCode: true, symbol: true }))
    .query(async ({ input }) => {
      const queriedAt = new Date().toISOString();
      if (input.countryCode.toUpperCase() !== 'US') {
        return { queriedAt, quote: null, limitation: '当前秒级观察只支持有来源时间戳的美国股票；其他市场仍按各自授权来源更新。' };
      }
      const db = await getDb();
      if (!db) throw new Error('DATABASE_UNAVAILABLE');
      const symbol = input.symbol.toUpperCase();
      const listing = (await db.select({ id: equityListings.id }).from(equityListings)
        .where(and(eq(equityListings.countryCode, 'US'), eq(equityListings.symbol, symbol))).limit(1))[0];
      if (!listing) return { queriedAt, quote: null, limitation: '所选证券不在美国股票清单中。' };
      const providerSymbol = /^([A-Z]{1,6})(?:\.(?:O|N))?$/.exec(symbol)?.[1] ?? null;
      if (!providerSymbol) return { queriedAt, quote: null, limitation: '该证券代码没有已验证的 Nasdaq 标的映射。' };
      const quote = await fetchNasdaqSessionQuote(providerSymbol);
      return {
        queriedAt,
        quote,
        limitation: quote ? null : '当前未收到十五分钟内且符合交易时段的 Nasdaq 成交；不沿用旧价格或虚构跳价。',
      };
    }),

  etfSessionQuote: publicProcedure
    .input(z.object({ symbol: z.string().trim().regex(/^[A-Za-z]{1,6}$/) }))
    .query(async ({ input }) => {
      const symbol = input.symbol.toUpperCase();
      const quote = await fetchNasdaqSessionQuote(symbol, 'etf');
      return {
        queriedAt: new Date().toISOString(),
        quote,
        limitation: quote ? null : '当前没有带交易时段与时间戳的该 ETF 成交；不把昨日净值当作盘中价。',
      };
    }),

  quote: publicProcedure.input(quoteInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");
    const countryCode = input.countryCode.toUpperCase();
    const listing = (
      await db
        .select()
        .from(equityListings)
        .where(
          and(
            eq(equityListings.countryCode, countryCode),
            eq(equityListings.symbol, input.symbol)
          )
        )
        .limit(1)
    )[0];
    if (!listing) {
      return {
        available: false,
        source: "Yahoo Finance chart",
        queriedAt: new Date().toISOString(),
        observedAt: null,
        listing: null,
        quote: null,
        history: [],
        limitation:
          "该证券不在已导入的全球股票清单中；终端不会按名称猜测或替代证券代码。",
      };
    }

    const queriedAt = new Date();
    const result = await fetchPublicTicker(
      listing.symbol,
      input.range,
      "stocks"
    );
    const source = result?.source ?? "Tonghuashun iFinD SDK / public fallback";
    if (!result || result.history.length === 0) {
      const unavailableReason =
        "公开历史行情当前不可用；终端未以合成价格、静态样例或替代证券填充。";
      return {
        available: false,
        source,
        queriedAt: queriedAt.toISOString(),
        observedAt: null,
        listing: {
          country: listing.country,
          countryCode: listing.countryCode,
          exchange: listing.exchange,
          symbol: listing.symbol,
          name: listing.name,
        },
        quote: null,
        history: [],
        limitation: unavailableReason,
      };
    }

    const regularMarketTime =
      typeof result.meta.regularMarketTime === "number"
        ? result.meta.regularMarketTime
        : null;
    const metaObservedAt =
      typeof result.meta.observedAt === "string"
        ? result.meta.observedAt
        : null;
    const observationAt = regularMarketTime
      ? new Date(regularMarketTime * 1000)
      : null;
    const isRealtime = result.meta.realtime === true;
    const marketState =
      typeof result.meta.marketState === "string"
        ? result.meta.marketState
        : isRealtime
          ? "实时"
          : "延迟 / 日线";
    const latestPoint = result.history.at(-1) ?? null;
    return {
      available: true,
      source,
      queriedAt: queriedAt.toISOString(),
      observedAt:
        metaObservedAt ??
        observationAt?.toISOString() ??
        latestPoint?.date ??
        null,
      listing: {
        country: listing.country,
        countryCode: listing.countryCode,
        exchange: listing.exchange,
        symbol: listing.symbol,
        name: listing.name,
      },
      quote: {
        price: result.price,
        change: result.change,
        changePct: result.changePct,
        currency: result.currency,
        marketState,
        realtime: isRealtime,
        providerSymbol:
          typeof result.meta.providerSymbol === "string"
            ? result.meta.providerSymbol
            : result.symbol,
        preClose: finiteMetaNumber(result.meta.preClose),
        open: finiteMetaNumber(result.meta.open) ?? latestPoint?.open ?? null,
        high: finiteMetaNumber(result.meta.high) ?? latestPoint?.high ?? null,
        low: finiteMetaNumber(result.meta.low) ?? latestPoint?.low ?? null,
        volume:
          finiteMetaNumber(result.meta.volume) ?? latestPoint?.volume ?? null,
        amount: finiteMetaNumber(result.meta.amount),
        bid1: finiteMetaNumber(result.meta.bid1),
        ask1: finiteMetaNumber(result.meta.ask1),
        bidSize1: finiteMetaNumber(result.meta.bidSize1),
        askSize1: finiteMetaNumber(result.meta.askSize1),
        inflow: finiteMetaNumber(result.meta.inflow),
        outflow: finiteMetaNumber(result.meta.outflow),
      },
      history: result.history,
      limitation:
        result.source === "Tonghuashun iFinD SDK"
          ? "行情来自本机已授权 iFinD SDK；实时性和字段覆盖受当前账户的数据许可约束，不作为交易所可执行报价。"
          : "iFinD 当前未返回该证券，已使用可验证公开源；这是延迟或日线观察，不作为交易所可执行报价。",
    };
  }),

  news: publicProcedure
    .input(quoteInput.pick({ countryCode: true, symbol: true }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DATABASE_UNAVAILABLE");
      const listing = (
        await db
          .select()
          .from(equityListings)
          .where(
            and(
              eq(equityListings.countryCode, input.countryCode.toUpperCase()),
              eq(equityListings.symbol, input.symbol)
            )
          )
          .limit(1)
      )[0];
      if (!listing)
        return {
          available: false,
          source: "Yahoo Finance news",
          queriedAt: new Date().toISOString(),
          listing: null,
          items: [],
          limitation:
            "该证券不在已导入的全球股票清单中；终端不会按名称猜测新闻对象。",
        };
      const [result, publishedRows] = await Promise.all([
        fetchYahooNews(listing.symbol, 6, listing.countryCode),
        db
          .select({
            id: adminNewsIngestionArticles.id,
            title: adminNewsIngestionArticles.aiTitle,
            publisher: adminNewsIngestionSources.name,
            publishedAt: adminNewsIngestionArticles.publishedAt,
            sourceUrl: adminNewsIngestionArticles.sourceUrl,
            tickers: adminNewsIngestionArticles.tickers,
          })
          .from(adminNewsIngestionArticles)
          .innerJoin(
            adminNewsIngestionSources,
            eq(
              adminNewsIngestionArticles.sourceId,
              adminNewsIngestionSources.id
            )
          )
          .where(
            and(
              eq(adminNewsIngestionArticles.status, "published"),
              eq(adminNewsIngestionArticles.aiGenerationCatalogCode, "CN"),
              sql`JSON_CONTAINS(${adminNewsIngestionArticles.tickers}, JSON_QUOTE(${listing.symbol.toUpperCase()}))`
            )
          )
          .orderBy(desc(adminNewsIngestionArticles.publishedAt))
          .limit(24),
      ]);
      const internalItems = publishedRows.flatMap(row => {
        if (!row.title || !Array.isArray(row.tickers)) return [];
        const relatedTickers = row.tickers.filter(
          (ticker): ticker is string => typeof ticker === "string"
        );
        if (
          !relatedTickers.some(
            ticker => ticker.toUpperCase() === listing.symbol.toUpperCase()
          )
        )
          return [];
        return [
          {
            id: `admin-cn-${row.id}`,
            title: row.title,
            publisher: row.publisher,
            publishedAt: row.publishedAt,
            sourceUrl: row.sourceUrl,
            itemType: "站内已发布公司新闻",
            relatedTickers,
            plainLanguage: `${row.publisher} 发布的公司新闻；该条目已通过站内审核并公开发布。`,
          },
        ];
      });
      return {
        available: result.available || internalItems.length > 0,
        source: internalItems.length
          ? `${result.source}；Finance Hub 站内已发布新闻`
          : result.source,
        items: [...internalItems, ...result.items].slice(0, 24),
        limitation: internalItems.length
          ? "仅显示所选证券代码精确关联的已发布站内新闻与本次公开 Yahoo Finance 返回；审批但尚未发布的草稿不会显示。"
          : result.limitation,
        queriedAt: new Date().toISOString(),
        listing: {
          country: listing.country,
          countryCode: listing.countryCode,
          exchange: listing.exchange,
          symbol: listing.symbol,
          name: listing.name,
        },
      };
    }),
});

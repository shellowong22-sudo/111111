import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  adminMarketIngestionEvents,
  adminMarketIngestionTargets,
  marketData,
  marketDataObservationHistory,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  fetchAlphaVantageDailySeries,
  fetchStooqDailySeries,
  fetchTwelveDataDailySeries,
  type FreeObservation,
} from "./freeMarketData";
import {
  fetchIfindMarketHistory,
  getIfindProviderStatus,
} from "./ifindMarketData";
import { fetchYahooChart } from "./realDataService";
import { FINMIND_MODULE_BINDINGS } from "../shared/finmindModuleBindings";

type MarketTarget = typeof adminMarketIngestionTargets.$inferSelect;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type IngestionSeries = {
  price: number;
  change: number | null;
  changePct: number | null;
  currency: string;
  history: FreeObservation[];
  source: string;
  sourceReference: string;
};

export const CANONICAL_MARKET_CONTRACT_OWNERS: Readonly<
  Record<string, string>
> = {
  "market.ohlcv.daily.v1": "admin-market-ingestion",
  "market.public-quote.nasdaq.v1": "admin-market-ingestion",
  "macro.us.cpi.level.v1": "economic-ecst",
  "macro.us.real-gdp.qoq-annualized.v1": "economic-ecst",
  "macro.us.core-pce.level.v1": "economic-ecst",
  "labor.us.unemployment.sa.v1": "economic-ecst",
  "labor.us.nonfarm-payroll.level.sa.v1": "economic-ecst",
  "labor.ea21.unemployment.sa.v1": "economic-ecst",
  "macro.ea21.hicp.yoy.v1": "economic-ecst",
  "macro.ea21.real-gdp.qoq.sca.v1": "economic-ecst",
  "macro.jp.real-gdp.qoq-annualized.v1": "economic-ecst",
  "labor.jp.unemployment.15-64.sa.v1": "economic-ecst",
  "energy.us.natural-gas-storage.weekly.v1": "commodity-market",
  "energy.us.commercial-crude-inventory.eia.weekly.v1": "commodity-market",
  "energy.us.refinery-utilization.eia.weekly.v1": "commodity-market",
  "rates.us.sofr.fred.v1": "mm-03-mktbeat",
  "macro.world.gdp.world-bank.v1": "economic-ecwb",
  "fiscal.us.total-public-debt.daily.v1": "sov-10-debt",
  "macro.world.gdp-growth.imf-weo.v1": "economic-ecfc",
  "labor.eu27.unemployment.eurostat.monthly.v1": "economic-ecst",
  "fx.hkma.daily-reference.v1": "forex-hub",
  "fx.bank-of-canada.usdcad.v1": "forex-hub",
  "index.us.sp500.fred.daily.v1": "index-hub",
  "commodity.us.wti-spot.fred.daily.v1": "commodity-market",
  "crypto.btc-usd.fred.daily.v1": "crypto-market",
  "credit.us.high-yield-oas.fred.daily.v1": "bond-market",
  "rates.us.effective-fed-funds.fred.daily.v1": "interest-rates",
  "rates.us.10y2y-spread.fred.daily.v1": "yield-curve",
  "rates.de.long-government-bond.fred.monthly.v1": "g7-curves",
  "rates.us.treasury-5y.fred.daily.v1": "curve-search",
  "rates.us.treasury-2y.fred.daily.v1": "curves-compare",
  "bond.global.etf.nasdaq.daily.v1": "sov-04-wb",
  "fx.usd-eur.fred.daily.v1": "forex-curves",
  "fx.frankfurter.daily.v1": "forex-hub",
  "equity.tw.2330.ohlcv.daily.finmind.v1": "stock-eqs",
  "equity.us.aapl.ohlcv.daily.finmind.v1": "stock-eqs",
  "equity.tw.2330.valuation.daily.finmind.v1": "stock-eqs",
  "equity.tw.2330.dividend.finmind.v1": "stock-eqs",
  "equity.tw.security-master.finmind.v1": "stock-eqs",
  "equity.us.security-master.finmind.v1": "stock-eqs",
  "commodity.gold.reference.finmind.v1": "commodity-market",
  "index.tw.taiex.total-return.finmind.v1": "index-hub",
  "derivatives.tw.futures.daily.finmind.v1": "deri",
  "derivatives.tw.options.daily.finmind.v1": "moso",
  "news.tw.2330.company.finmind.v1": "news-cn",
  "equity.twse.snapshot.v1": "stock-eqs",
  "equity.twse.valuation.v1": "stock-eqs",
  "index.twse.taiex.snapshot.v1": "index-hub",
  "commodity.pl.gold.nbp.daily.v1": "commodity-market",
  "fx.pl.usd-pln.nbp.daily.v1": "forex-hub",
  "fx.pl.multi-pln.nbp.daily.v1": "forex-hub",
  "fx.cz.cnb.daily-reference.v1": "forex-hub",
  "fx.il.boi.daily-reference.v1": "forex-hub",
  "derivatives.global.cftc-disaggregated.weekly.v1": "commodity-futures",
  "crypto.global.coingecko.markets.daily.v1": "crypto-market",
  "index.global.cboe-volatility.daily.v1": "index-hub",
  "index.global.cboe-delayed-snapshot.daily.v1": "index-hub",
  "equity.global.nasdaq-screener.daily.v1": "stock-eqs",
  "equity.global.nasdaq-earnings-calendar.daily.v1": "stock-eqs",
  "equity.global.nasdaq-dividend-calendar.daily.v1": "stock-eqs",
  "equity.global.nasdaq-ipo-calendar.monthly.v1": "stock-eqs",
  "macro.global.nasdaq-economic-calendar.daily.v1": "economic-ecst",
  "equity.cn.a.snapshot.akshare.v1": "stock-eqs",
  "equity.cn.directory.akshare.v1": "stock-eqs",
  "equity.hk.snapshot.akshare.v1": "stock-eqs",
  "equity.us.snapshot.akshare.v1": "stock-eqs",
  "index.cn.snapshot.akshare.v1": "index-hub",
  "index.global.snapshot.akshare.v1": "index-hub",
  "fund.etf.snapshot.akshare.v1": "fund-browse",
  "fund.open.snapshot.akshare.v1": "fund-browse",
  "derivatives.global.futures.snapshot.akshare.v1": "commodity-futures",
  "derivatives.cn.futures.snapshot.akshare.v1": "commodity-futures",
  "derivatives.cn.futures.inventory.akshare.v1": "commodity-futures",
  "derivatives.cn.options.snapshot.akshare.v1": "moso",
  "rates.cn-us.bond-curve.akshare.v1": "bond-market",
  "fx.cn.snapshot.akshare.v1": "forex-hub",
  "news.public.publication.akshare.v1": "news-top",
  "macro.cn.gdp.akshare.v1": "economic-ecst",
  "macro.cn.cpi.akshare.v1": "economic-ecst",
  "macro.cn.pmi.akshare.v1": "economic-ecst",
  "index.global.sox.akshare.v1": "index-hub",
  "commodity.global.bdi.akshare.v1": "commodity-market",
  "rates.jp.bank-policy.akshare.v1": "economic-ecst",
  "rates.uk.bank-policy.akshare.v1": "economic-ecst",
  "news.cn.cctv.akshare.v1": "news-top",
  ...Object.fromEntries(
    FINMIND_MODULE_BINDINGS.map(binding => [binding.dataContractId, binding.moduleId])
  ),
};
const CANONICAL_MODULE_ID =
  CANONICAL_MARKET_CONTRACT_OWNERS["market.ohlcv.daily.v1"];
const DAILY_OHLCV_CONTRACT = "market.ohlcv.daily.v1";

export function assertCanonicalMarketOwner(
  moduleId: string,
  dataContractId: string
) {
  const owner = CANONICAL_MARKET_CONTRACT_OWNERS[dataContractId];
  if (!owner || owner !== moduleId)
    throw new Error(
      `MARKET_DATA_CONTRACT_OWNER_MISMATCH:${dataContractId}:${moduleId}`
    );
}

/** Deterministic JSON is required for content fingerprints and duplicate rejection. */
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      key =>
        `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`
    )
    .join(",")}}`;
}

function isDuplicateEntry(error: unknown) {
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 4 && current && typeof current === "object";
    depth += 1
  ) {
    if ((current as { code?: string }).code === "ER_DUP_ENTRY") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function marketObservationContentHash(input: {
  moduleId: string;
  dataContractId: string;
  symbol: string;
  observationDate: string;
  payload: Record<string, unknown>;
}) {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}

function normalizedSeries(
  input: { history: FreeObservation[]; source: string; sourceUrl: string },
  currency = "未提供"
): IngestionSeries | null {
  const history = input.history.filter(
    point =>
      point.close !== null &&
      point.close !== undefined &&
      Number.isFinite(point.close)
  );
  const latest = history.at(-1);
  if (!latest || latest.close === null || latest.close === undefined)
    return null;
  const previous = history.at(-2)?.close;
  const change =
    previous === null || previous === undefined
      ? null
      : latest.close - previous;
  return {
    price: latest.close,
    change,
    changePct: previous && change !== null ? (change / previous) * 100 : null,
    currency,
    history,
    source: input.source,
    sourceReference: input.sourceUrl,
  };
}

async function fetchAdminMarketSeries(
  target: MarketTarget
): Promise<IngestionSeries | null> {
  const ifindRange = target.historyRange === "3mo" ? "3mo" : "1mo";
  if (getIfindProviderStatus().configured) {
    const result = await fetchIfindMarketHistory(target.symbol, ifindRange);
    if (result) return { ...result, sourceReference: "local-sdk:ifind" };
  }
  const limit =
    target.historyRange === "5d"
      ? 10
      : target.historyRange === "1mo"
        ? 35
        : 100;
  if (process.env.TWELVE_DATA_API_KEY?.trim()) {
    const result = await fetchTwelveDataDailySeries(target.symbol, limit);
    if (result.available) {
      const normalized = normalizedSeries(result);
      if (normalized) return normalized;
    }
  }
  if (process.env.ALPHA_VANTAGE_API_KEY?.trim()) {
    const result = await fetchAlphaVantageDailySeries(target.symbol, limit);
    if (result.available) {
      const normalized = normalizedSeries(result);
      if (normalized) return normalized;
    }
  }
  const stooqCandidates = target.symbol.includes(".")
    ? [target.symbol]
    : [`${target.symbol}.US`, target.symbol];
  for (const symbol of stooqCandidates) {
    const result = await fetchStooqDailySeries(symbol, limit);
    if (result.available) {
      const normalized = normalizedSeries(result);
      if (normalized) return normalized;
    }
  }
  const result = await fetchYahooChart(
    target.symbol,
    target.historyRange,
    "1d"
  );
  return result
    ? { ...result, sourceReference: "public-adapter:yahoo-chart" }
    : null;
}

async function archiveMarketHistory(
  db: Database,
  target: MarketTarget,
  result: IngestionSeries | null,
  fetchedAt: Date
) {
  if (!result) return { inserted: 0, duplicate: 0 };
  assertCanonicalMarketOwner(CANONICAL_MODULE_ID, DAILY_OHLCV_CONTRACT);
  let inserted = 0;
  let duplicate = 0;
  for (const point of result.history) {
    if (!point.date || point.close === null || point.close === undefined)
      continue;
    const payload: Record<string, unknown> = {
      open: point.open ?? null,
      high: point.high ?? null,
      low: point.low ?? null,
      close: point.close,
      value: point.value,
      volume: point.volume ?? null,
      currency: result.currency,
    };
    const contentHash = marketObservationContentHash({
      moduleId: CANONICAL_MODULE_ID,
      dataContractId: DAILY_OHLCV_CONTRACT,
      symbol: target.symbol,
      observationDate: point.date,
      payload,
    });
    const previous = (await dbSelectHistory(db, target, point.date)).at(0);
    try {
      await db.insert(marketDataObservationHistory).values({
        moduleId: CANONICAL_MODULE_ID,
        dataContractId: DAILY_OHLCV_CONTRACT,
        targetId: target.id,
        symbol: target.symbol,
        observationDate: point.date,
        observationAt: new Date(`${point.date}T00:00:00.000Z`),
        fetchedAt,
        source: result.source,
        sourceReference: result.sourceReference,
        payload,
        contentHash,
        schemaVersion: "market-observation-v1",
        isRevision: Boolean(previous && previous.contentHash !== contentHash),
      });
      inserted += 1;
    } catch (error) {
      if (isDuplicateEntry(error)) duplicate += 1;
      else throw error;
    }
  }
  return { inserted, duplicate };
}

async function dbSelectHistory(
  db: Database,
  target: MarketTarget,
  observationDate: string
) {
  return db
    .select({ contentHash: marketDataObservationHistory.contentHash })
    .from(marketDataObservationHistory)
    .where(
      and(
        eq(marketDataObservationHistory.moduleId, CANONICAL_MODULE_ID),
        eq(marketDataObservationHistory.dataContractId, DAILY_OHLCV_CONTRACT),
        eq(marketDataObservationHistory.symbol, target.symbol),
        eq(marketDataObservationHistory.observationDate, observationDate)
      )
    )
    .orderBy(desc(marketDataObservationHistory.id))
    .limit(1);
}

export function observationTimestamp(date: string) {
  // Preserve an exact provider instant for intraday observations. For
  // annual/quarterly/monthly releases the period string is authoritative and
  // remains in observation_date; leaving observation_at null avoids inventing
  // a day inside a reporting period (and avoids driver timezone coercion).
  const isDaily = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const isInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(date);
  if (!isDaily && !isInstant) return null;
  const timestamp = isDaily ? new Date(`${date}T00:00:00.000Z`) : new Date(date);
  // Keep historical periods in observation_date even outside MySQL TIMESTAMP's
  // range. Do not drop the observation or coerce it to the epoch.
  const instant = timestamp.getTime();
  if (!Number.isFinite(instant) || instant < 1000 || instant > 2147483647000 || timestamp.toISOString().slice(0, 10) !== date) return null;
  return timestamp;
}

export async function archiveCanonicalObservationSeries(input: {
  moduleId: string;
  dataContractId: string;
  symbol: string;
  source: string;
  sourceReference: string;
  schemaVersion: string;
  fetchedAt: Date;
  history: Array<{ date: string; payload: Record<string, unknown>; symbol?: string }>;
}) {
  assertCanonicalMarketOwner(input.moduleId, input.dataContractId);
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  let inserted = 0;
  let duplicate = 0;
  let revisions = 0;
  for (const observation of input.history) {
    const observationSymbol = observation.symbol?.trim() || input.symbol;
    const contentHash = marketObservationContentHash({
      moduleId: input.moduleId,
      dataContractId: input.dataContractId,
      symbol: observationSymbol,
      observationDate: observation.date,
      payload: observation.payload,
    });
    const previous = (
      await db
        .select({
          id: marketDataObservationHistory.id,
          contentHash: marketDataObservationHistory.contentHash,
          payload: marketDataObservationHistory.payload,
        })
        .from(marketDataObservationHistory)
        .where(
          and(
            eq(marketDataObservationHistory.moduleId, input.moduleId),
            eq(
              marketDataObservationHistory.dataContractId,
              input.dataContractId
            ),
            eq(marketDataObservationHistory.symbol, observationSymbol),
            eq(marketDataObservationHistory.observationDate, observation.date)
          )
        )
        .orderBy(desc(marketDataObservationHistory.id))
        .limit(1)
    ).at(0);
    // The semantic identity is derived from the stored observation itself,
    // not trusted from a historical hash column. This matters after an
    // administrator repairs a contract's canonical module owner: older rows
    // may still carry a fingerprint computed with the former owner. Treat an
    // identical payload as a duplicate and repair that stale fingerprint
    // instead of appending thousands of false revisions.
    const previousCanonicalHash = previous
      ? marketObservationContentHash({
          moduleId: input.moduleId,
          dataContractId: input.dataContractId,
          symbol: observationSymbol,
          observationDate: observation.date,
          payload: previous.payload,
        })
      : null;
    if (previous && previousCanonicalHash === contentHash) {
      if (previous.contentHash !== contentHash) {
        try {
          await db
            .update(marketDataObservationHistory)
            .set({ contentHash })
            .where(eq(marketDataObservationHistory.id, previous.id));
        } catch (error) {
          // A canonical twin may already exist from a prior run. The current
          // observation is still a duplicate and must never be inserted again.
          if (!isDuplicateEntry(error)) throw error;
        }
      }
      duplicate += 1;
      continue;
    }
    const isRevision = Boolean(
      previous && previous.contentHash !== contentHash
    );
    try {
      await db.insert(marketDataObservationHistory).values({
        moduleId: input.moduleId,
        dataContractId: input.dataContractId,
        targetId: null,
        symbol: observationSymbol,
        observationDate: observation.date,
        observationAt: observationTimestamp(observation.date),
        fetchedAt: input.fetchedAt,
        source: input.source,
        sourceReference: input.sourceReference,
        payload: observation.payload,
        contentHash,
        schemaVersion: input.schemaVersion,
        isRevision,
      });
      inserted += 1;
      if (isRevision) revisions += 1;
    } catch (error) {
      if (isDuplicateEntry(error)) duplicate += 1;
      else throw error;
    }
  }
  return { inserted, duplicate, revisions, total: input.history.length };
}

export async function auditAdminMarketIngestion(input: {
  targetId?: number | null;
  actorUserId?: number | null;
  action:
    | "target_created"
    | "target_updated"
    | "sync_started"
    | "sync_completed"
    | "sync_unavailable"
    | "schedule_enabled"
    | "schedule_paused";
  detail: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminMarketIngestionEvents).values({
    targetId: input.targetId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    detail: input.detail.slice(0, 1200),
  });
}

export async function listAdminMarketTargets() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(adminMarketIngestionTargets)
    .orderBy(desc(adminMarketIngestionTargets.updatedAt));
}

export async function listAdminMarketIngestionEvents(limit = 80) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(adminMarketIngestionEvents)
    .orderBy(desc(adminMarketIngestionEvents.createdAt))
    .limit(limit);
}

export async function syncAdminMarketTarget(
  targetId: number,
  actorUserId: number | null
) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const target = (
    await db
      .select()
      .from(adminMarketIngestionTargets)
      .where(eq(adminMarketIngestionTargets.id, targetId))
      .limit(1)
  )[0] as MarketTarget | undefined;
  if (!target) throw new Error("MARKET_INGESTION_TARGET_NOT_FOUND");
  await auditAdminMarketIngestion({
    targetId,
    actorUserId,
    action: "sync_started",
    detail: `开始读取 ${target.symbol} 的公共日频 OHLCV。`,
  });
  try {
    const result = await fetchAdminMarketSeries(target);
    const observation = result?.history
      .filter(point => point.close !== null && point.close !== undefined)
      .at(-1);
    if (
      !result ||
      !observation ||
      observation.close === null ||
      observation.close === undefined
    ) {
      const reason = "公开日频来源未返回可验证 OHLCV；系统不保存固定价格替代。";
      await db
        .update(adminMarketIngestionTargets)
        .set({
          lastFetchedAt: new Date(),
          lastStatus: "unavailable",
          lastError: reason,
          source: null,
          currency: null,
          lastObservationDate: null,
          lastClose: null,
          updatedAt: new Date(),
        })
        .where(eq(adminMarketIngestionTargets.id, targetId));
      await auditAdminMarketIngestion({
        targetId,
        actorUserId,
        action: "sync_unavailable",
        detail: reason,
      });
      return {
        targetId,
        symbol: target.symbol,
        status: "unavailable" as const,
        reason,
        observation: null,
      };
    }
    const fetchedAt = new Date();
    const historyArchive = await archiveMarketHistory(
      db,
      target,
      result,
      fetchedAt
    );
    const market = target.marketType === "etf" ? "fund" : target.marketType;
    const latestVolume = result.history.at(-1)?.volume;
    await db
      .insert(marketData)
      .values({
        symbol: target.symbol,
        name: target.displayName,
        market,
        price: String(result.price),
        changeVal: result.change === null ? "—" : String(result.change),
        changePct: result.changePct === null ? "—" : String(result.changePct),
        volume:
          latestVolume === null || latestVolume === undefined
            ? "—"
            : String(latestVolume),
        updatedAt: fetchedAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: target.displayName,
          market,
          price: String(result.price),
          changeVal: result.change === null ? "—" : String(result.change),
          changePct: result.changePct === null ? "—" : String(result.changePct),
          volume:
            latestVolume === null || latestVolume === undefined
              ? "—"
              : String(latestVolume),
          updatedAt: fetchedAt,
        },
      });
    await db
      .update(adminMarketIngestionTargets)
      .set({
        lastFetchedAt: fetchedAt,
        lastStatus: "available",
        lastError: null,
        source: result.source,
        currency: result.currency,
        lastObservationDate: observation.date,
        lastClose: String(observation.close),
        updatedAt: fetchedAt,
      })
      .where(eq(adminMarketIngestionTargets.id, targetId));
    await auditAdminMarketIngestion({
      targetId,
      actorUserId,
      action: "sync_completed",
      detail: `${target.symbol} 公共日频读取成功：${observation.date}；永久历史归档新增 ${historyArchive.inserted} 条，重复 ${historyArchive.duplicate} 条。`,
    });
    return {
      targetId,
      symbol: target.symbol,
      status: "available" as const,
      reason: null,
      observation: {
        date: observation.date,
        close: observation.close,
        currency: result.currency,
        source: result.source,
      },
      historyArchive,
      marketDataUpdated: true,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db
      .update(adminMarketIngestionTargets)
      .set({
        lastFetchedAt: new Date(),
        lastStatus: "unavailable",
        lastError: reason.slice(0, 600),
        source: null,
        currency: null,
        lastObservationDate: null,
        lastClose: null,
        updatedAt: new Date(),
      })
      .where(eq(adminMarketIngestionTargets.id, targetId));
    await auditAdminMarketIngestion({
      targetId,
      actorUserId,
      action: "sync_unavailable",
      detail: `读取失败：${reason}`,
    });
    return {
      targetId,
      symbol: target.symbol,
      status: "unavailable" as const,
      reason,
      observation: null,
    };
  }
}

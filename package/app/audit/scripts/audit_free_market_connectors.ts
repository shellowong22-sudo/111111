import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  fetchAlphaVantageDailySeries,
  fetchEcbReferenceRate,
  fetchFredPublicSeries,
  fetchNyFedLatest,
  fetchSecCompanyFacts,
  fetchStooqDailySeries,
  fetchTwelveDataDailySeries,
  fetchWorldBankIndicator,
  listFreeMarketDataSources,
  listOptionalMarketDataSources,
} from "../../server/freeMarketData";

const appRoot = path.resolve(import.meta.dirname, "../..");
const outputPath = path.join(
  appRoot,
  "audit",
  "runtime",
  "free-market-connector-report.json"
);

type SeriesProbe = {
  available: boolean;
  source: string;
  symbol: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: boolean;
  delayStatus: string;
  history: unknown[];
  limitation: string;
};

function summarizeSeries(result: SeriesProbe) {
  return {
    available: result.available,
    source: result.source,
    symbol: result.symbol,
    observedAt: result.observedAt,
    retrievedAt: result.retrievedAt,
    realtime: result.realtime,
    delayStatus: result.delayStatus,
    recordCount: result.history.length,
    limitation: result.limitation,
  };
}

const [stooq, fred, ecb, sec, nyFed, worldBank, twelveData, alphaVantage] =
  await Promise.all([
    fetchStooqDailySeries("aapl.us", 3),
    fetchFredPublicSeries("SOFR", 3),
    fetchEcbReferenceRate("USD/EUR", 14),
    fetchSecCompanyFacts("320193", ["Assets"], 3),
    fetchNyFedLatest(),
    fetchWorldBankIndicator("USA", "NY.GDP.MKTP.CD", 5),
    fetchTwelveDataDailySeries("AAPL", 3),
    fetchAlphaVantageDailySeries("AAPL", 3),
  ]);

const report = {
  generatedAt: new Date().toISOString(),
  policy: {
    noSyntheticFallback: true,
    credentialsRecorded: false,
    realtimeClaimRequiresLicensedResponse: true,
  },
  catalog: {
    publicWithoutKey: listFreeMarketDataSources(),
    optionalFreeKey: listOptionalMarketDataSources(),
  },
  probes: {
    stooq: summarizeSeries(stooq),
    fred: summarizeSeries(fred),
    ecb: {
      available: ecb.available,
      source: ecb.source,
      pair: ecb.pair,
      observedAt: ecb.observedAt,
      retrievedAt: ecb.retrievedAt,
      realtime: ecb.realtime,
      delayStatus: ecb.delayStatus,
      limitation: ecb.limitation,
    },
    sec: {
      available: sec.available,
      source: sec.source,
      cik: sec.cik,
      observedAt: sec.observedAt,
      retrievedAt: sec.retrievedAt,
      realtime: sec.realtime,
      delayStatus: sec.delayStatus,
      recordCount: sec.facts.length,
      limitation: sec.limitation,
    },
    nyFed: {
      available: nyFed.available,
      source: nyFed.source,
      observedAt: nyFed.observedAt,
      retrievedAt: nyFed.retrievedAt,
      recordCount: nyFed.records.length,
      limitation: nyFed.limitation,
    },
    worldBank: summarizeSeries(worldBank),
    twelveData: summarizeSeries(twelveData),
    alphaVantage: summarizeSeries(alphaVantage),
  },
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      outputPath,
      probes: Object.fromEntries(
        Object.entries(report.probes).map(([name, result]) => [
          name,
          {
            available: result.available,
            recordCount: "recordCount" in result ? result.recordCount : null,
            observedAt: result.observedAt,
          },
        ])
      ),
    },
    null,
    2
  )
);

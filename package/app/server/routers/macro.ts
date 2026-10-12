import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { fetchFredPublicSeries, fetchPublicFxPair, fetchWorldBankIndicator } from "../freeMarketData";
import { fetchUSTreasuryCurve } from "../realDataService";
import { getEconomicCalendarOfficialObservations } from "../economicCalendarOfficialData";

/**
 * Macro dashboard adapter. Existing procedure names are retained, but every
 * value now comes from a public observation adapter. Missing observations stay
 * null; no random walk, old snapshot, forecast, or synthetic zero is returned.
 */
type Country = { name: string; code: string };
const COUNTRIES: readonly Country[] = [
  { name: "美国", code: "USA" }, { name: "中国", code: "CHN" },
  { name: "欧元区", code: "EMU" }, { name: "日本", code: "JPN" },
  { name: "英国", code: "GBR" }, { name: "德国", code: "DEU" },
  { name: "印度", code: "IND" }, { name: "巴西", code: "BRA" },
] as const;
const COUNTRY_BY_NAME = new Map(COUNTRIES.map(country => [country.name, country]));
const WB_INDICATORS = {
  gdp: "NY.GDP.MKTP.CD", gdpGrowth: "NY.GDP.MKTP.KD.ZG", cpi: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS", debtGdp: "GC.DOD.TOTL.GD.ZS", currentAccount: "BN.CAB.XOKA.GD.ZS",
  tradeBalance: "NE.RSB.GNFS.CD",
} as const;
type Metric = keyof typeof WB_INDICATORS;
type Point = { date: string; value: number };
type Series = { available: boolean; history: Point[]; observedAt: string | null; limitation: string };
type CountrySnapshot = Partial<Record<Metric, Series>> & {
  ppi?: Series;
  industrialProduction?: Series;
};
const snapshotCache = new Map<string, { at: number; value: CountrySnapshot }>();
const snapshotPending = new Map<string, Promise<CountrySnapshot>>();
const CACHE_MS = 5 * 60_000;

function emptySeries(reason: string): Series { return { available: false, history: [], observedAt: null, limitation: reason }; }
async function loadMetric(country: Country, metric: Metric): Promise<Series> {
  try {
    const result = await fetchWorldBankIndicator(country.code, WB_INDICATORS[metric], 80);
    return { available: result.available, history: result.history.map(point => ({ date: point.date, value: point.value })), observedAt: result.observedAt, limitation: result.limitation };
  } catch (error) { return emptySeries(`World Bank 观察不可用（${error instanceof Error ? error.message : "unknown"}）；未补造数值。`); }
}
async function loadCountrySnapshot(country: Country): Promise<CountrySnapshot> {
  const cached = snapshotCache.get(country.code);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const inflight = snapshotPending.get(country.code); if (inflight) return inflight;
  const task = Promise.all((Object.keys(WB_INDICATORS) as Metric[]).map(async metric => [metric, await loadMetric(country, metric)] as const))
    .then(async entries => {
      const value = Object.fromEntries(entries) as CountrySnapshot;
      // The ZIP explicitly calls out a macro/industrial data layer.  For the
      // existing USA economics surface, add two independently sourced FRED
      // releases instead of leaving PPI as a hard-coded empty field.  Other
      // countries remain empty until an official series is configured for that
      // country; no cross-country proxy is substituted.
      if (country.code === "USA") {
        const [ppi, industrialProduction] = await Promise.all([
          loadFred("PPIFIS", 120),
          loadFred("IPMAN", 120),
        ]);
        value.ppi = ppi;
        value.industrialProduction = industrialProduction;
      }
      snapshotCache.set(country.code, { at: Date.now(), value });
      return value;
    });
  snapshotPending.set(country.code, task); try { return await task; } finally { snapshotPending.delete(country.code); }
}
function selectedCountry(name: string): Country | null { return COUNTRY_BY_NAME.get(name) ?? null; }
function latest(series: Series | undefined): Point | null { return series?.history.at(-1) ?? null; }
function previous(series: Series | undefined): Point | null { return series?.history.at(-2) ?? null; }
function delta(series: Series | undefined): number | null { const current = latest(series); const prior = previous(series); return current && prior ? current.value - prior.value : null; }
function safeNumber(value: number | null | undefined, scale = 1): number | null { return value !== null && value !== undefined && Number.isFinite(value) ? value * scale : null; }
function metricHistory(snapshot: CountrySnapshot, metric: Metric, scale = 1, periods = 24): Point[] { return (snapshot[metric]?.history ?? []).slice(-Math.max(1, Math.min(periods, 120))).map(point => ({ date: point.date, value: point.value * scale })); }
async function loadFred(id: string, limit = 120): Promise<Series> {
  try { const result = await fetchFredPublicSeries(id, limit); return { available: result.available, history: result.history.map(point => ({ date: point.date, value: point.value })), observedAt: result.observedAt, limitation: result.limitation }; }
  catch { return emptySeries("FRED 观察不可用；未补造数值。"); }
}
async function policyRate(name: string): Promise<Series> {
  const ids: Record<string, string> = { "美国": "DFF", "欧元区": "ECBDFR", "德国": "ECBDFR" };
  const id = ids[name];
  return id
    ? loadFred(id, 120)
    : emptySeries("该经济体没有在当前免费适配器中配置政策利率序列；未补造数值。");
}
function pearson(rows: Array<{ x: number; y: number }>): number | null { if (rows.length < 3) return null; const x = rows.reduce((sum, row) => sum + row.x, 0) / rows.length; const y = rows.reduce((sum, row) => sum + row.y, 0) / rows.length; const xx = rows.reduce((sum, row) => sum + (row.x - x) ** 2, 0); const yy = rows.reduce((sum, row) => sum + (row.y - y) ** 2, 0); if (!xx || !yy) return null; return rows.reduce((sum, row) => sum + (row.x - x) * (row.y - y), 0) / Math.sqrt(xx * yy); }

export const macroRouter = router({
  getCountries: publicProcedure.query(() => COUNTRIES.map(country => country.name)),
  getIndicators: publicProcedure.input(z.object({ country: z.string() })).query(async ({ input }) => {
    const country = selectedCountry(input.country);
    if (!country) return { country: input.country, currency: null, retrievedAt: new Date().toISOString(), indicators: [] };
    const [snapshot, rate] = await Promise.all([loadCountrySnapshot(country), policyRate(country.name)]);
    const currency = ({ "美国": "USD", "中国": "CNY", "欧元区": "EUR", "日本": "JPY", "英国": "GBP", "德国": "EUR", "印度": "INR", "巴西": "BRL" } as Record<string, string>)[country.name] ?? null;
    const indicator = (name: string, series: Series | undefined, unit: string, changeLabel: string, scale = 1) => { const current = latest(series); return { name, value: safeNumber(current?.value, scale), unit, change: safeNumber(delta(series), scale), changeLabel, observedAt: current?.date ?? null }; };
    const currentRate = latest(rate);
    return { country: country.name, currency, retrievedAt: new Date().toISOString(), indicators: [
      indicator("GDP 规模", snapshot.gdp, "万亿美元", "同比", 1 / 1e12), indicator("GDP 增速", snapshot.gdpGrowth, "%", "同比"), indicator("CPI 通胀", snapshot.cpi, "%", "同比"), indicator("PPI 出厂价", snapshot.ppi, "指数", "相邻发布"), indicator("失业率", snapshot.unemployment, "%", "同比"), indicator("PMI 制造业", undefined, "", "未配置官方序列"),
      indicator("制造业产出", snapshot.industrialProduction, "指数", "相邻发布"),
      { ...indicator("政策利率", rate, "%", "最新"), value: currentRate?.value ?? null, change: delta(rate), observedAt: currentRate?.date ?? null }, indicator("债务/GDP", snapshot.debtGdp, "%", "同比"), indicator("贸易差额", snapshot.tradeBalance, "亿美元", "年度", 1 / 1e8), indicator("经常账户", snapshot.currentAccount, "% GDP", "年度"),
    ] };
  }),
  getGdpTimeSeries: publicProcedure.input(z.object({ country: z.string(), periods: z.number().default(24) })).query(async ({ input }) => { const country = selectedCountry(input.country); return country ? metricHistory(await loadCountrySnapshot(country), "gdp", 1 / 1e12, input.periods) : []; }),
  getCpiTimeSeries: publicProcedure.input(z.object({ country: z.string(), periods: z.number().default(24) })).query(async ({ input }) => { const country = selectedCountry(input.country); return country ? metricHistory(await loadCountrySnapshot(country), "cpi", 1, input.periods) : []; }),
  getUnemploymentTimeSeries: publicProcedure.input(z.object({ country: z.string(), periods: z.number().default(24) })).query(async ({ input }) => { const country = selectedCountry(input.country); return country ? metricHistory(await loadCountrySnapshot(country), "unemployment", 1, input.periods) : []; }),
  getPmiTimeSeries: publicProcedure.input(z.object({ country: z.string(), periods: z.number().default(24) })).query(async () => []),
  getMultiCountryComparison: publicProcedure.input(z.object({ metric: z.string(), countries: z.array(z.string()) })).query(async ({ input }) => {
    const metric = (input.metric in WB_INDICATORS ? input.metric : null) as Metric | null;
    return Promise.all(input.countries.map(async name => { const country = selectedCountry(name); if (!country) return { country: name, value: null, observedAt: null }; if (input.metric === "rate") { const series = await policyRate(name); const point = latest(series); return { country: name, value: point?.value ?? null, observedAt: point?.date ?? null }; } if (!metric) return { country: name, value: null, observedAt: null }; const point = latest((await loadCountrySnapshot(country))[metric]); return { country: name, value: point?.value ?? null, observedAt: point?.date ?? null }; }));
  }),
  getMultiMetricComparison: publicProcedure.input(z.object({ countries: z.array(z.string()).max(8) })).query(async ({ input }) => {
    const uniqueCountries = [...new Set(input.countries)].slice(0, 8);
    return Promise.all(uniqueCountries.map(async name => {
      const country = selectedCountry(name);
      if (!country) return { country: name, values: { gdpGrowth: null, cpi: null, unemployment: null, pmi: null, rate: null, debtGdp: null } };
      const [snapshot, rate] = await Promise.all([loadCountrySnapshot(country), policyRate(name)]);
      return {
        country: name,
        values: {
          gdpGrowth: latest(snapshot.gdpGrowth)?.value ?? null,
          cpi: latest(snapshot.cpi)?.value ?? null,
          unemployment: latest(snapshot.unemployment)?.value ?? null,
          pmi: null,
          ppi: latest(snapshot.ppi)?.value ?? null,
          industrialProduction: latest(snapshot.industrialProduction)?.value ?? null,
          rate: latest(rate)?.value ?? null,
          debtGdp: latest(snapshot.debtGdp)?.value ?? null,
        },
      };
    }));
  }),
  getCorrelationMatrix: publicProcedure.query(async () => {
    const indicators = ["GDP增速", "CPI", "失业率", "PMI", "政策利率", "债务/GDP"]; const metricMap: Array<Metric | null> = ["gdpGrowth", "cpi", "unemployment", null, null, "debtGdp"]; const snapshots = await Promise.all(COUNTRIES.map(async country => [country.name, await loadCountrySnapshot(country)] as const));
    const matrix = metricMap.map((left, i) => metricMap.map((right, j) => { if (i === j && left) return 1; if (!left || !right) return null; const rows: Array<{ x: number; y: number }> = []; for (const [, snapshot] of snapshots) { const rightMap = new Map((snapshot[right]?.history ?? []).map(point => [point.date, point.value])); for (const point of snapshot[left]?.history ?? []) { const y = rightMap.get(point.date); if (y !== undefined) rows.push({ x: point.value, y }); } } return pearson(rows); }));
    return { indicators, matrix };
  }),
  getEconomicCalendar: publicProcedure.query(async () => { const snapshot = await getEconomicCalendarOfficialObservations(); return snapshot.observations.filter(item => item.status === "available" && item.observationDate && item.value !== null).map(item => ({ date: item.observationDate!, country: item.region, event: item.label, actual: String(item.value), forecast: null, previous: item.previousValue === null ? null : String(item.previousValue), impact: null, surprise: null, observedAt: item.observationDate, institution: item.institution })); }),
  getYieldCurveComparison: publicProcedure.query(async () => { const curve = await fetchUSTreasuryCurve(); return { tenors: curve.map(row => row.tenor), curves: { "美国": curve.map(row => row.yield) } }; }),
  getFxRates: publicProcedure.query(async () => { const pairs = ["USD/CNY", "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CHF", "USD/CAD", "USD/KRW"]; return Promise.all(pairs.map(async pair => { const result = await fetchPublicFxPair(pair); return { pair, rate: result.rate, change: result.change, changePct: result.changePct, observedAt: result.observedAt }; })); }),
  getCentralBankRates: publicProcedure.query(async () => { const definitions = [{ bank: "美联储 (Fed)", id: "DFF" }, { bank: "欧央行 (ECB)", id: "ECBDFR" }]; const rows = await Promise.all(definitions.map(async definition => { const result = await loadFred(definition.id, 120); const point = latest(result); const prior = previous(result); return { bank: definition.bank, rate: point?.value ?? null, lastChange: point?.date ?? null, direction: point && prior && point.value > prior.value ? "hike" : point && prior && point.value < prior.value ? "cut" : null, nextMeeting: null }; })); return [...rows, ...["英央行 (BOE)", "日央行 (BOJ)", "中国人民银行", "瑞士央行 (SNB)", "加拿大央行", "澳大利亚央行"].map(bank => ({ bank, rate: null, lastChange: null, direction: null, nextMeeting: null }))]; }),
});

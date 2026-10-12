import { publicProcedure, router } from "../_core/trpc";

const CACHE_MS = 5 * 60_000;
const CURRENCIES = ["USD", "JPY", "GBP", "CHF", "AUD", "CAD", "CNY"] as const;
type Currency = typeof CURRENCIES[number];
type Observation = { date: string; value: number };
type EcbRow = { currency: Currency; title: string; observationDate: string | null; rate: number | null; change7d: number | null; change7dPct: number | null; history: Observation[] };
type Snapshot = { expiresAt: number; fetchedAt: string; rows: EcbRow[] };
let cache: Snapshot | null = null;
let pending: Promise<Snapshot> | null = null;

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [] as Observation[];
  const headers = lines[0].split(",");
  const dateIndex = headers.indexOf("TIME_PERIOD");
  const valueIndex = headers.indexOf("OBS_VALUE");
  if (dateIndex < 0 || valueIndex < 0) return [];
  const observations = new Map<string, Observation>();
  const conflicts = new Set<string>();
  for (const line of lines.slice(1)) {
    const fields = line.split(",");
    const date = fields[dateIndex]?.trim() ?? "";
    const raw = fields[valueIndex]?.trim() ?? "";
    const value = Number(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !raw || !Number.isFinite(value) || value <= 0) continue;
    const previous = observations.get(date);
    if (previous && previous.value !== value) conflicts.add(date);
    observations.set(date, { date, value });
  }
  return [...observations.values()].filter(row => !conflicts.has(row.date)).sort((a, b) => a.date.localeCompare(b.date));
}

async function readCurrency(currency: Currency): Promise<EcbRow> {
  const start = new Date(Date.now() - 18 * 86_400_000).toISOString().slice(0, 10);
  const source = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?startPeriod=${start}&format=csvdata`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(source, { headers: { "User-Agent": "finance-hub/ecb-reference-evidence" }, signal: controller.signal });
    if (!response.ok) return { currency, title: `${currency}/EUR ECB reference exchange rate`, observationDate: null, rate: null, change7d: null, change7dPct: null, history: [] };
    const history = parseCsv(await response.text()).slice(-8);
    const latest = history.at(-1);
    const first = history[0];
    const change7d = history.length === 8 && latest && first ? latest.value - first.value : null;
    return { currency, title: `${currency}/EUR ECB reference exchange rate`, observationDate: latest?.date ?? null, rate: latest?.value ?? null, change7d, change7dPct: change7d !== null && first?.value ? (change7d / first.value) * 100 : null, history };
  } catch {
    return { currency, title: `${currency}/EUR ECB reference exchange rate`, observationDate: null, rate: null, change7d: null, change7dPct: null, history: [] };
  } finally { clearTimeout(timer); }
}

async function getSnapshot(): Promise<Snapshot> {
  if (cache && cache.expiresAt > Date.now()) return cache;
  if (pending) return pending;
  pending = Promise.all(CURRENCIES.map(readCurrency)).then(rows => {
    // Cache hits must never extend the upstream refresh deadline.
    const complete = rows.every(row => row.rate !== null);
    cache = { rows, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + (complete ? CACHE_MS : 30_000) };
    return cache;
  }).finally(() => { pending = null; });
  return pending;
}

export const ecbForeignExchangeRouter = router({
  getReferenceRates: publicProcedure.query(async () => {
    const { rows, fetchedAt } = await getSnapshot();
    const available = rows.filter((row) => row.rate !== null);
    return {
      available: available.length > 0,
      rows,
      source: "European Central Bank · EXR reference exchange rates",
      fetchedAt,
      classification: "official_ecb_reference_exchange_rate",
      limitation: available.length ? "ECB 参考汇率以 EUR 为基准，仅反映已发布的官方参考观测；不是可执行 bid/ask、订单簿、实时交易价格或交易建议。" : "欧洲中央银行本次未返回可验证的参考汇率；系统未以原页面固定数值或模拟数据替代。",
    };
  }),
});

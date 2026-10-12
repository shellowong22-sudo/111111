import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { listForexCentralBankArchive } from '../forexCentralBankArchiveDb';
import { deleteForexFreshnessAlertRule, FX_FRESHNESS_SERIES_IDS, listForexFreshnessAlertRules, saveForexFreshnessAlertRule } from '../forexFreshnessAlertDb';
import { deleteForexSameDayTimelinePreset, listForexSameDayTimelinePresets, saveForexSameDayTimelinePreset } from '../forexTimelinePresetDb';
import { and, desc, eq } from 'drizzle-orm';
import { marketDataObservationHistory } from '../../drizzle/schema';
import { archiveCanonicalObservationSeries } from '../adminMarketIngestion';
import { getDb } from '../db';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Range = '1y' | '3y' | '5y' | 'max';
type FxPoint = { date: string; value: number };
type Orientation = 'usd_per_foreign' | 'foreign_per_usd' | 'index' | 'percent';
type Definition = { id: string; label: string; currency: string; unit: string; orientation: Orientation; sourceUrl: string };
type Reading = Definition & { status: 'available' | 'unavailable'; observationDate: string | null; value: number | null; previousValue: number | null; changePct: number | null; history: FxPoint[]; limitation: string };

const FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=';
export const FX_SERIES: Definition[] = [
  { id: 'DEXUSEU', label: '美元/欧元', currency: 'EUR', unit: '美元/欧元', orientation: 'usd_per_foreign', sourceUrl: `${FRED}DEXUSEU` },
  { id: 'DEXUSUK', label: '美元/英镑', currency: 'GBP', unit: '美元/英镑', orientation: 'usd_per_foreign', sourceUrl: `${FRED}DEXUSUK` },
  { id: 'DEXUSAL', label: '美元/澳元', currency: 'AUD', unit: '美元/澳元', orientation: 'usd_per_foreign', sourceUrl: `${FRED}DEXUSAL` },
  { id: 'DEXJPUS', label: '日元/美元', currency: 'JPY', unit: '日元/美元', orientation: 'foreign_per_usd', sourceUrl: `${FRED}DEXJPUS` },
  { id: 'DEXCAUS', label: '加元/美元', currency: 'CAD', unit: '加元/美元', orientation: 'foreign_per_usd', sourceUrl: `${FRED}DEXCAUS` },
  { id: 'DEXSZUS', label: '瑞郎/美元', currency: 'CHF', unit: '瑞郎/美元', orientation: 'foreign_per_usd', sourceUrl: `${FRED}DEXSZUS` },
  { id: 'DEXSIUS', label: '新元/美元', currency: 'SGD', unit: '新元/美元', orientation: 'foreign_per_usd', sourceUrl: `${FRED}DEXSIUS` },
  { id: 'DEXKOUS', label: '韩元/美元', currency: 'KRW', unit: '韩元/美元', orientation: 'foreign_per_usd', sourceUrl: `${FRED}DEXKOUS` },
  { id: 'DTWEXBGS', label: '名义广义美元指数', currency: 'USD', unit: '2006-01=100', orientation: 'index', sourceUrl: `${FRED}DTWEXBGS` },
  { id: 'DTWEXAFEGS', label: '先进经济体美元指数', currency: 'USD', unit: '2006-01=100', orientation: 'index', sourceUrl: `${FRED}DTWEXAFEGS` },
  { id: 'DTWEXEMEGS', label: '新兴经济体美元指数', currency: 'USD', unit: '2006-01=100', orientation: 'index', sourceUrl: `${FRED}DTWEXEMEGS` },
  { id: 'DFF', label: '有效联邦基金利率', currency: 'USD', unit: '%', orientation: 'percent', sourceUrl: `${FRED}DFF` },
  { id: 'DGS2', label: '美国国债 2 年期', currency: 'USD', unit: '%', orientation: 'percent', sourceUrl: `${FRED}DGS2` },
  { id: 'DGS10', label: '美国国债 10 年期', currency: 'USD', unit: '%', orientation: 'percent', sourceUrl: `${FRED}DGS10` },
];

const SERIES = new Map(FX_SERIES.map((definition) => [definition.id, definition]));
const pending = new Map<string, Promise<Reading>>();
const cached = new Map<string, { at: number; reading: Reading }>();

type PublicFxPair = { pair: string; base: string; quote: string; label: string };
type FrankfurterRate = { date: string; base: string; quote: string; rate: number };
export type PublicFxReading = PublicFxPair & { dataMode: 'public_daily'; status: 'available' | 'unavailable'; observationDate: string | null; rate: number | null; previousRate: number | null; changePct: number | null; history: FxPoint[]; limitation: string };

export const PUBLIC_FX_PAIRS: PublicFxPair[] = [
  { pair: 'EUR/USD', base: 'EUR', quote: 'USD', label: '欧元 / 美元' },
  { pair: 'GBP/USD', base: 'GBP', quote: 'USD', label: '英镑 / 美元' },
  { pair: 'USD/JPY', base: 'USD', quote: 'JPY', label: '美元 / 日元' },
  { pair: 'USD/CHF', base: 'USD', quote: 'CHF', label: '美元 / 瑞郎' },
  { pair: 'AUD/USD', base: 'AUD', quote: 'USD', label: '澳元 / 美元' },
  { pair: 'USD/CAD', base: 'USD', quote: 'CAD', label: '美元 / 加元' },
  { pair: 'NZD/USD', base: 'NZD', quote: 'USD', label: '纽元 / 美元' },
  { pair: 'EUR/GBP', base: 'EUR', quote: 'GBP', label: '欧元 / 英镑' },
  { pair: 'EUR/JPY', base: 'EUR', quote: 'JPY', label: '欧元 / 日元' },
  { pair: 'GBP/JPY', base: 'GBP', quote: 'JPY', label: '英镑 / 日元' },
  { pair: 'USD/CNY', base: 'USD', quote: 'CNY', label: '美元 / 人民币' },
  { pair: 'USD/HKD', base: 'USD', quote: 'HKD', label: '美元 / 港元' },
  { pair: 'USD/SGD', base: 'USD', quote: 'SGD', label: '美元 / 新加坡元' },
  { pair: 'EUR/CHF', base: 'EUR', quote: 'CHF', label: '欧元 / 瑞郎' },
  { pair: 'EUR/AUD', base: 'EUR', quote: 'AUD', label: '欧元 / 澳元' },
  { pair: 'EUR/CAD', base: 'EUR', quote: 'CAD', label: '欧元 / 加元' },
  { pair: 'EUR/NZD', base: 'EUR', quote: 'NZD', label: '欧元 / 纽元' },
  { pair: 'GBP/CHF', base: 'GBP', quote: 'CHF', label: '英镑 / 瑞郎' },
  { pair: 'GBP/AUD', base: 'GBP', quote: 'AUD', label: '英镑 / 澳元' },
  { pair: 'AUD/JPY', base: 'AUD', quote: 'JPY', label: '澳元 / 日元' },
  { pair: 'AUD/CAD', base: 'AUD', quote: 'CAD', label: '澳元 / 加元' },
  { pair: 'CAD/JPY', base: 'CAD', quote: 'JPY', label: '加元 / 日元' },
  { pair: 'CHF/JPY', base: 'CHF', quote: 'JPY', label: '瑞郎 / 日元' },
  { pair: 'NZD/JPY', base: 'NZD', quote: 'JPY', label: '纽元 / 日元' },
  { pair: 'USD/KRW', base: 'USD', quote: 'KRW', label: '美元 / 韩元' },
  { pair: 'USD/MXN', base: 'USD', quote: 'MXN', label: '美元 / 墨西哥比索' },
  { pair: 'USD/SEK', base: 'USD', quote: 'SEK', label: '美元 / 瑞典克朗' },
  { pair: 'USD/NOK', base: 'USD', quote: 'NOK', label: '美元 / 挪威克朗' },
  { pair: 'USD/THB', base: 'USD', quote: 'THB', label: '美元 / 泰铢' },
  { pair: 'USD/IDR', base: 'USD', quote: 'IDR', label: '美元 / 印尼盾' },
  { pair: 'USD/MYR', base: 'USD', quote: 'MYR', label: '美元 / 马来西亚林吉特' },
  { pair: 'USD/PHP', base: 'USD', quote: 'PHP', label: '美元 / 菲律宾比索' },
  { pair: 'USD/VND', base: 'USD', quote: 'VND', label: '美元 / 越南盾' },
  { pair: 'USD/AED', base: 'USD', quote: 'AED', label: '美元 / 阿联酋迪拉姆' },
  { pair: 'USD/SAR', base: 'USD', quote: 'SAR', label: '美元 / 沙特里亚尔' },
  { pair: 'USD/TRY', base: 'USD', quote: 'TRY', label: '美元 / 土耳其里拉' },
  { pair: 'USD/ZAR', base: 'USD', quote: 'ZAR', label: '美元 / 南非兰特' },
  { pair: 'USD/BRL', base: 'USD', quote: 'BRL', label: '美元 / 巴西雷亚尔' },
];

const FRANKFURTER_API = 'https://api.frankfurter.dev/v2';
export const FRANKFURTER_DATA_CONTRACT = 'fx.frankfurter.daily.v1';
const FRANKFURTER_MODULE_ID = 'forex-hub';
const FRANKFURTER_FILE = path.join(process.cwd(), '.runtime', 'forex-public-reference', 'history.json');
const PUBLIC_FX_CACHE_MS = 5 * 60_000;
type PublicFxSnapshot = { readings: PublicFxReading[]; checkedAt: string; persistence: { inserted: number; duplicate: number; storage: 'persistent' | 'unavailable' } };
type PublicFxCache = PublicFxSnapshot & { at: number };
let publicFxCache: PublicFxCache | null = null;
let publicFxPending: Promise<PublicFxCache> | null = null;

type PersistedFilePoint = { pair: string; base: string; quote: string; date: string; value: number; fetchedAt: string };
async function readFileHistory(): Promise<PersistedFilePoint[]> {
  try {
    const parsed = JSON.parse(await readFile(FRANKFURTER_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((row): row is PersistedFilePoint => row && typeof row.pair === 'string' && typeof row.date === 'string' && Number.isFinite(row.value)) : [];
  } catch { return []; }
}
async function writeFileHistory(rows: PersistedFilePoint[]) {
  await mkdir(path.dirname(FRANKFURTER_FILE), { recursive: true });
  const temp = `${FRANKFURTER_FILE}.tmp`;
  await writeFile(temp, JSON.stringify(rows, null, 2), 'utf8');
  await rename(temp, FRANKFURTER_FILE);
}

async function persistFrankfurterReadings(readings: PublicFxReading[], fetchedAt: Date) {
  const db = await getDb();
  if (!db) {
    const existing = await readFileHistory();
    const keys = new Set(existing.map((row) => `${row.pair}|${row.date}|${row.value}`));
    let inserted = 0;
    for (const reading of readings) for (const point of reading.history) {
      const row = { pair: reading.pair, base: reading.base, quote: reading.quote, date: point.date, value: point.value, fetchedAt: fetchedAt.toISOString() };
      const key = `${row.pair}|${row.date}|${row.value}`;
      if (keys.has(key)) continue;
      keys.add(key); existing.push(row); inserted += 1;
    }
    if (inserted) await writeFileHistory(existing);
    return { inserted, duplicate: existing.length - inserted >= 0 ? readings.reduce((sum, reading) => sum + reading.history.length, 0) - inserted : 0, storage: 'persistent' as const };
  }
  let inserted = 0;
  let duplicate = 0;
  for (const reading of readings) {
    if (!reading.history.length) continue;
    const result = await archiveCanonicalObservationSeries({
      moduleId: FRANKFURTER_MODULE_ID,
      dataContractId: FRANKFURTER_DATA_CONTRACT,
      symbol: reading.pair,
      source: 'Frankfurter public daily reference API',
      sourceReference: FRANKFURTER_API,
      schemaVersion: 'fx-frankfurter-daily-v1',
      fetchedAt,
      history: reading.history.map((point) => ({
        date: point.date,
        payload: {
          pair: reading.pair,
          base: reading.base,
          quote: reading.quote,
          rate: point.value,
          dataMode: reading.dataMode,
        },
      })),
    });
    inserted += result.inserted;
    duplicate += result.duplicate;
  }
  return { inserted, duplicate, storage: 'persistent' as const };
}

async function readPersistedFrankfurterReadings(): Promise<PublicFxReading[]> {
  const db = await getDb();
  if (!db) {
    const rows = await readFileHistory();
    return PUBLIC_FX_PAIRS.map((pair) => buildPublicFxReading(pair, rows.filter((row) => row.pair === pair.pair).map((row) => ({ date: row.date, value: row.value })).sort((a, b) => a.date.localeCompare(b.date))));
  }
  const rows = await db.select({
    id: marketDataObservationHistory.id,
    observationDate: marketDataObservationHistory.observationDate,
    fetchedAt: marketDataObservationHistory.fetchedAt,
    payload: marketDataObservationHistory.payload,
  }).from(marketDataObservationHistory)
    .where(and(eq(marketDataObservationHistory.moduleId, FRANKFURTER_MODULE_ID), eq(marketDataObservationHistory.dataContractId, FRANKFURTER_DATA_CONTRACT)))
    .orderBy(desc(marketDataObservationHistory.observationDate), desc(marketDataObservationHistory.id))
    .limit(20_000);
  const byPair = new Map<string, { pair: PublicFxPair; history: FxPoint[] }>();
  for (const row of rows) {
    const payload = row.payload ?? {};
    const pair = PUBLIC_FX_PAIRS.find((candidate) => candidate.pair === payload.pair);
    const value = typeof payload.rate === 'number' ? payload.rate : Number(payload.rate);
    if (!pair || !Number.isFinite(value) || value <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.observationDate)) continue;
    const target = byPair.get(pair.pair) ?? { pair, history: [] };
    if (!target.history.some((point) => point.date === row.observationDate)) target.history.push({ date: row.observationDate, value });
    byPair.set(pair.pair, target);
  }
  return PUBLIC_FX_PAIRS.map((pair) => buildPublicFxReading(pair, (byPair.get(pair.pair)?.history ?? []).sort((a, b) => a.date.localeCompare(b.date))));
}

export function parseFrankfurterRates(payload: unknown, pair?: PublicFxPair): FxPoint[] {
  if (!Array.isArray(payload)) return [];
  const unique = new Map<string, FxPoint>();
  const conflicts = new Set<string>();
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<FrankfurterRate>;
    if (pair && (row.base !== pair.base || row.quote !== pair.quote)) continue;
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date || typeof row.rate !== 'number' || !Number.isFinite(row.rate) || row.rate <= 0) continue;
    const previous = unique.get(row.date);
    if (previous && previous.value !== row.rate) conflicts.add(row.date);
    unique.set(row.date, { date: row.date, value: row.rate });
  }
  return [...unique.values()].filter(row => !conflicts.has(row.date)).sort((left, right) => left.date.localeCompare(right.date));
}

export function buildPublicFxReading(pair: PublicFxPair, history: FxPoint[]): PublicFxReading {
  const latest = history.at(-1) ?? null;
  const previous = history.at(-2) ?? null;
  return {
    ...pair,
    status: latest ? 'available' : 'unavailable',
    observationDate: latest?.date ?? null,
    rate: latest?.value ?? null,
    previousRate: previous?.value ?? null,
    changePct: latest && previous && previous.value !== 0 ? Number((((latest.value / previous.value) - 1) * 100).toFixed(4)) : null,
    history,
    dataMode: 'public_daily',
    limitation: latest ? '公开中央银行日频参考汇率；数据随发布更新，不是逐秒行情、银行买卖价、订单簿或可执行报价。' : '该货币对未返回可核验日频参考值；保持未接入，不生成替代数值。',
  };
}

function publicFxStartDate() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 120);
  return start.toISOString().slice(0, 10);
}

async function fetchPublicFxReferences(force: boolean): Promise<PublicFxSnapshot> {
  const ttl = publicFxCache?.readings.every(row => row.status === 'available') ? PUBLIC_FX_CACHE_MS : 30_000;
  if (!force && publicFxCache && Date.now() - publicFxCache.at < ttl) return publicFxCache;
  if (publicFxPending) return publicFxPending;
  const from = publicFxStartDate();
  const to = new Date().toISOString().slice(0, 10);
  const bases = [...new Set(PUBLIC_FX_PAIRS.map(pair => pair.base))];
  publicFxPending = Promise.all(bases.map(async (base) => {
    const pairs = PUBLIC_FX_PAIRS.filter(pair => pair.base === base);
    try {
      const response = await fetch(`${FRANKFURTER_API}/rates?base=${base}&quotes=${pairs.map(pair => pair.quote).join(',')}&from=${from}&to=${to}`, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`FRANKFURTER_${response.status}`);
      const payload = await response.json();
      return pairs.map(pair => buildPublicFxReading(pair, parseFrankfurterRates(payload, pair).filter(point => point.date >= from && point.date <= to)));
    } catch {
      return pairs.map(pair => buildPublicFxReading(pair, []));
    }
  })).then(async groups => {
    const fetchedReadings = groups.flat().sort((a, b) => PUBLIC_FX_PAIRS.findIndex(p => p.pair === a.pair) - PUBLIC_FX_PAIRS.findIndex(p => p.pair === b.pair));
    const fetchedAt = new Date();
    const persistence = await persistFrankfurterReadings(fetchedReadings, fetchedAt);
    const persistedReadings = await readPersistedFrankfurterReadings();
    const persistedByPair = new Map(persistedReadings.map((reading) => [reading.pair, reading]));
    const readings = fetchedReadings.map((reading) => {
      if (reading.status === 'available') return reading;
      const persisted = persistedByPair.get(reading.pair);
      return persisted?.status === 'available'
        ? { ...persisted, limitation: `${persisted.limitation} 本次 API 请求未返回新观测；展示已持久化历史，不冒充当前报价。` }
        : reading;
    });
    publicFxCache = { at: Date.now(), readings, checkedAt: fetchedAt.toISOString(), persistence };
    return publicFxCache;
  }).finally(() => { publicFxPending = null; });
  return publicFxPending;
}

export function parseForexFredCsv(csv: string): FxPoint[] {
  return csv.split(/\r?\n/).slice(1).flatMap((line) => { const [date, raw] = line.split(','); const value = Number(raw); return date && raw && raw !== '.' && Number.isFinite(value) ? [{ date: date.trim(), value }] : []; });
}

async function fetchSeries(id: string): Promise<Reading> {
  const definition = SERIES.get(id); if (!definition) throw new Error(`UNKNOWN_FX_SERIES_${id}`);
  const existing = cached.get(id); if (existing && Date.now() - existing.at < 60_000) return existing.reading;
  const inFlight = pending.get(id); if (inFlight) return inFlight;
  const request: Promise<Reading> = (async (): Promise<Reading> => {
    try {
      const response = await fetch(definition.sourceUrl, { signal: AbortSignal.timeout(12_000) }); if (!response.ok) throw new Error(`FRED_${response.status}`);
      const history = parseForexFredCsv(await response.text()); const latest = history.at(-1) ?? null; const previous = history.at(-2) ?? null;
      const reading: Reading = { ...definition, status: latest ? 'available' : 'unavailable', observationDate: latest?.date ?? null, value: latest?.value ?? null, previousValue: previous?.value ?? null, changePct: latest && previous && previous.value !== 0 ? Number((((latest.value / previous.value) - 1) * 100).toFixed(4)) : null, history, limitation: 'FRED 转载美联储 H.10 公开历史观察；不是实时可执行报价、银行点差、订单簿、官方 fixing、期权隐含波动率或交叉货币基点差。' };
      cached.set(id, { at: Date.now(), reading }); return reading;
    } catch {
      return { ...definition, status: 'unavailable', observationDate: null, value: null, previousValue: null, changePct: null, history: [], limitation: '当前无法读取 FRED/H.10 公开历史序列；终端不以缓存样例、随机路径或第三方报价替代。' };
    } finally { pending.delete(id); }
  })(); pending.set(id, request); return request;
}

const MODULES = ['FXIP', 'FXDS', 'FXTF', 'FXC', 'WCR', 'WVOL', 'XCCY', 'GMM', 'FXSW', 'XDSH', 'FXFC', 'WCRS', 'ECMI', 'MYQ', 'ALLQ', 'FRD', 'OVML', 'BFIX', 'FXFA', 'GP', 'FIRS', 'TOP_FX', 'STNI', 'RES', 'BICO', 'MARS_FX', 'FXCORR', 'FXIV'] as const;
export type ForexModuleId = typeof MODULES[number];
type ModuleConfig = { title: string; focus: string; mode: 'overview' | 'coverage' | 'orientation' | 'cross' | 'history' | 'range' | 'basis' | 'macro' | 'watch' | 'forecast' | 'ranking' | 'daily' | 'personal' | 'forward' | 'option' | 'fixing' | 'carry' | 'single' | 'source' | 'news' | 'catalog' | 'execution'; seriesIds: string[] };
export const FOREX_MODULE_CONFIG: Record<ForexModuleId, ModuleConfig> = {
  FXIP: { title: 'FXIP · 公开外汇市场概览', focus: '以主货币和广义美元指数的实际共同日期观察构成概览，不替代原门户的资讯与工作流。', mode: 'overview', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DTWEXBGS'] },
  FXDS: { title: 'FXDS · 公开资料可读性', focus: '逐项核验公开货币序列的单位、最新观测和历史覆盖，不把缺失币种补成报价。', mode: 'coverage', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DEXSZUS', 'DEXUSAL', 'DEXSIUS', 'DEXKOUS'] },
  FXTF: { title: 'FXTF · 汇率方向校验', focus: '显示 H.10 系列的基础货币方向、单位和倒数换算边界，避免将反向报价混为同一口径。', mode: 'orientation', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DEXSZUS', 'DEXUSAL'] },
  FXC: { title: 'FXC · 同日交叉汇率矩阵', focus: '以同日有效的美元基准实际观察推导交叉汇率；缺日期或单位不兼容时不插补。', mode: 'cross', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DEXSZUS', 'DEXUSAL', 'DEXSIUS', 'DEXKOUS'] },
  WCR: { title: 'WCR · 主要货币共同窗口', focus: '用可读主要货币的同一历史窗口比较路径和实际区间变化。', mode: 'history', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DEXUSAL'] },
  WVOL: { title: 'WVOL · 已实现日度范围', focus: '仅统计公开即期历史日度变化范围；它不是期权隐含波动率矩阵。', mode: 'range', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DEXUSAL'] },
  XCCY: { title: 'XCCY · 交叉货币基点差边界', focus: '公开 H.10 不包含可核验的 cross-currency basis；终端不将即期或利差代替 basis。', mode: 'basis', seriesIds: [] },
  GMM: { title: 'GMM · 外汇宏观环境', focus: '并列读取美元指数、联邦基金利率和 2/10 年美债公开观察，不形成因果归因或预测。', mode: 'macro', seriesIds: ['DTWEXBGS', 'DFF', 'DGS2', 'DGS10'] },
  FXSW: { title: 'FXSW · 策略输入审计', focus: '只显示可读的外汇与利率环境输入；不输出交易策略、仓位或收益承诺。', mode: 'watch', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DTWEXBGS', 'DFF', 'DGS2'] },
  XDSH: { title: 'XDSH · 观察屏覆盖', focus: '审计主要货币公开历史的最近可读性和更新时间，不伪造观察屏实时刷新。', mode: 'watch', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DEXSIUS', 'DEXKOUS'] },
  FXFC: { title: 'FXFC · 预测资料边界', focus: '展示可读历史与数据覆盖边界；终端不生成汇率预测、目标位或概率。', mode: 'forecast', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DTWEXBGS'] },
  WCRS: { title: 'WCRS · 可读货币区间排序', focus: '仅按同一公开窗口的实际百分比变化排序可读序列；不宣称全球全覆盖货币排名。', mode: 'ranking', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DEXSZUS', 'DEXUSAL', 'DEXSIUS', 'DEXKOUS'] },
  ECMI: { title: 'ECMI · 日度变化定位', focus: '定位公开序列的相邻实际观察变化，不将价格变化归因于具体新闻或宏观冲击。', mode: 'daily', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DTWEXBGS'] },
  MYQ: { title: 'MYQ · 账户自选资料边界', focus: '当前未增加账户自选表时保持真实空状态，不以示例观察组合替代用户清单。', mode: 'personal', seriesIds: [] },
  ALLQ: { title: 'ALLQ · 可读交叉报价矩阵', focus: '以同日实际 H.10 观察推导可读交叉汇率；不是全部可执行报价。', mode: 'cross', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DEXSZUS', 'DEXUSAL', 'DEXSIUS', 'DEXKOUS'] },
  FRD: { title: 'FRD · 远期输入覆盖', focus: '读取公开即期和利率环境输入状态；不以历史利率或示例参数制造远期曲线。', mode: 'forward', seriesIds: ['DEXJPUS', 'DFF', 'DGS2', 'DGS10'] },
  OVML: { title: 'OVML · 外汇期权资料边界', focus: '没有免费且可核验的完整 FX 期权链、波动率曲面和持仓资料时保持真实空状态。', mode: 'option', seriesIds: [] },
  BFIX: { title: 'BFIX · 官方 fixing 资料边界', focus: 'H.10 公开历史观察不等同于授权的 BFIX fixing；终端不以 H.10 值替代 fixing。', mode: 'fixing', seriesIds: [] },
  FXFA: { title: 'FXFA · 利差输入观察', focus: '并列公开外汇和利率环境输入，不将利差或历史变化表述为套利回报建议。', mode: 'carry', seriesIds: ['DEXJPUS', 'DEXUSEU', 'DFF', 'DGS2', 'DGS10'] },
  GP: { title: 'GP · 单序列公开路径', focus: '显示选定主货币的实际历史路径、最近观察和期间变化。', mode: 'single', seriesIds: ['DEXUSEU'] },
  FIRS: { title: 'FIRS · 官方资料更新状态', focus: '显示 H.10/FRED 实际读取的最新日期与可读性，不生成新闻替代内容。', mode: 'source', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DTWEXBGS'] },
  TOP_FX: { title: 'TOP FX · 新闻资料边界', focus: '没有授权结构化新闻流时保持公开数据边界，不以静态标题或外链替代终端研究。', mode: 'news', seriesIds: [] },
  STNI: { title: 'STNI · 资料传输状态', focus: '展示已读取公开序列与实际观察日期，不制造传输提醒或新闻事件。', mode: 'source', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DTWEXBGS'] },
  RES: { title: 'RES · 公开研究资料目录', focus: '目录化展示终端内可读的公开外汇参考资料与其限制。', mode: 'catalog', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DTWEXBGS', 'DFF', 'DGS10'] },
  BICO: { title: 'BICO · 外汇资料分类覆盖', focus: '区分主要货币、美元指数和利率环境资料，不冒充授权行业研究数据库。', mode: 'catalog', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS', 'DTWEXBGS', 'DTWEXAFEGS', 'DTWEXEMEGS'] },
  MARS_FX: { title: 'MARS FX · 可执行交易资料边界', focus: '无免费可执行报价、订单、交易权限或成交回报时保持真实空状态。', mode: 'execution', seriesIds: [] },
  FXCORR: { title: 'FXCORR · 公开历史相关资料', focus: '保留公开序列共同日期观察边界；不将有限历史相关性作为交易信号。', mode: 'history', seriesIds: ['DEXUSEU', 'DEXJPUS', 'DEXUSUK', 'DEXCAUS'] },
  FXIV: { title: 'FXIV · 隐含波动率资料边界', focus: '公开 H.10 即期历史不能替代隐含波动率；无授权波动率面时保持真实空状态。', mode: 'option', seriesIds: [] },
};

function cutoff(range: Range) { if (range === 'max') return null; const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() - (range === '1y' ? 1 : range === '3y' ? 3 : 5)); return date.toISOString().slice(0, 10); }
function normalize(value: number, orientation: Orientation) { if (orientation === 'foreign_per_usd') return value === 0 ? null : 1 / value; return orientation === 'usd_per_foreign' ? value : null; }

export const EVENT_SERIES_BY_CURRENCY: Record<string, string> = { USD: 'DEXUSEU', EUR: 'DEXUSEU', GBP: 'DEXUSUK', JPY: 'DEXJPUS', CHF: 'DEXSZUS', CAD: 'DEXCAUS', AUD: 'DEXUSAL' };
export function nearbyObservation(history: FxPoint[], decisionDate: string, direction: 'before' | 'after') { const points = direction === 'before' ? history.filter((point) => point.date <= decisionDate) : history.filter((point) => point.date >= decisionDate); return direction === 'before' ? points.at(-1) ?? null : points[0] ?? null; }
function eventDate(value: unknown) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
export function buildDecisionWindow(history: FxPoint[], decisionDate: string) { const before = nearbyObservation(history, decisionDate, 'before'); const after = nearbyObservation(history, decisionDate, 'after'); const start = new Date(`${decisionDate}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 5); const end = new Date(`${decisionDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 5); const window = history.filter((point) => point.date >= start.toISOString().slice(0, 10) && point.date <= end.toISOString().slice(0, 10)); const changePct = before && after && before.value !== 0 ? Number((((after.value / before.value) - 1) * 100).toFixed(4)) : null; return { before, after, window, changePct, normalizedWindow: before ? window.map((point) => ({ date: point.date, value: point.value, base100: Number(((point.value / before.value) * 100).toFixed(4)) })) : [] }; }
export function groupSameDayDecisions(events: Array<{ decisionDate: unknown; centralBankId: string; centralBankName: string; currency: string; decision: string; changeBps: number | null; voteSummary: string | null }>) { const groups = new Map<string, typeof events>(); events.forEach((event) => { const date = eventDate(event.decisionDate); const group = groups.get(date) ?? []; group.push(event); groups.set(date, group); }); return [...groups.entries()].filter(([, group]) => group.length >= 2).sort(([left], [right]) => right.localeCompare(left)).map(([date, group]) => ({ date, centralBanks: group.map((event) => event.centralBankId), count: group.length, events: group })); }
export const TIMELINE_CENTRAL_BANK_IDS = ['FED', 'ECB', 'BOE', 'BOJ', 'SNB', 'BOC', 'RBA', 'RBNZ'] as const;
export const TIMELINE_PAIR_BY_CURRENCY = { USD: 'USD', EUR: 'EURUSD', GBP: 'GBPUSD', JPY: 'USDJPY', CHF: 'USDCHF', CAD: 'USDCAD', AUD: 'AUDUSD', NZD: 'NZDUSD' } as const;
export const TIMELINE_PAIR_IDS = ['USD', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD'] as const;
export const TIMELINE_ACTIONS = ['raise', 'cut', 'hold'] as const;
export function filterSameDayTimelineEvents<T extends { centralBankId: string; currency: string; decision: string }>(events: T[], centralBankIds: readonly string[], pairIds: readonly string[], actions: readonly string[] = []) { return events.filter((event) => (centralBankIds.length === 0 || centralBankIds.includes(event.centralBankId)) && (pairIds.length === 0 || pairIds.includes(TIMELINE_PAIR_BY_CURRENCY[event.currency as keyof typeof TIMELINE_PAIR_BY_CURRENCY] ?? '')) && (actions.length === 0 || actions.includes(event.decision))); }

export function deriveForexCrosses(readings: Reading[]) {
  const values = new Map(readings.filter((reading) => reading.status === 'available').map((reading) => [reading.currency, new Map((reading.history.length ? reading.history : reading.value != null && reading.observationDate ? [{ date: reading.observationDate, value: reading.value }] : []).flatMap((point) => { const normalized = normalize(point.value, reading.orientation); return normalized == null ? [] : [[point.date, normalized] as const]; }))]));
  return [['EUR', 'JPY'], ['GBP', 'JPY'], ['EUR', 'GBP'], ['AUD', 'CAD'], ['USD', 'JPY'], ['USD', 'CAD']].flatMap(([base, quote]) => {
    const baseHistory = base === 'USD' ? null : values.get(base); const quoteHistory = quote === 'USD' ? null : values.get(quote);
    const dates = base === 'USD' ? [...(quoteHistory?.keys() ?? [])] : quote === 'USD' ? [...(baseHistory?.keys() ?? [])] : [...(baseHistory?.keys() ?? [])].filter((date) => quoteHistory?.has(date));
    const observationDate = dates.sort().at(-1); const usdBase = base === 'USD' ? 1 : observationDate ? baseHistory?.get(observationDate) : null; const usdQuote = quote === 'USD' ? 1 : observationDate ? quoteHistory?.get(observationDate) : null;
    return observationDate && usdBase && usdQuote ? [{ pair: `${base}/${quote}`, value: Number((usdBase / usdQuote).toFixed(6)), base, quote, observationDate }] : [];
  });
}

export const forexResearchRouter = router({
  getPublicReferenceRates: publicProcedure.input(z.object({ refresh: z.boolean().default(false) }).default({ refresh: false })).query(async ({ input }) => {
    const result = await fetchPublicFxReferences(input.refresh);
    const asOf = result.readings.flatMap((reading) => reading.observationDate ? [reading.observationDate] : []).sort().at(-1) ?? null;
    return { ...result, asOf, source: 'Frankfurter · 公开中央银行日频参考汇率', storage: result.persistence.storage, persistedObservationCount: result.persistence.inserted + result.persistence.duplicate, refreshIntervalSeconds: Math.floor(PUBLIC_FX_CACHE_MS / 1000), boundary: '仅返回已发布的真实日频参考；成功观测写入不可变历史账本并按功能合同去重，服务重启后仍可读取。API 失败时仅回退到已保存历史并明确标注，不生成模拟值，不代表逐秒或可执行报价。' };
  }),
  getCentralBankArchive: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(24) }).default({ limit: 24 })).query(({ input }) => listForexCentralBankArchive(input.limit)),
  getSameDayDecisionTimeline: publicProcedure.input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), centralBankIds: z.array(z.enum(TIMELINE_CENTRAL_BANK_IDS)).max(TIMELINE_CENTRAL_BANK_IDS.length).default([]), pairIds: z.array(z.enum(TIMELINE_PAIR_IDS)).max(TIMELINE_PAIR_IDS.length).default([]), actions: z.array(z.enum(TIMELINE_ACTIONS)).max(TIMELINE_ACTIONS.length).default([]) }).default({ centralBankIds: [], pairIds: [], actions: [] })).query(async ({ input }) => {
    const allEvents = await listForexCentralBankArchive(50); const filteredEvents = filterSameDayTimelineEvents(allEvents, input.centralBankIds, input.pairIds, input.actions); const groups = groupSameDayDecisions(filteredEvents); const selectedDate = input.date && groups.some((group) => group.date === input.date) ? input.date : groups[0]?.date ?? null; const selected = groups.find((group) => group.date === selectedDate) ?? null;
    const availableFilters = { centralBanks: [...new Map(allEvents.map((event) => [event.centralBankId, { id: event.centralBankId, label: event.centralBankName }])).values()], pairs: [...new Set(allEvents.map((event) => TIMELINE_PAIR_BY_CURRENCY[event.currency as keyof typeof TIMELINE_PAIR_BY_CURRENCY]))], actions: TIMELINE_ACTIONS };
    return { groups: groups.map((group) => ({ date: group.date, count: group.count, centralBanks: group.centralBanks })), selectedDate, events: selected?.events ?? [], filters: { centralBankIds: input.centralBankIds, pairIds: input.pairIds, actions: input.actions }, availableFilters, boundary: '同日时间轴只并列实际归档的官方决议日期和公告字段；央行、关联货币对与政策行动条件先筛选事件，筛选后同一日期少于两家机构时保持真实空状态，不以非同日或未归档事件补足。它不归因、比较政策效果或形成交易建议。' };
  }),
  listSameDayTimelinePresets: protectedProcedure.query(({ ctx }) => listForexSameDayTimelinePresets(ctx.user.id)),
  saveSameDayTimelinePreset: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(80), centralBankIds: z.array(z.enum(TIMELINE_CENTRAL_BANK_IDS)).max(TIMELINE_CENTRAL_BANK_IDS.length), pairIds: z.array(z.enum(TIMELINE_PAIR_IDS)).max(TIMELINE_PAIR_IDS.length), actions: z.array(z.enum(TIMELINE_ACTIONS)).max(TIMELINE_ACTIONS.length) })).mutation(({ ctx, input }) => saveForexSameDayTimelinePreset(ctx.user.id, input)),
  deleteSameDayTimelinePreset: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteForexSameDayTimelinePreset(ctx.user.id, input.id)),
  getDataHealth: publicProcedure.query(async ({ ctx }) => {
    const checkedAt = new Date(); const readings = await Promise.all(FX_SERIES.map((definition) => fetchSeries(definition.id)));
    const rules = ctx.user ? await listForexFreshnessAlertRules(ctx.user.id) : [];
    const ruleBySeries = new Map(rules.map((rule) => [rule.seriesId, rule]));
    const sources = readings.map((reading) => { const cachedAt = cached.get(reading.id)?.at ?? checkedAt.getTime(); const observedDelayHours = reading.observationDate ? Math.max(0, Math.floor((checkedAt.getTime() - Date.parse(`${reading.observationDate}T00:00:00.000Z`)) / 3_600_000)) : null; const state = reading.status !== 'available' ? 'unavailable' : observedDelayHours != null && observedDelayHours > 72 ? 'lagged' : 'current'; const rule = ruleBySeries.get(reading.id); const accountAlert = rule && rule.isActive && (reading.status !== 'available' || observedDelayHours == null || observedDelayHours > rule.thresholdHours); return { id: reading.id, label: reading.label, unit: reading.unit, source: 'FRED / 美联储 H.10', observationDate: reading.observationDate, sourceCheckedAt: new Date(cachedAt).toISOString(), cacheAgeSeconds: Math.max(0, Math.floor((checkedAt.getTime() - cachedAt) / 1000)), observedDelayHours, historyPoints: reading.history.length, state, accountRule: rule ? { thresholdHours: rule.thresholdHours, isActive: rule.isActive, exceeded: Boolean(accountAlert) } : null, limitation: reading.limitation }; });
    return { checkedAt: checkedAt.toISOString(), sources, boundary: '延迟按读取时点与最近实际公开观察日 00:00 UTC 的差值计算，不是实时行情延迟、来源 SLA 或可执行报价时效。非交易日和上游发布节奏会自然反映为延迟。账户阈值仅在登录账户本次读取时用于终端内视觉提示。' };
  }),
  getDecisionFxRetrospective: publicProcedure.input(z.object({ eventId: z.number().int().positive() })).query(async ({ input }) => {
    const events = await listForexCentralBankArchive(50); const event = events.find((candidate) => candidate.id === input.eventId); if (!event) throw new Error('FOREX_DECISION_EVENT_NOT_FOUND');
    const seriesId = EVENT_SERIES_BY_CURRENCY[event.currency] ?? null; if (!seriesId) return { event, reading: null, before: null, after: null, window: [], changePct: null, boundary: '该官方决议尚无对应的免费可核验 FRED 汇率观察序列；终端保持真实空状态。' };
    const reading = await fetchSeries(seriesId); if (reading.status !== 'available') return { event, reading: { id: reading.id, label: reading.label, unit: reading.unit, orientation: reading.orientation, status: reading.status }, before: null, after: null, window: [], changePct: null, boundary: reading.limitation };
    const { before, after, window, changePct } = buildDecisionWindow(reading.history, eventDate(event.decisionDate));
    return { event, reading: { id: reading.id, label: reading.label, unit: reading.unit, orientation: reading.orientation, status: reading.status }, before, after, window, changePct, boundary: '事件窗口只并列展示 FRED/H.10 的最近前后实际公开观察；它不识别或推断汇率变动由该决议造成，亦不提供预测或交易建议。' };
  }),
  getCurrencyDecisionComparison: publicProcedure.input(z.object({ currency: z.enum(['AUD', 'NZD']) })).query(async ({ input }) => {
    const events = (await listForexCentralBankArchive(50)).filter((event) => event.currency === input.currency).sort((a, b) => eventDate(b.decisionDate).localeCompare(eventDate(a.decisionDate)));
    const seriesId = EVENT_SERIES_BY_CURRENCY[input.currency] ?? null;
    const base = { currency: input.currency, events, seriesId, boundary: '同币种对照只展示同一币种的实际官方决议及对应 FRED/H.10 事件窗口；它不推断汇率变动由决议造成，也不提供预测或交易建议。' };
    if (!seriesId) return { ...base, reading: null, rows: [], boundary: '当前免费 FRED/H.10 覆盖中没有可核验的新西兰元日度序列；终端保留实际 RBNZ 决议，但不以第三方报价、插补路径或替代序列制作事件窗口。' };
    const reading = await fetchSeries(seriesId); if (reading.status !== 'available') return { ...base, reading: { id: reading.id, label: reading.label, unit: reading.unit, status: reading.status }, rows: [], boundary: reading.limitation };
    const rows = events.map((event) => { const decisionDate = eventDate(event.decisionDate); const period = buildDecisionWindow(reading.history, decisionDate); const rate = Array.isArray(event.policyRates) ? event.policyRates[0] : null; return { eventId: event.id, decisionDate, centralBankId: event.centralBankId, centralBankName: event.centralBankName, decision: event.decision, changeBps: event.changeBps, voteSummary: event.voteSummary, policyRatePct: rate?.ratePct ?? null, before: period.before, after: period.after, changePct: period.changePct, normalizedWindow: period.normalizedWindow, relativeWindow: period.normalizedWindow.map((point) => ({ ...point, dayOffset: Math.round((Date.parse(`${point.date}T00:00:00Z`) - Date.parse(`${decisionDate}T00:00:00Z`)) / 86_400_000) })) }; });
    return { ...base, reading: { id: reading.id, label: reading.label, unit: reading.unit, status: reading.status }, rows };
  }),
  listFreshnessAlertRules: protectedProcedure.query(({ ctx }) => listForexFreshnessAlertRules(ctx.user.id)),
  saveFreshnessAlertRule: protectedProcedure.input(z.object({ seriesId: z.enum(FX_FRESHNESS_SERIES_IDS), thresholdHours: z.number().int().min(1).max(24 * 30), isActive: z.boolean() })).mutation(({ ctx, input }) => saveForexFreshnessAlertRule(ctx.user.id, input)),
  deleteFreshnessAlertRule: protectedProcedure.input(z.object({ seriesId: z.enum(FX_FRESHNESS_SERIES_IDS) })).mutation(({ ctx, input }) => deleteForexFreshnessAlertRule(ctx.user.id, input.seriesId)),
  getModuleStudy: publicProcedure.input(z.object({ moduleId: z.enum(MODULES), range: z.enum(['1y', '3y', '5y', 'max']).default('3y') })).query(async ({ input }) => {
    const config = FOREX_MODULE_CONFIG[input.moduleId]; const readings = await Promise.all(config.seriesIds.map(fetchSeries)); const start = cutoff(input.range);
    const prepared = readings.map((reading) => ({ ...reading, history: start ? reading.history.filter((point) => point.date >= start) : reading.history }));
    const allDates = [...new Set(prepared.flatMap((reading) => reading.history.map((point) => point.date)))].sort(); const timeline = allDates.map((date) => { const row: Record<string, string | number | null> = { date }; for (const reading of prepared) { const point = reading.history.find((candidate) => candidate.date === date); row[`value_${reading.id}`] = point?.value ?? null; const first = reading.history[0]?.value; row[`base100_${reading.id}`] = point && first ? Number(((point.value / first) * 100).toFixed(4)) : null; } return row; });
    const asOf = prepared.filter((reading) => reading.observationDate).map((reading) => reading.observationDate!).sort().at(-1) ?? null;
    return { moduleId: input.moduleId, title: config.title, focus: config.focus, mode: config.mode, range: input.range, readings: prepared.map((reading) => ({ ...reading, historyPoints: reading.history.length, historyStart: reading.history[0]?.date ?? null, windowChangePct: reading.history.length > 1 && reading.history[0].value !== 0 ? Number((((reading.history.at(-1)!.value / reading.history[0].value) - 1) * 100).toFixed(4)) : null })), timeline, crosses: deriveForexCrosses(prepared), asOf, sourceBoundary: '来源：FRED 转载美国联邦储备委员会 H.10 公开历史观察。公开日度资料有发布时间与单位边界；所有展示均在终端内完成，不提供可执行外汇报价、订单簿、交易权限、官方 fixing 或预测。' };
  }),
});

import type { FreeSeriesResult, FreeObservation } from './freeMarketData';

const SERIES = {
  unemployment: { dataset: 'une_rt_m', filters: { freq: 'M', geo: 'EA21', s_adj: 'SA', age: 'TOTAL', sex: 'T', unit: 'PC_ACT' }, symbol: 'EA21:UNEMP_SA' },
  hicp: { dataset: 'prc_hicp_minr', filters: { freq: 'M', geo: 'EA21', coicop18: 'TOTAL', unit: 'RCH_A' }, symbol: 'EA21:HICP_YOY' },
  gdp: { dataset: 'namq_10_gdp', filters: { freq: 'Q', geo: 'EA21', s_adj: 'SCA', na_item: 'B1GQ', unit: 'CLV_PCH_PRE' }, symbol: 'EA21:GDP_QOQ_SCA' },
} as const;

export function parseEurostatStatistic(payload: unknown, filters: Record<string, string>, limit: number): FreeObservation[] {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_JSON_STAT');
  const data = payload as { id?: unknown; size?: unknown; value?: Record<string, unknown>; dimension?: Record<string, {category?: {index?: Record<string, number>}}> };
  if (!Array.isArray(data.id) || !Array.isArray(data.size) || data.id.length !== data.size.length || !data.value) throw new Error('INVALID_JSON_STAT');
  const ids = data.id.map(String);
  const sizes = data.size.map(Number);
  const timeIndex = ids.indexOf('time');
  if (sizes.some(size => size === 0)) return [];
  if (timeIndex < 0 || sizes.some((size, index) => !Number.isInteger(size) || size < 1 || (index !== timeIndex && size !== 1))) throw new Error('AMBIGUOUS_STATISTIC_DIMENSIONS');
  // A successful HTTP response for a different geography/unit is not usable.
  for (const [dimension, expected] of Object.entries(filters)) {
    const categories = data.dimension?.[dimension]?.category?.index;
    if (!ids.includes(dimension) || !categories || Object.keys(categories).length !== 1 || categories[expected] !== 0) throw new Error('STATISTIC_DIMENSION_MISMATCH');
  }
  const times = data.dimension?.time?.category?.index;
  if (!times) throw new Error('MISSING_STATISTIC_PERIODS');
  const unique = new Map<string, number>();
  for (const [date, position] of Object.entries(times)) {
    const value = data.value[String(position)];
    if (/^\d{4}-(?:(?:0[1-9]|1[0-2])|Q[1-4])$/.test(date) && Number.isInteger(position) && position >= 0 && position < sizes[timeIndex] && typeof value === 'number' && Number.isFinite(value)) unique.set(date, value);
  }
  return [...unique].sort(([a],[b]) => a.localeCompare(b)).slice(-Math.max(1, Math.min(limit, 1000))).map(([date,value]) => ({date,value}));
}

export async function fetchEuroAreaStatistic(kind: keyof typeof SERIES, limit = 240): Promise<FreeSeriesResult> {
  const config = SERIES[kind];
  const sourceUrl = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${config.dataset}?${new URLSearchParams({lang:'en', ...config.filters})}`;
  const base = { symbol: config.symbol, source: 'Eurostat Dissemination API' as const, sourceUrl, realtime: false as const, retrievedAt: new Date().toISOString() };
  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(20000), headers: {accept:'application/json'} });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const history = parseEurostatStatistic(await response.json(), config.filters, limit);
    return {...base, available: history.length > 0, observedAt: history.at(-1)?.date ?? null, history, delayStatus: history.length ? 'latest_public_release' : 'unavailable', limitation: history.length ? `EA21 (2026 composition) ${config.filters.freq === 'Q' ? 'quarterly' : 'monthly'} published statistics; subject to revisions; not realtime.` : 'No observations returned for the exact requested region and measure.'};
  } catch (error) {
    return {...base, available:false, observedAt:null, history:[], delayStatus:'unavailable', limitation:error instanceof Error ? error.message : 'EUROSTAT_UNAVAILABLE'};
  }
}

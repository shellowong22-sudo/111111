import { fetchEiaWeeklyPetroleumHistory, parseEiaWeeklyPetroleumWorkbook } from '../eiaWeeklyPetroleum';
import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { pushNotificationToUser } from '../uploadAndSse';
import { CommodityWatchSnapshot, createCommodityWatchlistGroup, deleteCommodityWatchlist, deleteCommodityWatchlistGroup, listCommodityWatchlistAlerts, listCommodityWatchlistGroups, listCommodityWatchlists, processCommodityWatchlistAlerts, saveCommodityWatchlist } from '../commodityResearchDb';

export const COMMODITY_SERIES = [
  { id: 'DCOILWTICO', label: 'WTI 原油', category: '能源', unit: '美元/桶', frequency: '日频', source: 'FRED' },
  { id: 'DCOILBRENTEU', label: 'Brent 原油', category: '能源', unit: '美元/桶', frequency: '日频', source: 'FRED' },
  { id: 'DHHNGSP', label: 'Henry Hub 天然气', category: '天然气', unit: '美元/百万英热单位', frequency: '日频', source: 'FRED' },
  { id: 'PALLFNFINDEXQ', label: '全球商品价格指数', category: '综合', unit: '指数', frequency: '季频', source: 'FRED' },
  { id: 'WCESTUS1', label: '美国商业原油库存（不含 SPR）', category: '能源运行', unit: '千桶', frequency: '周频', source: 'EIA' },
  { id: 'WPULEUS3', label: '美国炼厂可操作产能利用率', category: '能源运行', unit: '百分比', frequency: '周频', source: 'EIA' },
] as const;
export type CommoditySeriesId = typeof COMMODITY_SERIES[number]['id'];
const REGIONAL_CRUDE_SERIES = [
  { id: 'WCESTP11', label: 'PADD 1 东海岸', category: '地区库存', unit: '千桶', frequency: '周频', source: 'EIA' as const },
  { id: 'WCESTP21', label: 'PADD 2 中西部', category: '地区库存', unit: '千桶', frequency: '周频', source: 'EIA' as const },
  { id: 'WCESTP31', label: 'PADD 3 墨西哥湾沿岸', category: '地区库存', unit: '千桶', frequency: '周频', source: 'EIA' as const },
  { id: 'WCESTP41', label: 'PADD 4 落基山', category: '地区库存', unit: '千桶', frequency: '周频', source: 'EIA' as const },
  { id: 'WCESTP51', label: 'PADD 5 西海岸', category: '地区库存', unit: '千桶', frequency: '周频', source: 'EIA' as const },
] as const;
type CommodityDefinition = { id: string; label: string; category: string; unit: string; frequency: string; source: 'FRED' | 'EIA' };
type CommodityObservation = { date: string; value: number };
type CommodityResult = CommodityDefinition & { status: 'available' | 'unavailable'; latest: number | null; observationDate: string | null; change: number | null; history: CommodityObservation[] };
let overviewCache: { at: number; value: Awaited<ReturnType<typeof getCommodityOverview>> } | null = null;
let pendingOverview: Promise<Awaited<ReturnType<typeof getCommodityOverview>>> | null = null;
const seriesCache = new Map<string, { at: number; value: CommodityResult }>();
const pendingSeries = new Map<string, Promise<CommodityResult>>();

export function parseCommodityFredCsv(csv: string) {
  return csv.split(/\r?\n/).slice(1).flatMap((line) => { const [date, raw] = line.split(','); const value = Number(raw); return date && raw && raw !== '.' && Number.isFinite(value) ? [{ date: date.trim(), value }] : []; }) as CommodityObservation[];
}

export function parseEiaHistoricalWorkbook(buffer: ArrayBuffer) {
  return parseEiaWeeklyPetroleumWorkbook(buffer);
}

async function fetchCommoditySeries(definition: CommodityDefinition): Promise<CommodityResult> {
  const cached = seriesCache.get(definition.id); if (cached && Date.now() - cached.at < 30_000) return cached.value;
  const inFlight = pendingSeries.get(definition.id); if (inFlight) return inFlight;
  const request = (async (): Promise<CommodityResult> => {
    try {
      const history = definition.source === 'EIA'
        ? await fetchEiaWeeklyPetroleumHistory(definition.id as 'WCESTUS1' | 'WPULEUS3')
        : await (async () => {
          const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}`, { signal: AbortSignal.timeout(10_000) });
          if (!response.ok) throw new Error(`${definition.source}_${response.status}`);
          return parseCommodityFredCsv(await response.text());
        })();
      const latest = history.at(-1) ?? null; const previous = history.at(-2) ?? null;
      return { ...definition, status: latest ? 'available' : 'unavailable', latest: latest?.value ?? null, observationDate: latest?.date ?? null, change: latest && previous ? Number((latest.value - previous.value).toFixed(4)) : null, history };
    } catch {
      return { ...definition, status: 'unavailable', latest: null, observationDate: null, change: null, history: [] };
    }
  })();
  pendingSeries.set(definition.id, request);
  try { const value = await request; seriesCache.set(definition.id, { at: Date.now(), value }); return value; } finally { pendingSeries.delete(definition.id); }
}

async function getCommodityOverview() {
  const started = Date.now(); const series = await Promise.all(COMMODITY_SERIES.map(fetchCommoditySeries));
  return { asOf: new Date().toISOString(), latencyMs: Date.now() - started, series: series.map(({ history, ...row }) => ({ ...row, historyPoints: history.length, historyStart: history[0]?.date ?? null })), sourceStatus: series.every((row) => row.status === 'available') ? 'available' as const : series.some((row) => row.status === 'available') ? 'partial' as const : 'unavailable' as const, sourceBoundary: '终端内仅展示本次实际读取的 FRED 与 EIA 公开历史观察；不是交易所官方实时行情、可执行报价、完整合约期限曲线、订单簿、持仓或投资建议。' };
}

async function cachedCommodityOverview() { const now = Date.now(); if (overviewCache && now - overviewCache.at < 30_000) return overviewCache.value; if (pendingOverview) return pendingOverview; pendingOverview = getCommodityOverview().then((value) => { overviewCache = { at: Date.now(), value }; return value; }).finally(() => { pendingOverview = null; }); return pendingOverview; }
function rangeStart(range: '1y' | '3y' | '5y' | 'max') { if (range === 'max') return null; const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() - Number(range.slice(0, -1))); return date.toISOString().slice(0, 10); }

function priorWeeklyDate(date: string) { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() - 364); return value.toISOString().slice(0, 10); }
function previousWeeklyDate(date: string) { const value = new Date(`${date}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() - 7); return value.toISOString().slice(0, 10); }

function fourWeekAverageAt(history: CommodityObservation[], endIndex: number) {
  const trailing = history.slice(endIndex - 3, endIndex + 1);
  if (trailing.length !== 4 || trailing.some((point, index) => index > 0 && previousWeeklyDate(point.date) !== trailing[index - 1]?.date)) return null;
  return Number((trailing.reduce((sum, point) => sum + point.value, 0) / 4).toFixed(3));
}

function fourWeekAverageYoYHistory(history: CommodityObservation[]) {
  const indexByDate = new Map(history.map((point, index) => [point.date, index]));
  return history.map((point, index) => {
    const currentAverage = fourWeekAverageAt(history, index);
    const priorYearDate = priorWeeklyDate(point.date);
    const priorYearIndex = indexByDate.get(priorYearDate) ?? -1;
    const priorYearAverage = priorYearIndex >= 0 ? fourWeekAverageAt(history, priorYearIndex) : null;
    const absolute = currentAverage != null && priorYearAverage != null ? Number((currentAverage - priorYearAverage).toFixed(3)) : null;
    const percent = absolute != null && priorYearAverage !== null && priorYearAverage !== 0 ? Number(((absolute / Math.abs(priorYearAverage)) * 100).toFixed(3)) : null;
    return { date: point.date, currentAverage, priorYearDate: priorYearAverage != null ? priorYearDate : null, priorYearAverage, absolute, percent };
  });
}

export function enrichRegionalInventoryRows<T extends { status: 'available' | 'unavailable'; latest: number | null; observationDate: string | null; history: CommodityObservation[] }>(rows: T[]) {
  const comparable = rows.filter((row) => row.status === 'available' && row.latest != null && row.observationDate != null);
  const sharedDate = comparable.length === rows.length && new Set(comparable.map((row) => row.observationDate)).size === 1 ? comparable[0]?.observationDate ?? null : null;
  const nationalTotal = sharedDate ? Number(comparable.reduce((sum, row) => sum + Number(row.latest), 0).toFixed(3)) : null;
  return rows.map((row) => {
    const currentEndIndex = row.history.length - 1;
    const fourWeekAverage = fourWeekAverageAt(row.history, currentEndIndex);
    const priorYearDate = row.observationDate ? priorWeeklyDate(row.observationDate) : null;
    const priorYearEndIndex = priorYearDate ? row.history.findIndex((point) => point.date === priorYearDate) : -1;
    const priorYearFourWeekAverage = priorYearEndIndex >= 0 ? fourWeekAverageAt(row.history, priorYearEndIndex) : null;
    const fourWeekAverageYoYAbsolute = fourWeekAverage != null && priorYearFourWeekAverage != null ? Number((fourWeekAverage - priorYearFourWeekAverage).toFixed(3)) : null;
    const fourWeekAverageYoY = fourWeekAverageYoYAbsolute != null && priorYearFourWeekAverage !== null && priorYearFourWeekAverage !== 0 ? Number(((fourWeekAverageYoYAbsolute / Math.abs(priorYearFourWeekAverage)) * 100).toFixed(3)) : null;
    const isComparable = nationalTotal != null && row.observationDate === sharedDate;
    return { ...row, fourWeekAverage, fourWeekEndDate: fourWeekAverage != null ? row.history.at(currentEndIndex)?.date ?? null : null, priorYearDate: priorYearFourWeekAverage != null ? priorYearDate : null, priorYearFourWeekAverage, fourWeekAverageYoYAbsolute, fourWeekAverageYoY, fourWeekAverageYoYHistory: fourWeekAverageYoYHistory(row.history), nationalTotal: isComparable ? nationalTotal : null, nationalSharePercent: isComparable ? Number(((Number(row.latest) / nationalTotal) * 100).toFixed(3)) : null };
  });
}

export async function getCommodityWatchSnapshot(): Promise<CommodityWatchSnapshot[]> {
  const rows = await Promise.all(COMMODITY_SERIES.map(fetchCommoditySeries));
  return rows.map((row) => ({ id: row.id, label: row.label, status: row.status, observationDate: row.observationDate, latest: row.latest }));
}

const seriesIdSchema = z.enum(['DCOILWTICO', 'DCOILBRENTEU', 'DHHNGSP', 'PALLFNFINDEXQ', 'WCESTUS1', 'WPULEUS3']);
const tagSchema = z.string().trim().min(1).max(24).regex(/^[\p{L}\p{N}\s_-]+$/u, '标签仅支持文字、数字、空格、下划线和短横线');
const watchlistInputSchema = z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(64), groupId: z.number().int().positive().nullable().default(null), tags: z.array(tagSchema).max(6).default([]).transform((value) => [...new Set(value)]), seriesIds: z.array(seriesIdSchema).min(1).max(6).transform((value) => [...new Set(value)]), alertThresholdPercent: z.number().min(0).max(100).default(0), isActive: z.boolean().default(true) });
const watchlistGroupInputSchema = z.object({ name: z.string().trim().min(1).max(64), color: z.enum(['amber', 'cyan', 'emerald', 'indigo', 'violet']).default('amber') });

export const commodityResearchRouter = router({
  getOverview: publicProcedure.query(cachedCommodityOverview),
  getSeries: publicProcedure.input(z.object({ id: seriesIdSchema, range: z.enum(['1y', '3y', '5y', 'max']).default('3y') })).query(async ({ input }) => {
    const definition = COMMODITY_SERIES.find((row) => row.id === input.id); if (!definition) return { status: 'unavailable' as const, series: null, sourceBoundary: '未识别的公开商品序列；终端不以替代品种或样例历史填充。' };
    const result = await fetchCommoditySeries(definition); const start = rangeStart(input.range); const history = start ? result.history.filter((row) => row.date >= start) : result.history;
    if (!history.length) return { status: 'unavailable' as const, series: { ...definition, history: [], latest: null, observationDate: null, change: null }, sourceBoundary: `当前无法在所选窗口读取 ${definition.source} 公开商品历史；终端不使用缓存样本、合成价格或外部页面替代。` };
    const latest = history.at(-1) ?? null; const previous = history.at(-2) ?? null; return { status: 'available' as const, series: { ...definition, history, latest: latest?.value ?? null, observationDate: latest?.date ?? null, change: latest && previous ? Number((latest.value - previous.value).toFixed(4)) : null }, sourceBoundary: `仅展示实际读取的 ${definition.source} 公开历史观察；非交易所官方实时行情、可执行报价、完整期限曲线或投资建议。` };
  }),
  getEnergyOperations: publicProcedure.input(z.object({ range: z.enum(['1y', '3y', '5y', 'max']).default('3y') }).default({ range: '3y' })).query(async ({ input }) => {
    const start = rangeStart(input.range); const series = await Promise.all(COMMODITY_SERIES.filter((row) => row.source === 'EIA').map(fetchCommoditySeries));
    return { asOf: new Date().toISOString(), series: series.map((row) => ({ ...row, history: start ? row.history.filter((point) => point.date >= start) : row.history })), sourceBoundary: 'EIA 周度公开文件中的美国商业原油库存（不含 SPR）与炼厂可操作产能利用率。观测按各自实际发布周显示，不表示实时库存、原油供需预测或交易信号。' };
  }),
  getRegionalInventory: publicProcedure.input(z.object({ range: z.enum(['1y', '3y', '5y', 'max']).default('3y') }).default({ range: '3y' })).query(async ({ input }) => {
    const start = rangeStart(input.range);
    const percentage = (current: number | null, prior: number | null) => current != null && prior != null && prior !== 0 ? Number((((current - prior) / Math.abs(prior)) * 100).toFixed(3)) : null;
    const regions = await Promise.all(REGIONAL_CRUDE_SERIES.map(async (definition) => {
      const result = await fetchCommoditySeries(definition);
      const current = result.history.at(-1) ?? null;
      const previousWeek = result.history.at(-2) ?? null;
      const previousYearDate = current ? priorWeeklyDate(current.date) : null;
      const previousYear = previousYearDate ? result.history.find((point) => point.date === previousYearDate) ?? null : null;
      return { ...definition, status: result.status, observationDate: current?.date ?? null, latest: current?.value ?? null, weekOverWeek: current && previousWeek ? { previousDate: previousWeek.date, absolute: Number((current.value - previousWeek.value).toFixed(3)), percent: percentage(current.value, previousWeek.value) } : null, yearOverYear: current && previousYear ? { previousDate: previousYear.date, absolute: Number((current.value - previousYear.value).toFixed(3)), percent: percentage(current.value, previousYear.value) } : null, history: start ? result.history.filter((point) => point.date >= start) : result.history };
    }));
    const enriched = enrichRegionalInventoryRows(regions);
    return { asOf: new Date().toISOString(), regions: enriched.map((row) => ({ ...row, history: start ? row.history.filter((point) => point.date >= start) : row.history, fourWeekAverageYoYHistory: start ? row.fourWeekAverageYoYHistory.filter((point) => point.date >= start) : row.fourWeekAverageYoYHistory })), sourceBoundary: '仅展示 EIA 周度石油状态报告表 4 对应的 PADD 地区实际商业原油库存历史。环比以相邻实际周度观察计算，同比以相隔 52 周且同一周度日期的实际观察计算；四周均值及其同比历史轨迹仅基于同一地区各自连续四个实际周度观察，历史不足四期或无法匹配 52 周前同日观察时保持空状态；全国占比仅在五区最近观察日期完全一致时计算；不代表地区实时库存、可执行报价、运输能力或供需预测。' };
  }),
  listWatchlists: protectedProcedure.query(({ ctx }) => listCommodityWatchlists(ctx.user.id)),
  saveWatchlist: protectedProcedure.input(watchlistInputSchema).mutation(({ ctx, input }) => saveCommodityWatchlist(ctx.user.id, input)),
  deleteWatchlist: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteCommodityWatchlist(ctx.user.id, input.id)),
  listWatchlistGroups: protectedProcedure.query(({ ctx }) => listCommodityWatchlistGroups(ctx.user.id)),
  createWatchlistGroup: protectedProcedure.input(watchlistGroupInputSchema).mutation(({ ctx, input }) => createCommodityWatchlistGroup(ctx.user.id, input)),
  deleteWatchlistGroup: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteCommodityWatchlistGroup(ctx.user.id, input.id)),
  listWatchlistAlerts: protectedProcedure.query(({ ctx }) => listCommodityWatchlistAlerts(ctx.user.id)),
  refreshWatchlistAlerts: protectedProcedure.mutation(async ({ ctx }) => {
    const snapshot = await getCommodityWatchSnapshot(); const emitted = await processCommodityWatchlistAlerts(snapshot, ctx.user.id); for (const notification of emitted) pushNotificationToUser(notification.userId, notification); return { checkedAt: new Date().toISOString(), snapshot, emitted };
  }),
});

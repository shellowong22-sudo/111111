import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { deleteDerivativesOasVixDatePreset, listDerivativesOasVixDatePresets, saveDerivativesOasVixDatePreset } from '../derivativesOasVixPresetDb';
import { fetchFinceptCftcDisaggregated } from '../finceptCftcAdapter';

export const DERIVATIVE_MODULE_IDS = ['ov', 'oils', 'fom', 'wbf-ai', 'credit-monitor', 'cdsw', 'vca', 'mars', 'ovcv', 'dlib', 'moso', 'ovml'] as const;
type DerivativeModuleId = (typeof DERIVATIVE_MODULE_IDS)[number];

type FredPoint = { date: string; value: number };
type FredSeries = { id: string; label: string; unit: string; source: string };
const COT_CATEGORIES = ['资产管理人', '杠杆基金', '管理资金', '掉期交易商'] as const;
const oasVixPresetInput = z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(80), rangeAStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), rangeAEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), rangeBStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), rangeBEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine((input) => input.rangeAStart <= input.rangeAEnd && input.rangeBStart <= input.rangeBEnd, { message: '区间起点不能晚于终点' });

const FRED_SERIES: Record<string, FredSeries> = {
  VIXCLS: { id: 'VIXCLS', label: 'CBOE VIX', unit: '指数', source: 'FRED / CBOE' },
  VXVCLS: { id: 'VXVCLS', label: 'CBOE 3个月波动指数', unit: '指数', source: 'FRED / CBOE' },
  SP500: { id: 'SP500', label: '标普500', unit: '指数点', source: 'FRED' },
  DCOILWTICO: { id: 'DCOILWTICO', label: 'WTI现货', unit: '美元/桶', source: 'FRED / EIA' },
  DGS2: { id: 'DGS2', label: '美国2年期国债收益率', unit: '%', source: 'FRED / Treasury' },
  DGS10: { id: 'DGS10', label: '美国10年期国债收益率', unit: '%', source: 'FRED / Treasury' },
  T10Y2Y: { id: 'T10Y2Y', label: '10年-2年期限利差', unit: '百分点', source: 'FRED / Treasury' },
  BAMLH0A0HYM2: { id: 'BAMLH0A0HYM2', label: 'ICE BofA美国高收益OAS', unit: '%', source: 'FRED / ICE Data Indices' },
  DEXUSEU: { id: 'DEXUSEU', label: '美元/欧元', unit: '美元每欧元', source: 'FRED / Federal Reserve H.10' },
  DEXUSAL: { id: 'DEXUSAL', label: '美元/澳元', unit: '美元每澳元', source: 'FRED / Federal Reserve H.10' },
};

const MODULE_DEFINITIONS: Record<DerivativeModuleId, { title: string; focus: string; series: string[]; boundary: string; cftc?: 'financial' | 'energy' }> = {
  ov: { title: '期权预期波动期限环境', focus: '比较一月与三个月公开波动指数的实际观察路径。', series: ['VIXCLS', 'VXVCLS'], boundary: '公开指数不能替代单个期权合约、到期日曲面、Greeks、成交或报价。' },
  oils: { title: '能源衍生品公开路径与持仓审计', focus: '把 WTI 实际公开现货路径与周度 COT 结构并列。', series: ['DCOILWTICO'], cftc: 'energy', boundary: '不提供原油期权波动率曲面、期货结算、近远月曲线、订单簿或可执行报价。' },
  fom: { title: '金融期货报告持仓结构', focus: '读取 CFTC 周度金融期货的已报告类别与未平仓量。', series: ['DGS2', 'DGS10'], cftc: 'financial', boundary: 'CFTC 是周度监管报告，不是实时期货报价、期权流、成交或最活跃合约榜单。' },
  'wbf-ai': { title: '利率曲线与债券期货环境', focus: '并列展示 2年、10年国债收益率和 10年-2年期限利差。', series: ['DGS2', 'DGS10', 'T10Y2Y'], cftc: 'financial', boundary: '公开国债收益率与周度持仓不能替代期货 CTD、DV01、交割篮子、基差或保证金数据。' },
  'credit-monitor': { title: '信用衍生品公开环境', focus: '将高收益 OAS 与公开 VIX 共同观察，保留各自最新可用日期。', series: ['BAMLH0A0HYM2', 'VIXCLS'], boundary: '高收益 OAS 不是单名 CDS、CDX、违约概率、交易对手曲线或可执行信用报价。' },
  cdsw: { title: 'CDS 估值的公开信用环境', focus: '提供高收益 OAS 的实际历史观察和最近区间变动。', series: ['BAMLH0A0HYM2'], boundary: '没有免费可核验的单名 CDS 曲线时，不构造 CDS 估值、保护费率或违约概率。' },
  vca: { title: '波动与权益共同观察', focus: '对照 VIX、三个月波动指数与标普500的共同日期历史。', series: ['VIXCLS', 'VXVCLS', 'SP500'], boundary: '不提供个券期权隐含相关、波动率曲面、偏度或套利结论。' },
  mars: { title: '多资产公开可读性矩阵', focus: '同步展示权益、能源、信用和利率的最近实际观察及读数日期。', series: ['SP500', 'DCOILWTICO', 'BAMLH0A0HYM2', 'DGS10'], boundary: '本面板不生成组合 VaR、压力损失、资产配置或交易指令。' },
  ovcv: { title: '可转债公开环境三角', focus: '把权益、信用和利率实际输入并列，避免以指数环境冒充具体可转债估值。', series: ['SP500', 'BAMLH0A0HYM2', 'DGS10'], boundary: '没有具体证券条款、转股价、债券报价和波动率时，不提供可转债价格、Delta 或转股溢价。' },
  dlib: { title: '公开研究数据覆盖目录', focus: '审计衍生品研究层中可实际读取的资料类别、最后观察日和字段边界。', series: ['VIXCLS', 'DGS10', 'BAMLH0A0HYM2', 'DCOILWTICO', 'DEXUSEU'], boundary: '产品目录、定价模型和合规示例不等同于实时市场资料或产品可交易性。' },
  moso: { title: '公开报告持仓快照', focus: '展示 CFTC 金融期货报告类别的最新实际仓位结构和报告日期。', series: ['VIXCLS'], cftc: 'financial', boundary: '未接入免费可核验期权成交量、流向和大单数据时，不将期货持仓称为活跃期权或订单流。' },
  ovml: { title: '外汇与商品期权的公开基础环境', focus: '并列展示美元/欧元、美元/澳元与 WTI 的实际公开观察。', series: ['DEXUSEU', 'DEXUSAL', 'DCOILWTICO'], boundary: '没有免费可核验 FX/商品期权链、波动率曲面、fixing 或报价时，不提供期权估值。' },
};

const cache = new Map<string, { expiresAt: number; value: FredPoint[] }>();

export function parseFredCsv(csv: string): FredPoint[] {
  return csv.split(/\r?\n/).slice(1).flatMap((line) => {
    const [date, raw] = line.split(',');
    const value = Number(raw);
    return date && raw && raw !== '.' && Number.isFinite(value) ? [{ date, value }] : [];
  });
}

async function readFredSeries(id: string): Promise<FredPoint[]> {
  const cached = cache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`FRED ${id}: HTTP ${response.status}`);
  const value = parseFredCsv(await response.text());
  cache.set(id, { value, expiresAt: Date.now() + 5 * 60_000 });
  return value;
}

type CotSnapshot = { reportDate: string; contract: string; openInterest: number | null; rows: { category: string; long: number | null; short: number | null; net: number | null }[]; source: string };
const asNumber = (value: unknown) => (value === undefined || value === null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null);
const net = (long: number | null, short: number | null) => long === null || short === null ? null : long - short;

function toCotSnapshot(kind: 'financial' | 'energy', row: Record<string, string>): CotSnapshot {
  const longA = asNumber(kind === 'financial' ? row.asset_mgr_positions_long : row.m_money_positions_long_all);
  const shortA = asNumber(kind === 'financial' ? row.asset_mgr_positions_short : row.m_money_positions_short_all);
  const longB = asNumber(kind === 'financial' ? row.lev_money_positions_long : row.swap_positions_long_all);
  const shortB = asNumber(kind === 'financial' ? row.lev_money_positions_short : row.swap__positions_short_all);
  return {
    reportDate: String(row.report_date_as_yyyy_mm_dd || '').slice(0, 10), contract: row.market_and_exchange_names || '未返回合约名称', openInterest: asNumber(row.open_interest_all),
    rows: [{ category: kind === 'financial' ? '资产管理人' : '管理资金', long: longA, short: shortA, net: net(longA, shortA) }, { category: kind === 'financial' ? '杠杆基金' : '掉期交易商', long: longB, short: shortB, net: net(longB, shortB) }],
    source: `CFTC ${kind === 'financial' ? 'Traders in Financial Futures' : 'Disaggregated COT'}（周度）`,
  };
}

export function summarizeObservedRange(points: FredPoint[], start: string, end: string) {
  const selected = points.filter((point) => point.date >= start && point.date <= end);
  const first = selected.at(0) ?? null;
  const last = selected.at(-1) ?? null;
  return { requestedStart: start, requestedEnd: end, count: selected.length, first, last, min: selected.length ? Math.min(...selected.map((point) => point.value)) : null, max: selected.length ? Math.max(...selected.map((point) => point.value)) : null, change: first && last ? last.value - first.value : null };
}

async function readCotSnapshot(kind: 'financial' | 'energy'): Promise<CotSnapshot | null> {
  const resource = kind === 'financial' ? 'gpe5-46if' : '72hh-3qpy';
  const contract = kind === 'financial' ? 'UST BOND - CHICAGO BOARD OF TRADE' : 'WTI FINANCIAL CRUDE OIL - NEW YORK MERCANTILE EXCHANGE';
  const endpoint = new URL(`https://publicreporting.cftc.gov/resource/${resource}.json`);
  endpoint.searchParams.set('$where', `market_and_exchange_names = "${contract}"`);
  endpoint.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
  endpoint.searchParams.set('$limit', '1');
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(20_000) });
  if (response.ok) {
    const [row] = await response.json() as Record<string, string>[];
    if (row) return toCotSnapshot(kind, row);
  }
  // The public Socrata resource can reject anonymous requests. Fincept's ZIP
  // also documents the official current text report, which is keyless and
  // keeps the existing research panel useful without inventing a quote.
  const fallback = await fetchFinceptCftcDisaggregated();
  const target = kind === 'financial' ? 'CFTC:020601' : 'CFTC:067651';
  const point = fallback.history.find(item => item.symbol === target);
  if (!point) return null;
  const fields = point.fields;
  return {
    reportDate: point.date,
    contract: String(fields.contractName ?? '未返回合约名称'),
    openInterest: typeof fields.openInterest === 'number' ? fields.openInterest : point.value,
    rows: [
      {
        category: '管理资金',
        long: typeof fields.managedMoneyLong === 'number' ? fields.managedMoneyLong : null,
        short: typeof fields.managedMoneyShort === 'number' ? fields.managedMoneyShort : null,
        net: typeof fields.managedMoneyNet === 'number' ? fields.managedMoneyNet : null,
      },
      {
        category: '掉期交易商',
        long: typeof fields.swapLong === 'number' ? fields.swapLong : null,
        short: typeof fields.swapShort === 'number' ? fields.swapShort : null,
        net: typeof fields.swapNet === 'number' ? fields.swapNet : null,
      },
    ],
    source: 'CFTC 官方公开周报（文本回退）',
  };
}

async function readCotHistory(kind: 'financial' | 'energy', weeks: number) {
  const resource = kind === 'financial' ? 'gpe5-46if' : '72hh-3qpy';
  const contract = kind === 'financial' ? 'UST BOND - CHICAGO BOARD OF TRADE' : 'WTI FINANCIAL CRUDE OIL - NEW YORK MERCANTILE EXCHANGE';
  const endpoint = new URL(`https://publicreporting.cftc.gov/resource/${resource}.json`);
  endpoint.searchParams.set('$where', `market_and_exchange_names = "${contract}"`);
  endpoint.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
  endpoint.searchParams.set('$limit', String(weeks));
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`CFTC ${kind} history: HTTP ${response.status}`);
  return (await response.json() as Record<string, string>[]).map((row) => toCotSnapshot(kind, row)).filter((row) => row.reportDate);
}

export function filterCotSnapshotCategories(snapshot: CotSnapshot, categories: readonly string[]) {
  return { ...snapshot, rows: categories.length ? snapshot.rows.filter((row) => categories.includes(row.category)) : snapshot.rows };
}

export const derivativesResearchRouter = router({
  /**
   * Fincept's CFTC capability is delivered as one canonical weekly dataset.
   * The frontend can filter the returned contracts locally without creating
   * separate feeds or duplicating the same observation in sibling modules.
   */
  getFinceptCftcSnapshot: publicProcedure.query(async () => fetchFinceptCftcDisaggregated()),
  getModule: publicProcedure.input(z.object({ moduleId: z.enum(DERIVATIVE_MODULE_IDS) })).query(async ({ input }) => {
    const definition = MODULE_DEFINITIONS[input.moduleId];
    const series = await Promise.all(definition.series.map(async (id) => {
      const descriptor = FRED_SERIES[id];
      try {
        const values = await readFredSeries(id);
        const latest = values.at(-1) ?? null;
        const first = values.at(Math.max(0, values.length - 61)) ?? null;
        return { ...descriptor, latest, change: latest && first ? latest.value - first.value : null, history: values.slice(-90), status: latest ? 'available' as const : 'empty' as const };
      } catch {
        return { ...descriptor, latest: null, change: null, history: [], status: 'unavailable' as const };
      }
    }));
    let cot: CotSnapshot | null = null;
    if (definition.cftc) {
      try { cot = await readCotSnapshot(definition.cftc); } catch { cot = null; }
    }
    return { moduleId: input.moduleId, ...definition, series, cot, readAt: new Date().toISOString() };
  }),
  getCoverage: publicProcedure.query(async () => {
    const rows = await Promise.all(Object.values(FRED_SERIES).map(async (descriptor) => {
      try { const values = await readFredSeries(descriptor.id); return { ...descriptor, latest: values.at(-1) ?? null, status: values.length ? 'available' : 'empty' }; }
      catch { return { ...descriptor, latest: null, status: 'unavailable' }; }
    }));
    return { rows, readAt: new Date().toISOString() };
  }),
  getCotHistory: publicProcedure.input(z.object({ kind: z.enum(['financial', 'energy']), weeks: z.union([z.literal(4), z.literal(12), z.literal(26), z.literal(52), z.literal(104)]).default(26), categories: z.array(z.enum(COT_CATEGORIES)).default([]) })).query(async ({ input }) => {
    try {
      const rows = (await readCotHistory(input.kind, input.weeks)).map((snapshot) => filterCotSnapshotCategories(snapshot, input.categories)).filter((snapshot) => snapshot.rows.length);
      return { rows, readAt: new Date().toISOString() };
    }
    catch { return { rows: [], readAt: new Date().toISOString() }; }
  }),
  compareOasVix: publicProcedure.input(z.object({ startA: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endA: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startB: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endB: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine((input) => input.startA <= input.endA && input.startB <= input.endB, { message: '区间起点不能晚于终点' })).query(async ({ input }) => {
    const [oas, vix] = await Promise.all([readFredSeries('BAMLH0A0HYM2'), readFredSeries('VIXCLS')]);
    return { series: [{ ...FRED_SERIES.BAMLH0A0HYM2, rangeA: summarizeObservedRange(oas, input.startA, input.endA), rangeB: summarizeObservedRange(oas, input.startB, input.endB) }, { ...FRED_SERIES.VIXCLS, rangeA: summarizeObservedRange(vix, input.startA, input.endA), rangeB: summarizeObservedRange(vix, input.startB, input.endB) }], input, readAt: new Date().toISOString() };
  }),
  listOasVixDatePresets: protectedProcedure.query(({ ctx }) => listDerivativesOasVixDatePresets(ctx.user.id)),
  saveOasVixDatePreset: protectedProcedure.input(oasVixPresetInput).mutation(({ ctx, input }) => saveDerivativesOasVixDatePreset(ctx.user.id, input)),
  deleteOasVixDatePreset: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteDerivativesOasVixDatePreset(ctx.user.id, input.id)),
});

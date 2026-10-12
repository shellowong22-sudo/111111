import { z } from 'zod';
import { getEconomicObservations } from '../economicObservationService';
import { parseEiaWeeklyPetroleumWorkbook } from '../eiaWeeklyPetroleum';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { processSourceFreshnessNotifications, SOURCE_FRESHNESS_SERIES_IDS } from '../sourceFreshnessNotificationDb';
import { pushNotificationToUser } from '../uploadAndSse';
import { deleteInventorySeasonalityAlertRule, INVENTORY_SEASONALITY_PRODUCTS, listInventorySeasonalityAlertEvents, listInventorySeasonalityAlertRules, processInventorySeasonalityAlerts, saveInventorySeasonalityAlertRule } from '../inventorySeasonalityAlertDb';
import { getEconomicCalendarOfficialObservations, OFFICIAL_ECONOMIC_SERIES_IDS } from '../economicCalendarOfficialData';
import { deleteEconomicCalendarAnomalyRule, deleteEconomicCalendarRegionPreset, deleteEconomicTrendWindowPreset, deleteInactiveEconomicTrendWindowPresets, ECONOMIC_CALENDAR_REGIONS, ECONOMIC_TREND_WINDOW_REGIONS, ECONOMIC_TREND_WINDOW_TOPICS, listEconomicCalendarAnomalyEvents, listEconomicCalendarAnomalyRules, listEconomicCalendarRegionPresets, listEconomicTrendWindowPresets, markEconomicTrendWindowPresetUsed, processEconomicCalendarAnomalyAlerts, saveEconomicCalendarAnomalyRule, saveEconomicCalendarRegionPreset, saveEconomicTrendWindowPreset } from '../economicCalendarAlertDb';
import { RESEARCH_PATH_IDS, createResearchPathNote, getResearchPathAccess, listResearchPathMembers, listResearchPathNotes, listResearchPathShares, reviewResearchPathNote, revokeResearchPathShare, shareResearchPath, toggleResearchPathFavorite } from '../crossModuleResearchPathDb';
import { LEGACY_FIELD_ACCESS_SOURCE_IDS, decideLegacyFieldAccess, listLegacyFieldAccess, listLegacyFieldAccessAudit, listLegacyFieldAccessRequests, requestLegacyFieldAccess } from '../legacyFieldAccessDb';
import { getFedFinancialStatements } from '../fedFinancialStatements';

const LEGACY_SOURCE_IDS = ['SP500', 'VIXCLS', 'DGS2', 'DGS10', 'DEXUSEU', 'DEXJPUS', 'DCOILWTICO', 'WALCL', 'WRESBAL', 'FEDFUNDS', 'ECBDFR', 'ECBMRRFR', 'BOE_BANK_RATE', 'BOJ_LOAN_GROWTH', 'GASREGW', 'GASDESW', 'WCESTUS1', 'WGTSTUS1', 'WDISTUS1'] as const;
type LegacySourceId = typeof LEGACY_SOURCE_IDS[number];
type LegacyModule = '股票市场' | '波动率' | '利率与国债' | '外汇' | '能源' | '央行';
type Transport = 'fred_csv' | 'eia_workbook' | 'boe_csv' | 'boj_html';

type LegacySeriesDefinition = { id: LegacySourceId; module: LegacyModule; label: string; unit: string; cadence: string; sourceLabel: string; sourceUrl: string; boundary: string; transport?: Transport };
type PublicPoint = { date: string; value: number };
type LegacySeriesSnapshot = LegacySeriesDefinition & { observationDate: string | null; value: number | null; change: number | null; history: PublicPoint[]; status: 'available' | 'unavailable'; retrievedAt: string };

/**
 * The original ECTR shipping tab names four proprietary freight indexes
 * (BDI/SCFI/CCFI/WCI).  Those indexes are not available from a free,
 * consistently verifiable feed in this deployment.  Keep the original labels
 * in the UI, but expose a separate, real public observation instead of
 * continuing to render the old hard-coded sample numbers.
 */
export type EctrShippingCostPoint = { date: string; value: number };
export type EctrShippingSnapshot = {
  retrievedAt: string;
  seriesId: 'PCU483111483111';
  label: '公路货运运输成本指数';
  unit: '指数（2017=100）';
  cadence: '月度';
  observationDate: string | null;
  value: number | null;
  change: number | null;
  history: EctrShippingCostPoint[];
  status: 'available' | 'unavailable';
  limitation: string;
};

export type EctrTradePartnerRow = {
  partner: string;
  partnerISO: string;
  flag: string;
  exports: number | null;
  imports: number | null;
  balance: number | null;
  share: number | null;
  yoy: number | null;
  tariff: number | null;
  fdi: number | null;
  observationYear: number | null;
  status: 'available' | 'unavailable';
};

export type EctrTradePartnersSnapshot = {
  retrievedAt: string;
  observationYear: number;
  comparisonYear: number;
  rows: EctrTradePartnerRow[];
  status: 'available' | 'partial' | 'unavailable';
  sourceBoundary: string;
};

export type EctrSectorFlowRow = {
  sector: string;
  commodityCode: string;
  exports: number | null;
  imports: number | null;
  balance: number | null;
  observationYear: number;
  status: 'available' | 'unavailable';
};
export type EctrSectorFlowsSnapshot = {
  retrievedAt: string;
  observationYear: number;
  rows: EctrSectorFlowRow[];
  status: 'available' | 'partial' | 'unavailable';
  sourceBoundary: string;
};

const ECTR_TRADE_PARTNERS = [
  { iso: 'CHN', label: '中国', flag: '🇨🇳', code: 156 },
  { iso: 'MEX', label: '墨西哥', flag: '🇲🇽', code: 484 },
  { iso: 'CAN', label: '加拿大', flag: '🇨🇦', code: 124 },
  { iso: 'JPN', label: '日本', flag: '🇯🇵', code: 392 },
  { iso: 'KOR', label: '韩国', flag: '🇰🇷', code: 410 },
  { iso: 'VNM', label: '越南', flag: '🇻🇳', code: 704 },
  { iso: 'IND', label: '印度', flag: '🇮🇳', code: 699 },
  { iso: 'DEU', label: '德国', flag: '🇩🇪', code: 276 },
  { iso: 'TWN', label: '台湾', flag: '🇹🇼', code: 158 },
  { iso: 'EUN', label: '欧盟', flag: '🇪🇺', code: 97 },
] as const;
type ComtradeFlow = 'X' | 'M';
type ComtradeRow = { period?: string; flowCode?: string; partnerISO?: string; primaryValue?: number | string | null };
let ectrTradePartnersCache: { at: number; value: EctrTradePartnersSnapshot } | null = null;
let ectrTradePartnersPending: Promise<EctrTradePartnersSnapshot> | null = null;

const ECTR_SECTOR_GROUPS = [
  { code: '10', sector: '农产品 / 谷物' },
  { code: '27', sector: '能源 / 矿物燃料' },
  { code: '30', sector: '医药产品' },
  { code: '39', sector: '化工 / 塑料' },
  { code: '72', sector: '钢铁材料' },
  { code: '84', sector: '机械设备' },
  { code: '85', sector: '电子设备' },
  { code: '87', sector: '汽车及零部件' },
] as const;
type ComtradeSectorRow = { flowCode?: string; cmdCode?: string | number; primaryValue?: number | string | null };
export function parseComtradeSectorFlows(payload: unknown, observationYear: number): EctrSectorFlowRow[] {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: ComtradeSectorRow[] }).data : [];
  const values = new Map<string, { exports: number | null; imports: number | null }>();
  for (const item of data) {
    const code = String(item.cmdCode ?? '').padStart(2, '0');
    if (!ECTR_SECTOR_GROUPS.some(group => group.code === code)) continue;
    const value = Number(item.primaryValue);
    if (!Number.isFinite(value) || value < 0) continue;
    const current = values.get(code) ?? { exports: null, imports: null };
    const flow = String(item.flowCode ?? '').toUpperCase();
    if (flow === 'X') current.exports = value / 1e9;
    if (flow === 'M') current.imports = value / 1e9;
    values.set(code, current);
  }
  return ECTR_SECTOR_GROUPS.map(group => {
    const value = values.get(group.code) ?? { exports: null, imports: null };
    return {
      sector: group.sector, commodityCode: group.code, exports: value.exports, imports: value.imports,
      balance: value.exports !== null && value.imports !== null ? Number((value.exports - value.imports).toFixed(3)) : null,
      observationYear, status: value.exports !== null || value.imports !== null ? 'available' : 'unavailable',
    };
  });
}

let ectrSectorFlowsCache: { at: number; value: EctrSectorFlowsSnapshot } | null = null;
let ectrSectorFlowsPending: Promise<EctrSectorFlowsSnapshot> | null = null;
export async function getEctrSectorFlowsSnapshot(refresh = false): Promise<EctrSectorFlowsSnapshot> {
  if (ectrSectorFlowsPending) return ectrSectorFlowsPending;
  if (ectrSectorFlowsCache && !refresh && Date.now() - ectrSectorFlowsCache.at < 6 * 60 * 60_000) return ectrSectorFlowsCache.value;
  ectrSectorFlowsPending = (async () => {
    const observationYear = new Date().getUTCFullYear() - 1;
    const sourceBoundary = '联合国商品贸易统计预览年度总额；商品组金额为十亿美元。仅描述美国与全球伙伴的实际进出口，不从金额推导风险评分、概率、供应链韧性或交易信号。';
    try {
      const url = new URL('https://comtradeapi.un.org/public/v1/preview/C/A/HS');
      url.search = new URLSearchParams({ period: String(observationYear), reporterCode: '842', flowCode: 'X,M', partnerCode: '0', partner2Code: '0', cmdCode: ECTR_SECTOR_GROUPS.map(group => group.code).join(','), customsCode: 'C00', motCode: '0', maxRecords: '100', breakdownMode: 'classic', includeDesc: 'true' }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`COMTRADE_SECTOR_${response.status}`);
      const rows = parseComtradeSectorFlows(await response.json(), observationYear);
      const available = rows.filter(row => row.status === 'available').length;
      const value: EctrSectorFlowsSnapshot = { retrievedAt: new Date().toISOString(), observationYear, rows, status: available === 0 ? 'unavailable' : available === rows.length ? 'available' : 'partial', sourceBoundary };
      ectrSectorFlowsCache = { at: Date.now(), value };
      return value;
    } catch {
      return { retrievedAt: new Date().toISOString(), observationYear, rows: ECTR_SECTOR_GROUPS.map(group => ({ sector: group.sector, commodityCode: group.code, exports: null, imports: null, balance: null, observationYear, status: 'unavailable' as const })), status: 'unavailable' as const, sourceBoundary };
    }
  })().finally(() => { ectrSectorFlowsPending = null; });
  return ectrSectorFlowsPending;
}

export function parseComtradePartnerFlows(payload: unknown): Map<string, { exports: number | null; imports: number | null }> {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: ComtradeRow[] }).data : [];
  const rows = new Map<string, { exports: number | null; imports: number | null }>();
  for (const item of data) {
    const iso = String(item.partnerISO ?? '').toUpperCase();
    if (!iso || !ECTR_TRADE_PARTNERS.some((partner) => partner.iso === iso)) continue;
    if (item.primaryValue === null || item.primaryValue === undefined || item.primaryValue === '') continue;
    const value = Number(item.primaryValue);
    if (!Number.isFinite(value) || value < 0) continue;
    const current = rows.get(iso) ?? { exports: null, imports: null };
    const flow = String(item.flowCode ?? '').toUpperCase() as ComtradeFlow;
    if (flow === 'X') current.exports = value / 1e9;
    if (flow === 'M') current.imports = value / 1e9;
    rows.set(iso, current);
  }
  return rows;
}

async function fetchComtradeYear(year: number): Promise<Map<string, { exports: number | null; imports: number | null }>> {
  const partnerCodes = ECTR_TRADE_PARTNERS.filter((partner) => partner.iso !== 'EUN' && partner.iso !== 'TWN').map((partner) => partner.code).join(',');
  const url = new URL('https://comtradeapi.un.org/public/v1/preview/C/A/HS');
  url.search = new URLSearchParams({
    period: String(year), reporterCode: '842', flowCode: 'X,M', partnerCode: partnerCodes,
    partner2Code: '0', cmdCode: 'TOTAL', customsCode: 'C00', motCode: '0', maxRecords: '100',
    breakdownMode: 'classic', includeDesc: 'true',
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`COMTRADE_${response.status}`);
  return parseComtradePartnerFlows(await response.json());
}

export async function getEctrTradePartnersSnapshot(refresh = false): Promise<EctrTradePartnersSnapshot> {
  if (ectrTradePartnersPending) return ectrTradePartnersPending;
  if (ectrTradePartnersCache && !refresh && Date.now() - ectrTradePartnersCache.at < 6 * 60 * 60_000) return ectrTradePartnersCache.value;
  ectrTradePartnersPending = (async () => {
    const sourceBoundary = '联合国商品贸易统计预览年度总额；出口/进口为十亿美元，YoY 为伙伴双边总贸易额同比；份额仅为本次返回伙伴集合内占比。关税、FDI、欧盟/台湾聚合口径未接入时保持空值，不以估算或旧样例替代。';
    let observationYear = new Date().getUTCFullYear() - 1;
    let comparisonYear = observationYear - 1;
    try {
      let current = await fetchComtradeYear(observationYear);
      if (current.size === 0) {
        observationYear -= 1;
        current = await fetchComtradeYear(observationYear);
      }
      comparisonYear = observationYear - 1;
      let previous = new Map<string, { exports: number | null; imports: number | null }>();
      try {
        previous = await fetchComtradeYear(comparisonYear);
      } catch (error) {
        // Current-period observations remain usable when the comparison period
        // is temporarily unavailable. Only YoY stays empty in that case.
        console.warn('[ECTR] Comparison-year trade data unavailable', {
          comparisonYear,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      let available = 0;
      const rows = ECTR_TRADE_PARTNERS.map((partner) => {
        const now = current.get(partner.iso) ?? { exports: null, imports: null };
        const prior = previous.get(partner.iso) ?? { exports: null, imports: null };
        const exports = now.exports;
        const imports = now.imports;
        const balance = exports !== null && imports !== null ? Number((exports - imports).toFixed(3)) : null;
        const nowTotal = exports !== null && imports !== null ? exports + imports : null;
        const priorTotal = prior.exports !== null && prior.imports !== null ? prior.exports + prior.imports : null;
        const yoy = nowTotal !== null && priorTotal !== null && priorTotal !== 0 ? Number((((nowTotal - priorTotal) / Math.abs(priorTotal)) * 100).toFixed(2)) : null;
        if (nowTotal !== null) available += 1;
        return { partner: partner.label, partnerISO: partner.iso, flag: partner.flag, exports, imports, balance, share: null, yoy, tariff: null, fdi: null, observationYear, status: nowTotal !== null ? 'available' as const : 'unavailable' as const };
      });
      const total = rows.reduce((sum, row) => sum + (row.exports !== null && row.imports !== null ? row.exports + row.imports : 0), 0);
      const withShare = rows.map((row) => ({ ...row, share: total > 0 && row.exports !== null && row.imports !== null ? Number((((row.exports + row.imports) / total) * 100).toFixed(2)) : null }));
      const value: EctrTradePartnersSnapshot = { retrievedAt: new Date().toISOString(), observationYear, comparisonYear, rows: withShare, status: available === 0 ? 'unavailable' : available === rows.length ? 'available' : 'partial', sourceBoundary };
      ectrTradePartnersCache = { at: Date.now(), value };
      return value;
    } catch (error) {
      console.warn('[ECTR] Current-year trade data unavailable', {
        observationYear,
        error: error instanceof Error ? error.message : String(error),
      });
      const rows = ECTR_TRADE_PARTNERS.map((partner) => ({ partner: partner.label, partnerISO: partner.iso, flag: partner.flag, exports: null, imports: null, balance: null, share: null, yoy: null, tariff: null, fdi: null, observationYear, status: 'unavailable' as const }));
      return { retrievedAt: new Date().toISOString(), observationYear, comparisonYear, rows, status: 'unavailable' as const, sourceBoundary };
    }
  })().finally(() => { ectrTradePartnersPending = null; });
  return ectrTradePartnersPending;
}

export function parseEctrShippingCostCsv(csv: string): EctrShippingCostPoint[] {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const [rawDate, rawValue] = line.split(',');
      const value = Number(rawValue);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate?.trim() ?? '') || rawValue?.trim() === '.' || !Number.isFinite(value)) return [];
      return [{ date: rawDate.trim(), value }];
    })
    .filter((point, index, rows) => index === rows.findIndex((candidate) => candidate.date === point.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

let ectrShippingCache: { at: number; value: EctrShippingSnapshot } | null = null;
let ectrShippingPending: Promise<EctrShippingSnapshot> | null = null;
export async function getEctrShippingSnapshot(refresh = false): Promise<EctrShippingSnapshot> {
  if (ectrShippingPending) return ectrShippingPending;
  if (ectrShippingCache && !refresh && Date.now() - ectrShippingCache.at < 30 * 60_000) return ectrShippingCache.value;
  ectrShippingPending = (async () => {
    const limitation = '月度公路货运运输成本公开观察；不是 BDI、SCFI、CCFI 或 WCI，不代表实时航运报价、运力、盘口或可执行运价。';
    try {
      const response = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=PCU483111483111', { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`SHIPPING_SOURCE_${response.status}`);
      const history = parseEctrShippingCostCsv(await response.text()).slice(-36);
      const latest = history.at(-1) ?? null;
      const previous = history.at(-2) ?? null;
      const value: EctrShippingSnapshot = {
        retrievedAt: new Date().toISOString(), seriesId: 'PCU483111483111', label: '公路货运运输成本指数',
        unit: '指数（2017=100）', cadence: '月度', observationDate: latest?.date ?? null,
        value: latest?.value ?? null, change: latest && previous ? Number((latest.value - previous.value).toFixed(3)) : null,
        history, status: latest ? 'available' : 'unavailable', limitation,
      };
      ectrShippingCache = { at: Date.now(), value };
      return value;
    } catch {
      const unavailable: EctrShippingSnapshot = {
        retrievedAt: new Date().toISOString(), seriesId: 'PCU483111483111', label: '公路货运运输成本指数', unit: '指数（2017=100）', cadence: '月度', observationDate: null, value: null, change: null, history: [], status: 'unavailable', limitation,
      };
      return unavailable;
    }
  })().finally(() => { ectrShippingPending = null; });
  const pending = ectrShippingPending;
  if (!pending) throw new Error('SHIPPING_REQUEST_NOT_INITIALIZED');
  return pending;
}

export const LEGACY_PUBLIC_SERIES: readonly LegacySeriesDefinition[] = [
  { id: 'SP500', module: '股票市场', label: '标普 500 收盘观察', unit: '指数点', cadence: '工作日', sourceLabel: '圣路易斯联储 FRED', sourceUrl: 'https://fred.stlouisfed.org/series/SP500', boundary: 'FRED 日度历史观察，不是实时指数、成分股价格或可执行报价。' },
  { id: 'VIXCLS', module: '波动率', label: 'CBOE VIX 收盘观察', unit: '指数点', cadence: '工作日', sourceLabel: '圣路易斯联储 FRED', sourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS', boundary: 'FRED 日度历史观察，不是实时隐含波动率曲面、期权链或交易信号。' },
  { id: 'DGS2', module: '利率与国债', label: '美国国债 2 年期常量期限收益率', unit: '%', cadence: '工作日', sourceLabel: '圣路易斯联储 FRED', sourceUrl: 'https://fred.stlouisfed.org/series/DGS2', boundary: '美国财政部常量期限收益率的 FRED 日度再发布，不是单券成交收益率、买卖价或可执行报价。' },
  { id: 'DGS10', module: '利率与国债', label: '美国国债 10 年期常量期限收益率', unit: '%', cadence: '工作日', sourceLabel: '圣路易斯联储 FRED', sourceUrl: 'https://fred.stlouisfed.org/series/DGS10', boundary: '美国财政部常量期限收益率的 FRED 日度再发布，不是单券成交收益率、买卖价或可执行报价。' },
  { id: 'DEXUSEU', module: '外汇', label: '美元兑欧元参考汇率', unit: '美元/欧元', cadence: '工作日', sourceLabel: '圣路易斯联储 FRED H.10', sourceUrl: 'https://fred.stlouisfed.org/series/DEXUSEU', boundary: 'H.10 发布的日度参考观察，不是实时外汇报价、可执行汇率或套保价格。' },
  { id: 'DEXJPUS', module: '外汇', label: '日元兑美元参考汇率', unit: '日元/美元', cadence: '工作日', sourceLabel: '圣路易斯联储 FRED H.10', sourceUrl: 'https://fred.stlouisfed.org/series/DEXJPUS', boundary: 'H.10 发布的日度参考观察，不是实时外汇报价、可执行汇率或套保价格。' },
  { id: 'DCOILWTICO', module: '能源', label: 'WTI 现货参考价格', unit: '美元/桶', cadence: '工作日', sourceLabel: '圣路易斯联储 FRED', sourceUrl: 'https://fred.stlouisfed.org/series/DCOILWTICO', boundary: 'FRED 日度现货参考观察，不是实时期货盘口、现货成交或可执行价格。' },
  { id: 'WALCL', module: '央行', label: '美联储总资产', unit: '百万美元', cadence: '周度', sourceLabel: '美联储 H.4.1（经 FRED 公开再发布）', sourceUrl: 'https://fred.stlouisfed.org/series/WALCL', boundary: '美联储 H.4.1 周度资产负债表观察，不是当日结算、政策路径或流动性预测。' },
  { id: 'WRESBAL', module: '央行', label: '美国存款机构准备金余额', unit: '百万美元', cadence: '周度', sourceLabel: '美联储 H.4.1（经 FRED 公开再发布）', sourceUrl: 'https://fred.stlouisfed.org/series/WRESBAL', boundary: '美联储 H.4.1 周度准备金余额观察，不是银行间实时资金、准备金预测或交易信号。' },
  { id: 'FEDFUNDS', module: '央行', label: '有效联邦基金利率', unit: '%', cadence: '月度', sourceLabel: '美联储（经 FRED 公开再发布）', sourceUrl: 'https://fred.stlouisfed.org/series/FEDFUNDS', boundary: '实际公布的有效联邦基金利率月度观察，不是实时隔夜成交、目标区间或政策预测。' },
  { id: 'ECBDFR', module: '央行', label: '欧洲央行存款便利利率', unit: '%', cadence: '工作日', sourceLabel: '欧洲中央银行（经 FRED 公开再发布）', sourceUrl: 'https://fred.stlouisfed.org/series/ECBDFR', boundary: 'ECB 实际公布的存款便利利率观察，不是实时欧元货币市场成交或政策路径预测。' },
  { id: 'ECBMRRFR', module: '央行', label: '欧洲央行主要再融资操作利率', unit: '%', cadence: '工作日', sourceLabel: '欧洲中央银行（经 FRED 公开再发布）', sourceUrl: 'https://fred.stlouisfed.org/series/ECBMRRFR', boundary: 'ECB 实际公布的主要再融资操作利率观察，不是实时融资成交、抵押品报价或政策预测。' },
  { id: 'BOE_BANK_RATE', module: '央行', label: '英格兰银行官方 Bank Rate', unit: '%', cadence: '工作日', sourceLabel: '英格兰银行数据库', sourceUrl: 'https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp', boundary: '英格兰银行公布的官方 Bank Rate 历史观察，不是英镑隔夜市场成交、存贷款报价或政策预测。', transport: 'boe_csv' },
  { id: 'BOJ_LOAN_GROWTH', module: '央行', label: '日本国内银行贷款同比', unit: '%', cadence: '月度', sourceLabel: '日本银行时序统计', sourceUrl: 'https://www.stat-search.boj.or.jp/ssi/mtshtml/bs02_m_1_en.html', boundary: '日本银行公布的国内银行贷款同比统计，不是日本政策利率、银行同业实时成交、信用预测或交易信号。', transport: 'boj_html' },
  { id: 'GASREGW', module: '能源', label: '美国普通无铅汽油零售价格', unit: '美元/加仑', cadence: '周度', sourceLabel: '美国能源信息署 EIA（经 FRED 公开再发布）', sourceUrl: 'https://fred.stlouisfed.org/series/GASREGW', boundary: 'EIA 周度零售价格观察，不是地区加油站实时价格、成品油批发价或可执行报价。' },
  { id: 'GASDESW', module: '能源', label: '美国公路柴油零售价格', unit: '美元/加仑', cadence: '周度', sourceLabel: '美国能源信息署 EIA（经 FRED 公开再发布）', sourceUrl: 'https://fred.stlouisfed.org/series/GASDESW', boundary: 'EIA 周度零售价格观察，不是地区加油站实时价格、柴油批发价或可执行报价。' },
  { id: 'WCESTUS1', module: '能源', label: '美国商业原油库存（不含战略储备）', unit: '千桶', cadence: '周度', sourceLabel: '美国能源信息署 EIA', sourceUrl: 'https://www.eia.gov/dnav/pet/hist_xls/WCESTUS1w.xls', boundary: 'EIA 周度石油状态报告历史表，不是实时库存、地区库存明细、战略石油储备或供需预测。', transport: 'eia_workbook' },
  { id: 'WGTSTUS1', module: '能源', label: '美国成品汽油库存', unit: '千桶', cadence: '周度', sourceLabel: '美国能源信息署 EIA', sourceUrl: 'https://www.eia.gov/dnav/pet/hist_xls/WGTSTUS1w.xls', boundary: 'EIA 周度石油状态报告历史表，不是实时库存、地区库存明细或供需预测。', transport: 'eia_workbook' },
  { id: 'WDISTUS1', module: '能源', label: '美国馏分燃料油库存', unit: '千桶', cadence: '周度', sourceLabel: '美国能源信息署 EIA', sourceUrl: 'https://www.eia.gov/dnav/pet/hist_xls/WDISTUS1w.xls', boundary: 'EIA 周度石油状态报告历史表，不是实时库存、地区库存明细或供需预测。', transport: 'eia_workbook' },
] as const;

export function toLegacySeriesSnapshot(definition: LegacySeriesDefinition, history: PublicPoint[]): LegacySeriesSnapshot {
  const current = history.at(-1) ?? null; const previous = history.at(-2) ?? null;
  return { ...definition, observationDate: current?.date ?? null, value: current?.value ?? null, change: current && previous ? Number((current.value - previous.value).toFixed(6)) : null, history: history.slice(-120), status: current ? 'available' : 'unavailable', retrievedAt: new Date().toISOString() };
}
export function parseLegacyFredCsv(csv: string, definition: LegacySeriesDefinition): LegacySeriesSnapshot { const history = csv.split(/\r?\n/).slice(1).flatMap((line) => { const [date, raw] = line.split(','); const value = Number(raw); return date && raw && raw !== '.' && Number.isFinite(value) ? [{ date: date.trim(), value }] : []; }); return toLegacySeriesSnapshot(definition, history); }
export function parseBoeBankRateCsv(csv: string, definition: LegacySeriesDefinition): LegacySeriesSnapshot { const history = csv.split(/\r?\n/).flatMap((line) => { const [rawDate, rawValue] = line.split(','); const date = rawDate ? new Date(`${rawDate.trim()} UTC`) : null; const value = Number(rawValue); return date && !Number.isNaN(date.getTime()) && Number.isFinite(value) ? [{ date: date.toISOString().slice(0, 10), value }] : []; }); return toLegacySeriesSnapshot(definition, history); }
export function parseBojLoanGrowthHtml(html: string, definition: LegacySeriesDefinition): LegacySeriesSnapshot { const history = [...html.matchAll(/<tr[^>]*>\s*<th[^>]*>\s*(20\d{2})\/(\d{2})\s*<\/th>\s*<td[^>]*>\s*([^<\s]+)\s*<\/td>/g)].flatMap((match) => { const value = Number(match[3]); return Number.isFinite(value) ? [{ date: `${match[1]}-${match[2]}-01`, value }] : []; }); return toLegacySeriesSnapshot(definition, history); }
export function parseLegacyEiaWorkbook(buffer: ArrayBuffer): PublicPoint[] { return parseEiaWeeklyPetroleumWorkbook(buffer); }
function unavailableSeries(definition: LegacySeriesDefinition): LegacySeriesSnapshot { return { ...definition, observationDate: null, value: null, change: null, history: [], status: 'unavailable', retrievedAt: new Date().toISOString() }; }
async function fetchLegacySeries(definition: LegacySeriesDefinition): Promise<LegacySeriesSnapshot> { try { const boeUrl = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/2000&Dateto=now&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N'; const response = definition.transport === 'eia_workbook' ? await fetch(definition.sourceUrl, { signal: AbortSignal.timeout(15_000) }) : definition.transport === 'boe_csv' ? await fetch(boeUrl, { signal: AbortSignal.timeout(15_000) }) : definition.transport === 'boj_html' ? await fetch(definition.sourceUrl, { signal: AbortSignal.timeout(15_000) }) : await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}`, { signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error(`SOURCE_${response.status}`); if (definition.transport === 'eia_workbook') return toLegacySeriesSnapshot(definition, parseLegacyEiaWorkbook(await response.arrayBuffer())); const text = await response.text(); return definition.transport === 'boe_csv' ? parseBoeBankRateCsv(text, definition) : definition.transport === 'boj_html' ? parseBojLoanGrowthHtml(text, definition) : parseLegacyFredCsv(text, definition); } catch { return unavailableSeries(definition); } }

export type CoverageState = 'verified_public' | 'user_input' | 'authorized_source' | 'true_empty' | 'source_unavailable';
export const LEGACY_FIELD_COVERAGE = [
  { module: '股票市场', field: '标普 500 收盘观察', sourceId: 'SP500', state: 'verified_public' as CoverageState, cadence: '工作日', note: '公开日度收盘观察。' }, { module: '股票市场', field: '个券最新价、成交量与买卖价', sourceId: null, state: 'true_empty' as CoverageState, cadence: '未接入', note: '没有免费、统一且可核验的实时逐笔覆盖。' },
  { module: '波动率', field: 'VIX 收盘观察', sourceId: 'VIXCLS', state: 'verified_public' as CoverageState, cadence: '工作日', note: '公开历史收盘观察。' },
  { module: '利率与国债', field: '2 年期常量期限收益率', sourceId: 'DGS2', state: 'verified_public' as CoverageState, cadence: '工作日', note: '公开常量期限日度观察。' }, { module: '利率与国债', field: '10 年期常量期限收益率', sourceId: 'DGS10', state: 'verified_public' as CoverageState, cadence: '工作日', note: '公开常量期限日度观察。' }, { module: '利率与国债', field: '单券成交价、买卖价与订单簿', sourceId: null, state: 'true_empty' as CoverageState, cadence: '未接入', note: '受授权二级市场字段，未以代理值替代。' },
  { module: '外汇', field: '美元兑欧元日度参考汇率', sourceId: 'DEXUSEU', state: 'verified_public' as CoverageState, cadence: '工作日', note: 'H.10 公开日度参考观察。' }, { module: '外汇', field: '日元兑美元日度参考汇率', sourceId: 'DEXJPUS', state: 'verified_public' as CoverageState, cadence: '工作日', note: 'H.10 公开日度参考观察。' }, { module: '外汇', field: '实时可执行汇率与远期点', sourceId: null, state: 'true_empty' as CoverageState, cadence: '未接入', note: '不使用静态或随机替代值。' },
  { module: '能源', field: 'WTI 日度现货参考价格', sourceId: 'DCOILWTICO', state: 'verified_public' as CoverageState, cadence: '工作日', note: 'FRED 日度现货参考观察。' }, { module: '能源', field: '美国普通无铅汽油零售价格', sourceId: 'GASREGW', state: 'verified_public' as CoverageState, cadence: '周度', note: 'EIA 周度零售价格公开观察。' }, { module: '能源', field: '美国公路柴油零售价格', sourceId: 'GASDESW', state: 'verified_public' as CoverageState, cadence: '周度', note: 'EIA 周度零售价格公开观察。' }, { module: '能源', field: '美国商业原油库存（不含战略储备）', sourceId: 'WCESTUS1', state: 'verified_public' as CoverageState, cadence: '周度', note: 'EIA 周度石油状态报告历史观察。' }, { module: '能源', field: '美国成品汽油库存', sourceId: 'WGTSTUS1', state: 'verified_public' as CoverageState, cadence: '周度', note: 'EIA 周度石油状态报告历史观察。' }, { module: '能源', field: '美国馏分燃料油库存', sourceId: 'WDISTUS1', state: 'verified_public' as CoverageState, cadence: '周度', note: 'EIA 周度石油状态报告历史观察。' }, { module: '能源', field: '实时期货盘口与成交量', sourceId: null, state: 'true_empty' as CoverageState, cadence: '未接入', note: '不构造期货盘口或实时成交。' },
  { module: '央行', field: '美联储总资产', sourceId: 'WALCL', state: 'verified_public' as CoverageState, cadence: '周度', note: 'H.4.1 官方资产负债表公开观察。' }, { module: '央行', field: '美国存款机构准备金余额', sourceId: 'WRESBAL', state: 'verified_public' as CoverageState, cadence: '周度', note: 'H.4.1 官方准备金余额公开观察。' }, { module: '央行', field: '有效联邦基金利率', sourceId: 'FEDFUNDS', state: 'verified_public' as CoverageState, cadence: '月度', note: '美联储实际公布的有效利率观察。' }, { module: '央行', field: 'ECB 存款便利利率', sourceId: 'ECBDFR', state: 'verified_public' as CoverageState, cadence: '工作日', note: 'ECB 官方关键利率公开观察。' }, { module: '央行', field: 'ECB 主要再融资操作利率', sourceId: 'ECBMRRFR', state: 'verified_public' as CoverageState, cadence: '工作日', note: 'ECB 官方关键利率公开观察。' }, { module: '央行', field: '英格兰银行官方 Bank Rate', sourceId: 'BOE_BANK_RATE', state: 'verified_public' as CoverageState, cadence: '工作日', note: '英格兰银行数据库官方 Bank Rate 观察。' }, { module: '央行', field: '日本国内银行贷款同比', sourceId: 'BOJ_LOAN_GROWTH', state: 'verified_public' as CoverageState, cadence: '月度', note: '日本银行时序统计公开观察。' }, { module: '央行', field: '实时货币市场成交与政策路径', sourceId: null, state: 'true_empty' as CoverageState, cadence: '未接入', note: '不以政策猜测或代理利率填充。' },
  { module: '跨模块用户输入', field: '研究假设、用户录入收益率与观察日期', sourceId: null, state: 'user_input' as CoverageState, cadence: '按用户录入', note: '字段由用户核验和输入，不自动视作市场事实。' },
] as const;

export const ECONOMIC_FIELD_COVERAGE = [
  { section: '货币政策与央行', field: '美联储总资产', sourceId: 'WALCL' as LegacySourceId, state: 'verified_public' as CoverageState, cadence: '周度', note: 'H.4.1 官方资产负债表公开观察；仅用于核验实际历史观察。' },
  { section: '货币政策与央行', field: '准备金余额', sourceId: 'WRESBAL' as LegacySourceId, state: 'verified_public' as CoverageState, cadence: '周度', note: 'H.4.1 官方准备金余额公开观察；不代表当日资金市场。' },
  { section: '货币政策与央行', field: '有效联邦基金利率', sourceId: 'FEDFUNDS' as LegacySourceId, state: 'verified_public' as CoverageState, cadence: '月度', note: '美联储经 FRED 公开再发布的实际月度观察。' },
  { section: '货币政策与央行', field: '欧洲央行政策利率', sourceId: 'ECBDFR' as LegacySourceId, state: 'verified_public' as CoverageState, cadence: '工作日', note: 'ECB 存款便利利率公开观察；不代表政策路径预测。' },
  { section: '货币政策与央行', field: '英格兰银行 Bank Rate', sourceId: 'BOE_BANK_RATE' as LegacySourceId, state: 'verified_public' as CoverageState, cadence: '工作日', note: '英格兰银行官方历史观察。' },
  { section: '经济日历', field: '宏观事件实际值、前值和预期', sourceId: null, state: 'true_empty' as CoverageState, cadence: '未接入', note: '原经济日历中的保留数字未逐字段接入结构化公开读取，不能标为当前事实。' },
  { section: '宏观统计', field: '就业、通胀、PMI 与 GDP 原始读数', sourceId: null, state: 'true_empty' as CoverageState, cadence: '未接入', note: '未建立对应国家统计机构的逐字段结构化读取，不以保留样例替代。' },
  { section: '研究模型与情景', field: '政策规则、经济意外与预测路径', sourceId: null, state: 'true_empty' as CoverageState, cadence: '未接入', note: '原工作区分析设定未附可复算公开输入，不构成当前预测或投资结论。' },
] as const;

type LegacySnapshot = { asOf: string; sourceLabel: string; sourceBoundary: string; series: LegacySeriesSnapshot[] };
let cachedSnapshot: LegacySnapshot | null = null; let cachedAt = 0; let pendingSnapshot: Promise<LegacySnapshot> | null = null; const CACHE_MS = 45_000;
export async function getLegacyMarketSnapshot(): Promise<LegacySnapshot> { const now = Date.now(); if (cachedSnapshot && now - cachedAt < CACHE_MS) return cachedSnapshot; if (pendingSnapshot) return pendingSnapshot; pendingSnapshot = Promise.all(LEGACY_PUBLIC_SERIES.map(fetchLegacySeries)).then((series) => { const snapshot = { asOf: new Date().toISOString(), sourceLabel: 'FRED、EIA 与官方央行公开观察', sourceBoundary: '仅展示服务端实际读取的公共历史参考观察；不显示实时、可执行、逐笔、买卖价、订单簿、合成路径或投资结论。', series }; cachedSnapshot = snapshot; cachedAt = Date.now(); return snapshot; }).finally(() => { pendingSnapshot = null; }); return pendingSnapshot; }
function sourceExcerpt(series: LegacySeriesSnapshot) { return { available: series.status === 'available', sourceId: series.id, title: `${series.label} · 结构化来源摘录`, provider: series.sourceLabel, sourceUrl: series.sourceUrl, observedAt: series.observationDate, retrievedAt: series.retrievedAt, fields: [{ key: 'observation_date', label: '观察日期', value: series.observationDate ?? '—' }, { key: 'value', label: `数值（${series.unit}）`, value: series.value === null ? '—' : String(series.value) }, { key: 'change', label: '相邻实际观察变动', value: series.change === null ? '—' : String(series.change) }, { key: 'cadence', label: '发布频率', value: series.cadence }], records: series.history.slice(-8).reverse(), sourceBoundary: series.status === 'available' ? series.boundary : '当前无法读取该公共序列，因此没有终端内可读摘录；系统不显示缓存样本、虚构摘录或第三方页面内容。' }; }
function getCoverage(snapshot: LegacySnapshot) { const seriesById = new Map(snapshot.series.map((series) => [series.id, series])); const fields = LEGACY_FIELD_COVERAGE.map((field) => { const source = field.sourceId ? seriesById.get(field.sourceId as LegacySourceId) : null; const state: CoverageState = field.state === 'verified_public' && source?.status !== 'available' ? 'source_unavailable' : field.state; const observationDate = source?.observationDate ?? null; const lagDays = observationDate ? Math.max(0, Math.floor((Date.now() - Date.parse(`${observationDate}T00:00:00Z`)) / 86_400_000)) : null; return { ...field, state, observationDate, retrievedAt: source?.retrievedAt ?? null, lagDays, sourceLabel: source?.sourceLabel ?? null, sourceUrl: source?.sourceUrl ?? null }; }); const total = fields.length; const verified = fields.filter((field) => field.state === 'verified_public' || field.state === 'authorized_source').length; const governed = fields.filter((field) => field.state !== 'source_unavailable').length; return { asOf: snapshot.asOf, total, verified, governed, verifiedCoveragePct: total ? Number(((verified / total) * 100).toFixed(1)) : 0, governedCoveragePct: total ? Number(((governed / total) * 100).toFixed(1)) : 0, byState: (['verified_public', 'user_input', 'authorized_source', 'true_empty', 'source_unavailable'] as CoverageState[]).map((state) => ({ state, count: fields.filter((field) => field.state === state).length })), byModule: Array.from(new Set(fields.map((field) => field.module))).map((module) => ({ module, total: fields.filter((field) => field.module === module).length, verified: fields.filter((field) => field.module === module && (field.state === 'verified_public' || field.state === 'authorized_source')).length, unavailable: fields.filter((field) => field.module === module && field.state === 'source_unavailable').length })), fields, sourceBoundary: '覆盖率反映字段来源治理状态，而不是市场覆盖、报价可得性、研究完整性或投资建议。历史演示字段不计入已验证覆盖。' }; }
function alignedInventoryComparison(snapshot: LegacySnapshot) { const definitions = ['WCESTUS1', 'WGTSTUS1', 'WDISTUS1'] as const; const selected = definitions.map((id) => snapshot.series.find((item) => item.id === id)); if (selected.some((item) => !item || item.status !== 'available')) return { asOf: snapshot.asOf, status: 'unavailable' as const, rows: [], sourceBoundary: '至少一条 EIA 官方周度库存序列当前不可读；终端不以不同日期、缓存样本或插值拼接跨产品比较。' }; const maps = selected.map((item) => new Map(item!.history.map((point) => [point.date, point.value]))); const dates = [...maps[0]!.keys()].filter((date) => maps.every((map) => map.has(date))).sort(); const rows = dates.slice(-52).map((date, index, list) => { const prior = index ? list[index - 1] : null; const crude = maps[0]!.get(date)!; const gasoline = maps[1]!.get(date)!; const distillate = maps[2]!.get(date)!; return { date, crude, gasoline, distillate, crudeChange: prior ? crude - maps[0]!.get(prior)! : null, gasolineChange: prior ? gasoline - maps[1]!.get(prior)! : null, distillateChange: prior ? distillate - maps[2]!.get(prior)! : null }; }); return { asOf: snapshot.asOf, status: rows.length ? 'available' as const : 'unavailable' as const, rows, sourceBoundary: '仅比较三条 EIA 官方周度库存序列在完全相同发布日期的实际观察；缺失周不插值，商业原油库存不含战略石油储备。' }; }

function getEconomicCoverage(snapshot: LegacySnapshot) {
  const seriesById = new Map(snapshot.series.map((series) => [series.id, series]));
  const fields = ECONOMIC_FIELD_COVERAGE.map((field) => { const source = field.sourceId ? seriesById.get(field.sourceId) : null; const state: CoverageState = field.state === 'verified_public' && source?.status !== 'available' ? 'source_unavailable' : field.state; return { ...field, state, sourceLabel: source?.sourceLabel ?? null, sourceUrl: source?.sourceUrl ?? null, observationDate: source?.observationDate ?? null, retrievedAt: source?.retrievedAt ?? null, boundary: source?.boundary ?? field.note }; });
  return { asOf: snapshot.asOf, fields, sourceBoundary: '目录按字段说明可核验公开观察与未接入边界。原经济分析工作区保持原样；没有结构化公开读取的字段保留真实空状态，不以历史展示、预测或第三方页面替代。' };
}

const TANKAN_SOURCE_URL = 'https://www.stat-search.boj.or.jp/ssi/mtshtml/co_q_1_en.html';
const TANKAN_COLUMNS = [
  { key: 'largeManufacturing', label: '大企业·制造业' }, { key: 'largeNonmanufacturing', label: '大企业·非制造业' },
  { key: 'mediumManufacturing', label: '中型企业·制造业' }, { key: 'mediumNonmanufacturing', label: '中型企业·非制造业' },
  { key: 'smallManufacturing', label: '小企业·制造业' }, { key: 'smallNonmanufacturing', label: '小企业·非制造业' },
] as const;
type TankanKey = typeof TANKAN_COLUMNS[number]['key'];
type TankanRow = { date: string } & Record<TankanKey, number | null>;
type TankanRawRow = { date: string; actual: Record<TankanKey, number | null>; forecast: Record<TankanKey, number | null> };
function parseBojTankanRawRows(html: string): TankanRawRow[] {
  const actualPositions = [0, 2, 4, 6, 8, 10] as const; const forecastPositions = [1, 3, 5, 7, 9, 11] as const;
  return [...html.matchAll(/<tr[^>]*>\s*<th[^>]*>\s*(20\d{2})\/(\d{2})\s*<\/th>([\s\S]*?)<\/tr>/g)].flatMap((match) => {
    const cells = [...match[3].matchAll(/<td[^>]*>\s*([^<\s]+)\s*<\/td>/g)].map((cell) => Number(cell[1])); if (cells.length < 12) return [];
    const actual = {} as Record<TankanKey, number | null>; const forecast = {} as Record<TankanKey, number | null>;
    TANKAN_COLUMNS.forEach((column, index) => { actual[column.key] = Number.isFinite(cells[actualPositions[index]]) ? cells[actualPositions[index]] : null; forecast[column.key] = Number.isFinite(cells[forecastPositions[index]]) ? cells[forecastPositions[index]] : null; });
    return [{ date: `${match[1]}-${match[2]}-01`, actual, forecast }];
  });
}
export function parseBojTankanHtml(html: string): TankanRow[] {
  return parseBojTankanRawRows(html).map((row) => ({ date: row.date, ...row.actual }));
}
function isAdjacentQuarter(previous: string, current: string) { const date = new Date(`${previous}T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 3); return date.toISOString().slice(0, 7) === current.slice(0, 7); }
export function buildTankanForecastDeviation(rawRows: TankanRawRow[]) { return rawRows.map((current, index) => { const prior = index ? rawRows[index - 1] : null; const paired = prior && isAdjacentQuarter(prior.date, current.date) ? prior : null; return { date: current.date, forecastSurveyDate: paired?.date ?? null, rows: TANKAN_COLUMNS.map((column) => { const actual = current.actual[column.key]; const priorForecast = paired?.forecast[column.key] ?? null; return { key: column.key, label: column.label, actual, priorForecast, deviation: actual !== null && priorForecast !== null ? actual - priorForecast : null }; }) }; }).filter((row) => row.rows.some((item) => item.deviation !== null)); }
async function getTankanIndustryComparison() {
  try {
    const response = await fetch(TANKAN_SOURCE_URL, { signal: AbortSignal.timeout(15_000) }); if (!response.ok) throw new Error(`BOJ_${response.status}`);
    const rows = parseBojTankanHtml(await response.text()); const latest = rows.at(-1) ?? null;
    return { asOf: new Date().toISOString(), status: latest ? 'available' as const : 'unavailable' as const, provider: '日本银行时序统计', sourceUrl: TANKAN_SOURCE_URL, unit: '扩散指数百分点', latest, history: rows.slice(-24), columns: TANKAN_COLUMNS, sourceBoundary: latest ? '仅显示 BOJ TANKAN 商业状况调查的 Actual result 实际值。Forecast 预测列不计入横向比较，不混入实际值，也不作经济或市场推断。' : '当前无法读取 BOJ TANKAN 官方实际值；终端不以预测值、静态样本或第三方转述替代。' };
  } catch { return { asOf: new Date().toISOString(), status: 'unavailable' as const, provider: '日本银行时序统计', sourceUrl: TANKAN_SOURCE_URL, unit: '扩散指数百分点', latest: null, history: [], columns: TANKAN_COLUMNS, sourceBoundary: '当前无法读取 BOJ TANKAN 官方实际值；终端不以预测值、静态样本或第三方转述替代。' }; }
}
function isoWeekKey(date: string) { const point = new Date(`${date}T00:00:00Z`); const day = point.getUTCDay() || 7; point.setUTCDate(point.getUTCDate() + 4 - day); const year = point.getUTCFullYear(); const start = new Date(Date.UTC(year, 0, 1)); const week = Math.ceil((((point.getTime() - start.getTime()) / 86_400_000) + 1) / 7); return { year, week }; }
async function getTankanForecastDeviation() {
  try {
    const response = await fetch(TANKAN_SOURCE_URL, { signal: AbortSignal.timeout(15_000) }); if (!response.ok) throw new Error(`BOJ_${response.status}`);
    const rows = buildTankanForecastDeviation(parseBojTankanRawRows(await response.text())); const latest = rows.at(-1) ?? null;
    return { asOf: new Date().toISOString(), status: latest ? 'available' as const : 'unavailable' as const, provider: '日本银行时序统计', sourceUrl: TANKAN_SOURCE_URL, unit: '扩散指数百分点', latest, history: rows.slice(-24), sourceBoundary: latest ? '当前季度 Actual result 仅与紧邻上一季度、同企业规模和同产业口径的官方 Forecast 相比。无前序预测、非相邻季度或缺失值均保持空，不使用下一期预测、模型预期或第三方调查替代。' : '当前无法建立 BOJ TANKAN 实际与上期预测配对；终端不构造偏差。' };
  } catch { return { asOf: new Date().toISOString(), status: 'unavailable' as const, provider: '日本银行时序统计', sourceUrl: TANKAN_SOURCE_URL, unit: '扩散指数百分点', latest: null, history: [], sourceBoundary: '当前无法读取 BOJ TANKAN 官方列；终端不构造预测偏差。' }; }
}
export function inventorySeasonality(snapshot: LegacySnapshot) {
  const compared = alignedInventoryComparison(snapshot); if (compared.status !== 'available') return { ...compared, rows: [] };
  const allDates = ['WCESTUS1', 'WGTSTUS1', 'WDISTUS1'].map((id) => snapshot.series.find((item) => item.id === id)!.history);
  const shared = new Map<string, { crude: number; gasoline: number; distillate: number }>();
  const maps = allDates.map((history) => new Map(history.map((point) => [point.date, point.value]))); const dates = [...maps[0].keys()].filter((date) => maps.every((map) => map.has(date))).sort();
  dates.forEach((date) => shared.set(date, { crude: maps[0].get(date)!, gasoline: maps[1].get(date)!, distillate: maps[2].get(date)! }));
  const byIsoWeek = new Map<string, { crude: number; gasoline: number; distillate: number }>();
  dates.forEach((date) => { const key = isoWeekKey(date); byIsoWeek.set(`${key.year}-${key.week}`, shared.get(date)!); });
  const rows = dates.slice(-104).map((date) => { const value = shared.get(date)!; const key = isoWeekKey(date); const prior = byIsoWeek.get(`${key.year - 1}-${key.week}`) ?? null; return { date, isoWeek: key.week, crude: value.crude, gasoline: value.gasoline, distillate: value.distillate, crudePriorYear: prior?.crude ?? null, gasolinePriorYear: prior?.gasoline ?? null, distillatePriorYear: prior?.distillate ?? null, crudeYoy: prior ? value.crude - prior.crude : null, gasolineYoy: prior ? value.gasoline - prior.gasoline : null, distillateYoy: prior ? value.distillate - prior.distillate : null }; });
  return { asOf: snapshot.asOf, status: rows.some((row) => row.crudeYoy !== null || row.gasolineYoy !== null || row.distillateYoy !== null) ? 'available' as const : 'unavailable' as const, rows, sourceBoundary: '同比仅比较当前实际 EIA 发布周与上一年相同 ISO 周的另一条实际观察；没有匹配周即保留空值，不插值、不以相邻周替代，也不将变化归因为季节性。' };
}

const PADD_REGIONS = [{ id: 'PADD1', label: 'PADD 1 东海岸' }, { id: 'PADD2', label: 'PADD 2 中西部' }, { id: 'PADD3', label: 'PADD 3 墨西哥湾沿岸' }, { id: 'PADD4', label: 'PADD 4 落基山' }, { id: 'PADD5', label: 'PADD 5 西海岸' }] as const;
type PaddRegionId = typeof PADD_REGIONS[number]['id'];
const REGIONAL_INVENTORY_CODES: Record<string, Record<PaddRegionId, string>> = {
  WCESTUS1: { PADD1: 'WCESTP11', PADD2: 'WCESTP21', PADD3: 'WCESTP31', PADD4: 'WCESTP41', PADD5: 'WCESTP51' },
  WGTSTUS1: { PADD1: 'WGTSTP11', PADD2: 'WGTSTP21', PADD3: 'WGTSTP31', PADD4: 'WGTSTP41', PADD5: 'WGTSTP51' },
  WDISTUS1: { PADD1: 'WDISTP11', PADD2: 'WDISTP21', PADD3: 'WDISTP31', PADD4: 'WDISTP41', PADD5: 'WDISTP51' },
};
type RegionalInventoryRow = { id: PaddRegionId; label: string; observationDate: string | null; value: number | null; status: 'available' | 'unavailable' };
export function calculateRegionalPaddConcentration(regions: RegionalInventoryRow[]) {
  const available = regions.filter((region) => region.status === 'available' && region.observationDate && typeof region.value === 'number' && region.value >= 0); const dates = new Set(available.map((region) => region.observationDate));
  if (available.length !== PADD_REGIONS.length || dates.size !== 1) return { status: 'unavailable' as const, observationDate: null, totalKbbL: null, leadingRegionId: null, leadingSharePct: null, concentrationIndex: null, concentrationBand: null, regions: [], sourceBoundary: '跨 PADD 占比只在五个地区均有相同实际发布日期且数值可读时计算；缺一地区、日期不一致或总量无效时不补齐或重分配。' };
  const totalKbbL = available.reduce((sum, region) => sum + (region.value ?? 0), 0); if (totalKbbL <= 0) return { status: 'unavailable' as const, observationDate: null, totalKbbL: null, leadingRegionId: null, leadingSharePct: null, concentrationIndex: null, concentrationBand: null, regions: [], sourceBoundary: '跨 PADD 占比只在地区实际库存合计为正时计算；不以零值或代理权重替代。' };
  const shares = available.map((region) => ({ id: region.id, label: region.label, valueKbbL: region.value!, sharePct: Number(((region.value! / totalKbbL) * 100).toFixed(2)) })).sort((left, right) => right.sharePct - left.sharePct); const concentrationIndex = Number(shares.reduce((sum, region) => sum + region.sharePct * region.sharePct, 0).toFixed(0)); const leading = shares[0]!;
  return { status: 'available' as const, observationDate: [...dates][0]!, totalKbbL, leadingRegionId: leading.id, leadingSharePct: leading.sharePct, concentrationIndex, concentrationBand: concentrationIndex >= 2500 ? '高' : concentrationIndex >= 1500 ? '中' : '低', regions: shares, sourceBoundary: '占比和集中度仅由同一 EIA 实际发布日期的五个 PADD 产品库存计算，反映地区库存分布，不代表产能、消费、物流、供应或市场因果。' };
}
async function getRegionalProductInventory(productId: string, requestedRegions: PaddRegionId[]) {
  const selected = requestedRegions.length ? PADD_REGIONS.filter((region) => requestedRegions.includes(region.id)) : PADD_REGIONS; const codes = REGIONAL_INVENTORY_CODES[productId];
  if (!codes) return { asOf: new Date().toISOString(), status: 'unavailable' as const, productId, regions: [], sourceBoundary: '未识别的 EIA 产品库存；终端不以其他产品或地区数据替代。' };
  const allRegions = await Promise.all(PADD_REGIONS.map(async (region) => { const sourceId = codes[region.id]; const sourceUrl = `https://www.eia.gov/dnav/pet/hist_xls/${sourceId}w.xls`; try { const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) }); if (!response.ok) throw new Error(`EIA_${response.status}`); const history = parseLegacyEiaWorkbook(await response.arrayBuffer()); const latest = history.at(-1) ?? null; const prior = history.at(-2) ?? null; const priorDate = latest ? new Date(new Date(`${latest.date}T00:00:00Z`).getTime() - 364 * 86_400_000).toISOString().slice(0, 10) : null; const priorYear = priorDate ? history.find((point) => point.date === priorDate) ?? null : null; return { ...region, sourceId, sourceUrl, status: latest ? 'available' as const : 'unavailable' as const, observationDate: latest?.date ?? null, value: latest?.value ?? null, weekOverWeek: latest && prior ? latest.value - prior.value : null, yearOverYear: latest && priorYear ? latest.value - priorYear.value : null, history: history.slice(-104) }; } catch { return { ...region, sourceId, sourceUrl, status: 'unavailable' as const, observationDate: null, value: null, weekOverWeek: null, yearOverYear: null, history: [] }; } }));
  const regions = allRegions.filter((region) => selected.some((selectedRegion) => selectedRegion.id === region.id)); const concentration = calculateRegionalPaddConcentration(allRegions);
  return { asOf: new Date().toISOString(), status: regions.some((region) => region.status === 'available') ? 'available' as const : 'unavailable' as const, productId, regions, concentration, sourceBoundary: '仅展示 EIA 产品库存的 PADD 地区实际周度观察。地区同比只在 52 周前同一实际发布日期存在时计算；缺失时为空，不插值或以其他地区替代。' };
}

export const legacyMarketDataRouter = router({
  getTaylorInternationalRates: publicProcedure.query(async()=>{
    const definitions=LEGACY_PUBLIC_SERIES.filter(s=>['FEDFUNDS','ECBDFR','BOE_BANK_RATE'].includes(s.id));
    const series=await Promise.all(definitions.map(fetchLegacySeries));
    return {retrievedAt:new Date().toISOString(),rows:series.map(s=>({country:s.id==='FEDFUNDS'?'美国':s.id==='ECBDFR'?'欧元区':'英国',label:s.label,history:s.history,value:s.value,date:s.observationDate,status:s.status,unit:s.unit}))};
  }),
  getWorldBankPanel: publicProcedure.input(z.object({group:z.enum(['ectr','wfii']),refresh:z.boolean().optional()})).query(async({input})=>(await import('../worldBankObservationService')).getWorldBankPanel(input.group,input.refresh)),
  getEctrShipping: publicProcedure.input(z.object({ refresh: z.boolean().optional() }).default({})).query(({ input }) => getEctrShippingSnapshot(input.refresh === true)),
  getEctrTradePartners: publicProcedure.input(z.object({ refresh: z.boolean().optional() }).default({})).query(({ input }) => getEctrTradePartnersSnapshot(input.refresh === true)),
  getEctrSectorFlows: publicProcedure.input(z.object({ refresh: z.boolean().optional() }).default({})).query(({ input }) => getEctrSectorFlowsSnapshot(input.refresh === true)),
  getEconomicObservations: publicProcedure.input(z.object({ group: z.enum(['fcon', 'fcon-market', 'ecsu', 'fdsp', 'cbrt', 'tayl', 'wfii-fx', 'wfii-stress']), refresh: z.boolean().optional() })).query(({ input }) => getEconomicObservations(input.group, input.refresh === true)),
  getFedFinancialStatements: publicProcedure.query(getFedFinancialStatements),
  getSnapshot: publicProcedure.query(getLegacyMarketSnapshot),
  getStructuredSourceExcerpt: publicProcedure.input(z.object({ sourceId: z.enum(LEGACY_SOURCE_IDS) })).query(async ({ input }) => { const snapshot = await getLegacyMarketSnapshot(); const series = snapshot.series.find((item) => item.id === input.sourceId); return series ? sourceExcerpt(series) : null; }),
  getFieldCoverage: publicProcedure.query(async () => getCoverage(await getLegacyMarketSnapshot())),
  getEconomicFieldCoverage: publicProcedure.query(async () => getEconomicCoverage(await getLegacyMarketSnapshot())),
  getEconomicCalendarOfficialObservations: publicProcedure.query(getEconomicCalendarOfficialObservations),
  listEconomicCalendarAnomalyRules: protectedProcedure.query(({ ctx }) => listEconomicCalendarAnomalyRules(ctx.user.id)),
  listEconomicCalendarAnomalyEvents: protectedProcedure.input(z.object({ seriesId: z.enum(OFFICIAL_ECONOMIC_SERIES_IDS).optional() }).default({})).query(({ ctx, input }) => listEconomicCalendarAnomalyEvents(ctx.user.id, input.seriesId)),
  saveEconomicCalendarAnomalyRule: protectedProcedure.input(z.object({ seriesId: z.enum(OFFICIAL_ECONOMIC_SERIES_IDS), threshold: z.number().positive().max(1_000_000_000), isActive: z.boolean().default(true) })).mutation(({ ctx, input }) => saveEconomicCalendarAnomalyRule(ctx.user.id, input)),
  deleteEconomicCalendarAnomalyRule: protectedProcedure.input(z.object({ seriesId: z.enum(OFFICIAL_ECONOMIC_SERIES_IDS) })).mutation(({ ctx, input }) => deleteEconomicCalendarAnomalyRule(ctx.user.id, input.seriesId)),
  checkEconomicCalendarAnomalyAlerts: protectedProcedure.mutation(async () => { const snapshot = await getEconomicCalendarOfficialObservations(); const emitted = await processEconomicCalendarAnomalyAlerts(snapshot.observations); emitted.forEach((notification) => pushNotificationToUser(notification.userId, notification)); return { emitted: emitted.length, asOf: snapshot.asOf, sourceBoundary: snapshot.sourceBoundary }; }),
  listEconomicCalendarRegionPresets: protectedProcedure.query(({ ctx }) => listEconomicCalendarRegionPresets(ctx.user.id)),
  saveEconomicCalendarRegionPreset: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(80), region: z.enum(ECONOMIC_CALENDAR_REGIONS) })).mutation(({ ctx, input }) => saveEconomicCalendarRegionPreset(ctx.user.id, input)),
  deleteEconomicCalendarRegionPreset: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteEconomicCalendarRegionPreset(ctx.user.id, input.id)),
  listEconomicTrendWindowPresets: protectedProcedure.input(z.object({ sort: z.enum(['updated', 'last_used']).default('updated') }).default({ sort: 'updated' })).query(({ ctx, input }) => listEconomicTrendWindowPresets(ctx.user.id, input.sort)),
  saveEconomicTrendWindowPreset: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(80), region: z.enum(ECONOMIC_TREND_WINDOW_REGIONS), topic: z.enum(ECONOMIC_TREND_WINDOW_TOPICS).default('all'), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).mutation(({ ctx, input }) => saveEconomicTrendWindowPreset(ctx.user.id, input)),
  deleteEconomicTrendWindowPreset: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteEconomicTrendWindowPreset(ctx.user.id, input.id)),
  markEconomicTrendWindowPresetUsed: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => markEconomicTrendWindowPresetUsed(ctx.user.id, input.id)),
  deleteInactiveEconomicTrendWindowPresets: protectedProcedure.input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100), inactiveDays: z.number().int().min(1).max(3650) })).mutation(({ ctx, input }) => deleteInactiveEconomicTrendWindowPresets(ctx.user.id, input)),
  listLegacyFieldAccess: protectedProcedure.query(({ ctx }) => listLegacyFieldAccess(ctx.user.id)),
  requestLegacyFieldAccess: protectedProcedure.input(z.object({ sourceId: z.enum(LEGACY_FIELD_ACCESS_SOURCE_IDS), reason: z.string().trim().max(500).optional() })).mutation(({ ctx, input }) => requestLegacyFieldAccess(ctx.user.id, input)),
  listLegacyFieldAccessRequests: protectedProcedure.query(({ ctx }) => { if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可查看遗留字段授权队列。' }); return listLegacyFieldAccessRequests(); }),
  decideLegacyFieldAccess: protectedProcedure.input(z.object({ grantId: z.number().int().positive(), status: z.enum(['authorized', 'denied']) })).mutation(({ ctx, input }) => { if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可处理遗留字段授权。' }); return decideLegacyFieldAccess(ctx.user.id, input); }),
  listLegacyFieldAccessAudit: protectedProcedure.input(z.object({ sourceId: z.enum(LEGACY_FIELD_ACCESS_SOURCE_IDS).optional(), action: z.enum(['requested', 'authorized', 'denied']).optional(), subjectUserId: z.number().int().positive().optional(), startAt: z.date().optional(), endAt: z.date().optional() }).default({})).query(({ ctx, input }) => { if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可读取字段授权审计日志。' }); return listLegacyFieldAccessAudit(input); }),
  getResearchPathAccess: protectedProcedure.query(({ ctx }) => getResearchPathAccess(ctx.user.id)),
  toggleResearchPathFavorite: protectedProcedure.input(z.object({ pathId: z.enum(RESEARCH_PATH_IDS) })).mutation(({ ctx, input }) => toggleResearchPathFavorite(ctx.user.id, input.pathId)),
  listResearchPathMembers: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default(''), limit: z.number().int().min(1).max(30).default(12) })).query(({ ctx, input }) => listResearchPathMembers(ctx.user.id, input.query, input.limit)),
  listResearchPathShares: protectedProcedure.input(z.object({ pathId: z.enum(RESEARCH_PATH_IDS) })).query(({ ctx, input }) => listResearchPathShares(ctx.user.id, input.pathId)),
  shareResearchPath: protectedProcedure.input(z.object({ pathId: z.enum(RESEARCH_PATH_IDS), sharedWithUserId: z.number().int().positive() })).mutation(({ ctx, input }) => shareResearchPath(ctx.user.id, input)),
  revokeResearchPathShare: protectedProcedure.input(z.object({ pathId: z.enum(RESEARCH_PATH_IDS), sharedWithUserId: z.number().int().positive() })).mutation(({ ctx, input }) => revokeResearchPathShare(ctx.user.id, input)),
  listResearchPathNotes: protectedProcedure.input(z.object({ pathId: z.enum(RESEARCH_PATH_IDS), ownerUserId: z.number().int().positive() })).query(({ ctx, input }) => listResearchPathNotes(ctx.user.id, input)),
  createResearchPathNote: protectedProcedure.input(z.object({ pathId: z.enum(RESEARCH_PATH_IDS), ownerUserId: z.number().int().positive(), body: z.string().trim().min(1).max(2000) })).mutation(({ ctx, input }) => createResearchPathNote(ctx.user.id, input)),
  reviewResearchPathNote: protectedProcedure.input(z.object({ noteId: z.number().int().positive(), status: z.enum(['confirmed', 'changes_requested']), reviewNote: z.string().trim().max(1000).optional() })).mutation(({ ctx, input }) => reviewResearchPathNote(ctx.user.id, input)),
  getInventoryComparison: publicProcedure.query(async () => alignedInventoryComparison(await getLegacyMarketSnapshot())),
  getTankanIndustryComparison: publicProcedure.query(getTankanIndustryComparison),
  getTankanForecastDeviation: publicProcedure.query(getTankanForecastDeviation),
  getInventorySeasonality: publicProcedure.query(async () => inventorySeasonality(await getLegacyMarketSnapshot())),
  getRegionalProductInventory: publicProcedure.input(z.object({ productId: z.enum(INVENTORY_SEASONALITY_PRODUCTS), regions: z.array(z.enum(['PADD1', 'PADD2', 'PADD3', 'PADD4', 'PADD5'])).max(5).default([]) })).query(({ input }) => getRegionalProductInventory(input.productId, input.regions)),
  listInventorySeasonalityAlertRules: protectedProcedure.query(({ ctx }) => listInventorySeasonalityAlertRules(ctx.user.id)),
  listInventorySeasonalityAlertEvents: protectedProcedure.input(z.object({ productId: z.enum(INVENTORY_SEASONALITY_PRODUCTS).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), deliveryStatus: z.enum(['all', 'read', 'unread', 'unlinked']).default('all') })).query(({ ctx, input }) => listInventorySeasonalityAlertEvents(ctx.user.id, input)),
  saveInventorySeasonalityAlertRule: protectedProcedure.input(z.object({ productId: z.enum(INVENTORY_SEASONALITY_PRODUCTS), thresholdKbbL: z.number().min(0).max(5_000_000), isActive: z.boolean().default(true) })).mutation(({ ctx, input }) => saveInventorySeasonalityAlertRule(ctx.user.id, input)),
  deleteInventorySeasonalityAlertRule: protectedProcedure.input(z.object({ productId: z.enum(INVENTORY_SEASONALITY_PRODUCTS) })).mutation(({ ctx, input }) => deleteInventorySeasonalityAlertRule(ctx.user.id, input.productId)),
  checkInventorySeasonalityAlerts: protectedProcedure.mutation(async () => { const seasonal = inventorySeasonality(await getLegacyMarketSnapshot()); const emitted = seasonal.status === 'available' ? await processInventorySeasonalityAlerts(seasonal.rows) : []; emitted.forEach((notification) => pushNotificationToUser(notification.userId, notification)); return { emitted: emitted.length, asOf: seasonal.asOf, status: seasonal.status, sourceBoundary: seasonal.sourceBoundary }; }),
  checkLegacyFreshnessAlerts: protectedProcedure.mutation(async () => { const snapshot = await getLegacyMarketSnapshot(); const scope = new Set<string>(LEGACY_SOURCE_IDS.filter((id) => (SOURCE_FRESHNESS_SERIES_IDS as readonly string[]).includes(id))); const emitted = await processSourceFreshnessNotifications(snapshot.series, new Date(), scope); emitted.forEach((notification) => pushNotificationToUser(notification.userId, notification)); return { emitted: emitted.length, asOf: snapshot.asOf, scope: [...scope] }; }),
});

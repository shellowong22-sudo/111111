import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { deleteCreditOasThresholdRule, getCreditEvidencePermission, listChecklistMemberDirectory, listCreditEvidenceAuditEvents, listCreditEvidenceLogs, listCreditEvidenceShares, listCreditOasThresholdRules, processCreditOasThresholdNotifications, revokeCreditEvidenceShare, saveCreditEvidenceLog, saveCreditEvidenceShare, upsertCreditOasThresholdRule } from '../db';
import { pushNotificationToUser } from '../uploadAndSse';
import { fetchNasdaqHistorical, fetchYahooChart } from '../realDataService';

const FRED_CREDIT_SERIES = [
  { id: 'BAMLC0A0CM', label: '美国投资级综合 OAS', bucket: 'IG', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLC0A0CM' },
  { id: 'BAMLC0A1CAAA', label: 'AAA 级美国公司债 OAS', bucket: 'AAA', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLC0A1CAAA' },
  { id: 'BAMLC0A2CAA', label: 'AA 级美国公司债 OAS', bucket: 'AA', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLC0A2CAA' },
  { id: 'BAMLC0A4CBBB', label: 'BBB 级美国公司债 OAS', bucket: 'BBB', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLC0A4CBBB' },
  { id: 'BAMLH0A0HYM2', label: '美国高收益综合 OAS', bucket: 'HY', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2' },
] as const;

const GLOBAL_BOND_ETF_PROXIES = [
  { symbol: 'BNDW', name: 'Vanguard Total World Bond ETF', region: '全球', scope: '全球投资级综合' },
  { symbol: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF', region: '美国', scope: '美国投资级综合' },
  { symbol: 'IAGG', name: 'iShares Core International Aggregate Bond ETF', region: '美国以外', scope: '国际投资级综合' },
  { symbol: 'LQD', name: 'iShares iBoxx $ Investment Grade Corporate Bond ETF', region: '美国', scope: '投资级公司债' },
  { symbol: 'HYG', name: 'iShares iBoxx $ High Yield Corporate Bond ETF', region: '美国', scope: '高收益公司债' },
  { symbol: 'EMB', name: 'iShares J.P. Morgan USD Emerging Markets Bond ETF', region: '新兴市场', scope: '美元主权及准主权债' },
] as const;

const oasSeriesId = z.enum(['BAMLC0A0CM', 'BAMLC0A1CAAA', 'BAMLC0A2CAA', 'BAMLC0A4CBBB', 'BAMLH0A0HYM2']);
const evidenceInput = z.object({
  evidenceId: z.number().int().positive().optional(),
  ticker: z.string().trim().min(1).max(10),
  issuer: z.string().trim().max(255).nullable().optional(),
  form: z.string().trim().max(16).nullable().optional(),
  filingDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sourceUrl: z.string().url().max(2_000).refine((value) => { try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'www.sec.gov' && url.pathname.startsWith('/Archives/edgar/'); } catch { return false; } }, '仅支持 SEC EDGAR Archives 原始文件链接。'),
  quotedText: z.string().trim().min(2).max(12_000),
  annotation: z.string().trim().min(2).max(6_000),
  highlightColor: z.enum(['amber', 'cyan', 'rose', 'emerald']),
});

export type CreditOasObservation = {
  id: string; label: string; bucket: 'IG' | 'AAA' | 'AA' | 'BBB' | 'HY'; observationDate: string | null; valuePct: number | null; valueBps: number | null; changeBps: number | null; history: Array<{ date: string; valuePct: number }>; sourceUrl: string; status: 'available' | 'unavailable'; limitation: string;
};

export function parseFredCreditOasCsv(csv: string, definition: typeof FRED_CREDIT_SERIES[number]): CreditOasObservation {
  const points = csv.split(/\r?\n/).slice(1).flatMap((line) => {
    const [date, value] = line.split(','); const parsed = Number(value);
    return date && value && value !== '.' && Number.isFinite(parsed) ? [{ date: date.trim(), valuePct: parsed }] : [];
  });
  const latest = points.at(-1) ?? null; const previous = points.at(-2) ?? null;
  return { id: definition.id, label: definition.label, bucket: definition.bucket, observationDate: latest?.date ?? null, valuePct: latest?.valuePct ?? null, valueBps: latest ? Number((latest.valuePct * 100).toFixed(1)) : null, changeBps: latest && previous ? Number(((latest.valuePct - previous.valuePct) * 100).toFixed(1)) : null, history: points.slice(-90), sourceUrl: definition.sourceUrl, status: latest ? 'available' : 'unavailable', limitation: 'ICE BofA 指数级日度 OAS；不是单券报价、可成交价差或 CDS 点位。' };
}

async function fetchFredCreditOas(definition: typeof FRED_CREDIT_SERIES[number]): Promise<CreditOasObservation> {
  try { const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}`, { signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error(`FRED ${response.status}`); return parseFredCreditOasCsv(await response.text(), definition); }
  catch { return { id: definition.id, label: definition.label, bucket: definition.bucket, observationDate: null, valuePct: null, valueBps: null, changeBps: null, history: [], sourceUrl: definition.sourceUrl, status: 'unavailable', limitation: '当前无法读取 FRED/ICE BofA 指数级 OAS；系统不以缓存样本、随机路径或代理值替代。' }; }
}

type CreditOasSnapshot = { asOf: string; series: CreditOasObservation[]; sourceLabel: string };
let cachedCreditOasSnapshot: CreditOasSnapshot | null = null;
let cachedCreditOasSnapshotAt = 0;
let activeCreditOasSnapshot: Promise<CreditOasSnapshot> | null = null;
const CREDIT_OAS_CACHE_MS = 30_000;

type SecTickerRow = { cik_str?: number; ticker?: string; title?: string };
type SecSubmissions = { name?: string; filings?: { recent?: { form?: string[]; filingDate?: string[]; accessionNumber?: string[]; primaryDocument?: string[]; primaryDocDescription?: string[] } } };
type SecFactUnit = { end?: string; val?: number; filed?: string; form?: string; fp?: string };
type SecCompanyFacts = { entityName?: string; facts?: { 'us-gaap'?: Record<string, { label?: string; units?: Record<string, SecFactUnit[]> }> } };
async function fetchSecJson<T>(url: string): Promise<T> { const response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Finance-Hub credit research contact@finance-hub.local', Accept: 'application/json' } }); if (!response.ok) throw new Error(`SEC ${response.status}`); return response.json() as Promise<T>; }
async function findSecEntity(ticker: string) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const tickerIndex = await fetchSecJson<Record<string, SecTickerRow>>('https://www.sec.gov/files/company_tickers.json');
  const entity = Object.values(tickerIndex).find((item) => item.ticker?.toUpperCase() === normalizedTicker);
  return entity?.cik_str ? { normalizedTicker, entity, cik: String(entity.cik_str).padStart(10, '0') } : null;
}
async function getIssuerFilings(ticker: string) {
  const normalizedTicker = ticker.trim().toUpperCase();
  try {
    const match = await findSecEntity(normalizedTicker);
    if (!match) return { available: false as const, ticker: normalizedTicker, issuer: null, cik: null, filings: [], limitation: 'SEC ticker 目录未找到该发行人；请使用美国公开发行人的交易代码。' };
    const { entity, cik } = match; const submissions = await fetchSecJson<SecSubmissions>(`https://data.sec.gov/submissions/CIK${cik}.json`); const recent = submissions.filings?.recent;
    const filings = (recent?.form ?? []).flatMap((form, index) => { if (!['10-K', '10-Q', '8-K', '20-F', '40-F', '6-K'].includes(form)) return []; const accession = recent?.accessionNumber?.[index]; const document = recent?.primaryDocument?.[index]; if (!accession || !document) return []; return [{ form, filingDate: recent?.filingDate?.[index] ?? null, description: recent?.primaryDocDescription?.[index] ?? null, sourceUrl: `https://www.sec.gov/Archives/edgar/data/${entity.cik_str}/${accession.replaceAll('-', '')}/${document}` }]; }).slice(0, 8);
    return { available: true as const, ticker: normalizedTicker, issuer: submissions.name ?? entity.title ?? normalizedTicker, cik, filings, limitation: 'SEC EDGAR 公开披露导航；文件不等同于单券条款或二级市场报价。' };
  } catch { return { available: false as const, ticker: normalizedTicker, issuer: null, cik: null, filings: [], limitation: '当前无法读取 SEC EDGAR；系统不以静态报告、假定条款或样本文件替代。' }; }
}

const issuerFactsCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof fetchIssuerFinancialFacts>> }>();
const BALANCE_TAGS = {
  assets: ['Assets'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  currentDebt: ['ShortTermBorrowings', 'ShortTermDebtCurrent', 'LongTermDebtCurrent'],
  noncurrentDebt: ['LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'],
} as const;
const FLOW_TAGS = {
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  interestExpense: ['InterestExpenseNonOperating', 'InterestExpenseDebt'],
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
} as const;

function annualUsdRows(facts: SecCompanyFacts, tags: readonly string[]) {
  const usGaap = facts.facts?.['us-gaap'] ?? {};
  for (const tag of tags) {
    const rows = usGaap[tag]?.units?.USD ?? [];
    const annual = rows.filter((row) => row.form === '10-K' && row.end && Number.isFinite(row.val));
    if (!annual.length) continue;
    const byEnd = new Map<string, SecFactUnit>();
    annual.forEach((row) => {
      const current = byEnd.get(row.end!);
      if (!current || String(row.filed ?? '') > String(current.filed ?? '')) byEnd.set(row.end!, row);
    });
    return [...byEnd.values()].sort((a, b) => String(a.end).localeCompare(String(b.end)));
  }
  return [];
}

function valueForEnd(facts: SecCompanyFacts, tags: readonly string[], end: string) {
  const row = annualUsdRows(facts, tags).find((item) => item.end === end);
  return Number.isFinite(row?.val) ? Number(row?.val) : null;
}

async function fetchIssuerFinancialFacts(ticker: string) {
  const normalizedTicker = ticker.trim().toUpperCase();
  try {
    const match = await findSecEntity(normalizedTicker);
    if (!match) return { available: false as const, ticker: normalizedTicker, issuer: null, cik: null, periods: [], fetchedAt: new Date().toISOString(), sourceUrl: null, limitation: 'SEC ticker 目录未找到该发行人；请使用美国公开发行人的交易代码。' };
    const sourceUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${match.cik}.json`;
    const facts = await fetchSecJson<SecCompanyFacts>(sourceUrl);
    const ends = annualUsdRows(facts, BALANCE_TAGS.assets).map((row) => row.end!).slice(-6);
    const periods = ends.map((end) => {
      const currentDebt = valueForEnd(facts, BALANCE_TAGS.currentDebt, end) ?? 0;
      const noncurrentDebt = valueForEnd(facts, BALANCE_TAGS.noncurrentDebt, end) ?? 0;
      const debt = currentDebt || noncurrentDebt ? currentDebt + noncurrentDebt : null;
      const assets = valueForEnd(facts, BALANCE_TAGS.assets, end);
      const cash = valueForEnd(facts, BALANCE_TAGS.cash, end);
      const operatingCashFlow = valueForEnd(facts, FLOW_TAGS.operatingCashFlow, end);
      const interestExpense = valueForEnd(facts, FLOW_TAGS.interestExpense, end);
      const revenue = valueForEnd(facts, FLOW_TAGS.revenue, end);
      return {
        period: end,
        assets,
        cash,
        debt,
        operatingCashFlow,
        interestExpense,
        revenue,
        debtToAssetsPct: debt !== null && assets ? debt / assets * 100 : null,
        cashToDebtPct: cash !== null && debt ? cash / debt * 100 : null,
        operatingCashFlowToDebtPct: operatingCashFlow !== null && debt ? operatingCashFlow / debt * 100 : null,
        interestBurdenPct: interestExpense !== null && revenue ? interestExpense / revenue * 100 : null,
      };
    }).filter((row) => [row.assets, row.cash, row.debt, row.operatingCashFlow, row.interestExpense, row.revenue].some((value) => value !== null));
    return {
      available: periods.length > 0,
      ticker: normalizedTicker,
      issuer: facts.entityName ?? match.entity.title ?? normalizedTicker,
      cik: match.cik,
      periods,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      limitation: periods.length ? 'SEC XBRL 公司事实年度口径；字段取决于发行人实际申报标签，不能替代单券契约、评级、估值或市场报价。' : 'SEC 公司事实没有返回可比年度字段；系统不以静态财务样本填补。',
    };
  } catch {
    return { available: false as const, ticker: normalizedTicker, issuer: null, cik: null, periods: [], fetchedAt: new Date().toISOString(), sourceUrl: null, limitation: '当前无法读取 SEC 公司事实；系统不以假设财务指标替代。' };
  }
}

async function getIssuerFinancialFacts(ticker: string) {
  const key = ticker.trim().toUpperCase(); const now = Date.now(); const cached = issuerFactsCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  const value = await fetchIssuerFinancialFacts(key);
  issuerFactsCache.set(key, { expiresAt: now + 5 * 60_000, value });
  return value;
}

function mapCreditError(error: unknown) {
  if (!(error instanceof Error)) throw error;
  if (error.message.startsWith('FORBIDDEN_CREDIT_EVIDENCE')) throw new TRPCError({ code: 'FORBIDDEN', message: '您没有访问或编辑该 SEC 证据日志的权限。' });
  if (error.message === 'FORBIDDEN_CREDIT_EVIDENCE_SHARE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅证据日志创建者可管理团队共享。' });
  if (error.message === 'SHARED_USER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到目标团队成员。' });
  if (error.message === 'CANNOT_SHARE_CREDIT_EVIDENCE_WITH_OWNER') throw new TRPCError({ code: 'BAD_REQUEST', message: '创建者已拥有完整权限，无需重复共享。' });
  if (error.message === 'CREDIT_EVIDENCE_SHARE_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到该成员的有效证据共享记录。' });
  if (error.message === 'CREDIT_EVIDENCE_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: 'SEC 证据日志不存在。' });
  throw error;
}

export async function getCreditOasSnapshot(): Promise<CreditOasSnapshot> {
  const now = Date.now();
  if (cachedCreditOasSnapshot && now - cachedCreditOasSnapshotAt < CREDIT_OAS_CACHE_MS) return cachedCreditOasSnapshot;
  if (activeCreditOasSnapshot) return activeCreditOasSnapshot;
  activeCreditOasSnapshot = Promise.all(FRED_CREDIT_SERIES.map(fetchFredCreditOas)).then((series) => {
    const snapshot = { asOf: new Date().toISOString(), series, sourceLabel: 'FRED / ICE BofA Indices' };
    cachedCreditOasSnapshot = snapshot;
    cachedCreditOasSnapshotAt = Date.now();
    return snapshot;
  }).finally(() => { activeCreditOasSnapshot = null; });
  return activeCreditOasSnapshot;
}

async function getGlobalBondEtfSnapshot() {
  const queriedAt = new Date().toISOString();
  const items = await Promise.all(GLOBAL_BOND_ETF_PROXIES.map(async (definition) => {
    const chart = await fetchYahooChart(definition.symbol, '3mo', '1d')
      ?? await fetchNasdaqHistorical(definition.symbol, '3mo', 'etf');
    if (!chart || chart.history.length === 0) {
      return {
        ...definition,
        available: false as const,
        price: null,
        changePct: null,
        currency: null,
        observedAt: null,
        history: [] as Array<{ date: string; close: number; normalizedReturnPct: number }>,
        source: null,
        limitation: '当前公开行情源没有返回可核验的价格历史；系统不会生成补位路径。',
      };
    }
    const usable = chart.history.filter((point) => point.close !== null && Number.isFinite(point.close));
    if (usable.length === 0) {
      return {
        ...definition,
        available: false as const,
        price: null,
        changePct: null,
        currency: null,
        observedAt: null,
        history: [] as Array<{ date: string; close: number; normalizedReturnPct: number }>,
        source: null,
        limitation: '公开行情响应没有可核验的收盘价；系统不会生成补位路径。',
      };
    }
    const base = usable[0]?.close ?? null;
    return {
      ...definition,
      available: true as const,
      price: chart.price,
      changePct: chart.changePct,
      currency: chart.currency,
      observedAt: usable.at(-1)?.date ?? null,
      history: usable.map((point) => ({
        date: point.date,
        close: Number(point.close),
        normalizedReturnPct: base ? Number((((Number(point.close) / base) - 1) * 100).toFixed(4)) : 0,
      })),
      source: chart.source,
      limitation: '公开债券 ETF 价格代理；不是 Bloomberg 授权指数、指数成分、单券估值或可执行报价。',
    };
  }));
  return { queriedAt, items, sourceLabel: 'Yahoo Finance / Nasdaq public market data' };
}

export const creditResearchRouter = router({
  getOasSnapshot: publicProcedure.query(getCreditOasSnapshot),
  getGlobalBondEtfSnapshot: publicProcedure.query(getGlobalBondEtfSnapshot),
  getIssuerFilings: publicProcedure.input(z.object({ ticker: z.string().trim().min(1).max(10) })).query(({ input }) => getIssuerFilings(input.ticker)),
  getIssuerFinancialFacts: publicProcedure.input(z.object({ ticker: z.string().trim().min(1).max(10) })).query(({ input }) => getIssuerFinancialFacts(input.ticker)),
  listEvidence: protectedProcedure.input(z.object({ ticker: z.string().trim().max(10).optional(), limit: z.number().int().min(1).max(200).default(80) })).query(({ ctx, input }) => listCreditEvidenceLogs(ctx.user.id, input.ticker, input.limit)),
  saveEvidence: protectedProcedure.input(evidenceInput).mutation(async ({ ctx, input }) => { try { return await saveCreditEvidenceLog(ctx.user.id, input); } catch (error) { return mapCreditError(error); } }),
  listEvidenceShares: protectedProcedure.input(z.object({ evidenceId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await listCreditEvidenceShares(ctx.user.id, input.evidenceId); } catch (error) { return mapCreditError(error); } }),
  shareEvidence: protectedProcedure.input(z.object({ evidenceId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), canEdit: z.boolean() })).mutation(async ({ ctx, input }) => { try { return await saveCreditEvidenceShare(ctx.user.id, input); } catch (error) { return mapCreditError(error); } }),
  revokeEvidenceShare: protectedProcedure.input(z.object({ evidenceId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return await revokeCreditEvidenceShare(ctx.user.id, input.evidenceId, input.sharedWithUserId); } catch (error) { return mapCreditError(error); } }),
  listEvidenceAudit: protectedProcedure.input(z.object({ evidenceId: z.number().int().positive(), limit: z.number().int().min(1).max(200).default(60) })).query(async ({ ctx, input }) => { try { return await listCreditEvidenceAuditEvents(ctx.user.id, input.evidenceId, input.limit); } catch (error) { return mapCreditError(error); } }),
  memberDirectory: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default(''), limit: z.number().int().min(1).max(30).default(12) })).query(({ ctx, input }) => listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)),
  listOasThresholdRules: protectedProcedure.query(({ ctx }) => listCreditOasThresholdRules(ctx.user.id)),
  saveOasThresholdRule: protectedProcedure.input(z.object({ seriesId: oasSeriesId, thresholdBps: z.number().finite().positive().max(10_000), isActive: z.boolean().default(true) })).mutation(({ ctx, input }) => upsertCreditOasThresholdRule({ userId: ctx.user.id, ...input })),
  deleteOasThresholdRule: protectedProcedure.input(z.object({ ruleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return await deleteCreditOasThresholdRule(ctx.user.id, input.ruleId); } catch (error) { if (error instanceof Error && error.message === 'CREDIT_OAS_THRESHOLD_RULE_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: 'OAS 阈值规则不存在或不属于当前账户。' }); throw error; } }),
  evaluateMyOasThresholds: protectedProcedure.mutation(async ({ ctx }) => { const snapshot = await getCreditOasSnapshot(); const emitted = await processCreditOasThresholdNotifications(snapshot.series, ctx.user.id); for (const notification of emitted) pushNotificationToUser(notification.userId, notification); return { evaluatedAt: snapshot.asOf, emitted: emitted.length, unavailableSeries: snapshot.series.filter((series) => series.status === 'unavailable').map((series) => series.id) }; }),
});

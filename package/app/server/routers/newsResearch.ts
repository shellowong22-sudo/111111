import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { getGlobalNewsFeed } from '../globalNewsFeed';
import { getGlobalNewsDocument } from '../globalNewsDocument';
import { getEconomicCalendarOfficialObservations } from '../economicCalendarOfficialData';
import { addNewsEvidenceMember, captureNewsEvidence, deleteNewsSourceFreshnessRule, getNewsEvidenceDetail, getNewsSecFilingExcerpt, getNewsSecFilings, getOfficialNewsFeed, listNewsEvidence, listNewsEvidenceMemberDirectory, listNewsEvidenceMembers, listNewsSourceFreshnessEvents, listNewsSourceFreshnessRules, removeNewsEvidenceMember, reviewNewsEvidence, saveNewsSourceFreshnessRule, submitNewsEvidenceReview, updateNewsEvidence } from '../newsResearchDb';

const sourceKind = z.enum(['sec_press', 'fed_monetary', 'fed_research', 'sec_filing']);
const officialSourceKind = z.enum(['sec_press', 'fed_monetary', 'fed_research']);
const evidenceStatus = z.enum(['captured', 'reading', 'verified', 'closed']);

type BecoPoint = { period: string; value: number | null; unit: string; label: string };
type BecoOfficialObservation = {
  id: string;
  label: string;
  unit: string;
  status: 'available' | 'unavailable';
  history: Array<{ observationDate: string; value: number }>;
};
export type BecoOfficialMacroSnapshot = {
  dataContractId: 'news-beco-official-macro';
  checkedAt: string;
  dataStatus: 'available' | 'unavailable';
  growth: BecoPoint[];
  inflation: BecoPoint[];
  employment: BecoPoint[];
  rates: BecoPoint[];
  cycle: BecoPoint[];
  limitation: string;
};

const BECO_SERIES_BY_SLICE = {
  growth: ['EUROSTAT_GDP_EA20', 'ONS_GDP_MONTHLY_INDEX'],
  inflation: ['BLS_CUUR0000SA0', 'EUROSTAT_HICP_EA20', 'ONS_CPIH_ALL_ITEMS', 'BOJ_CORE_CPI_EX_FRESH_SPECIAL', 'BOJ_CORE_CPI_EX_FRESH_ENERGY_SPECIAL', 'BOJ_CORE_CPI_EX_FOOD_ENERGY_SPECIAL'],
  employment: ['BLS_CES0000000001', 'BLS_LNS14000000', 'BLS_CES0500000003', 'ONS_EMPLOYMENT_16_PLUS', 'ONS_UNEMPLOYMENT_RATE_16_PLUS', 'ONS_AWE_TOTAL_PAY', 'ONS_AWE_REGULAR_PAY'],
  rates: ['BOJ_CALL_RATE'],
  cycle: ['BLS_JTS000000000000000JOL', 'FED_INDPRO', 'EUROSTAT_RETAIL_EA20', 'EUROSTAT_EXPORTS_EU27', 'EUROSTAT_IMPORTS_EU27', 'BOJ_TANKAN_LARGE_MANUFACTURING', 'BOJ_M2_MONEY_STOCK', 'BOJ_M3_MONEY_STOCK'],
} as const;

export function buildBecoOfficialMacroSnapshot(observations: BecoOfficialObservation[], checkedAt: string): BecoOfficialMacroSnapshot {
  const byId = new Map(observations.map(row => [row.id, row]));
  const points = (ids: readonly string[]): BecoPoint[] => {
    const unique = new Map<string, BecoPoint>();
    for (const id of ids) {
      const row = byId.get(id);
      if (!row || row.status !== 'available') continue;
      for (const item of row.history) {
        const point = { period: item.observationDate, value: item.value, unit: row.unit, label: row.label };
        unique.set(`${row.id}\u0000${item.observationDate}`, point);
      }
    }
    return Array.from(unique.values()).sort((left, right) => left.period.localeCompare(right.period) || left.label.localeCompare(right.label));
  };
  const growth = points(BECO_SERIES_BY_SLICE.growth);
  const inflation = points(BECO_SERIES_BY_SLICE.inflation);
  const employment = points(BECO_SERIES_BY_SLICE.employment);
  const rates = points(BECO_SERIES_BY_SLICE.rates);
  const cycle = points(BECO_SERIES_BY_SLICE.cycle);
  const available = [growth, inflation, employment, rates, cycle].some(slice => slice.length > 0);
  return {
    dataContractId: 'news-beco-official-macro',
    checkedAt,
    dataStatus: available ? 'available' : 'unavailable',
    growth,
    inflation,
    employment,
    rates,
    cycle,
    limitation: available
      ? '仅显示本次服务端读取到的官方实际观察；不生成 GDP/CPI 预期、利率路径、经济周期状态或交易结论。'
      : '官方宏观观察当前不可读取；不以 BECO 固定数组、随机数或相邻模块数据替代。',
  };
}

export async function getBecoOfficialMacroSnapshot(): Promise<BecoOfficialMacroSnapshot> {
  const checkedAt = new Date().toISOString();
  try {
    const official = await getEconomicCalendarOfficialObservations();
    return buildBecoOfficialMacroSnapshot(official.observations, checkedAt);
  } catch {
    return buildBecoOfficialMacroSnapshot([], checkedAt);
  }
}

function mapError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'NEWS_RESEARCH_UNAVAILABLE';
  if (message === 'NEWS_EVIDENCE_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到当前账户可访问的新闻研究证据卡。' });
  if (message.startsWith('FORBIDDEN_')) throw new TRPCError({ code: 'FORBIDDEN', message: '当前账户没有执行该新闻研究操作的权限。' });
  throw error;
}

export const newsResearchRouter = router({
  getBecoOfficialMacroStatus: publicProcedure.query(getBecoOfficialMacroSnapshot),
  getGlobalDocument: publicProcedure.input(z.object({ sourceId: z.string().regex(/^[a-z_]{2,30}$/), key: z.string().regex(/^[a-f0-9]{24}$/) })).query(async ({ input }) => {
    try { return await getGlobalNewsDocument(input.sourceId, input.key); }
    catch { throw new TRPCError({ code: 'BAD_GATEWAY', message: '正文暂不可读取，已保留当前摘要。可稍后重试。' }); }
  }),
  // Keep source URLs private to the server-side document cleaner.  The terminal
  // receives an internal article key and metadata only, so clicking a row can
  // never navigate the user to a third-party site or expose a feed URL.
  getGlobalFeed: publicProcedure.input(z.object({ language: z.enum(['all', 'en', 'fr', 'ja']).default('all'), region: z.enum(['all', '欧洲', '美洲', '亚太', '全球']).default('all'), keyword: z.string().trim().max(160).default(''), limit: z.number().int().min(1).max(200).default(100) })).query(async ({ input }) => {
    const result = await getGlobalNewsFeed(input);
    return {
      ...result,
      rows: result.rows.map(({ url: _url, ...row }) => ({ ...row, url: '' })),
      sources: result.sources.map(({ feedUrl: _feedUrl, ...source }) => source),
    };
  }),
  getOfficialFeed: publicProcedure.input(z.object({ source: z.enum(['all', 'sec_press', 'fed_monetary', 'fed_research']).default('all'), keyword: z.string().trim().max(160).default(''), limit: z.number().int().min(1).max(60).default(24) })).query(({ input }) => getOfficialNewsFeed(input)),
  getSecFilings: publicProcedure.input(z.object({ ticker: z.string().trim().min(1).max(12) })).query(({ input }) => getNewsSecFilings(input.ticker)),
  getSecFilingExcerpt: publicProcedure.input(z.object({ cik: z.string().trim().regex(/^\d{1,10}$/), accessionNumber: z.string().trim().min(10).max(32), primaryDocument: z.string().trim().min(1).max(240), keyword: z.string().trim().min(2).max(80) })).query(({ input }) => getNewsSecFilingExcerpt(input)),
  listEvidence: protectedProcedure.input(z.object({ status: evidenceStatus.or(z.literal('all')).default('all'), query: z.string().trim().max(180).default('') })).query(({ ctx, input }) => listNewsEvidence(ctx.user.id, input)),
  captureEvidence: protectedProcedure.input(z.object({ sourceKind, sourceId: z.string().trim().min(1).max(320), institution: z.string().trim().min(2).max(180), headline: z.string().trim().min(2).max(600), publishedAt: z.date().nullable(), sourceUrl: z.string().url().max(1200), excerpt: z.string().max(12_000).nullable().optional(), researchNote: z.string().max(12_000).nullable().optional() })).mutation(async ({ ctx, input }) => { try { return await captureNewsEvidence(ctx.user.id, input); } catch (error) { return mapError(error); } }),
  updateEvidence: protectedProcedure.input(z.object({ cardId: z.number().int().positive(), status: evidenceStatus.optional(), researchNote: z.string().max(12_000).optional() })).mutation(async ({ ctx, input }) => { try { return await updateNewsEvidence(ctx.user.id, input); } catch (error) { return mapError(error); } }),
  getEvidence: protectedProcedure.input(z.object({ cardId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await getNewsEvidenceDetail(ctx.user.id, input.cardId); } catch (error) { return mapError(error); } }),
  listEvidenceMembers: protectedProcedure.input(z.object({ cardId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await listNewsEvidenceMembers(ctx.user.id, input.cardId); } catch (error) { return mapError(error); } }),
  searchMemberDirectory: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default(''), limit: z.number().int().min(1).max(30).default(12) })).query(({ ctx, input }) => listNewsEvidenceMemberDirectory(ctx.user.id, input.query, input.limit)),
  addEvidenceMember: protectedProcedure.input(z.object({ cardId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), permission: z.enum(['viewer', 'editor', 'reviewer']) })).mutation(async ({ ctx, input }) => { try { return await addNewsEvidenceMember(ctx.user.id, input); } catch (error) { return mapError(error); } }),
  removeEvidenceMember: protectedProcedure.input(z.object({ cardId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return await removeNewsEvidenceMember(ctx.user.id, input); } catch (error) { return mapError(error); } }),
  submitEvidenceReview: protectedProcedure.input(z.object({ cardId: z.number().int().positive(), summary: z.string().trim().min(8).max(12_000) })).mutation(async ({ ctx, input }) => { try { return await submitNewsEvidenceReview(ctx.user.id, input); } catch (error) { return mapError(error); } }),
  reviewEvidence: protectedProcedure.input(z.object({ submissionId: z.number().int().positive(), decision: z.enum(['approved', 'changes_requested']), note: z.string().trim().max(1000).default('') })).mutation(async ({ ctx, input }) => { try { return await reviewNewsEvidence(ctx.user.id, input); } catch (error) { return mapError(error); } }),
  listSourceFreshnessRules: protectedProcedure.query(({ ctx }) => listNewsSourceFreshnessRules(ctx.user.id)),
  saveSourceFreshnessRule: protectedProcedure.input(z.object({ sourceKind: officialSourceKind, thresholdHours: z.number().int().min(6).max(8_760), isActive: z.boolean() })).mutation(({ ctx, input }) => saveNewsSourceFreshnessRule(ctx.user.id, input)),
  deleteSourceFreshnessRule: protectedProcedure.input(z.object({ sourceKind: officialSourceKind })).mutation(({ ctx, input }) => deleteNewsSourceFreshnessRule(ctx.user.id, input.sourceKind)),
  listSourceFreshnessEvents: protectedProcedure.input(z.object({ sourceKind: officialSourceKind.or(z.literal('all')).default('all'), state: z.enum(['stale', 'unavailable', 'all']).default('all'), limit: z.number().int().min(1).max(160).default(80) })).query(({ ctx, input }) => listNewsSourceFreshnessEvents(ctx.user.id, input)),
});

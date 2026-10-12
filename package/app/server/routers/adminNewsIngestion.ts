import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { adminNewsIngestionArticles, adminNewsIngestionAuditEvents, adminNewsIngestionSources, standaloneSchedules } from '../../drizzle/schema';
import { adminProcedure, publicProcedure, router } from '../_core/trpc';
import { createHeartbeatJob, updateHeartbeatJob } from '../_core/heartbeat';
import { AI_GENERATION_TYPES, listAdminAiGenerationTasks, listAdminAiModelStatus, runAdminAiGeneration } from '../adminAiManagement';
import { setPreferredUcheerModel } from '../aiModelRuntime';
import { listAdminAiGenerationCatalogEvents, listAdminAiGenerationCatalogSettings, updateAdminAiGenerationCatalogSettings } from '../adminAiGenerationCatalog';
import { auditAdminNewsIngestion, discoverAdminNewsFeedUrl, listAdminNewsAnalytics, listPublishedAdminNews, syncAdminNewsSource, validateAdminNewsRssEndpoint } from '../adminNewsIngestion';
import { getDb } from '../db';
import { ADMIN_AI_GENERATION_CATALOG_CODES, ADMIN_AI_GENERATION_CATALOG_STATUSES } from '@shared/adminAiGenerationCatalog';
import { createNotificationForAllUsers } from './notification';

const publicHttpsUrl = z.string().url().max(1200).superRefine((value, ctx) => {
  const result = validateAdminNewsRssEndpoint(value);
  if (!result.valid) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.reason });
});
const processingMode = z.enum(['queued', 'immediate']).default('queued');
const sourceInput = z.object({ name: z.string().trim().min(2).max(120), provider: z.string().trim().min(2).max(64), feedUrl: publicHttpsUrl, sourceUrl: publicHttpsUrl, maxItemsPerRun: z.number().int().min(1).max(50).default(50), processingMode, isActive: z.boolean().default(true) });
const websiteSourceInput = z.object({ name: z.string().trim().min(2).max(120), websiteUrl: publicHttpsUrl, feedUrl: publicHttpsUrl.optional(), maxItemsPerRun: z.number().int().min(1).max(50).default(50), processingMode, isActive: z.boolean().default(true) });
const scheduleInterval = z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(30), z.literal(60), z.literal(360), z.literal(720), z.literal(1440)]);
const toCronExpression = (minutes: 1 | 5 | 10 | 30 | 60 | 360 | 720 | 1440) => ({ 1: '0 * * * * *', 5: '0 */5 * * * *', 10: '0 */10 * * * *', 30: '0 */30 * * * *', 60: '0 0 * * * *', 360: '0 0 */6 * * *', 720: '0 0 */12 * * *', 1440: '0 0 0 * * *' })[minutes];

export const adminNewsIngestionRouter = router({
  getPublished: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(60).default(24) }).optional()).query(({ input }) => listPublishedAdminNews(input?.limit ?? 24)),
  getAnalytics: publicProcedure.query(() => listAdminNewsAnalytics()),
  listSources: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const [sources, schedules] = await Promise.all([
      db.select().from(adminNewsIngestionSources).orderBy(desc(adminNewsIngestionSources.updatedAt)),
      db.select({ id: standaloneSchedules.id, cronExpression: standaloneSchedules.cronExpression, isEnabled: standaloneSchedules.isEnabled }).from(standaloneSchedules),
    ]);
    const scheduleByUid = new Map(schedules.map(item => [`standalone:${item.id}`, item]));
    return sources.map(source => {
      const schedule = source.scheduleCronTaskUid ? scheduleByUid.get(source.scheduleCronTaskUid) : null;
      return {
        ...source,
        scheduleCronExpression: schedule?.cronExpression ?? null,
        scheduleEnabled: schedule?.isEnabled ?? false,
      };
    });
  }),
  listAuditEvents: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ input }) => { const db = await getDb(); if (!db) return []; return db.select().from(adminNewsIngestionAuditEvents).orderBy(desc(adminNewsIngestionAuditEvents.createdAt)).limit(input?.limit ?? 50); }),
  listGenerationTasks: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(60) }).optional()).query(({ input }) => listAdminAiGenerationTasks(input?.limit ?? 60)),
  listModelStatus: adminProcedure.query(() => listAdminAiModelStatus()),
  setPreferredAiModel: adminProcedure.input(z.object({ model: z.string().trim().min(1).max(160) }))
    .mutation(async ({ input }) => {
      await setPreferredUcheerModel(input.model);
      return { model: input.model };
    }),
  listGenerationCatalogSettings: adminProcedure.query(() => listAdminAiGenerationCatalogSettings()),
  listGenerationCatalogEvents: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(({ input }) => listAdminAiGenerationCatalogEvents(input?.limit ?? 50)),
  getGenerationReadiness: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { queuedCount: 0, activeQueuedSourceCount: 0 };
    const [queue] = await db.select({ value: count() }).from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.status, 'queued'));
    const [sources] = await db.select({ value: count() }).from(adminNewsIngestionSources).where(and(eq(adminNewsIngestionSources.isActive, true), eq(adminNewsIngestionSources.processingMode, 'queued')));
    return { queuedCount: Number(queue?.value ?? 0), activeQueuedSourceCount: Number(sources?.value ?? 0) };
  }),
  updateGenerationCatalogSettings: adminProcedure.input(z.object({ codes: z.array(z.enum(ADMIN_AI_GENERATION_CATALOG_CODES)).min(1).max(28), status: z.enum(ADMIN_AI_GENERATION_CATALOG_STATUSES) })).mutation(({ ctx, input }) => updateAdminAiGenerationCatalogSettings({ ...input, actorUserId: ctx.user.id })),
  runGeneration: adminProcedure.input(z.object({ generationType: z.enum(AI_GENERATION_TYPES), count: z.number().int().min(1).max(10), catalogCode: z.enum(ADMIN_AI_GENERATION_CATALOG_CODES).optional(), model: z.string().trim().min(1).max(80).optional() })).mutation(({ ctx, input }) => runAdminAiGeneration({ ...input, actorUserId: ctx.user.id })),
  listArticles: adminProcedure.input(z.object({ status: z.enum(['all', 'queued', 'draft', 'approved', 'published', 'rejected', 'failed']).default('draft'), limit: z.number().int().min(1).max(100).default(40) })).query(async ({ input }) => { const db = await getDb(); if (!db) return []; const rows = input.status === 'all' ? await db.select().from(adminNewsIngestionArticles).orderBy(desc(adminNewsIngestionArticles.updatedAt)).limit(input.limit) : await db.select().from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.status, input.status)).orderBy(desc(adminNewsIngestionArticles.updatedAt)).limit(input.limit); return rows; }),
  createSource: adminProcedure.input(websiteSourceInput).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const feedUrl = input.feedUrl ?? await discoverAdminNewsFeedUrl(input.websiteUrl); const existing = (await db.select({ id: adminNewsIngestionSources.id }).from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.feedUrl, feedUrl)).limit(1))[0]; if (existing) return { sourceId: existing.id, feedUrl, existed: true }; const result = await db.insert(adminNewsIngestionSources).values({ name: input.name, provider: input.name, feedUrl, sourceUrl: input.websiteUrl, sourceType: 'rss', maxItemsPerRun: input.maxItemsPerRun, processingMode: input.processingMode, isActive: input.isActive, createdByUserId: ctx.user.id }); const sourceId = Number((result as any)[0]?.insertId ?? (result as any).insertId); await auditAdminNewsIngestion({ sourceId, actorUserId: ctx.user.id, action: 'source_created', detail: input.feedUrl ? `管理员配置网站来源：${input.name}；使用管理员提供的公开订阅地址。` : `管理员配置网站来源：${input.name}；已发现公开订阅地址。` }); return { sourceId, feedUrl, existed: false }; }),
  addSinaFinanceRss: adminProcedure.mutation(async ({ ctx }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const feedUrl = 'https://rss.sina.com.cn/roll/finance/hot_roll.xml'; const existing = (await db.select({ id: adminNewsIngestionSources.id }).from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.feedUrl, feedUrl)).limit(1))[0]; if (existing) return { sourceId: existing.id, existed: true }; const result = await db.insert(adminNewsIngestionSources).values({ name: '新浪财经要闻汇总', provider: '新浪财经 RSS', feedUrl, sourceUrl: 'https://rss.sina.com.cn/finance/', sourceType: 'rss', maxItemsPerRun: 8, isActive: true, createdByUserId: ctx.user.id }); const sourceId = Number((result as any)[0]?.insertId ?? (result as any).insertId); await auditAdminNewsIngestion({ sourceId, actorUserId: ctx.user.id, action: 'source_created', detail: '管理员添加官方公开 RSS 来源：新浪财经要闻汇总。' }); return { sourceId, existed: false }; }),
  addHkexNewsReleasesRss: adminProcedure.mutation(async ({ ctx }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const feedUrl = 'https://www.hkex.com.hk/Services/RSS-Feeds/News-Releases?sc_lang=en'; const existing = (await db.select({ id: adminNewsIngestionSources.id }).from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.feedUrl, feedUrl)).limit(1))[0]; if (existing) return { sourceId: existing.id, feedUrl, existed: true }; const result = await db.insert(adminNewsIngestionSources).values({ name: '香港交易所新闻发布', provider: 'HKEX 官方 RSS', feedUrl, sourceUrl: 'https://www.hkex.com.hk/News/News-Release?sc_lang=en', sourceType: 'rss', maxItemsPerRun: 50, processingMode: 'queued', isActive: true, createdByUserId: ctx.user.id }); const sourceId = Number((result as any)[0]?.insertId ?? (result as any).insertId); await auditAdminNewsIngestion({ sourceId, actorUserId: ctx.user.id, action: 'source_created', detail: '管理员添加 HKEX 公开新闻发布 RSS 来源；需由管理员手动同步后才能生成审核草稿。' }); return { sourceId, feedUrl, existed: false }; }),
  updateSource: adminProcedure.input(z.object({ id: z.number().int().positive(), ...sourceInput.shape })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const { id, ...set } = input; await db.update(adminNewsIngestionSources).set({ ...set, updatedAt: new Date() }).where(eq(adminNewsIngestionSources.id, id)); await auditAdminNewsIngestion({ sourceId: id, actorUserId: ctx.user.id, action: 'source_updated', detail: `管理员更新新闻来源：${set.name}` }); return { id }; }),
  setSourceActive: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.update(adminNewsIngestionSources).set({ isActive: input.isActive, updatedAt: new Date() }).where(eq(adminNewsIngestionSources.id, input.id)); await auditAdminNewsIngestion({ sourceId: input.id, actorUserId: ctx.user.id, action: 'source_updated', detail: `管理员${input.isActive ? '启用' : '暂停'}新闻来源。` }); return { ...input }; }),
  deleteSource: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const source = (await db.select({ name: adminNewsIngestionSources.name }).from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.id, input.id)).limit(1))[0]; if (!source) throw new Error('NEWS_INGESTION_SOURCE_NOT_FOUND'); await db.delete(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.id, input.id)); await auditAdminNewsIngestion({ actorUserId: ctx.user.id, action: 'source_updated', detail: `管理员删除新闻来源：${source.name}（历史审计仍保留）。` }); return { id: input.id }; }),
  syncSource: adminProcedure.input(z.object({ sourceId: z.number().int().positive(), maxItemsPerRun: z.number().int().min(1).max(50).optional() })).mutation(({ ctx, input }) => syncAdminNewsSource(input.sourceId, ctx.user.id, input.maxItemsPerRun)),
  runCrawler: adminProcedure.input(z.object({ sourceId: z.number().int().positive().optional(), generationType: z.enum(AI_GENERATION_TYPES), count: z.number().int().min(1).max(10), catalogCode: z.enum(ADMIN_AI_GENERATION_CATALOG_CODES).optional(), model: z.string().trim().min(1).max(80).optional(), maxItemsPerRun: z.number().int().min(1).max(50).optional() })).mutation(async ({ ctx, input }) => {
    const sourceSync = input.sourceId ? await syncAdminNewsSource(input.sourceId, ctx.user.id, input.maxItemsPerRun) : null;
    const generation = await runAdminAiGeneration({ generationType: input.generationType, count: input.count, catalogCode: input.catalogCode, model: input.model, actorUserId: ctx.user.id });
    return { sourceSync, generation };
  }),
  enableSchedule: adminProcedure.input(z.object({ sourceId: z.number().int().positive(), intervalMinutes: scheduleInterval })).mutation(async ({ ctx, input }) => {
    if (process.env.NODE_ENV !== 'production') throw new Error('NEWS_SCHEDULE_REQUIRES_PUBLISHED_DEPLOYMENT');
    const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const source = (await db.select().from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.id, input.sourceId)).limit(1))[0];
    if (!source) throw new Error('NEWS_INGESTION_SOURCE_NOT_FOUND');
    const cron = toCronExpression(input.intervalMinutes);
    let taskUid = source.scheduleCronTaskUid;
    if (taskUid && !taskUid.startsWith('standalone:')) taskUid = null;
    if (taskUid) await updateHeartbeatJob(taskUid, { cron, path: '/api/scheduled/adminNewsIngestion', method: 'POST', payload: { sourceId: source.id }, description: `Finance Hub 管理员新闻 RSS 采集：${source.name}。仅写入待审核草稿。`, enable: true }, '');
    else {
      const created = await createHeartbeatJob({ name: `finance-hub-admin-news-source-${source.id}`, cron, path: '/api/scheduled/adminNewsIngestion', method: 'POST', payload: { sourceId: source.id }, description: `Finance Hub 管理员新闻 RSS 采集：${source.name}。仅写入待审核草稿。` }, '');
      taskUid = created.taskUid;
      await db.update(adminNewsIngestionSources).set({ scheduleCronTaskUid: taskUid, updatedAt: new Date() }).where(eq(adminNewsIngestionSources.id, source.id));
    }
    await auditAdminNewsIngestion({ sourceId: source.id, actorUserId: ctx.user.id, action: 'source_updated', detail: `启用 ${input.intervalMinutes} 分钟新闻采集计划：${taskUid}` });
    return { sourceId: source.id, taskUid, intervalMinutes: input.intervalMinutes };
  }),
  pauseSchedule: adminProcedure.input(z.object({ sourceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const source = (await db.select().from(adminNewsIngestionSources).where(eq(adminNewsIngestionSources.id, input.sourceId)).limit(1))[0];
    if (!source?.scheduleCronTaskUid) throw new Error('NEWS_SCHEDULE_NOT_CONFIGURED');
    await updateHeartbeatJob(source.scheduleCronTaskUid, { enable: false }, '');
    await auditAdminNewsIngestion({ sourceId: source.id, actorUserId: ctx.user.id, action: 'source_updated', detail: `暂停新闻采集计划：${source.scheduleCronTaskUid}` });
    return { sourceId: source.id, taskUid: source.scheduleCronTaskUid, paused: true };
  }),
  updateDraft: adminProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(2).max(255), summary: z.string().trim().min(20).max(2000), category: z.string().trim().min(1).max(64), sentiment: z.enum(['positive', 'neutral', 'negative', 'uncertain']), tickers: z.array(z.string().trim().min(1).max(16)).max(8) })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.update(adminNewsIngestionArticles).set({ aiTitle: input.title, aiSummary: input.summary, category: input.category, sentiment: input.sentiment, tickers: input.tickers, status: 'draft', reviewedAt: null, reviewedByUserId: null, publishedAt: null, publishedByUserId: null }).where(eq(adminNewsIngestionArticles.id, input.id)); await auditAdminNewsIngestion({ articleId: input.id, actorUserId: ctx.user.id, action: 'draft_generated', detail: '管理员更新并保存新闻草稿；需要重新批准后才能发布。' }); return { id: input.id }; }),
  batchReview: adminProcedure.input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100), decision: z.enum(['approved', 'rejected']) })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const rows = await db.select({ id: adminNewsIngestionArticles.id, status: adminNewsIngestionArticles.status }).from(adminNewsIngestionArticles).where(inArray(adminNewsIngestionArticles.id, input.ids));
    const eligible = rows.filter((row) => row.status === 'draft').map((row) => row.id);
    if (eligible.length) await db.update(adminNewsIngestionArticles).set({ status: input.decision, reviewedByUserId: ctx.user.id, reviewedAt: new Date() }).where(and(inArray(adminNewsIngestionArticles.id, eligible), eq(adminNewsIngestionArticles.status, 'draft')));
    for (const id of eligible) await auditAdminNewsIngestion({ articleId: id, actorUserId: ctx.user.id, action: input.decision, detail: `管理员批量${input.decision === 'approved' ? '批准' : '驳回'}新闻草稿；未自动发布。` });
    return { decision: input.decision, reviewed: eligible.length, skipped: input.ids.length - eligible.length };
  }),
  batchPublish: adminProcedure.input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const rows = await db.select({ id: adminNewsIngestionArticles.id, status: adminNewsIngestionArticles.status, aiTitle: adminNewsIngestionArticles.aiTitle, sourceHeadline: adminNewsIngestionArticles.sourceHeadline, aiSummary: adminNewsIngestionArticles.aiSummary, sourceExcerpt: adminNewsIngestionArticles.sourceExcerpt }).from(adminNewsIngestionArticles).where(inArray(adminNewsIngestionArticles.id, input.ids));
    const eligibleRows = rows.filter((row) => row.status === 'approved');
    const eligible = eligibleRows.map((row) => row.id);
    if (eligible.length) await db.update(adminNewsIngestionArticles).set({ status: 'published', publishedByUserId: ctx.user.id, publishedAt: new Date() }).where(and(inArray(adminNewsIngestionArticles.id, eligible), eq(adminNewsIngestionArticles.status, 'approved')));
    for (const row of eligibleRows) {
      await auditAdminNewsIngestion({ articleId: row.id, actorUserId: ctx.user.id, action: 'published', detail: '管理员批量发布已审核新闻草稿到站内；未发布非 approved 状态记录。' });
      await createNotificationForAllUsers(row.aiTitle ?? row.sourceHeadline, row.aiSummary ?? row.sourceExcerpt ?? '新的新闻文章已发布。', 'info', row.id, 'news_article');
    }
    return { published: eligible.length, skipped: input.ids.length - eligible.length };
  }),
  prepareApprovedExport: adminProcedure.input(z.object({ id: z.number().int().positive(), format: z.enum(['doc', 'pdf']) })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const article = (await db.select({ id: adminNewsIngestionArticles.id, status: adminNewsIngestionArticles.status, sourceHeadline: adminNewsIngestionArticles.sourceHeadline, sourceUrl: adminNewsIngestionArticles.sourceUrl, sourcePublishedAt: adminNewsIngestionArticles.sourcePublishedAt, aiTitle: adminNewsIngestionArticles.aiTitle, aiSummary: adminNewsIngestionArticles.aiSummary, category: adminNewsIngestionArticles.category, sentiment: adminNewsIngestionArticles.sentiment, tickers: adminNewsIngestionArticles.tickers, aiModel: adminNewsIngestionArticles.aiModel, aiGeneratedAt: adminNewsIngestionArticles.aiGeneratedAt, reviewedAt: adminNewsIngestionArticles.reviewedAt, aiGenerationCatalogCode: adminNewsIngestionArticles.aiGenerationCatalogCode }).from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.id, input.id)).limit(1))[0];
    if (!article || article.status !== 'approved') throw new Error('NEWS_EXPORT_REQUIRES_APPROVAL');
    await auditAdminNewsIngestion({ articleId: article.id, actorUserId: ctx.user.id, action: 'exported', detail: `管理员导出已批准新闻草稿为 ${input.format.toUpperCase()}；未改变审核或发布状态。` });
    return article;
  }),
  approve: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const article = (await db.select({ id: adminNewsIngestionArticles.id, status: adminNewsIngestionArticles.status }).from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.id, input.id)).limit(1))[0]; if (!article || article.status !== 'draft') throw new Error('NEWS_DRAFT_NOT_APPROVABLE'); await db.update(adminNewsIngestionArticles).set({ status: 'approved', reviewedByUserId: ctx.user.id, reviewedAt: new Date() }).where(eq(adminNewsIngestionArticles.id, input.id)); await auditAdminNewsIngestion({ articleId: input.id, actorUserId: ctx.user.id, action: 'approved', detail: '管理员已审核草稿；尚未发布。' }); return { id: input.id, status: 'approved' as const }; }),
  publish: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const article = (await db.select({ id: adminNewsIngestionArticles.id, status: adminNewsIngestionArticles.status, aiTitle: adminNewsIngestionArticles.aiTitle, sourceHeadline: adminNewsIngestionArticles.sourceHeadline, aiSummary: adminNewsIngestionArticles.aiSummary, sourceExcerpt: adminNewsIngestionArticles.sourceExcerpt }).from(adminNewsIngestionArticles).where(eq(adminNewsIngestionArticles.id, input.id)).limit(1))[0]; if (!article || article.status !== 'approved') throw new Error('NEWS_DRAFT_REQUIRES_APPROVAL'); await db.update(adminNewsIngestionArticles).set({ status: 'published', publishedByUserId: ctx.user.id, publishedAt: new Date() }).where(eq(adminNewsIngestionArticles.id, input.id)); await auditAdminNewsIngestion({ articleId: input.id, actorUserId: ctx.user.id, action: 'published', detail: '管理员已将已审核新闻草稿发布到站内。' }); await createNotificationForAllUsers(article.aiTitle ?? article.sourceHeadline, article.aiSummary ?? article.sourceExcerpt ?? '新的新闻文章已发布。', 'info', article.id, 'news_article'); return { id: input.id, status: 'published' as const }; }),
  reject: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.update(adminNewsIngestionArticles).set({ status: 'rejected', reviewedByUserId: ctx.user.id, reviewedAt: new Date() }).where(and(eq(adminNewsIngestionArticles.id, input.id), eq(adminNewsIngestionArticles.status, 'draft'))); await auditAdminNewsIngestion({ articleId: input.id, actorUserId: ctx.user.id, action: 'rejected', detail: '管理员拒绝该新闻草稿，未发布。' }); return { id: input.id, status: 'rejected' as const }; }),
});

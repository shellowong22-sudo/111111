import { z } from 'zod';
import { parse as parseCookie } from 'cookie';
import { ADMIN_DATA_MODULE_IDS } from '@shared/adminDataModules';
import { adminProcedure, router } from '../_core/trpc';
import { COOKIE_NAME } from '@shared/const';
import { cancelAdminDataModuleAutomationRun, enableAdminDataModuleAutomationSchedule, enqueueAdminDataModuleAutomation, getAdminCrawlerUpgradeReadiness, getAdminCrawlerWorkspace, getAdminDataModuleAutomationSchedule, listAdminDataModuleAutomationRunItems, listAdminDataModuleAutomationRuns, listAdminDataModuleDeliveryEvents, pauseAdminDataModuleAutomation, processAdminDataModuleAutomationRun, resumeAdminDataModuleAutomation, retryFailedAdminDataModuleAutomationItems, setAdminDataModuleAutomationScheduleEnabled } from '../adminDataModuleAutomation';

const mode = z.enum(['fast_draft', 'rich_content']);

export const adminDataModuleAutomationRouter = router({
  listRuns: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(120).default(60) }).optional()).query(({ input }) => listAdminDataModuleAutomationRuns(input?.limit ?? 60)),
  listDeliveryEvents: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(160).default(80) }).optional()).query(({ input }) => listAdminDataModuleDeliveryEvents(input?.limit ?? 80)),
  listRunItems: adminProcedure.input(z.object({ runKey: z.string().regex(/^modrun_[a-f0-9]{32}$/), page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).max(100).optional(), status: z.enum(['queued', 'claimed', 'running', 'pending_review', 'pending_delivery', 'completed', 'skipped', 'failed', 'cancelled']).optional() })).query(({ input }) => listAdminDataModuleAutomationRunItems(input.runKey, input.page, input.pageSize, input.status)),
  getSchedule: adminProcedure.query(() => getAdminDataModuleAutomationSchedule()),
  getCrawlerUpgradeReadiness: adminProcedure.query(({ ctx }) => getAdminCrawlerUpgradeReadiness(ctx.user.id)),
  getCrawlerWorkspace: adminProcedure.query(({ ctx }) => getAdminCrawlerWorkspace(ctx.user.id)),
  startSingle: adminProcedure.input(z.object({ moduleId: z.enum(ADMIN_DATA_MODULE_IDS), mode })).mutation(({ ctx, input }) => enqueueAdminDataModuleAutomation({ ...input, scope: 'single', actorUserId: ctx.user.id })),
  startBatch: adminProcedure.input(z.object({ moduleIds: z.array(z.enum(ADMIN_DATA_MODULE_IDS)).min(2).max(160), mode })).mutation(({ ctx, input }) => enqueueAdminDataModuleAutomation({ ...input, scope: 'batch', actorUserId: ctx.user.id })),
  startGroup: adminProcedure.input(z.object({ moduleGroup: z.string().min(1).max(80), mode })).mutation(({ ctx, input }) => enqueueAdminDataModuleAutomation({ ...input, scope: 'group', actorUserId: ctx.user.id })),
  startSite: adminProcedure.input(z.object({ mode })).mutation(({ ctx, input }) => enqueueAdminDataModuleAutomation({ ...input, scope: 'site', actorUserId: ctx.user.id })),
  process: adminProcedure.input(z.object({ runKey: z.string().regex(/^modrun_[a-f0-9]{32}$/) })).mutation(({ ctx, input }) => processAdminDataModuleAutomationRun(input.runKey, ctx.user.id)),
  retry: adminProcedure.input(z.object({ runKey: z.string().regex(/^modrun_[a-f0-9]{32}$/) })).mutation(async ({ ctx, input }) => {
    const result = await processAdminDataModuleAutomationRun(input.runKey, ctx.user.id);
    return { ...result, retryRequestedBy: ctx.user.id };
  }),
  cancel: adminProcedure.input(z.object({ runKey: z.string().regex(/^modrun_[a-f0-9]{32}$/) })).mutation(({ ctx, input }) => cancelAdminDataModuleAutomationRun(input.runKey, ctx.user.id)),
  pause: adminProcedure.input(z.object({ runKey: z.string().regex(/^modrun_[a-f0-9]{32}$/) })).mutation(({ ctx, input }) => pauseAdminDataModuleAutomation(input.runKey, ctx.user.id)),
  resume: adminProcedure.input(z.object({ runKey: z.string().regex(/^modrun_[a-f0-9]{32}$/) })).mutation(({ ctx, input }) => resumeAdminDataModuleAutomation(input.runKey, ctx.user.id)),
  retryFailedItems: adminProcedure.input(z.object({ runKey: z.string().regex(/^modrun_[a-f0-9]{32}$/) })).mutation(({ ctx, input }) => retryFailedAdminDataModuleAutomationItems(input.runKey, ctx.user.id)),
  enableSchedule: adminProcedure.input(z.object({ cron: z.string().regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+$/) })).mutation(({ ctx, input }) => {
    const session = parseCookie(ctx.req.headers.cookie ?? '')[COOKIE_NAME] ?? '';
    return enableAdminDataModuleAutomationSchedule(ctx.user.id, input.cron, session);
  }),
  setScheduleEnabled: adminProcedure.input(z.object({ enabled: z.boolean() })).mutation(({ ctx, input }) => {
    const session = parseCookie(ctx.req.headers.cookie ?? '')[COOKIE_NAME] ?? '';
    return setAdminDataModuleAutomationScheduleEnabled(ctx.user.id, input.enabled, session);
  }),
});

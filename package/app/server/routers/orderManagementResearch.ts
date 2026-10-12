import { z } from 'zod';
import { parse as parseCookie } from 'cookie';
import { protectedProcedure, router } from '../_core/trpc';
import { createHeartbeatJob, updateHeartbeatJob } from '../_core/heartbeat';
import { COOKIE_NAME } from '../../shared/const';
import { importOrderManagementResearchEvents, listOrderManagementResearchBatches, getOrderManagementResearchDossier, compareOrderManagementResearchBatches, setOrderManagementResearchBatchArchived, updateOrderManagementResearchBatchTags, ORDER_EVENT_TYPES } from '../orderManagementResearchDb';
import { ARCHIVE_CONDITIONS, ORDER_REVIEW_STATUSES, exportArchivedOrderManagementResearch, getOrderManagementDeviationAlertSettings, listOrderManagementArchiveRules, listOrderManagementOrderReviewAudits, listOrderManagementOrderReviews, runOrderManagementArchiveRule, saveOrderManagementArchiveRule, saveOrderManagementDeviationAlertSettings, saveOrderManagementOrderReview, setOrderManagementArchiveRuleEnabled, setOrderManagementArchiveRuleTask } from '../orderManagementGovernanceDb';

const eventSchema = z.object({ eventId: z.string().trim().min(1).max(120), orderId: z.string().trim().min(1).max(120), parentOrderId: z.string().trim().max(120).nullable().optional(), eventType: z.enum(ORDER_EVENT_TYPES), instrument: z.string().trim().min(1).max(120), assetClass: z.string().trim().max(80).nullable().optional(), side: z.enum(['buy', 'sell']), orderQty: z.number().finite().nonnegative().nullable().optional(), eventQty: z.number().finite().nonnegative().nullable().optional(), limitPrice: z.number().finite().nonnegative().nullable().optional(), executionPrice: z.number().finite().nonnegative().nullable().optional(), venue: z.string().trim().max(120).nullable().optional(), broker: z.string().trim().max(120).nullable().optional(), eventAt: z.coerce.date() });
function isCronField(value: string, minimum: number, maximum: number) { return value.split(',').every((part) => { const [base, step] = part.split('/'); if (part.split('/').length > 2 || (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1 || Number(step) > maximum - minimum + 1))) return false; if (base === '*') return true; const range = base.match(/^(\d+)(?:-(\d+))?$/); if (!range) return false; const start = Number(range[1]); const end = range[2] === undefined ? start : Number(range[2]); return start >= minimum && end <= maximum && start <= end; }); }
export function isValidOrderManagementCron(value: string) { const parts = value.trim().split(/\s+/); if (parts.length !== 6) return false; return [[0, 59], [0, 59], [0, 23], [1, 31], [1, 12], [0, 7]].every(([minimum, maximum], index) => isCronField(parts[index] ?? '', minimum, maximum)); }
const cronExpression = z.string().trim().max(64).refine(isValidOrderManagementCron, 'Cron 必须是语法有效的 6 个 UTC 字段。');
const archiveRuleInput = z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(120), conditionType: z.enum(ARCHIVE_CONDITIONS), ageDays: z.number().int().min(1).max(3650).nullable().optional(), cronExpression, isEnabled: z.boolean() }).superRefine((input, ctx) => { if (input.conditionType === 'age' && input.ageDays == null) ctx.addIssue({ code: 'custom', path: ['ageDays'], message: '按批次时间归档必须提供正整数天数。' }); });

export const orderManagementResearchRouter = router({
  listBatches: protectedProcedure.input(z.object({ query: z.string().trim().max(120).optional(), includeArchived: z.enum(['all', 'active', 'archived']).optional() }).optional()).query(({ ctx, input }) => listOrderManagementResearchBatches(ctx.user.id, input)),
  setBatchTags: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), tags: z.array(z.string().trim().min(1).max(60)).max(12) })).mutation(({ ctx, input }) => updateOrderManagementResearchBatchTags(ctx.user.id, input.batchId, input.tags)),
  setBatchArchived: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), isArchived: z.boolean() })).mutation(({ ctx, input }) => setOrderManagementResearchBatchArchived(ctx.user.id, input.batchId, input.isArchived)),
  listOrderReviews: protectedProcedure.input(z.object({ batchId: z.number().int().positive() })).query(({ ctx, input }) => listOrderManagementOrderReviews(ctx.user.id, input.batchId)),
  saveOrderReview: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), orderId: z.string().trim().min(1).max(120), status: z.enum(ORDER_REVIEW_STATUSES), note: z.string().trim().max(2000).nullable() })).mutation(({ ctx, input }) => saveOrderManagementOrderReview(ctx.user.id, input)),
  listOrderReviewAudits: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), orderId: z.string().trim().min(1).max(120) })).query(({ ctx, input }) => listOrderManagementOrderReviewAudits(ctx.user.id, input.batchId, input.orderId)),
  getDeviationAlertSettings: protectedProcedure.query(({ ctx }) => getOrderManagementDeviationAlertSettings(ctx.user.id)),
  saveDeviationAlertSettings: protectedProcedure.input(z.object({ thresholdBps: z.number().finite().min(0.01).max(100_000) })).mutation(({ ctx, input }) => saveOrderManagementDeviationAlertSettings(ctx.user.id, input.thresholdBps)),
  listArchiveRules: protectedProcedure.query(({ ctx }) => listOrderManagementArchiveRules(ctx.user.id)),
  saveArchiveRule: protectedProcedure.input(archiveRuleInput).mutation(({ ctx, input }) => saveOrderManagementArchiveRule(ctx.user.id, input)),
  runArchiveRuleNow: protectedProcedure.input(z.object({ ruleId: z.number().int().positive() })).mutation(({ ctx, input }) => runOrderManagementArchiveRule(ctx.user.id, input.ruleId)),
  exportArchivedBatches: protectedProcedure.input(z.object({ batchIds: z.array(z.number().int().positive()).max(100).optional() }).optional()).query(({ ctx, input }) => exportArchivedOrderManagementResearch(ctx.user.id, input?.batchIds)),
  activateArchiveRuleSchedule: protectedProcedure.input(z.object({ ruleId: z.number().int().positive(), enable: z.boolean() })).mutation(async ({ ctx, input }) => {
    const rule = (await listOrderManagementArchiveRules(ctx.user.id)).find((item) => item.id === input.ruleId);
    if (!rule) return null;
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? '')[COOKIE_NAME] ?? '';
    if (!rule.scheduleCronTaskUid) {
      if (!input.enable) return setOrderManagementArchiveRuleEnabled(ctx.user.id, input.ruleId, false);
      const job = await createHeartbeatJob({ name: `order-archive-${ctx.user.id}-${rule.id}`, cron: rule.cronExpression, path: '/api/scheduled/orderManagementArchive', payload: { ruleId: rule.id }, description: `账户私有交易批次归档：${rule.name}` }, sessionToken);
      return setOrderManagementArchiveRuleTask(ctx.user.id, rule.id, job.taskUid, true);
    }
    await updateHeartbeatJob(rule.scheduleCronTaskUid, { cron: rule.cronExpression, enable: input.enable, path: '/api/scheduled/orderManagementArchive', payload: { ruleId: rule.id }, description: `账户私有交易批次归档：${rule.name}` }, sessionToken);
    return setOrderManagementArchiveRuleEnabled(ctx.user.id, rule.id, input.enable);
  }),
  compareBatches: protectedProcedure.query(({ ctx }) => compareOrderManagementResearchBatches(ctx.user.id)),
  getDossier: protectedProcedure.input(z.object({ batchId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getOrderManagementResearchDossier(ctx.user.id, input?.batchId)),
  importEvents: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120), sourceLabel: z.string().trim().min(1).max(160), asOfAt: z.coerce.date(), events: z.array(eventSchema).min(1).max(1000) })).mutation(({ ctx, input }) => importOrderManagementResearchEvents(ctx.user.id, input)),
});

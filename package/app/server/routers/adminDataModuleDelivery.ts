import { z } from 'zod';
import { ADMIN_DATA_MODULE_IDS } from '@shared/adminDataModules';
import { adminProcedure, router } from '../_core/trpc';
import {
  approveAdminDataModuleContent,
  deliverApprovedAdminDataModuleContent,
  generateAdminDataModuleContentDraft,
  getAdminDataModuleDeliveryStats,
  listAdminDataModuleContent,
  rejectAdminDataModuleContent,
  retryAdminDataModuleDelivery,
  rollbackAdminDataModuleDeliveryVersion,
} from '../adminDataModuleDelivery';

const contentKey = z.string().regex(/^modcontent_[a-f0-9]{32}$/);
const contentKeys = z.array(contentKey).min(1).max(100).transform((keys) => [...new Set(keys)]);

async function collectBatch<T>(keys: string[], operation: (key: string) => Promise<T>) {
  const results: Array<{ contentKey: string; ok: true; result: T } | { contentKey: string; ok: false; error: string }> = [];
  for (const key of keys) {
    try {
      results.push({ contentKey: key, ok: true, result: await operation(key) });
    } catch (error) {
      results.push({ contentKey: key, ok: false, error: error instanceof Error ? error.message : 'BATCH_OPERATION_FAILED' });
    }
  }
  return { requested: keys.length, succeeded: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, results };
}

export const adminDataModuleDeliveryRouter = router({
  listContent: adminProcedure.input(z.object({
    moduleId: z.enum(ADMIN_DATA_MODULE_IDS).optional(),
    status: z.enum(['generated', 'pending_review', 'approved', 'rejected', 'queued_for_delivery', 'delivered', 'skipped_duplicate', 'failed', 'reverted']).optional(),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  }).optional()).query(({ input }) => listAdminDataModuleContent(input ?? {})),
  deliveryStats: adminProcedure.input(z.object({ moduleId: z.enum(ADMIN_DATA_MODULE_IDS).optional(), runId: z.number().int().positive().optional() })).query(({ input }) => getAdminDataModuleDeliveryStats(input)),
  generateDraft: adminProcedure.input(z.object({ moduleId: z.enum(ADMIN_DATA_MODULE_IDS), runKey: z.string().regex(/^modrun_[a-f0-9]{32}$/), runId: z.number().int().positive().optional(), jobItemId: z.number().int().positive().optional(), mode: z.enum(['fast_draft', 'rich_content']).optional() })).mutation(({ ctx, input }) => generateAdminDataModuleContentDraft({ ...input, actorUserId: ctx.user.id })),
  approve: adminProcedure.input(z.object({ contentKey })).mutation(({ ctx, input }) => approveAdminDataModuleContent(input.contentKey, ctx.user.id)),
  approveBatch: adminProcedure.input(z.object({ contentKeys })).mutation(({ ctx, input }) => collectBatch(input.contentKeys, (key) => approveAdminDataModuleContent(key, ctx.user.id))),
  reject: adminProcedure.input(z.object({ contentKey, reason: z.string().min(1).max(1800) })).mutation(({ ctx, input }) => rejectAdminDataModuleContent(input.contentKey, ctx.user.id, input.reason)),
  rejectBatch: adminProcedure.input(z.object({ contentKeys, reason: z.string().min(1).max(1800) })).mutation(({ ctx, input }) => collectBatch(input.contentKeys, (key) => rejectAdminDataModuleContent(key, ctx.user.id, input.reason))),
  deliver: adminProcedure.input(z.object({ contentKey })).mutation(({ ctx, input }) => deliverApprovedAdminDataModuleContent(input.contentKey, ctx.user.id)),
  deliverBatch: adminProcedure.input(z.object({ contentKeys })).mutation(({ ctx, input }) => collectBatch(input.contentKeys, (key) => deliverApprovedAdminDataModuleContent(key, ctx.user.id))),
  retryDelivery: adminProcedure.input(z.object({ contentKey })).mutation(({ ctx, input }) => retryAdminDataModuleDelivery(input.contentKey, ctx.user.id)),
  retryDeliveryBatch: adminProcedure.input(z.object({ contentKeys })).mutation(({ ctx, input }) => collectBatch(input.contentKeys, (key) => retryAdminDataModuleDelivery(key, ctx.user.id))),
  rollbackVersion: adminProcedure.input(z.object({ versionId: z.number().int().positive() })).mutation(({ ctx, input }) => rollbackAdminDataModuleDeliveryVersion(input.versionId, ctx.user.id)),
});

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { exportTradeBookPrivateBatches, getTradeBookPrivateDossier, importTradeBookPrivateBatch, listTradeBookPrivateBatches } from '../tradeBookPrivateResearchDb';

const importedPosition = z.object({
  snapshotId: z.string().trim().min(1).max(120), accountLabel: z.string().trim().min(1).max(120), instrument: z.string().trim().min(1).max(160), quantity: z.number().finite().refine((value) => value !== 0, '数量不能为零。'), snapshotAt: z.coerce.date(),
  marketPrice: z.number().finite().positive().nullable().optional(), costBasis: z.number().finite().nullable().optional(), currency: z.string().trim().min(1).max(12).nullable().optional(),
});
const importedCashFlow = z.object({
  flowId: z.string().trim().min(1).max(120), accountLabel: z.string().trim().min(1).max(120), flowType: z.string().trim().min(1).max(48), amount: z.number().finite().refine((value) => value !== 0, '金额不能为零。'), occurredAt: z.coerce.date(),
  currency: z.string().trim().min(1).max(12).nullable().optional(), instrument: z.string().trim().min(1).max(160).nullable().optional(),
});

export const tradeBookPrivateResearchRouter = router({
  listBatches: protectedProcedure.query(({ ctx }) => listTradeBookPrivateBatches(ctx.user.id)),
  getDossier: protectedProcedure.input(z.object({ batchId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getTradeBookPrivateDossier(ctx.user.id, input?.batchId)),
  importBatch: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120), sourceLabel: z.string().trim().min(1).max(160), asOfAt: z.coerce.date(), positions: z.array(importedPosition).max(1_000), cashFlows: z.array(importedCashFlow).max(1_000) }).superRefine((input, issue) => {
    if (!input.positions.length && !input.cashFlows.length) issue.addIssue({ code: 'custom', path: ['positions'], message: '至少需要一条持仓快照或现金流记录。' });
    const snapshotIds = new Set<string>();
    input.positions.forEach((position, index) => { if (snapshotIds.has(position.snapshotId)) issue.addIssue({ code: 'custom', path: ['positions', index, 'snapshotId'], message: '同一批次 snapshotId 必须唯一。' }); snapshotIds.add(position.snapshotId); });
    const flowIds = new Set<string>();
    input.cashFlows.forEach((flow, index) => { if (flowIds.has(flow.flowId)) issue.addIssue({ code: 'custom', path: ['cashFlows', index, 'flowId'], message: '同一批次 flowId 必须唯一。' }); flowIds.add(flow.flowId); });
  })).mutation(({ ctx, input }) => importTradeBookPrivateBatch(ctx.user.id, input)),
  exportBatches: protectedProcedure.input(z.object({ batchIds: z.array(z.number().int().positive()).max(100).optional() }).optional()).query(({ ctx, input }) => exportTradeBookPrivateBatches(ctx.user.id, input?.batchIds)),
});

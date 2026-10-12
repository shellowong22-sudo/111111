import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { exportPrivateIndustryBatches, getPrivateIndustryDossier, importPrivateIndustryBatch, listPrivateIndustryBatches } from '../industryGroupPrivateResearchDb';

const importedObservation = z.object({
  recordId: z.string().trim().min(1).max(120), industryGroup: z.string().trim().min(1).max(160), metric: z.string().trim().min(1).max(120), value: z.number().finite(), unit: z.string().trim().min(1).max(48), observedAt: z.coerce.date(),
  issuerName: z.string().trim().min(1).max(160).nullable().optional(), ticker: z.string().trim().min(1).max(48).nullable().optional(), currency: z.string().trim().min(1).max(12).nullable().optional(), sourceReference: z.string().trim().min(1).max(255).nullable().optional(),
});

export const industryGroupPrivateResearchRouter = router({
  listBatches: protectedProcedure.query(({ ctx }) => listPrivateIndustryBatches(ctx.user.id)),
  getDossier: protectedProcedure.input(z.object({ batchId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getPrivateIndustryDossier(ctx.user.id, input?.batchId)),
  importBatch: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120), classification: z.string().trim().min(1).max(80), sourceLabel: z.string().trim().min(1).max(160), asOfAt: z.coerce.date(), observations: z.array(importedObservation).min(1).max(2_000) }).superRefine((input, issue) => { const ids = new Set<string>(); input.observations.forEach((entry, index) => { if (ids.has(entry.recordId)) issue.addIssue({ code: 'custom', path: ['observations', index, 'recordId'], message: '同一批次 recordId 必须唯一。' }); ids.add(entry.recordId); }); })).mutation(({ ctx, input }) => importPrivateIndustryBatch(ctx.user.id, input)),
  exportBatches: protectedProcedure.input(z.object({ batchIds: z.array(z.number().int().positive()).max(100).optional() }).optional()).query(({ ctx, input }) => exportPrivateIndustryBatches(ctx.user.id, input?.batchIds)),
});

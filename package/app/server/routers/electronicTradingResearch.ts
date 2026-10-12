import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { ELECTRONIC_TRADING_EVENT_TYPES, ELECTRONIC_TRADING_REVIEW_STATUSES, exportElectronicTradingResearchBatches, getElectronicTradingQualitySettings, getElectronicTradingResearchDossier, importElectronicTradingResearchEvents, listElectronicTradingExecutionReviewAudits, listElectronicTradingExecutionReviews, listElectronicTradingResearchBatches, saveElectronicTradingExecutionReview, saveElectronicTradingQualitySettings } from '../electronicTradingResearchDb';

const importedEvent = z.object({
  eventId: z.string().trim().min(1).max(120), orderId: z.string().trim().min(1).max(120), eventType: z.enum(ELECTRONIC_TRADING_EVENT_TYPES), instrument: z.string().trim().min(1).max(120), side: z.enum(['buy', 'sell']), eventAt: z.coerce.date(),
  assetClass: z.string().trim().max(80).nullable().optional(), orderQty: z.number().finite().nonnegative().nullable().optional(), eventQty: z.number().finite().nonnegative().nullable().optional(), referencePrice: z.number().finite().positive().nullable().optional(), executionPrice: z.number().finite().positive().nullable().optional(), venue: z.string().trim().max(120).nullable().optional(), broker: z.string().trim().max(120).nullable().optional(), strategyLabel: z.string().trim().max(120).nullable().optional(), routeId: z.string().trim().max(120).nullable().optional(),
});

export const electronicTradingResearchRouter = router({
  listBatches: protectedProcedure.query(({ ctx }) => listElectronicTradingResearchBatches(ctx.user.id)),
  getDossier: protectedProcedure.input(z.object({ batchId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getElectronicTradingResearchDossier(ctx.user.id, input?.batchId)),
  importEvents: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120), sourceLabel: z.string().trim().min(1).max(160), asOfAt: z.coerce.date(), events: z.array(importedEvent).min(1).max(1000) }).superRefine((input, issue) => { const unique = new Set<string>(); input.events.forEach((event, index) => { if (unique.has(event.eventId)) issue.addIssue({ code: 'custom', path: ['events', index, 'eventId'], message: '同一批次 eventId 必须唯一。' }); unique.add(event.eventId); }); })).mutation(({ ctx, input }) => importElectronicTradingResearchEvents(ctx.user.id, input)),
  getQualitySettings: protectedProcedure.query(({ ctx }) => getElectronicTradingQualitySettings(ctx.user.id)),
  saveQualitySettings: protectedProcedure.input(z.object({ adverseDeviationThresholdBps: z.number().finite().min(0.01).max(100_000), latencyThresholdSeconds: z.number().int().min(1).max(86_400) })).mutation(({ ctx, input }) => saveElectronicTradingQualitySettings(ctx.user.id, input)),
  listReviews: protectedProcedure.input(z.object({ batchId: z.number().int().positive() })).query(({ ctx, input }) => listElectronicTradingExecutionReviews(ctx.user.id, input.batchId)),
  saveReview: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), orderId: z.string().trim().min(1).max(120), status: z.enum(ELECTRONIC_TRADING_REVIEW_STATUSES), note: z.string().trim().max(2000).nullable() })).mutation(({ ctx, input }) => saveElectronicTradingExecutionReview(ctx.user.id, input)),
  listReviewAudits: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), orderId: z.string().trim().min(1).max(120) })).query(({ ctx, input }) => listElectronicTradingExecutionReviewAudits(ctx.user.id, input.batchId, input.orderId)),
  exportBatches: protectedProcedure.input(z.object({ batchIds: z.array(z.number().int().positive()).max(100).optional() }).optional()).query(({ ctx, input }) => exportElectronicTradingResearchBatches(ctx.user.id, input?.batchIds)),
});

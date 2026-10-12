import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { listPortfolioRiskEventActionAudits, listPortfolioRiskEvents, updatePortfolioRiskEventAction } from '../portfolioRiskEventDb';
import { createPortfolioRiskResearchDossier, deletePortfolioRiskGuardrail, listPortfolioRiskGuardrailVersions, listPortfolioRiskGuardrails, listPortfolioRiskResearchDossiers, listPortfolioRiskTrendTimeline, savePortfolioRiskGuardrail } from '../portfolioRiskDossierDb';
import { deletePortfolioRiskOasViewPreset, listPortfolioRiskOasViewPresets, savePortfolioRiskOasViewPreset } from '../portfolioRiskOasPresetDb';

export const portfolioRiskRouter = router({
  listEvents: protectedProcedure.query(({ ctx }) => listPortfolioRiskEvents(ctx.user.id)),
  updateEventAction: protectedProcedure.input(z.object({ sourceEventId: z.number().int().positive(), status: z.enum(['open', 'reviewing', 'resolved']), note: z.string().max(800).optional() })).mutation(({ ctx, input }) => updatePortfolioRiskEventAction(ctx.user.id, input)),
  listActionAudits: protectedProcedure.input(z.object({ sourceEventId: z.number().int().positive().optional(), status: z.enum(['open', 'reviewing', 'resolved']).optional(), memberId: z.number().int().positive().optional(), dateFrom: z.coerce.date().optional(), dateTo: z.coerce.date().optional() })).query(({ ctx, input }) => listPortfolioRiskEventActionAudits(ctx.user.id, input)),
  listGuardrails: protectedProcedure.query(({ ctx }) => listPortfolioRiskGuardrails(ctx.user.id)),
  listGuardrailVersions: protectedProcedure.input(z.object({ guardrailId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listPortfolioRiskGuardrailVersions(ctx.user.id, input?.guardrailId)),
  listOasViewPresets: protectedProcedure.query(({ ctx }) => listPortfolioRiskOasViewPresets(ctx.user.id)),
  saveOasViewPreset: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(80), selectedBuckets: z.array(z.string().trim().min(1).max(24)).min(1).max(8), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }).refine((input) => !input.startDate || !input.endDate || input.startDate <= input.endDate, { message: 'OAS_DATE_RANGE_INVALID' })).mutation(({ ctx, input }) => savePortfolioRiskOasViewPreset({ ...input, userId: ctx.user.id })),
  deleteOasViewPreset: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deletePortfolioRiskOasViewPreset(ctx.user.id, input.id)),
  saveGuardrail: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(120), maxPortfolioDuration: z.number().positive().max(100).nullable().optional(), maxDv01: z.number().positive().max(1_000_000_000_000).nullable().optional(), maxScenarioLoss: z.number().positive().max(1_000_000_000_000).nullable().optional(), alertThresholdPct: z.number().int().min(50).max(100).default(80), isActive: z.boolean().default(true) })).mutation(({ ctx, input }) => savePortfolioRiskGuardrail({ ...input, userId: ctx.user.id })),
  deleteGuardrail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deletePortfolioRiskGuardrail(ctx.user.id, input.id)),
  listDossiers: protectedProcedure.query(({ ctx }) => listPortfolioRiskResearchDossiers(ctx.user.id)),
  listTrendTimeline: protectedProcedure.query(({ ctx }) => listPortfolioRiskTrendTimeline(ctx.user.id)),
  createDossier: protectedProcedure.input(z.object({ snapshotId: z.number().int().positive(), guardrailId: z.number().int().positive().optional(), scenario: z.enum(['parallel', 'steepener', 'butterfly']).default('parallel'), magnitudeBp: z.number().int().min(-500).max(500).default(50) })).mutation(({ ctx, input }) => createPortfolioRiskResearchDossier({ ...input, userId: ctx.user.id })),
});

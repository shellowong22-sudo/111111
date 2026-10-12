import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { analyzeBondPortfolio } from '../bondPortfolioRisk';
import { deleteBondPortfolioImportTemplate, getBondPortfolioImportTemplates, saveBondPortfolioImportTemplate } from '../db';
import { deleteBondPortfolioScenarioSnapshot, listBondPortfolioScenarioSnapshots, saveBondPortfolioScenarioSnapshot } from '../bondPortfolioScenarioDb';

const positionSchema = z.object({
  identifier: z.string().trim().min(1).max(128),
  faceValue: z.number().positive().max(1_000_000_000_000),
  couponRate: z.number().min(-5).max(50),
  maturityYears: z.number().positive().max(100),
  yieldToMaturity: z.number().min(-5).max(100),
  frequency: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(2),
  bidAskSpreadBps: z.number().nonnegative().max(100_000).optional(),
  averageDailyVolume: z.number().nonnegative().max(1_000_000_000_000).optional(),
  liquidityScore: z.number().min(0).max(100).optional(),
  lastTradeAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const bondPortfolioRouter = router({
  templates: protectedProcedure.query(({ ctx }) => getBondPortfolioImportTemplates(ctx.user.id)),
  saveTemplate: protectedProcedure.input(z.object({
    name: z.string().trim().min(1).max(120),
    mapping: z.record(z.string().max(120), z.string().max(40)),
  })).mutation(async ({ ctx, input }) => saveBondPortfolioImportTemplate({ ...input, userId: ctx.user.id })),
  deleteTemplate: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ deleted: await deleteBondPortfolioImportTemplate(ctx.user.id, input.id) })),
  snapshots: protectedProcedure.query(({ ctx }) => listBondPortfolioScenarioSnapshots(ctx.user.id)),
  saveSnapshot: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(120), positions: z.array(positionSchema).min(1).max(500), magnitudeBp: z.number().int().min(-500).max(500) })).mutation(({ ctx, input }) => saveBondPortfolioScenarioSnapshot({ ...input, userId: ctx.user.id })),
  deleteSnapshot: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteBondPortfolioScenarioSnapshot(ctx.user.id, input.id)),
  analyze: protectedProcedure.input(z.object({
    positions: z.array(positionSchema).min(1).max(500),
    scenario: z.enum(['parallel', 'steepener', 'butterfly']).default('parallel'),
    magnitudeBp: z.number().min(-500).max(500).default(50),
  })).query(({ input }) => ({
    ...analyzeBondPortfolio(input.positions, input.scenario, input.magnitudeBp),
    asOf: new Date().toISOString(),
    methodology: '固定票息现金流折现；修正久期与凸性基于同一到期收益率；情景损益为一阶久期加二阶凸性近似，未包含应计利息、信用利差、流动性、税费、外汇、期权性或曲线关键期限交叉项。',
  })),
});

import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { nceoSimulationAuditEvents, nceoSimulationPositions } from '../../drizzle/schema';
import { getDb } from '../db';
import { protectedProcedure, router } from '../_core/trpc';

const sourceBoundary = 'NCEO 仅保存当前登录用户主动创建的模拟期权研究记录；不代表交易所成交、券商账户、真实持仓、可执行委托或监管报送。';
const modelParametersSchema = z.object({
  strike: z.number().finite().positive(),
  expiryDays: z.number().int().min(1).max(365),
  isCall: z.boolean(),
  iv: z.number().finite().min(0).max(500),
  delta: z.number().finite().min(-2).max(2),
  spread: z.number().finite().min(0).max(100000),
  modelGeneratedAt: z.string().datetime(),
});

export const nceoSimulationRouter = router({
  getLedger: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, positions: [], events: [], advancedSignalEligible: false, sourceBoundary: '数据库当前不可用；不会以浏览器缓存伪造已保存的模拟仓位或审计记录。' };
    const [positions, events] = await Promise.all([
      db.select().from(nceoSimulationPositions).where(eq(nceoSimulationPositions.userId, ctx.user.id)).orderBy(desc(nceoSimulationPositions.createdAt)).limit(100),
      db.select().from(nceoSimulationAuditEvents).where(eq(nceoSimulationAuditEvents.userId, ctx.user.id)).orderBy(desc(nceoSimulationAuditEvents.createdAt)).limit(180),
    ]);
    return { status: 'available' as const, positions, events, advancedSignalEligible: ['admin', 'trader', 'risk_manager'].includes(ctx.user.role), sourceBoundary };
  }),

  createPosition: protectedProcedure.input(z.object({
    symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.^=-]{1,15}$/),
    contractLabel: z.string().trim().min(3).max(160),
    direction: z.enum(['long', 'short']),
    referencePrice: z.number().finite().positive().max(1_000_000),
    quantity: z.number().int().min(1).max(100_000),
    modelBasis: z.string().trim().min(3).max(160),
    parameters: modelParametersSchema,
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, position: null, sourceBoundary: '数据库当前不可用；未创建模拟仓位，也未替换为本地伪持仓。' };
    const createdAt = new Date();
    const write = await db.insert(nceoSimulationPositions).values({
      userId: ctx.user.id, symbol: input.symbol, contractLabel: input.contractLabel, direction: input.direction,
      referencePrice: input.referencePrice.toFixed(8), quantity: input.quantity, modelBasis: input.modelBasis,
      sourceBoundary, parameters: input.parameters, status: 'open', createdAt, updatedAt: createdAt,
    });
    const positionId = Number((write as unknown as { insertId?: number })?.insertId ?? 0) || null;
    await db.insert(nceoSimulationAuditEvents).values({
      userId: ctx.user.id, positionId, action: 'position_created', eventSummary: `创建 ${input.direction === 'long' ? '多头' : '空头'} NCEO 模拟仓位：${input.contractLabel}`,
      parameters: { ...input.parameters, referencePrice: input.referencePrice, quantity: input.quantity, modelBasis: input.modelBasis }, sourceBoundary, createdAt,
    });
    return { status: 'available' as const, positionId, sourceBoundary };
  }),

  closePosition: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, sourceBoundary: '数据库当前不可用；未变更模拟仓位状态。' };
    const result = await db.update(nceoSimulationPositions).set({ status: 'closed', updatedAt: new Date() }).where(and(eq(nceoSimulationPositions.id, input.id), eq(nceoSimulationPositions.userId, ctx.user.id)));
    const changed = Number((result as unknown as { affectedRows?: number })?.affectedRows ?? 0) > 0;
    if (changed) await db.insert(nceoSimulationAuditEvents).values({ userId: ctx.user.id, positionId: input.id, action: 'position_closed', eventSummary: `关闭 NCEO 模拟仓位 #${input.id}`, parameters: { positionId: input.id }, sourceBoundary, createdAt: new Date() });
    return { status: changed ? 'available' as const : 'missing' as const, sourceBoundary };
  }),

  recordModelRefresh: protectedProcedure.input(z.object({
    symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.^=-]{1,15}$/),
    expiryDays: z.number().int().min(1).max(365),
    isCall: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, sourceBoundary: '数据库当前不可用；未登记 NCEO 模型重算动作。' };
    await db.insert(nceoSimulationAuditEvents).values({ userId: ctx.user.id, positionId: null, action: 'model_refreshed', eventSummary: `重新计算 NCEO 模型：${input.symbol} ${input.expiryDays}D ${input.isCall ? 'Call' : 'Put'}`, parameters: input, sourceBoundary, createdAt: new Date() });
    return { status: 'available' as const, sourceBoundary };
  }),

  recordCsvExport: protectedProcedure.input(z.object({ rowCount: z.number().int().min(0).max(10_000) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, sourceBoundary: '数据库当前不可用；未登记 CSV 导出动作。' };
    await db.insert(nceoSimulationAuditEvents).values({ userId: ctx.user.id, positionId: null, action: 'csv_exported', eventSummary: `导出 NCEO 模拟记录 CSV（${input.rowCount} 行）`, parameters: { rowCount: input.rowCount }, sourceBoundary, createdAt: new Date() });
    return { status: 'available' as const, sourceBoundary };
  }),
});

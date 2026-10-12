/**
 * crvfWatchlist.ts — CRVF 优先股曲线「监控清单」CRUD Router
 * 持久化到 crvf_watchlist 表（per-user）
 */
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { crvfWatchlist } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db';

export const crvfWatchlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user) throw new Error('Database or user not available');
    return db
      .select()
      .from(crvfWatchlist)
      .where(eq(crvfWatchlist.userId, ctx.user.id))
      .orderBy(desc(crvfWatchlist.createdAt));
  }),

  add: protectedProcedure
    .input(z.object({
      curveId: z.string().min(1).max(64),
      curveName: z.string().min(1).max(255),
      note: z.string().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user) throw new Error('Database or user not available');
      // 已存在则忽略（唯一约束）
      const existing = await db
        .select()
        .from(crvfWatchlist)
        .where(and(eq(crvfWatchlist.userId, ctx.user.id), eq(crvfWatchlist.curveId, input.curveId)))
        .limit(1);
      if (existing.length > 0) return { success: true, duplicated: true };
      await db.insert(crvfWatchlist).values({
        userId: ctx.user.id,
        curveId: input.curveId,
        curveName: input.curveName,
        note: input.note ?? null,
      });
      return { success: true, duplicated: false };
    }),

  remove: protectedProcedure
    .input(z.object({ curveId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user) throw new Error('Database or user not available');
      await db
        .delete(crvfWatchlist)
        .where(and(eq(crvfWatchlist.userId, ctx.user.id), eq(crvfWatchlist.curveId, input.curveId)));
      return { success: true };
    }),

  updateNote: protectedProcedure
    .input(z.object({ curveId: z.string().min(1).max(64), note: z.string().max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user) throw new Error('Database or user not available');
      await db
        .update(crvfWatchlist)
        .set({ note: input.note })
        .where(and(eq(crvfWatchlist.userId, ctx.user.id), eq(crvfWatchlist.curveId, input.curveId)));
      return { success: true };
    }),
});

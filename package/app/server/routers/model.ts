import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { modelRunHistory } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const modelRouter = router({
  saveRun: protectedProcedure
    .input(z.object({
      modelId: z.string().max(64),
      modelLabel: z.string().max(128),
      modelColor: z.string().max(32).default("#3b82f6"),
      params: z.record(z.string(), z.number()),
      mae: z.number(),
      rmse: z.number(),
      mape: z.number(),
      accuracy: z.number(),
      seed: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(modelRunHistory).values({
        userId: ctx.user.id,
        modelId: input.modelId,
        modelLabel: input.modelLabel,
        modelColor: input.modelColor,
        params: input.params,
        mae: input.mae.toString(),
        rmse: input.rmse.toString(),
        mape: input.mape.toString(),
        accuracy: input.accuracy.toString(),
        seed: input.seed,
      });
      return { success: true };
    }),

  listRuns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(modelRunHistory)
      .where(eq(modelRunHistory.userId, ctx.user.id))
      .orderBy(desc(modelRunHistory.createdAt))
      .limit(20);
    return rows.map(r => ({
      id: r.id,
      modelId: r.modelId,
      modelLabel: r.modelLabel,
      modelColor: r.modelColor,
      params: r.params as Record<string, number>,
      metrics: {
        mae: parseFloat(r.mae as string),
        rmse: parseFloat(r.rmse as string),
        mape: parseFloat(r.mape as string),
        accuracy: parseFloat(r.accuracy as string),
      },
      seed: r.seed,
      timestamp: r.createdAt.toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  }),

  deleteRun: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Only delete own records
      await db
        .delete(modelRunHistory)
        .where(eq(modelRunHistory.id, input.id));
      return { success: true };
    }),
});

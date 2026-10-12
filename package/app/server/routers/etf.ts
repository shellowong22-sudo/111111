import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { etfProducts, etfHoldings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const etfRouter = router({
  getDetail: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      let result = await db.select().from(etfProducts).where(eq(etfProducts.symbol, input.id)).limit(1);
      if (result.length === 0) {
        const numId = parseInt(input.id);
        if (!isNaN(numId)) {
          result = await db.select().from(etfProducts).where(eq(etfProducts.id, numId)).limit(1);
        }
      }
      return result.length > 0 ? result[0] : null;
    }),

  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(etfProducts);
  }),

  getHoldings: publicProcedure
    .input(z.object({ etfId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(etfHoldings)
        .where(eq(etfHoldings.etfId, input.etfId));
      return rows
        .map(r => ({
          id: r.id,
          name: r.holdingName,
          type: r.holdingType || "其他",
          weight: parseFloat(r.weight as string),
        }))
        .sort((a, b) => b.weight - a.weight);
    }),

  // ─── Admin CRUD for ETF Holdings ─────────────────────────────────────────────
  getAllHoldings: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: etfHoldings.id,
        etfId: etfHoldings.etfId,
        holdingName: etfHoldings.holdingName,
        holdingType: etfHoldings.holdingType,
        weight: etfHoldings.weight,
        createdAt: etfHoldings.createdAt,
        etfSymbol: etfProducts.symbol,
        etfName: etfProducts.name,
      })
      .from(etfHoldings)
      .leftJoin(etfProducts, eq(etfHoldings.etfId, etfProducts.id))
      .orderBy(etfHoldings.etfId);
    return rows.map(r => ({
      ...r,
      weight: parseFloat(r.weight as string),
    }));
  }),

  createHolding: protectedProcedure
    .input(z.object({
      etfId: z.number().int().positive(),
      holdingName: z.string().min(1).max(255),
      holdingType: z.string().max(100).optional(),
      weight: z.number().min(0).max(100),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(etfHoldings).values({
        etfId: input.etfId,
        holdingName: input.holdingName,
        holdingType: input.holdingType ?? null,
        weight: input.weight.toString(),
      });
      return { success: true };
    }),

  updateHolding: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      holdingName: z.string().min(1).max(255).optional(),
      holdingType: z.string().max(100).optional(),
      weight: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      const updateData: Record<string, unknown> = {};
      if (updates.holdingName !== undefined) updateData.holdingName = updates.holdingName;
      if (updates.holdingType !== undefined) updateData.holdingType = updates.holdingType;
      if (updates.weight !== undefined) updateData.weight = updates.weight.toString();
      if (Object.keys(updateData).length === 0) return { success: true };
      await db.update(etfHoldings).set(updateData).where(eq(etfHoldings.id, id));
      return { success: true };
    }),

  deleteHolding: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(etfHoldings).where(eq(etfHoldings.id, input.id));
      return { success: true };
    }),
});

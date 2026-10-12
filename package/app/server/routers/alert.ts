import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const ruleTypeSchema = z.enum([
  "price_above",
  "price_below",
  "var_above",
  "var_below",
  "return_above",
  "return_below",
  "volatility_above",
  "volatility_below",
]);

const numericText = z.string().trim().min(1).refine(
  value => Number.isFinite(Number(value)),
  { message: "阈值必须是有效数字" },
);

type AlertRuleType = z.infer<typeof ruleTypeSchema>;

export function shouldTrigger(ruleType: AlertRuleType, threshold: number, currentValue: number) {
  if (!Number.isFinite(threshold) || !Number.isFinite(currentValue)) return false;

  switch (ruleType) {
    case "price_above":
    case "var_above":
    case "return_above":
    case "volatility_above":
      return currentValue >= threshold;
    case "price_below":
    case "var_below":
    case "return_below":
    case "volatility_below":
      return currentValue <= threshold;
  }
}

export const alertRouter = router({
  listRules: protectedProcedure
    .input(z.object({
      portfolioId: z.string().trim().min(1).max(36).optional(),
      symbol: z.string().trim().min(1).max(20).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const [rows] = await db.execute(sql`
        SELECT id, portfolio_id AS portfolioId, symbol, rule_type AS ruleType,
               threshold, is_active AS isActive, last_triggered_at AS lastTriggeredAt,
               created_at AS createdAt, updated_at AS updatedAt
        FROM alert_rules
        WHERE user_id = ${ctx.user.id}
          AND (${input.portfolioId ?? null} IS NULL OR portfolio_id = ${input.portfolioId ?? null})
          AND (${input.symbol ?? null} IS NULL OR symbol = ${input.symbol ?? null})
        ORDER BY created_at DESC
      `) as any;

      return (rows as any[]).map(rule => ({
        ...rule,
        isActive: Boolean(rule.isActive),
      }));
    }),

  createRule: protectedProcedure
    .input(z.object({
      portfolioId: z.string().trim().min(1).max(36).optional(),
      symbol: z.string().trim().min(1).max(20),
      ruleType: ruleTypeSchema,
      threshold: numericText,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      const id = randomUUID();
      const now = Date.now();
      await db.execute(sql`
        INSERT INTO alert_rules
          (id, user_id, portfolio_id, symbol, rule_type, threshold, is_active, created_at, updated_at)
        VALUES
          (${id}, ${ctx.user.id}, ${input.portfolioId ?? null}, ${input.symbol}, ${input.ruleType}, ${input.threshold}, 1, ${now}, ${now})
      `);

      return {
        id,
        symbol: input.symbol,
        ruleType: input.ruleType,
        threshold: input.threshold,
        isActive: true,
      };
    }),

  deleteRule: protectedProcedure
    .input(z.object({ ruleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      const [result] = await db.execute(sql`
        DELETE FROM alert_rules WHERE id = ${input.ruleId} AND user_id = ${ctx.user.id}
      `) as any;

      return { success: true, deleted: Number(result?.affectedRows ?? 0) > 0 };
    }),

  triggerAlert: protectedProcedure
    .input(z.object({
      ruleId: z.string().uuid(),
      currentValue: numericText,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      const [rows] = await db.execute(sql`
        SELECT id, user_id AS userId, symbol, rule_type AS ruleType, threshold, is_active AS isActive
        FROM alert_rules
        WHERE id = ${input.ruleId} AND user_id = ${ctx.user.id}
        LIMIT 1
      `) as any;
      const rule = (rows as any[])[0];
      if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "未找到该预警规则" });
      if (!Boolean(rule.isActive)) return { triggered: false, message: "预警规则已关闭，未触发" };

      const triggered = shouldTrigger(
        rule.ruleType as AlertRuleType,
        Number(rule.threshold),
        Number(input.currentValue),
      );
      if (!triggered) return { triggered: false, message: "当前值未达到预警条件" };

      const now = Date.now();
      const triggerId = randomUUID();
      await db.execute(sql`
        INSERT INTO alert_triggers
          (id, rule_id, user_id, symbol, current_value, threshold, triggered_at)
        VALUES
          (${triggerId}, ${rule.id}, ${ctx.user.id}, ${rule.symbol}, ${input.currentValue}, ${String(rule.threshold)}, ${now})
      `);
      await db.execute(sql`
        UPDATE alert_rules SET last_triggered_at = ${now}, updated_at = ${now}
        WHERE id = ${rule.id} AND user_id = ${ctx.user.id}
      `);

      return { triggered: true, triggerId, message: `预警已触发：${rule.symbol}` };
    }),
});

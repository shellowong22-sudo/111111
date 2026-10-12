/**
 * 前端读取已发布的佑诚数据模块。只返回前端视图：已脱敏、无任何来源字段。
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { ucSlotsForPath } from "@shared/ucheerModules";
import { publishedModulesForSlots } from "../uc/modules";
import { exec, query } from "../uc/store";

function userKey(ctx: { user?: { id?: number } | null; req?: { ip?: string; socket?: { remoteAddress?: string } } }) {
  const raw = ctx.user?.id ? `u${ctx.user.id}` : `ip${ctx.req?.ip ?? ctx.req?.socket?.remoteAddress ?? "anon"}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

export const ucModulesRouter = router({
  forPath: publicProcedure.input(z.object({ path: z.string().max(300) })).query(async ({ input, ctx }) => {
    const slots = ucSlotsForPath(input.path);
    if (!slots.length) return { slots, modules: [] };
    try {
      return { slots, modules: await publishedModulesForSlots(slots, userKey(ctx as never)) };
    } catch (error) {
      console.warn("[uc] 前端取数失败", error instanceof Error ? error.message : error);
      return { slots, modules: [] };
    }
  }),

  track: publicProcedure.input(z.object({ code: z.string().max(64), event: z.enum(["view", "interact", "export"]) })).mutation(async ({ input, ctx }) => {
    try {
      const [m] = await query<{ id: number }>(sql`SELECT id FROM uc_modules WHERE code = ${input.code}`);
      if (m) await exec(sql`INSERT INTO uc_module_events (module_id, event, user_hash) VALUES (${m.id}, ${input.event}, ${userKey(ctx as never)})`);
    } catch {
      /* 统计失败不影响前端 */
    }
    return { ok: true };
  }),
});

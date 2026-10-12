import { z } from "zod";
import { ADMIN_DATA_MODULE_IDS } from "../../shared/adminDataModules";
import { adminProcedure, router } from "../_core/trpc";
import {
  cancelScraplingRun,
  exportScraplingRun,
  getScraplingDashboard,
  getScraplingHealth,
  inspectScraplingSource,
  parseScraplingRun,
  pauseScraplingRun,
  pushScraplingRun,
  resumeScraplingRun,
  startScraplingRun,
} from "../scraplingAdminService";

const runId = z.string().regex(/^scr_[a-z0-9]+_[a-f0-9]{20}$/);
const publicUrl = z.string().url().max(1800);

export const adminScraplingRouter = router({
  dashboard: adminProcedure.query(({ ctx }) => getScraplingDashboard(ctx.user.id)),
  health: adminProcedure
    .input(z.object({ force: z.boolean().default(false) }))
    .query(({ input }) => getScraplingHealth(input.force)),
  inspectSource: adminProcedure
    .input(z.object({ url: publicUrl }))
    .mutation(({ input }) => inspectScraplingSource(input.url)),
  start: adminProcedure
    .input(z.object({
      taskKind: z.enum(["fetch", "crawl"]),
      mode: z.enum(["static", "dynamic", "stealth"]),
      urls: z.array(publicUrl).min(1).max(20),
      selectorType: z.enum(["css", "xpath"]).default("css"),
      selector: z.string().max(1000).default(""),
      adaptive: z.boolean().default(false),
      networkIdle: z.boolean().default(true),
      disableResources: z.boolean().default(true),
      timeoutMs: z.number().int().min(3000).max(120000).default(30000),
      maxPages: z.number().int().min(1).max(100).default(10),
      concurrency: z.number().int().min(1).max(8).default(2),
      delayMs: z.number().int().min(250).max(60000).default(750),
      language: z.string().trim().max(24).optional(),
    }).superRefine((value, ctx) => {
      if (value.taskKind === "crawl" && value.urls.length !== 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["urls"], message: "Spider 任务只能有一个入口；批量地址请使用 Fetcher。" });
      }
    }))
    .mutation(({ ctx, input }) => startScraplingRun(input, ctx.user.id)),
  pause: adminProcedure
    .input(z.object({ runId }))
    .mutation(({ input }) => pauseScraplingRun(input.runId)),
  resume: adminProcedure
    .input(z.object({ runId }))
    .mutation(({ ctx, input }) => resumeScraplingRun(input.runId, ctx.user.id)),
  cancel: adminProcedure
    .input(z.object({ runId }))
    .mutation(({ input }) => cancelScraplingRun(input.runId)),
  parse: adminProcedure
    .input(z.object({
      runId,
      itemIndex: z.number().int().min(0).max(499),
      selectorType: z.enum(["css", "xpath"]),
      selector: z.string().trim().min(1).max(1000),
      adaptive: z.boolean().default(false),
    }))
    .mutation(({ input }) => parseScraplingRun(input)),
  export: adminProcedure
    .input(z.object({ runId, format: z.enum(["json", "jsonl", "csv", "xml"]) }))
    .mutation(({ input }) => exportScraplingRun(input.runId, input.format)),
  push: adminProcedure
    .input(z.object({ runId, moduleIds: z.array(z.enum(ADMIN_DATA_MODULE_IDS)).min(1).max(140), recipientUserIds: z.array(z.number().int().positive()).min(1).max(200) }))
    .mutation(({ ctx, input }) => pushScraplingRun({
      runId: input.runId,
      moduleIds: input.moduleIds,
      recipientUserIds: input.recipientUserIds,
      actorUserId: ctx.user.id,
      operator: ctx.user.name || ctx.user.email || `管理员#${ctx.user.id}`,
    })),
});

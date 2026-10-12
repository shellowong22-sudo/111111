import { z } from "zod";
import { ADMIN_DATA_MODULE_IDS } from "@shared/adminDataModules";
import { adminProcedure, router } from "../_core/trpc";
import {
  checkSpiderSeeds,
  createAiDiscoveredSpiderSeed,
  createSpiderSeed,
  createSpiderTask,
  deleteSpiderSeed,
  deleteSpiderTask,
  executeSpiderTask,
  exportSpiderLogs,
  getSpiderDashboard,
  getSpiderLineage,
  initializeSpiderPlatform,
  listSpiderTools,
  listSpiderWorldData,
  manuallyPushSpiderData,
  retrySpiderFailures,
  runSpiderAiAction,
  runSpiderGapScan,
  updateSpiderSeed,
  updateSpiderTask,
} from "../spiderPlatform";

const taskUuid = z.string().regex(/^task_[a-f0-9]{32,64}$/);
const seedUuid = z.string().regex(/^seed_[a-f0-9]{32,64}$/);
const failUuid = z.string().regex(/^fail_[a-f0-9]{32,64}$/);
const publicUrl = z.string().url().max(1800);

export const adminSpiderRouter = router({
  initialize: adminProcedure.mutation(({ ctx }) =>
    initializeSpiderPlatform(ctx.user.id)
  ),
  dashboard: adminProcedure.query(async ({ ctx }) => {
    // 每次打开后台先补齐官方来源目录；初始化为幂等操作，不覆盖管理员配置。
    await initializeSpiderPlatform(ctx.user.id);
    return getSpiderDashboard(ctx.user.id);
  }),
  listWorldData: adminProcedure
    .input(
      z.object({
        query: z.string().trim().max(120).optional(),
        topType: z.string().trim().max(80).optional(),
        assetType: z.string().trim().max(80).optional(),
        quality: z.string().trim().max(16).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(60),
      })
    )
    .query(({ input }) => listSpiderWorldData(input)),
  listTools: adminProcedure
    .input(
      z.object({
        query: z.string().trim().max(120).optional(),
        category: z.string().trim().max(100).optional(),
        risk: z.string().trim().max(24).optional(),
        market: z.string().trim().max(80).optional(),
        assetType: z.string().trim().max(80).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(100),
      })
    )
    .query(({ input }) => listSpiderTools(input)),

  createTask: adminProcedure
    .input(
      z.object({
        taskName: z.string().trim().min(2).max(255),
        taskType: z.string().trim().min(2).max(80),
        seedUuid: seedUuid.optional(),
        carrierType: z.enum([
          "html_js",
          "rss_atom",
          "rest",
          "graphql",
          "soap",
          "websocket",
          "sse",
          "pdf_ocr",
          "image_ocr",
          "dataset",
          "ftp",
          "archive",
          "chain_rpc",
          "multi_source",
        ]),
        priorityLevel: z.enum(["high", "normal", "low"]),
        scheduleLevel: z.enum([
          "minute",
          "hourly",
          "daily",
          "weekly",
          "monthly",
          "gap_scan",
        ]),
        aiEnabled: z.boolean(),
        backfillEnabled: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) =>
      createSpiderTask({ ...input, actorUserId: ctx.user.id })
    ),
  updateTask: adminProcedure
    .input(
      z.object({
        taskUuid,
        taskName: z.string().trim().min(2).max(255).optional(),
        priorityLevel: z.enum(["high", "normal", "low"]).optional(),
        scheduleLevel: z
          .enum(["minute", "hourly", "daily", "weekly", "monthly", "gap_scan"])
          .optional(),
        aiEnabled: z.boolean().optional(),
        backfillEnabled: z.boolean().optional(),
        status: z
          .enum(["paused", "queued", "running", "completed", "failed"])
          .optional(),
      })
    )
    .mutation(({ input }) => updateSpiderTask(input)),
  setTaskStatus: adminProcedure
    .input(z.object({ taskUuid, status: z.enum(["paused", "queued"]) }))
    .mutation(({ input }) => updateSpiderTask(input)),
  deleteTask: adminProcedure
    .input(z.object({ taskUuid }))
    .mutation(({ input }) => deleteSpiderTask(input.taskUuid)),
  executeTask: adminProcedure
    .input(z.object({ taskUuid }))
    .mutation(({ input }) => executeSpiderTask(input.taskUuid)),

  createSeed: adminProcedure
    .input(
      z.object({
        seedUrl: publicUrl,
        sourceName: z.string().trim().min(2).max(255),
        sourceCategory: z.string().trim().min(2).max(80),
        language: z.string().trim().max(24).optional(),
        region: z.string().trim().max(80).optional(),
        crawlDepth: z.number().int().min(0).max(10).default(1),
        priority: z.number().int().min(1).max(1000).default(100),
      })
    )
    .mutation(({ input }) => createSpiderSeed(input)),
  createAiSeed: adminProcedure
    .input(
      z.object({
        seedUrl: publicUrl,
        sourceName: z.string().trim().min(2).max(255),
        sourceCategory: z.string().trim().min(2).max(80),
        discoverySourceUuid: z.string().trim().min(3).max(64),
      })
    )
    .mutation(({ input }) => createAiDiscoveredSpiderSeed(input)),
  updateSeed: adminProcedure
    .input(
      z.object({
        seedUuid,
        sourceName: z.string().trim().min(2).max(255).optional(),
        sourceCategory: z.string().trim().min(2).max(80).optional(),
        priority: z.number().int().min(1).max(1000).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => updateSpiderSeed(input)),
  deleteSeed: adminProcedure
    .input(z.object({ seedUuid }))
    .mutation(({ input }) => deleteSpiderSeed(input.seedUuid)),
  checkSeeds: adminProcedure
    .input(z.object({ seedUuids: z.array(seedUuid).max(30).default([]) }))
    .mutation(({ input }) => checkSpiderSeeds(input.seedUuids)),

  runAi: adminProcedure
    .input(
      z.object({
        rawUuid: z.string().regex(/^raw_[a-f0-9]{32,64}$/),
        action: z.enum([
          "entity_extract",
          "formula_parse",
          "news_rewrite",
          "quality_validate",
          "entity_complete",
          "version_compare",
        ]),
        rewriteStyle: z
          .enum(["plain_language", "conversational", "brief"])
          .optional(),
      })
    )
    .mutation(({ input }) => runSpiderAiAction(input)),
  runGapScan: adminProcedure.mutation(({ ctx }) =>
    runSpiderGapScan(ctx.user.id)
  ),
  retryFailures: adminProcedure
    .input(z.object({ failUuids: z.array(failUuid).min(1).max(50) }))
    .mutation(({ input }) => retrySpiderFailures(input.failUuids)),
  manualPush: adminProcedure
    .input(
      z.object({
        data: z
          .array(
            z.object({
              uuid: z.string().min(8).max(64),
              collection: z.enum([
                "finance_world_dataset",
                "finance_tool_union_set",
              ]),
            })
          )
          .min(1)
          .max(200),
        moduleIds: z.array(z.enum(ADMIN_DATA_MODULE_IDS)).min(1).max(140),
      })
    )
    .mutation(({ ctx, input }) =>
      manuallyPushSpiderData({
        ...input,
        actorUserId: ctx.user.id,
        operator: ctx.user.name || ctx.user.email || `管理员#${ctx.user.id}`,
      })
    ),
  lineage: adminProcedure
    .input(z.object({ dataUuid: z.string().min(8).max(64) }))
    .query(({ input }) => getSpiderLineage(input.dataUuid)),
  exportLogs: adminProcedure.query(() => exportSpiderLogs()),
});

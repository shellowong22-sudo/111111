import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  adminMarketDataProviderConfigs,
  adminMarketIngestionTargets,
  marketDataObservationHistory,
} from "../../drizzle/schema";
import { adminProcedure, router } from "../_core/trpc";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import {
  auditAdminMarketIngestion,
  listAdminMarketIngestionEvents,
  listAdminMarketTargets,
  syncAdminMarketTarget,
} from "../adminMarketIngestion";
import {
  listFreeMarketDataSources,
  listOptionalMarketDataSources,
} from "../freeMarketData";
import { GLOBAL_API_PROVIDER_CATALOG, GLOBAL_API_PROVIDER_SUMMARY } from "../../shared/globalApiProviderCatalog";
import { GLOBAL_API_CANDIDATES, GLOBAL_API_CANDIDATE_SUMMARY } from "../globalApiCandidateCatalog";
import { getDb } from "../db";
import {
  getIfindProviderStatus,
  probeIfindConnection,
} from "../ifindMarketData";
import {
  enableManagedPublicDatasetSchedule,
  getManagedPublicDatasetSchedule,
  listManagedPublicDatasets,
  listManagedPublicDatasetStates,
  MANAGED_PUBLIC_DATASETS,
  pauseManagedPublicDatasetSchedule,
  syncAllManagedPublicDatasets,
  syncManagedPublicDataset,
} from "../adminPublicDatasetIngestion";

const targetInput = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .transform(value => value.toUpperCase()),
  displayName: z.string().trim().min(2).max(120),
  marketType: z
    .enum(["stock", "etf", "index", "forex", "commodity", "bond", "fund"])
    .default("stock"),
  historyRange: z.enum(["5d", "1mo", "3mo"]).default("3mo"),
  isActive: z.boolean().default(true),
});
const providerInput = z.object({
  providerCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{2,47}$/)
    .optional(),
  providerName: z.string().trim().min(2).max(120),
  apiBaseUrl: z
    .string()
    .url()
    .max(1200)
    .refine(value => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !["localhost", "0.0.0.0", "::1"].includes(url.hostname.toLowerCase())
        );
      } catch {
        return false;
      }
    }, "API 地址必须是无凭据的公开 HTTPS 地址"),
  apiKeyEnvName: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{2,79}$/),
  marketCoverage: z
    .array(z.string().trim().min(1).max(32))
    .max(12)
    .optional()
    .default([]),
  delayLevel: z
    .enum(["unknown", "realtime", "delayed", "end_of_day"])
    .default("unknown"),
  capabilities: z
    .array(z.string().trim().min(1).max(48))
    .max(12)
    .optional()
    .default([]),
});
const scheduleInterval = z.union([
  z.literal(1),
  z.literal(5),
  z.literal(10),
  z.literal(30),
  z.literal(60),
  z.literal(360),
  z.literal(720),
  z.literal(1440),
]);
const toCronExpression = (minutes: 1 | 5 | 10 | 30 | 60 | 360 | 720 | 1440) =>
  ({
    1: "0 * * * * *",
    5: "0 */5 * * * *",
    10: "0 */10 * * * *",
    30: "0 */30 * * * *",
    60: "0 0 * * * *",
    360: "0 0 */6 * * *",
    720: "0 0 */12 * * *",
    1440: "0 0 0 * * *",
  })[minutes];
const providerCodeFromName = (name: string) => {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (base.length >= 3 ? base : `${base || "API"}_PROVIDER`).slice(0, 48);
};

export const adminMarketIngestionRouter = router({
  providerCatalog: adminProcedure.query(async () => {
    const states = await listManagedPublicDatasetStates();
    const stateById = new Map(states.map(state => [state.datasetId, state]));
    const db = await getDb();
    const contracts = MANAGED_PUBLIC_DATASETS.map(item => item.dataContractId);
    const archived = db ? await db.select({
      moduleId: marketDataObservationHistory.moduleId,
      dataContractId: marketDataObservationHistory.dataContractId,
      latestObservationDate: sql<string>`max(${marketDataObservationHistory.observationDate})`,
      lastPersistedAt: sql<Date>`max(${marketDataObservationHistory.fetchedAt})`,
      storedVersions: sql<number>`count(*)`,
    }).from(marketDataObservationHistory)
      .where(inArray(marketDataObservationHistory.dataContractId, contracts))
      .groupBy(marketDataObservationHistory.moduleId, marketDataObservationHistory.dataContractId) : null;
    const archiveByOwner = new Map(archived?.map(row => [`${row.moduleId}|${row.dataContractId}`, row]));
    return {
      retrievedAt: new Date().toISOString(),
      freeSources: listFreeMarketDataSources(),
      globalProviderSources: GLOBAL_API_PROVIDER_CATALOG,
      globalProviderSummary: GLOBAL_API_PROVIDER_SUMMARY,
      userCatalogCandidates: GLOBAL_API_CANDIDATES,
      userCatalogSummary: GLOBAL_API_CANDIDATE_SUMMARY,
      optionalSources: listOptionalMarketDataSources().map(source => ({
        ...source,
        configured: Boolean(process.env[source.apiKeyEnvName]?.trim()),
      })),
      localSdkSources: [getIfindProviderStatus()],
      managedDatasets: listManagedPublicDatasets().map(dataset => ({
        ...dataset,
        state: stateById.get(dataset.id) ?? null,
        archive: archived === null ? null : archiveByOwner.get(`${dataset.moduleId}|${dataset.dataContractId}`) ?? {
          latestObservationDate: null,
          lastPersistedAt: null,
          storedVersions: 0,
        },
      })),
      managedDatasetSchedule: await getManagedPublicDatasetSchedule(),
      limitation:
        "免密来源为公开发布/日终或官方参考数据；需密钥的免费额度服务只有在真实密钥和实际响应验证后才可启用。",
    };
  }),
  testIfindConnection: adminProcedure.mutation(() => probeIfindConnection()),
  listTargets: adminProcedure.query(() => listAdminMarketTargets()),
  listObservationHistory: adminProcedure
    .input(
      z
        .object({
          symbol: z
            .string()
            .trim()
            .min(1)
            .max(32)
            .transform(value => value.toUpperCase())
            .optional(),
          moduleId: z.string().trim().min(1).max(96).optional(),
          dataContractId: z.string().trim().min(1).max(128).optional(),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const filters = [];
      if (input?.moduleId)
        filters.push(eq(marketDataObservationHistory.moduleId, input.moduleId));
      if (input?.dataContractId)
        filters.push(
          eq(marketDataObservationHistory.dataContractId, input.dataContractId)
        );
      if (input?.symbol)
        filters.push(eq(marketDataObservationHistory.symbol, input.symbol));
      const query = db
        .select({
          id: marketDataObservationHistory.id,
          symbol: marketDataObservationHistory.symbol,
          observationDate: marketDataObservationHistory.observationDate,
          observationAt: marketDataObservationHistory.observationAt,
          fetchedAt: marketDataObservationHistory.fetchedAt,
          payload: marketDataObservationHistory.payload,
          contentHash: marketDataObservationHistory.contentHash,
          source: marketDataObservationHistory.source,
          isRevision: marketDataObservationHistory.isRevision,
        })
        .from(marketDataObservationHistory);
      return (filters.length ? query.where(and(...filters)) : query)
        .orderBy(
          desc(marketDataObservationHistory.fetchedAt),
          desc(marketDataObservationHistory.observationDate)
        )
        .limit(input?.limit ?? 100);
    }),
  syncManagedPublicDataset: adminProcedure
    .input(
      z.object({
        id: z.enum(
          MANAGED_PUBLIC_DATASETS.map(item => item.id) as [
            (typeof MANAGED_PUBLIC_DATASETS)[number]["id"],
            ...Array<(typeof MANAGED_PUBLIC_DATASETS)[number]["id"]>,
          ]
        ),
      })
    )
    .mutation(({ ctx, input }) =>
      syncManagedPublicDataset(input.id, ctx.user.id)
    ),
  syncAllManagedPublicDatasets: adminProcedure.mutation(({ ctx }) =>
    syncAllManagedPublicDatasets(ctx.user.id)
  ),
  enableManagedPublicDatasetSchedule: adminProcedure
    .input(
      z.object({
        intervalMinutes: z
          .union([
            z.literal(1),
            z.literal(5),
            z.literal(10),
            z.literal(30),
            z.literal(60),
          ])
          .default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV !== "production")
        throw new Error("MARKET_SCHEDULE_REQUIRES_PUBLISHED_DEPLOYMENT");
      const result = await enableManagedPublicDatasetSchedule(
        toCronExpression(input.intervalMinutes)
      );
      await auditAdminMarketIngestion({
        actorUserId: ctx.user.id,
        action: "schedule_enabled",
        detail: `启用全部公开数据契约 ${input.intervalMinutes} 分钟采集计划：${result.taskUid}`,
      });
      return { ...result, intervalMinutes: input.intervalMinutes };
    }),
  pauseManagedPublicDatasetSchedule: adminProcedure.mutation(async ({ ctx }) => {
    const result = await pauseManagedPublicDatasetSchedule();
    await auditAdminMarketIngestion({
      actorUserId: ctx.user.id,
      action: "schedule_paused",
      detail: `暂停全部公开数据契约采集计划：${result.taskUid}`,
    });
    return result;
  }),
  listProviderConfigs: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(adminMarketDataProviderConfigs)
      .orderBy(desc(adminMarketDataProviderConfigs.updatedAt));
    return rows.map(row => ({
      ...row,
      hasConfiguredKey: Boolean(process.env[row.apiKeyEnvName]),
      connectionStatus: process.env[row.apiKeyEnvName]
        ? row.connectionStatus === "available"
          ? "available"
          : "adapter_pending"
        : "key_missing",
    }));
  }),
  saveProviderConfig: adminProcedure
    .input(providerInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DATABASE_UNAVAILABLE");
      const configuration = {
        ...input,
        providerCode:
          input.providerCode ?? providerCodeFromName(input.providerName),
      };
      const existing = (
        await db
          .select({ id: adminMarketDataProviderConfigs.id })
          .from(adminMarketDataProviderConfigs)
          .where(
            eq(
              adminMarketDataProviderConfigs.providerCode,
              configuration.providerCode
            )
          )
          .limit(1)
      )[0];
      const connectionStatus = process.env[configuration.apiKeyEnvName]
        ? ("adapter_pending" as const)
        : ("key_missing" as const);
      if (existing) {
        await db
          .update(adminMarketDataProviderConfigs)
          .set({
            ...configuration,
            connectionStatus,
            isActive: false,
            lastError:
              connectionStatus === "key_missing"
                ? "等待安全环境变量中的 API 密钥。"
                : "密钥已检测到，等待提供方专用字段适配。",
            updatedAt: new Date(),
          })
          .where(eq(adminMarketDataProviderConfigs.id, existing.id));
        return {
          providerConfigId: existing.id,
          existed: true,
          connectionStatus,
        };
      }
      const result = await db.insert(adminMarketDataProviderConfigs).values({
        ...configuration,
        connectionStatus,
        isActive: false,
        lastError:
          connectionStatus === "key_missing"
            ? "等待安全环境变量中的 API 密钥。"
            : "密钥已检测到，等待提供方专用字段适配。",
        createdByUserId: ctx.user.id,
      });
      const providerConfigId = Number(
        (result as any)[0]?.insertId ?? (result as any).insertId
      );
      return { providerConfigId, existed: false, connectionStatus };
    }),
  listEvents: adminProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional()
    )
    .query(({ input }) => listAdminMarketIngestionEvents(input?.limit ?? 50)),
  createTarget: adminProcedure
    .input(targetInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DATABASE_UNAVAILABLE");
      const existing = (
        await db
          .select({ id: adminMarketIngestionTargets.id })
          .from(adminMarketIngestionTargets)
          .where(eq(adminMarketIngestionTargets.symbol, input.symbol))
          .limit(1)
      )[0];
      if (existing) return { targetId: existing.id, existed: true };
      const result = await db
        .insert(adminMarketIngestionTargets)
        .values({ ...input, createdByUserId: ctx.user.id });
      const targetId = Number(
        (result as any)[0]?.insertId ?? (result as any).insertId
      );
      await auditAdminMarketIngestion({
        targetId,
        actorUserId: ctx.user.id,
        action: "target_created",
        detail: `管理员新增公共日频投资标的：${input.symbol}。`,
      });
      return { targetId, existed: false };
    }),
  syncTarget: adminProcedure
    .input(z.object({ targetId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      syncAdminMarketTarget(input.targetId, ctx.user.id)
    ),
  enableSchedule: adminProcedure
    .input(
      z.object({
        targetId: z.number().int().positive(),
        intervalMinutes: scheduleInterval,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV !== "production")
        throw new Error("MARKET_SCHEDULE_REQUIRES_PUBLISHED_DEPLOYMENT");
      const db = await getDb();
      if (!db) throw new Error("DATABASE_UNAVAILABLE");
      const target = (
        await db
          .select()
          .from(adminMarketIngestionTargets)
          .where(eq(adminMarketIngestionTargets.id, input.targetId))
          .orderBy(desc(adminMarketIngestionTargets.updatedAt))
          .limit(1)
      )[0];
      if (!target) throw new Error("MARKET_INGESTION_TARGET_NOT_FOUND");
      const cron = toCronExpression(input.intervalMinutes);
      let taskUid = target.scheduleCronTaskUid;
      if (taskUid)
        await updateHeartbeatJob(
          taskUid,
          {
            cron,
            path: "/api/scheduled/adminMarketIngestion",
            method: "POST",
            payload: { targetId: target.id },
            description: `Finance Hub 公共日频投资标的采集：${target.symbol}。不代表实时行情。`,
            enable: true,
          },
          ""
        );
      else {
        const created = await createHeartbeatJob(
          {
            name: `finance-hub-admin-market-target-${target.id}`,
            cron,
            path: "/api/scheduled/adminMarketIngestion",
            method: "POST",
            payload: { targetId: target.id },
            description: `Finance Hub 公共日频投资标的采集：${target.symbol}。不代表实时行情。`,
          },
          ""
        );
        taskUid = created.taskUid;
        await db
          .update(adminMarketIngestionTargets)
          .set({ scheduleCronTaskUid: taskUid, updatedAt: new Date() })
          .where(eq(adminMarketIngestionTargets.id, target.id));
      }
      await auditAdminMarketIngestion({
        targetId: target.id,
        actorUserId: ctx.user.id,
        action: "schedule_enabled",
        detail: `启用 ${input.intervalMinutes} 分钟公共日频采集计划：${taskUid}`,
      });
      return {
        targetId: target.id,
        taskUid,
        intervalMinutes: input.intervalMinutes,
      };
    }),
  pauseSchedule: adminProcedure
    .input(z.object({ targetId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DATABASE_UNAVAILABLE");
      const target = (
        await db
          .select()
          .from(adminMarketIngestionTargets)
          .where(eq(adminMarketIngestionTargets.id, input.targetId))
          .limit(1)
      )[0];
      if (!target?.scheduleCronTaskUid)
        throw new Error("MARKET_SCHEDULE_NOT_CONFIGURED");
      await updateHeartbeatJob(
        target.scheduleCronTaskUid,
        { enable: false },
        ""
      );
      await auditAdminMarketIngestion({
        targetId: target.id,
        actorUserId: ctx.user.id,
        action: "schedule_paused",
        detail: `暂停公共日频采集计划：${target.scheduleCronTaskUid}`,
      });
      return { targetId: target.id, paused: true };
    }),
});

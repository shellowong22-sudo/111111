/**
 * 佑诚管理后台接口（仅管理员）：数据源、数据集与规则、模块搭建与发布、运行日志、告警。
 */
import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { randomBytes } from "node:crypto";
import {
  UC_SLOTS,
  UC_TEMPLATES,
  UcField,
  UcModuleDefinition,
  UcPipelineConfig,
  type UcField as Field,
} from "@shared/ucheerModules";
import { audit, exec, parseJson, query } from "../uc/store";
import { logPush, maskForAdmin, pushLatestCandidate, qualityOf, runRules, publishDatasetVersion, runSource, withdrawDatasetVersion } from "../uc/pipeline";
import {
  ADAPTERS, SCRIPT_CATALOG, fetchHttpSource, listScriptFiles, queryDatabaseSource, readSourceTables, runScript,
  type HttpSourceConfig, type SourceConfig,
} from "../uc/runners";
import { UC_PERMISSIONS, UC_ROLES, canSeeSource, permsFor, requireDatasetAccess, requirePerm, requireSourceAccess } from "../uc/perms";
import { WEI_BOARDS, displayName, getKline, getTicks, marketHealth } from "../uc/market";
import { ucStreamClientCount } from "../uc/stream";
import { jsonToTable } from "../uc/parse";
import {
  buildModulePayload,
  createModuleForDataset,
  publishModule,
  rollbackModule,
  saveModule,
  slugify,
  unpublishModule,
} from "../uc/modules";
import { broadcastUcUpdate } from "../uc/stream";
import { autoSlotFor, cleanupJunk, findDuplicates, importZipScripts, mergeDuplicates } from "../uc/zipImport";
import { sourceRaw, zipFile, zipTree } from "../uc/zipExplore";
import { warehouseStats } from "../uc/warehouse";

/** 系统管理员或已加入的数据工作台成员才能调用 */
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { role } = await permsFor(ctx);
  if (role === "none") throw new TRPCError({ code: "FORBIDDEN", message: "没有佑诚数据工作台的访问权限，请联系管理员加入成员" });
  return next({ ctx: { ...ctx, user: ctx.user! } });
});

const fail = (error: unknown): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : String(error) });
};

const HttpConfigInput = z.object({
  kind: z.literal("http"),
  url: z.string().url(),
  method: z.enum(["GET", "POST"]).default("GET"),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().max(20000).default(""),
  jsonPath: z.string().max(200).default(""),
  format: z.enum(["auto", "json", "csv"]).default("auto"),
  timeoutSec: z.number().int().min(3).max(120).default(30),
});
const DatabaseConfigInput = z.object({ kind: z.literal("database"), dsn: z.string().max(500).default(""), sql: z.string().min(1).max(20000) });
const MarketConfigInput = z.object({
  kind: z.literal("market"),
  mode: z.enum(["quotes", "kline"]),
  board: z.string().optional(),
  symbols: z.array(z.string().max(24)).max(400).default([]),
  symbol: z.string().max(24).optional(),
  period: z.enum(["1m", "5m", "15m", "30m", "60m", "1d", "1w", "1M"]).default("1d"),
  limit: z.number().int().min(20).max(1000).default(240),
});
const SourceConfigInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("script"), script: z.string(), command: z.string().default(""), args: z.array(z.string()).default([]), env: z.record(z.string(), z.string()).default({}) }),
  z.object({ kind: z.literal("adapter"), adapter: z.string() }),
  z.object({ kind: z.literal("agent_reach"), mode: z.enum(["rss", "web"]), url: z.string().url() }),
  HttpConfigInput,
  DatabaseConfigInput,
  MarketConfigInput,
]);

const SECRET_HEADER = /authorization|token|key|secret|cookie|password/i;

const hideSecret = (v: string) => (v ? `${v.slice(0, 3)}••••` : "");
function maskConfig(config: SourceConfig) {
  if (config.kind === "script") {
    return { ...config, env: Object.fromEntries(Object.entries(config.env ?? {}).map(([k, v]) => [k, hideSecret(v)])) };
  }
  if (config.kind === "http") {
    return { ...config, headers: Object.fromEntries(Object.entries(config.headers ?? {}).map(([k, v]) => [k, SECRET_HEADER.test(k) ? hideSecret(v) : v])) };
  }
  if (config.kind === "database" && config.dsn) {
    return { ...config, dsn: config.dsn.replace(/(\/\/[^:/@]+:)[^@]*@/, "$1••••@") };
  }
  return config;
}

/** 编辑时没改动的密钥（显示为 xxx••••）沿用原值 */
function keepSecrets(next: SourceConfig, old: SourceConfig): SourceConfig {
  if (next.kind === "script" && old.kind === "script") {
    return { ...next, env: Object.fromEntries(Object.entries(next.env ?? {}).map(([k, v]) => [k, v.endsWith("••••") ? old.env?.[k] ?? "" : v])) };
  }
  if (next.kind === "http" && old.kind === "http") {
    return { ...next, headers: Object.fromEntries(Object.entries(next.headers ?? {}).map(([k, v]) => [k, v.endsWith("••••") ? old.headers?.[k] ?? "" : v])) };
  }
  if (next.kind === "database" && old.kind === "database" && next.dsn?.includes("••••")) {
    return { ...next, dsn: old.dsn ?? "" };
  }
  return next;
}

async function rerunDataset(datasetId: number) {
  const [d] = await query<{ source_id: number }>(sql`SELECT source_id FROM uc_datasets WHERE id = ${datasetId}`);
  if (!d) throw new Error("数据集不存在");
  return runSource(d.source_id, "rules", { useSnapshot: true });
}

async function loadPipeline(datasetId: number) {
  const [d] = await query<{ pipeline_json: string }>(sql`SELECT pipeline_json FROM uc_datasets WHERE id = ${datasetId}`);
  if (!d) throw new Error("数据集不存在");
  return UcPipelineConfig.parse(parseJson(d.pipeline_json, {}));
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\ufeff" + [columns.map(esc).join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\r\n");
}

type SourceRow = { id: number; name: string; kind: string; config_json: string; slot_id: string; interval_minutes: number; enabled: number; last_run_at: string | null; last_status: string; last_error: string | null; created_at: string; updated_at: string };

async function deleteSourceCascade(sourceId: number) {
  const datasets = await query<{ id: number }>(sql`SELECT id FROM uc_datasets WHERE source_id = ${sourceId}`);
  const slots = new Set<string>();
  for (const d of datasets) {
    const mods = await query<{ id: number; slot_id: string }>(sql`SELECT id, slot_id FROM uc_modules WHERE dataset_id = ${d.id}`);
    for (const m of mods) {
      slots.add(m.slot_id);
      await exec(sql`DELETE FROM uc_module_versions WHERE module_id = ${m.id}`);
      await exec(sql`DELETE FROM uc_module_events WHERE module_id = ${m.id}`);
    }
    await exec(sql`DELETE FROM uc_modules WHERE dataset_id = ${d.id}`);
    await exec(sql`DELETE FROM uc_dataset_rows WHERE dataset_id = ${d.id}`);
    await exec(sql`DELETE FROM uc_dataset_versions WHERE dataset_id = ${d.id}`);
  }
  await exec(sql`DELETE FROM uc_datasets WHERE source_id = ${sourceId}`);
  await exec(sql`DELETE FROM uc_sources WHERE id = ${sourceId}`);
  if (slots.size) broadcastUcUpdate([...slots]);
}

export const ucAdminRouter = router({
  /* ---------------------------------------------------------------- 当前用户与总览 */
  me: adminProcedure.query(async ({ ctx }) => {
    const { role, perms } = await permsFor(ctx);
    return { userId: ctx.user.id, name: ctx.user.name ?? ctx.user.email ?? "", role, roleLabel: UC_ROLES.find((r) => r.key === role)?.label ?? role, perms };
  }),

  overview: adminProcedure.query(async () => {
    try {
      const [counts] = await query<Record<string, number>>(sql`SELECT
        (SELECT COUNT(*) FROM uc_sources) AS sources,
        (SELECT COUNT(*) FROM uc_datasets) AS datasets,
        (SELECT COUNT(*) FROM uc_modules) AS modules,
        (SELECT COUNT(*) FROM uc_modules WHERE status = 'published') AS published,
        (SELECT COUNT(*) FROM uc_dataset_versions WHERE status = 'candidate') AS pendingReview,
        (SELECT COUNT(*) FROM uc_alerts WHERE status = 'open') AS openAlerts,
        (SELECT COUNT(*) FROM uc_runs WHERE started_at > (CURRENT_TIMESTAMP - INTERVAL 1 DAY)) AS runs24h,
        (SELECT COUNT(*) FROM uc_runs WHERE status = 'failed' AND started_at > (CURRENT_TIMESTAMP - INTERVAL 1 DAY)) AS failed24h,
        (SELECT COUNT(*) FROM uc_push_log WHERE created_at > (CURRENT_TIMESTAMP - INTERVAL 1 DAY)) AS pushes24h`);
      const scriptFiles = await listScriptFiles();
      return {
        counts: Object.fromEntries(Object.entries(counts ?? {}).map(([k, v]) => [k, Number(v)])),
        slots: UC_SLOTS,
        templates: UC_TEMPLATES,
        scriptsAvailable: scriptFiles.length,
        scriptCatalogSize: SCRIPT_CATALOG.length,
        liveClients: ucStreamClientCount(),
      };
    } catch (error) {
      return fail(error);
    }
  }),

  /* ---------------------------------------------------------------- 数据源 */
  catalog: adminProcedure.query(() => ({
    scripts: SCRIPT_CATALOG,
    adapters: ADAPTERS.map(({ id, label, slot }) => ({ id, label, slot })),
    boards: Object.entries(WEI_BOARDS).map(([id, b]) => ({ id, label: b.label, symbols: b.symbols })),
  })),

  sources: adminProcedure.query(async ({ ctx }) => {
    const { perms } = await permsFor(ctx);
    const rows = await query<SourceRow & { datasets: number; modules: number; runs: number; fails: number }>(sql`SELECT s.*,
      (SELECT COUNT(*) FROM uc_datasets d WHERE d.source_id = s.id) AS datasets,
      (SELECT COUNT(*) FROM uc_modules m JOIN uc_datasets d2 ON d2.id = m.dataset_id WHERE d2.source_id = s.id) AS modules,
      (SELECT COUNT(*) FROM uc_runs r WHERE r.source_id = s.id) AS runs,
      (SELECT COUNT(*) FROM uc_runs r2 WHERE r2.source_id = s.id AND r2.status = 'failed') AS fails
      FROM uc_sources s ORDER BY s.id DESC`);
    return rows.filter((r) => canSeeSource(perms, r.id)).map((r) => ({
      id: r.id, name: r.name, kind: r.kind, slotId: r.slot_id, intervalMinutes: r.interval_minutes, enabled: !!r.enabled,
      lastRunAt: r.last_run_at, lastStatus: r.last_status, lastError: r.last_error, createdAt: r.created_at,
      datasets: Number(r.datasets), modules: Number(r.modules), runs: Number(r.runs), fails: Number(r.fails),
      config: maskConfig(parseJson<SourceConfig>(r.config_json, { kind: "zip" } as SourceConfig)),
    }));
  }),

  createSource: adminProcedure
    .input(z.object({ name: z.string().min(1).max(200), slotId: z.string(), intervalMinutes: z.number().int().min(0).max(10080).default(0), config: SourceConfigInput, runNow: z.boolean().default(true), autoPublish: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      await requirePerm(ctx, "manageSources");
      try {
        const { insertId } = await exec(sql`INSERT INTO uc_sources (name, kind, config_json, slot_id, interval_minutes, created_by)
          VALUES (${input.name}, ${input.config.kind}, ${JSON.stringify(input.config)}, ${input.slotId}, ${input.intervalMinutes}, ${ctx.user.id})`);
        await audit(ctx.user, "新增数据源", `source:${insertId}`, { name: input.name, kind: input.config.kind });
        if (!input.runNow) return { sourceId: insertId, datasets: [], modulesCreated: [] };
        const result = await runSource(insertId, "manual");
        const created: number[] = [];
        for (const d of result.datasets) created.push(await createModuleForDataset(d.datasetId, { slotId: input.slotId, publish: input.autoPublish, userId: ctx.user.id, name: result.datasets.length > 1 ? `${input.name} · ${d.name}` : input.name }));
        return { sourceId: insertId, datasets: result.datasets, modulesCreated: created };
      } catch (error) {
        return fail(error);
      }
    }),

  updateSource: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(200).optional(), slotId: z.string().optional(), intervalMinutes: z.number().int().min(0).max(10080).optional(), enabled: z.boolean().optional(), config: SourceConfigInput.optional() }))
    .mutation(async ({ input, ctx }) => {
      await requirePerm(ctx, "manageSources");
      await requireSourceAccess(ctx, input.id);
      const [row] = await query<SourceRow>(sql`SELECT * FROM uc_sources WHERE id = ${input.id}`);
      if (!row) return fail("数据源不存在");
      let configJson = row.config_json;
      if (input.config) {
        const old = parseJson<SourceConfig>(row.config_json, { kind: "zip" } as SourceConfig);
        configJson = JSON.stringify(keepSecrets(input.config as SourceConfig, old));
      }
      await exec(sql`UPDATE uc_sources SET name = ${input.name ?? row.name}, slot_id = ${input.slotId ?? row.slot_id},
        interval_minutes = ${input.intervalMinutes ?? row.interval_minutes}, enabled = ${input.enabled === undefined ? row.enabled : input.enabled ? 1 : 0},
        config_json = ${configJson} WHERE id = ${input.id}`);
      await audit(ctx.user, "修改数据源", `source:${input.id}`, { ...input, config: input.config ? maskConfig(input.config as SourceConfig) : undefined });
      return { ok: true };
    }),

  duplicateSource: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageSources");
    const [row] = await query<SourceRow>(sql`SELECT * FROM uc_sources WHERE id = ${input.id}`);
    if (!row || row.kind === "zip") return fail("zip 数据源请直接重新上传");
    const { insertId } = await exec(sql`INSERT INTO uc_sources (name, kind, config_json, slot_id, interval_minutes, enabled, created_by)
      VALUES (${`${row.name}（副本）`}, ${row.kind}, ${row.config_json}, ${row.slot_id}, ${row.interval_minutes}, 0, ${ctx.user.id})`);
    await audit(ctx.user, "复制数据源", `source:${insertId}`, `来自 ${row.name}`);
    return { id: insertId };
  }),

  runSource: adminProcedure.input(z.object({ id: z.number(), useSnapshot: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageSources");
    await requireSourceAccess(ctx, input.id);
    try {
      const result = await runSource(input.id, "manual", { useSnapshot: input.useSnapshot });
      await audit(ctx.user, "运行数据源", `source:${input.id}`, result.datasets);
      return result;
    } catch (error) {
      return fail(error);
    }
  }),

  /** 重新识别 zip：重跑解析（过滤垃圾文件、生成文档表）→ 自动放到合适页面 → 后台试跑功能脚本 */
  rescanZip: adminProcedure.input(z.object({ id: z.number(), publish: z.boolean().default(true) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageSources");
    await requireSourceAccess(ctx, input.id);
    try {
      const result = await runSource(input.id, "manual");
      const placed: Array<{ name: string; slot: string; moduleId: number | null }> = [];
      for (const d of result.datasets) {
        const [has] = await query<{ n: number }>(sql`SELECT COUNT(*) AS n FROM uc_modules WHERE dataset_id = ${d.datasetId}`);
        const slot = await autoSlotFor(d.datasetId);
        const moduleId = Number(has?.n ?? 0) === 0 ? await createModuleForDataset(d.datasetId, { slotId: slot, publish: input.publish, userId: ctx.user.id }) : null;
        if (!moduleId && slot !== "tool.board") {
          // 以前默认放在“我的看板”的模块，按内容挪到对应页面
          const olds = await query<{ id: number; definition_json: string }>(sql`SELECT id, definition_json FROM uc_modules WHERE dataset_id = ${d.datasetId} AND slot_id = 'tool.board' AND variant_of IS NULL`);
          for (const m of olds) {
            const def = { ...parseJson<Record<string, unknown>>(m.definition_json, {}), slotId: slot };
            await exec(sql`UPDATE uc_modules SET slot_id = ${slot}, definition_json = ${JSON.stringify(def)} WHERE id = ${m.id}`);
          }
          if (olds.length) broadcastUcUpdate(["tool.board", slot]);
        }
        placed.push({ name: d.name, slot, moduleId });
      }
      const junk = await cleanupJunk(ctx.user);
      const scripts = await importZipScripts(input.id, { userId: ctx.user.id, publish: input.publish, slot: "auto" });
      await audit(ctx.user, "重新识别 zip", `source:${input.id}`, { placed, removed: junk.removed.length, scripts: scripts.queued });
      return { placed, removed: junk.removed, scriptsQueued: scripts.queued };
    } catch (error) {
      return fail(error);
    }
  }),

  /** 重新构建前端并重启服务（后台运行，约 2 分钟后自动生效；构建失败会自动回滚到上一版） */
  rebuild: adminProcedure.mutation(async ({ ctx }) => {
    await requirePerm(ctx, "manageMembers");
    const { spawn } = await import("node:child_process");
    const { existsSync } = await import("node:fs");
    const path = await import("node:path");
    const script = path.join(process.cwd(), "scripts", "claude-rebuild-and-restart.cmd");
    if (process.platform !== "win32" || !existsSync(script)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "当前环境没有重建脚本" });
    const child = spawn("cmd.exe", ["/c", "start", "\"uc-rebuild\"", "/min", script], { detached: true, stdio: "ignore", windowsHide: true, cwd: path.dirname(script) });
    child.unref();
    await audit(ctx.user, "重建并重启", "system", "");
    return { started: true };
  }),

  /** 网络探测：从服务器所在网络访问一组地址，返回状态码、耗时与开头内容（用于接入新数据接口前确认可达） */
  /** 平台自有数据仓库：各表累计条数 */
  warehouse: adminProcedure.query(async () => {
    const base = await warehouseStats();
    const [series] = await query<{ n: number; s: number }>(sql`SELECT COUNT(*) AS n, COUNT(DISTINCT series) AS s FROM uc_series`).catch(() => [{ n: 0, s: 0 }]);
    return { ...base, seriesRows: Number(series?.n ?? 0), seriesCount: Number(series?.s ?? 0) };
  }),
  probe: adminProcedure.input(z.object({ urls: z.array(z.string().url().max(2000)).min(1).max(30), bytes: z.number().int().min(100).max(20000).default(600) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageSources");
    return Promise.all(input.urls.map(async (url) => {
      const t = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
        const text = await res.text();
        return { url, status: res.status, ms: Date.now() - t, length: text.length, head: text.slice(0, input.bytes) };
      } catch (error) {
        return { url, status: 0, ms: Date.now() - t, length: 0, head: error instanceof Error ? error.message : String(error) };
      }
    }));
  }),

  /* ---------------------------------------------------------------- 内容浏览（压缩包 / 接口原始数据） */
  zipTree: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    await requireSourceAccess(ctx, input.id);
    return zipTree(input.id);
  }),
  zipFile: adminProcedure.input(z.object({ id: z.number(), path: z.string().min(1).max(1000) })).query(async ({ input, ctx }) => {
    await requireSourceAccess(ctx, input.id);
    return zipFile(input.id, input.path);
  }),
  sourceRaw: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    await requireSourceAccess(ctx, input.id);
    return sourceRaw(input.id);
  }),
  /** 手动接入压缩包里的指定文件（包括默认被忽略的），放到指定页面 */
  importZipFile: adminProcedure.input(z.object({ id: z.number(), paths: z.array(z.string().min(1).max(1000)).min(1).max(50), slot: z.string().max(64), publish: z.boolean().default(true), name: z.string().max(200).optional() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageSources");
    await requireSourceAccess(ctx, input.id);
    const [src] = await query<{ name: string; config_json: string }>(sql`SELECT name, config_json FROM uc_sources WHERE id = ${input.id}`);
    if (!src) throw new TRPCError({ code: "NOT_FOUND", message: "数据源不存在" });
    const cfg = parseJson<Record<string, unknown>>(src.config_json, {});
    const name = (input.name ?? `${src.name} · ${input.paths.length === 1 ? input.paths[0].split("/").pop() : `${input.paths.length} 个文件`}`).slice(0, 200);
    const config = { kind: "zip", fileName: input.paths[0], storedAs: cfg.storedAs, size: cfg.size ?? 0, fromSourceId: (cfg.fromSourceId as number | undefined) ?? input.id, include: input.paths };
    const { insertId } = await exec(sql`INSERT INTO uc_sources (name, kind, config_json, slot_id, created_by) VALUES (${name}, 'zip', ${JSON.stringify(config)}, ${input.slot}, ${ctx.user.id})`);
    try {
      const result = await runSource(insertId, "manual");
      const modules: number[] = [];
      for (const d of result.datasets) modules.push(await createModuleForDataset(d.datasetId, { slotId: input.slot, publish: input.publish, userId: ctx.user.id, name: result.datasets.length > 1 ? `${name} · ${d.name}` : name }));
      await audit(ctx.user, "手动接入文件", `source:${insertId}`, { from: input.id, paths: input.paths, slot: input.slot });
      return { sourceId: insertId, datasets: result.datasets, modules };
    } catch (error) {
      return fail(error);
    }
  }),

  cleanupJunk: adminProcedure.mutation(async ({ ctx }) => {
    await requirePerm(ctx, "manageSources");
    return cleanupJunk(ctx.user);
  }),

  duplicates: adminProcedure.query(() => findDuplicates()),

  mergeDuplicates: adminProcedure.mutation(async ({ ctx }) => {
    await requirePerm(ctx, "publish");
    const r = await mergeDuplicates(ctx.user);
    return { archived: r.archived };
  }),

  deleteSource: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageSources");
    await requireSourceAccess(ctx, input.id);
    await deleteSourceCascade(input.id);
    await audit(ctx.user, "删除数据源", `source:${input.id}`);
    return { ok: true };
  }),

  /** 试跑：脚本 / 接口 / 数据库 / 行情，不入库，返回识别到的表头与前 50 行 */
  testScript: adminProcedure
    .input(z.object({ script: z.string(), command: z.string().default(""), args: z.array(z.string()).default([]), env: z.record(z.string(), z.string()).default({}) }))
    .mutation(async ({ input, ctx }) => {
      await requirePerm(ctx, "manageSources");
      try {
        const { value, stderr, python } = await runScript({ kind: "script", ...input });
        const table = jsonToTable("preview", value);
        return { python, stderr, columns: table?.columns ?? [], rows: (table?.rows ?? []).slice(0, 50), total: table?.rows.length ?? 0, raw: JSON.stringify(value).slice(0, 4000) };
      } catch (error) {
        return fail(error);
      }
    }),

  testSource: adminProcedure.input(z.object({ config: z.discriminatedUnion("kind", [HttpConfigInput, DatabaseConfigInput, MarketConfigInput]) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageSources");
    try {
      let value: unknown;
      let raw = "";
      if (input.config.kind === "http") {
        const r = await fetchHttpSource(input.config as HttpSourceConfig);
        raw = r.text.slice(0, 4000);
        if (typeof r.value === "string") {
          const { parseFileToTables } = await import("../uc/parse");
          const t = parseFileToTables("api.csv", Buffer.from(r.text, "utf8"))[0];
          return { columns: t?.columns ?? [], rows: (t?.rows ?? []).slice(0, 50), total: t?.rows.length ?? 0, raw };
        }
        value = input.config.jsonPath ? input.config.jsonPath.split(".").filter(Boolean).reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), r.value) : r.value;
      } else if (input.config.kind === "database") {
        value = await queryDatabaseSource(input.config);
      } else if (input.config.mode === "kline") {
        value = (await getKline(input.config.symbol ?? "", input.config.period, input.config.limit)).map((k) => ({ 时间: new Date(k.t + 8 * 3600e3).toISOString().slice(0, 16).replace("T", " "), 开盘: k.o, 最高: k.h, 最低: k.l, 收盘: k.c, 成交量: k.v }));
      } else {
        const symbols = input.config.symbols.length ? input.config.symbols : WEI_BOARDS[input.config.board ?? "global"]?.symbols ?? [];
        const ticks = await getTicks(symbols, { budgetMs: 30_000 });
        value = symbols.map((sym) => ({ 代码: sym, 名称: ticks[sym]?.name ?? displayName(sym) ?? sym, 最新价: ticks[sym]?.price ?? null, 涨跌幅: ticks[sym]?.changePct ?? null }));
      }
      const table = jsonToTable("preview", value);
      return { columns: table?.columns ?? [], rows: (table?.rows ?? []).slice(0, 50), total: table?.rows.length ?? 0, raw: raw || JSON.stringify(value).slice(0, 4000) };
    } catch (error) {
      return fail(error);
    }
  }),

  /** 预置数据源：系统已有的数据接口，一键接入并推送到对应页面 */
  presets: adminProcedure.query(async () => {
    const { PRESETS, installedPresetKeys } = await import("../uc/presets");
    const installed = await installedPresetKeys();
    const sources = await query<{ id: number; name: string; last_status: string }>(sql`SELECT id, name, last_status FROM uc_sources`);
    return PRESETS.map((p) => {
      const s = sources.find((x) => x.name === p.name);
      return { key: p.key, name: p.name, slot: p.slot, kind: p.config.kind, interval: p.interval, installed: installed.has(p.key), sourceId: s?.id ?? null, status: s?.last_status ?? null };
    });
  }),

  installPresets: adminProcedure.input(z.object({ keys: z.array(z.string()).optional(), force: z.boolean().default(true) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageSources");
    const { installPresets } = await import("../uc/presets");
    const r = await installPresets({ force: input.force, keys: input.keys });
    await audit(ctx.user, "补齐预置数据源", "presets", `${r.pending} 个`);
    return r;
  }),

  /* ---------------------------------------------------------------- 数据集与规则 */
  datasets: adminProcedure.input(z.object({ sourceId: z.number().optional() }).default({})).query(async ({ input, ctx }) => {
    const { perms } = await permsFor(ctx);
    const rows = await query<{ id: number; source_id: number; name: string; table_key: string; current_version: number; published_version: number; row_count: number; updated_at: string; source_name: string; source_kind: string; fields_json: string; pipeline_json: string }>(
      input.sourceId
        ? sql`SELECT d.*, s.name AS source_name, s.kind AS source_kind FROM uc_datasets d JOIN uc_sources s ON s.id = d.source_id WHERE d.source_id = ${input.sourceId} ORDER BY d.id`
        : sql`SELECT d.*, s.name AS source_name, s.kind AS source_kind FROM uc_datasets d JOIN uc_sources s ON s.id = d.source_id ORDER BY d.id DESC`);
    return rows.filter((r) => canSeeSource(perms, r.source_id)).map((r) => {
      const pipeline = UcPipelineConfig.safeParse(parseJson(r.pipeline_json, {}));
      return {
        id: r.id, sourceId: r.source_id, sourceName: r.source_name, sourceKind: r.source_kind, name: r.name, tableKey: r.table_key,
        currentVersion: r.current_version, publishedVersion: r.published_version, rowCount: r.row_count, updatedAt: r.updated_at,
        fieldCount: parseJson<unknown[]>(r.fields_json, []).length,
        fields: parseJson<Field[]>(r.fields_json, []).map(({ name, label, type }) => ({ name, label, type })),
        pushMode: pipeline.success ? pipeline.data.push.mode : "realtime",
        reviewRequired: pipeline.success ? pipeline.data.reviewRequired : false,
      };
    });
  }),

  dataset: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    await requireDatasetAccess(ctx, input.id);
    const [d] = await query<{ id: number; source_id: number; name: string; table_key: string; fields_json: string; pipeline_json: string; current_version: number; published_version: number; row_count: number }>(sql`SELECT * FROM uc_datasets WHERE id = ${input.id}`);
    if (!d) return fail("数据集不存在");
    const versions = await query<{ version: number; status: string; row_count: number; stats_json: string; created_at: string; reviewed_at: string | null }>(sql`SELECT version, status, row_count, stats_json, created_at, reviewed_at FROM uc_dataset_versions WHERE dataset_id = ${input.id} ORDER BY version DESC LIMIT 30`);
    return {
      id: d.id, sourceId: d.source_id, name: d.name, tableKey: d.table_key, rowCount: d.row_count,
      currentVersion: d.current_version, publishedVersion: d.published_version,
      fields: parseJson<Field[]>(d.fields_json, []),
      pipeline: UcPipelineConfig.parse(parseJson(d.pipeline_json, {})),
      versions: versions.map((v) => ({ ...v, stats: parseJson(v.stats_json, {}) })),
    };
  }),

  /** 数据浏览：分页、搜索、排序；可看前端视图或入库全量（全量按“所有人”脱敏规则和权限处理） */
  datasetRows: adminProcedure
    .input(z.object({
      id: z.number(), version: z.number().optional(), view: z.enum(["view", "full"]).default("full"),
      limit: z.number().int().min(1).max(2000).default(100), offset: z.number().int().min(0).default(0),
      search: z.string().max(200).default(""), sortBy: z.string().max(120).default(""), sortDir: z.enum(["asc", "desc"]).default("asc"),
    }))
    .query(async ({ input, ctx }) => {
      const perms = await requireDatasetAccess(ctx, input.id);
      const [d] = await query<{ current_version: number; pipeline_json: string }>(sql`SELECT current_version, pipeline_json FROM uc_datasets WHERE id = ${input.id}`);
      const version = input.version ?? d?.current_version ?? 0;
      const raw = await query<{ data: string; record_key: string; row_index: number }>(input.view === "view"
        ? sql`SELECT view_json AS data, record_key, row_index FROM uc_dataset_rows WHERE dataset_id = ${input.id} AND version = ${version} ORDER BY row_index LIMIT 200000`
        : sql`SELECT full_json AS data, record_key, row_index FROM uc_dataset_rows WHERE dataset_id = ${input.id} AND version = ${version} ORDER BY row_index LIMIT 200000`);
      let rows = raw.map((r) => {
        let data = parseJson<Record<string, string | number | null>>(r.data, {});
        if (input.view === "full" && !perms.viewRaw) data = maskForAdmin(data, parseJson(d?.pipeline_json, {}));
        return { key: r.record_key, index: r.row_index, data };
      });
      const q = input.search.trim().toLowerCase();
      if (q) rows = rows.filter((r) => Object.values(r.data).some((v) => v !== null && String(v).toLowerCase().includes(q)));
      if (input.sortBy) {
        const dir = input.sortDir === "desc" ? -1 : 1;
        rows.sort((a, b) => {
          const x = a.data[input.sortBy], y = b.data[input.sortBy];
          if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
          return String(x ?? "").localeCompare(String(y ?? "")) * dir;
        });
      }
      return { version, total: rows.length, canViewRaw: perms.viewRaw, rows: rows.slice(input.offset, input.offset + input.limit) };
    }),

  /** 导出 CSV（前端视图或入库全量） */
  exportDataset: adminProcedure.input(z.object({ id: z.number(), version: z.number().optional(), view: z.enum(["view", "full"]).default("view") })).mutation(async ({ input, ctx }) => {
    const perms = await requireDatasetAccess(ctx, input.id);
    const [d] = await query<{ name: string; current_version: number; pipeline_json: string }>(sql`SELECT name, current_version, pipeline_json FROM uc_datasets WHERE id = ${input.id}`);
    if (!d) return fail("数据集不存在");
    const version = input.version ?? d.current_version;
    const raw = await query<{ data: string }>(input.view === "view"
      ? sql`SELECT view_json AS data FROM uc_dataset_rows WHERE dataset_id = ${input.id} AND version = ${version} ORDER BY row_index LIMIT 200000`
      : sql`SELECT full_json AS data FROM uc_dataset_rows WHERE dataset_id = ${input.id} AND version = ${version} ORDER BY row_index LIMIT 200000`);
    const rows = raw.map((r) => {
      const data = parseJson<Record<string, string | number | null>>(r.data, {});
      return input.view === "full" && !perms.viewRaw ? maskForAdmin(data, parseJson(d.pipeline_json, {})) : data;
    });
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    await audit(ctx.user, "导出数据", `dataset:${input.id}`, `v${version} ${input.view} ${rows.length} 行`);
    return { fileName: `${d.name}-v${version}.csv`, csv: toCsv(rows, columns), rows: rows.length };
  }),

  /** 人工修正一个单元格（记录在规则里，重跑后依然生效），并立即生成新版本 */
  editCell: adminProcedure.input(z.object({ id: z.number(), key: z.string().max(255), field: z.string(), value: z.union([z.string(), z.number(), z.null()]) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "editRules");
    await requireDatasetAccess(ctx, input.id);
    try {
      const pipeline = await loadPipeline(input.id);
      const overrides = pipeline.cleaning.overrides.filter((o) => !(o.key === input.key && o.field === input.field));
      overrides.push({ key: input.key, field: input.field, value: input.value });
      const next = { ...pipeline, cleaning: { ...pipeline.cleaning, overrides } };
      await exec(sql`UPDATE uc_datasets SET pipeline_json = ${JSON.stringify(next)} WHERE id = ${input.id}`);
      await audit(ctx.user, "修正数据", `dataset:${input.id}`, input);
      return await rerunDataset(input.id);
    } catch (error) {
      return fail(error);
    }
  }),

  deleteRows: adminProcedure.input(z.object({ id: z.number(), keys: z.array(z.string().max(255)).min(1).max(5000), restore: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "editRules");
    await requireDatasetAccess(ctx, input.id);
    try {
      const pipeline = await loadPipeline(input.id);
      const set = new Set(pipeline.cleaning.excludedKeys);
      for (const k of input.keys) input.restore ? set.delete(k) : set.add(k);
      const next = { ...pipeline, cleaning: { ...pipeline.cleaning, excludedKeys: [...set] } };
      await exec(sql`UPDATE uc_datasets SET pipeline_json = ${JSON.stringify(next)} WHERE id = ${input.id}`);
      await audit(ctx.user, input.restore ? "恢复数据行" : "删除数据行", `dataset:${input.id}`, `${input.keys.length} 行`);
      return await rerunDataset(input.id);
    } catch (error) {
      return fail(error);
    }
  }),

  clearCorrections: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "editRules");
    await requireDatasetAccess(ctx, input.id);
    const pipeline = await loadPipeline(input.id);
    const next = { ...pipeline, cleaning: { ...pipeline.cleaning, overrides: [], excludedKeys: [] } };
    await exec(sql`UPDATE uc_datasets SET pipeline_json = ${JSON.stringify(next)} WHERE id = ${input.id}`);
    await audit(ctx.user, "清除人工修正", `dataset:${input.id}`);
    return rerunDataset(input.id);
  }),

  renameDataset: adminProcedure.input(z.object({ id: z.number(), name: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "editRules");
    await exec(sql`UPDATE uc_datasets SET name = ${input.name} WHERE id = ${input.id}`);
    await audit(ctx.user, "重命名数据集", `dataset:${input.id}`, input.name);
    return { ok: true };
  }),

  /** 用当前原始数据试跑规则，不入库：返回清洗后前 100 行与统计，供后台实时验证清洗效果。 */
  previewRules: adminProcedure.input(z.object({ id: z.number(), pipeline: UcPipelineConfig })).mutation(async ({ input, ctx }) => {
    await requireDatasetAccess(ctx, input.id);
    try {
      const [d] = await query<{ source_id: number; table_key: string; fields_json: string }>(sql`SELECT source_id, table_key, fields_json FROM uc_datasets WHERE id = ${input.id}`);
      if (!d) return fail("数据集不存在");
      const [s] = await query<{ config_json: string }>(sql`SELECT config_json FROM uc_sources WHERE id = ${d.source_id}`);
      const tables = await readSourceTables(d.source_id, parseJson<SourceConfig>(s?.config_json, { kind: "zip" } as SourceConfig), { useSnapshot: true });
      const table = tables.find((t) => t.name === d.table_key) ?? tables[0];
      if (!table) return fail("找不到原始数据，请先运行一次数据源");
      const result = runRules(table, input.pipeline, parseJson<Field[]>(d.fields_json, []));
      return {
        rawColumns: table.columns,
        rawSample: table.rows.slice(0, 20),
        fields: result.fields,
        stats: result.stats,
        view: result.view.slice(0, 100),
        full: result.full.slice(0, 100),
      };
    } catch (error) {
      return fail(error);
    }
  }),

  /** 保存规则（含字段映射、格式转换、过滤、脱敏、推送方式），并立即用原始快照重跑一遍，产生新版本。 */
  saveRules: adminProcedure.input(z.object({ id: z.number(), pipeline: UcPipelineConfig, name: z.string().min(1).max(200).optional() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "editRules");
    await requireDatasetAccess(ctx, input.id);
    try {
      for (const f of input.pipeline.cleaning.fields) UcField.parse(f);
      const [d] = await query<{ source_id: number; name: string }>(sql`SELECT source_id, name FROM uc_datasets WHERE id = ${input.id}`);
      if (!d) return fail("数据集不存在");
      const pipeline = { ...input.pipeline };
      if (pipeline.push.mode === "trigger" && !pipeline.push.token) pipeline.push = { ...pipeline.push, token: randomBytes(18).toString("base64url") };
      await exec(sql`UPDATE uc_datasets SET pipeline_json = ${JSON.stringify(pipeline)}, name = ${input.name ?? d.name} WHERE id = ${input.id}`);
      await audit(ctx.user, "保存规则", `dataset:${input.id}`, { push: pipeline.push.mode, masking: pipeline.masking.length, transforms: pipeline.cleaning.transforms.length, filters: pipeline.cleaning.filters.length });
      const result = await runSource(d.source_id, "rules", { useSnapshot: true });
      return { ...result, token: pipeline.push.token };
    } catch (error) {
      return fail(error);
    }
  }),

  reviewVersion: adminProcedure.input(z.object({ id: z.number(), version: z.number(), approve: z.boolean() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "review");
    await requireDatasetAccess(ctx, input.id);
    if (input.approve) await publishDatasetVersion(input.id, input.version, ctx.user.id, "review");
    else await exec(sql`UPDATE uc_dataset_versions SET status = 'rejected', reviewed_by = ${ctx.user.id}, reviewed_at = CURRENT_TIMESTAMP WHERE dataset_id = ${input.id} AND version = ${input.version}`);
    await audit(ctx.user, input.approve ? "审核通过" : "审核驳回", `dataset:${input.id}`, `v${input.version}`);
    return { ok: true };
  }),

  withdrawVersion: adminProcedure.input(z.object({ id: z.number(), version: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "publish");
    await withdrawDatasetVersion(input.id, input.version, ctx.user.id);
    await audit(ctx.user, "撤回数据版本", `dataset:${input.id}`, `v${input.version}`);
    return { ok: true };
  }),

  /** 立即推送：有候选版本推候选，否则把当前已发布版本重新推一次（前端立刻刷新） */
  pushNow: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "publish");
    await requireDatasetAccess(ctx, input.id);
    try {
      let version = await pushLatestCandidate(input.id, "manual", ctx.user.id);
      if (version === null) {
        const [d] = await query<{ published_version: number }>(sql`SELECT published_version FROM uc_datasets WHERE id = ${input.id}`);
        if (!d?.published_version) return fail("还没有可推送的数据版本，请先运行数据源");
        await publishDatasetVersion(input.id, d.published_version, ctx.user.id, "manual");
        version = d.published_version;
      }
      await audit(ctx.user, "立即推送", `dataset:${input.id}`, `v${version}`);
      return { version };
    } catch (error) {
      return fail(error);
    }
  }),

  /** 数据质量：最新版本逐字段空值率、取值数、范围；近 30 个版本的行数趋势与新鲜度 */
  quality: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    await requireDatasetAccess(ctx, input.id);
    const [d] = await query<{ current_version: number; fields_json: string; name: string }>(sql`SELECT current_version, fields_json, name FROM uc_datasets WHERE id = ${input.id}`);
    if (!d) return fail("数据集不存在");
    const versions = await query<{ version: number; status: string; row_count: number; stats_json: string; created_at: string }>(sql`SELECT version, status, row_count, stats_json, created_at FROM uc_dataset_versions WHERE dataset_id = ${input.id} ORDER BY version DESC LIMIT 30`);
    const latestStats = parseJson<{ quality?: ReturnType<typeof qualityOf>; invalidCells?: number; duplicates?: number; rowsIn?: number; droppedRows?: number; filteredRows?: number }>(versions[0]?.stats_json, {});
    let quality = latestStats.quality;
    if (!quality && d.current_version) {
      const rows = await query<{ data: string }>(sql`SELECT full_json AS data FROM uc_dataset_rows WHERE dataset_id = ${input.id} AND version = ${d.current_version} LIMIT 50000`);
      quality = qualityOf(rows.map((r) => parseJson(r.data, {})), parseJson<Field[]>(d.fields_json, []));
    }
    const lastRun = versions[0]?.created_at ?? null;
    return {
      name: d.name,
      quality: quality ?? null,
      latest: { invalidCells: latestStats.invalidCells ?? 0, duplicates: latestStats.duplicates ?? 0, rowsIn: latestStats.rowsIn ?? 0, droppedRows: latestStats.droppedRows ?? 0, filteredRows: latestStats.filteredRows ?? 0 },
      trend: versions.map((v) => ({ version: v.version, rows: v.row_count, status: v.status, at: v.created_at })).reverse(),
      lastRun,
      ageHours: lastRun ? Math.round((Date.now() - new Date(lastRun).getTime()) / 36e5) : null,
    };
  }),

  /* ---------------------------------------------------------------- 模块 */
  modules: adminProcedure.input(z.object({ slotId: z.string().optional(), datasetId: z.number().optional() }).default({})).query(async ({ input }) => {
    const rows = await query<{ id: number; code: string; name: string; dataset_id: number; slot_id: string; template: string; status: string; published_version: number; variant_of: number | null; traffic_pct: number; sort_order: number; updated_at: string; dataset_name: string }>(
      sql`SELECT m.*, d.name AS dataset_name FROM uc_modules m LEFT JOIN uc_datasets d ON d.id = m.dataset_id
        WHERE (${input.slotId ?? null} IS NULL OR m.slot_id = ${input.slotId ?? null}) AND (${input.datasetId ?? null} IS NULL OR m.dataset_id = ${input.datasetId ?? null})
        ORDER BY m.slot_id, m.sort_order, m.id`);
    const events = await query<{ module_id: number; event: string; n: number }>(sql`SELECT module_id, event, COUNT(*) AS n FROM uc_module_events GROUP BY module_id, event`);
    const ev = new Map<number, Record<string, number>>();
    for (const e of events) ev.set(e.module_id, { ...(ev.get(e.module_id) ?? {}), [e.event]: Number(e.n) });
    return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, datasetId: r.dataset_id, datasetName: r.dataset_name, slotId: r.slot_id, template: r.template, status: r.status, publishedVersion: r.published_version, variantOf: r.variant_of, trafficPct: r.traffic_pct, sortOrder: r.sort_order, updatedAt: r.updated_at, events: ev.get(r.id) ?? {} }));
  }),

  module: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const [m] = await query<{ id: number; definition_json: string; status: string; published_version: number; variant_of: number | null; traffic_pct: number }>(sql`SELECT * FROM uc_modules WHERE id = ${input.id}`);
    if (!m) return fail("模块不存在");
    const versions = await query<{ version: number; published_at: string }>(sql`SELECT version, published_at FROM uc_module_versions WHERE module_id = ${input.id} ORDER BY version DESC LIMIT 30`);
    const events = await query<{ event: string; n: number }>(sql`SELECT event, COUNT(*) AS n FROM uc_module_events WHERE module_id = ${input.id} GROUP BY event`);
    return {
      id: m.id, status: m.status, publishedVersion: m.published_version, variantOf: m.variant_of, trafficPct: m.traffic_pct,
      definition: UcModuleDefinition.parse(parseJson(m.definition_json, {})),
      versions,
      events: Object.fromEntries(events.map((e) => [e.event, Number(e.n)])),
    };
  }),

  /** 后台预览：与前端完全同一份数据与配置，额外附带来源与血缘。 */
  preview: adminProcedure.input(z.object({ definition: UcModuleDefinition, version: z.number().optional() })).query(async ({ input }) => {
    try {
      return await buildModulePayload(input.definition, { mode: "admin", version: input.version });
    } catch (error) {
      return fail(error);
    }
  }),

  saveModule: adminProcedure.input(z.object({ id: z.number().nullable(), definition: UcModuleDefinition, publish: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "buildModules");
    if (input.publish) await requirePerm(ctx, "publish");
    try {
      const def = input.id ? input.definition : { ...input.definition, code: input.definition.code || slugify(input.definition.name) };
      const id = await saveModule(input.id, def, ctx.user.id);
      const version = input.publish ? await publishModule(id, ctx.user.id) : null;
      if (version) await logPush(def.datasetId, id, version, "manual", [def.slotId], "succeeded", `模块「${def.name}」v${version} 上线`);
      await audit(ctx.user, input.publish ? "保存并推送模块" : "保存模块", `module:${id}`, { name: def.name, template: def.template, slot: def.slotId });
      return { id, version };
    } catch (error) {
      return fail(error);
    }
  }),

  createModule: adminProcedure.input(z.object({ datasetId: z.number(), slotId: z.string().optional(), publish: z.boolean().default(false), template: z.string().optional(), name: z.string().max(120).optional() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "buildModules");
    try {
      const id = await createModuleForDataset(input.datasetId, { slotId: input.slotId, publish: input.publish, userId: ctx.user.id, name: input.name });
      if (input.template && UC_TEMPLATES.some((t) => t.code === input.template)) {
        const [m] = await query<{ definition_json: string }>(sql`SELECT definition_json FROM uc_modules WHERE id = ${id}`);
        const def = UcModuleDefinition.parse(parseJson(m?.definition_json, {}));
        await saveModule(id, { ...def, template: input.template as typeof def.template }, ctx.user.id);
      }
      await audit(ctx.user, "新建模块", `module:${id}`, { datasetId: input.datasetId, template: input.template });
      return { id };
    } catch (error) {
      return fail(error);
    }
  }),

  duplicateModule: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "buildModules");
    const [m] = await query<{ definition_json: string }>(sql`SELECT definition_json FROM uc_modules WHERE id = ${input.id}`);
    if (!m) return fail("模块不存在");
    const def = UcModuleDefinition.parse(parseJson(m.definition_json, {}));
    const id = await saveModule(null, { ...def, code: slugify(def.name), name: `${def.name}（副本）` }, ctx.user.id);
    await audit(ctx.user, "复制模块", `module:${id}`, `来自 module:${input.id}`);
    return { id };
  }),

  reorderModules: adminProcedure.input(z.object({ ids: z.array(z.number()).max(500) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "buildModules");
    const slots = new Set<string>();
    for (let i = 0; i < input.ids.length; i++) {
      await exec(sql`UPDATE uc_modules SET sort_order = ${i} WHERE id = ${input.ids[i]}`);
    }
    const rows = input.ids.length ? await query<{ slot_id: string }>(sql`SELECT DISTINCT slot_id FROM uc_modules WHERE id IN (${sql.join(input.ids.map((id) => sql`${id}`), sql`, `)})`) : [];
    for (const r of rows) slots.add(r.slot_id);
    if (slots.size) broadcastUcUpdate([...slots]);
    await audit(ctx.user, "调整模块顺序", "modules", input.ids.join(","));
    return { ok: true };
  }),

  publishModule: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "publish");
    try {
      const version = await publishModule(input.id, ctx.user.id);
      const [m] = await query<{ dataset_id: number; slot_id: string; name: string }>(sql`SELECT dataset_id, slot_id, name FROM uc_modules WHERE id = ${input.id}`);
      if (m) await logPush(m.dataset_id, input.id, version, "manual", [m.slot_id], "succeeded", `模块「${m.name}」v${version} 上线`);
      await audit(ctx.user, "推送模块", `module:${input.id}`, `v${version}`);
      return { version };
    } catch (error) {
      return fail(error);
    }
  }),

  unpublishModule: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "publish");
    await unpublishModule(input.id);
    await audit(ctx.user, "下线模块", `module:${input.id}`);
    return { ok: true };
  }),

  rollbackModule: adminProcedure.input(z.object({ id: z.number(), version: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "publish");
    try {
      const version = await rollbackModule(input.id, input.version, ctx.user.id);
      await audit(ctx.user, "回滚模块", `module:${input.id}`, `回到 v${input.version}（新版本 v${version}）`);
      return { version };
    } catch (error) {
      return fail(error);
    }
  }),

  deleteModule: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "buildModules");
    const [m] = await query<{ slot_id: string; name: string }>(sql`SELECT slot_id, name FROM uc_modules WHERE id = ${input.id}`);
    await exec(sql`DELETE FROM uc_modules WHERE variant_of = ${input.id}`);
    await exec(sql`DELETE FROM uc_module_versions WHERE module_id = ${input.id}`);
    await exec(sql`DELETE FROM uc_module_events WHERE module_id = ${input.id}`);
    await exec(sql`DELETE FROM uc_modules WHERE id = ${input.id}`);
    if (m) broadcastUcUpdate([m.slot_id]);
    await audit(ctx.user, "删除模块", `module:${input.id}`, m?.name ?? "");
    return { ok: true };
  }),

  /** A/B：复制为 B 版本并设置分流比例；再次调用则只更新比例。 */
  setVariant: adminProcedure.input(z.object({ id: z.number(), trafficPct: z.number().int().min(0).max(100) })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "buildModules");
    const [base] = await query<{ id: number; code: string; name: string; dataset_id: number; slot_id: string; template: string; definition_json: string }>(sql`SELECT * FROM uc_modules WHERE id = ${input.id}`);
    if (!base) return fail("模块不存在");
    const [existing] = await query<{ id: number }>(sql`SELECT id FROM uc_modules WHERE variant_of = ${input.id}`);
    if (existing) {
      await exec(sql`UPDATE uc_modules SET traffic_pct = ${input.trafficPct} WHERE id = ${existing.id}`);
      broadcastUcUpdate([base.slot_id]);
      await audit(ctx.user, "调整 A/B 分流", `module:${input.id}`, `B 版 ${input.trafficPct}%`);
      return { variantId: existing.id };
    }
    const def = UcModuleDefinition.parse(parseJson(base.definition_json, {}));
    const variantDef = { ...def, code: `${def.code.slice(0, 56)}-b${Date.now().toString(36).slice(-4)}`, name: `${def.name}（B 版）` };
    const { insertId } = await exec(sql`INSERT INTO uc_modules (code, name, dataset_id, slot_id, template, definition_json, variant_of, traffic_pct, updated_by)
      VALUES (${variantDef.code}, ${variantDef.name}, ${base.dataset_id}, ${base.slot_id}, ${base.template}, ${JSON.stringify(variantDef)}, ${input.id}, ${input.trafficPct}, ${ctx.user.id})`);
    await audit(ctx.user, "创建 A/B 版本", `module:${input.id}`, `B 版 ${input.trafficPct}%`);
    return { variantId: insertId };
  }),

  /** 把 B 版本的配置推为全量（覆盖 A 并删除 B）。 */
  promoteVariant: adminProcedure.input(z.object({ variantId: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "publish");
    const [v] = await query<{ variant_of: number | null; definition_json: string }>(sql`SELECT variant_of, definition_json FROM uc_modules WHERE id = ${input.variantId}`);
    if (!v?.variant_of) return fail("不是 B 版本");
    const [base] = await query<{ definition_json: string }>(sql`SELECT definition_json FROM uc_modules WHERE id = ${v.variant_of}`);
    const baseDef = UcModuleDefinition.parse(parseJson(base?.definition_json, {}));
    const variantDef = UcModuleDefinition.parse(parseJson(v.definition_json, {}));
    await saveModule(v.variant_of, { ...variantDef, code: baseDef.code, name: baseDef.name }, ctx.user.id);
    await exec(sql`DELETE FROM uc_modules WHERE id = ${input.variantId}`);
    await audit(ctx.user, "B 版转全量", `module:${v.variant_of}`);
    return { version: await publishModule(v.variant_of, ctx.user.id) };
  }),

  /* ---------------------------------------------------------------- 推送监控 */
  pushStatus: adminProcedure.query(async () => {
    const log = await query<{ id: number; dataset_id: number | null; module_id: number | null; version: number; mode: string; slots: string; clients: number; status: string; detail: string; created_at: string; dataset_name: string | null }>(
      sql`SELECT p.*, d.name AS dataset_name FROM uc_push_log p LEFT JOIN uc_datasets d ON d.id = p.dataset_id ORDER BY p.id DESC LIMIT 200`);
    const datasets = await query<{ id: number; name: string; pipeline_json: string; published_version: number; current_version: number; candidates: number; last_push: string | null }>(
      sql`SELECT d.id, d.name, d.pipeline_json, d.published_version, d.current_version,
        (SELECT COUNT(*) FROM uc_dataset_versions v WHERE v.dataset_id = d.id AND v.status = 'candidate') AS candidates,
        (SELECT MAX(created_at) FROM uc_push_log p WHERE p.dataset_id = d.id AND p.status = 'succeeded') AS last_push
        FROM uc_datasets d ORDER BY d.id DESC`);
    return {
      liveClients: ucStreamClientCount(),
      log,
      datasets: datasets.map((d) => {
        const cfg = UcPipelineConfig.safeParse(parseJson(d.pipeline_json, {}));
        const push = cfg.success ? cfg.data.push : { mode: "realtime" as const, everyMinutes: 60, at: "", token: "" };
        return { id: d.id, name: d.name, mode: push.mode, everyMinutes: push.everyMinutes, at: push.at, hasToken: !!push.token, token: push.token, reviewRequired: cfg.success ? cfg.data.reviewRequired : false, publishedVersion: d.published_version, currentVersion: d.current_version, candidates: Number(d.candidates), lastPush: d.last_push };
      }),
      market: marketHealth(),
    };
  }),

  /* ---------------------------------------------------------------- 日志与告警 */
  runs: adminProcedure.input(z.object({ sourceId: z.number().optional(), status: z.enum(["all", "succeeded", "failed", "running"]).default("all") }).default({ status: "all" })).query(async ({ input }) => {
    const rows = await query<{ id: number; source_id: number; trigger_kind: string; status: string; started_at: string; finished_at: string | null; stats_json: string | null; error: string | null; source_name: string | null }>(
      sql`SELECT r.*, s.name AS source_name FROM uc_runs r LEFT JOIN uc_sources s ON s.id = r.source_id
        WHERE (${input.sourceId ?? null} IS NULL OR r.source_id = ${input.sourceId ?? null})
          AND (${input.status} = 'all' OR r.status = ${input.status})
        ORDER BY r.id DESC LIMIT 200`);
    return rows.map((r) => ({ ...r, stats: parseJson(r.stats_json, {}) }));
  }),

  runSteps: adminProcedure.input(z.object({ runId: z.number() })).query(async ({ input }) => {
    return query<{ id: number; dataset_id: number | null; step: string; status: string; rows_in: number; rows_out: number; duration_ms: number; detail: string; created_at: string }>(sql`SELECT * FROM uc_run_steps WHERE run_id = ${input.runId} ORDER BY id`);
  }),

  alerts: adminProcedure.query(async () => query<{ id: number; kind: string; ref: string; severity: string; message: string; status: string; created_at: string }>(sql`SELECT * FROM uc_alerts ORDER BY (status = 'open') DESC, id DESC LIMIT 200`)),

  ackAlert: adminProcedure.input(z.object({ id: z.number().optional() })).mutation(async ({ input, ctx }) => {
    if (input.id) await exec(sql`UPDATE uc_alerts SET status = 'acknowledged' WHERE id = ${input.id}`);
    else await exec(sql`UPDATE uc_alerts SET status = 'acknowledged' WHERE status = 'open'`);
    await audit(ctx.user, "确认告警", input.id ? `alert:${input.id}` : "全部");
    return { ok: true };
  }),

  auditLog: adminProcedure.input(z.object({ search: z.string().max(100).default("") }).default({ search: "" })).query(async ({ input }) => {
    const q = `%${input.search}%`;
    return query<{ id: number; user_id: number | null; user_name: string; action: string; target: string; detail: string; created_at: string }>(
      input.search ? sql`SELECT * FROM uc_audit WHERE action LIKE ${q} OR target LIKE ${q} OR detail LIKE ${q} OR user_name LIKE ${q} ORDER BY id DESC LIMIT 300` : sql`SELECT * FROM uc_audit ORDER BY id DESC LIMIT 300`);
  }),

  /* ---------------------------------------------------------------- 权限管理 */
  members: adminProcedure.query(async ({ ctx }) => {
    await requirePerm(ctx, "manageMembers");
    const users = await query<{ id: number; name: string | null; email: string | null; role: string; lastSignedIn: string | null }>(sql`SELECT id, name, email, role, lastSignedIn FROM users ORDER BY (role = 'admin') DESC, id LIMIT 500`);
    const members = await query<{ user_id: number; uc_role: string; perms_json: string; updated_at: string }>(sql`SELECT * FROM uc_members`);
    const byUser = new Map(members.map((m) => [m.user_id, m]));
    const sources = await query<{ id: number; name: string }>(sql`SELECT id, name FROM uc_sources ORDER BY id`);
    return {
      roles: UC_ROLES.map((r) => ({ key: r.key, label: r.label, perms: r.perms })),
      permissions: UC_PERMISSIONS,
      sources,
      users: users.map((u) => {
        const m = byUser.get(u.id);
        const custom = parseJson<Record<string, unknown>>(m?.perms_json, {});
        return {
          id: u.id, name: u.name ?? "", email: u.email ?? "", systemRole: u.role, lastSignedIn: u.lastSignedIn,
          member: !!m, ucRole: m?.uc_role ?? (u.role === "admin" ? "admin" : null), custom, updatedAt: m?.updated_at ?? null,
        };
      }),
    };
  }),

  setMember: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["admin", "developer", "source_admin", "reviewer", "viewer"]), custom: z.record(z.string(), z.boolean()).default({}), sourceIds: z.union([z.literal("all"), z.array(z.number())]).default("all") }))
    .mutation(async ({ input, ctx }) => {
      await requirePerm(ctx, "manageMembers");
      if (input.userId === ctx.user.id && input.role !== "admin") return fail("不能降低自己的角色，请让其他管理员操作");
      const perms = { ...input.custom, sourceIds: input.sourceIds };
      await exec(sql`INSERT INTO uc_members (user_id, uc_role, perms_json, updated_by) VALUES (${input.userId}, ${input.role}, ${JSON.stringify(perms)}, ${ctx.user.id})
        ON DUPLICATE KEY UPDATE uc_role = VALUES(uc_role), perms_json = VALUES(perms_json), updated_by = VALUES(updated_by)`);
      await audit(ctx.user, "设置成员角色", `user:${input.userId}`, { role: input.role, custom: input.custom, sources: input.sourceIds });
      return { ok: true };
    }),

  removeMember: adminProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input, ctx }) => {
    await requirePerm(ctx, "manageMembers");
    if (input.userId === ctx.user.id) return fail("不能移除自己");
    await exec(sql`DELETE FROM uc_members WHERE user_id = ${input.userId}`);
    await audit(ctx.user, "移除成员", `user:${input.userId}`);
    return { ok: true };
  }),
});

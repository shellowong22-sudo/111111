/**
 * 非 tRPC 的两个入口：
 *  - POST /api/uc/upload   管理员上传 zip / csv / json / xlsx（原始二进制，最大 300MB）
 *  - GET  /api/uc/stream   前端实时刷新通道（SSE）
 */
import express, { type Express, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { UC_SLOTS } from "@shared/ucheerModules";
import { sdk } from "../_core/sdk";
import { pushLatestCandidate, runSource, startUcScheduler } from "./pipeline";
import { UcPipelineConfig } from "@shared/ucheerModules";
import { createModuleForDataset } from "./modules";
import { storeZipUpload } from "./runners";
import { autoSlotFor, importZipScripts, startupHealthCheck } from "./zipImport";
import { exec, parseJson, query } from "./store";
import { addUcStreamClient } from "./stream";

async function requireAdmin(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user && user.role === "admin") return user;
  } catch {
    /* fall through */
  }
  res.status(403).json({ error: "需要管理员权限" });
  return null;
}

export function registerUcRoutes(app: Express) {
  // 接口调用统计（平台运行指标页使用）
  app.use("/api/trpc", (req: Request, res: Response, next) => {
    const t0 = Date.now();
    res.on("finish", () => {
      void import("./hubs3").then((m) => m.recordApi(req.path, Date.now() - t0, res.statusCode < 400)).catch(() => undefined);
    });
    next();
  });
  app.post("/api/uc/upload", express.raw({ type: () => true, limit: "300mb" }), async (req: Request, res: Response) => {
    const user = await requireAdmin(req, res);
    if (!user) return;
    try {
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || !buf.length) {
        res.status(400).json({ error: "文件为空" });
        return;
      }
      const fileName = String(req.query.name ?? "upload.zip").slice(0, 200);
      const autoSlot = !req.query.slot || req.query.slot === "auto";
      const slotId = UC_SLOTS.some((s) => s.id === req.query.slot) ? String(req.query.slot) : "tool.board";
      const autoModules = req.query.modules !== "0";
      const autoPublish = req.query.publish === "1";
      let sourceId = Number(req.query.sourceId ?? 0);

      if (sourceId) {
        const [existing] = await query<{ id: number; kind: string }>(sql`SELECT id, kind FROM uc_sources WHERE id = ${sourceId}`);
        if (!existing || existing.kind !== "zip") {
          res.status(404).json({ error: "要替换的 zip 数据源不存在" });
          return;
        }
      } else {
        const { insertId } = await exec(sql`INSERT INTO uc_sources (name, kind, config_json, slot_id, created_by)
          VALUES (${fileName.replace(/\.[^.]+$/, "")}, 'zip', '{}', ${slotId}, ${user.id})`);
        sourceId = insertId;
      }
      const config = await storeZipUpload(sourceId, fileName, buf);
      await exec(sql`UPDATE uc_sources SET config_json = ${JSON.stringify(config)} WHERE id = ${sourceId}`);
      const result = await runSource(sourceId, "upload");

      const created: number[] = [];
      const placed: Record<number, string> = {};
      if (autoModules) {
        for (const d of result.datasets) {
          const [has] = await query<{ n: number }>(sql`SELECT COUNT(*) AS n FROM uc_modules WHERE dataset_id = ${d.datasetId}`);
          const target = autoSlot ? await autoSlotFor(d.datasetId) : slotId;
          placed[d.datasetId] = target;
          if (Number(has?.n ?? 0) === 0) created.push(await createModuleForDataset(d.datasetId, { slotId: target, publish: autoPublish, userId: user.id }));
        }
      }
      // 压缩包里的功能脚本：后台逐个试跑，能出数据的自动接入并推送（结果在“日志与监控”里）
      const scripts = await importZipScripts(sourceId, { userId: user.id, publish: autoPublish, slot: autoSlot ? "auto" : slotId }).catch(() => ({ queued: 0 }));
      if (!result.datasets.length && !scripts.queued) {
        res.status(422).json({ error: "压缩包里没有可用的数据表、文档或能输出数据的脚本（依赖清单、配置文件、图片等已自动忽略）", sourceId });
        return;
      }
      res.json({ ok: true, sourceId, runId: result.runId, datasets: result.datasets.map((d) => ({ ...d, slot: placed[d.datasetId] ?? null })), modulesCreated: created, scriptsQueued: scripts.queued });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[uc] 上传失败", message);
      res.status(500).json({ error: message });
    }
  });

  /**
   * 触发式推送：外部系统调用 /api/uc/trigger/<令牌>（GET 或 POST）即把该数据集最新候选版本推到前端；
   * 带 ?run=1 时先重新拉取数据源再推送。令牌在“推送配置”里生成，只有知道令牌的人能触发。
   */
  app.all("/api/uc/trigger/:token", async (req: Request, res: Response) => {
    const token = String(req.params.token ?? "");
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
      res.status(404).json({ error: "无效的触发地址" });
      return;
    }
    try {
      const rows = await query<{ id: number; source_id: number; pipeline_json: string }>(sql`SELECT id, source_id, pipeline_json FROM uc_datasets WHERE pipeline_json LIKE ${`%${token}%`}`);
      const hit = rows.find((r) => {
        const cfg = UcPipelineConfig.safeParse(parseJson(r.pipeline_json, {}));
        return cfg.success && cfg.data.push.mode === "trigger" && cfg.data.push.token === token;
      });
      if (!hit) {
        res.status(404).json({ error: "无效的触发地址" });
        return;
      }
      if (req.query.run === "1") await runSource(hit.source_id, "manual").catch(() => undefined);
      const version = await pushLatestCandidate(hit.id, "trigger");
      res.json({ ok: true, pushed: version !== null, version });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * 行情推送：浏览器只连一次，服务端每秒检查订阅的标的，有变化立刻推过去（不再每 3 秒轮询一次整批）。
   * 多个页面订阅同一批标的时共用同一次上游请求（行情服务内部 1~2 秒合并缓存）。
   */
  app.get("/api/uc/quotes", async (req: Request, res: Response) => {
    const symbols = String(req.query.symbols ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 400);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const { getTicks } = await import("./market");
    const last = new Map<string, string>();
    let closed = false;
    let beat = 0;
    req.on("close", () => { closed = true; });
    while (!closed) {
      const started = Date.now();
      try {
        const ticks = await getTicks(symbols, { budgetMs: 900 });
        const changed: Record<string, unknown> = {};
        for (const [k, t] of Object.entries(ticks)) {
          if (!t) continue;
          const sig = `${t.price}|${t.time}|${t.volume}`;
          if (last.get(k) !== sig) {
            last.set(k, sig);
            changed[k] = t;
          }
        }
        if (Object.keys(changed).length) res.write(`event: ticks\ndata: ${JSON.stringify({ at: Date.now(), ticks: changed })}\n\n`);
        else if (++beat % 15 === 0) res.write(": ping\n\n");
      } catch {
        /* 下一秒再试 */
      }
      await new Promise((r) => setTimeout(r, Math.max(200, 1000 - (Date.now() - started))));
    }
  });

  app.get("/api/uc/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(": connected\n\n");
    addUcStreamClient(res);
  });

  startUcScheduler();
  void import("./warehouse").then((m) => m.startWarehouse());
  void import("./trade").then((m) => m.startMatcher());
  void import("./news").then((m) => m.startNewsEngine());
  void import("./warm").then((m) => m.startWarmup());
  // 启动 1 分钟后在后台补齐预置数据源（已装过或被管理员删除的不会重复安装）
  setTimeout(() => void startupHealthCheck(), 90_000).unref?.();
  setTimeout(() => {
    void import("./presets").then((m) => m.installPresets()).catch((error) => console.warn("[uc] 预置数据源安装失败", error instanceof Error ? error.message : error));
  }, 60_000).unref?.();
}

export { parseJson };

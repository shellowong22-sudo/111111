/**
 * zip 接入的后半程 + 全站数据体检：
 *  - autoSlotFor：按表名 / 字段自动选择推送位置
 *  - importZipScripts：压缩包里能输出数据的 Python 脚本逐个试跑，成功的注册为定时数据源并推送到前端
 *  - cleanupJunk：清理历史上传里被误识别为数据的配置文件 / 依赖清单 / 单列表
 *  - findDuplicates / mergeDuplicates：找出内容完全相同的数据集与重复上线的模块，合并为一份
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { UcField } from "@shared/ucheerModules";
import { readZip } from "./zip";
import { findZipScripts, guessSlot, isJunkPath } from "./zipSmart";
import { jsonToTable } from "./parse";
import { SCRIPT_CATALOG, runZipScript, sourceDir, type ZipScriptSourceConfig, type ZipSourceConfig } from "./runners";
import { audit, exec, parseJson, query, raiseAlert } from "./store";
import { runSource } from "./pipeline";
import { createModuleForDataset } from "./modules";
import { broadcastUcUpdate } from "./stream";

export async function autoSlotFor(datasetId: number): Promise<string> {
  const [d] = await query<{ name: string; table_key: string; fields_json: string }>(sql`SELECT name, table_key, fields_json FROM uc_datasets WHERE id = ${datasetId}`);
  if (!d) return "tool.board";
  const fields = parseJson<UcField[]>(d.fields_json, []);
  return guessSlot(`${d.table_key} ${d.name}`, fields.map((f) => `${f.name} ${f.label}`)).slot;
}

/* ------------------------------------------------------------------ 功能脚本 */
const scriptJobs = new Set<number>();

export async function importZipScripts(zipSourceId: number, options: { userId?: number | null; publish?: boolean; slot?: string | null } = {}) {
  if (scriptJobs.has(zipSourceId)) return { queued: 0 };
  const [src] = await query<{ name: string; config_json: string }>(sql`SELECT name, config_json FROM uc_sources WHERE id = ${zipSourceId}`);
  if (!src) return { queued: 0 };
  const cfg = parseJson<ZipSourceConfig>(src.config_json, {} as ZipSourceConfig);
  if (!cfg.storedAs) return { queued: 0 };
  const buf = await readFile(path.join(sourceDir(zipSourceId), cfg.storedAs));
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (!isZip) return { queued: 0 };
  const known = new Set(SCRIPT_CATALOG.map((s) => s.script));
  const existing = new Set((await query<{ config_json: string }>(sql`SELECT config_json FROM uc_sources WHERE kind = 'zipscript'`))
    .map((r) => parseJson<ZipScriptSourceConfig>(r.config_json, {} as ZipScriptSourceConfig))
    .filter((c) => c.zipSourceId === zipSourceId)
    .map((c) => `${c.file}|${c.command}`));
  const scripts = findZipScripts(readZip(buf), known).slice(0, 40);
  if (!scripts.length) return { queued: 0 };
  scriptJobs.add(zipSourceId);
  void (async () => {
    const ok: string[] = [];
    const failed: string[] = [];
    const queue = [...scripts];
    const worker = async () => {
      while (queue.length) {
        const s = queue.shift()!;
        const commands = s.commands.length ? s.commands.slice(0, 2) : [""];
        for (const command of commands) {
          if (existing.has(`${s.file}|${command}`)) continue;
          const config: ZipScriptSourceConfig = { kind: "zipscript", zipSourceId, file: s.file, command, args: [] };
          try {
            const value = await runZipScript(config, 45_000);
            const table = jsonToTable("probe", value);
            if (!table || table.rows.length < 2 || table.columns.length < 2) throw new Error("没有输出数据行");
            const stem = s.file.split("/").pop()!.replace(/\.py$/i, "");
            const name = `${src.name} · ${stem}${command ? ` ${command}` : ""}`.slice(0, 200);
            const slot = options.slot && options.slot !== "auto" ? options.slot : guessSlot(`${s.file} ${command}`, table.columns).slot;
            const { insertId } = await exec(sql`INSERT INTO uc_sources (name, kind, config_json, slot_id, interval_minutes, created_by)
              VALUES (${name}, 'zipscript', ${JSON.stringify(config)}, ${slot}, 1440, ${options.userId ?? null})`);
            const result = await runSource(insertId, "manual");
            for (const d of result.datasets) await createModuleForDataset(d.datasetId, { slotId: slot, publish: options.publish !== false, userId: options.userId ?? null, name });
            ok.push(`${stem}${command ? ` ${command}` : ""} → ${slot}`);
            break;
          } catch (error) {
            failed.push(`${s.file}${command ? ` ${command}` : ""}：${(error instanceof Error ? error.message : String(error)).split("\n").pop()?.slice(0, 120)}`);
          }
        }
      }
    };
    try {
      await Promise.all([worker(), worker(), worker()]);
      await audit({ id: options.userId ?? undefined, name: "系统" }, "zip 功能脚本接入", `source:${zipSourceId}`, { ok, failed: failed.slice(0, 40) });
      await raiseAlert("zip_scripts", `source:${zipSourceId}`, `「${src.name}」功能脚本接入完成：成功 ${ok.length} 个${ok.length ? `（${ok.slice(0, 6).join("；")}${ok.length > 6 ? " 等" : ""}）` : ""}，${failed.length} 个需要参数或依赖未接入`, ok.length ? "info" : "warning");
    } finally {
      scriptJobs.delete(zipSourceId);
    }
  })();
  return { queued: scripts.length };
}

/* ------------------------------------------------------------------ 清理与去重 */
async function deleteDataset(datasetId: number) {
  const mods = await query<{ id: number; slot_id: string }>(sql`SELECT id, slot_id FROM uc_modules WHERE dataset_id = ${datasetId}`);
  for (const m of mods) {
    await exec(sql`DELETE FROM uc_module_versions WHERE module_id = ${m.id}`);
    await exec(sql`DELETE FROM uc_module_events WHERE module_id = ${m.id}`).catch(() => undefined);
  }
  await exec(sql`DELETE FROM uc_modules WHERE dataset_id = ${datasetId}`);
  await exec(sql`DELETE FROM uc_dataset_rows WHERE dataset_id = ${datasetId}`);
  await exec(sql`DELETE FROM uc_dataset_versions WHERE dataset_id = ${datasetId}`);
  await exec(sql`DELETE FROM uc_datasets WHERE id = ${datasetId}`);
  return mods.map((m) => m.slot_id);
}

/** 历史上传里的垃圾表：依赖清单 / 配置 / 翻译包 / 单列表 / 空表 */
export async function cleanupJunk(user: { id?: number; name?: string | null } | null = null) {
  const rows = await query<{ id: number; name: string; table_key: string; fields_json: string; row_count: number; source_name: string }>(sql`SELECT d.id, d.name, d.table_key, d.fields_json, d.row_count, s.name AS source_name
    FROM uc_datasets d JOIN uc_sources s ON s.id = d.source_id WHERE s.kind = 'zip'`);
  const removed: string[] = [];
  const slots: string[] = [];
  for (const d of rows) {
    const fields = parseJson<UcField[]>(d.fields_json, []);
    const keyPath = `${d.table_key}.csv`;
    const junk = isJunkPath(d.table_key) || isJunkPath(keyPath) || /(^|\/)requirements[^/]*$/i.test(d.table_key) || fields.length < 2 || (d.row_count < 2 && !/项目文档/.test(d.name));
    if (!junk) continue;
    slots.push(...(await deleteDataset(d.id)));
    removed.push(`${d.source_name} / ${d.table_key}`);
  }
  if (slots.length) broadcastUcUpdate(slots);
  if (removed.length) await audit(user ?? { name: "系统" }, "清理无效数据", "datasets", removed.slice(0, 200));
  return { removed };
}

export type DuplicateGroup = { hash: string; keep: { id: number; name: string; source: string }; duplicates: Array<{ id: number; name: string; source: string; modules: number }> };

/** 内容完全相同的数据集（按已发布版本的内容指纹） */
export async function findDuplicates(): Promise<{ datasets: DuplicateGroup[]; modules: Array<{ slot: string; dataset: string; ids: number[] }>; sources: Array<{ name: string; ids: number[] }> }> {
  const versions = await query<{ dataset_id: number; stats_json: string; name: string; source_name: string; source_id: number }>(sql`SELECT v.dataset_id, v.stats_json, d.name, s.name AS source_name, s.id AS source_id
    FROM uc_dataset_versions v JOIN uc_datasets d ON d.id = v.dataset_id AND d.published_version = v.version JOIN uc_sources s ON s.id = d.source_id`);
  const byHash = new Map<string, typeof versions>();
  for (const v of versions) {
    const hash = parseJson<{ hash?: string }>(v.stats_json, {}).hash;
    if (!hash) continue;
    const list = byHash.get(hash) ?? [];
    list.push(v);
    byHash.set(hash, list);
  }
  const datasets: DuplicateGroup[] = [];
  for (const [hash, list] of byHash) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.dataset_id - b.dataset_id);
    const dups = [];
    for (const d of list.slice(1)) {
      const [m] = await query<{ n: number }>(sql`SELECT COUNT(*) AS n FROM uc_modules WHERE dataset_id = ${d.dataset_id} AND status = 'published'`);
      dups.push({ id: d.dataset_id, name: d.name, source: d.source_name, modules: Number(m?.n ?? 0) });
    }
    datasets.push({ hash, keep: { id: list[0].dataset_id, name: list[0].name, source: list[0].source_name }, duplicates: dups });
  }
  // 同一数据集在同一页面上线了多个模块（不含 A/B 变体）
  const modRows = await query<{ id: number; slot_id: string; dataset_id: number; name: string }>(sql`SELECT m.id, m.slot_id, m.dataset_id, d.name FROM uc_modules m JOIN uc_datasets d ON d.id = m.dataset_id
    WHERE m.status = 'published' AND m.variant_of IS NULL ORDER BY m.id`);
  const modGroups = new Map<string, { slot: string; dataset: string; ids: number[] }>();
  for (const m of modRows) {
    const key = `${m.slot_id}|${m.dataset_id}`;
    const g = modGroups.get(key) ?? { slot: m.slot_id, dataset: m.name, ids: [] };
    g.ids.push(m.id);
    modGroups.set(key, g);
  }
  // 同名数据源（重复上传同一个 zip，例如“xxx (1)”）
  const srcRows = await query<{ id: number; name: string; kind: string }>(sql`SELECT id, name, kind FROM uc_sources ORDER BY id`);
  const srcGroups = new Map<string, { name: string; ids: number[] }>();
  for (const s of srcRows) {
    const key = `${s.kind}|${s.name.replace(/\s*[(（]\d+[)）]\s*$/, "").trim().toLowerCase()}`;
    const g = srcGroups.get(key) ?? { name: s.name.replace(/\s*[(（]\d+[)）]\s*$/, "").trim(), ids: [] };
    g.ids.push(s.id);
    srcGroups.set(key, g);
  }
  return {
    datasets,
    modules: [...modGroups.values()].filter((g) => g.ids.length > 1),
    sources: [...srcGroups.values()].filter((g) => g.ids.length > 1),
  };
}

/** 合并：重复数据集的模块下线（归档），重复上线的模块只保留最早一个。数据本身保留，可在后台恢复。 */
export async function mergeDuplicates(user: { id?: number; name?: string | null } | null = null) {
  const report = await findDuplicates();
  const slots: string[] = [];
  let archived = 0;
  for (const g of report.datasets) {
    for (const d of g.duplicates) {
      const mods = await query<{ id: number; slot_id: string }>(sql`SELECT id, slot_id FROM uc_modules WHERE dataset_id = ${d.id} AND status = 'published'`);
      for (const m of mods) {
        await exec(sql`UPDATE uc_modules SET status = 'archived' WHERE id = ${m.id}`);
        slots.push(m.slot_id);
        archived += 1;
      }
    }
  }
  for (const g of report.modules) {
    for (const id of g.ids.slice(1)) {
      await exec(sql`UPDATE uc_modules SET status = 'archived' WHERE id = ${id} AND status = 'published'`);
      slots.push(g.slot);
      archived += 1;
    }
  }
  if (slots.length) broadcastUcUpdate(slots);
  await audit(user ?? { name: "系统" }, "合并重复数据", "modules", { archived, datasetGroups: report.datasets.length, moduleGroups: report.modules.length });
  return { archived, report };
}

/** 启动后跑一次体检：清理垃圾表 + 合并完全重复的内容 */
export async function startupHealthCheck() {
  try {
    const junk = await cleanupJunk();
    const merged = await mergeDuplicates();
    if (junk.removed.length || merged.archived) {
      await raiseAlert("housekeeping", "system", `数据体检：清理无效数据表 ${junk.removed.length} 个，下线重复模块 ${merged.archived} 个（数据保留，可在模块工作台恢复）`, "info");
    }
  } catch (error) {
    console.warn("[uc] 数据体检失败", error instanceof Error ? error.message : error);
  }
}

/**
 * 自动化管线：接入 → 清洗 → 去重 → 脱敏 → 入库 → 推送。
 * 每一步写 uc_run_steps；失败写 uc_alerts；推送通过 SSE 通知前端刷新。
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  UcPipelineConfig,
  type UcField,
  type UcFilter,
  type UcMaskRule,
  type UcPipelineConfig as PipelineConfig,
  type UcTransform,
} from "@shared/ucheerModules";
import { inferFields, isSourceField, parseDate, parseNumber, toHalfWidth, type RawTable } from "./parse";
import { readSourceTables, type SourceConfig } from "./runners";
import { exec, parseJson, query, raiseAlert } from "./store";
import { broadcastUcUpdate, ucStreamClientCount } from "./stream";

export type CleanRow = Record<string, string | number | null>;

export type PipelineResult = {
  view: CleanRow[];
  full: CleanRow[];
  keys: string[];
  fields: UcField[];
  stats: {
    rowsIn: number; rowsCleaned: number; rowsDeduped: number; invalidCells: number; droppedRows: number; filteredRows: number; duplicates: number;
    maskedFields: string[]; hiddenSourceFields: string[]; quality: ReturnType<typeof qualityOf>;
  };
};

/* ------------------------------------------------------------------ 规则执行（纯函数，预览与正式运行共用） */

function convert(value: unknown, field: UcField, trim: boolean): { value: string | number | null; invalid: boolean } {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return { value: null, invalid: false };
  const raw = value as string | number | boolean;
  if (field.type === "number" || field.type === "percent") {
    const n = parseNumber(raw);
    return { value: n, invalid: n === null };
  }
  if (field.type === "date") {
    const d = parseDate(raw);
    return { value: d, invalid: d === null };
  }
  const s = String(raw);
  return { value: trim ? toHalfWidth(s).trim() : s, invalid: false };
}

function hashValue(v: unknown) {
  return createHash("sha256").update(String(v)).digest("hex").slice(0, 12);
}

function applyMask(value: string | number | null, rule: UcMaskRule): string | number | null | undefined {
  if (rule.method === "hide") return undefined;
  if (value === null) return null;
  if (rule.method === "hash") return hashValue(value);
  if (rule.method === "replace") return rule.param || "***";
  if (rule.method === "round") {
    const n = typeof value === "number" ? value : parseNumber(value);
    if (n === null) return value;
    const digits = Math.max(0, Math.min(8, Number(rule.param || 0)));
    return Number(n.toFixed(digits));
  }
  // partial：保留首尾 N 个字符
  const s = String(value);
  const keep = Math.max(0, Math.min(8, Number(rule.param || 1)));
  if (s.length <= keep * 2) return "*".repeat(s.length);
  return `${s.slice(0, keep)}${"*".repeat(Math.min(6, s.length - keep * 2))}${s.slice(s.length - keep)}`;
}

export function effectiveFields(table: RawTable, config: PipelineConfig, stored?: UcField[]): UcField[] {
  const inferred = inferFields(table);
  const configured = config.cleaning.fields.length ? config.cleaning.fields : stored?.length ? stored : inferred;
  const bySource = new Map(configured.map((f) => [f.source, f]));
  // 新出现的列按自动识别追加，删除的列排除
  const merged = [...configured, ...inferred.filter((f) => !bySource.has(f.source))];
  return merged.filter((f) => !config.cleaning.dropped.includes(f.source) && table.columns.includes(f.source));
}

/* ---------- 格式转换 / 计算字段 / 过滤 ---------- */

function applyTransform(value: string | number | null, t: UcTransform): string | number | null {
  if (value === null) return null;
  const n = typeof value === "number" ? value : parseNumber(value);
  switch (t.op) {
    case "scale": {
      const k = Number(t.param);
      return n === null || !Number.isFinite(k) ? value : Number((n * k).toPrecision(12));
    }
    case "round": return n === null ? value : Number(n.toFixed(Math.max(0, Math.min(8, Number(t.param) || 0))));
    case "abs": return n === null ? value : Math.abs(n);
    case "clip": {
      const [lo, hi] = t.param.split(",").map((x) => (x.trim() === "" ? NaN : Number(x)));
      if (n === null) return value;
      let v = n;
      if (Number.isFinite(lo)) v = Math.max(lo, v);
      if (Number.isFinite(hi)) v = Math.min(hi, v);
      return v;
    }
    case "percent_to_decimal": return n === null ? value : Number((n / 100).toPrecision(15));
    case "decimal_to_percent": return n === null ? value : Number((n * 100).toPrecision(15));
    case "replace": {
      const [from, to = ""] = t.param.split("|");
      return from ? String(value).split(from).join(to) : value;
    }
    case "regex_extract": {
      try {
        const m = new RegExp(t.param).exec(String(value));
        return m ? (m[1] ?? m[0]) : null;
      } catch {
        return value;
      }
    }
    case "map": {
      const pairs = new Map(t.param.split(/[;；]/).map((kv) => kv.split("=").map((x) => x.trim()) as [string, string]).filter((kv) => kv[0]));
      return pairs.has(String(value)) ? pairs.get(String(value))! : value;
    }
    case "upper": return String(value).toUpperCase();
    case "lower": return String(value).toLowerCase();
    case "prefix": return `${t.param}${value}`;
    case "suffix": return `${value}${t.param}`;
    case "date_format": {
      const d = String(value);
      if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return value;
      const fmt = t.param.trim().toUpperCase() || "YYYY-MM-DD";
      return fmt.replace("YYYY", d.slice(0, 4)).replace("MM", d.slice(5, 7)).replace("DD", d.slice(8, 10));
    }
  }
  return value;
}

/** 安全的四则运算：只认数字、[字段名]、字段名、+ - * / ( ) */
export function evalExpr(expr: string, row: CleanRow, fieldNames: string[]): number | null {
  const names = [...fieldNames].sort((a, b) => b.length - a.length);
  const tokens: Array<string | number> = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ("+-*/()".includes(ch)) { tokens.push(ch); i++; continue; }
    if (ch === "[") {
      const j = expr.indexOf("]", i);
      if (j < 0) return null;
      const name = expr.slice(i + 1, j).trim();
      const v = row[name];
      const n = typeof v === "number" ? v : v == null ? null : parseNumber(v);
      if (n === null) return null;
      tokens.push(n);
      i = j + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(expr.slice(i));
    if (num) { tokens.push(Number(num[0])); i += num[0].length; continue; }
    const name = names.find((nm) => expr.startsWith(nm, i));
    if (!name) return null;
    const v = row[name];
    const n = typeof v === "number" ? v : v == null ? null : parseNumber(v);
    if (n === null) return null;
    tokens.push(n);
    i += name.length;
  }
  // 递归下降
  let pos = 0;
  const peek = () => tokens[pos];
  const factor = (): number => {
    const t = tokens[pos++];
    if (t === "-") return -factor();
    if (t === "+") return factor();
    if (t === "(") { const v = sum(); pos++; return v; }
    if (typeof t === "number") return t;
    throw new Error("bad");
  };
  const product = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = tokens[pos++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[pos++];
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = sum();
    return pos === tokens.length && Number.isFinite(v) ? Number(v.toPrecision(12)) : null;
  } catch {
    return null;
  }
}

function matchFilter(value: string | number | null, f: UcFilter): boolean {
  const s = value === null ? "" : String(value);
  const n = typeof value === "number" ? value : parseNumber(s);
  const vn = parseNumber(f.value);
  switch (f.op) {
    case "eq": return n !== null && vn !== null ? n === vn : s === f.value;
    case "ne": return n !== null && vn !== null ? n !== vn : s !== f.value;
    case "gt": return n !== null && vn !== null && n > vn;
    case "gte": return n !== null && vn !== null && n >= vn;
    case "lt": return n !== null && vn !== null && n < vn;
    case "lte": return n !== null && vn !== null && n <= vn;
    case "contains": return s.includes(f.value);
    case "not_contains": return !s.includes(f.value);
    case "not_empty": return s.trim() !== "";
    case "in": return f.value.split(/[,，]/).map((x) => x.trim()).includes(s);
  }
  return true;
}

export const recordKeyOf = (row: Record<string, unknown>, keys: string[]) =>
  (keys.length ? keys.map((k) => String(row[k] ?? "")).join("|") : createHash("sha1").update(JSON.stringify(row)).digest("hex")).slice(0, 255);

export function runRules(table: RawTable, rawConfig: unknown, stored?: UcField[]): PipelineResult {
  const config = UcPipelineConfig.parse(rawConfig ?? {});
  const baseFields = effectiveFields(table, config, stored);
  let invalidCells = 0;
  let droppedRows = 0;
  let filteredRows = 0;

  // 1. 清洗：类型识别 → 格式转换 → 计算字段
  const derivedFields: UcField[] = config.cleaning.derived
    .filter((d) => !baseFields.some((f) => f.name === d.name))
    .map((d) => ({ name: d.name, source: `=${d.expr}`, type: d.type, label: d.label || d.name }));
  const fields = [...baseFields, ...derivedFields];
  const fieldNames = fields.map((f) => f.name);
  const transforms = config.cleaning.transforms.filter((t) => fieldNames.includes(t.field));
  let items: Array<{ row: CleanRow; key: string }> = table.rows.map((r) => {
    const o: CleanRow = {};
    for (const f of baseFields) {
      const { value, invalid } = convert(r[f.source], f, config.cleaning.trim);
      if (invalid) invalidCells++;
      o[f.name] = value;
    }
    for (const t of transforms) if (t.field in o) o[t.field] = applyTransform(o[t.field] ?? null, t);
    for (const d of config.cleaning.derived) o[d.name] = evalExpr(d.expr, o, fieldNames);
    return { row: o, key: "" };
  });

  // 记录键：去重键优先，否则按内容生成；人工修正与删除都按它定位
  const keys = config.dedup.keys.filter((k) => fieldNames.includes(k));
  items = items.map((it) => ({ row: it.row, key: recordKeyOf(it.row, keys) }));

  // 人工删除 / 修正
  if (config.cleaning.excludedKeys.length) {
    const ex = new Set(config.cleaning.excludedKeys);
    const before = items.length;
    items = items.filter((it) => !ex.has(it.key));
    droppedRows += before - items.length;
  }
  if (config.cleaning.overrides.length) {
    const byKey = new Map<string, Array<{ field: string; value: string | number | null }>>();
    for (const ov of config.cleaning.overrides) byKey.set(ov.key, [...(byKey.get(ov.key) ?? []), ov]);
    items = items.map((it) => {
      const ovs = byKey.get(it.key);
      if (!ovs) return it;
      const row = { ...it.row };
      for (const ov of ovs) if (ov.field in row) row[ov.field] = ov.value;
      return { ...it, row };
    });
  }

  // 行过滤
  const filters = config.cleaning.filters.filter((f) => fieldNames.includes(f.field));
  if (filters.length) {
    const before = items.length;
    items = items.filter((it) => filters.every((f) => matchFilter(it.row[f.field] ?? null, f)));
    filteredRows = before - items.length;
  }

  // 缺失值
  const valueFields = fields.filter((f) => f.type !== "string").map((f) => f.name);
  if (config.cleaning.missing === "drop_row") {
    const before = items.length;
    items = items.filter((it) => valueFields.every((k) => it.row[k] !== null));
    droppedRows += before - items.length;
  } else if (config.cleaning.missing === "fill_zero") {
    items = items.map((it) => {
      const o = { ...it.row };
      for (const f of fields) if ((f.type === "number" || f.type === "percent") && o[f.name] === null) o[f.name] = 0;
      return { ...it, row: o };
    });
  } else if (config.cleaning.missing === "fill_previous") {
    const last: CleanRow = {};
    items = items.map((it) => {
      const o = { ...it.row };
      for (const k of Object.keys(o)) {
        if (o[k] === null && last[k] !== undefined) o[k] = last[k];
        else if (o[k] !== null) last[k] = o[k];
      }
      return { ...it, row: o };
    });
  }
  const rowsCleaned = items.length;

  // 2. 去重
  let duplicates = 0;
  if (keys.length) {
    const map = new Map<string, { row: CleanRow; key: string }>();
    for (const it of items) {
      if (map.has(it.key)) {
        duplicates++;
        if (config.dedup.strategy === "latest") { map.delete(it.key); map.set(it.key, it); }
      } else map.set(it.key, it);
    }
    items = [...map.values()];
  } else {
    const seen = new Set<string>();
    items = items.filter((it) => {
      if (seen.has(it.key)) { duplicates++; return false; }
      seen.add(it.key);
      return true;
    });
  }

  // 按第一个日期字段排序（升序），没有日期则保持原顺序
  const dateField = fields.find((f) => f.type === "date")?.name;
  if (dateField) items.sort((a, b) => String(a.row[dateField] ?? "").localeCompare(String(b.row[dateField] ?? "")));
  const rows = items.map((it) => it.row);

  // 3. 脱敏：来源类字段一律不进入前端视图
  const hiddenSourceFields = fields.filter(isSourceField).map((f) => f.name);
  const maskRules = config.masking.filter((m) => fieldNames.includes(m.field));
  const view = rows.map((r) => {
    const o: CleanRow = { ...r };
    for (const k of hiddenSourceFields) delete o[k];
    for (const rule of maskRules) {
      const masked = applyMask(o[rule.field] ?? null, rule);
      if (masked === undefined) delete o[rule.field];
      else o[rule.field] = masked;
    }
    return o;
  });

  return {
    view,
    full: rows,
    keys: items.map((it) => it.key),
    fields,
    stats: {
      rowsIn: table.rows.length,
      rowsCleaned,
      rowsDeduped: rows.length,
      invalidCells,
      droppedRows,
      filteredRows,
      duplicates,
      maskedFields: maskRules.map((m) => m.field),
      hiddenSourceFields,
      quality: qualityOf(rows, fields),
    },
  };
}

/** 数据质量：每个字段的空值率、取值个数、最小最大值、最新日期 */
export function qualityOf(rows: CleanRow[], fields: UcField[]) {
  const total = rows.length || 1;
  const perField = fields.map((f) => {
    let nulls = 0;
    let min: number | null = null;
    let max: number | null = null;
    let latest: string | null = null;
    const distinct = new Set<string>();
    for (const r of rows) {
      const v = r[f.name];
      if (v === null || v === undefined || v === "") { nulls++; continue; }
      if (distinct.size < 5000) distinct.add(String(v));
      if (typeof v === "number") {
        min = min === null ? v : Math.min(min, v);
        max = max === null ? v : Math.max(max, v);
      }
      if (f.type === "date" && (latest === null || String(v) > latest)) latest = String(v);
    }
    return { name: f.name, label: f.label, type: f.type, nullRate: Number((nulls / total).toFixed(4)), distinct: distinct.size, min, max, latest };
  });
  const dates = perField.filter((f) => f.latest).map((f) => f.latest!) ;
  return { rows: rows.length, latestDate: dates.sort().pop() ?? null, fields: perField };
}

/** 后台读取时按“作用范围 = 所有人”的规则脱敏（无“查看原值”权限的角色） */
export function maskForAdmin(row: CleanRow, rawConfig: unknown): CleanRow {
  const config = UcPipelineConfig.parse(rawConfig ?? {});
  const o: CleanRow = { ...row };
  for (const rule of config.masking.filter((m) => m.scope === "everyone")) {
    if (!(rule.field in o)) continue;
    const masked = applyMask(o[rule.field] ?? null, rule);
    if (masked === undefined) o[rule.field] = "（已隐藏）";
    else o[rule.field] = masked;
  }
  return o;
}

/** 前端可见的字段（去掉来源字段与被“隐藏”脱敏的字段）。 */
export function visibleFields(fields: UcField[], rawConfig: unknown): UcField[] {
  const config = UcPipelineConfig.parse(rawConfig ?? {});
  const hidden = new Set(config.masking.filter((m) => m.method === "hide").map((m) => m.field));
  return fields.filter((f) => !isSourceField(f) && !hidden.has(f.name));
}

/* ------------------------------------------------------------------ 运行与入库 */

type SourceRow = { id: number; name: string; kind: string; config_json: string; slot_id: string };
type DatasetRow = { id: number; source_id: number; table_key: string; name: string; fields_json: string; pipeline_json: string; current_version: number; published_version: number };

async function logStep(runId: number, datasetId: number | null, step: string, status: string, rowsIn: number, rowsOut: number, started: number, detail = "") {
  await exec(sql`INSERT INTO uc_run_steps (run_id, dataset_id, step, status, rows_in, rows_out, duration_ms, detail)
    VALUES (${runId}, ${datasetId}, ${step}, ${status}, ${rowsIn}, ${rowsOut}, ${Date.now() - started}, ${detail.slice(0, 2000)})`);
}

async function storeVersion(dataset: DatasetRow, result: PipelineResult, runId: number, config: PipelineConfig): Promise<number> {
  const version = dataset.current_version + 1;
  // 实时推送且无需审核：入库即发布；定时 / 触发 / 需审核：先作为候选版本
  const status = config.reviewRequired || config.push.mode !== "realtime" ? "candidate" : "published";
  await exec(sql`INSERT INTO uc_dataset_versions (dataset_id, version, status, row_count, stats_json, run_id)
    VALUES (${dataset.id}, ${version}, ${status}, ${result.view.length}, ${JSON.stringify(result.stats)}, ${runId})`);
  for (let i = 0; i < result.view.length; i += 400) {
    const chunk = result.view.slice(i, i + 400);
    const values = chunk.map((viewRow, j) => {
      const full = result.full[i + j];
      return sql`(${dataset.id}, ${version}, ${i + j}, ${result.keys[i + j] ?? ""}, ${JSON.stringify(viewRow)}, ${JSON.stringify(full)})`;
    });
    await exec(sql`INSERT INTO uc_dataset_rows (dataset_id, version, row_index, record_key, view_json, full_json) VALUES ${sql.join(values, sql`, `)}`);
  }
  await exec(sql`UPDATE uc_datasets SET current_version = ${version}, row_count = ${result.view.length}, fields_json = ${JSON.stringify(result.fields)} WHERE id = ${dataset.id}`);
  if (status === "published") await publishDatasetVersion(dataset.id, version, null, "realtime");
  await pruneVersions(dataset.id);
  return version;
}

/** 只保留最近 10 个版本的数据行，节省空间（版本记录保留）。 */
/** 数据永久保留：所有版本的行都留在库里（内容没变化时不会产生新版本，不会无限膨胀） */
async function pruneVersions(_datasetId: number) {
  return;
}

export async function publishDatasetVersion(datasetId: number, version: number, reviewerId: number | null, mode: "realtime" | "schedule" | "trigger" | "manual" | "review" = "manual") {
  try {
    await exec(sql`UPDATE uc_dataset_versions SET status = 'superseded' WHERE dataset_id = ${datasetId} AND status = 'published' AND version <> ${version}`);
    await exec(sql`UPDATE uc_dataset_versions SET status = 'published', reviewed_by = ${reviewerId}, reviewed_at = CURRENT_TIMESTAMP WHERE dataset_id = ${datasetId} AND version = ${version}`);
    await exec(sql`UPDATE uc_datasets SET published_version = ${version} WHERE id = ${datasetId}`);
    const mods = await query<{ id: number; slot_id: string }>(sql`SELECT id, slot_id FROM uc_modules WHERE dataset_id = ${datasetId} AND status = 'published'`);
    const slots = [...new Set(mods.map((m) => m.slot_id))];
    if (slots.length) broadcastUcUpdate(slots);
    await logPush(datasetId, null, version, mode, slots, "succeeded", mods.length ? `推送到 ${mods.length} 个模块` : "数据已发布（暂无已上线模块）");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logPush(datasetId, null, version, mode, [], "failed", message);
    await raiseAlert("push_failed", `dataset:${datasetId}`, `推送失败：${message}`, "critical");
    throw error;
  }
}

export async function logPush(datasetId: number | null, moduleId: number | null, version: number, mode: string, slots: string[], status: string, detail: string) {
  try {
    await exec(sql`INSERT INTO uc_push_log (dataset_id, module_id, version, mode, slots, clients, status, detail)
      VALUES (${datasetId}, ${moduleId}, ${version}, ${mode}, ${slots.join(",").slice(0, 500)}, ${ucStreamClientCount()}, ${status}, ${detail.slice(0, 1000)})`);
  } catch {
    /* 日志失败不影响推送 */
  }
}

/** 推送最新候选版本（定时 / 触发 / 后台“立即推送”） */
export async function pushLatestCandidate(datasetId: number, mode: "schedule" | "trigger" | "manual", reviewerId: number | null = null) {
  const [latest] = await query<{ version: number }>(sql`SELECT version FROM uc_dataset_versions WHERE dataset_id = ${datasetId} AND status = 'candidate' ORDER BY version DESC LIMIT 1`);
  if (!latest) return null;
  await publishDatasetVersion(datasetId, latest.version, reviewerId, mode);
  return latest.version;
}

export async function withdrawDatasetVersion(datasetId: number, version: number, reviewerId: number | null) {
  await exec(sql`UPDATE uc_dataset_versions SET status = 'withdrawn', reviewed_by = ${reviewerId}, reviewed_at = CURRENT_TIMESTAMP WHERE dataset_id = ${datasetId} AND version = ${version}`);
  const previous = await query<{ version: number }>(sql`SELECT version FROM uc_dataset_versions WHERE dataset_id = ${datasetId} AND version < ${version} AND status IN ('published','superseded') ORDER BY version DESC LIMIT 1`);
  const fallback = previous[0]?.version ?? 0;
  if (fallback) await publishDatasetVersion(datasetId, fallback, reviewerId);
  else {
    await exec(sql`UPDATE uc_datasets SET published_version = 0 WHERE id = ${datasetId}`);
    const slots = await query<{ slot_id: string }>(sql`SELECT DISTINCT slot_id FROM uc_modules WHERE dataset_id = ${datasetId}`);
    if (slots.length) broadcastUcUpdate(slots.map((s) => s.slot_id));
  }
}

const running = new Set<number>();

/**
 * 运行一个来源的完整管线。zip 来源会为压缩包里的每张表各建一个数据集；
 * 重新上传同结构的 zip 时按表名复用已有数据集与规则。
 */
export async function runSource(sourceId: number, trigger: "upload" | "manual" | "schedule" | "rules", options: { useSnapshot?: boolean } = {}) {
  if (running.has(sourceId)) throw new Error("该数据源正在运行，请稍候");
  running.add(sourceId);
  const startedRun = Date.now();
  const [source] = await query<SourceRow>(sql`SELECT id, name, kind, config_json, slot_id FROM uc_sources WHERE id = ${sourceId}`);
  if (!source) { running.delete(sourceId); throw new Error("数据源不存在"); }
  const { insertId: runId } = await exec(sql`INSERT INTO uc_runs (source_id, trigger_kind) VALUES (${sourceId}, ${trigger})`);
  const summary: Array<{ datasetId: number; name: string; version: number; rows: number }> = [];
  try {
    let t = Date.now();
    let tables: RawTable[];
    try {
      tables = await readSourceTables(sourceId, parseJson<SourceConfig>(source.config_json, { kind: "zip" } as SourceConfig), options);
    } catch (error) {
      await logStep(runId, null, "ingest", "failed", 0, 0, t, error instanceof Error ? error.message : String(error));
      throw error;
    }
    await logStep(runId, null, "ingest", "succeeded", 0, tables.reduce((n, x) => n + x.rows.length, 0), t, `${tables.length} 张表`);
    if (!tables.length && source.kind !== "zip") throw new Error("没有识别到任何数据表（支持 csv / tsv / json / ndjson / xlsx）");
    if (!tables.length) await logStep(runId, null, "ingest", "succeeded", 0, 0, t, "压缩包里没有数据表，转为识别功能脚本与文档");

    for (const table of tables) {
      let [dataset] = await query<DatasetRow>(sql`SELECT * FROM uc_datasets WHERE source_id = ${sourceId} AND table_key = ${table.name}`);
      if (!dataset) {
        const fields = inferFields(table);
        const config = UcPipelineConfig.parse({});
        const { insertId } = await exec(sql`INSERT INTO uc_datasets (source_id, table_key, name, fields_json, pipeline_json)
          VALUES (${sourceId}, ${table.name}, ${table.name.split("/").pop()!.slice(0, 200)}, ${JSON.stringify(fields)}, ${JSON.stringify(config)})`);
        [dataset] = await query<DatasetRow>(sql`SELECT * FROM uc_datasets WHERE id = ${insertId}`);
      }
      const config = UcPipelineConfig.parse(parseJson(dataset.pipeline_json, {}));
      t = Date.now();
      const result = runRules(table, config, parseJson<UcField[]>(dataset.fields_json, []));
      await logStep(runId, dataset.id, "clean", "succeeded", result.stats.rowsIn, result.stats.rowsCleaned, t, `无效单元格 ${result.stats.invalidCells}，丢弃行 ${result.stats.droppedRows}`);
      await logStep(runId, dataset.id, "dedup", "succeeded", result.stats.rowsCleaned, result.stats.rowsDeduped, t, `重复 ${result.stats.duplicates}`);
      await logStep(runId, dataset.id, "mask", "succeeded", result.stats.rowsDeduped, result.view.length, t, `脱敏字段 ${result.stats.maskedFields.join("、") || "无"}；来源字段 ${result.stats.hiddenSourceFields.join("、") || "无"}`);
      t = Date.now();
      // 数据与上一版完全相同则不产生新版本（定时数据源不会刷出大量重复版本）
      const contentHash = createHash("sha1").update(JSON.stringify(result.view)).update(JSON.stringify(result.fields)).digest("hex");
      const [lastVer] = await query<{ version: number; stats_json: string }>(sql`SELECT version, stats_json FROM uc_dataset_versions WHERE dataset_id = ${dataset.id} ORDER BY version DESC LIMIT 1`);
      if (lastVer && parseJson<{ hash?: string }>(lastVer.stats_json, {}).hash === contentHash && trigger !== "rules") {
        await logStep(runId, dataset.id, "store", "succeeded", result.view.length, 0, t, `数据无变化，沿用 v${lastVer.version}`);
        summary.push({ datasetId: dataset.id, name: dataset.name, version: lastVer.version, rows: result.view.length });
        continue;
      }
      (result.stats as Record<string, unknown>).hash = contentHash;
      const version = await storeVersion(dataset, result, runId, config);
      await logStep(runId, dataset.id, "store", "succeeded", result.view.length, result.view.length, t, `版本 v${version}${config.reviewRequired ? "（待审核）" : ""}`);
      const waiting = config.reviewRequired ? "等待审核" : config.push.mode === "schedule" ? (config.push.at ? `等待每天 ${config.push.at} 定时推送` : `等待定时推送（每 ${config.push.everyMinutes} 分钟）`) : config.push.mode === "trigger" ? "等待触发推送" : "";
      await logStep(runId, dataset.id, "push", waiting ? "waiting" : "succeeded", result.view.length, waiting ? 0 : result.view.length, t, waiting || "已推送到前端");
      if (result.stats.rowsCleaned > 20 && result.stats.duplicates / result.stats.rowsCleaned > 0.2) {
        await raiseAlert("quality", `dataset:${dataset.id}`, `「${dataset.name}」重复数据比例 ${(result.stats.duplicates / result.stats.rowsCleaned * 100).toFixed(0)}%，请检查去重键`, "info");
      }
      const [prevVer] = await query<{ row_count: number }>(sql`SELECT row_count FROM uc_dataset_versions WHERE dataset_id = ${dataset.id} AND version = ${version - 1}`);
      if (prevVer && prevVer.row_count > 20 && result.view.length < prevVer.row_count * 0.5) {
        await raiseAlert("quality", `dataset:${dataset.id}`, `「${dataset.name}」本次行数 ${result.view.length}，比上一版（${prevVer.row_count}）减少一半以上`, "warning");
      }
      if (result.stats.rowsIn > 0 && result.stats.invalidCells / Math.max(1, result.stats.rowsIn * result.fields.length) > 0.05) {
        await raiseAlert("quality", `dataset:${dataset.id}`, `「${dataset.name}」无效单元格比例超过 5%（${result.stats.invalidCells} 个）`);
      }
      summary.push({ datasetId: dataset.id, name: dataset.name, version, rows: result.view.length });
    }
    await exec(sql`UPDATE uc_runs SET status = 'succeeded', finished_at = CURRENT_TIMESTAMP, stats_json = ${JSON.stringify({ datasets: summary, ms: Date.now() - startedRun })} WHERE id = ${runId}`);
    await exec(sql`UPDATE uc_sources SET last_run_at = CURRENT_TIMESTAMP, last_status = 'succeeded', last_error = NULL WHERE id = ${sourceId}`);
    return { runId, datasets: summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await exec(sql`UPDATE uc_runs SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error = ${message.slice(0, 2000)} WHERE id = ${runId}`);
    await exec(sql`UPDATE uc_sources SET last_run_at = CURRENT_TIMESTAMP, last_status = 'failed', last_error = ${message.slice(0, 1000)} WHERE id = ${sourceId}`);
    await raiseAlert("pipeline_failed", `source:${sourceId}`, `「${source.name}」运行失败：${message}`, "critical");
    throw error;
  } finally {
    running.delete(sourceId);
  }
}

/* ------------------------------------------------------------------ 定时调度 */

const lastScheduledPush = new Map<number, number>();

function beijingNow() {
  const d = new Date(Date.now() + 8 * 3600e3);
  return { date: d.toISOString().slice(0, 10), hm: d.toISOString().slice(11, 16) };
}

/** 定时推送：间隔到点，或每天到了设定时间，把最新候选版本推到前端 */
async function runScheduledPushes() {
  const rows = await query<{ id: number; pipeline_json: string }>(sql`SELECT d.id, d.pipeline_json FROM uc_datasets d
    WHERE EXISTS (SELECT 1 FROM uc_dataset_versions v WHERE v.dataset_id = d.id AND v.status = 'candidate')`);
  const now = Date.now();
  const bj = beijingNow();
  for (const row of rows) {
    const config = UcPipelineConfig.safeParse(parseJson(row.pipeline_json, {}));
    if (!config.success || config.data.push.mode !== "schedule" || config.data.reviewRequired) continue;
    const push = config.data.push;
    if (!lastScheduledPush.has(row.id)) {
      const [last] = await query<{ t: string | Date | null }>(sql`SELECT MAX(created_at) AS t FROM uc_push_log WHERE dataset_id = ${row.id} AND status = 'succeeded'`);
      lastScheduledPush.set(row.id, last?.t ? new Date(last.t).getTime() : 0);
    }
    const last = lastScheduledPush.get(row.id) ?? 0;
    let due: boolean;
    if (push.at) {
      const lastBj = new Date(last + 8 * 3600e3).toISOString().slice(0, 10);
      due = bj.hm >= push.at && lastBj < bj.date;
    } else {
      due = now - last >= push.everyMinutes * 60_000;
    }
    if (!due) continue;
    try {
      await pushLatestCandidate(row.id, "schedule");
    } finally {
      lastScheduledPush.set(row.id, now);
    }
  }
}

let schedulerStarted = false;

export function startUcScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  let lastHousekeeping = 0;
  const tick = async () => {
    try {
      await runScheduledPushes();
    } catch {
      /* 数据库不可用时等待下一轮 */
    }
    try {
      const { attachModulesForPresets } = await import("./presets");
      await attachModulesForPresets();
    } catch {
      /* 下一轮 */
    }
    if (Date.now() - lastHousekeeping > 3600_000) {
      lastHousekeeping = Date.now();
      try {
        await exec(sql`DELETE s FROM uc_run_steps s JOIN uc_runs r ON r.id = s.run_id WHERE r.started_at < (CURRENT_TIMESTAMP - INTERVAL 365 DAY)`);
        await exec(sql`DELETE FROM uc_runs WHERE started_at < (CURRENT_TIMESTAMP - INTERVAL 365 DAY)`);
        await exec(sql`DELETE FROM uc_push_log WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL 365 DAY)`);
        await exec(sql`DELETE FROM uc_alerts WHERE status = 'acknowledged' AND created_at < (CURRENT_TIMESTAMP - INTERVAL 30 DAY)`);
      } catch {
        /* 清理失败不影响运行 */
      }
    }
    try {
      const due = await query<{ id: number }>(sql`SELECT id FROM uc_sources
        WHERE enabled = 1 AND interval_minutes > 0 AND kind <> 'zip'
          AND (last_run_at IS NULL OR last_run_at < (CURRENT_TIMESTAMP - INTERVAL interval_minutes MINUTE))
        ORDER BY id LIMIT 5`);
      for (const s of due) {
        await runSource(s.id, "schedule").catch((error) => console.warn(`[uc] 定时运行失败 source=${s.id}:`, error instanceof Error ? error.message : error));
      }
    } catch (error) {
      // 数据库不可用时静默等待下一轮
      if (process.env.NODE_ENV !== "production") console.warn("[uc] 调度检查失败", error instanceof Error ? error.message : error);
    }
  };
  setTimeout(() => void tick(), 30_000).unref?.();
  setInterval(() => void tick(), 60_000).unref?.();
}

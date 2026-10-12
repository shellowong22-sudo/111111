/**
 * 模块：数据集 + 模板 + 字段绑定 + 参数 + 挂载槽位。
 * 前端与后台预览都通过 buildModulePayload 取数，保证两边看到的完全一致；
 * 后台多返回一层来源与血缘（lineage），前端永远拿不到。
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  UcModuleDefinition,
  UcModuleParams,
  UC_SLOTS,
  suggestTemplate,
  type UcField,
  type UcModuleDefinition as ModuleDefinition,
  type UcPublishedModule,
} from "@shared/ucheerModules";
import { visibleFields } from "./pipeline";
import { exec, parseJson, query } from "./store";
import { broadcastUcUpdate } from "./stream";

type ModuleRow = {
  id: number; code: string; name: string; dataset_id: number; slot_id: string; template: string;
  definition_json: string; status: string; published_version: number; sort_order: number;
  variant_of: number | null; traffic_pct: number; updated_at: string | Date;
};
type DatasetRow = { id: number; source_id: number; name: string; fields_json: string; pipeline_json: string; current_version: number; published_version: number; updated_at: string | Date };

const MAX_ROWS_TO_CLIENT = 5000;

export function slugify(text: string): string {
  const ascii = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const hash = createHash("sha1").update(text + Date.now() + Math.random()).digest("hex").slice(0, 6);
  return `${ascii || "m"}-${hash}`.replace(/^-/, "m-");
}

export async function getDataset(datasetId: number): Promise<DatasetRow | undefined> {
  const [row] = await query<DatasetRow>(sql`SELECT * FROM uc_datasets WHERE id = ${datasetId}`);
  return row;
}

export async function createModuleForDataset(datasetId: number, options: { slotId?: string; publish?: boolean; userId?: number | null; name?: string }) {
  const dataset = await getDataset(datasetId);
  if (!dataset) throw new Error("数据集不存在");
  const [source] = await query<{ slot_id: string }>(sql`SELECT slot_id FROM uc_sources WHERE id = ${dataset.source_id}`);
  const fields = visibleFields(parseJson<UcField[]>(dataset.fields_json, []), parseJson(dataset.pipeline_json, {}));
  const { template, bindings } = suggestTemplate(fields);
  const name = (options.name ?? dataset.name).slice(0, 120);
  const definition: ModuleDefinition = UcModuleDefinition.parse({
    code: slugify(name),
    name,
    datasetId,
    template,
    bindings,
    params: UcModuleParams.parse({ title: name }),
    slotId: options.slotId ?? source?.slot_id ?? "tool.board",
  });
  const { insertId } = await exec(sql`INSERT INTO uc_modules (code, name, dataset_id, slot_id, template, definition_json, updated_by)
    VALUES (${definition.code}, ${definition.name}, ${datasetId}, ${definition.slotId}, ${definition.template}, ${JSON.stringify(definition)}, ${options.userId ?? null})`);
  if (options.publish) await publishModule(insertId, options.userId ?? null);
  return insertId;
}

export async function saveModule(id: number | null, definition: ModuleDefinition, userId: number | null) {
  const def = UcModuleDefinition.parse(definition);
  if (id) {
    await exec(sql`UPDATE uc_modules SET name = ${def.name}, dataset_id = ${def.datasetId}, slot_id = ${def.slotId}, template = ${def.template},
      definition_json = ${JSON.stringify(def)}, updated_by = ${userId} WHERE id = ${id}`);
    return id;
  }
  const { insertId } = await exec(sql`INSERT INTO uc_modules (code, name, dataset_id, slot_id, template, definition_json, updated_by)
    VALUES (${def.code}, ${def.name}, ${def.datasetId}, ${def.slotId}, ${def.template}, ${JSON.stringify(def)}, ${userId})`);
  return insertId;
}

export async function publishModule(id: number, userId: number | null) {
  const [m] = await query<ModuleRow>(sql`SELECT * FROM uc_modules WHERE id = ${id}`);
  if (!m) throw new Error("模块不存在");
  const dataset = await getDataset(m.dataset_id);
  if (!dataset?.published_version) throw new Error("该数据集还没有已发布的数据版本，请先运行或审核通过");
  const [last] = await query<{ v: number | null }>(sql`SELECT MAX(version) AS v FROM uc_module_versions WHERE module_id = ${id}`);
  const version = Number(last?.v ?? 0) + 1;
  await exec(sql`INSERT INTO uc_module_versions (module_id, version, definition_json, published_by) VALUES (${id}, ${version}, ${m.definition_json}, ${userId})`);
  await exec(sql`UPDATE uc_modules SET status = 'published', published_version = ${version} WHERE id = ${id}`);
  broadcastUcUpdate([m.slot_id]);
  return version;
}

export async function unpublishModule(id: number) {
  const [m] = await query<ModuleRow>(sql`SELECT slot_id FROM uc_modules WHERE id = ${id}`);
  await exec(sql`UPDATE uc_modules SET status = 'draft' WHERE id = ${id}`);
  if (m) broadcastUcUpdate([m.slot_id]);
}

export async function rollbackModule(id: number, version: number, userId: number | null) {
  const [v] = await query<{ definition_json: string }>(sql`SELECT definition_json FROM uc_module_versions WHERE module_id = ${id} AND version = ${version}`);
  if (!v) throw new Error("版本不存在");
  const def = UcModuleDefinition.parse(parseJson(v.definition_json, {}));
  await exec(sql`UPDATE uc_modules SET definition_json = ${v.definition_json}, template = ${def.template}, slot_id = ${def.slotId}, dataset_id = ${def.datasetId}, updated_by = ${userId} WHERE id = ${id}`);
  return publishModule(id, userId);
}

/* ------------------------------------------------------------------ 取数（前后台共用） */

async function loadRows(datasetId: number, version: number, column: "view_json" | "full_json") {
  const rows = await query<{ data: string }>(column === "view_json"
    ? sql`SELECT view_json AS data FROM uc_dataset_rows WHERE dataset_id = ${datasetId} AND version = ${version} ORDER BY row_index`
    : sql`SELECT full_json AS data FROM uc_dataset_rows WHERE dataset_id = ${datasetId} AND version = ${version} ORDER BY row_index`);
  return rows.map((r) => parseJson<Record<string, string | number | null>>(r.data, {}));
}

function applyParams(rows: Array<Record<string, string | number | null>>, def: ModuleDefinition) {
  let out = rows;
  const sortBy = def.params.sortBy;
  if (sortBy) {
    const dir = def.params.sortDir === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const x = a[sortBy], y = b[sortBy];
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x ?? "").localeCompare(String(y ?? "")) * dir;
    });
  }
  if (def.params.limit > 0) out = def.params.sortDir === "desc" || !sortBy ? out.slice(-def.params.limit) : out.slice(0, def.params.limit);
  return out.slice(-MAX_ROWS_TO_CLIENT);
}

export async function buildModulePayload(def: ModuleDefinition, options: { version?: number; mode: "frontend" | "admin"; publishedVersion?: number }) {
  const dataset = await getDataset(def.datasetId);
  if (!dataset) throw new Error("数据集不存在");
  const version = options.version ?? (options.mode === "frontend" ? dataset.published_version : dataset.current_version);
  const pipeline = parseJson(dataset.pipeline_json, {});
  let fields = visibleFields(parseJson<UcField[]>(dataset.fields_json, []), pipeline).map(({ name, type, label }) => ({ name, type, label }));
  let baseRows = version ? await loadRows(def.datasetId, version, "view_json") : [];

  // 多数据源组合：union 追加行，join 按字段拼列
  for (const part of def.combine ?? []) {
    const other = await getDataset(part.datasetId);
    if (!other) continue;
    const otherVersion = options.mode === "frontend" ? other.published_version : other.current_version;
    if (!otherVersion) continue;
    const otherFields = visibleFields(parseJson<UcField[]>(other.fields_json, []), parseJson(other.pipeline_json, {})).map(({ name, type, label }) => ({ name, type, label }));
    const otherRows = await loadRows(other.id, otherVersion, "view_json");
    if (part.mode === "union") {
      for (const f of otherFields) if (!fields.some((x) => x.name === f.name)) fields = [...fields, f];
      baseRows = [...baseRows, ...otherRows];
      const dateField = fields.find((f) => f.type === "date")?.name;
      if (dateField) baseRows.sort((a, b) => String(a[dateField] ?? "").localeCompare(String(b[dateField] ?? "")));
    } else if (part.on) {
      const prefix = part.prefix || `${other.name}·`;
      const byKey = new Map(otherRows.map((r) => [String(r[part.on] ?? ""), r]));
      const added = otherFields.filter((f) => f.name !== part.on).map((f) => ({ ...f, name: `${prefix}${f.name}`, label: `${prefix}${f.label}` }));
      fields = [...fields, ...added.filter((f) => !fields.some((x) => x.name === f.name))];
      baseRows = baseRows.map((r) => {
        const match = byKey.get(String(r[part.on] ?? ""));
        if (!match) return r;
        const o = { ...r };
        for (const f of otherFields) if (f.name !== part.on) o[`${prefix}${f.name}`] = match[f.name] ?? null;
        return o;
      });
    }
  }
  const rows = applyParams(baseRows, def);
  const payload: UcPublishedModule = {
    code: def.code,
    name: def.name,
    version: options.publishedVersion ?? version,
    slotId: def.slotId,
    template: def.template,
    bindings: def.bindings,
    params: def.params,
    fields,
    rows,
    updatedAt: new Date(dataset.updated_at).toISOString(),
  };
  if (options.mode === "frontend") return payload;
  const [source] = await query<{ id: number; name: string; kind: string }>(sql`SELECT id, name, kind FROM uc_sources WHERE id = ${dataset.source_id}`);
  const [ver] = await query<{ status: string; run_id: number | null; stats_json: string; created_at: string }>(sql`SELECT status, run_id, stats_json, created_at FROM uc_dataset_versions WHERE dataset_id = ${dataset.id} AND version = ${version}`);
  return {
    ...payload,
    lineage: {
      sourceId: source?.id ?? null,
      sourceName: source?.name ?? "",
      sourceKind: source?.kind ?? "",
      datasetName: dataset.name,
      datasetVersion: version,
      publishedVersion: dataset.published_version,
      versionStatus: ver?.status ?? "none",
      runId: ver?.run_id ?? null,
      stats: parseJson(ver?.stats_json, {}),
      versionCreatedAt: ver?.created_at ?? null,
    },
  };
}

/** A/B：同一用户稳定落在同一个版本。 */
function bucket(userKey: string, moduleCode: string) {
  return parseInt(createHash("md5").update(`${userKey}:${moduleCode}`).digest("hex").slice(0, 8), 16) % 100;
}

export async function publishedModulesForSlots(slotIds: string[], userKey: string) {
  const valid = slotIds.filter((s) => UC_SLOTS.some((x) => x.id === s));
  if (!valid.length) return [];
  const rows = await query<ModuleRow>(sql`SELECT * FROM uc_modules WHERE status = 'published' AND slot_id IN (${sql.join(valid.map((s) => sql`${s}`), sql`, `)}) ORDER BY sort_order, id`);
  const variants = new Map<number, ModuleRow>();
  for (const r of rows) if (r.variant_of) variants.set(r.variant_of, r);
  const out: UcPublishedModule[] = [];
  for (const r of rows) {
    if (r.variant_of) continue;
    const variant = variants.get(r.id);
    const chosen = variant && bucket(userKey, r.code) < variant.traffic_pct ? variant : r;
    const [v] = await query<{ definition_json: string }>(sql`SELECT definition_json FROM uc_module_versions WHERE module_id = ${chosen.id} AND version = ${chosen.published_version}`);
    const parsed = UcModuleDefinition.safeParse(parseJson(v?.definition_json ?? chosen.definition_json, {}));
    if (!parsed.success) continue;
    try {
      const payload = (await buildModulePayload(parsed.data, { mode: "frontend", publishedVersion: chosen.published_version })) as UcPublishedModule;
      out.push({ ...payload, code: chosen.code });
    } catch (error) {
      console.warn(`[uc] 模块 ${r.code} 取数失败:`, error instanceof Error ? error.message : error);
    }
  }
  return out;
}

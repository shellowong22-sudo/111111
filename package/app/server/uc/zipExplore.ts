/**
 * 压缩包 / 数据接口内容浏览：后台逐字查看上传内容，并给出“可以映射成什么”。
 *  - tree：压缩包里所有文件（目录、大小、类型、是否已入库、为什么被忽略）
 *  - file：任意文件原文一字不差（文本 / 代码 / 文档），图片可预览，表格给出解析结果
 *  - mapping：可用的前端模板、推荐的推送页面、字段类型、数值列 / 日期列 / 代码列
 *  - raw：接口 / 脚本 / 行情类数据源最近一次原始返回，原样展示
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { UC_SLOTS, UC_TEMPLATES, suggestTemplate, type UcField } from "@shared/ucheerModules";
import { readZip, type ZipEntry } from "./zip";
import { inferFields, isTableFile, jsonToTable, parseFileToTables, type RawTable } from "./parse";
import { guessSlot, isJunkPath, isUsefulTable, JUNK_DIR, JUNK_FILE } from "./zipSmart";
import { sourceDir, type ZipSourceConfig } from "./runners";
import { parseJson, query } from "./store";

const archiveCache = new Map<string, { at: number; entries: ZipEntry[] }>();

async function entriesOf(sourceId: number) {
  const [src] = await query<{ config_json: string; kind: string; name: string }>(sql`SELECT config_json, kind, name FROM uc_sources WHERE id = ${sourceId}`);
  if (!src) throw new Error("数据源不存在");
  const cfg = parseJson<ZipSourceConfig & { fromSourceId?: number }>(src.config_json, {} as ZipSourceConfig);
  if (src.kind !== "zip" || !cfg.storedAs) throw new Error("该数据源不是上传文件");
  const file = path.join(sourceDir(cfg.fromSourceId ?? sourceId), cfg.storedAs);
  const key = `${file}`;
  const hit = archiveCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60e3) return { src, cfg, entries: hit.entries };
  const buf = await readFile(file);
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  const entries: ZipEntry[] = isZip ? readZip(buf) : [{ name: cfg.fileName, size: buf.length, compressedSize: buf.length, isDirectory: false, read: () => buf }];
  archiveCache.set(key, { at: Date.now(), entries });
  if (archiveCache.size > 6) archiveCache.delete(archiveCache.keys().next().value!);
  return { src, cfg, entries };
}

type Kind = "table" | "doc" | "script" | "code" | "config" | "image" | "binary" | "text";
const EXT_KIND: Array<[RegExp, Kind]> = [
  [/\.(csv|tsv|xlsx|xlsm|xls|ndjson|jsonl)$/i, "table"],
  [/\.json$/i, "table"],
  [/\.(md|markdown|rst|txt|pdf|docx?|html?)$/i, "doc"],
  [/\.py$/i, "script"],
  [/\.(ts|tsx|js|jsx|mjs|cjs|java|scala|go|rs|cpp|cc|c|h|hpp|cs|rb|php|kt|swift|sql|sh|bat|cmd|ps1|r|m|ipynb|vue|svelte|css|scss|less)$/i, "code"],
  [/\.(ya?ml|toml|ini|cfg|conf|props|properties|xml|gradle|lock|env)$/i, "config"],
  [/\.(png|jpe?g|gif|svg|webp|ico|bmp)$/i, "image"],
  [/\.(zip|gz|tar|7z|rar|exe|dll|so|dylib|bin|pt|pth|onnx|h5|ckpt|safetensors|woff2?|ttf|otf|eot|mp4|mov|mp3|wav|parquet|pkl|db|sqlite)$/i, "binary"],
];
const kindOf = (name: string): Kind => EXT_KIND.find(([re]) => re.test(name))?.[1] ?? "text";

export async function zipTree(sourceId: number) {
  const { src, entries } = await entriesOf(sourceId);
  const datasets = await query<{ id: number; table_key: string; name: string; row_count: number; published_version: number }>(sql`SELECT id, table_key, name, row_count, published_version FROM uc_datasets WHERE source_id = ${sourceId}`);
  const files = entries.filter((e) => !e.isDirectory).map((e) => {
    const kind = kindOf(e.name);
    const stemPath = e.name.replace(/\.[^./]+$/, "");
    const ds = datasets.filter((d) => d.table_key === stemPath || d.table_key.startsWith(`${stemPath} · `));
    const ignored = JUNK_DIR.test(e.name) ? "依赖 / 构建 / 翻译等目录" : JUNK_FILE.test(e.name) ? "配置或依赖清单" : null;
    return { path: e.name, size: e.size, kind, ignored, datasets: ds.map((d) => ({ id: d.id, name: d.name, rows: d.row_count, published: d.published_version > 0 })) };
  });
  const counts: Record<string, number> = {};
  for (const f of files) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  return { name: src.name, total: files.length, bytes: files.reduce((n, f) => n + f.size, 0), counts, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
}

const isText = (buf: Buffer) => {
  const sample = buf.subarray(0, 4000);
  let bad = 0;
  for (const b of sample) if (b === 0 || (b < 9) || (b > 13 && b < 32)) bad++;
  return bad / Math.max(1, sample.length) < 0.02;
};
function decodeText(buf: Buffer) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf8");
  const s = buf.toString("utf8");
  if (!s.includes("�")) return s;
  try {
    return new TextDecoder("gbk").decode(buf);
  } catch {
    return s;
  }
}

export type Mapping = {
  fields: UcField[];
  numeric: string[];
  dates: string[];
  codes: string[];
  suggested: { template: string; slot: string; slotLabel: string; reason: string };
  templates: Array<{ code: string; label: string; ok: boolean; why: string }>;
  slots: Array<{ id: string; label: string; score: number }>;
};

export function mappingFor(table: RawTable): Mapping {
  const fields = inferFields(table);
  const numeric = fields.filter((f) => f.type === "number" || f.type === "percent").map((f) => f.label);
  const dates = fields.filter((f) => f.type === "date").map((f) => f.label);
  const lower = (f: UcField) => `${f.name} ${f.label}`.toLowerCase();
  const has = (re: RegExp) => fields.some((f) => re.test(lower(f)));
  const codes = fields.filter((f) => /^代码|symbol|ticker|证券代码|股票代码|code$/i.test(f.label)).map((f) => f.label);
  const { template } = suggestTemplate(fields);
  const g = guessSlot(table.name, fields.map((f) => `${f.name} ${f.label}`));
  const fit: Record<string, [boolean, string]> = {
    table: [true, "任何表格都可以"],
    line: [dates.length > 0 && numeric.length > 0, dates.length && numeric.length ? `日期「${dates[0]}」+ ${numeric.length} 个数值列` : "需要日期列和数值列"],
    bar: [numeric.length > 0 && fields.some((f) => f.type === "string"), numeric.length ? "分类 + 数值" : "需要数值列"],
    kline: [has(/open|开盘/) && has(/high|最高/) && has(/low|最低/) && has(/close|收盘|price/) && dates.length > 0, "需要日期 + 开高低收"],
    yieldCurve: [has(/tenor|maturity|term|期限/) && has(/yield|rate|收益率|利率/), "需要期限 + 收益率"],
    heatmap: [numeric.length > 0, numeric.length ? "按数值着色" : "需要数值列"],
    statCard: [numeric.length > 0, numeric.length ? "取数值做指标卡" : "需要数值列"],
    newsList: [has(/title|headline|标题|新闻|事件|event/), "需要标题列"],
    calendar: [dates.length > 0 && fields.some((f) => f.type === "string"), "需要日期 + 事件"],
    liveBoard: [codes.length > 0, codes.length ? `代码列「${codes[0]}」可接实时行情` : "需要代码列"],
  };
  const slotScores = UC_SLOTS.map((s) => {
    const sg = guessSlot(`${table.name} ${s.label}`, fields.map((f) => f.label));
    return { id: s.id, label: `${s.group} · ${s.label}`, score: s.id === g.slot ? g.score + 10 : sg.slot === s.id ? sg.score : 0 };
  }).sort((a, b) => b.score - a.score);
  const slot = UC_SLOTS.find((s) => s.id === g.slot);
  return {
    fields, numeric, dates, codes,
    suggested: { template, slot: g.slot, slotLabel: slot ? `${slot.group} · ${slot.label}` : g.slot, reason: g.score > 1 ? "按表名与字段关键词判断" : "没有明显的行业特征，默认放到我的看板" },
    templates: UC_TEMPLATES.map((t) => ({ code: t.code, label: t.label, ok: fit[t.code]?.[0] ?? true, why: fit[t.code]?.[1] ?? "" })),
    slots: slotScores,
  };
}

export async function zipFile(sourceId: number, filePath: string, opts: { maxBytes?: number; rows?: number } = {}) {
  const { entries } = await entriesOf(sourceId);
  const e = entries.find((x) => x.name === filePath);
  if (!e) throw new Error("文件不存在");
  const buf = e.read();
  const kind = kindOf(e.name);
  const max = opts.maxBytes ?? 3 * 1024 * 1024;
  const out: { path: string; size: number; kind: Kind; ignored: string | null; text: string | null; truncated: boolean; image: string | null; tables: Array<{ name: string; columns: string[]; rows: Array<Record<string, unknown>>; total: number; useful: boolean; mapping: Mapping }>; note: string | null } = {
    path: e.name, size: e.size, kind, ignored: isJunkPath(e.name) ? "这个文件属于依赖 / 配置类，默认不会入库；如确实需要，可以在右侧手动接入" : null, text: null, truncated: false, image: null, tables: [], note: null,
  };
  if (kind === "image" && buf.length < 4 * 1024 * 1024) {
    const ext = e.name.split(".").pop()!.toLowerCase();
    out.image = `data:image/${ext === "svg" ? "svg+xml" : ext === "jpg" ? "jpeg" : ext};base64,${buf.toString("base64")}`;
  } else if (kind === "binary" || !isText(buf)) {
    out.note = `二进制文件（${e.size.toLocaleString()} 字节），无法以文字显示`;
  } else {
    out.truncated = buf.length > max;
    out.text = decodeText(buf.subarray(0, max));
  }
  if (isTableFile(e.name) || /\.(xlsx|xls|xlsm)$/i.test(e.name)) {
    try {
      const tables = parseFileToTables(e.name, buf);
      out.tables = tables.map((t) => ({ name: t.name, columns: t.columns, rows: t.rows.slice(0, opts.rows ?? 300), total: t.rows.length, useful: isUsefulTable(t), mapping: mappingFor(t) }));
    } catch (error) {
      out.note = `按表格解析失败：${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return out;
}

/** 接口 / 脚本 / 行情类数据源：最近一次原始返回 */
export async function sourceRaw(sourceId: number, maxBytes = 3 * 1024 * 1024) {
  const [src] = await query<{ name: string; kind: string; config_json: string }>(sql`SELECT name, kind, config_json FROM uc_sources WHERE id = ${sourceId}`);
  if (!src) throw new Error("数据源不存在");
  const file = path.join(sourceDir(sourceId), "latest.json");
  if (!existsSync(file)) return { name: src.name, kind: src.kind, config: parseJson(src.config_json, {}), text: null, truncated: false, table: null, note: "还没有原始数据：先运行一次数据源" };
  const buf = await readFile(file);
  let pretty = buf.subarray(0, maxBytes).toString("utf8");
  let table: { name: string; columns: string[]; rows: Array<Record<string, unknown>>; total: number; mapping: Mapping } | null = null;
  try {
    const value = JSON.parse(buf.toString("utf8"));
    if (buf.length < maxBytes) pretty = JSON.stringify(value, null, 2);
    const t = jsonToTable(src.name, value);
    if (t && t.rows.length) table = { name: t.name, columns: t.columns, rows: t.rows.slice(0, 300), total: t.rows.length, mapping: mappingFor(t) };
  } catch {
    /* 非 JSON 原样显示 */
  }
  const cfg = parseJson<Record<string, unknown>>(src.config_json, {});
  for (const k of Object.keys(cfg)) if (/password|secret|token|apikey|api_key|dsn/i.test(k)) cfg[k] = "••••••";
  return { name: src.name, kind: src.kind, config: cfg, text: pretty, truncated: buf.length > maxBytes, table, note: null };
}

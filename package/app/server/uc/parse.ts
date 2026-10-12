/**
 * 把 zip 里的文件、脚本输出、接口返回统一解析成“表”：列名 + 行（对象数组）。
 * 同时推断字段类型（数值 / 百分比 / 日期 / 文本），供清洗规则和模板推荐使用。
 */
import { read, utils } from "xlsx";
import type { UcField, UcFieldType } from "@shared/ucheerModules";
import { UC_SOURCE_FIELD_PATTERN } from "@shared/ucheerModules";

export type RawCell = string | number | boolean | null;
export type RawRow = Record<string, RawCell>;
export type RawTable = { name: string; columns: string[]; rows: RawRow[] };

const TABLE_EXT = /\.(csv|tsv|txt|json|ndjson|jsonl|xlsx|xlsm|xls)$/i;
export const isTableFile = (name: string) => TABLE_EXT.test(name) && !/(^|\/)(__MACOSX|\.)/.test(name);

/* ----------------------------------------------------------- 文本编码 */

function decodeText(buf: Buffer): string {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf8");
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  const utf8 = buf.toString("utf8");
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("gbk").decode(buf);
  } catch {
    return utf8;
  }
}

/* ----------------------------------------------------------- CSV */

function detectDelimiter(sample: string): string {
  const line = sample.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const counts = [",", "\t", ";", "|"].map((d) => [d, line.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}

export function parseCsv(text: string, delimiter?: string): string[][] {
  const d = delimiter ?? detectDelimiter(text.slice(0, 4000));
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") { quoted = true; continue; }
    if (ch === d) { row.push(cell); cell = ""; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h, i) => {
    const base = String(h ?? "").trim() || `列${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}_${n + 1}` : base;
  });
}

function matrixToTable(name: string, matrix: unknown[][]): RawTable {
  // 跳过表头前的说明行：取前 10 行里非空单元格最多的一行作表头
  let headerIndex = 0;
  let best = -1;
  matrix.slice(0, 10).forEach((r, i) => {
    const filled = r.filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length;
    if (filled > best) { best = filled; headerIndex = i; }
  });
  const columns = uniqueHeaders((matrix[headerIndex] ?? []).map((c) => String(c ?? "")));
  const rows = matrix.slice(headerIndex + 1).map((r) => {
    const o: RawRow = {};
    columns.forEach((c, i) => {
      const v = r[i];
      o[c] = v === undefined || v === "" ? null : (v as RawCell);
    });
    return o;
  }).filter((o) => Object.values(o).some((v) => v !== null && String(v).trim() !== ""));
  return { name, columns, rows };
}

/* ----------------------------------------------------------- JSON */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function flatten(o: Record<string, unknown>, prefix = "", out: RawRow = {}, depth = 0): RawRow {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v) && depth < 2) flatten(v, key, out, depth + 1);
    else if (Array.isArray(v)) out[key] = v.length && v.every((x) => !isPlainObject(x)) ? v.join(", ") : v.length ? JSON.stringify(v).slice(0, 2000) : null;
    else out[key] = v === undefined ? null : (v as RawCell);
  }
  return out;
}

/** 在任意 JSON 里找出“最像一张表”的部分。 */
export function jsonToTable(name: string, value: unknown): RawTable | null {
  const candidates: { rows: RawRow[]; score: number; path: string }[] = [];
  const visit = (v: unknown, path: string, depth: number) => {
    if (depth > 5) return;
    if (Array.isArray(v)) {
      const objs = v.filter(isPlainObject);
      if (objs.length && objs.length >= v.length * 0.8) {
        const rows = objs.map((o) => flatten(o));
        const cols = new Set(rows.slice(0, 50).flatMap((r) => Object.keys(r))).size;
        candidates.push({ rows, score: rows.length * Math.max(cols, 1), path });
      } else if (v.length && v.every(Array.isArray)) {
        const t = matrixToTable(name, v as unknown[][]);
        candidates.push({ rows: t.rows, score: t.rows.length * t.columns.length, path });
      }
      v.slice(0, 20).forEach((x, i) => visit(x, `${path}[${i}]`, depth + 1));
      return;
    }
    if (isPlainObject(v)) {
      const values = Object.values(v);
      // { "AAPL": {...}, "MSFT": {...} } → 每个键一行
      if (values.length >= 2 && values.every(isPlainObject)) {
        const rows = Object.entries(v).map(([k, o]) => ({ key: k, ...flatten(o as Record<string, unknown>) }));
        candidates.push({ rows, score: rows.length * 2, path });
      }
      // { "2024-01-01": 1.2, "2024-02-01": 1.3 } → 两列
      const entries = Object.entries(v);
      if (entries.length >= 3 && entries.every(([, x]) => typeof x === "number" || typeof x === "string")) {
        const rows = entries.map(([k, x]) => ({ key: k, value: x as RawCell }));
        candidates.push({ rows, score: rows.length, path });
      }
      for (const [k, x] of Object.entries(v)) visit(x, path ? `${path}.${k}` : k, depth + 1);
    }
  };
  visit(value, "", 0);
  if (!candidates.length) {
    if (isPlainObject(value)) {
      const row = flatten(value);
      return { name, columns: Object.keys(row), rows: [row] };
    }
    return null;
  }
  candidates.sort((a, b) => b.score - a.score);
  const rows = candidates[0].rows;
  const columns = [...new Set(rows.slice(0, 200).flatMap((r) => Object.keys(r)))];
  return { name, columns, rows: rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null]))) };
}

/* ----------------------------------------------------------- 文件 → 表 */

export function parseFileToTables(fileName: string, buf: Buffer): RawTable[] {
  const base = fileName.split("/").pop() ?? fileName;
  const stem = base.replace(/\.[^.]+$/, "");
  const ext = (base.match(/\.([^.]+)$/)?.[1] ?? "").toLowerCase();
  if (ext === "xlsx" || ext === "xlsm" || ext === "xls") {
    const wb = read(buf, { type: "buffer", cellDates: true });
    return wb.SheetNames.map((sheet) => {
      const matrix = utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, raw: true, defval: null });
      const normalized = matrix.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c)));
      return matrixToTable(wb.SheetNames.length > 1 ? `${stem} · ${sheet}` : stem, normalized);
    }).filter((t) => t.rows.length);
  }
  const text = decodeText(buf);
  if (ext === "json") {
    const t = jsonToTable(stem, JSON.parse(text));
    return t && t.rows.length ? [t] : [];
  }
  if (ext === "ndjson" || ext === "jsonl") {
    const items = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
    const t = jsonToTable(stem, items);
    return t && t.rows.length ? [t] : [];
  }
  const matrix = parseCsv(text, ext === "tsv" ? "\t" : undefined);
  const t = matrixToTable(stem, matrix);
  return t.rows.length ? [t] : [];
}

/* ----------------------------------------------------------- 字段识别 */

const DATE_RE = /^(\d{4})[-/.年](\d{1,2})(?:[-/.月](\d{1,2})日?)?(?:[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const COMPACT_DATE_RE = /^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/;

export function toHalfWidth(s: string): string {
  return s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, " ");
}

export function parseNumber(v: RawCell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean" || v === null) return null;
  let s = toHalfWidth(String(v)).trim().replace(/,/g, "").replace(/\s/g, "");
  if (!s || s === "-" || s === "--" || /^n\/?a$/i.test(s)) return null;
  let mult = 1;
  if (s.endsWith("%")) { s = s.slice(0, -1); }
  else if (/亿$/.test(s)) { s = s.slice(0, -1); mult = 1e8; }
  else if (/万$/.test(s)) { s = s.slice(0, -1); mult = 1e4; }
  if (/^\(.*\)$/.test(s)) s = `-${s.slice(1, -1)}`;
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s) * mult;
  return Number.isFinite(n) ? n : null;
}

export function parseDate(v: RawCell): string | null {
  if (v === null || typeof v === "boolean") return null;
  if (typeof v === "number") {
    // Excel 序列日期
    if (v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return d.toISOString().slice(0, 10);
    }
    if (COMPACT_DATE_RE.test(String(v))) {
      const s = String(v);
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    // 毫秒 / 秒时间戳
    if (v > 1e12 && v < 4e12) return new Date(v).toISOString().slice(0, 10);
    if (v > 1e9 && v < 4e9) return new Date(v * 1000).toISOString().slice(0, 10);
    return null;
  }
  const s = toHalfWidth(String(v)).trim();
  if (COMPACT_DATE_RE.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const m = s.match(DATE_RE);
  if (!m) return null;
  const y = m[1], mo = m[2].padStart(2, "0"), d = (m[3] ?? "01").padStart(2, "0");
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return s.length > 10 && /[ T]\d/.test(s) ? `${y}-${mo}-${d}${s.slice(s.search(/[ T]\d/)).replace("T", " ").slice(0, 9)}` : `${y}-${mo}-${d}`;
}

function inferType(column: string, values: RawCell[]): UcFieldType {
  const sample = values.filter((v) => v !== null && String(v).trim() !== "").slice(0, 300);
  if (!sample.length) return "string";
  const dateHint = /date|time|日期|时间|day|month|period|年份|year/i.test(column);
  const dates = sample.filter((v) => parseDate(v) !== null).length;
  if (dates / sample.length >= 0.9 && (dateHint || sample.some((v) => typeof v === "string"))) return "date";
  const nums = sample.filter((v) => parseNumber(v) !== null).length;
  if (nums / sample.length >= 0.9) {
    const pct = sample.filter((v) => typeof v === "string" && v.trim().endsWith("%")).length;
    if (pct / sample.length >= 0.5 || /pct|percent|%|涨跌幅|收益率|比例|比率/i.test(column)) return "percent";
    if (dateHint && dates / sample.length >= 0.9) return "date";
    return "number";
  }
  return "string";
}

/** 把原始列名变成稳定的英文/拼音无关字段名：保留字母数字与中文，其他换成下划线。 */
export function normalizeFieldName(column: string, used: Set<string>): string {
  let base = column.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "field";
  if (/^\d/.test(base)) base = `f_${base}`;
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) name = `${base}_${i++}`;
  used.add(name.toLowerCase());
  return name;
}

export function inferFields(table: RawTable): UcField[] {
  const used = new Set<string>();
  return table.columns.map((col) => ({
    name: normalizeFieldName(col, used),
    source: col,
    type: inferType(col, table.rows.map((r) => r[col] ?? null)),
    label: col.trim() || col,
  }));
}

export function isSourceField(f: Pick<UcField, "name" | "source">): boolean {
  return UC_SOURCE_FIELD_PATTERN.test(f.name) || UC_SOURCE_FIELD_PATTERN.test(f.source);
}

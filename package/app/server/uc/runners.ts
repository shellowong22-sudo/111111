/**
 * 数据接入：把四类来源统一读成 RawTable[]。
 *  - zip：管理后台上传的压缩包（csv / json / xlsx / ndjson）
 *  - script：Python 数据脚本（vendor/fincept-scripts，约 310 个连接器）
 *  - adapter：服务端已有的公开数据适配器
 *  - agent_reach：Agent-Reach 的 RSS / 网页读取
 * 原始快照写在 .runtime/uc 下，规则变更后可直接重跑，无需重新抓取。
 */
import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import { query } from "./store";
import { readZip } from "./zip";
import { docsTable, extractZipTo, isJunkPath, isUsefulTable } from "./zipSmart";
import { isTableFile, jsonToTable, parseFileToTables, type RawTable } from "./parse";
import catalog from "./finceptCatalog.json";

const execFile = promisify(execFileCallback);

export const UC_RUNTIME_ROOT = path.join(process.cwd(), ".runtime", "uc");
export const sourceDir = (sourceId: number) => path.join(UC_RUNTIME_ROOT, "sources", String(sourceId));

/* ------------------------------------------------------------------ zip */

export type ZipSourceConfig = { kind: "zip"; fileName: string; storedAs: string; size: number; fromSourceId?: number; include?: string[] };

export async function storeZipUpload(sourceId: number, fileName: string, buf: Buffer): Promise<ZipSourceConfig> {
  const dir = sourceDir(sourceId);
  await mkdir(dir, { recursive: true });
  const storedAs = `upload-${Date.now()}.zip`;
  await writeFile(path.join(dir, storedAs), buf);
  return { kind: "zip", fileName, storedAs, size: buf.length };
}

export function tablesFromArchive(fileName: string, buf: Buffer): RawTable[] {
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (!isZip) {
    // 也接受直接上传的单个 csv / json / xlsx
    return parseFileToTables(fileName, buf);
  }
  const tables: RawTable[] = [];
  const entries = readZip(buf);
  for (const entry of entries) {
    if (entry.isDirectory || !isTableFile(entry.name) || isJunkPath(entry.name)) continue;
    if (entry.size > 200 * 1024 * 1024) continue;
    try {
      const inner = entry.read();
      // zip 里再套 zip
      if (/\.zip$/i.test(entry.name)) {
        tables.push(...tablesFromArchive(entry.name, inner).map((t) => ({ ...t, name: `${entry.name.replace(/\.zip$/i, "")}/${t.name}` })));
        continue;
      }
      const parsed = parseFileToTables(entry.name, inner).filter(isUsefulTable);
      const dir = entry.name.includes("/") ? entry.name.slice(0, entry.name.lastIndexOf("/") + 1) : "";
      tables.push(...parsed.map((t) => ({ ...t, name: `${dir}${t.name}` })));
    } catch (error) {
      console.warn(`[uc] 跳过无法解析的文件 ${entry.name}:`, error instanceof Error ? error.message : error);
    }
  }
  // 项目文档（README / docs）→ 一张知识表
  const docs = docsTable(entries, fileName.replace(/\.zip$/i, "").split("/").pop() ?? "项目");
  if (docs) tables.push(docs);
  // 同名表去重
  const seen = new Map<string, number>();
  return tables.map((t) => {
    const n = seen.get(t.name) ?? 0;
    seen.set(t.name, n + 1);
    return n ? { ...t, name: `${t.name} (${n + 1})` } : t;
  });
}

async function readZipSource(sourceId: number, config: ZipSourceConfig): Promise<RawTable[]> {
  const buf = await readFile(path.join(sourceDir(config.fromSourceId ?? sourceId), config.storedAs));
  if (config.include?.length) {
    // 管理员在内容浏览里手动挑选的文件：不做“垃圾文件”过滤，按选中的原样接入
    const tables: RawTable[] = [];
    for (const entry of readZip(buf)) {
      if (!config.include.includes(entry.name)) continue;
      const parsed = parseFileToTables(entry.name, entry.read());
      const dir = entry.name.includes("/") ? entry.name.slice(0, entry.name.lastIndexOf("/") + 1) : "";
      tables.push(...parsed.map((t) => ({ ...t, name: `${dir}${t.name}` })));
    }
    return tables;
  }
  return tablesFromArchive(config.fileName, buf);
}

/* ------------------------------------------------------------------ zip 里的功能脚本 */

export type ZipScriptSourceConfig = { kind: "zipscript"; zipSourceId: number; file: string; command: string; args: string[] };

export async function zipExtractDir(zipSourceId: number): Promise<string> {
  const [src] = await query<{ config_json: string }>(sql`SELECT config_json FROM uc_sources WHERE id = ${zipSourceId}`);
  if (!src) throw new Error("脚本所在的 zip 数据源已删除");
  const cfg = JSON.parse(src.config_json) as ZipSourceConfig;
  const dir = path.join(sourceDir(zipSourceId), `files-${cfg.storedAs.replace(/\.zip$/, "")}`);
  if (!existsSync(path.join(dir, ".extracted"))) {
    const buf = await readFile(path.join(sourceDir(zipSourceId), cfg.storedAs));
    await extractZipTo(buf, dir, (n) => !isJunkPath(n) && !/\.(png|jpe?g|gif|svg|ico|mp4|mov|woff2?|ttf|otf|eot|pdf|psd|exe|dll|so|dylib|bin|pt|pth|safetensors|onnx|h5|ckpt)$/i.test(n));
  }
  return dir;
}

export async function runZipScript(config: ZipScriptSourceConfig, timeoutMs = 120_000): Promise<unknown> {
  const dir = await zipExtractDir(config.zipSourceId);
  const file = path.resolve(dir, config.file);
  if (!file.startsWith(path.resolve(dir)) || !existsSync(file)) throw new Error(`脚本不存在：${config.file}`);
  const args = [file, ...(config.command ? [config.command] : []), ...config.args.filter(Boolean)];
  let lastError: unknown = null;
  for (const python of pythonCandidates()) {
    try {
      const { stdout } = await execFile(python, args, {
        cwd: path.dirname(file),
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONPATH: [dir, path.dirname(file)].join(path.delimiter) },
      });
      return extractJson(stdout);
    } catch (error) {
      const e = error as { code?: string; stdout?: string; stderr?: string; message?: string };
      if (e.code === "ENOENT") { lastError = error; continue; }
      if (e.stdout) {
        try {
          return extractJson(e.stdout);
        } catch {
          /* report below */
        }
      }
      throw new Error(`${config.file} 运行失败：${(e.stderr || e.message || String(error)).slice(-600)}`);
    }
  }
  throw new Error(`找不到可用的 Python：${lastError instanceof Error ? lastError.message : "未安装"}`);
}

async function readZipScriptSource(sourceId: number, config: ZipScriptSourceConfig): Promise<RawTable[]> {
  const value = await runZipScript(config);
  const error = errorFromScriptValue(value);
  if (error) throw new Error(error);
  await saveSnapshot(sourceId, value);
  const stem = config.file.split("/").pop()!.replace(/\.py$/i, "");
  const table = jsonToTable(`${stem}${config.command ? ` · ${config.command}` : ""}`, value);
  if (!table || !table.rows.length) throw new Error("脚本运行成功，但输出里没有可用的数据行");
  return [table];
}

/* ------------------------------------------------------------------ Python 脚本 */

export type ScriptCatalogEntry = { script: string; title: string; slot: string; commands: string[]; usage: string[]; env: string[] };
export const SCRIPT_CATALOG = catalog as ScriptCatalogEntry[];

export type ScriptSourceConfig = { kind: "script"; script: string; command: string; args: string[]; env: Record<string, string> };

const SCRIPT_DIR_CANDIDATES = [
  path.join(process.cwd(), "vendor", "fincept-scripts"),
  path.join(process.cwd(), "..", "..", "vendor", "fincept-scripts"),
];
const SCRIPT_ARCHIVE_CANDIDATES = [
  path.join(process.cwd(), "vendor", "fincept-scripts.zip"),
  path.join(process.cwd(), "..", "..", "vendor", "fincept-scripts.zip"),
];
const EXTRACTED_SCRIPT_DIR = path.join(UC_RUNTIME_ROOT, "fincept-scripts");

let scriptDirPromise: Promise<string> | null = null;

/** 找到脚本目录；只有压缩包时先解压到 .runtime/uc/fincept-scripts。 */
export async function resolveScriptDir(): Promise<string> {
  if (!scriptDirPromise) {
    scriptDirPromise = (async () => {
      for (const dir of SCRIPT_DIR_CANDIDATES) if (existsSync(path.join(dir, "fred_data.py"))) return dir;
      const archive = SCRIPT_ARCHIVE_CANDIDATES.find((p) => existsSync(p));
      if (!archive) throw new Error("未找到数据脚本包 vendor/fincept-scripts.zip");
      const archiveStat = await stat(archive);
      const marker = path.join(EXTRACTED_SCRIPT_DIR, ".extracted");
      const current = existsSync(marker) ? (await readFile(marker, "utf8")).trim() : "";
      if (current !== String(archiveStat.mtimeMs)) {
        await mkdir(EXTRACTED_SCRIPT_DIR, { recursive: true });
        for (const entry of readZip(await readFile(archive))) {
          if (entry.isDirectory) continue;
          const target = path.join(EXTRACTED_SCRIPT_DIR, entry.name.replace(/^fincept-scripts\//, ""));
          if (!target.startsWith(EXTRACTED_SCRIPT_DIR)) continue;
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, entry.read());
        }
        await writeFile(marker, String(archiveStat.mtimeMs));
      }
      return EXTRACTED_SCRIPT_DIR;
    })().catch((error) => {
      scriptDirPromise = null;
      throw error;
    });
  }
  return scriptDirPromise;
}

function pythonCandidates(): string[] {
  const root = process.cwd();
  const win = process.platform === "win32";
  const venv = (name: string) => path.join(root, name, win ? "Scripts" : "bin", win ? "python.exe" : "python");
  return [process.env.UC_PYTHON ?? "", venv(".venv-akshare"), venv(".venv-openbb"), venv(".venv-agent-reach"), win ? "python" : "python3"]
    .filter(Boolean)
    .filter((p) => !p.includes(path.sep) || existsSync(p));
}

/** 从脚本输出里取出 JSON（脚本有时会先打印日志）。 */
export function extractJson(stdout: string): unknown {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].trimStart();
    if (head.startsWith("{") || head.startsWith("[")) {
      try {
        return JSON.parse(lines.slice(i).join("\n"));
      } catch {
        /* keep scanning */
      }
    }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      /* keep scanning */
    }
  }
  throw new Error(`脚本输出不是 JSON：${text.slice(0, 300)}`);
}

export async function runScript(config: ScriptSourceConfig): Promise<{ value: unknown; stderr: string; python: string }> {
  const entry = SCRIPT_CATALOG.find((s) => s.script === config.script);
  if (!entry) throw new Error(`未知脚本：${config.script}`);
  const dir = await resolveScriptDir();
  const file = path.join(dir, `${entry.script}.py`);
  if (!existsSync(file)) throw new Error(`脚本文件不存在：${entry.script}.py`);
  const args = [file, ...(config.command ? [config.command] : []), ...config.args.filter((a) => a !== "")];
  let lastError: unknown = null;
  for (const python of pythonCandidates()) {
    try {
      const { stdout, stderr } = await execFile(python, args, {
        cwd: dir,
        timeout: 180_000,
        maxBuffer: 128 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, ...config.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      });
      return { value: extractJson(stdout), stderr: stderr.slice(-2000), python };
    } catch (error) {
      const e = error as { code?: string; stdout?: string; stderr?: string; message?: string };
      // 找不到解释器就换下一个；脚本本身报错则直接返回原因
      if (e.code === "ENOENT") { lastError = error; continue; }
      if (e.stdout) {
        try {
          return { value: extractJson(e.stdout), stderr: (e.stderr ?? "").slice(-2000), python };
        } catch {
          /* report below */
        }
      }
      throw new Error(`${entry.script} 运行失败：${(e.stderr || e.message || String(error)).slice(-800)}`);
    }
  }
  throw new Error(`找不到可用的 Python：${lastError instanceof Error ? lastError.message : "未安装"}`);
}

function errorFromScriptValue(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (v.success === false || (typeof v.error === "string" && Object.keys(v).length <= 4)) {
      return String(v.error ?? v.message ?? "脚本返回失败");
    }
  }
  return null;
}

async function readScriptSource(sourceId: number, config: ScriptSourceConfig): Promise<RawTable[]> {
  const { value } = await runScript(config);
  const error = errorFromScriptValue(value);
  if (error) throw new Error(error);
  await saveSnapshot(sourceId, value);
  const table = jsonToTable(`${config.script} · ${config.command || "default"}`, value);
  if (!table || !table.rows.length) throw new Error("脚本运行成功，但输出里没有可用的数据行");
  return [table];
}

/* ------------------------------------------------------------------ 已有适配器 */

export type AdapterSourceConfig = { kind: "adapter"; adapter: string };

type AdapterDef = { id: string; label: string; slot: string; load: () => Promise<unknown> };

export const ADAPTERS: AdapterDef[] = [
  { id: "cboe-vol-history", label: "CBOE 波动率指数历史（VIX 等）", slot: "eq.derivatives", load: async () => (await import("../finceptCboeAdapter")).fetchFinceptCboeVolatilityHistory() },
  { id: "cboe-index-snapshot", label: "CBOE 指数快照", slot: "eq.index", load: async () => (await import("../finceptCboeIndexAdapter")).fetchFinceptCboeIndexSnapshot() },
  { id: "cftc-disaggregated", label: "CFTC 持仓报告（分类）", slot: "eq.commodity", load: async () => (await import("../finceptCftcAdapter")).fetchFinceptCftcDisaggregated() },
  { id: "nasdaq-screener", label: "纳斯达克股票筛选器", slot: "eq.stocks", load: async () => (await import("../finceptNasdaqAdapter")).fetchFinceptNasdaqScreener() },
  { id: "nasdaq-earnings", label: "纳斯达克财报日历", slot: "macro.calendar", load: async () => (await import("../finceptNasdaqCalendarAdapter")).fetchFinceptNasdaqEarningsCalendar() },
  { id: "nasdaq-dividends", label: "纳斯达克分红日历", slot: "macro.calendar", load: async () => (await import("../finceptNasdaqCalendarAdapter")).fetchFinceptNasdaqDividendCalendar() },
  { id: "nasdaq-ipo", label: "纳斯达克 IPO 日历", slot: "macro.calendar", load: async () => (await import("../finceptNasdaqCalendarAdapter")).fetchFinceptNasdaqIpoCalendar() },
  { id: "nasdaq-economic", label: "纳斯达克经济日历", slot: "macro.calendar", load: async () => (await import("../finceptNasdaqCalendarAdapter")).fetchFinceptNasdaqEconomicCalendar() },
  { id: "coingecko-markets", label: "加密资产行情", slot: "eq.stocks", load: async () => (await import("../finceptCryptoAdapter")).fetchFinceptCoinGeckoMarkets() },
  { id: "twse-equity", label: "台湾证交所个股快照", slot: "eq.stocks", load: async () => (await import("../finceptTaiwanAdapter")).fetchFinceptTwseEquitySnapshot() },
  { id: "twse-valuations", label: "台湾证交所估值", slot: "eq.stocks", load: async () => (await import("../finceptTaiwanAdapter")).fetchFinceptTwseValuations() },
  { id: "taiex", label: "台湾加权指数", slot: "eq.index", load: async () => (await import("../finceptTaiwanAdapter")).fetchFinceptTaiexSnapshot() },
  { id: "nbp-gold", label: "波兰央行金价", slot: "eq.commodity", load: async () => (await import("../finceptNbpAdapter")).fetchFinceptNbpGold() },
  { id: "nbp-usdpln", label: "波兰央行美元兑兹罗提", slot: "eq.fx", load: async () => (await import("../finceptNbpAdapter")).fetchFinceptNbpUsdPln() },
  { id: "nbp-fx", label: "波兰央行汇率篮子", slot: "eq.fx", load: async () => (await import("../finceptNbpAdapter")).fetchFinceptNbpFxBasket() },
  { id: "boi-fx", label: "以色列央行汇率篮子", slot: "eq.fx", load: async () => (await import("../finceptBoiAdapter")).fetchFinceptBoiFxBasket() },
  { id: "cnb-fx", label: "捷克央行汇率篮子", slot: "eq.fx", load: async () => (await import("../finceptCnbAdapter")).fetchFinceptCnbFxBasket() },
];

async function readAdapterSource(sourceId: number, config: AdapterSourceConfig): Promise<RawTable[]> {
  const adapter = ADAPTERS.find((a) => a.id === config.adapter);
  if (!adapter) throw new Error(`未知适配器：${config.adapter}`);
  const value = await adapter.load();
  await saveSnapshot(sourceId, value);
  const table = jsonToTable(adapter.label, value);
  if (!table || !table.rows.length) throw new Error("适配器没有返回数据行");
  return [table];
}

/* ------------------------------------------------------------------ Agent-Reach */

export type AgentReachSourceConfig = { kind: "agent_reach"; mode: "rss" | "web"; url: string };

async function readAgentReachSource(sourceId: number, config: AgentReachSourceConfig): Promise<RawTable[]> {
  const { readAgentReachPublic } = await import("../agentReachService");
  const value = await readAgentReachPublic({ mode: config.mode, url: config.url });
  await saveSnapshot(sourceId, value);
  if (config.mode === "web") {
    const v = value as { title?: string | null; content?: string; observedAt?: string };
    return [{ name: "网页正文", columns: ["标题", "时间", "正文"], rows: [{ 标题: v.title ?? config.url, 时间: v.observedAt ?? null, 正文: (v.content ?? "").slice(0, 20000) }] }];
  }
  const items = ((value as { items?: Array<Record<string, unknown>> }).items ?? []).map((i) => ({
    标题: String(i.title ?? ""),
    时间: (i.published as string) ?? null,
    摘要: String(i.summary ?? "").slice(0, 2000),
    链接: String(i.link ?? ""),
  }));
  if (!items.length) throw new Error("RSS 没有条目");
  return [{ name: "订阅条目", columns: ["标题", "时间", "摘要", "链接"], rows: items }];
}

/* ------------------------------------------------------------------ 统一入口 */

/* ------------------------------------------------------------------ HTTP API */

export type HttpSourceConfig = {
  kind: "http";
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /** 取 JSON 里的某一层，例如 data.items；为空自动找最大的表 */
  jsonPath?: string;
  /** 返回格式：auto / json / csv */
  format?: "auto" | "json" | "csv";
  timeoutSec?: number;
};

function pick(value: unknown, pathExpr: string): unknown {
  if (!pathExpr.trim()) return value;
  return pathExpr.split(".").filter(Boolean).reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc) && /^\d+$/.test(key)) return acc[Number(key)];
    return (acc as Record<string, unknown>)[key];
  }, value);
}

export async function fetchHttpSource(config: HttpSourceConfig): Promise<{ value: unknown; text: string; contentType: string }> {
  if (!/^https?:\/\//i.test(config.url)) throw new Error("地址必须以 http:// 或 https:// 开头");
  const res = await fetch(config.url, {
    method: config.method ?? "GET",
    headers: { "User-Agent": "Mozilla/5.0 UcheerDataStudio", Accept: "application/json, text/csv, */*", ...(config.headers ?? {}) },
    body: config.method === "POST" ? config.body ?? "" : undefined,
    signal: AbortSignal.timeout(Math.min(120, Math.max(3, config.timeoutSec ?? 30)) * 1000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`接口返回 HTTP ${res.status}：${text.slice(0, 200)}`);
  const contentType = res.headers.get("content-type") ?? "";
  let value: unknown = text;
  if (config.format !== "csv" && (config.format === "json" || /json/i.test(contentType) || /^\s*[[{]/.test(text))) {
    try {
      value = JSON.parse(text);
    } catch {
      if (config.format === "json") throw new Error("接口返回的不是合法 JSON");
    }
  }
  return { value, text, contentType };
}

async function readHttpSource(sourceId: number, config: HttpSourceConfig): Promise<RawTable[]> {
  const { value, text } = await fetchHttpSource(config);
  if (typeof value === "string") {
    const tables = parseFileToTables("api.csv", Buffer.from(text, "utf8"));
    if (!tables.length) throw new Error("接口返回内容无法识别为表格（支持 JSON / CSV）");
    await saveSnapshot(sourceId, { __csv: text });
    return tables;
  }
  await saveSnapshot(sourceId, value);
  const table = jsonToTable("接口数据", pick(value, config.jsonPath ?? ""));
  if (!table || !table.rows.length) throw new Error("接口没有返回可识别的数据行，请检查数据路径");
  return [table];
}

/* ------------------------------------------------------------------ 数据库 */

export type DatabaseSourceConfig = {
  kind: "database";
  /** mysql://用户:密码@主机:端口/库；为空则查询本系统数据库 */
  dsn?: string;
  sql: string;
};

export async function queryDatabaseSource(config: DatabaseSourceConfig): Promise<Record<string, unknown>[]> {
  const statement = config.sql.trim().replace(/;+\s*$/, "");
  if (!/^(select|with|show|describe|desc|explain)\b/i.test(statement) || /;/.test(statement)) {
    throw new Error("只允许单条只读查询（SELECT / WITH / SHOW）");
  }
  const mysql = await import("mysql2/promise");
  const dsn = config.dsn?.trim() || process.env.DATABASE_URL || "";
  if (!dsn) throw new Error("没有可用的数据库连接");
  const conn = await mysql.createConnection({ uri: dsn, connectTimeout: 10_000, dateStrings: true });
  try {
    const [rows] = await conn.query({ sql: /\blimit\s+\d+/i.test(statement) || /^(show|describe|desc|explain)/i.test(statement) ? statement : `${statement} LIMIT 200000`, timeout: 60_000 });
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  } finally {
    await conn.end().catch(() => undefined);
  }
}

async function readDatabaseSource(sourceId: number, config: DatabaseSourceConfig): Promise<RawTable[]> {
  const rows = await queryDatabaseSource(config);
  await saveSnapshot(sourceId, rows);
  const table = jsonToTable("查询结果", rows);
  if (!table || !table.rows.length) throw new Error("查询没有返回数据行");
  return [table];
}

/* ------------------------------------------------------------------ 实时行情 */

export type MarketSourceConfig = {
  kind: "market";
  mode: "quotes" | "kline";
  /** quotes：板块 id 或自定义代码列表 */
  board?: string;
  symbols?: string[];
  /** kline：单个代码 + 周期 */
  symbol?: string;
  period?: "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1w" | "1M";
  limit?: number;
};

async function readMarketSource(sourceId: number, config: MarketSourceConfig): Promise<RawTable[]> {
  const market = await import("./market");
  if (config.mode === "kline") {
    if (!config.symbol) throw new Error("请填写代码");
    const candles = await market.getKline(config.symbol, config.period ?? "1d", Math.min(1000, Math.max(20, config.limit ?? 240)));
    if (!candles.length) throw new Error("行情服务没有返回 K 线");
    const intraday = (config.period ?? "1d").endsWith("m") && config.period !== "1M";
    const rows = candles.map((k) => ({
      日期: new Date(k.t + 8 * 3600e3).toISOString().slice(0, intraday ? 16 : 10).replace("T", " "),
      开盘: k.o, 最高: k.h, 最低: k.l, 收盘: k.c, 成交量: k.v,
    }));
    await saveSnapshot(sourceId, rows);
    return [{ name: `${market.displayName(config.symbol) ?? config.symbol} K线`, columns: ["日期", "开盘", "最高", "最低", "收盘", "成交量"], rows }];
  }
  const symbols = config.symbols?.length ? config.symbols : market.WEI_BOARDS[config.board ?? "global"]?.symbols ?? [];
  if (!symbols.length) throw new Error("请选择板块或填写代码");
  const ticks = await market.getTicks(symbols, { budgetMs: 30_000 });
  const rows = symbols.map((sym) => {
    const t = ticks[sym];
    return {
      代码: sym, 名称: t?.name ?? market.displayName(sym) ?? sym, 最新价: t?.price ?? null, 涨跌: t?.change ?? null, 涨跌幅: t?.changePct ?? null,
      今开: t?.open ?? null, 最高: t?.high ?? null, 最低: t?.low ?? null, 昨收: t?.prevClose ?? null, 成交量: t?.volume ?? null, 成交额: t?.amount ?? null,
      时间: t?.time ? new Date(t.time + 8 * 3600e3).toISOString().slice(0, 19).replace("T", " ") : null,
    };
  });
  if (!rows.some((r) => r.最新价 !== null)) throw new Error("行情服务暂时没有返回报价");
  await saveSnapshot(sourceId, rows);
  return [{ name: "实时行情", columns: Object.keys(rows[0]), rows }];
}

/* ------------------------------------------------------------------ 统一入口 */

export type SourceConfig = ZipSourceConfig | ZipScriptSourceConfig | ScriptSourceConfig | AdapterSourceConfig | AgentReachSourceConfig | HttpSourceConfig | DatabaseSourceConfig | MarketSourceConfig;

export async function readSourceTables(sourceId: number, config: SourceConfig, options: { useSnapshot?: boolean } = {}): Promise<RawTable[]> {
  if (config.kind === "zip") return readZipSource(sourceId, config);
  if (options.useSnapshot) {
    const snapshot = await loadSnapshot(sourceId);
    if (snapshot !== undefined) {
      if (config.kind === "agent_reach") return readAgentReachFromSnapshot(config, snapshot);
      if (config.kind === "http" && snapshot && typeof snapshot === "object" && "__csv" in (snapshot as object)) {
        const tables = parseFileToTables("api.csv", Buffer.from(String((snapshot as { __csv: string }).__csv), "utf8"));
        if (tables.length) return tables;
      }
      const label = config.kind === "script" ? `${config.script} · ${config.command || "default"}`
        : config.kind === "zipscript" ? `${config.file.split("/").pop()!.replace(/\.py$/i, "")}${config.command ? ` · ${config.command}` : ""}`
        : config.kind === "adapter" ? (ADAPTERS.find((a) => a.id === config.adapter)?.label ?? config.adapter)
        : config.kind === "http" ? "接口数据" : config.kind === "database" ? "查询结果" : config.kind === "market" ? (config.mode === "kline" ? "K线" : "实时行情") : "数据";
      const table = jsonToTable(label, config.kind === "http" ? pick(snapshot, config.jsonPath ?? "") : snapshot);
      if (table && table.rows.length) return [table];
    }
  }
  switch (config.kind) {
    case "script": return readScriptSource(sourceId, config);
    case "zipscript": return readZipScriptSource(sourceId, config);
    case "adapter": return readAdapterSource(sourceId, config);
    case "http": return readHttpSource(sourceId, config);
    case "database": return readDatabaseSource(sourceId, config);
    case "market": return readMarketSource(sourceId, config);
    default: return readAgentReachSource(sourceId, config);
  }
}

function readAgentReachFromSnapshot(config: AgentReachSourceConfig, value: unknown): RawTable[] {
  const items = ((value as { items?: Array<Record<string, unknown>> }).items ?? []).map((i) => ({
    标题: String(i.title ?? ""), 时间: (i.published as string) ?? null, 摘要: String(i.summary ?? "").slice(0, 2000), 链接: String(i.link ?? ""),
  }));
  if (config.mode === "web" || !items.length) {
    const v = value as { title?: string | null; content?: string; observedAt?: string };
    return [{ name: "网页正文", columns: ["标题", "时间", "正文"], rows: [{ 标题: v.title ?? config.url, 时间: v.observedAt ?? null, 正文: (v.content ?? "").slice(0, 20000) }] }];
  }
  return [{ name: "订阅条目", columns: ["标题", "时间", "摘要", "链接"], rows: items }];
}

async function saveSnapshot(sourceId: number, value: unknown) {
  const dir = sourceDir(sourceId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "latest.json"), JSON.stringify(value));
}

async function loadSnapshot(sourceId: number): Promise<unknown | undefined> {
  const file = path.join(sourceDir(sourceId), "latest.json");
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

export async function listScriptFiles(): Promise<string[]> {
  try {
    const dir = await resolveScriptDir();
    return (await readdir(dir)).filter((f) => f.endsWith(".py"));
  } catch {
    return [];
  }
}

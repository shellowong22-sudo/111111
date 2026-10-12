import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type FundHolding = {
  assetType: "stock" | "bond";
  symbol: string;
  name: string;
  weight: number | null;
  period: string;
  quarter: string;
  collectedAt?: string;
};
type Kind = FundHolding["assetType"];
type Disclosure = {
  code: string;
  source: string;
  retrievedAt: string | null;
  lastAttemptAt: string | null;
  errors: Partial<Record<Kind, string>>;
  holdings: FundHolding[];
};
type RawResponse = {
  code: string;
  retrievedAt: string;
  results: Partial<Record<Kind, Record<string, unknown>[]>>;
  errors: Partial<Record<Kind, string>>;
};

const ROOT = path.resolve(".runtime", "fund-holdings");
const SOURCE = "AKShare / 天天基金公开持仓披露";
const EMPTY = (code: string): Disclosure => ({
  code, source: SOURCE, retrievedAt: null, lastAttemptAt: null, errors: {}, holdings: [],
});
const inFlight = new Map<string, Promise<Disclosure>>();
const CODE = /^\d{6}$/;

export function projectFundDisclosure(kind: Kind, rows: Record<string, unknown>[]): FundHolding[] {
  const parsed = rows.flatMap(row => {
    const quarter = String(row["季度"] ?? "").trim();
    const period = quarter.match(/(\d{4})年\s*([1-4])季度/);
    const symbol = String(row[kind === "stock" ? "股票代码" : "债券代码"] ?? "").trim();
    const name = String(row[kind === "stock" ? "股票名称" : "债券名称"] ?? "").trim();
    if (!period || !/^[A-Za-z0-9.-]{1,24}$/.test(symbol) || !name) return [];
    const rawWeight = row["占净值比例"];
    const weight = rawWeight === null || rawWeight === undefined || rawWeight === ""
      ? null : Number(String(rawWeight).replace("%", ""));
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100)) return [];
    return [{ assetType: kind, symbol, name, weight,
      period: `${period[1]}-Q${period[2]}`, quarter }];
  });
  const latest = parsed.reduce((max, row) => row.period > max ? row.period : max, "");
  const unique = new Map<string, FundHolding>();
  for (const row of parsed.filter(row => row.period === latest)) unique.set(row.symbol, row);
  return [...unique.values()].sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1));
}

async function load(code: string, root = ROOT): Promise<Disclosure> {
  try {
    const value = JSON.parse(await readFile(path.join(root, `${code}.json`), "utf8")) as Disclosure;
    if (value.code !== code || !Array.isArray(value.holdings)) throw new Error("FUND_DISCLOSURE_CACHE_INVALID");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY(code);
    throw error;
  }
}

async function save(value: Disclosure, root = ROOT) {
  await mkdir(root, { recursive: true });
  const destination = path.join(root, `${value.code}.json`);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", flag: "wx" });
  await rename(temporary, destination);
}

async function fetchRaw(code: string): Promise<RawResponse> {
  const executable = process.env.AKSHARE_PYTHON_PATH?.trim()
    || path.resolve(".venv-akshare", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const script = path.resolve("server", "python", "fund_holdings_adapter.py");
  if (!existsSync(script)) throw new Error("FUND_HOLDINGS_ADAPTER_MISSING");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [script, "--code", code], {
      cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let errorOutput = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("FUND_HOLDINGS_TIMEOUT")); }, 90_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { output += chunk; if (output.length > 2_000_000) child.kill(); });
    child.stderr.on("data", chunk => { errorOutput = (errorOutput + chunk).slice(-500); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", codeResult => {
      clearTimeout(timer);
      try {
        const value = JSON.parse(output) as RawResponse;
        if (codeResult !== 0 || value.code !== code || !value.results || typeof value.results !== "object") {
          throw new Error("FUND_HOLDINGS_UPSTREAM_FAILED");
        }
        resolve(value);
      } catch {
        reject(new Error(`FUND_HOLDINGS_UPSTREAM_FAILED:${errorOutput.slice(-120)}`));
      }
    });
  });
}

export function mergeFundDisclosure(previous: Disclosure, raw: RawResponse, attemptedAt: string): Disclosure {
  const holdings: FundHolding[] = [];
  const errors: Disclosure["errors"] = {};
  for (const kind of ["stock", "bond"] as const) {
    const rows = raw.results[kind];
    if (Array.isArray(rows)) holdings.push(...projectFundDisclosure(kind, rows).map(row => ({
      ...row, collectedAt: raw.retrievedAt,
    })));
    else {
      holdings.push(...previous.holdings.filter(row => row.assetType === kind));
      errors[kind] = raw.errors[kind] ?? "该类持仓披露读取失败";
    }
  }
  return {
    code: previous.code, source: SOURCE,
    retrievedAt: Object.keys(raw.results).length ? raw.retrievedAt : previous.retrievedAt,
    lastAttemptAt: attemptedAt, errors, holdings,
  };
}

function due(disclosure: Disclosure, now = Date.now()) {
  const interval = Object.keys(disclosure.errors).length ? 30 * 60_000 : 12 * 60 * 60_000;
  return !disclosure.lastAttemptAt || now - Date.parse(disclosure.lastAttemptAt) >= interval;
}

async function refresh(code: string, root = ROOT): Promise<Disclosure> {
  const existing = inFlight.get(code);
  if (existing) return existing;
  const task = (async () => {
    const previous = await load(code, root);
    if (!due(previous)) return previous;
    const attemptedAt = new Date().toISOString();
    let updated: Disclosure;
    try {
      updated = mergeFundDisclosure(previous, await fetchRaw(code), attemptedAt);
    } catch (error) {
      updated = { ...previous, lastAttemptAt: attemptedAt,
        errors: { stock: error instanceof Error ? error.message : "读取失败",
          bond: error instanceof Error ? error.message : "读取失败" } };
    }
    await save(updated, root);
    return updated;
  })();
  inFlight.set(code, task);
  try { return await task; } finally { inFlight.delete(code); }
}

export async function readFundHoldingsDisclosure(code: string) {
  if (!CODE.test(code)) throw new Error("INVALID_FUND_CODE");
  return refresh(code);
}

let started = false;
export function startFundDisclosureAutoRefresh() {
  if (started) return;
  started = true;
  const tick = async () => {
    try {
      const codes = (await readdir(ROOT)).filter(name => /^\d{6}\.json$/.test(name)).map(name => name.slice(0, 6));
      const entries = await Promise.all(codes.map(async code => ({ code, state: await load(code) })));
      const candidates = entries.filter(item => due(item.state))
        .sort((a, b) => (a.state.lastAttemptAt ?? "").localeCompare(b.state.lastAttemptAt ?? ""));
      for (const { code } of candidates.slice(0, 2)) await refresh(code);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("[FundDisclosure] refresh failed", error);
      }
    }
  };
  setTimeout(() => void tick(), 60_000).unref();
  setInterval(() => void tick(), 60_000).unref();
}

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const YFINANCE_COMMUNITY_PROVIDER_ID = "yfinance-community";
export const YFINANCE_COMMUNITY_LABEL =
  "yfinance 社区封装 / Yahoo Finance 公共数据";

type SupportedRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";
type SupportedInterval =
  | "1m"
  | "2m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "90m"
  | "1h"
  | "1d"
  | "1wk"
  | "1mo";

export type YFinancePythonPoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

export type YFinancePythonResult = {
  provider: "yfinance-community";
  providerVersion: string;
  officialYahooApi: false;
  symbol: string;
  currency: string;
  exchangeTimezoneName: string | null;
  history: YFinancePythonPoint[];
};

function resolvePythonExecutable() {
  const configured = process.env.YFINANCE_PYTHON_PATH?.trim();
  if (configured) return configured;
  const candidates = process.platform === "win32"
    ? [path.resolve(".venv-openbb", "Scripts", "python.exe")]
    : [path.resolve(".venv-openbb", "bin", "python")];
  return candidates.find(candidate => existsSync(candidate)) ?? "python";
}

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseYFinancePythonResponse(value: unknown): YFinancePythonResult {
  if (!value || typeof value !== "object") throw new Error("YFINANCE_INVALID_RESPONSE");
  const input = value as Record<string, unknown>;
  if (input.provider !== YFINANCE_COMMUNITY_PROVIDER_ID || input.officialYahooApi !== false)
    throw new Error("YFINANCE_INVALID_PROVENANCE");
  if (typeof input.symbol !== "string" || typeof input.currency !== "string" || !Array.isArray(input.history))
    throw new Error("YFINANCE_INVALID_RESPONSE");
  const history = input.history.map((item): YFinancePythonPoint => {
    if (!item || typeof item !== "object") throw new Error("YFINANCE_INVALID_POINT");
    const point = item as Record<string, unknown>;
    if (
      typeof point.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(point.date) ||
      !validNumber(point.close)
    )
      throw new Error("YFINANCE_INVALID_POINT");
    const nullableNumber = (field: string) => point[field] === null || validNumber(point[field])
      ? point[field] as number | null
      : null;
    return {
      date: point.date,
      open: nullableNumber("open"),
      high: nullableNumber("high"),
      low: nullableNumber("low"),
      close: point.close,
      volume: point.volume === null || validNumber(point.volume) ? point.volume as number | null : null,
    };
  });
  if (!history.length) throw new Error("YFINANCE_EMPTY_HISTORY");
  return {
    provider: YFINANCE_COMMUNITY_PROVIDER_ID,
    providerVersion: typeof input.providerVersion === "string" ? input.providerVersion : "unknown",
    officialYahooApi: false,
    symbol: input.symbol,
    currency: input.currency,
    exchangeTimezoneName: typeof input.exchangeTimezoneName === "string" ? input.exchangeTimezoneName : null,
    history,
  };
}

export async function fetchYFinancePythonHistory(
  symbol: string,
  range: SupportedRange,
  interval: SupportedInterval,
): Promise<YFinancePythonResult> {
  const executable = resolvePythonExecutable();
  const script = path.resolve("server", "python", "yfinance_adapter.py");
  if (!existsSync(script)) throw new Error("YFINANCE_ADAPTER_SCRIPT_MISSING");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [script, "--symbol", symbol, "--period", range, "--interval", interval], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("YFINANCE_TIMEOUT"));
    }, 15_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", error => {
      clearTimeout(timer);
      reject(new Error(`YFINANCE_PROCESS_ERROR:${error.message}`));
    });
    child.once("close", code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`YFINANCE_REQUEST_FAILED:${stderr.trim().slice(-800) || `exit_${code}`}`));
        return;
      }
      try {
        resolve(parseYFinancePythonResponse(JSON.parse(stdout)));
      } catch (error) {
        reject(error);
      }
    });
  });
}

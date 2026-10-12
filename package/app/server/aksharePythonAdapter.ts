import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const AKSHARE_PROVIDER_ID = "akshare";
export const AKSHARE_PROVIDER_LABEL = "AKShare 公共数据接口";

export const AKSHARE_OPERATIONS = [
  "stock_snapshot",
  "stock_directory",
  "hk_stock_snapshot",
  "us_stock_snapshot",
  "cn_index_snapshot",
  "global_index_snapshot",
  "etf_snapshot",
  "fund_snapshot",
  "forex_snapshot",
  "futures_snapshot",
  "futures_cn_snapshot",
  "futures_inventory",
  "options_snapshot",
  "bond_curve",
  "news_publication",
  "economic_gdp",
  "economic_cpi",
  "economic_pmi",
  "macro_semiconductor_index",
  "macro_shipping_bdi",
  "macro_japan_bank_rate",
  "macro_uk_bank_rate",
  "news_cctv",
] as const;

export type AkShareOperation = (typeof AKSHARE_OPERATIONS)[number];
export type AkShareRawResult = {
  provider: typeof AKSHARE_PROVIDER_ID;
  providerVersion: string;
  operation: AkShareOperation;
  retrievedAt: string;
  records: Array<Record<string, unknown>>;
};

function resolvePythonExecutable() {
  const configured = process.env.AKSHARE_PYTHON_PATH?.trim();
  if (configured) return configured;
  const candidate = path.resolve(".venv-akshare", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  return existsSync(candidate) ? candidate : "python";
}

function parseResponse(value: unknown): AkShareRawResult {
  if (!value || typeof value !== "object") throw new Error("AKSHARE_INVALID_RESPONSE");
  const input = value as Record<string, unknown>;
  if (input.provider !== AKSHARE_PROVIDER_ID || !Array.isArray(input.records)) {
    throw new Error(typeof input.error === "string" ? input.error : "AKSHARE_INVALID_RESPONSE");
  }
  if (!AKSHARE_OPERATIONS.includes(input.operation as AkShareOperation)) {
    throw new Error("AKSHARE_INVALID_OPERATION");
  }
  return {
    provider: AKSHARE_PROVIDER_ID,
    providerVersion: typeof input.providerVersion === "string" ? input.providerVersion : "unknown",
    operation: input.operation as AkShareOperation,
    retrievedAt: typeof input.retrievedAt === "string" ? input.retrievedAt : new Date().toISOString(),
    records: input.records.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")),
  };
}

async function runAkShareProcess(
  executable: string,
  script: string,
  operation: AkShareOperation,
  timeoutMs: number,
): Promise<AkShareRawResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [script, "--operation", operation], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("AKSHARE_TIMEOUT"));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", error => {
      clearTimeout(timer);
      reject(new Error(`AKSHARE_PROCESS_ERROR:${error.message}`));
    });
    child.once("close", code => {
      clearTimeout(timer);
      if (code !== 0) {
        let detail = stderr.trim().slice(-800);
        try {
          const parsed = JSON.parse(stdout) as { error?: unknown };
          if (typeof parsed.error === "string") detail = parsed.error;
        } catch {
          // Keep the bounded stderr detail.
        }
        reject(new Error(`AKSHARE_REQUEST_FAILED:${detail || `exit_${code}`}`));
        return;
      }
      try {
        resolve(parseResponse(JSON.parse(stdout)));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isTransientAkShareError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /ConnectionError|RemoteDisconnected|ReadTimeout|ConnectTimeout|ProtocolError|AKSHARE_TIMEOUT|HTTPError/i.test(message);
}

export async function runAkShareOperation(operation: AkShareOperation): Promise<AkShareRawResult> {
  const executable = resolvePythonExecutable();
  const script = path.resolve("server", "python", "akshare_adapter.py");
  if (!existsSync(script)) throw new Error("AKSHARE_ADAPTER_SCRIPT_MISSING");
  const timeoutMs = Math.max(10_000, Math.min(120_000, Number(process.env.AKSHARE_TIMEOUT_MS ?? 60_000)));
  const maxAttempts = Math.max(1, Math.min(3, Number(process.env.AKSHARE_MAX_ATTEMPTS ?? 2)));
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runAkShareProcess(executable, script, operation, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientAkShareError(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, 750 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AKSHARE_REQUEST_FAILED");
}

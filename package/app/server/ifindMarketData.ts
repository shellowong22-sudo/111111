import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { YahooChartPoint, YahooChartResult } from "./realDataService";
import {
  IFIND_BASIC_INDICATORS,
  IFIND_HISTORY_FIELDS,
  IFIND_REALTIME_FIELDS,
  type IfindCategoryId,
} from "./ifindDataCatalog";

type IfindRange = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";
type BridgeRecord = {
  symbol?: unknown;
  date?: unknown;
  timestamp?: unknown;
  preClose?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  latest?: unknown;
  change?: unknown;
  changeRatio?: unknown;
  volume?: unknown;
  amount?: unknown;
  bid1?: unknown;
  ask1?: unknown;
  bidSize1?: unknown;
  askSize1?: unknown;
  inflow?: unknown;
  outflow?: unknown;
};
export type IfindBridgeResponse = {
  ok: boolean;
  code?: string;
  providerCode?: number | string;
  message?: string;
  symbol?: string;
  records?: BridgeRecord[];
  realtime?: BridgeRecord | null;
  realtimeAvailable?: boolean;
  mode?: string;
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
  truncated?: boolean;
};

const BRIDGE_MARKER = "__IFIND_JSON__";
const SOURCE = "Tonghuashun iFinD SDK" as const;

function candidateSdkPaths() {
  const configured = process.env.THS_IFIND_SDK_PATH?.trim();
  const roots = [
    configured,
    path.join(homedir(), "Desktop"),
    path.join(homedir(), "Downloads"),
  ].filter((value): value is string => Boolean(value));
  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(root, path.join(root, "bin", "x64"));
    if (!existsSync(root)) continue;
    try {
      for (const name of readdirSync(root)
        .filter(name => name.startsWith("THSDataInterface_Windows_"))
        .sort()
        .reverse()) {
        candidates.push(
          path.join(root, name),
          path.join(root, name, "bin", "x64"),
          path.join(root, name, "THSDataInterface_Windows"),
          path.join(root, name, "THSDataInterface_Windows", "bin", "x64")
        );
      }
    } catch {
      // A missing or unreadable optional discovery directory is not fatal.
    }
  }
  return [...new Set(candidates)];
}

export function resolveIfindSdkPath() {
  return (
    candidateSdkPaths().find(candidate =>
      existsSync(path.join(candidate, "iFinDPy.py"))
    ) ?? null
  );
}

function resolveIfindCredentialFile() {
  const configured = process.env.THS_IFIND_CREDENTIAL_FILE?.trim();
  const candidate =
    configured ||
    path.resolve(process.cwd(), ".runtime", "ifind-credential.xml");
  return existsSync(candidate) ? candidate : null;
}

export function getIfindProviderStatus() {
  const sdkPath = resolveIfindSdkPath();
  const usernameConfigured = Boolean(process.env.THS_IFIND_USERNAME?.trim());
  const passwordConfigured = Boolean(process.env.THS_IFIND_PASSWORD);
  const protectedCredentialConfigured = Boolean(resolveIfindCredentialFile());
  const credentialsConfigured =
    (usernameConfigured && passwordConfigured) || protectedCredentialConfigured;
  return {
    id: "tonghuashun-ifind-sdk",
    provider: "同花顺 iFinD SDK",
    access: "local_licensed_sdk" as const,
    configured: Boolean(sdkPath && credentialsConfigured),
    sdkInstalled: Boolean(sdkPath),
    credentialsConfigured,
    assetClasses: ["股票", "基金", "债券", "指数", "期货与期权", "宏观"],
    updateBoundary: "按账户授权范围返回实时、延迟或历史数据",
    limitation: sdkPath
      ? credentialsConfigured
        ? "SDK 与凭据已检测；需通过连接验证和实际响应确认账户权限。"
        : "SDK 已安装；等待 Windows 加密授权或安全环境变量 THS_IFIND_USERNAME / THS_IFIND_PASSWORD。"
      : "未检测到本机 iFinDPy SDK；可通过 THS_IFIND_SDK_PATH 指定 x64 目录。",
  };
}

export function normalizeIfindSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (/\.(SH|SZ|BJ|HK|O|N|OF|CFE|SHF|DCE|CZC|INE)$/.test(normalized))
    return normalized;
  if (normalized.endsWith(".SS")) return `${normalized.slice(0, -3)}.SH`;
  if (/^\d{6}$/.test(normalized)) {
    if (/^[56]/.test(normalized)) return `${normalized}.SH`;
    if (/^[0123]/.test(normalized)) return `${normalized}.SZ`;
  }
  if (/^[A-Z][A-Z0-9.-]{0,19}$/.test(normalized))
    return `${normalized.replace(/\.(US|O|N|A|B)$/, "")}.O`;
  return null;
}

function ifindSymbolCandidates(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const primary = normalizeIfindSymbol(normalized);
  if (!primary) return [];
  if (/^[A-Z][A-Z0-9.-]{0,19}(\.US)?$/.test(normalized)) {
    const base = normalized.replace(/\.(US|O|N|A|B)$/, "");
    return [`${base}.O`, `${base}.N`];
  }
  return [primary];
}

const finiteNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[,％%\s]/g, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const positive = (value: unknown) => {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const nonnegative = (value: unknown) => {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
};

const isoDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const parsed = Date.parse(`${match[1]}T00:00:00Z`);
  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === match[1]
    ? match[1]
    : null;
};

function currencyFor(thsCode: string) {
  if (/\.(O|N)$/.test(thsCode)) return "USD";
  if (thsCode.endsWith(".HK")) return "HKD";
  if (/\.(SH|SZ|BJ|OF|CFE|SHF|DCE|CZC|INE)$/.test(thsCode)) return "CNY";
  return "未提供";
}

export function parseIfindHistory(
  response: IfindBridgeResponse,
  requestedSymbol: string,
  retrievedAt: string
): YahooChartResult | null {
  if (!response.ok || !response.symbol || !Array.isArray(response.records))
    return null;
  const unique = new Map<string, YahooChartPoint>();
  for (const record of response.records) {
    const date = isoDate(record.date);
    const close = positive(record.close);
    if (!date || close === null) continue;
    unique.set(date, {
      date,
      value: close,
      open: positive(record.open),
      high: positive(record.high),
      low: positive(record.low),
      close,
      volume: nonnegative(record.volume),
    });
  }
  const history = [...unique.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (history.length < 2) return null;
  const current = response.realtime ?? response.records.at(-1) ?? null;
  const latestHistory = history.at(-1)!;
  const previousHistory = history.at(-2)!;
  const price =
    positive(current?.latest) ??
    positive(current?.close) ??
    latestHistory.value;
  const previousClose = positive(current?.preClose) ?? previousHistory.value;
  const reportedChange = finiteNumber(current?.change);
  const change = Number((reportedChange ?? price - previousClose).toFixed(4));
  const reportedChangePct = finiteNumber(current?.changeRatio);
  const changePct = Number(
    (
      reportedChangePct ?? (previousClose ? (change / previousClose) * 100 : 0)
    ).toFixed(4)
  );
  return {
    symbol: requestedSymbol.trim().toUpperCase(),
    price,
    change,
    changePct,
    currency: currencyFor(response.symbol),
    history,
    meta: {
      providerCode: "THS_IFIND",
      providerSymbol: response.symbol,
      observedAt:
        typeof current?.timestamp === "string"
          ? current.timestamp
          : latestHistory.date,
      retrievedAt,
      frequency: "daily",
      realtime: Boolean(response.realtimeAvailable),
      entitlementBound: true,
      schemaVersion: "ifind-market-v1",
      preClose: previousClose,
      open: positive(current?.open) ?? latestHistory.open,
      high: positive(current?.high) ?? latestHistory.high,
      low: positive(current?.low) ?? latestHistory.low,
      volume: nonnegative(current?.volume) ?? latestHistory.volume,
      amount: nonnegative(current?.amount),
      bid1: positive(current?.bid1),
      ask1: positive(current?.ask1),
      bidSize1: nonnegative(current?.bidSize1),
      askSize1: nonnegative(current?.askSize1),
      inflow: nonnegative(current?.inflow),
      outflow: nonnegative(current?.outflow),
    },
    source: SOURCE,
  };
}

type BridgeRunner = (
  request: Record<string, unknown>
) => Promise<IfindBridgeResponse>;

async function runBridgeProcess(
  request: Record<string, unknown>
): Promise<IfindBridgeResponse> {
  const sdkPath = resolveIfindSdkPath();
  if (!sdkPath) return { ok: false, code: "IFIND_SDK_NOT_FOUND" };
  const credentialFile = resolveIfindCredentialFile();
  if (
    (!process.env.THS_IFIND_USERNAME?.trim() ||
      !process.env.THS_IFIND_PASSWORD) &&
    !credentialFile
  )
    return { ok: false, code: "IFIND_CREDENTIALS_NOT_CONFIGURED" };
  const bridgePath = path.resolve(process.cwd(), "scripts", "ifind_bridge.py");
  if (!existsSync(bridgePath))
    return { ok: false, code: "IFIND_BRIDGE_NOT_FOUND" };
  const python = process.env.THS_IFIND_PYTHON_BIN?.trim() || "python";
  return new Promise(resolve => {
    const child = spawn(python, [bridgePath], {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        THS_IFIND_SDK_PATH: sdkPath,
        ...(credentialFile
          ? { THS_IFIND_CREDENTIAL_FILE: credentialFile }
          : {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (value: IfindBridgeResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, code: "IFIND_BRIDGE_TIMEOUT" });
    }, 15_000);
    child.stdout.on("data", chunk => {
      stdout = (stdout + chunk.toString("utf8")).slice(-2_000_000);
    });
    child.stderr.on("data", chunk => {
      stderr = (stderr + chunk.toString("utf8")).slice(-16_000);
    });
    child.on("error", () =>
      finish({ ok: false, code: "IFIND_BRIDGE_START_FAILED" })
    );
    child.on("close", code => {
      const markerAt = stdout.lastIndexOf(BRIDGE_MARKER);
      if (markerAt < 0) {
        finish({
          ok: false,
          code: code === 0 ? "IFIND_BRIDGE_EMPTY" : "IFIND_BRIDGE_FAILED",
          message: stderr
            ? "The SDK bridge returned an internal error."
            : undefined,
        });
        return;
      }
      try {
        finish(
          JSON.parse(
            stdout.slice(markerAt + BRIDGE_MARKER.length).trim()
          ) as IfindBridgeResponse
        );
      } catch {
        finish({ ok: false, code: "IFIND_BRIDGE_INVALID_JSON" });
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

let bridgeTail: Promise<void> = Promise.resolve();

function runBridge(
  request: Record<string, unknown>
): Promise<IfindBridgeResponse> {
  const task = bridgeTail.then(
    () => runBridgeProcess(request),
    () => runBridgeProcess(request)
  );
  bridgeTail = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

export function createIfindMarketReader(
  deps: { runBridge: BridgeRunner; now: () => Date } = {
    runBridge,
    now: () => new Date(),
  }
) {
  return async (symbol: string, range: IfindRange) => {
    const thsCodes = ifindSymbolCandidates(symbol);
    if (!thsCodes.length) return null;
    const end = deps.now();
    const begin = new Date(end);
    const months = {
      "1mo": 1,
      "3mo": 3,
      "6mo": 6,
      "1y": 12,
      "2y": 24,
      "5y": 60,
    }[range];
    begin.setUTCDate(1);
    begin.setUTCMonth(begin.getUTCMonth() - months);
    const response = await deps.runBridge({
      action: "history",
      symbols: thsCodes,
      begin: begin.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
    return parseIfindHistory(response, symbol, end.toISOString());
  };
}

export const fetchIfindMarketHistory = createIfindMarketReader();

export type IfindMarketSnapshot = {
  requestedSymbol: string;
  providerSymbol: string;
  price: number;
  preClose: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  amount: number | null;
  bid1: number | null;
  ask1: number | null;
  bidSize1: number | null;
  askSize1: number | null;
  inflow: number | null;
  outflow: number | null;
  currency: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: boolean;
  source: typeof SOURCE;
};

export function createIfindSnapshotReader(
  deps: { runBridge: BridgeRunner; now: () => Date } = {
    runBridge,
    now: () => new Date(),
  }
) {
  return async (requestedSymbols: string[]): Promise<IfindMarketSnapshot[]> => {
    const requestedByProvider = new Map<string, string>();
    for (const requested of requestedSymbols.slice(0, 30)) {
      const provider = normalizeIfindSymbol(requested);
      if (provider && !requestedByProvider.has(provider))
        requestedByProvider.set(provider, requested.trim().toUpperCase());
    }
    const providerSymbols = [...requestedByProvider.keys()];
    if (!providerSymbols.length) return [];
    const retrievedAt = deps.now().toISOString();
    const response = await deps.runBridge({
      action: "snapshot",
      symbols: providerSymbols,
    });
    if (!response.ok || !Array.isArray(response.records)) return [];
    return response.records.flatMap(record => {
      const providerSymbol =
        typeof record.symbol === "string"
          ? record.symbol.trim().toUpperCase()
          : providerSymbols.length === 1
            ? providerSymbols[0]
            : "";
      const requestedSymbol = requestedByProvider.get(providerSymbol);
      const price = positive(record.latest) ?? positive(record.close);
      if (!requestedSymbol || price === null) return [];
      const preClose = positive(record.preClose);
      const reportedChange = finiteNumber(record.change);
      const change = reportedChange ?? (preClose ? price - preClose : null);
      const reportedChangePct = finiteNumber(record.changeRatio);
      const changePct =
        reportedChangePct ??
        (preClose && change !== null ? (change / preClose) * 100 : null);
      return [
        {
          requestedSymbol,
          providerSymbol,
          price,
          preClose,
          change: change === null ? null : Number(change.toFixed(4)),
          changePct: changePct === null ? null : Number(changePct.toFixed(4)),
          open: positive(record.open),
          high: positive(record.high),
          low: positive(record.low),
          volume: nonnegative(record.volume),
          amount: nonnegative(record.amount),
          bid1: positive(record.bid1),
          ask1: positive(record.ask1),
          bidSize1: nonnegative(record.bidSize1),
          askSize1: nonnegative(record.askSize1),
          inflow: nonnegative(record.inflow),
          outflow: nonnegative(record.outflow),
          currency: currencyFor(providerSymbol),
          observedAt:
            typeof record.timestamp === "string" ? record.timestamp : null,
          retrievedAt,
        realtime: Boolean(response.realtimeAvailable),
          source: SOURCE,
        },
      ];
    });
  };
}

export const fetchIfindMarketSnapshots = createIfindSnapshotReader();

export type IfindDatasetMode =
  | "realtime"
  | "history"
  | "basic"
  | "edb"
  | "iwencai";

export type IfindDatasetRequest = {
  categoryId: IfindCategoryId;
  mode: IfindDatasetMode;
  symbols?: string[];
  fields?: string[];
  indicators?: string[];
  begin?: string;
  end?: string;
  query?: string;
  domain?: "stock" | "fund" | "bond" | "index" | "future" | "option";
};

const IFIND_ALLOWED_MARKET_FIELDS = new Set<string>([
  ...IFIND_REALTIME_FIELDS,
  ...IFIND_HISTORY_FIELDS,
]);
const IFIND_ALLOWED_BASIC_FIELDS = new Set<string>(
  IFIND_BASIC_INDICATORS.map(item => item.id)
);

/**
 * Execute a bounded, schema-validated licensed SDK query.
 *
 * The API deliberately does not accept a function name or executable code.
 * It maps a small declarative request to an allow-listed SDK operation in the
 * Python bridge.  Data is returned exactly as the SDK supplied it.
 */
export async function fetchIfindLicensedDataset(
  input: IfindDatasetRequest
) {
  const now = new Date().toISOString();
  const fields = (input.fields ?? []).slice(0, 40);
  if (
    input.mode === "realtime" ||
    input.mode === "history"
  ) {
    const rejected = fields.filter(field => !IFIND_ALLOWED_MARKET_FIELDS.has(field));
    if (rejected.length)
      return {
        available: false as const,
        categoryId: input.categoryId,
        mode: input.mode,
        queriedAt: now,
        columns: [] as string[],
        rows: [] as Array<Record<string, unknown>>,
        reason: `字段不在已校验行情白名单：${rejected.join(", ")}`,
      };
  }
  if (input.mode === "basic") {
    const rejected = fields.filter(field => !IFIND_ALLOWED_BASIC_FIELDS.has(field));
    if (rejected.length)
      return {
        available: false as const,
        categoryId: input.categoryId,
        mode: input.mode,
        queriedAt: now,
        columns: [] as string[],
        rows: [] as Array<Record<string, unknown>>,
        reason: `指标尚未进入已校验基础数据白名单：${rejected.join(", ")}`,
      };
  }
  const response = await runBridge({
    action: "dataset",
    mode: input.mode,
    symbols: input.symbols?.slice(0, 30),
    fields,
    indicators: input.indicators?.slice(0, 40),
    begin: input.begin,
    end: input.end,
    query: input.query,
    domain: input.domain,
  });
  if (!response.ok)
    return {
      available: false as const,
      categoryId: input.categoryId,
      mode: input.mode,
      queriedAt: now,
      columns: [] as string[],
      rows: [] as Array<Record<string, unknown>>,
      providerCode: response.providerCode ?? null,
      reason:
        response.message ??
        response.code ??
        "账户授权范围内没有返回该数据集。",
    };
  const responseRows = Array.isArray(response.rows)
    ? response.rows.slice(0, 1000)
    : [];
  if (
    input.mode === "edb" &&
    !responseRows.some(row => {
      const value = row.value;
      return value !== null && value !== undefined && value !== "";
    })
  )
    return {
      available: false as const,
      categoryId: input.categoryId,
      mode: input.mode,
      queriedAt: now,
      columns: Array.isArray(response.columns) ? response.columns.slice(0, 80) : [],
      rows: [] as Array<Record<string, unknown>>,
      providerCode: response.providerCode ?? 0,
      reason: "SDK 已响应，但所选时段没有返回指标值。请扩大日期范围或确认指标授权。",
    };
  return {
    available: true as const,
    categoryId: input.categoryId,
    mode: input.mode,
    queriedAt: now,
    source: SOURCE,
    providerCode: response.providerCode ?? 0,
    columns: Array.isArray(response.columns) ? response.columns.slice(0, 80) : [],
    rows: responseRows,
    truncated: response.truncated === true,
    entitlementBound: true as const,
    schemaVersion: "ifind-dataset-v1",
  };
}

export async function probeIfindConnection() {
  const status = getIfindProviderStatus();
  if (!status.sdkInstalled)
    return {
      ...status,
      connectionStatus: "sdk_missing" as const,
      reason: status.limitation,
    };
  if (!status.credentialsConfigured)
    return {
      ...status,
      connectionStatus: "credentials_missing" as const,
      reason: status.limitation,
    };
  const response = await runBridge({ action: "health" });
  return response.ok
    ? {
        ...status,
        connectionStatus: "available" as const,
        reason:
          "SDK login verified; actual datasets remain limited by the account entitlement.",
      }
    : {
        ...status,
        connectionStatus: "unavailable" as const,
        reason: response.message ?? response.code ?? "IFIND_CONNECTION_FAILED",
        providerCode: response.providerCode,
      };
}

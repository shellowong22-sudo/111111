import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { inArray } from "drizzle-orm";
import { adminDataModuleContentItems, financeWorldDataset, users } from "../drizzle/schema";
import { ADMIN_DATA_MODULES } from "../shared/adminDataModules";
import { getDb } from "./db";
import { manuallyPushSpiderData } from "./spiderPlatform";
import { cleanPublicFeedText, getPublicModuleFeed, isNearDuplicatePublicContent, publicContentRejectionReason, toPublicFeedItem } from "./adminModulePublicFeed";

export type ScraplingRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ScraplingRunInput = {
  taskKind: "fetch" | "crawl";
  mode: "static" | "dynamic" | "stealth";
  urls: string[];
  selectorType: "css" | "xpath";
  selector: string;
  adaptive: boolean;
  networkIdle: boolean;
  disableResources: boolean;
  timeoutMs: number;
  maxPages: number;
  concurrency: number;
  delayMs: number;
  language?: string;
};

type ScraplingItem = {
  url: string;
  status: number;
  reason?: string;
  title: string;
  text: string;
  markdown: string;
  selected: string[];
  selector: string;
  selectorType: string;
  links: string[];
  linkCount: number;
  bytes: number;
  contentHash: string;
  contentType?: string | null;
  encoding?: string;
  artifactPath: string;
  cleaningVersion?: string;
  removedNoiseNodes?: number;
  rawContentHash?: string;
  duplicateOfContentHash?: string | null;
  qualityRejectionReason?: string | null;
};

type ScraplingBridgeResult = {
  ok: boolean;
  error?: string;
  errorType?: string;
  kind?: string;
  mode?: string;
  paused?: boolean;
  robots?: Array<Record<string, unknown>>;
  items?: ScraplingItem[];
  stats?: Record<string, unknown>;
  values?: string[];
  [key: string]: unknown;
};

export type ScraplingPushRecord = {
  pushId: string;
  idempotencyKey?: string;
  runId: string;
  createdAt: string;
  moduleIds: string[];
  status: "waiting_front_ack" | "front_acknowledged" | "duplicate_blocked" | "failed";
  receipts: unknown[];
  sentAt?: string;
  contentItems?: Array<{
    contentId: string;
    title: string;
    body: string;
    sourceUrl: string;
    sourceName: string;
    contentHash: string;
    collectedAt: string;
    dataQuality: string;
    duplicateStatus: string;
  }>;
  moduleTargets?: Array<{ moduleId: string; name: string; path: string; domain: string }>;
  audience?: {
    type: string;
    label: string;
    frontendId: string;
    environmentId: string;
    tenantId: string;
    recipientCount: number;
    recipients: Array<{ userId: number; name: string; email: string | null; role: string; lastSignedIn: Date | string }>;
  };
  expectedRecipientCount?: number;
  expectedDeliveryCount?: number;
  error?: string;
};

export type ScraplingRun = {
  runId: string;
  actorUserId: number;
  input: ScraplingRunInput;
  status: ScraplingRunStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  result: ScraplingBridgeResult | null;
  error: string | null;
  errorType: string | null;
  stderr: string;
  duplicateOf: string | null;
  pushRecords: ScraplingPushRecord[];
};

type ScraplingState = {
  schemaVersion: 1;
  updatedAt: string;
  runs: ScraplingRun[];
};

const APP_ROOT = process.cwd();
const RUNTIME_ROOT = path.join(APP_ROOT, ".runtime", "scrapling-admin");
const STATE_PATH = path.join(RUNTIME_ROOT, "state.json");
const PYTHON = process.env.SCRAPLING_PYTHON || path.join(APP_ROOT, ".runtime", "scrapling-venv", "Scripts", "python.exe");
const BRIDGE = path.join(APP_ROOT, "scripts", "scrapling_bridge.py");
const activeJobs = new Map<string, ChildProcessWithoutNullStreams>();
let stateWriteChain: Promise<void> = Promise.resolve();
let healthCache: { value: Record<string, unknown>; expiresAt: number } | null = null;

function now() {
  return new Date().toISOString();
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function scraplingPushIdempotencyKey(input: { runId: string; moduleIds: string[]; recipientUserIds: number[]; dataUuids: string[] }) {
  return `scridem_${hash(`${input.runId}|${[...input.moduleIds].sort().join(",")}|${[...input.recipientUserIds].sort((a, b) => a - b).join(",")}|${[...input.dataUuids].sort().join(",")}`).slice(0, 48)}`;
}

export function createScraplingPushId() {
  return `scrpush_${randomUUID().replaceAll("-", "")}`;
}

/**
 * Existing Scrapling runs may predate the article cleaner.  Keep their raw
 * HTML artifacts untouched, but expose the same cleaned body in all preview
 * and delivery ledgers so the operator never reviews or re-sends page chrome.
 */
const SCRAPLING_NAVIGATION_LABELS = new Set([
  "首页", "金融管理", "要闻", "评论", "深度", "银行", "证券", "保险", "国际", "地方", "公司", "理论",
  "金融科技", "农村金融", "可视化", "文化", "信批平台", "中国金融家", "专题", "品牌", "详情", "分享",
  "金融时报", "APP", "电子报", "微信", "官方微博", "官方抖音", "金融时报APP", "金融时报电子报", "金融时报数字报",
]);

function plainScraplingLine(value: string) {
  return value
    .replace(/^\s{0,3}(?:#{1,6}\s*|(?:[-+*•>|]\s*)+|\d+[.)]\s*)/, "")
    .replace(/^[\s:#*_=|>]+/, "")
    .replace(/[\s*_=|]+$/, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*[=*_-]{3,}\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function canonicalScraplingUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/(?:index|default)\.(?:html?|shtml?)$/i, "/").replace(/\/{2,}/g, "/");
    return `${parsed.hostname.toLowerCase()}${pathname || "/"}`.replace(/\/$/, "") || parsed.hostname.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export function cleanScraplingPreviewBody(value: unknown, sourceUrl = "", sourceTitle = "") {
  if (typeof value !== "string") return "";
  const baseTitle = sourceTitle.replace(/\s*[-—]\s*中国金融新闻网\s*$/i, "").trim();
  let lines = value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[[^\]]*\]\(javascript:[^)]*\)/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\\([*_[\]`])/g, "$1")
    .replace(/[\u200B-\u200D\uFEFF]/g, " ")
    .split(/[\n\r]+/)
    .map(plainScraplingLine)
    .filter(Boolean)
    .filter((line) => !/^\*+$/.test(line));

  const locationIndex = lines.findIndex((line) => /^当前位置(?:[:：]|$)/.test(line));
  const isDetailPage = /\/content_[^/]+\.s?html?$/i.test(sourceUrl);
  const isListingPage = /\/node_\d+(?:_\d+)?\.s?html?$/i.test(sourceUrl);
  if (locationIndex >= 0 && (isDetailPage || isListingPage)) {
    const candidates: number[] = [];
    for (let index = locationIndex + 1; index < Math.min(lines.length, locationIndex + 14); index += 1) {
      if (baseTitle && lines[index] === baseTitle) candidates.push(index);
    }
    const startIndex = candidates.length ? candidates[candidates.length - 1] + 1 : locationIndex + 1;
    lines = lines.slice(startIndex);
  }

  const stopIndex = lines.findIndex((line, index) => {
    if (/^(?:友情链接|金融时报社媒体简介|关于我们|广告刊例|记者专栏|联系我们)(?:[:：]|$)/.test(line)) return true;
    if (/^(?:版权声明|责任编辑)[:：]/.test(line)) return true;
    if ((isDetailPage || isListingPage) && index > 0 && /^(?:专题|可视化)$/.test(line)) return true;
    return false;
  });
  if (stopIndex >= 0) lines = lines.slice(0, stopIndex);

  return lines
    .filter((line) => !SCRAPLING_NAVIGATION_LABELS.has(line))
    .filter((line) => !/^(?:官方网站|证券市场信息披露平台|当前位置|上一页|下一页|分享[:：]?|\d{1,2}\)?$)/.test(line))
    .filter((line) => !/(?:ICP备案|互联网新闻信息服务许可证|违法和不良信息举报|Copyright\s*©|金融新闻网由金融时报社主办)/i.test(line))
    .map((line) => cleanPublicFeedText(line))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function prepareScraplingItemsForDelivery(items: ScraplingItem[]) {
  const prepared: Array<ScraplingItem & { cleanedBody: string; duplicateOfContentHash: string | null; qualityRejectionReason: string | null }> = [];
  for (const item of items) {
    const cleanedBody = cleanScraplingPreviewBody(item.markdown || item.text, item.url, item.title);
    const qualityRejectionReason = publicContentRejectionReason({ title: item.title, body: cleanedBody, sourceReference: item.url });
    const canonicalUrl = canonicalScraplingUrl(item.url);
    const duplicate = prepared.find((previous) => (
      Boolean(canonicalUrl && canonicalUrl === canonicalScraplingUrl(previous.url))
      || isNearDuplicatePublicContent(cleanedBody, previous.cleanedBody)
    ));
    prepared.push({ ...item, cleanedBody, duplicateOfContentHash: duplicate?.contentHash ?? null, qualityRejectionReason });
  }
  return prepared;
}

export function normalizeDuplicateScraplingReceipt(receipt: any) {
  if (!receipt?.duplicateBlocked && receipt?.currentStatus !== "duplicate_blocked") return null;
  return {
    ...receipt,
    duplicateBlocked: true,
    deliveryAction: "duplicate_blocked",
    currentStatus: "duplicate_blocked",
    sentCount: 0,
    successCount: 0,
    pendingCount: 0,
    failureCount: 0,
    frontAckAt: null,
    frontReadConfirmed: false,
    acknowledgedClientCount: 0,
    acknowledgedClients: [],
    acknowledgedUserIds: [],
    acknowledgedTerminals: [],
    feedVisible: false,
    failureReason: receipt.failureReason || "相同内容已在该前端模块保留唯一版本，本次发送在入队前被幂等拦截。",
  };
}

export function sanitizeRunForDisplay(run: ScraplingRun) {
  const preparedItems = prepareScraplingItemsForDelivery(run.result?.items ?? []);
  const result = run.result
    ? {
        ...run.result,
        items: preparedItems.map((item) => ({
          ...item,
          text: item.cleanedBody,
          markdown: item.cleanedBody,
          cleaningVersion: item.cleaningVersion || "2026-09-11.preview-v2",
        })),
      }
    : run.result;
  const pushRecords = run.pushRecords.map((record) => ({
    ...record,
    error: record.error ? conciseScraplingPushError(record.error) : record.error,
    contentItems: record.contentItems?.map((item) => ({
      ...item,
      body: cleanScraplingPreviewBody(item.body, item.sourceUrl, item.title),
    })),
  }));
  return { ...run, result, pushRecords, active: activeJobs.has(run.runId) };
}

function conciseScraplingPushError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "SCRAPLING_PUSH_FAILED";
  if (/Failed query:\s*insert into [`\"]?admin_data_module_content_items/i.test(message)) {
    return "推送内容写入失败：数据库内容键冲突。失败任务已保留，可按原目标重试；前端未收到这次失败内容。";
  }
  return message.length > 900 ? `${message.slice(0, 900)}…` : message;
}

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readState(): Promise<ScraplingState> {
  await mkdir(RUNTIME_ROOT, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(STATE_PATH, "utf8")) as ScraplingState;
    const stamp = now();
    let changed = false;
    for (const run of parsed.runs ?? []) {
      if ((run.status === "queued" || run.status === "running") && !activeJobs.has(run.runId)) {
        run.status = "failed";
        run.error = "服务重启中断了该运行；可从相同参数重新执行。";
        run.errorType = "PROCESS_RESTART_INTERRUPTION";
        run.completedAt = stamp;
        run.updatedAt = stamp;
        changed = true;
      }
    }
    if (changed) await persistState(parsed);
    return parsed;
  } catch {
    return { schemaVersion: 1, updatedAt: now(), runs: [] };
  }
}

async function persistState(state: ScraplingState) {
  state.updatedAt = now();
  const temp = `${STATE_PATH}.${process.pid}.${randomUUID()}.tmp`;
  stateWriteChain = stateWriteChain.then(async () => {
    await mkdir(RUNTIME_ROOT, { recursive: true });
    await writeFile(temp, JSON.stringify(state, null, 2), "utf8");
    await rename(temp, STATE_PATH);
  });
  await stateWriteChain;
}

async function mutateRun(runId: string, update: (run: ScraplingRun) => void) {
  const state = await readState();
  const run = state.runs.find(item => item.runId === runId);
  if (!run) throw new Error("SCRAPLING_RUN_NOT_FOUND");
  update(run);
  run.updatedAt = now();
  await persistState(state);
  return run;
}

function runDirectory(runId: string) {
  return path.join(RUNTIME_ROOT, "runs", runId);
}

function decodeBridgeOutput(stdout: string): ScraplingBridgeResult {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("SCRAPLING_BRIDGE_EMPTY_RESPONSE");
  try {
    return JSON.parse(trimmed) as ScraplingBridgeResult;
  } catch {
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(lines[index]) as ScraplingBridgeResult;
      } catch {
        // Continue looking for the bridge's final JSON line.
      }
    }
    throw new Error(`SCRAPLING_BRIDGE_INVALID_RESPONSE:${trimmed.slice(-500)}`);
  }
}

async function runBridgeOnce(payload: Record<string, unknown>, timeoutMs = 45_000) {
  if (!(await exists(PYTHON))) throw new Error(`SCRAPLING_PYTHON_NOT_FOUND:${PYTHON}`);
  if (!(await exists(BRIDGE))) throw new Error(`SCRAPLING_BRIDGE_NOT_FOUND:${BRIDGE}`);
  return new Promise<ScraplingBridgeResult>((resolve, reject) => {
    const child = spawn(PYTHON, [BRIDGE], {
      cwd: APP_ROOT,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("SCRAPLING_BRIDGE_TIMEOUT"));
    }, timeoutMs);
    child.stdout.on("data", chunk => {
      stdout = `${stdout}${String(chunk)}`.slice(-15_000_000);
    });
    child.stderr.on("data", chunk => {
      stderr = `${stderr}${String(chunk)}`.slice(-120_000);
    });
    child.once("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timer);
      try {
        const result = decodeBridgeOutput(stdout);
        if (code !== 0 || !result.ok) reject(new Error(result.error || stderr || `SCRAPLING_BRIDGE_EXIT_${code}`));
        else resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export async function getScraplingHealth(force = false) {
  if (!force && healthCache && healthCache.expiresAt > Date.now()) return healthCache.value;
  const [pythonExists, bridgeExists, vendorLicenseExists] = await Promise.all([
    exists(PYTHON),
    exists(BRIDGE),
    exists(path.join(APP_ROOT, "vendor", "Scrapling-main", "LICENSE")),
  ]);
  if (!pythonExists || !bridgeExists) {
    return {
      ok: false,
      pythonExists,
      bridgeExists,
      vendorLicenseExists,
      error: "Scrapling 私有运行环境或桥接脚本缺失",
      capabilities: [],
    };
  }
  try {
    const value = {
      ...(await runBridgeOnce({ action: "health" }, 20_000)),
      pythonExists,
      bridgeExists,
      vendorLicenseExists,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      runtimeRoot: RUNTIME_ROOT,
    };
    healthCache = { value, expiresAt: Date.now() + 30_000 };
    return value;
  } catch (error) {
    return {
      ok: false,
      pythonExists,
      bridgeExists,
      vendorLicenseExists,
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      error: error instanceof Error ? error.message : "SCRAPLING_HEALTH_FAILED",
      capabilities: [],
    };
  }
}

function resultIdentity(result: ScraplingBridgeResult | null) {
  if (!result?.items?.length) return null;
  return hash(result.items.map(item => `${item.url}|${item.contentHash}`).sort().join("\n"));
}

async function finalizeRun(runId: string, code: number | null, stdout: string, stderr: string) {
  activeJobs.delete(runId);
  await mutateRun(runId, run => {
    if (run.status === "cancelled") return;
    run.stderr = stderr.slice(-120_000);
    run.completedAt = now();
    try {
      const result = decodeBridgeOutput(stdout);
      run.result = result;
      if (code !== 0 || !result.ok) {
        run.status = "failed";
        run.error = result.error || `Scrapling 进程退出码 ${code}`;
        run.errorType = result.errorType || "SCRAPLING_BRIDGE_FAILURE";
        return;
      }
      run.status = result.paused ? "paused" : "completed";
      run.error = null;
      run.errorType = null;
    } catch (error) {
      run.status = "failed";
      run.error = error instanceof Error ? error.message : "无法解析 Scrapling 返回";
      run.errorType = "SCRAPLING_RESPONSE_PARSE_FAILURE";
    }
  });
  const state = await readState();
  const run = state.runs.find(item => item.runId === runId);
  const identity = resultIdentity(run?.result ?? null);
  if (!run || !identity) return;
  const prior = state.runs.find(item => item.runId !== runId && item.status === "completed" && resultIdentity(item.result) === identity);
  if (prior) {
    run.duplicateOf = prior.runId;
    run.updatedAt = now();
    await persistState(state);
  }
}

function spawnRun(run: ScraplingRun) {
  const dir = runDirectory(run.runId);
  const artifacts = path.join(dir, "artifacts");
  const checkpoint = path.join(dir, "checkpoint");
  const controlFile = path.join(dir, "pause.requested");
  const payload = {
    action: run.input.taskKind === "crawl" ? "crawl" : "fetch",
    ...run.input,
    artifactDir: artifacts,
    checkpointDir: checkpoint,
    controlFile,
  };
  const child = spawn(PYTHON, [BRIDGE], {
    cwd: APP_ROOT,
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  activeJobs.set(run.runId, child);
  let stdout = "";
  let stderr = "";
  let finalized = false;
  const finish = (code: number | null, failure?: Error) => {
    if (finalized) return;
    finalized = true;
    const output = failure
      ? JSON.stringify({ ok: false, error: failure.message, errorType: failure.name })
      : stdout;
    void finalizeRun(run.runId, code, output, stderr);
  };
  child.stdout.on("data", chunk => {
    stdout = `${stdout}${String(chunk)}`.slice(-15_000_000);
  });
  child.stderr.on("data", chunk => {
    stderr = `${stderr}${String(chunk)}`.slice(-120_000);
  });
  child.once("error", error => finish(1, error));
  child.once("close", code => finish(code));
  child.stdin.end(JSON.stringify(payload));
}

export async function startScraplingRun(input: ScraplingRunInput, actorUserId: number) {
  const health = await getScraplingHealth();
  if (!health.ok) throw new Error(String(health.error || "SCRAPLING_RUNTIME_UNAVAILABLE"));
  const stamp = now();
  const run: ScraplingRun = {
    runId: `scr_${Date.now().toString(36)}_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
    actorUserId,
    input,
    status: "queued",
    createdAt: stamp,
    startedAt: null,
    completedAt: null,
    updatedAt: stamp,
    result: null,
    error: null,
    errorType: null,
    stderr: "",
    duplicateOf: null,
    pushRecords: [],
  };
  const state = await readState();
  state.runs.unshift(run);
  state.runs = state.runs.slice(0, 200);
  await mkdir(runDirectory(run.runId), { recursive: true });
  await persistState(state);
  run.status = "running";
  run.startedAt = now();
  run.updatedAt = run.startedAt;
  await persistState(state);
  spawnRun(run);
  return run;
}

export async function listScraplingRuns() {
  const state = await readState();
  const runs = state.runs.map(sanitizeRunForDisplay);
  const db = await getDb();
  if (!db) return runs;
  const contentKeys = [...new Set(runs.flatMap(run => run.pushRecords.flatMap(record => (record.receipts as any[]).map(receipt => String(receipt?.contentKey ?? "")).filter(Boolean))))];
  if (!contentKeys.length) return runs;
  const rows = await db.select().from(adminDataModuleContentItems).where(inArray(adminDataModuleContentItems.contentKey, contentKeys));
  const byKey = new Map(rows.map(row => [row.contentKey, row]));
  const pushedModuleIds = [...new Set(rows.map(row => row.moduleId))];
  const feedByModule = new Map(await Promise.all(pushedModuleIds.map(async moduleId => [moduleId, await getPublicModuleFeed(moduleId)] as const)));
  return runs.map(run => ({
    ...run,
    pushRecords: run.pushRecords.map(record => {
      const receipts = (record.receipts as any[]).map(receipt => {
        const blockedRetry = normalizeDuplicateScraplingReceipt(receipt);
        if (blockedRetry) return blockedRetry;
        const row = byKey.get(String(receipt?.contentKey ?? ""));
        if (!row) return receipt;
        const payload = row.targetPayload && typeof row.targetPayload === "object" ? row.targetPayload as Record<string, any> : {};
        const stored = payload.deliveryReceipt && typeof payload.deliveryReceipt === "object" ? payload.deliveryReceipt as Record<string, any> : {};
        const publicItem = toPublicFeedItem({ ...row, payload: row.targetPayload });
        const currentFeed = feedByModule.get(row.moduleId)?.items ?? [];
        const semanticallyBlocked = Boolean(publicItem && !currentFeed.some(item => item.deliveryKey === row.contentKey)
          && currentFeed.some(item => isNearDuplicatePublicContent(publicItem.body, item.body)));
        const qualityBlocked = !publicItem;
        if (semanticallyBlocked || qualityBlocked) {
          const qualityReason = publicContentRejectionReason({
            title: row.title,
            body: row.body,
            sourceReference: row.sourceReference,
          });
          return {
            ...receipt,
            ...stored,
            duplicateBlocked: true,
            deliveryAction: "duplicate_blocked",
            currentStatus: "duplicate_blocked",
            sentCount: 0,
            successCount: 0,
            pendingCount: 0,
            failureCount: 0,
            feedVisible: false,
            failureReason: semanticallyBlocked
              ? "规范化来源或相似正文已在该前端模块保留唯一版本，本条未重复展示。"
              : qualityReason || "正文清洗后未达到前端可读标准，本条未进入前端。",
            acknowledgedClients: Array.isArray(stored.acknowledgedClients) ? stored.acknowledgedClients : receipt.acknowledgedClients ?? [],
            acknowledgedTerminals: Array.isArray(stored.acknowledgedTerminals) ? stored.acknowledgedTerminals : receipt.acknowledgedTerminals ?? [],
          };
        }
        return {
          ...receipt,
          ...stored,
          currentStatus: stored.currentStatus ?? receipt.currentStatus,
          failureReason: row.errorDetail ?? stored.failureReason ?? receipt.failureReason ?? null,
          acknowledgedClients: Array.isArray(stored.acknowledgedClients) ? stored.acknowledgedClients : receipt.acknowledgedClients ?? [],
          acknowledgedTerminals: Array.isArray(stored.acknowledgedTerminals) ? stored.acknowledgedTerminals : receipt.acknowledgedTerminals ?? [],
        };
      });
      const activeReceipts = receipts.filter(receipt => receipt.currentStatus !== "duplicate_blocked");
      const status = record.status === "failed" || record.error
        ? "failed" as const
        : receipts.length && !activeReceipts.length
        ? "duplicate_blocked" as const
        : activeReceipts.length && activeReceipts.every(receipt => receipt.currentStatus === "front_acknowledged")
          ? "front_acknowledged" as const
          : activeReceipts.some(receipt => receipt.currentStatus === "failed")
          ? "failed" as const
          : "waiting_front_ack" as const;
      return {
        ...record,
        receipts,
        status,
        expectedDeliveryCount: receipts.reduce((sum, receipt) => sum + Number(receipt.sentCount ?? 0), 0),
        duplicateBlockedCount: receipts.filter(receipt => receipt.currentStatus === "duplicate_blocked").length,
      };
    }),
  }));
}

export async function getScraplingDashboard(actorUserId?: number) {
  const [health, runs] = await Promise.all([getScraplingHealth(), listScraplingRuns()]);
  const db = await getDb();
  const recipients = db ? await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).orderBy(users.id) : [];
  return {
    health,
    runs,
    modules: ADMIN_DATA_MODULES.map(module => ({ id: module.id, name: module.name, path: module.path, domain: module.domain })),
    deliveryAudience: {
      type: "users",
      label: "当前唯一前端实例的指定已登记用户",
      frontendId: "finance-terminal-primary",
      environmentId: process.env.NODE_ENV === "production" ? "production" : "local-preview",
      tenantId: "default",
      recipientCount: recipients.length,
      currentUserId: actorUserId ?? null,
      recipients: recipients.map(user => ({ userId: user.id, name: user.name || `账户 ${user.id}`, email: user.email || null, role: user.role, lastSignedIn: user.lastSignedIn })),
    },
    counts: {
      total: runs.length,
      running: runs.filter(run => run.status === "running" || run.status === "queued").length,
      completed: runs.filter(run => run.status === "completed").length,
      failed: runs.filter(run => run.status === "failed").length,
      duplicate: runs.filter(run => Boolean(run.duplicateOf)).length,
      pushed: runs.reduce((total, run) => total + run.pushRecords.length, 0),
    },
  };
}

export async function inspectScraplingSource(url: string) {
  return runBridgeOnce({ action: "inspect_source", url }, 25_000);
}

export async function pauseScraplingRun(runId: string) {
  const run = (await readState()).runs.find(item => item.runId === runId);
  if (!run) throw new Error("SCRAPLING_RUN_NOT_FOUND");
  if (run.status !== "running" || !activeJobs.has(runId)) throw new Error("SCRAPLING_RUN_NOT_RUNNING");
  await writeFile(path.join(runDirectory(runId), "pause.requested"), now(), "utf8");
  return mutateRun(runId, item => {
    item.error = "已请求安全暂停；当前响应完成后写入 checkpoint。";
    item.errorType = "PAUSE_REQUESTED";
  });
}

export async function cancelScraplingRun(runId: string) {
  const child = activeJobs.get(runId);
  if (!child) throw new Error("SCRAPLING_RUN_NOT_RUNNING");
  activeJobs.delete(runId);
  child.kill();
  return mutateRun(runId, run => {
    run.status = "cancelled";
    run.completedAt = now();
    run.error = "管理员取消运行";
    run.errorType = "CANCELLED_BY_OPERATOR";
  });
}

export async function resumeScraplingRun(runId: string, actorUserId: number) {
  const state = await readState();
  const previous = state.runs.find(item => item.runId === runId);
  if (!previous) throw new Error("SCRAPLING_RUN_NOT_FOUND");
  if (previous.status !== "paused" && previous.status !== "failed") throw new Error("SCRAPLING_RUN_NOT_RESUMABLE");
  await rm(path.join(runDirectory(runId), "pause.requested"), { force: true });
  previous.actorUserId = actorUserId;
  previous.status = "running";
  previous.startedAt = now();
  previous.completedAt = null;
  previous.updatedAt = previous.startedAt;
  previous.error = null;
  previous.errorType = null;
  previous.stderr = "";
  await persistState(state);
  spawnRun(previous);
  return previous;
}

export async function parseScraplingRun(input: { runId: string; itemIndex: number; selectorType: "css" | "xpath"; selector: string; adaptive: boolean }) {
  const run = (await readState()).runs.find(item => item.runId === input.runId);
  const item = run?.result?.items?.[input.itemIndex];
  if (!run || !item) throw new Error("SCRAPLING_RESULT_ITEM_NOT_FOUND");
  return runBridgeOnce({
    action: "parse_artifact",
    artifactPath: item.artifactPath,
    artifactDir: path.join(runDirectory(input.runId), "artifacts"),
    sourceUrl: item.url.startsWith("http") ? item.url : run.input.urls[0],
    selectorType: input.selectorType,
    selector: input.selector,
    adaptive: input.adaptive,
  });
}

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function xmlEscape(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function exportScraplingRun(runId: string, format: "json" | "jsonl" | "csv" | "xml") {
  const run = (await readState()).runs.find(item => item.runId === runId);
  if (!run?.result?.items?.length) throw new Error("SCRAPLING_RUN_HAS_NO_EXPORTABLE_RESULT");
  const items = run.result.items;
  if (format === "json") return { fileName: `${runId}.json`, mime: "application/json", content: JSON.stringify(items, null, 2) };
  if (format === "jsonl") return { fileName: `${runId}.jsonl`, mime: "application/x-ndjson", content: items.map(item => JSON.stringify(item)).join("\n") };
  if (format === "csv") {
    const fields = ["url", "status", "title", "contentHash", "contentType", "bytes", "linkCount", "text"] as const;
    return { fileName: `${runId}.csv`, mime: "text/csv;charset=utf-8", content: [fields.join(","), ...items.map(item => fields.map(field => csvEscape(item[field])).join(","))].join("\r\n") };
  }
  return { fileName: `${runId}.xml`, mime: "application/xml", content: `<?xml version="1.0" encoding="UTF-8"?>\n<items>${items.map(item => `\n  <item><url>${xmlEscape(item.url)}</url><status>${item.status}</status><title>${xmlEscape(item.title)}</title><contentHash>${item.contentHash}</contentHash><text>${xmlEscape(item.text)}</text></item>`).join("")}\n</items>` };
}

export async function pushScraplingRun(input: { runId: string; moduleIds: string[]; recipientUserIds: number[]; actorUserId: number; operator: string }) {
  const state = await readState();
  const run = state.runs.find(item => item.runId === input.runId);
  if (!run?.result?.items?.length || run.status !== "completed") throw new Error("SCRAPLING_RUN_NOT_READY_FOR_PUSH");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE: 已完成采集仍保存在 Scrapling 模块；配置 DATABASE_URL 后才能进入前端 ACK 链路");
  const moduleIds = [...new Set(input.moduleIds)].filter(id => ADMIN_DATA_MODULES.some(module => module.id === id));
  if (!moduleIds.length) throw new Error("SCRAPLING_PUSH_MODULE_SELECTION_REQUIRED");
  const data: Array<{ uuid: string; collection: "finance_world_dataset" }> = [];
  const preparedItems = prepareScraplingItemsForDelivery(run.result.items);
  const deliverableItems = preparedItems.filter(item => !item.duplicateOfContentHash && !item.qualityRejectionReason && item.status >= 200 && item.status < 300 && item.cleanedBody.length >= 80);
  if (!deliverableItems.length) throw new Error("SCRAPLING_PUSH_NO_QUALIFIED_UNIQUE_CONTENT");
  const contentItems = deliverableItems.map(item => {
    let sourceName = "未知来源";
    try { sourceName = new URL(item.url.startsWith("http") ? item.url : run.input.urls[0]).hostname; } catch { /* keep explicit fallback */ }
    const body = item.cleanedBody;
    return {
      contentId: `scrdata_${item.contentHash.slice(0, 54)}`,
      title: item.title || `公开来源采集 · ${sourceName}`,
      body,
      sourceUrl: item.url.startsWith("http") ? item.url : run.input.urls[0],
      sourceName,
      contentHash: item.contentHash,
      collectedAt: run.completedAt || run.updatedAt,
      dataQuality: item.status >= 200 && item.status < 300 && body.length >= 80 ? "L2" : "L4",
      duplicateStatus: run.duplicateOf ? `重复运行：${run.duplicateOf}` : "唯一内容",
    };
  });
  const moduleTargets = moduleIds.map(moduleId => {
    const module = ADMIN_DATA_MODULES.find(item => item.id === moduleId)!;
    return { moduleId, name: module.name, path: module.path, domain: module.domain };
  });
  for (const item of deliverableItems) {
    const uuid = `scrdata_${item.contentHash.slice(0, 54)}`;
    const title = item.title || `公开来源采集 · ${new URL(run.input.urls[0]).hostname}`;
    const body = item.cleanedBody;
    const rawContent = JSON.stringify({ title, body, selected: item.selected, contentHash: item.contentHash, rawContentHash: item.rawContentHash ?? null, cleaningVersion: item.cleaningVersion ?? "2026-09-11.preview-v2", removedNoiseNodes: item.removedNoiseNodes ?? null, httpStatus: item.status });
    const financeArrayJson = { title, body, contentHash: item.contentHash, rawContentHash: item.rawContentHash ?? null, cleaningVersion: item.cleaningVersion ?? "2026-09-11.preview-v2", removedNoiseNodes: item.removedNoiseNodes ?? null, selector: item.selector, httpStatus: item.status, collectedBy: "Scrapling 0.4.15" };
    const tagList = ["Scrapling", run.input.mode, run.input.taskKind, item.contentType || "unknown"];
    const dataQualityLevel = item.status >= 200 && item.status < 300 && body.length >= 80 ? "L2" : "L4";
    await db.insert(financeWorldDataset).values({
      uuid,
      dataTopType: "Scrapling采集",
      dataSubType: run.input.taskKind === "crawl" ? "站点Spider" : run.input.mode === "dynamic" ? "动态页面" : "静态页面",
      sourceUrl: item.url.startsWith("http") ? item.url : run.input.urls[0],
      sourceName: new URL(run.input.urls[0]).hostname,
      sourceLanguage: run.input.language || null,
      rawContent,
      aiProcessContent: body,
      assetType: "public_web_content",
      financeArrayJson,
      tagList,
      candidatePushModuleIds: moduleIds,
      dataQualityLevel,
      archiveSnapshot: item.artifactPath,
    }).onDuplicateKeyUpdate({ set: {
      dataTopType: "Scrapling采集",
      dataSubType: run.input.taskKind === "crawl" ? "站点Spider" : run.input.mode === "dynamic" ? "动态页面" : "静态页面",
      sourceUrl: item.url.startsWith("http") ? item.url : run.input.urls[0],
      sourceName: new URL(run.input.urls[0]).hostname,
      sourceLanguage: run.input.language || null,
      rawContent,
      aiProcessContent: body,
      assetType: "public_web_content",
      financeArrayJson,
      tagList,
      candidatePushModuleIds: moduleIds,
      dataQualityLevel,
      archiveSnapshot: item.artifactPath,
      updateTime: new Date(),
    } });
    data.push({ uuid, collection: "finance_world_dataset" });
  }
  try {
    const delivery = await manuallyPushSpiderData({ actorUserId: input.actorUserId, operator: input.operator, data, moduleIds, recipientUserIds: input.recipientUserIds });
    const receipts = Array.isArray(delivery.deliveryReceipts) ? delivery.deliveryReceipts : [];
    const activeReceipts = receipts.filter((receipt: any) => !receipt.duplicateBlocked && receipt.currentStatus !== "duplicate_blocked");
    const status = receipts.length && !activeReceipts.length
      ? "duplicate_blocked"
      : activeReceipts.length && activeReceipts.every((receipt: any) => receipt.currentStatus === "front_acknowledged")
        ? "front_acknowledged"
        : "waiting_front_ack";
    const audience = (delivery as any).targetAudience;
    const idempotencyKey = scraplingPushIdempotencyKey({ runId: input.runId, moduleIds, recipientUserIds: input.recipientUserIds, dataUuids: data.map(item => item.uuid) });
    const record: ScraplingPushRecord = { pushId: createScraplingPushId(), idempotencyKey, runId: input.runId, createdAt: now(), sentAt: now(), moduleIds, moduleTargets, contentItems, audience, expectedRecipientCount: audience?.recipientCount ?? 0, expectedDeliveryCount: receipts.reduce((sum: number, receipt: any) => sum + Number(receipt.sentCount ?? 0), 0), status, receipts };
    run.pushRecords.unshift(record);
    run.updatedAt = now();
    await persistState(state);
    return record;
  } catch (error) {
    const conciseError = conciseScraplingPushError(error);
    const idempotencyKey = scraplingPushIdempotencyKey({ runId: input.runId, moduleIds, recipientUserIds: input.recipientUserIds, dataUuids: data.map(item => item.uuid) });
    const record: ScraplingPushRecord = { pushId: createScraplingPushId(), idempotencyKey, runId: input.runId, createdAt: now(), sentAt: now(), moduleIds, moduleTargets, contentItems, expectedRecipientCount: 0, expectedDeliveryCount: 0, status: "failed", receipts: [], error: conciseError };
    run.pushRecords.unshift(record);
    run.updatedAt = now();
    await persistState(state);
    throw new Error(conciseError);
  }
}

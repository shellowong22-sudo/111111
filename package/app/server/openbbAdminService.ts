import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { users } from '../drizzle/schema';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';
import { getDb } from './db';
import {
  deliverOpenBBDataset,
  hydrateOpenBBPushRecord,
  inspectOpenBBApi,
  type OpenBBPushRecord,
  type OpenBBResult,
} from './openbbPriorityAService';

type OpenBBJobStatus = 'not_configured' | 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled';
export type OpenBBJob = {
  jobId: string;
  status: OpenBBJobStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  archivePath: string;
  archiveSha256: string;
  entryCount: number;
  command: string | null;
  log: string[];
  error: string | null;
  resultSummary: Record<string, unknown> | null;
  push: OpenBBPushRecord | null;
  lastPushAttempt?: OpenBBPushRecord | null;
};

type OpenBBState = { schemaVersion: 1; jobs: OpenBBJob[] };

const APP_ROOT = process.cwd();
const OPENBB_ROOT = path.join(APP_ROOT, 'vendor', 'OpenBB-develop');
const ZIP_PATH = path.join(OPENBB_ROOT, 'OpenBB-develop.zip');
const MANIFEST_PATH = path.join(OPENBB_ROOT, 'manifest.json');
const STATE_ROOT = path.join(APP_ROOT, '.runtime', 'openbb-admin');
const STATE_PATH = path.join(STATE_ROOT, 'state.json');
const STALE_RUNNING_MS = 5 * 60 * 1000;
let writeChain: Promise<void> = Promise.resolve();

const now = () => new Date().toISOString();
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const unique = <T,>(values: T[]) => [...new Set(values)];
const ARCHIVE_MANIFEST_FALLBACK = { root: 'OpenBB-develop/', entries: [], excerpts: {} };
const OPENBB_EXTENSIONS = ['commodity', 'crypto', 'currency', 'derivatives', 'econometrics', 'economy', 'equity', 'etf', 'famafrench', 'fixedincome', 'index', 'news', 'quantitative', 'regulators', 'technical'];
const OPENBB_PROVIDERS = ['alpha_vantage', 'benzinga', 'biztoc', 'bls', 'cboe', 'cftc', 'congress_gov', 'deribit', 'ecb', 'econdb', 'eia', 'famafrench', 'federal_reserve', 'finra', 'finviz', 'fmp', 'fred', 'government_us', 'imf', 'intrinio', 'multpl', 'nasdaq', 'oecd', 'sec', 'seeking_alpha', 'stockgrid', 'tiingo', 'tmx', 'tradier', 'tradingeconomics', 'wsj', 'yfinance'];
const OPENBB_API_ROUTES = ['/', '/openapi.json', '/docs', '/widgets.json', '/apps.json', '/agents.json', '/api/v1/system', '/api/v1/user'];

async function exists(filePath: string) {
  try { await access(filePath); return true; }
  catch { return false; }
}

async function readState(): Promise<OpenBBState> {
  await mkdir(STATE_ROOT, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(STATE_PATH, 'utf8')) as Partial<OpenBBState>;
    return { schemaVersion: 1, jobs: Array.isArray(parsed.jobs) ? parsed.jobs.slice(0, 100) as OpenBBJob[] : [] };
  } catch {
    return { schemaVersion: 1, jobs: [] };
  }
}

async function persist(state: OpenBBState) {
  const temp = `${STATE_PATH}.${randomUUID()}.tmp`;
  writeChain = writeChain.then(async () => {
    await writeFile(temp, JSON.stringify({ ...state, jobs: state.jobs.slice(0, 100) }, null, 2), 'utf8');
    await rename(temp, STATE_PATH);
  });
  await writeChain;
}

async function sha256File(filePath: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) digest.update(chunk as Buffer);
  return digest.digest('hex');
}

export function repairInterruptedOpenBBJobs(jobs: OpenBBJob[], at = Date.now()) {
  let changed = false;
  const repaired = jobs.map((job) => {
    const started = job.startedAt ? Date.parse(job.startedAt) : Date.parse(job.createdAt);
    if (job.status !== 'running' || !Number.isFinite(started) || at - started <= STALE_RUNNING_MS) return job;
    changed = true;
    return {
      ...job,
      status: 'failed' as const,
      completedAt: new Date(at).toISOString(),
      error: 'OPENBB_JOB_INTERRUPTED',
      log: [...job.log, '服务进程在任务完成前中断；没有记录成功结果，可安全重试。'],
    };
  });
  return { jobs: repaired, changed };
}

async function hydratedState() {
  const state = await readState();
  const repaired = repairInterruptedOpenBBJobs(state.jobs);
  if (repaired.changed) {
    state.jobs = repaired.jobs;
    await persist(state);
  }
  const jobs = await Promise.all(state.jobs.map(async (job) => ({ ...job, push: await hydrateOpenBBPushRecord(job.push) })));
  return { ...state, jobs };
}

export async function getOpenBBDashboard(actorUserId?: number) {
  const archivePresent = await exists(ZIP_PATH);
  const bundledApi = process.platform === 'win32'
    ? path.join(APP_ROOT, '.venv-openbb', 'Scripts', 'openbb-api.exe')
    : path.join(APP_ROOT, '.venv-openbb', 'bin', 'openbb-api');
  const bundledRuntimePresent = await exists(bundledApi);
  let manifest: any = null;
  if (await exists(MANIFEST_PATH)) {
    try { manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')); }
    catch { manifest = null; }
  }
  const state = await hydratedState();
  const db = await getDb();
  const recipientRows = db ? await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users) : [];
  const recipients = actorUserId
    ? [...recipientRows].sort((left, right) => Number(right.id === actorUserId) - Number(left.id === actorUserId))
    : recipientRows;
  return {
    archive: {
      present: archivePresent,
      path: archivePresent ? ZIP_PATH : null,
      sha256: manifest?.archiveSha256 ?? null,
      entryCount: manifest?.entryCount ?? 0,
      auditedAt: manifest?.auditedAt ?? null,
      licensePresent: Boolean(manifest?.excerpts?.['OpenBB-develop/LICENSE']),
      readmePresent: Boolean(manifest?.excerpts?.['OpenBB-develop/README.md']),
    },
    jobs: state.jobs,
    capabilities: {
      archivePreservedVerbatim: true,
      executionPolicy: '仅执行白名单的 OpenBB HTTP 入口和只读归档校验；不会执行压缩包安装脚本。',
      pythonConfigured: Boolean(process.env.OPENBB_PYTHON) || bundledRuntimePresent,
      apiConfigured: Boolean(process.env.OPENBB_API_URL) || bundledRuntimePresent,
      bundledRuntimePresent,
    },
    audience: {
      frontendId: 'finance-terminal-primary',
      environmentId: process.env.NODE_ENV === 'production' ? 'production' : 'local-preview',
      tenantId: 'default',
      currentUserId: actorUserId ?? null,
      recipients,
    },
    software: {
      name: 'OpenBB Data Platform',
      version: '4.7.2',
      entrypoints: ['openbb-api', 'openbb'],
      apiRoutes: OPENBB_API_ROUTES,
      extensions: OPENBB_EXTENSIONS,
      providers: OPENBB_PROVIDERS,
      desktopRoutes: ['/', '/setup', '/environments', '/backends', '/backend-logs', '/jupyter-logs', '/api-keys', '/installation-progress', '/uninstall'],
    },
    modules: ADMIN_DATA_MODULES.map((module) => ({ id: module.id, name: module.name, path: module.path, domain: module.domain })),
    archivePreview: {
      root: manifest?.root ?? ARCHIVE_MANIFEST_FALLBACK.root,
      entries: Array.isArray(manifest?.entries) ? manifest.entries.slice(0, 180) : ARCHIVE_MANIFEST_FALLBACK.entries,
      readmeExcerpt: manifest?.excerpts?.['OpenBB-develop/README.md'] ?? '',
      licenseExcerpt: manifest?.excerpts?.['OpenBB-develop/LICENSE'] ?? '',
    },
  };
}

export async function startOpenBBJob(actorUserId: number) {
  const dashboard = await getOpenBBDashboard(actorUserId);
  const stamp = now();
  const state = await readState();
  const job: OpenBBJob = {
    jobId: `obb_${randomUUID().replaceAll('-', '')}`,
    status: dashboard.archive.present ? 'running' : 'not_configured',
    createdAt: stamp,
    startedAt: dashboard.archive.present ? stamp : null,
    completedAt: dashboard.archive.present ? null : stamp,
    archivePath: dashboard.archive.path ?? ZIP_PATH,
    archiveSha256: dashboard.archive.sha256 ?? '',
    entryCount: dashboard.archive.entryCount,
    command: dashboard.archive.present ? 'GET / + GET /openapi.json + SHA-256 OpenBB-develop.zip' : null,
    log: [],
    error: dashboard.archive.present ? null : 'OPENBB_ARCHIVE_NOT_FOUND',
    resultSummary: null,
    push: null,
    lastPushAttempt: null,
  };
  state.jobs.unshift(job);
  await persist(state);
  if (!dashboard.archive.present) return job;

  try {
    job.log.push('已进入受控只读检查：API 根端点、OpenAPI 合同和原始 ZIP 完整性。');
    const [inspection, actualArchiveSha256] = await Promise.all([inspectOpenBBApi(true), sha256File(ZIP_PATH)]);
    const completedAt = now();
    const archiveVerified = Boolean(job.archiveSha256) && actualArchiveSha256 === job.archiveSha256;
    job.completedAt = completedAt;
    job.resultSummary = {
      actorUserId,
      checkedAt: inspection.runtime.checkedAt,
      apiBaseUrl: inspection.runtime.api.baseUrl,
      apiReachable: inspection.runtime.api.reachable,
      apiStatusCode: inspection.runtime.api.statusCode,
      apiLatencyMs: inspection.runtime.api.latencyMs,
      apiError: inspection.runtime.api.error,
      openApiReachable: inspection.openapi.reachable,
      openApiStatusCode: inspection.openapi.statusCode,
      openApiTitle: inspection.openapi.title,
      openApiVersion: inspection.openapi.version,
      openApiPathCount: inspection.openapi.pathCount,
      openApiTagCount: inspection.openapi.tagCount,
      openApiChecksum: inspection.openapi.checksum,
      openApiError: inspection.openapi.error,
      archiveExpectedSha256: job.archiveSha256,
      archiveActualSha256: actualArchiveSha256,
      archiveVerified,
      archiveEntryCount: job.entryCount,
      completedAt,
    };
    job.log.push(`归档 SHA-256 ${archiveVerified ? '校验通过' : '校验失败'}：${actualArchiveSha256}`);
    if (!archiveVerified) {
      job.status = 'failed';
      job.error = 'OPENBB_ARCHIVE_CHECKSUM_MISMATCH';
      job.log.push('归档完整性不匹配；禁止将本次任务标记为成功或推送。');
    } else if (!inspection.runtime.api.reachable) {
      job.status = dashboard.capabilities.apiConfigured || dashboard.capabilities.pythonConfigured ? 'failed' : 'not_configured';
      job.error = `OPENBB_API_UNAVAILABLE:${inspection.runtime.api.error ?? 'UNKNOWN'}`;
      job.log.push('OpenBB API 不可访问；未生成金融数据，也未显示假成功。');
    } else if (!inspection.openapi.reachable) {
      job.status = 'partial';
      job.error = `OPENBB_OPENAPI_PARTIAL:${inspection.openapi.error ?? 'UNKNOWN'}`;
      job.log.push(`API 根端点 HTTP ${inspection.runtime.api.statusCode} 可用，但 OpenAPI 合同读取失败。`);
    } else {
      job.status = 'succeeded';
      job.error = null;
      job.log.push(`OpenBB API HTTP ${inspection.runtime.api.statusCode}，延迟 ${inspection.runtime.api.latencyMs}ms；OpenAPI 共 ${inspection.openapi.pathCount} 条路径、${inspection.openapi.tagCount} 个标签。`);
    }
  } catch (error) {
    job.status = 'failed';
    job.completedAt = now();
    job.error = error instanceof Error ? error.message : 'OPENBB_JOB_FAILED';
    job.log.push('受控检查失败；未将任务标记为成功。');
  }

  const latest = await readState();
  const stored = latest.jobs.find((item) => item.jobId === job.jobId);
  if (!stored) throw new Error('OPENBB_JOB_STATE_LOST');
  if (stored.status === 'cancelled') return stored;
  Object.assign(stored, job);
  await persist(latest);
  return stored;
}

export async function cancelOpenBBJob(jobId: string) {
  const state = await readState();
  const job = state.jobs.find((item) => item.jobId === jobId);
  if (!job) throw new Error('OPENBB_JOB_NOT_FOUND');
  if (job.status !== 'queued' && job.status !== 'running') throw new Error('OPENBB_JOB_NOT_CANCELLABLE');
  job.status = 'cancelled';
  job.completedAt = now();
  job.error = '管理员取消任务';
  job.log.push('任务已取消；未执行压缩包内脚本。');
  await persist(state);
  return job;
}

export async function retryOpenBBJob(jobId: string, actorUserId: number) {
  const state = await readState();
  if (!state.jobs.some((job) => job.jobId === jobId)) throw new Error('OPENBB_JOB_NOT_FOUND');
  return startOpenBBJob(actorUserId);
}

function summaryValue(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return value === null || value === undefined ? '—' : String(value);
}

export function buildOpenBBRuntimeDataset(job: OpenBBJob): OpenBBResult {
  if (!job.resultSummary || !job.completedAt || (job.status !== 'succeeded' && job.status !== 'partial')) throw new Error('OPENBB_JOB_NOT_READY_FOR_PUSH');
  const summary = job.resultSummary;
  const rows = [
    { check: 'OpenBB API', status: summary.apiReachable ? 'available' : 'unavailable', value: `HTTP ${summaryValue(summary, 'apiStatusCode')} · ${summaryValue(summary, 'apiLatencyMs')}ms`, source: summaryValue(summary, 'apiBaseUrl'), observedAt: summaryValue(summary, 'checkedAt') },
    { check: 'OpenAPI contract', status: summary.openApiReachable ? 'verified' : 'partial', value: `${summaryValue(summary, 'openApiPathCount')} paths · ${summaryValue(summary, 'openApiTagCount')} tags`, source: `${summaryValue(summary, 'openApiTitle')} ${summaryValue(summary, 'openApiVersion')}`.trim(), observedAt: job.completedAt },
    { check: 'Archive SHA-256', status: summary.archiveVerified ? 'verified' : 'failed', value: summaryValue(summary, 'archiveActualSha256'), source: path.basename(job.archivePath), observedAt: job.completedAt },
    { check: 'Archive manifest', status: job.entryCount > 0 ? 'verified' : 'empty', value: `${job.entryCount} entries`, source: 'manifest.json', observedAt: job.completedAt },
  ];
  const checksum = sha256(JSON.stringify({ jobId: job.jobId, rows }));
  return {
    endpointId: 'openbb_runtime_audit',
    label: 'OpenBB 运行与归档验证',
    params: { jobId: job.jobId },
    columns: ['check', 'status', 'value', 'source', 'observedAt'],
    rows,
    fields: [
      { fieldId: 'check', dataType: 'string', role: 'dimension', nonNullCount: rows.length, nullCount: 0 },
      { fieldId: 'status', dataType: 'string', role: 'dimension', nonNullCount: rows.length, nullCount: 0 },
      { fieldId: 'value', dataType: 'string', role: 'dimension', nonNullCount: rows.length, nullCount: 0 },
      { fieldId: 'source', dataType: 'string', role: 'dimension', nonNullCount: rows.length, nullCount: 0 },
      { fieldId: 'observedAt', dataType: 'datetime', role: 'time', nonNullCount: rows.length, nullCount: 0 },
    ],
    metadata: {
      provider: 'OpenBB local API + preserved archive',
      queriedAt: job.completedAt,
      observedAt: job.completedAt,
      rangeStart: typeof summary.checkedAt === 'string' ? summary.checkedAt : job.completedAt,
      rangeEnd: job.completedAt,
      timezone: 'UTC',
      rowCount: rows.length,
      truncated: false,
      numericFieldCount: 0,
      nullCellCount: 0,
      nullRate: 0,
      quality: 'provider_response',
      realtimeStatus: 'provider_defined',
      schemaVersion: 'openbb-query-v1',
      checksum,
    },
  };
}

export async function pushOpenBBJob(input: { jobId: string; moduleIds: string[]; recipientUserIds: number[]; actorUserId: number; operator: string }) {
  const state = await readState();
  const job = state.jobs.find((item) => item.jobId === input.jobId);
  if (!job) throw new Error('OPENBB_JOB_NOT_FOUND');
  const dataset = buildOpenBBRuntimeDataset(job);
  const delivery = await deliverOpenBBDataset({
    dataset,
    sourceRunId: job.jobId,
    moduleIds: unique(input.moduleIds),
    recipientUserIds: unique(input.recipientUserIds),
    actorUserId: input.actorUserId,
    operator: input.operator,
    eventType: 'openbb.runtime.audit.publish',
    title: `OpenBB 运行验证 · ${job.completedAt}`,
    contentPreview: `OpenBB API、OpenAPI 合同与归档完整性验证；${job.entryCount} 个归档条目。`,
  });
  const { frontendId, targetModules, recipients, ackRequired, ...push } = delivery;
  job.lastPushAttempt = push;
  if (push.status !== 'duplicate_blocked' || !job.push?.contentKeys.length) job.push = push;
  await persist(state);
  return { ...push, frontendId, targetModules, recipients, ackRequired, duplicateOfPushId: push.status === 'duplicate_blocked' ? push.duplicateOfPushIds?.[0] ?? job.push?.pushId ?? null : null };
}

/**
 * Legacy callers may ask to acknowledge a push, but supplied timestamps and
 * status are never trusted. Only receipts written by acknowledgePublicFeeds
 * after an authenticated terminal actually renders the content can advance it.
 */
export async function ackOpenBBPush(input: { jobId: string; pushId: string; status: string; receivedAt: string; appliedAt?: string }) {
  const state = await readState();
  const job = state.jobs.find((item) => item.jobId === input.jobId);
  if (!job?.push || job.push.pushId !== input.pushId) throw new Error('OPENBB_PUSH_NOT_FOUND');
  const hydrated = await hydrateOpenBBPushRecord(job.push);
  if (!hydrated) throw new Error('OPENBB_PUSH_NOT_FOUND');
  job.push = hydrated;
  await persist(state);
  return { ...hydrated, verification: hydrated.status === 'front_acknowledged' ? 'database_render_receipt' : 'awaiting_database_render_receipt' };
}

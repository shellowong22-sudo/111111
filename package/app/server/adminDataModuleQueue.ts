import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, lt, lte, or } from 'drizzle-orm';
import {
  adminDataModuleAutomationRunItems,
  adminDataModuleAutomationRuns,
  adminDataModuleAutomationStepEvents,
  adminDataModuleExecutionLocks,
  adminDataModuleRequestCache,
  adminDataModuleSystemSettings,
  type AdminDataModuleProfile,
} from '../drizzle/schema';
import { getDb } from './db';

type RunRow = typeof adminDataModuleAutomationRuns.$inferSelect;
type RunItemRow = typeof adminDataModuleAutomationRunItems.$inferSelect;

type QueueItemStatus = 'queued' | 'claimed' | 'running' | 'pending_review' | 'pending_delivery' | 'completed' | 'skipped' | 'failed' | 'cancelled';
type StepEventStatus = 'started' | 'success' | 'failed' | 'skipped' | 'cancelled';
type TerminalItemStatus = Extract<QueueItemStatus, 'completed' | 'skipped' | 'failed' | 'cancelled'>;

const TERMINAL_ITEM_STATUSES: TerminalItemStatus[] = ['completed', 'skipped', 'failed', 'cancelled'];
const LEASE_MS = 105_000;
const MAX_BATCH_SIZE = 8;
const ITEM_EXECUTION_TIMEOUT_MS = 100_000;

function resultAffectedRows(result: unknown): number {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (!candidate || typeof candidate !== 'object') return 0;
  const value = Reflect.get(candidate, 'affectedRows');
  return typeof value === 'number' ? value : 0;
}

function taskItemKey(runKey: string, moduleId: string) {
  return `moditem_${runKey.slice(7, 23)}_${moduleId}_${randomUUID().replaceAll('-', '').slice(0, 12)}`.slice(0, 160);
}

function retryDelayMs(attemptCount: number) {
  return Math.min(15 * 60_000, 30_000 * Math.max(1, 2 ** Math.min(attemptCount, 5)));
}

async function getRunByKey(runKey: string) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select().from(adminDataModuleAutomationRuns).where(eq(adminDataModuleAutomationRuns.runKey, runKey)).limit(1);
  return rows[0] ?? null;
}

export async function createAdminDataModuleRunItems(input: { run: RunRow; profiles: AdminDataModuleProfile[] }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (!input.profiles.length) return { queued: 0 };
  const now = new Date();
  await db.insert(adminDataModuleAutomationRunItems).values(input.profiles.map((profile) => ({
    itemKey: taskItemKey(input.run.runKey, profile.moduleId),
    runId: input.run.id,
    moduleId: profile.moduleId,
    status: 'queued' as const,
    currentStep: 'queued_for_persistent_worker',
    priority: profile.executionPriority,
    maxAttempts: Math.max(1, profile.retryLimit + 1),
    idempotencyKey: `${input.run.runKey}:${profile.moduleId}`.slice(0, 190),
    createdAt: now,
    updatedAt: now,
  }))).onDuplicateKeyUpdate({
    set: { updatedAt: now },
  });
  await db.insert(adminDataModuleAutomationStepEvents).values(input.profiles.map((profile) => ({
    runId: input.run.id,
    moduleId: profile.moduleId,
    step: 'queued',
    action: 'enqueue',
    status: 'success' as const,
    detail: '已创建数据库持久任务项；等待管理员请求或经认证的计划回调领取，不依赖内存 worker。',
    actorUserId: input.run.actorUserId,
  })));
  return { queued: input.profiles.length };
}

async function acquireLease(lockKey: string, ownerKind: string, leaseMs = LEASE_MS) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const leaseToken = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);
  const reclaimed = await db.update(adminDataModuleExecutionLocks)
    .set({ leaseToken, ownerKind, expiresAt, updatedAt: now })
    .where(and(eq(adminDataModuleExecutionLocks.lockKey, lockKey), lte(adminDataModuleExecutionLocks.expiresAt, now)));
  if (resultAffectedRows(reclaimed) > 0) return leaseToken;
  try {
    await db.insert(adminDataModuleExecutionLocks).values({ lockKey, leaseToken, ownerKind, expiresAt, acquiredAt: now, updatedAt: now });
    return leaseToken;
  } catch {
    return null;
  }
}

async function releaseLease(lockKey: string, leaseToken: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(adminDataModuleExecutionLocks).where(and(eq(adminDataModuleExecutionLocks.lockKey, lockKey), eq(adminDataModuleExecutionLocks.leaseToken, leaseToken)));
}

export async function withAdminDataModuleLease<T>(lockKey: string, ownerKind: string, operation: () => Promise<T>) {
  const leaseToken = await acquireLease(lockKey, ownerKind);
  if (!leaseToken) throw new Error('ADMIN_MODULE_EXECUTION_BUSY');
  try {
    return await operation();
  } finally {
    await releaseLease(lockKey, leaseToken);
  }
}

export async function withAdminDataModuleRequestCache<T extends Record<string, unknown>>(input: { cacheKey: string; ttlMs: number; operation: () => Promise<T> }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const now = new Date();
  const findReady = async () => (await db.select().from(adminDataModuleRequestCache).where(and(
    eq(adminDataModuleRequestCache.cacheKey, input.cacheKey),
    eq(adminDataModuleRequestCache.status, 'ready'),
    gte(adminDataModuleRequestCache.expiresAt, now),
  )).limit(1))[0] ?? null;
  const cached = await findReady();
  if (cached?.value && typeof cached.value === 'object' && !Array.isArray(cached.value)) return { value: cached.value as T, cache: 'hit' as const };
  const lockKey = `admin-module-request-cache:${input.cacheKey}`;
  const leaseToken = await acquireLease(lockKey, 'request_cache', Math.min(LEASE_MS, Math.max(30_000, input.ttlMs)));
  if (!leaseToken) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const joined = await findReady();
      if (joined?.value && typeof joined.value === 'object' && !Array.isArray(joined.value)) return { value: joined.value as T, cache: 'joined' as const };
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error('ADMIN_MODULE_REQUEST_COALESCED_RETRY');
  }
  try {
    const cacheAfterLease = await findReady();
    if (cacheAfterLease?.value && typeof cacheAfterLease.value === 'object' && !Array.isArray(cacheAfterLease.value)) return { value: cacheAfterLease.value as T, cache: 'joined' as const };
    const expiresAt = new Date(Date.now() + Math.max(30_000, input.ttlMs));
    await db.insert(adminDataModuleRequestCache).values({ cacheKey: input.cacheKey, status: 'pending', value: null, errorDetail: null, expiresAt, updatedAt: new Date() }).onDuplicateKeyUpdate({ set: { status: 'pending', value: null, errorDetail: null, expiresAt, updatedAt: new Date() } });
    const value = await input.operation();
    await db.update(adminDataModuleRequestCache).set({ status: 'ready', value, errorDetail: null, expiresAt, updatedAt: new Date() }).where(eq(adminDataModuleRequestCache.cacheKey, input.cacheKey));
    return { value, cache: 'miss' as const };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'ADMIN_MODULE_REQUEST_CACHE_OPERATION_FAILED';
    await db.update(adminDataModuleRequestCache).set({ status: 'failed', errorDetail: detail.slice(0, 1000), expiresAt: new Date(Date.now() + 30_000), updatedAt: new Date() }).where(eq(adminDataModuleRequestCache.cacheKey, input.cacheKey));
    throw error;
  } finally {
    await releaseLease(lockKey, leaseToken);
  }
}

export async function getAdminDataModuleSystemSettingValue<T extends Record<string, unknown>>(settingKey: string, fallback: T): Promise<T> {
  const db = await getDb();
  if (!db) return fallback;
  const row = (await db.select({ value: adminDataModuleSystemSettings.value }).from(adminDataModuleSystemSettings).where(eq(adminDataModuleSystemSettings.settingKey, settingKey)).limit(1))[0];
  if (!row?.value || typeof row.value !== 'object' || Array.isArray(row.value)) return fallback;
  return { ...fallback, ...(row.value as Record<string, unknown>) } as T;
}

function withItemTimeout<T>(operation: Promise<T>, timeoutMs = ITEM_EXECUTION_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('ADMIN_MODULE_ITEM_TIMEOUT')), timeoutMs)),
  ]);
}

async function logStep(input: { runId: number; jobItemId?: number; moduleId?: string; step: string; action: string; status: StepEventStatus; detail: string; durationMs?: number; actorUserId?: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(adminDataModuleAutomationStepEvents).values({
    runId: input.runId,
    jobItemId: input.jobItemId ?? null,
    moduleId: input.moduleId ?? null,
    step: input.step,
    action: input.action,
    status: input.status,
    detail: input.detail.slice(0, 1_800),
    durationMs: input.durationMs ?? null,
    actorUserId: input.actorUserId ?? null,
  });
}

export async function appendAdminDataModuleRunControlEvent(input: { runId: number; jobItemId?: number; moduleId?: string; step: string; action: string; status: StepEventStatus; detail: string; actorUserId: number }) {
  await logStep(input);
}

async function claimItems(run: RunRow, limit: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const now = new Date();
  const candidates = await db.select().from(adminDataModuleAutomationRunItems)
    .where(and(eq(adminDataModuleAutomationRunItems.runId, run.id), or(
      eq(adminDataModuleAutomationRunItems.status, 'queued'),
      and(eq(adminDataModuleAutomationRunItems.status, 'failed'), lte(adminDataModuleAutomationRunItems.retryAfter, now)),
      and(inArray(adminDataModuleAutomationRunItems.status, ['claimed', 'running']), lt(adminDataModuleAutomationRunItems.leaseExpiresAt, now)),
    )))
    .orderBy(desc(adminDataModuleAutomationRunItems.priority), asc(adminDataModuleAutomationRunItems.createdAt))
    .limit(Math.min(Math.max(1, limit), MAX_BATCH_SIZE * 2));
  const claimedIds: number[] = [];
  for (const candidate of candidates) {
    if (claimedIds.length >= limit) break;
    const leaseToken = randomUUID();
    const update = await db.update(adminDataModuleAutomationRunItems).set({
      status: 'claimed',
      currentStep: 'claimed_by_request_worker',
      leaseToken,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      attemptCount: candidate.attemptCount + 1,
      startedAt: candidate.startedAt ?? now,
      updatedAt: now,
    }).where(and(eq(adminDataModuleAutomationRunItems.id, candidate.id), or(
      eq(adminDataModuleAutomationRunItems.status, 'queued'),
      and(eq(adminDataModuleAutomationRunItems.status, 'failed'), lte(adminDataModuleAutomationRunItems.retryAfter, now)),
      and(inArray(adminDataModuleAutomationRunItems.status, ['claimed', 'running']), lt(adminDataModuleAutomationRunItems.leaseExpiresAt, now)),
    )));
    if (resultAffectedRows(update) > 0) claimedIds.push(candidate.id);
  }
  if (!claimedIds.length) return [];
  return db.select().from(adminDataModuleAutomationRunItems).where(inArray(adminDataModuleAutomationRunItems.id, claimedIds));
}

export async function markAdminDataModuleRunItem(input: { item: RunItemRow; leaseToken: string; status: TerminalItemStatus; step: string; detail: string; resultSummary?: Record<string, unknown>; errorDetail?: string; actorUserId?: number; durationMs?: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const now = new Date();
  const retryAfter = input.status === 'failed' && input.item.attemptCount < input.item.maxAttempts
    ? new Date(now.getTime() + retryDelayMs(input.item.attemptCount))
    : null;
  const updated = await db.update(adminDataModuleAutomationRunItems).set({
    status: input.status,
    currentStep: input.step,
    retryAfter,
    leaseToken: null,
    leaseExpiresAt: null,
    resultSummary: input.resultSummary ?? null,
    errorDetail: input.errorDetail?.slice(0, 1_800) ?? null,
    completedAt: input.status === 'failed' && retryAfter ? null : now,
    updatedAt: now,
  }).where(and(eq(adminDataModuleAutomationRunItems.id, input.item.id), eq(adminDataModuleAutomationRunItems.leaseToken, input.leaseToken)));
  if (resultAffectedRows(updated) !== 1) throw new Error('AUTOMATION_ITEM_LEASE_LOST');
  await logStep({ runId: input.item.runId, jobItemId: input.item.id, moduleId: input.item.moduleId, step: input.step, action: 'process', status: input.status === 'completed' ? 'success' : input.status === 'skipped' ? 'skipped' : input.status === 'cancelled' ? 'cancelled' : 'failed', detail: input.detail, durationMs: input.durationMs, actorUserId: input.actorUserId });
  return { retryAfter, terminal: !(input.status === 'failed' && retryAfter) };
}

async function refreshRunProgress(runId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const items = await db.select({ status: adminDataModuleAutomationRunItems.status }).from(adminDataModuleAutomationRunItems).where(eq(adminDataModuleAutomationRunItems.runId, runId));
  const count = (status: QueueItemStatus) => items.filter((item) => item.status === status).length;
  const retryWaiting = (await db.select({ retryAfter: adminDataModuleAutomationRunItems.retryAfter }).from(adminDataModuleAutomationRunItems).where(and(eq(adminDataModuleAutomationRunItems.runId, runId), eq(adminDataModuleAutomationRunItems.status, 'failed')))).filter((item) => item.retryAfter !== null).length;
  const queued = count('queued') + count('claimed') + count('running') + count('pending_review') + count('pending_delivery') + retryWaiting;
  const failed = count('failed') - retryWaiting;
  const completed = count('completed');
  const skipped = count('skipped') + count('cancelled');
  let status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled' = queued ? 'running' : failed && !completed ? 'failed' : failed || skipped ? 'partial' : 'completed';
  if (items.length && count('cancelled') === items.length) status = 'cancelled';
  await db.update(adminDataModuleAutomationRuns).set({
    status,
    currentStep: queued ? 'persistent_queue_pending' : status === 'completed' ? 'persistent_queue_completed' : status === 'failed' ? 'persistent_queue_failed' : status === 'cancelled' ? 'cancelled_by_admin' : 'persistent_queue_partial',
    queuedCount: count('queued') + count('pending_review') + count('pending_delivery') + retryWaiting,
    runningCount: count('claimed') + count('running'),
    succeededCount: completed,
    failedCount: failed,
    skippedCount: skipped,
    completedAt: queued ? null : new Date(),
    updatedAt: new Date(),
  }).where(eq(adminDataModuleAutomationRuns.id, runId));
  return { total: items.length, queued, completed, failed, skipped, status };
}

export async function processAdminDataModuleQueue(input: { runKey: string; actorUserId: number; maxItems?: number; handler: (item: RunItemRow) => Promise<{ status: 'completed' | 'skipped'; step: string; detail: string; resultSummary?: Record<string, unknown> }> }) {
  const run = await getRunByKey(input.runKey);
  if (!run) throw new Error('AUTOMATION_RUN_NOT_FOUND');
  if (run.status === 'cancelled') return { runKey: run.runKey, status: 'cancelled' as const, processed: 0, skipped: 'cancelled' as const };
  if (run.currentStep === 'paused_by_admin') return { runKey: run.runKey, status: 'paused' as const, processed: 0, skipped: 'paused' as const };
  const lockKey = `admin-module-run:${run.id}`;
  const runLease = await acquireLease(lockKey, 'request_or_heartbeat');
  if (!runLease) return { runKey: run.runKey, status: 'busy' as const, processed: 0, skipped: 'active_lease' as const };
  try {
    const db = await getDb();
    if (!db) throw new Error('DATABASE_UNAVAILABLE');
    const configuredQueue = await getAdminDataModuleSystemSettingValue('queue.execution', { maxConcurrentItems: MAX_BATCH_SIZE, itemTimeoutMs: ITEM_EXECUTION_TIMEOUT_MS });
    const configuredBatchSize = typeof configuredQueue.maxConcurrentItems === 'number' && Number.isFinite(configuredQueue.maxConcurrentItems) ? configuredQueue.maxConcurrentItems : MAX_BATCH_SIZE;
    const configuredTimeout = typeof configuredQueue.itemTimeoutMs === 'number' && Number.isFinite(configuredQueue.itemTimeoutMs) ? configuredQueue.itemTimeoutMs : ITEM_EXECUTION_TIMEOUT_MS;
    const effectiveBatchSize = Math.min(Math.max(1, input.maxItems ?? MAX_BATCH_SIZE), MAX_BATCH_SIZE, Math.max(1, Math.floor(configuredBatchSize)));
    const effectiveTimeout = Math.min(110_000, Math.max(1_000, Math.floor(configuredTimeout)));
    const now = new Date();
    await db.update(adminDataModuleAutomationRuns).set({ status: 'running', currentStep: 'persistent_queue_claiming', startedAt: run.startedAt ?? now, updatedAt: now }).where(eq(adminDataModuleAutomationRuns.id, run.id));
    const items = await claimItems(run, effectiveBatchSize);
    await Promise.all(items.map(async (item) => {
      const started = Date.now();
      const leaseToken = item.leaseToken;
      if (!leaseToken) return;
      const latest = await getRunByKey(input.runKey);
      if (!latest || latest.status === 'cancelled' || latest.currentStep === 'paused_by_admin') {
        await markAdminDataModuleRunItem({ item, leaseToken, status: 'cancelled', step: 'cancelled_before_execution', detail: '任务在领取后被取消或暂停；未执行数据生成或推送。', actorUserId: input.actorUserId, durationMs: Date.now() - started });
        return;
      }
      await db.update(adminDataModuleAutomationRunItems).set({ status: 'running', currentStep: 'handler_running', updatedAt: new Date() }).where(and(eq(adminDataModuleAutomationRunItems.id, item.id), eq(adminDataModuleAutomationRunItems.leaseToken, leaseToken)));
      await logStep({ runId: run.id, jobItemId: item.id, moduleId: item.moduleId, step: 'handler_running', action: 'process', status: 'started', detail: '数据库租约已取得，开始执行模块后端处理。', actorUserId: input.actorUserId });
      try {
        const outcome = await withItemTimeout(input.handler(item), effectiveTimeout);
        await markAdminDataModuleRunItem({ item, leaseToken, status: outcome.status, step: outcome.step, detail: outcome.detail, resultSummary: outcome.resultSummary, actorUserId: input.actorUserId, durationMs: Date.now() - started });
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'AUTOMATION_ITEM_EXECUTION_FAILED';
        await markAdminDataModuleRunItem({ item, leaseToken, status: 'failed', step: 'handler_failed', detail: '模块处理失败，已独立记录，其他任务项继续执行。', errorDetail: detail, actorUserId: input.actorUserId, durationMs: Date.now() - started });
      }
    }));
    const progress = await refreshRunProgress(run.id);
    return { runKey: run.runKey, processed: items.length, ...progress };
  } finally {
    await releaseLease(lockKey, runLease);
  }
}

export async function listAdminDataModuleRunItems(input: { runKey: string; page?: number; pageSize?: number; status?: QueueItemStatus }) {
  const run = await getRunByKey(input.runKey);
  if (!run) throw new Error('AUTOMATION_RUN_NOT_FOUND');
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 40));
  const where = input.status ? and(eq(adminDataModuleAutomationRunItems.runId, run.id), eq(adminDataModuleAutomationRunItems.status, input.status)) : eq(adminDataModuleAutomationRunItems.runId, run.id);
  const rows = await db.select().from(adminDataModuleAutomationRunItems).where(where).orderBy(desc(adminDataModuleAutomationRunItems.updatedAt)).limit(pageSize).offset((page - 1) * pageSize);
  return { runKey: run.runKey, page, pageSize, rows };
}

export async function pauseAdminDataModuleAutomationRun(runKey: string, actorUserId: number) {
  const run = await getRunByKey(runKey);
  if (!run) throw new Error('AUTOMATION_RUN_NOT_FOUND');
  if (TERMINAL_ITEM_STATUSES.includes(run.status as TerminalItemStatus)) throw new Error('AUTOMATION_RUN_ALREADY_TERMINAL');
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.update(adminDataModuleAutomationRuns).set({ currentStep: 'paused_by_admin', updatedAt: new Date() }).where(eq(adminDataModuleAutomationRuns.id, run.id));
  await logStep({ runId: run.id, step: 'pause', action: 'pause', status: 'success', detail: '任务已暂停；已领取任务完成前不会再领取新的队列项。', actorUserId });
  return { runKey, status: 'paused' as const };
}

export async function resumeAdminDataModuleAutomationRun(runKey: string, actorUserId: number) {
  const run = await getRunByKey(runKey);
  if (!run) throw new Error('AUTOMATION_RUN_NOT_FOUND');
  if (run.currentStep !== 'paused_by_admin') throw new Error('AUTOMATION_RUN_NOT_PAUSED');
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.update(adminDataModuleAutomationRuns).set({ status: 'queued', currentStep: 'resumed_waiting_for_persistent_worker', completedAt: null, updatedAt: new Date() }).where(eq(adminDataModuleAutomationRuns.id, run.id));
  await logStep({ runId: run.id, step: 'resume', action: 'resume', status: 'success', detail: '任务已恢复为可领取状态；下一次管理员请求或经认证计划回调将处理队列项。', actorUserId });
  return { runKey, status: 'queued' as const };
}

export async function retryFailedAdminDataModuleRunItems(runKey: string, actorUserId: number) {
  const run = await getRunByKey(runKey);
  if (!run) throw new Error('AUTOMATION_RUN_NOT_FOUND');
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const now = new Date();
  const result = await db.update(adminDataModuleAutomationRunItems).set({ status: 'queued', currentStep: 'manual_retry_queued', retryAfter: null, completedAt: null, errorDetail: null, updatedAt: now }).where(and(eq(adminDataModuleAutomationRunItems.runId, run.id), eq(adminDataModuleAutomationRunItems.status, 'failed')));
  const retried = resultAffectedRows(result);
  if (retried) {
    await db.update(adminDataModuleAutomationRuns).set({ status: 'queued', currentStep: 'manual_retry_queued', retryCount: run.retryCount + 1, completedAt: null, updatedAt: now }).where(eq(adminDataModuleAutomationRuns.id, run.id));
    await logStep({ runId: run.id, step: 'retry_failed_items', action: 'retry', status: 'success', detail: `管理员已将 ${retried} 个失败任务项重新入队。`, actorUserId });
  }
  return { runKey, retried };
}

export async function cleanupAdminDataModuleAutomationQueue(input: { before: Date; actorUserId: number; maxRuns?: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const deletedCache = await db.delete(adminDataModuleRequestCache).where(lte(adminDataModuleRequestCache.expiresAt, new Date()));
  const oldRuns = await db.select({ id: adminDataModuleAutomationRuns.id }).from(adminDataModuleAutomationRuns)
    .where(and(inArray(adminDataModuleAutomationRuns.status, ['completed', 'partial', 'failed', 'cancelled']), lte(adminDataModuleAutomationRuns.completedAt, input.before)))
    .orderBy(asc(adminDataModuleAutomationRuns.completedAt)).limit(Math.min(500, Math.max(1, input.maxRuns ?? 100)));
  const runIds = oldRuns.map((row) => row.id);
  if (!runIds.length) return { cleanedRuns: 0, cleanedItems: 0, cleanedStepEvents: 0, cleanedRequestCacheEntries: resultAffectedRows(deletedCache) };
  const deletedSteps = await db.delete(adminDataModuleAutomationStepEvents).where(inArray(adminDataModuleAutomationStepEvents.runId, runIds));
  const deletedItems = await db.delete(adminDataModuleAutomationRunItems).where(inArray(adminDataModuleAutomationRunItems.runId, runIds));
  await db.delete(adminDataModuleAutomationRuns).where(inArray(adminDataModuleAutomationRuns.id, runIds));
  return { cleanedRuns: runIds.length, cleanedItems: resultAffectedRows(deletedItems), cleanedStepEvents: resultAffectedRows(deletedSteps), cleanedRequestCacheEntries: resultAffectedRows(deletedCache), actorUserId: input.actorUserId };
}

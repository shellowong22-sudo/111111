import cron, { type ScheduledTask } from "node-cron";
import { eq } from "drizzle-orm";
import { standaloneSchedules, type StandaloneSchedule } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "./env";

const activeTasks = new Map<number, ScheduledTask>();

function requireStandalone(): void {
  if (!ENV.standaloneMode) throw new Error("Standalone scheduler is only available when STANDALONE_MODE=true");
  if (!ENV.schedulerSecret) throw new Error("SCHEDULER_SECRET is not configured");
}

function taskUid(id: number): string { return `standalone:${id}`; }
function scheduleId(value: string): number {
  const id = Number(value.replace(/^standalone:/, ""));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid standalone schedule id");
  return id;
}

function parsePayload(payload: string | null): unknown {
  if (!payload) return undefined;
  try { return JSON.parse(payload); } catch { return payload; }
}

async function record(id: number, status: "ok" | "failed", error: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(standaloneSchedules).set({
    lastExecutedAt: new Date(), lastStatus: status, lastError: error?.slice(0, 1000) ?? null,
  }).where(eq(standaloneSchedules.id, id));
}

async function execute(row: StandaloneSchedule) {
  try {
    const url = new URL(row.callbackPath, ENV.appOrigin);
    if (url.origin !== new URL(ENV.appOrigin).origin || !url.pathname.startsWith("/api/scheduled/")) {
      throw new Error("Invalid standalone scheduled callback");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, ENV.schedulerTimeoutMs));
    const payload = parsePayload(row.callbackPayload);
    const response = await fetch(url, {
      method: row.callbackMethod,
      headers: {
        "x-scheduler-secret": ENV.schedulerSecret,
        "x-scheduler-task-id": taskUid(row.id),
        ...(payload === undefined ? {} : { "content-type": "application/json" }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!response.ok) throw new Error(`Scheduled callback failed (${response.status})`);
    await record(row.id, "ok", null);
  } catch (error) {
    await record(row.id, "failed", error instanceof Error ? error.message : String(error));
  }
}

function install(row: StandaloneSchedule) {
  activeTasks.get(row.id)?.stop();
  activeTasks.delete(row.id);
  if (!row.isEnabled) return;
  if (!cron.validate(row.cronExpression)) throw new Error(`Invalid cron expression for ${row.name}`);
  const task = cron.schedule(row.cronExpression, () => { void execute(row); }, { timezone: "UTC" });
  activeTasks.set(row.id, task);
}

export async function bootstrapStandaloneScheduler() {
  if (!ENV.standaloneMode) return;
  requireStandalone();
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select().from(standaloneSchedules).where(eq(standaloneSchedules.isEnabled, true));
  for (const row of rows) {
    try { install(row); }
    catch (error) { await record(row.id, "failed", error instanceof Error ? error.message : String(error)); }
  }
}

export async function createStandaloneSchedule(input: {
  name: string; cron: string; path: string; method?: "POST" | "PUT"; payload?: unknown; description?: string;
}) {
  requireStandalone();
  if (!input.path.startsWith("/api/scheduled/")) throw new Error("callback path must start with /api/scheduled/");
  if (!cron.validate(input.cron)) throw new Error("Invalid cron expression");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const inserted = await db.insert(standaloneSchedules).values({
    name: input.name, cronExpression: input.cron, callbackPath: input.path,
    callbackMethod: input.method ?? "POST", callbackPayload: input.payload === undefined ? null : JSON.stringify(input.payload),
    description: input.description ?? "", isEnabled: true,
  });
  const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  const row = (await db.select().from(standaloneSchedules).where(eq(standaloneSchedules.id, id)).limit(1))[0];
  if (!row) throw new Error("Standalone schedule creation failed");
  install(row);
  return { taskUid: taskUid(id), nextExecutionAt: null };
}

export async function updateStandaloneSchedule(uid: string, patch: { cron?: string; path?: string; method?: "POST" | "PUT"; payload?: unknown; description?: string; enable?: boolean }) {
  requireStandalone();
  const id = scheduleId(uid);
  if (patch.path && !patch.path.startsWith("/api/scheduled/")) throw new Error("callback path must start with /api/scheduled/");
  if (patch.cron && !cron.validate(patch.cron)) throw new Error("Invalid cron expression");
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.update(standaloneSchedules).set({
    ...(patch.cron === undefined ? {} : { cronExpression: patch.cron }),
    ...(patch.path === undefined ? {} : { callbackPath: patch.path }),
    ...(patch.method === undefined ? {} : { callbackMethod: patch.method }),
    ...(patch.payload === undefined ? {} : { callbackPayload: JSON.stringify(patch.payload) }),
    ...(patch.description === undefined ? {} : { description: patch.description }),
    ...(patch.enable === undefined ? {} : { isEnabled: patch.enable }),
  }).where(eq(standaloneSchedules.id, id));
  const row = (await db.select().from(standaloneSchedules).where(eq(standaloneSchedules.id, id)).limit(1))[0];
  if (!row) throw new Error("Standalone schedule not found");
  install(row);
  return { nextExecutionAt: null };
}

export async function deleteStandaloneSchedule(uid: string) {
  requireStandalone();
  const id = scheduleId(uid);
  activeTasks.get(id)?.stop(); activeTasks.delete(id);
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  await db.delete(standaloneSchedules).where(eq(standaloneSchedules.id, id));
}

export async function listStandaloneSchedules() {
  requireStandalone();
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const rows = await db.select().from(standaloneSchedules);
  return { total: rows.length, actorUserId: "standalone", jobs: rows.map((row) => ({
    taskUid: taskUid(row.id), name: row.name, userId: "standalone", description: row.description,
    cronExpression: row.cronExpression, callbackPath: row.callbackPath, callbackMethod: row.callbackMethod,
    callbackPayload: row.callbackPayload ?? "{}", isEnable: row.isEnabled,
    createdAt: row.createdAt?.toISOString() ?? null, lastExecutedAt: row.lastExecutedAt?.toISOString() ?? null,
    nextExecutionAt: null,
  })) };
}

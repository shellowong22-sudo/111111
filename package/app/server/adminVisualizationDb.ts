import { desc, eq, gte, sql } from 'drizzle-orm';
import { adminRuntimeHealthSamples, users } from '../drizzle/schema';
import { getDb } from './db';

const SAMPLE_INTERVAL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const asCount = (value: unknown) => Number(value ?? 0);

async function captureRuntimeSample() {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const last = (await db.select().from(adminRuntimeHealthSamples).orderBy(desc(adminRuntimeHealthSamples.sampledAt)).limit(1))[0];
  if (last && Date.now() - last.sampledAt.getTime() < SAMPLE_INTERVAL_MS) return last;
  const start = Date.now(); await db.execute(sql`SELECT 1`); const dbLatencyMs = Date.now() - start;
  const now = new Date(); const dayAgo = new Date(now.getTime() - DAY_MS); const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const [counts] = await db.select({ totalUsers: sql<number>`COUNT(*)`, activeLast24h: sql<number>`SUM(CASE WHEN ${users.lastSignedIn} >= ${dayAgo} THEN 1 ELSE 0 END)`, activeLast7d: sql<number>`SUM(CASE WHEN ${users.lastSignedIn} >= ${weekAgo} THEN 1 ELSE 0 END)` }).from(users);
  const memory = process.memoryUsage();
  await db.insert(adminRuntimeHealthSamples).values({ dbLatencyMs, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal, rssBytes: memory.rss, uptimeSeconds: Math.floor(process.uptime()), totalUsers: asCount(counts?.totalUsers), activeLast24h: asCount(counts?.activeLast24h), activeLast7d: asCount(counts?.activeLast7d) });
  return (await db.select().from(adminRuntimeHealthSamples).orderBy(desc(adminRuntimeHealthSamples.sampledAt)).limit(1))[0]!;
}

export async function getAdminVisualizationDossier() {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const current = await captureRuntimeSample();
  const sampleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const samples = await db.select().from(adminRuntimeHealthSamples).where(gte(adminRuntimeHealthSamples.sampledAt, sampleCutoff)).orderBy(adminRuntimeHealthSamples.sampledAt).limit(288);
  const fourteenDaysAgo = new Date(Date.now() - 13 * DAY_MS); const [activityRows] = await db.execute(sql`SELECT DATE(lastSignedIn) AS day, COUNT(*) AS activeUsers FROM users WHERE lastSignedIn >= ${fourteenDaysAgo} GROUP BY DATE(lastSignedIn) ORDER BY day ASC`) as any;
  const activityMap = new Map((activityRows ?? []).map((row: any) => [String(row.day).slice(0, 10), asCount(row.activeUsers)]));
  const activitySeries = Array.from({ length: 14 }, (_, index) => { const date = new Date(fourteenDaysAgo.getTime() + index * DAY_MS); const day = date.toISOString().slice(0, 10); return { day, activeUsers: activityMap.get(day) ?? 0 }; });
  return {
    current: { sampledAt: current.sampledAt, dbLatencyMs: current.dbLatencyMs, heapUsedBytes: Number(current.heapUsedBytes), heapTotalBytes: Number(current.heapTotalBytes), rssBytes: Number(current.rssBytes), uptimeSeconds: current.uptimeSeconds, totalUsers: current.totalUsers, activeLast24h: current.activeLast24h, activeLast7d: current.activeLast7d },
    systemSeries: samples.map((sample) => ({ sampledAt: sample.sampledAt, dbLatencyMs: sample.dbLatencyMs, heapUsedBytes: Number(sample.heapUsedBytes), heapTotalBytes: Number(sample.heapTotalBytes), rssBytes: Number(sample.rssBytes) })),
    activitySeries,
    methodology: { samplingIntervalMinutes: 5, systemWindowHours: 24, activityWindowDays: 14, notes: '运行时指标为服务端聚合采样；用户活跃度按最近成功登录日期聚合。无采样或无登录日期时以零值或单点明确呈现，不生成随机历史。' },
  };
}

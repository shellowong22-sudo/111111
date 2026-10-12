import { eq, sql } from 'drizzle-orm';
import { terminalSecurityEvents, terminalWatermarkSettings } from '../drizzle/schema';
import { writeAdminSecurityAudit } from './adminSecurityDb';
import { getDb } from './db';

const lastEventByKey = new Map<string, number>();
const SERVER_EVENT_COOLDOWN_MS = 30_000;
export const terminalSecurityEventTypes = ['copy_blocked', 'cut_blocked', 'copy_warning_shown', 'cut_warning_shown'] as const;
export type TerminalSecurityEventType = typeof terminalSecurityEventTypes[number];
const WATERMARK_SETTING_KEY = 'global_terminal_watermark';
const DEFAULT_WATERMARK_CONFIG = { isEnabled: true, opacityPercent: 45, updatedAt: null as Date | null };

function toWatermarkConfig(row?: { isEnabled: boolean; opacityPercent: number; updatedAt: Date } | null) {
  if (!row) return DEFAULT_WATERMARK_CONFIG;
  return { isEnabled: Boolean(row.isEnabled), opacityPercent: Math.min(70, Math.max(15, Number(row.opacityPercent))), updatedAt: row.updatedAt };
}

export async function getTerminalWatermarkConfig() {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const row = (await db.select({ isEnabled: terminalWatermarkSettings.isEnabled, opacityPercent: terminalWatermarkSettings.opacityPercent, updatedAt: terminalWatermarkSettings.updatedAt }).from(terminalWatermarkSettings).where(eq(terminalWatermarkSettings.settingKey, WATERMARK_SETTING_KEY)).limit(1))[0];
  return toWatermarkConfig(row);
}

export async function updateTerminalWatermarkConfig(actorUserId: number, input: { isEnabled: boolean; opacityPercent: number }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const opacityPercent = Math.min(70, Math.max(15, Math.round(input.opacityPercent)));
  await db.insert(terminalWatermarkSettings).values({ settingKey: WATERMARK_SETTING_KEY, isEnabled: input.isEnabled, opacityPercent }).onDuplicateKeyUpdate({ set: { isEnabled: input.isEnabled, opacityPercent } });
  await writeAdminSecurityAudit({ actorUserId, action: 'terminal_watermark_config', result: 'allowed', metadata: { isEnabled: input.isEnabled, opacityPercent } });
  return getTerminalWatermarkConfig();
}

export async function recordTerminalSecurityEvent(userId: number, eventType: TerminalSecurityEventType, routePath: string) {
  const key = `${userId}:${eventType}`; const now = Date.now(); const last = lastEventByKey.get(key) ?? 0;
  if (now - last < SERVER_EVENT_COOLDOWN_MS) return { recorded: false, reason: 'cooldown' as const };
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const safePath = routePath.startsWith('/') ? routePath.slice(0, 255) : '/';
  await db.insert(terminalSecurityEvents).values({ userId, eventType, routePath: safePath }); lastEventByKey.set(key, now);
  return { recorded: true as const };
}

export async function getTerminalSecurityAdminSummary() {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const cutoff = new Date(); cutoff.setUTCHours(0, 0, 0, 0); cutoff.setUTCDate(cutoff.getUTCDate() - 6);
  const [rows] = await db.execute(sql`SELECT event_type AS eventType, COUNT(*) AS eventCount, MAX(occurred_at) AS lastOccurredAt FROM terminal_security_events WHERE occurred_at >= ${cutoff} GROUP BY event_type ORDER BY eventCount DESC`) as any;
  const [dailyRows] = await db.execute(sql`SELECT DATE(occurred_at) AS day, COUNT(*) AS eventCount FROM terminal_security_events WHERE occurred_at >= ${cutoff} GROUP BY DATE(occurred_at) ORDER BY day ASC`) as any;
  const eventRows = (rows ?? []).map((row: any) => ({ eventType: String(row.eventType), eventCount: Number(row.eventCount ?? 0), lastOccurredAt: row.lastOccurredAt ?? null }));
  const countByType = new Map(eventRows.map((row: { eventType: string; eventCount: number }) => [row.eventType, row.eventCount]));
  const countByDay = new Map((dailyRows ?? []).map((row: any) => [String(row.day).slice(0, 10), Number(row.eventCount ?? 0)]));
  const dailySeries = Array.from({ length: 7 }, (_, index) => { const date = new Date(cutoff.getTime() + index * 24 * 60 * 60 * 1000); const day = date.toISOString().slice(0, 10); return { day, eventCount: countByDay.get(day) ?? 0 }; });
  const typeSeries = terminalSecurityEventTypes.map((eventType) => ({ eventType, eventCount: countByType.get(eventType) ?? 0 }));
  return { windowDays: 7, events: eventRows, dailySeries, typeSeries, dataBoundary: '仅聚合事件类型、路由与时间；趋势按最近 7 个 UTC 自然日呈现。warning_shown 仅表示友好提示实际展示，不表示攻击、泄露或恶意意图；不采集剪贴板内容、IP、设备指纹、密码或令牌。' };
}

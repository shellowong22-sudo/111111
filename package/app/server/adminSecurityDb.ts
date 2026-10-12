import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { adminSecurityAuditEvents, users } from '../drizzle/schema';
import { getDb } from './db';

export type ManagedRole = 'admin' | 'user' | 'trader' | 'risk_manager';

export async function writeAdminSecurityAudit(input: { actorUserId: number; targetUserId?: number | null; action: string; result: 'allowed' | 'blocked'; reason?: string | null; metadata?: Record<string, unknown> | null }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(adminSecurityAuditEvents).values({ actorUserId: input.actorUserId, targetUserId: input.targetUserId ?? null, action: input.action.slice(0, 80), result: input.result, reason: input.reason?.trim().slice(0, 500) || null, metadata: input.metadata ? JSON.stringify(input.metadata).slice(0, 1000) : null });
}

export async function getAdminSecurityOverview() {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const [counts] = await db.select({ users: sql<number>`COUNT(*)`, admins: sql<number>`SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END)` }).from(users);
  const [audit] = await db.select({ lastEventAt: sql<Date | null>`MAX(created_at)` }).from(adminSecurityAuditEvents);
  return { userCount: Number(counts?.users ?? 0), adminCount: Number(counts?.admins ?? 0), lastAuditAt: audit?.lastEventAt ?? null, controls: [
    { key: 'server_role_gate', label: '服务端管理员角色校验', status: 'enabled' as const },
    { key: 'self_protection', label: '禁止自我降权或删除', status: 'enabled' as const },
    { key: 'last_admin_guard', label: '最后管理员保护', status: 'enabled' as const },
    { key: 'audit_trail', label: '敏感操作审计轨迹', status: 'enabled' as const },
    { key: 'terminal_boundary', label: '管理数据不向终端前台公开', status: 'enabled' as const },
  ] };
}

export async function listManagedUsersForSecurity() {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt }).from(users).orderBy(asc(users.id)).limit(100);
}

async function adminCount() { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const [result] = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(eq(users.role, 'admin')); return Number(result?.count ?? 0); }

export async function securelyChangeManagedRole(actorUserId: number, input: { targetUserId: number; role: ManagedRole; reason: string }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const target = (await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.targetUserId)).limit(1))[0];
  if (!target) { await writeAdminSecurityAudit({ actorUserId, targetUserId: input.targetUserId, action: 'role_change', result: 'blocked', reason: input.reason, metadata: { code: 'TARGET_NOT_FOUND' } }); throw new Error('目标用户不存在。'); }
  if (target.id === actorUserId) { await writeAdminSecurityAudit({ actorUserId, targetUserId: input.targetUserId, action: 'role_change', result: 'blocked', reason: input.reason, metadata: { code: 'SELF_CHANGE_BLOCKED' } }); throw new Error('不得通过管理后台变更自己的角色。'); }
  if (target.role === 'admin' && input.role !== 'admin' && await adminCount() <= 1) { await writeAdminSecurityAudit({ actorUserId, targetUserId: input.targetUserId, action: 'role_change', result: 'blocked', reason: input.reason, metadata: { code: 'LAST_ADMIN_BLOCKED' } }); throw new Error('系统必须至少保留一位管理员。'); }
  await db.update(users).set({ role: input.role }).where(eq(users.id, input.targetUserId));
  await writeAdminSecurityAudit({ actorUserId, targetUserId: input.targetUserId, action: 'role_change', result: 'allowed', reason: input.reason, metadata: { from: target.role, to: input.role } });
  return { success: true };
}

export async function listAdminSecurityAudits(limit: number) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); return db.select().from(adminSecurityAuditEvents).orderBy(desc(adminSecurityAuditEvents.createdAt)).limit(limit); }

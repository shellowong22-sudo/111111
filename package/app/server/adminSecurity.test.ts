import { readFileSync } from 'node:fs';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminSecurityAuditEvents, users } from '../drizzle/schema';
import { getDb } from './db';
import { securelyChangeManagedRole } from './adminSecurityDb';
import { adminSecurityRouter } from './routers/adminSecurity';

const marker = 'security-console-test-20260823';
let actorId = 0;
let targetId = 0;
const cleanup = async () => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const rows = await db.select({ id: users.id }).from(users).where(inArray(users.openId, [`${marker}-actor`, `${marker}-target`])); if (rows.length) { const ids = rows.map((row) => row.id); await db.delete(adminSecurityAuditEvents).where(inArray(adminSecurityAuditEvents.actorUserId, ids)); await db.delete(adminSecurityAuditEvents).where(inArray(adminSecurityAuditEvents.targetUserId, ids)); await db.delete(users).where(inArray(users.id, ids)); } };

describe('独立安全管理后台', () => {
  beforeAll(async () => { await cleanup(); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.insert(users).values([{ openId: `${marker}-actor`, name: 'Security Actor', role: 'admin' }, { openId: `${marker}-target`, name: 'Security Target', role: 'user' }]); const rows = await db.select({ id: users.id, openId: users.openId }).from(users).where(inArray(users.openId, [`${marker}-actor`, `${marker}-target`])); actorId = rows.find((row) => row.openId.endsWith('-actor'))!.id; targetId = rows.find((row) => row.openId.endsWith('-target'))!.id; });
  afterAll(cleanup);

  it('rejects non-admin access in the server middleware', async () => {
    const caller = adminSecurityRouter.createCaller({ user: { id: 7, role: 'user' } } as any);
    await expect(caller.overview()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('requires the literal confirmation code before an elevation request can run', () => {
    const schema = adminSecurityRouter._def.procedures.changeManagedRole._def.inputs[0]!;
    expect(schema.safeParse({ targetUserId: 1, role: 'admin', confirmation: 'wrong', reason: 'weekly approval' }).success).toBe(false);
  });

  it('blocks self-role changes and records a blocked audit event', async () => {
    await expect(securelyChangeManagedRole(actorId, { targetUserId: actorId, role: 'user', reason: 'attempted self downgrade' })).rejects.toThrow('不得通过管理后台变更自己的角色');
    const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const actor = (await db.select({ role: users.role }).from(users).where(eq(users.id, actorId)).limit(1))[0]; const audit = (await db.select().from(adminSecurityAuditEvents).where(and(eq(adminSecurityAuditEvents.actorUserId, actorId), eq(adminSecurityAuditEvents.targetUserId, actorId))).limit(1))[0];
    expect(actor?.role).toBe('admin'); expect(audit).toMatchObject({ action: 'role_change', result: 'blocked' });
  });

  it('allows an audited role change for a distinct target', async () => {
    await expect(securelyChangeManagedRole(actorId, { targetUserId: targetId, role: 'trader', reason: 'approved trading-desk assignment' })).resolves.toEqual({ success: true });
    const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const target = (await db.select({ role: users.role }).from(users).where(eq(users.id, targetId)).limit(1))[0];
    expect(target?.role).toBe('trader');
  });

  it('keeps the terminal route separate and guards the independent admin route', () => {
    const app = readFileSync('client/src/App.tsx', 'utf8'); const consoleSource = readFileSync('client/src/pages/admin/SecureAdminConsole.tsx', 'utf8');
    expect(app).toContain('path="/secure-admin"'); expect(app).toMatch(/SecureAdminConsole[\s\S]*canAccessAdmin/); expect(consoleSource).toContain('href="/admin/users"'); expect(consoleSource).not.toMatch(/window\.open|window\.location|\bfetch\(|https?:\/\//);
  });
});

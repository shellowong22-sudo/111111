import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminSecurityAuditEvents, terminalSecurityEvents } from '../drizzle/schema';
import { getDb } from './db';
import { getTerminalWatermarkConfig, recordTerminalSecurityEvent } from './terminalSecurityDb';
import { terminalSecurityRouter } from './routers/terminalSecurity';

const testUserId = 968000731;
describe('终端水印与有限防复制安全边界', () => {
  beforeAll(async () => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.delete(terminalSecurityEvents).where(eq(terminalSecurityEvents.userId, testUserId)); await db.delete(adminSecurityAuditEvents).where(eq(adminSecurityAuditEvents.actorUserId, testUserId)); });
  afterAll(async () => { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.delete(terminalSecurityEvents).where(eq(terminalSecurityEvents.userId, testUserId)); await db.delete(adminSecurityAuditEvents).where(eq(adminSecurityAuditEvents.actorUserId, testUserId)); });

  it('records only minimal deterrence and actual warning-display events with server-side cooldown', async () => {
    await expect(recordTerminalSecurityEvent(testUserId, 'copy_blocked', '/terminal')).resolves.toMatchObject({ recorded: true });
    await expect(recordTerminalSecurityEvent(testUserId, 'copy_blocked', '/terminal')).resolves.toMatchObject({ recorded: false, reason: 'cooldown' });
    await expect(recordTerminalSecurityEvent(testUserId, 'copy_warning_shown', '/terminal')).resolves.toMatchObject({ recorded: true });
    const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const events = await db.select().from(terminalSecurityEvents).where(eq(terminalSecurityEvents.userId, testUserId));
    expect(events.map((event) => event.eventType).sort()).toEqual(['copy_blocked', 'copy_warning_shown']); expect(events.every((event) => event.routePath === '/terminal')).toBe(true); expect(events.every((event) => !Object.keys(event).includes('clipboard'))).toBe(true);
  });

  it('requires an authenticated user before a deterrence event can be written', async () => {
    const caller = terminalSecurityRouter.createCaller({ user: null } as any);
    await expect(caller.recordDeterrenceEvent({ eventType: 'copy_blocked', routePath: '/terminal' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('keeps limited copy/cut deterrence without rendering terminal user or time watermarks', () => {
    const overlay = readFileSync('client/src/components/TerminalSecurityOverlay.tsx', 'utf8'); const charts = readFileSync('client/src/components/admin/AdminOperationalCharts.tsx', 'utf8'); const app = readFileSync('client/src/App.tsx', 'utf8'); const auth = readFileSync('client/src/_core/hooks/useAuth.ts', 'utf8'); const server = readFileSync('server/_core/index.ts', 'utf8');
    expect(overlay).not.toContain('data-terminal-security-watermark'); expect(overlay).not.toContain('data-watermark-user'); expect(overlay).not.toContain('data-watermark-opacity'); expect(overlay).not.toContain('data-watermark-layout="edge-rail"'); expect(overlay).not.toContain('[writing-mode:vertical-rl]'); expect(overlay).not.toContain('watermarkPositions'); expect(overlay).not.toContain(' UTC'); expect(overlay).toContain("document.addEventListener('copy'"); expect(overlay).toContain("document.addEventListener('cut'"); expect(overlay).toContain('isEditableTarget'); expect(overlay).toContain('toast.warning'); expect(overlay).toContain('warningEventByDeterrence'); expect(overlay).toContain('noticeShown');
    expect(charts).toContain('<WatermarkConfiguration />'); expect(charts).toContain('adminWatermarkConfig'); expect(charts).toContain('updateWatermarkConfig'); expect(charts).toContain('<Switch'); expect(charts).toContain('<Slider');
    expect(overlay).not.toContain('contextmenu'); expect(overlay).not.toContain('clipboardData'); expect(app).toContain('<TerminalSecurityOverlay />'); expect(auth).not.toContain('sessionStorage.getItem');
    expect(server).toContain("X-Content-Type-Options"); expect(server).toContain("X-Frame-Options"); expect(server).toContain("Permissions-Policy");
  });

  it('returns real seven-day event trend and deterministic type series without exposing raw content', async () => {
    const caller = terminalSecurityRouter.createCaller({ user: { id: testUserId, role: 'admin' } } as any);
    const summary = await caller.adminSummary();
    expect(summary.dailySeries).toHaveLength(7); expect(summary.typeSeries.map((entry) => entry.eventType)).toEqual(['copy_blocked', 'cut_blocked', 'copy_warning_shown', 'cut_warning_shown']); expect(summary.dailySeries.every((entry) => Number.isInteger(entry.eventCount) && entry.eventCount >= 0)).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/clipboard|token|password|fingerprint|ipAddress/i);
  });

  it('allows only admins to change the terminal watermark state and opacity', async () => {
    const original = await getTerminalWatermarkConfig();
    const user = terminalSecurityRouter.createCaller({ user: { id: testUserId, role: 'user' } } as any);
    const admin = terminalSecurityRouter.createCaller({ user: { id: testUserId, role: 'admin' } } as any);
    await expect(user.adminWatermarkConfig()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(user.updateWatermarkConfig({ isEnabled: false, opacityPercent: 30 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    try {
      await expect(admin.updateWatermarkConfig({ isEnabled: false, opacityPercent: 60 })).resolves.toMatchObject({ isEnabled: false, opacityPercent: 60 });
      await expect(admin.adminWatermarkConfig()).resolves.toMatchObject({ isEnabled: false, opacityPercent: 60 });
    } finally {
      await admin.updateWatermarkConfig({ isEnabled: original.isEnabled, opacityPercent: original.opacityPercent });
    }
  });
});

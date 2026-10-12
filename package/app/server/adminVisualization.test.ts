import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAdminVisualizationDossier } from './adminVisualizationDb';
import { adminVisualizationRouter } from './routers/adminVisualization';

describe('管理首页运行与活跃度可视化', () => {
  it('only exposes aggregate operational metrics and a complete 14-day activity axis', async () => {
    const dossier = await getAdminVisualizationDossier();
    expect(dossier.activitySeries).toHaveLength(14);
    expect(dossier.activitySeries.every((entry) => Number.isInteger(entry.activeUsers) && entry.activeUsers >= 0)).toBe(true);
    expect(dossier.current).toEqual(expect.objectContaining({ totalUsers: expect.any(Number), activeLast24h: expect.any(Number), activeLast7d: expect.any(Number), heapUsedBytes: expect.any(Number) }));
    expect(JSON.stringify(dossier)).not.toMatch(/openId|email|token|secret|password|cookie/i);
  });

  it('rejects a non-admin caller on the server before any visualisation data is returned', async () => {
    const caller = adminVisualizationRouter.createCaller({ user: { id: 97, role: 'user' } } as any);
    await expect(caller.getDossier()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('appends charts to the management dashboard without external navigation or synthetic data', () => {
    const dashboard = readFileSync('client/src/pages/admin/AdminDashboard.tsx', 'utf8');
    const charts = readFileSync('client/src/components/admin/AdminOperationalCharts.tsx', 'utf8');
    expect(dashboard).toContain('<AdminOperationalCharts />');
    expect(charts).toContain('adminVisualization.getDossier');
    expect(charts).not.toMatch(/Math\.random|window\.open|window\.location|href=|https?:\/\//);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeBondPortfolio } from './bondPortfolioRisk';

const root = resolve(import.meta.dirname, '..');
const text = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('portfolio risk appended research workflows', () => {
  it('derives three scenario curve points from imported bond yields and the same imported positions', () => {
    const positions = [{ identifier: 'TEST-5Y', faceValue: 1_000_000, couponRate: 4, maturityYears: 5, yieldToMaturity: 4.25, frequency: 2 }];
    const parallel = analyzeBondPortfolio(positions, 'parallel', 50).rows[0];
    const steepener = analyzeBondPortfolio(positions, 'steepener', 50).rows[0];
    const butterfly = analyzeBondPortfolio(positions, 'butterfly', 50).rows[0];
    expect(parallel.yieldToMaturity).toBe(4.25);
    expect(parallel.appliedShiftBp).toBe(50);
    expect(steepener.appliedShiftBp).toBeLessThanOrEqual(50);
    expect(butterfly.appliedShiftBp).toBeLessThanOrEqual(50);
  });

  it('keeps strict paired-return heatmap and event drawer inside the appended research layer', () => {
    const layer = text('client/src/components/portfolio/PortfolioRiskResearchLayer.tsx');
    const heatmap = text('client/src/components/portfolio/PortfolioTrackingErrorHeatmap.tsx');
    const curve = text('client/src/components/portfolio/PortfolioBondCurveComparison.tsx');
    const drawer = text('client/src/components/portfolio/PortfolioRiskEventDrawer.tsx');
    expect(layer).toContain('<PortfolioBondCurveComparison />');
    expect(layer).toContain('<PortfolioTrackingErrorHeatmap />');
    expect(layer).toContain('<PortfolioRiskEventDrawer />');
    expect(heatmap).toContain('date、assetClass、portfolioReturn、benchmarkReturn');
    expect(heatmap).toContain('至少两条严格同日');
    expect(curve).toContain('不会使用示例持仓');
    expect(curve).toContain('yieldToMaturity + target.appliedShiftBp / 100');
    expect(drawer).toContain('当前账户实际触发的官方宏观观察阈值记录');
    expect(drawer).toContain('保存处置状态');
  });

  it('exposes protected event routing and does not alter the original alert panel', () => {
    const router = text('server/routers/portfolioRisk.ts');
    const db = text('server/portfolioRiskEventDb.ts');
    const schema = text('drizzle/schema.ts');
    const originalAlert = text('client/src/components/portfolio/AlertMonitorPanel.tsx');
    expect(router).toContain('protectedProcedure.query');
    expect(router).toContain('updateEventAction');
    expect(db).toContain('eq(economicCalendarAnomalyEvents.userId, userId)');
    expect(db).toContain('PORTFOLIO_RISK_EVENT_NOT_FOUND');
    expect(schema).toContain('portfolioRiskEventActions');
    expect(originalAlert).toContain('ALERT_RULES');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeBondPortfolio, bondPricePer100, scenarioShiftBp } from './bondPortfolioRisk';

const position = { identifier: 'TEST-5Y', faceValue: 1_000_000, couponRate: 4, maturityYears: 5, yieldToMaturity: 4, frequency: 2 as const };

describe('债券组合风险计算', () => {
  it('票面利率等于到期收益率时，固定票息债券价格为每百面值 100', () => {
    expect(bondPricePer100(position)).toBeCloseTo(100, 8);
  });

  it('组合输出市场价值、修正久期、凸性、DV01 和平行情景估计损益', () => {
    const result = analyzeBondPortfolio([position], 'parallel', 50);
    expect(result.totalMarketValue).toBeCloseTo(1_000_000, 6);
    expect(result.portfolioDuration).toBeGreaterThan(0);
    expect(result.portfolioConvexity).toBeGreaterThan(0);
    expect(result.totalDv01).toBeGreaterThan(0);
    expect(result.totalPnl).toBeLessThan(0);
    expect(result.rows[0].appliedShiftBp).toBe(50);
  });

  it('陡峭化和蝶式情景按期限分配不同的实际冲击', () => {
    expect(scenarioShiftBp(2, 'steepener', 50)).toBe(-50);
    expect(scenarioShiftBp(10, 'steepener', 50)).toBe(50);
    expect(scenarioShiftBp(2, 'butterfly', 50)).toBe(50);
    expect(scenarioShiftBp(5, 'butterfly', 50)).toBe(-50);
    expect(scenarioShiftBp(10, 'butterfly', 50)).toBe(50);
  });

  it('图表仅绑定三类真实情景结果、期限实际冲击和逐笔估计损益', () => {
    const chart = readFileSync(resolve(import.meta.dirname, '../client/src/components/portfolio/BondRiskScenarioCharts.tsx'), 'utf8');
    const importer = readFileSync(resolve(import.meta.dirname, '../client/src/components/portfolio/BondPortfolioRiskImportPanel.tsx'), 'utf8');
    const router = readFileSync(resolve(import.meta.dirname, './routers/bondPortfolio.ts'), 'utf8');
    expect(chart).toContain('analyses');
    expect(chart).toContain('totalPnl');
    expect(chart).toContain('appliedShiftBp');
    expect(chart).toContain('estimatedPnl');
    expect(chart).toContain('BarChart');
    expect(chart).toContain('ExportMenu');
    expect(chart).toContain('targetRef={exportRef}');
    expect(importer).toContain('saveTemplate');
    expect(importer).toContain('applySavedTemplate');
    expect(router).toContain('templates: protectedProcedure');
    expect(router).toContain('deleteTemplate: protectedProcedure');
    expect(chart).not.toContain('Math.random');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = () => readFileSync(resolve(process.cwd(), 'client/src/components/BIPanel.tsx'), 'utf8');

describe('BI STOX in-place data depth contract', () => {
  it('keeps the original five tabs without a parallel research page', () => {
    const file = read();
    for (const label of ['行业覆盖', '目标价变化', '共识vs实际', '多维评分', '预测准确率']) expect(file).toContain(label);
    expect(file).not.toContain('StockMarketResearchLayer');
    expect(file).not.toContain('StockCapabilityAnalysisTool');
  });

  it('does not generate static or random industry data', () => {
    const file = read();
    expect(file).not.toMatch(/Math\.random|Math\.sin|Math\.cos|TARGET_CHANGES|INDUSTRY_COVERAGE|RADAR_DATA|ACCURACY_BY_SECTOR|FORECAST_DATA/);
    expect(file).toContain('getSovereignMacro.useQuery');
    expect(file).toContain('getMultipleRateSeries.useQuery');
    expect(file).toContain('目标价变化暂不可读');
    expect(file).toContain('预测准确率暂不可读');
  });

  it('exposes source and refresh state in the existing work area', () => {
    const file = read();
    expect(file).toContain('refetchInterval: 120_000');
    expect(file).toContain('refetchInterval: 60_000');
    expect(file).toContain('refetchOnReconnect: true');
    expect(file).toContain('来源：World Bank / FRED');
    expect(file).toContain('读取失败');
  });
});

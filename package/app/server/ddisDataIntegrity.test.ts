import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const panel = readFileSync(resolve(process.cwd(), 'client/src/components/DDISPanel.tsx'), 'utf8');

describe('DDIS in-place data integrity', () => {
  it('merges exchange-qualified aliases without deleting the original identifier', () => {
    expect(panel).toContain('function securityKey');
    expect(panel).toContain('合并别名：');
    expect(panel).toContain("item.market === 'stock'");
  });

  it('never maps dividend sorting to price or volume fields', () => {
    expect(panel).toContain("yield: 'dividendYield'");
    expect(panel).toContain("growth5y: 'dividendGrowth5y'");
    expect(panel).toContain("consecutive: 'consecutiveYears'");
    expect(panel).not.toContain("sortBy === 'yield' ? 'changePct'");
    expect(panel).not.toContain("sortBy === 'growth5y' ? 'changeVal'");
  });

  it('keeps public history and explicit unavailable states in the original page', () => {
    expect(panel).toContain('trpc.market.getHistory.useQuery');
    expect(panel).toContain('原页面深度价格序列（非股息序列）');
    expect(panel).toContain('当前实例未配置公司行动/股息许可源');
  });
});

import { describe, expect, it } from 'vitest';
import { calculateStockResearchScore } from '../client/src/lib/stockResearchScore';

const bars = Array.from({ length: 12 }, (_, index) => {
  const close = 100 + index * 2;
  return {
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    close,
    high: close + 2,
    low: close - 2,
    volume: 1_000 + index * 50,
    sma5: index < 4 ? null : 100 + (index - 2) * 2,
    sma10: index < 9 ? null : 100 + (index - 4.5) * 2,
  };
});

describe('公共日频股票标的研究评分', () => {
  it('只在 MA5、MA10 与足够历史样本可用时计算可解释分项', () => {
    const result = calculateStockResearchScore(bars);
    expect(result.available).toBe(true);
    expect(result.total).not.toBeNull();
    expect(result.trend).toBeGreaterThan(0);
    expect(result.momentum).toBeGreaterThan(0);
    expect(result.methodology).toContain('趋势 40');
    expect(result.reason).toContain('公共日频 OHLCV');
  });

  it('在历史样本或均线不足时不输出伪评分', () => {
    const result = calculateStockResearchScore(bars.slice(0, 8));
    expect(result.available).toBe(false);
    expect(result.total).toBeNull();
    expect(result.label).toBe('样本不足');
  });
});

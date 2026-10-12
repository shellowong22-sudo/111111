import { describe, expect, it } from 'vitest';
import { calculateFixedRateBond } from './routers/pricing';

describe('主权债固定票息现金流估值', () => {
  it('票息等于收益率时，净价接近面值', () => {
    const result = calculateFixedRateBond(1_000_000, 0.04, 0.04, 10, 2);
    expect(result.cleanPricePer100).toBeCloseTo(100, 6);
    expect(result.presentValue).toBeCloseTo(1_000_000, 4);
  });

  it('收益率上行降低现值，且 DV01 为正的货币敏感度', () => {
    const lowYield = calculateFixedRateBond(1_000_000, 0.04, 0.035, 10, 2);
    const highYield = calculateFixedRateBond(1_000_000, 0.04, 0.045, 10, 2);
    expect(lowYield.presentValue).toBeGreaterThan(highYield.presentValue);
    expect(lowYield.dv01).toBeGreaterThan(0);
  });

  it('现金流末期包含本金偿还，久期小于到期年限', () => {
    const result = calculateFixedRateBond(1_000_000, 0.03, 0.04, 5, 2);
    expect(result.cashflows.at(-1)?.cashflow).toBeGreaterThan(1_000_000);
    expect(result.modifiedDuration).toBeLessThan(5);
  });
});

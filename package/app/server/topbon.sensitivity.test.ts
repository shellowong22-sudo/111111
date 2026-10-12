import { describe, expect, it } from 'vitest';
import { calculateBondDurationSensitivity } from './routers/topbon';

describe('TOP BON 一阶久期敏感性', () => {
  it('收益率上行时正久期债券组合出现负估计损益', () => {
    const result = calculateBondDurationSensitivity(10_000_000, 7, 25);
    expect(result.estimatedPnl).toBe(-175_000);
    expect(result.estimatedPnlPct).toBeCloseTo(-1.75);
  });

  it('收益率下行时正久期债券组合出现正估计损益', () => {
    const result = calculateBondDurationSensitivity(10_000_000, 7, -25);
    expect(result.estimatedPnl).toBe(175_000);
  });
});

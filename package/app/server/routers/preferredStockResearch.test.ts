import { describe, expect, it } from 'vitest';
import { parseFredCsv } from './preferredStockResearch';

describe('preferredStockResearch public-source parsing', () => {
  const rateDefinition = { id: 'DGS10', label: '10 年期国债参照', group: 'rate' as const };

  it('parses actual numeric observations and retains a terminal-only rate boundary', () => {
    const result = parseFredCsv('DATE,DGS10\n2026-08-14,4.68\n2026-08-18,4.71\n', rateDefinition);
    expect(result.status).toBe('available');
    expect(result.observationDate).toBe('2026-08-18');
    expect(result.value).toBe(4.71);
    expect(result.changeBps).toBe(3);
    expect(result.history).toHaveLength(2);
    expect(result.limitation).toContain('不是优先股个券收益率');
  });

  it('keeps missing source observations empty rather than substituting a simulated value', () => {
    const result = parseFredCsv('DATE,DGS10\n2026-08-14,.\n', rateDefinition);
    expect(result.status).toBe('unavailable');
    expect(result.value).toBeNull();
    expect(result.history).toEqual([]);
  });
});

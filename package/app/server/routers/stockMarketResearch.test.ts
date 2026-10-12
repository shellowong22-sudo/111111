import { describe, expect, it } from 'vitest';
import { parseStockFredCsv } from './stockMarketResearch';

describe('stock market terminal research source boundaries', () => {
  it('parses only actual FRED observations and preserves unavailable status without invented points', () => {
    const available = parseStockFredCsv('DATE,SP500\n2026-08-18,7691.76\n2026-08-19,7707.98\n', { id: 'SP500', label: '标普 500', group: 'equity' });
    expect(available.status).toBe('available');
    expect(available.value).toBe(7707.98);
    expect(available.history).toHaveLength(2);
    const unavailable = parseStockFredCsv('DATE,SP500\n2026-08-18,.\n', { id: 'SP500', label: '标普 500', group: 'equity' });
    expect(unavailable.status).toBe('unavailable');
    expect(unavailable.history).toEqual([]);
  });
});

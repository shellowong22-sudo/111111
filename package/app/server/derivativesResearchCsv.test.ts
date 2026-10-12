import { describe, expect, it } from 'vitest';
import { buildDerivativesResearchCsv } from '../client/src/lib/derivativesResearchCsv';

describe('derivatives public data csv', () => {
  it('exports actual series, sources, boundary and CFTC report rows without synthetic fields', () => {
    const csv = buildDerivativesResearchCsv({ title: '公开信用环境', readAt: '2026-08-21T00:00:00.000Z', boundary: '不提供单名 CDS', series: [{ label: 'CBOE VIX', unit: '指数', source: 'FRED / CBOE', history: [{ date: '2026-08-19', value: 14.89 }] }], cot: { source: 'CFTC 周度', contract: 'UST BOND', reportDate: '2026-08-11', openInterest: 100 } }, [{ reportDate: '2026-08-04', rows: [{ category: '资产管理人', long: 12, short: 7, net: 5 }] }]);
    expect(csv).toContain('FRED / CBOE');
    expect(csv).toContain('不提供单名 CDS');
    expect(csv).toContain('CFTC 周度历史');
    expect(csv).not.toContain('模拟');
  });
});

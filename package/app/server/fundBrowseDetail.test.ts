import { describe, expect, it } from 'vitest';
import { buildFundDetailHistory, chooseFundPageCandidates, selectVisibleFund } from '../client/src/pages/FundBrowse';

describe('fund detail uses only its own dated observations', () => {
  it('sorts, deduplicates and calculates adjacent changes from actual values', () => {
    const result = buildFundDetailHistory([
      { date: '2026-10-02', value: 1.1 },
      { date: '2026-10-01', value: 1 },
      { date: '2026-10-02', value: 1.2 },
      { date: 'not-a-date', value: 4 },
      { date: '2026-09-30', value: 0 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: '2026-10-01', value: 1, changePercent: null });
    expect(result[1]).toMatchObject({ date: '2026-10-02', value: 1.2 });
    expect(result[1].changePercent).toBeCloseTo(20);
  });

  it('cannot infer a move from a single observation', () => {
    expect(buildFundDetailHistory([{ date: '2026-10-01', value: 1.057 }])).toEqual([
      { date: '2026-10-01', value: 1.057, changePercent: null },
    ]);
  });

  it('does not append the same mapped catalogue to every archive page', () => {
    const mapped = [
      { id: 'SPY', name: 'SPDR ETF', category: 'ETF' },
      { id: 'ABC', name: 'Other', category: '未分类' },
    ];
    const first = chooseFundPageCandidates([{ id: '000001', name: 'Fund 1', category: '开放式基金' }], mapped, 'all', '', 0);
    const second = chooseFundPageCandidates([{ id: '000002', name: 'Fund 2', category: '开放式基金' }], mapped, 'all', '', 1);
    expect(first.rows.map(row => row.id)).toEqual(['000001']);
    expect(second.rows.map(row => row.id)).toEqual(['000002']);
    expect(chooseFundPageCandidates([], mapped, 'ETF', '', 0).rows.map(row => row.id)).toEqual(['SPY']);
    expect(chooseFundPageCandidates([], mapped, 'all', 'SPY', 0).rows.map(row => row.id)).toEqual(['SPY']);
    expect(chooseFundPageCandidates([], mapped, 'all', 'SPY', 1).rows).toEqual([]);
  });

  it('never carries a hidden fund detail into another page or category', () => {
    const openFund = { id: '000128', category: '开放式基金' };
    const etf = { id: '551000', category: 'ETF' };
    expect(selectVisibleFund([openFund], openFund.id)).toEqual(openFund);
    expect(selectVisibleFund([etf], openFund.id)).toBeNull();
    expect(selectVisibleFund([etf], etf.id)).toEqual(etf);
  });
});

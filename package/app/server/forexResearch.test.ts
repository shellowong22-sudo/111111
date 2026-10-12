import { describe, expect, it } from 'vitest';
import { buildDecisionWindow, EVENT_SERIES_BY_CURRENCY, filterSameDayTimelineEvents, FOREX_MODULE_CONFIG, deriveForexCrosses, groupSameDayDecisions, nearbyObservation, parseForexFredCsv } from './routers/forexResearch';

describe('forex public-research contract', () => {
  it('keeps a differentiated study configuration for every active forex menu entry', () => {
    const expected = ['FXIP', 'FXDS', 'FXTF', 'FXC', 'WCR', 'WVOL', 'XCCY', 'GMM', 'FXSW', 'XDSH', 'FXFC', 'WCRS', 'ECMI', 'MYQ', 'ALLQ', 'FRD', 'OVML', 'BFIX', 'FXFA', 'GP', 'FIRS', 'TOP_FX', 'STNI', 'RES', 'BICO', 'MARS_FX'];
    expect(expected.every((id) => id in FOREX_MODULE_CONFIG)).toBe(true);
    expect(new Set(expected.map((id) => FOREX_MODULE_CONFIG[id as keyof typeof FOREX_MODULE_CONFIG].mode)).size).toBeGreaterThan(8);
  });

  it('parses only actual numeric FRED observations and never turns missing values into zero', () => {
    expect(parseForexFredCsv('DATE,DEXUSEU\n2026-08-14,1.1581\n2026-08-15,.\n2026-08-16,\n')).toEqual([{ date: '2026-08-14', value: 1.1581 }]);
  });

  it('derives crosses only from actual compatible currency readings with correct USD orientation', () => {
    const input: any[] = [
      { id: 'DEXUSEU', currency: 'EUR', orientation: 'usd_per_foreign', status: 'available', value: 1.2, history: [{ date: '2026-08-14', value: 1.2 }, { date: '2026-08-15', value: 1.21 }] },
      { id: 'DEXJPUS', currency: 'JPY', orientation: 'foreign_per_usd', status: 'available', value: 150, history: [{ date: '2026-08-14', value: 150 }] },
      { id: 'DEXUSUK', currency: 'GBP', orientation: 'usd_per_foreign', status: 'available', value: 1.5, history: [{ date: '2026-08-14', value: 1.5 }] },
      { id: 'DEXCAUS', currency: 'CAD', orientation: 'foreign_per_usd', status: 'unavailable', value: null, history: [] },
    ];
    const crosses = deriveForexCrosses(input as any);
    expect(crosses.find((row) => row.pair === 'EUR/JPY')?.value).toBe(180);
    expect(crosses.find((row) => row.pair === 'EUR/GBP')?.value).toBe(0.8);
    expect(crosses.find((row) => row.pair === 'EUR/JPY')?.observationDate).toBe('2026-08-14');
    expect(crosses.some((row) => row.pair === 'AUD/CAD')).toBe(false);
  });

  it('states explicit boundaries for restricted basis, fixing, options and execution modules', () => {
    for (const id of ['XCCY', 'OVML', 'BFIX', 'MARS_FX'] as const) {
      const source = JSON.stringify(FOREX_MODULE_CONFIG[id]);
      expect(FOREX_MODULE_CONFIG[id].seriesIds).toEqual([]);
      expect(source).toMatch(/边界|无免费|无授权|无免费可执行/);
    }
  });

  it('maps new central-bank currencies to their actual FRED series and selects only nearest observed dates', () => {
    expect(EVENT_SERIES_BY_CURRENCY).toMatchObject({ JPY: 'DEXJPUS', CHF: 'DEXSZUS', CAD: 'DEXCAUS', AUD: 'DEXUSAL' });
    const history = [{ date: '2026-07-13', value: 1 }, { date: '2026-07-14', value: 2 }, { date: '2026-07-16', value: 3 }];
    expect(nearbyObservation(history, '2026-07-15', 'before')).toEqual({ date: '2026-07-14', value: 2 });
    expect(nearbyObservation(history, '2026-07-15', 'after')).toEqual({ date: '2026-07-16', value: 3 });
    expect(nearbyObservation([], '2026-07-15', 'after')).toBeNull();
  });

  it('normalizes each same-currency event window against its own actual pre-event observation', () => {
    const window = buildDecisionWindow([{ date: '2026-06-10', value: 0.65 }, { date: '2026-06-15', value: 0.66 }, { date: '2026-06-16', value: 0.67 }, { date: '2026-06-18', value: 0.68 }, { date: '2026-06-24', value: 0.69 }], '2026-06-16');
    expect(window.before).toEqual({ date: '2026-06-16', value: 0.67 });
    expect(window.after).toEqual({ date: '2026-06-16', value: 0.67 });
    expect(window.normalizedWindow.find((point) => point.date === '2026-06-16')?.base100).toBe(100);
    expect(window.normalizedWindow.find((point) => point.date === '2026-06-18')?.base100).toBeCloseTo(101.4925, 4);
    expect(window.normalizedWindow.find((point) => point.date === '2026-06-18')?.value).toBe(0.68);
  });

  it('groups only dates with at least two actual central-bank decisions for same-day filtering', () => {
    const groups = groupSameDayDecisions([
      { decisionDate: '2026-07-29', centralBankId: 'FED', centralBankName: '美联储', currency: 'USD', decision: 'hold', changeBps: null, voteSummary: '9–3' },
      { decisionDate: '2026-07-29', centralBankId: 'BOE', centralBankName: '英格兰银行', currency: 'GBP', decision: 'hold', changeBps: null, voteSummary: '6–3' },
      { decisionDate: '2026-07-23', centralBankId: 'ECB', centralBankName: '欧洲央行', currency: 'EUR', decision: 'hold', changeBps: null, voteSummary: null },
    ]);
    expect(groups).toEqual([expect.objectContaining({ date: '2026-07-29', count: 2, centralBanks: ['FED', 'BOE'] })]);
  });

  it('applies central-bank and related currency-pair conditions before enforcing the two-institution same-day boundary', () => {
    const events = [
      { decisionDate: '2026-07-29', centralBankId: 'FED', centralBankName: '美联储', currency: 'USD', decision: 'hold', changeBps: null, voteSummary: '9–3' },
      { decisionDate: '2026-07-29', centralBankId: 'BOE', centralBankName: '英格兰银行', currency: 'GBP', decision: 'hold', changeBps: null, voteSummary: '6–3' },
      { decisionDate: '2026-07-23', centralBankId: 'ECB', centralBankName: '欧洲央行', currency: 'EUR', decision: 'hold', changeBps: null, voteSummary: null },
    ];
    const matched = filterSameDayTimelineEvents(events, ['FED', 'BOE'], ['USD', 'GBPUSD'], ['hold']);
    expect(groupSameDayDecisions(matched)).toHaveLength(1);
    const singleCentralBank = filterSameDayTimelineEvents(events, ['FED'], ['USD']);
    expect(groupSameDayDecisions(singleCentralBank)).toEqual([]);
    expect(filterSameDayTimelineEvents(events, [], [], ['raise'])).toEqual([]);
  });
});

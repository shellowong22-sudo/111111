import { describe, expect, it } from 'vitest';
import { buildAudDecisionComparisonCsv } from './forexDecisionCsv';

describe('AUD decision comparison CSV', () => {
  it('exports only provided actual fields with source and boundary provenance', () => {
    const csv = buildAudDecisionComparisonCsv({ reading: { id: 'DEXUSAL', unit: '美元/澳元' }, boundary: '仅实际公开观察，不作归因。', rows: [{ decisionDate: '2026-08-11', centralBankId: 'RBA', centralBankName: '澳洲联储', decision: 'hold', policyRatePct: 4.35, changeBps: null, before: { date: '2026-08-11', value: 0.66 }, after: { date: '2026-08-11', value: 0.66 }, changePct: 0, relativeWindow: [{ dayOffset: 0, date: '2026-08-11', value: 0.66, base100: 100 }] }] });
    expect(csv).toContain('汇率序列');
    expect(csv).toContain('DEXUSAL');
    expect(csv).toContain('FRED / 美联储 H.10');
    expect(csv).toContain('2026-08-11');
    expect(csv).toContain('100');
    expect(csv).toContain('仅实际公开观察，不作归因。');
  });

  it('escapes quoted or comma-bearing provenance without inventing a row', () => {
    const csv = buildAudDecisionComparisonCsv({ boundary: '来源含,逗号与"引号"', rows: [] });
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});

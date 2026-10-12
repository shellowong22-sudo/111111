import { describe, expect, it } from 'vitest';
import { buildSlgsCsv } from '../client/src/components/municipal/MunicipalResearchLayer';

describe('municipal official activity CSV export', () => {
  it('exports only supplied official activity fields and leaves missing fields empty', () => {
    const csv = buildSlgsCsv([{ recordDate: '2026-08-18', newSubscriptionsAmount: 12.5, newSubscriptionsCount: 2, cancelledSubscriptionsAmount: 0, cancelledSubscriptionsCount: 0, demandDepositRedemptionsAmount: null, timeDepositRedemptionsAmount: 1, buckets: [{ id: '0-3m', label: '0–3M', issuedAmount: 5, issuedCount: 1, outstandingAmount: 10, outstandingCount: 2 }] }]);
    expect(csv.startsWith('\uFEFFrecord_date,new_subscriptions_amount')).toBe(true);
    expect(csv).toContain('0-3m_outstanding_count');
    expect(csv).toContain('2026-08-18,12.5,2,0,0,,1,5,1,10,2');
  });
});

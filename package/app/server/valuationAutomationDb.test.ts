import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

vi.mock('./realDataService', () => ({ fetchFredSeries: vi.fn() }));

import { fetchFredSeries } from './realDataService';
import { getDb } from './db';
import { getValuationAutomationStatus, runValuationAutomation, saveValuationAutomationSettings, setValuationAutomationTask } from './valuationAutomationDb';

const ownerId = 987654581;
const otherUserId = 987654582;
const mockedFred = vi.mocked(fetchFredSeries);

beforeEach(() => mockedFred.mockResolvedValue([{ date: '2026-08-22', value: 4.25 }]));
afterEach(async () => {
  vi.clearAllMocks();
  const db = await getDb();
  await db?.execute(sql`DELETE FROM valuation_automation_runs WHERE user_id IN (${ownerId}, ${otherUserId})`);
  await db?.execute(sql`DELETE FROM valuation_automation_settings WHERE user_id IN (${ownerId}, ${otherUserId})`);
});

describe('账户私有估值自动更新数据层', () => {
  it('uses only valid FRED observations, records inputs and skips duplicate scheduled refreshes', async () => {
    await saveValuationAutomationSettings(ownerId, { productId: 'UST10Y', notional: 1_000_000, couponRate: 0.04, frequency: 2, cronExpression: '0 0 23 * * 1-5' });
    await setValuationAutomationTask(ownerId, 'valuation-test-owner', true);
    const first = await runValuationAutomation(ownerId, 'scheduled');
    const duplicate = await runValuationAutomation(ownerId, 'scheduled');
    const status = await getValuationAutomationStatus(ownerId);
    expect(first).toMatchObject({ status: 'succeeded', curveYieldPct: 4.25, curveObservationDate: '2026-08-22', source: 'FRED DGS10' });
    expect(first.status === 'succeeded' && first.valuation.presentValue).toBeGreaterThan(0);
    expect(duplicate).toMatchObject({ status: 'skipped', reason: 'ALREADY_REFRESHED_FOR_CURVE_OBSERVATION' });
    expect(status.runs).toHaveLength(1);
    expect(status.runs[0]).toMatchObject({ triggerType: 'scheduled', status: 'succeeded', curveYieldPct: 4.25, productId: 'UST10Y' });
    expect(status.runs[0]?.methodology).toContain('未计应计利息');
  });

  it('fails visibly instead of treating missing or zero FRED data as a valuation yield, and keeps accounts isolated', async () => {
    await saveValuationAutomationSettings(ownerId, { productId: 'UST2Y', notional: 1000, couponRate: 0.01, frequency: 1, cronExpression: '0 0 23 * * 1-5' });
    mockedFred.mockResolvedValue([{ date: '2026-08-22', value: 0 }]);
    const failed = await runValuationAutomation(ownerId, 'manual');
    const mine = await getValuationAutomationStatus(ownerId);
    const other = await getValuationAutomationStatus(otherUserId);
    expect(failed).toMatchObject({ status: 'failed' });
    expect(mine.setting.lastStatus).toBe('failed');
    expect(mine.runs[0]?.errorMessage).toContain('有效正收益率观测');
    expect(other.runs).toHaveLength(0);
    expect(other.setting.userId).toBe(otherUserId);
  });
});

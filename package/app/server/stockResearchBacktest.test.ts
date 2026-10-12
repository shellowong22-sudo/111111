import { describe, expect, it } from 'vitest';
import { runDailyTrendResearchBacktest } from '../client/src/lib/stockResearchBacktest';

describe('股票日频研究回测', () => {
  it('uses a one-trading-day censor gap after the MA5/MA10 signal and does not look ahead to form it', () => {
    const history = Array.from({ length: 14 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, '0')}`, close: 100 + index }));
    const result = runDailyTrendResearchBacktest(history);
    expect(result.status).toBe('available');
    expect(result.statistics.sampleCount).toBe(4);
    expect(result.signals[0]).toMatchObject({ signalDate: '2026-08-10', evaluationDate: '2026-08-11', direction: '偏强' });
    expect(result.statistics.positiveCount).toBe(4);
  });

  it('returns an honest insufficient state instead of statistics when fewer than twelve daily observations exist', () => {
    const result = runDailyTrendResearchBacktest([{ date: '2026-08-01', close: 100 }]);
    expect(result.status).toBe('insufficient');
    expect(result.statistics.sampleCount).toBe(0);
    expect(result.statistics.positiveRatePct).toBeNull();
  });

  it('uses the selected future trading-day observation, deducts both transaction-cost sides, and compounds an aligned SPY benchmark', () => {
    const history = Array.from({ length: 16 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, '0')}`, close: 100 + index }));
    const benchmark = Array.from({ length: 16 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, '0')}`, close: 200 + index * 0.5 }));
    const result = runDailyTrendResearchBacktest(history, { holdingPeriod: 3, transactionCostBps: 10, benchmarkHistory: benchmark, requireBenchmark: true });
    expect(result.status).toBe('available');
    expect(result.signals[0]).toMatchObject({ signalDate: '2026-08-10', evaluationDate: '2026-08-13', holdingPeriod: 3, transactionCostBps: 10, roundTripCostPct: 0.2 });
    expect(result.signals[0].researchReturnPct).toBeCloseTo(result.signals[0].grossResearchReturnPct - 0.2, 8);
    expect(result.signals[0].benchmarkReturnPct).toBeCloseTo((result.signals[0].benchmarkGrossReturnPct ?? 0) - 0.2, 8);
    expect(result.netValueCurve).toHaveLength(result.statistics.sampleCount + 1);
    expect(result.statistics.benchmarkCumulativeReturnPct).not.toBeNull();
  });

  it('excludes rather than fabricates a signal when the benchmark lacks the same signal or evaluation date', () => {
    const history = Array.from({ length: 16 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, '0')}`, close: 100 + index }));
    const benchmark = history.filter((bar) => bar.date !== '2026-08-13').map((bar) => ({ ...bar, close: bar.close * 2 }));
    const result = runDailyTrendResearchBacktest(history, { holdingPeriod: 3, benchmarkHistory: benchmark, requireBenchmark: true });
    expect(result.candidateSignalCount).toBeGreaterThan(result.statistics.sampleCount);
    expect(result.excludedForBenchmarkCount).toBeGreaterThan(0);
    expect(result.signals.every((signal) => signal.benchmarkReturnPct != null)).toBe(true);
  });

  it('does not show standalone strategy statistics while a required public benchmark has not returned', () => {
    const history = Array.from({ length: 16 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, '0')}`, close: 100 + index }));
    const result = runDailyTrendResearchBacktest(history, { requireBenchmark: true });
    expect(result.status).toBe('insufficient');
    expect(result.reason).toContain('SPY');
    expect(result.statistics.sampleCount).toBe(0);
  });
});

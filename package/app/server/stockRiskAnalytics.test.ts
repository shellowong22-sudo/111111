import { describe, it, expect } from "vitest";
import {
  alignedPricePaths,
  changeCorrelation,
  priceRiskPath,
  priceRiskSummary,
} from "../client/src/components/stock/stockRiskAnalytics";

const points = (values: number[]) =>
  values.map((value, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    value,
  }));
describe("EQBT price risk analytics", () => {
  it("computes cumulative price return and running-peak drawdown without future leakage", () => {
    const result = priceRiskSummary(points([100, 120, 90, 108, 125]));
    expect(result.cumulativeReturn).toBeCloseTo(25);
    expect(result.maxDrawdown).toBeCloseTo(-25);
    expect(result.path.map(row => row.drawdown)).toEqual([
      0, 0, -25, -9.999999999999998, 0,
    ]);
    expect(result.path[0].returnPct).toBeNull();
    expect(result.sampleCount).toBe(5);
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-01-05");
  });
  it("preserves the previously computed risk history when a future peak is appended", () => {
    const prefix = priceRiskPath(points([100, 90, 95]));
    expect(priceRiskPath(points([100, 90, 95, 200])).slice(0, 3)).toEqual(
      prefix
    );
  });
  it("has no manufactured summary in the empty state", () => {
    const result = priceRiskSummary([]);
    expect(result.maxDrawdown).toBeNull();
    expect(result.cumulativeReturn).toBeNull();
    expect(result.sampleCount).toBe(0);
    expect(result.monthly).toEqual([]);
  });
  it("does not count invalid, zero, negative, or conflicting daily observations", () => {
    const result = priceRiskSummary([
      ...points([100, 0, -1, NaN]),
      { date: "2026-02-30", value: 200 },
      { date: "2026-01-01", value: 101 },
    ]);
    expect(result.sampleCount).toBe(0);
  });
  it("builds monthly returns from prior-month final observation and marks partial initial month", () => {
    const result = priceRiskSummary([
      { date: "2026-01-30", value: 100 },
      { date: "2026-02-02", value: 90 },
      { date: "2026-02-27", value: 110 },
      { date: "2026-03-02", value: 121 },
    ]);
    expect(result.monthly[0].partialStart).toBe(true);
    expect(result.monthly[1].partialStart).toBe(false);
    expect(result.monthly[1].start).toBe("2026-01-30");
    expect(result.monthly[1].count).toBe(2);
    expect(result.monthly[1].priceReturn).toBeCloseTo(10);
    expect(result.monthly[2].priceReturn).toBeCloseTo(10);
  });
  it("sorts dates and deduplicates exact repeats before calculating returns", () => {
    const result = priceRiskSummary([
      { date: "2026-01-02", value: 120 },
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-02", value: 120 },
    ]);
    expect(result.sampleCount).toBe(2);
    expect(result.cumulativeReturn).toBeCloseTo(20);
  });
  it("aligns comparison curves only on shared dates without filling gaps", () => {
    const result = alignedPricePaths(points([100, 120, 130]), [
      { date: "2026-01-01", value: 200 },
      { date: "2026-01-03", value: 220 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[1].leftIndex).toBe(130);
    expect(result[1].relativeReturn).toBeCloseTo((1.3 / 1.1 - 1) * 100);
  });
  it("correlates only shared observation intervals and rejects insufficient or constant samples", () => {
    expect(
      changeCorrelation(points([1, 2, 4, 7]), points([2, 4, 8, 14])).correlation
    ).toBeCloseTo(1);
    expect(
      changeCorrelation(points([1, 2, 3, 4]), points([1, 1, 1, 1])).correlation
    ).toBeNull();
    expect(
      changeCorrelation(points([1, 2, 4, 7]), [
        { date: "2026-01-01", value: 1 },
        { date: "2026-01-03", value: 2 },
        { date: "2026-01-04", value: 3 },
      ]).count
    ).toBe(1);
  });
});

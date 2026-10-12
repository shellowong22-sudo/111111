import { describe, expect, it } from "vitest";
import {
  parseHoldings,
  portfolioAnalysis,
  validTimestamp,
} from "../client/src/components/preferredstock/portfolioAnalytics";
import { changeStatistics } from "../client/src/components/preferredstock/environmentAnalytics";

const snapshot =
  "A-P\tIssuer A\t600\t50\tUSD\nA-Q\tIssuer A\t100\t10\tUSD\nB-P\tIssuer B\t300\t40\tUSD";
describe("preferred portfolio unique snapshot and business calculations", () => {
  it("computes cross-factor bp-change statistics instead of duplicating current quotes", () => {
    const result = changeStatistics([
      { date: "2026-01-01", value: 4 },
      { date: "2026-01-02", value: 4.1 },
      { date: "2026-01-03", value: 4 },
      { date: "2026-01-04", value: 4 },
    ]);
    expect(result.count).toBe(3);
    expect(result.up).toBe(1);
    expect(result.down).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.maxAbsoluteBps).toBeCloseTo(10);
    expect(result.standardDeviationBps).toBeCloseTo(10);
    expect(changeStatistics([]).standardDeviationBps).toBeNull();
  });
  it("combines issuer exposures while keeping individual securities", () => {
    const parsed = parseHoldings(snapshot);
    expect(parsed.errors).toEqual([]);
    const model = portfolioAnalysis(parsed.rows);
    expect(model.total).toBe(1000);
    expect(model.positions).toHaveLength(3);
    expect(model.issuers).toEqual([
      { issuer: "Issuer A", marketValue: 700, weightPct: 70 },
      { issuer: "Issuer B", marketValue: 300, weightPct: 30 },
    ]);
    expect(model.hhi).toBeCloseTo(0.58);
  });
  it("uses target-current difference, preserves capital and computes one-way turnover", () => {
    const model = portfolioAnalysis(parseHoldings(snapshot).rows);
    expect(model.targetValid).toBe(true);
    expect(model.rebalance.map(row => row.adjustmentValue)).toEqual([
      -100, 0, 100,
    ]);
    expect(model.rebalance.map(row => row.deviationPct)).toEqual([-10, 0, 10]);
    expect(
      model.rebalance.reduce((sum, row) => sum + row.adjustmentValue!, 0)
    ).toBe(0);
    expect(model.turnover).toBe(10);
  });
  it("does not treat missing targets as zero or create a trade", () => {
    const model = portfolioAnalysis(
      parseHoldings(snapshot.replace("600\t50", "600\t")).rows
    );
    expect(model.missingTargets).toEqual(["A-P"]);
    expect(model.targetValid).toBe(false);
    expect(model.turnover).toBeNull();
    expect(model.rebalance.every(row => row.adjustmentValue === null)).toBe(
      true
    );
  });
  it("blocks a target total that differs from 100 percent", () => {
    const model = portfolioAnalysis(
      parseHoldings(snapshot.replace("600\t50", "600\t55")).rows
    );
    expect(model.targetTotal).toBe(105);
    expect(model.targetValid).toBe(false);
    expect(model.rebalance[0].targetValue).toBeNull();
  });
  it("rejects duplicates and mixed currencies without partial application", () => {
    expect(
      parseHoldings(`${snapshot}\nA-P\tIssuer A\t10\t0\tUSD`).rows
    ).toEqual([]);
    expect(
      parseHoldings(snapshot.replace(/USD$/, "EUR")).errors.join("")
    ).toContain("多币种");
  });
  it("does not turn absent, negative, or invalid market values into zero", () => {
    for (const value of ["", "-1", "NaN", "Infinity"])
      expect(parseHoldings(`A\tA\t${value}\t100\tUSD`).rows).toEqual([]);
    const zero = portfolioAnalysis(parseHoldings("A\tA\t0\t100\tUSD").rows);
    expect(zero.hhi).toBeNull();
    expect(zero.targetValid).toBe(false);
  });
  it("requires timestamp with timezone and accepts explicit observed zero target", () => {
    expect(validTimestamp("2026-09-10T09:00:00+08:00")).toBe(true);
    expect(validTimestamp("2026-09-10T09:00:00")).toBe(false);
    expect(parseHoldings("A\tA\t10\t0\tUSD").rows[0].targetWeightPct).toBe(0);
  });
});

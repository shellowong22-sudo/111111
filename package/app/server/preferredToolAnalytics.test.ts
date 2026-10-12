import { describe, expect, it } from "vitest";
import {
  evaluatePreferredTerm,
  executionAnalysis,
  parseExecutionFills,
} from "../client/src/components/preferredstock/preferredToolAnalytics";

const term = {
  id: 1,
  securityIdentifier: "TEST-P",
  issuerName: "Test issuer",
  cik: "123",
  dividendType: "fixed",
  couponRatePct: "5",
  paymentFrequency: "quarterly",
  firstCallDate: "2027-09-10",
  asOfDate: "2026-09-01",
  sourceReference: "Authorized imported terms",
};
const rules = {
  asOf: "2026-09-10",
  minimumCoupon: 4,
  minimumCallDays: 180,
  maximumAgeDays: 30,
};
const fill =
  "ORD1\tF1\tTEST-P\t2026-09-10T09:00:00+08:00\tBUY\t10\t101\t100\t2\tUSD\tBroker export";
describe("preferred real term screening", () => {
  it("uses transparent term rules, not random yield/rating/score", () => {
    const result = evaluatePreferredTerm(term, rules);
    expect(result.status).toBe("符合当前规则");
    expect(result.completenessPct).toBe(100);
    expect(result.rules.find(row => row.id === "freshness")?.value).toBe(
      "9 天"
    );
    expect(result.rules.find(row => row.id === "call")?.value).toBe("365 天");
    expect(evaluatePreferredTerm(term, rules)).toEqual(result);
  });
  it("keeps missing terms unknown, does not fill a zero rate or infer perpetual status", () => {
    const result = evaluatePreferredTerm(
      {
        ...term,
        couponRatePct: null,
        firstCallDate: null,
        sourceReference: "",
      },
      rules
    );
    expect(result.status).toBe("待补证");
    expect(result.unknown).toBe(3);
    expect(result.rules.find(row => row.id === "coupon")?.value).toBe("未提供");
    expect(result.completenessPct).toBe(60);
  });
  it("rejects rules below thresholds and blocks future-dated term use", () => {
    const result = evaluatePreferredTerm(
      {
        ...term,
        asOfDate: "2026-09-11",
        firstCallDate: "2026-09-11",
        couponRatePct: 3,
      },
      rules
    );
    expect(result.failed).toBe(3);
    expect(result.status).toBe("不符合");
    expect(result.rules.find(row => row.id === "freshness")?.reason).toContain(
      "前视"
    );
  });
  it("distinguishes disabled thresholds from a passed test", () => {
    const result = evaluatePreferredTerm(term, {
      ...rules,
      minimumCoupon: null,
      minimumCallDays: null,
      maximumAgeDays: null,
    });
    expect(
      result.rules.filter(row => row.state === "not_requested")
    ).toHaveLength(3);
  });
});
describe("execution review of source-backed fills", () => {
  it("calculates buy costs against benchmark with fees and quantity weighting", () => {
    const parsed = parseExecutionFills(
      `${fill}\n${fill.replace("F1", "F2").replace("09:00", "09:01").replace("10\t101", "30\t99")}`
    );
    expect(parsed.errors).toEqual([]);
    const model = executionAnalysis(parsed.rows)!;
    expect(model.quantity).toBe(40);
    expect(model.executedVwap).toBe(99.5);
    expect(model.slippage).toBe(-20);
    expect(model.fees).toBe(4);
    expect(model.totalCost).toBe(-16);
    expect(model.totalBps).toBe(-40);
    expect(model.rows.at(-1)?.cumulativeCost).toBe(-16);
    expect(model.slippageBps + model.feeBps).toBeCloseTo(model.totalBps);
  });
  it("reverses price difference for a sell without reversing fees", () => {
    const model = executionAnalysis(
      parseExecutionFills(fill.replace("BUY", "SELL")).rows
    )!;
    expect(model.slippage).toBe(-10);
    expect(model.fees).toBe(2);
    expect(model.totalCost).toBe(-8);
  });
  it("does not merge different currencies or instruments", () => {
    const a = parseExecutionFills(fill).rows[0];
    expect(executionAnalysis([a, { ...a, currency: "EUR" }])).toBeNull();
    expect(
      executionAnalysis([a, { ...a, instrumentId: "OTHER-P" }])
    ).toBeNull();
  });
  it("hides combined VWAP for mixed directions while preserving signed costs", () => {
    const a = parseExecutionFills(fill).rows[0];
    const model = executionAnalysis([
      a,
      { ...a, orderId: "ORD2", fillId: "F2", side: "SELL" },
    ])!;
    expect(model.executedVwap).toBeNull();
    expect(model.slippage).toBe(0);
    expect(model.totalCost).toBe(4);
  });
  it("rejects duplicate fills and conflicting order identities atomically", () => {
    expect(parseExecutionFills(`${fill}\n${fill}`).rows).toEqual([]);
    expect(
      parseExecutionFills(
        `${fill}\n${fill.replace("F1", "F2").replace("BUY", "SELL")}`
      ).errors.join("")
    ).toContain("不一致");
    expect(
      parseExecutionFills(
        `${fill}\n${fill.replace("F1", "F2").replace("101\t100", "101\t99")}`
      ).rows
    ).toEqual([]);
  });
  it("validates timezones, sources and positive fields without sample substitution", () => {
    expect(parseExecutionFills(fill.replace("+08:00", "")).rows).toEqual([]);
    expect(parseExecutionFills(fill.replace("Broker export", "")).rows).toEqual(
      []
    );
    expect(parseExecutionFills(fill.replace("10\t101", "0\t101")).rows).toEqual(
      []
    );
    expect(parseExecutionFills(fill.replace("10\t101", "\t101")).rows).toEqual(
      []
    );
    expect(parseExecutionFills(fill.replace("100\t2", "100\t-2")).rows).toEqual(
      []
    );
    expect(parseExecutionFills("").errors).toHaveLength(1);
  });
  it("normalizes and orders observations in UTC", () => {
    const parsed = parseExecutionFills(
      `${fill}\n${fill.replace("F1", "F2").replace("09:00", "08:00")}`
    );
    expect(parsed.rows[0].timestamp).toBe("2026-09-10T00:00:00.000Z");
    expect(parsed.rows[0].fillId).toBe("F2");
  });
});

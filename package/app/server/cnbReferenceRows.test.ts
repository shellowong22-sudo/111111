import { describe, expect, it } from "vitest";
import { deriveCnbCrossHistory, deriveCnbCrossRate, parseCnbReferenceDatasets } from "../client/src/lib/cnbReferenceRows";

describe("CNB FXC archive mapping", () => {
  const pairs = parseCnbReferenceDatasets([{
    dataset: {
      label: "捷克央行多币种参考汇率",
      rows: [
        { 观察期: "2026-09-24", 标的: "EUR/CZK", 中间参考汇率: 24.2, 单位: "CZK/EUR" },
        { 观察期: "2026-09-25", 标的: "EUR/CZK", 中间参考汇率: 24.35, 单位: "CZK/EUR" },
        { 观察期: "2026-09-24", 标的: "HUF/CZK", 中间参考汇率: 0.066, 单位: "CZK/HUF" },
        { 观察期: "2026-09-25", 标的: "HUF/CZK", 中间参考汇率: 0.06663, 单位: "CZK/HUF" },
      ],
    },
  }]);

  it("keeps one history per pair and derives same-day crosses", () => {
    expect(pairs).toHaveLength(2);
    expect(deriveCnbCrossRate(pairs, "EUR", "HUF")).toBeCloseTo(365.451, 1);
    expect(deriveCnbCrossRate(pairs, "CZK", "EUR")).toBeCloseTo(1 / 24.35, 8);
    expect(deriveCnbCrossHistory(pairs, "EUR", "HUF")).toHaveLength(2);
  });

  it("rejects wrong units and malformed dates", () => {
    expect(parseCnbReferenceDatasets([{
      dataset: {
        label: "捷克央行多币种参考汇率",
        rows: [
          { 观察期: "09:30", 标的: "EUR/CZK", 中间参考汇率: 24.35, 单位: "CZK/EUR" },
          { 观察期: "2026-09-25", 标的: "EUR/CZK", 中间参考汇率: 24.35, 单位: "EUR/CZK" },
        ],
      },
    }])).toEqual([]);
  });
});

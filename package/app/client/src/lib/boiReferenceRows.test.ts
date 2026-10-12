import { describe, expect, it } from "vitest";
import { deriveBoiCrossHistory, deriveBoiCrossRate, parseBoiReferenceDatasets } from "./boiReferenceRows";

describe("Bank of Israel archived FX rows", () => {
  const datasets = [{
    dataset: {
      label: "以色列银行多币种参考汇率",
      rows: [
        { symbol: "USD/ILS", date: "2026-09-30", value: 3.06, 单位: "ILS/USD" },
        { symbol: "USD/ILS", date: "2026-10-01", value: 3.07, 单位: "ILS/USD" },
        { symbol: "EUR/ILS", date: "2026-10-01", value: 3.47, 单位: "ILS/EUR" },
      ],
    },
  }];

  it("keeps one clean history per pair", () => {
    const pairs = parseBoiReferenceDatasets(datasets);
    expect(pairs.find(row => row.pair === "USD/ILS")).toMatchObject({ date: "2026-10-01", value: 3.07 });
    expect(deriveBoiCrossRate(pairs, "USD", "EUR")).toBeCloseTo(3.07 / 3.47, 8);
    expect(deriveBoiCrossHistory(pairs, "USD", "ILS")).toEqual([
      { date: "2026-09-30", value: 3.06 },
      { date: "2026-10-01", value: 3.07 },
    ]);
  });
});

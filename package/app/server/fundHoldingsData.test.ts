import { describe, expect, it } from "vitest";
import { mergeFundDisclosure, projectFundDisclosure } from "./fundHoldingsData";

const previous = {
  code: "000128",
  source: "AKShare / 天天基金公开持仓披露",
  retrievedAt: "2026-09-30T08:00:00Z",
  lastAttemptAt: "2026-09-30T08:00:00Z",
  errors: {},
  holdings: [{
    assetType: "bond" as const, symbol: "260401", name: "26农发01",
    weight: 3.26, period: "2026-Q2", quarter: "2026年2季度债券投资明细",
    collectedAt: "2026-09-30T08:00:00Z",
  }],
};

describe("AKShare fund holdings disclosure", () => {
  it("selects the newest disclosure quarter separately for stock and bond, and deduplicates securities", () => {
    const bonds = projectFundDisclosure("bond", [
      { "债券代码": "260401", "债券名称": "26农发01", "占净值比例": 3.1, "季度": "2026年1季度债券投资明细" },
      { "债券代码": "260401", "债券名称": "26农发01", "占净值比例": 3.26, "季度": "2026年2季度债券投资明细" },
      { "债券代码": "072610060", "债券名称": "26中信建投CP007", "占净值比例": 3.61, "季度": "2026年2季度债券投资明细" },
    ]);
    expect(bonds).toMatchObject([
      { symbol: "072610060", period: "2026-Q2", weight: 3.61 },
      { symbol: "260401", period: "2026-Q2", weight: 3.26 },
    ]);
    expect(projectFundDisclosure("stock", [
      { "股票代码": "300308", "股票名称": "中际旭创", "占净值比例": 4.31, "季度": "2026年1季度股票投资明细" },
    ])).toMatchObject([{ assetType: "stock", period: "2026-Q1" }]);
  });

  it("keeps only the same fund's old bond disclosure when its bond fetch fails", () => {
    const updated = mergeFundDisclosure(previous, {
      code: "000128", retrievedAt: "2026-10-02T09:00:00Z",
      results: { stock: [{ "股票代码": "300308", "股票名称": "中际旭创",
        "占净值比例": 4.31, "季度": "2026年1季度股票投资明细" }] },
      errors: { bond: "upstream unavailable" },
    }, "2026-10-02T09:00:01Z");
    expect(updated.holdings).toHaveLength(2);
    expect(updated.holdings.find(row => row.assetType === "bond")?.collectedAt).toBe("2026-09-30T08:00:00Z");
    expect(updated.holdings.find(row => row.assetType === "stock")?.collectedAt).toBe("2026-10-02T09:00:00Z");
    expect(updated.errors.bond).toBe("upstream unavailable");
  });

  it("does not accept missing identity, implausible weights or cross-quarter merging", () => {
    expect(projectFundDisclosure("stock", [
      { "股票代码": "300308", "股票名称": "中际旭创", "占净值比例": 101, "季度": "2026年2季度" },
      { "股票代码": "300308", "股票名称": "中际旭创", "占净值比例": 4, "季度": "2026年1季度" },
      { "股票代码": "", "股票名称": "未知", "占净值比例": 5, "季度": "2026年2季度" },
    ])).toMatchObject([{ symbol: "300308", period: "2026-Q1" }]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPickNewIssuanceSnapshot } from "./routers/municipalResearch";

describe("PICK municipal issuance truth boundary", () => {
  it("uses an isolated restricted contract instead of another bond dataset", () => {
    const snapshot = getPickNewIssuanceSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-pick-new-issuance");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.issues).toEqual([]);
    expect(snapshot.weeklyVolume).toEqual([]);
    expect(snapshot.pricingHistory).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不使用国债拍卖、SLGS 认购、MSRB 受限统计或静态样例替代"
    );
  });

  it("removes fixed issuances and preserves all four original views", () => {
    const source = readFileSync(
      new URL("../client/src/components/PICKPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/NEW_ISSUES|WEEKLY_VOLUME|PRICING_HISTORY/);
    expect(source).not.toMatch(
      /NI00[1-7]|2024-12-2[3-7]|高盛|摩根士丹利|JP摩根|Math\.random|https?:\/\//
    );
    for (const label of ["发行日历", "发行量趋势", "定价分析", "交易详情"])
      expect(source).toContain(label);
  });
});

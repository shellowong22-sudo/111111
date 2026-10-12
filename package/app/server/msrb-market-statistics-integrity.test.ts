import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMsrbMarketStatisticsSnapshot } from "./routers/municipalResearch";

describe("MSRB market statistics unique contract", () => {
  it("keeps every MSRB dataset empty when the structured feed is restricted", () => {
    const snapshot = getMsrbMarketStatisticsSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-msrb-market-statistics");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.marketStats).toEqual([]);
    expect(snapshot.monthlyVolume).toEqual([]);
    expect(snapshot.tradeTypes).toEqual([]);
    expect(snapshot.issuers).toEqual([]);
    expect(snapshot.complianceEvents).toEqual([]);
    expect(snapshot.activityTrend).toEqual([]);
    expect(snapshot.tradeTypeDistribution).toEqual([]);
    expect(snapshot.concentration).toEqual([]);
    expect(snapshot.transparency).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不使用 SLGS、BMA、VRDN、SOFR 或静态样例替代"
    );
  });

  it("removes fixed observations while preserving all six functional entries", () => {
    const source = readFileSync(
      new URL("../client/src/components/MSRBPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /MONTHLY_VOLUME|TOP_ISSUERS|TRADE_TYPES|COMPLIANCE_EVENTS|MARKET_STATS|MSRB_ACTIVITY_TREND|MSRB_TRADE_TYPE_DISTRIBUTION|MSRB_MARKET_CONCENTRATION/
    );
    expect(source).not.toMatch(
      /99\.2%|87\.5%|94\.8%|96\.3%|45\.2%|68\.1%|Math\.random|https?:\/\//
    );
    for (const label of [
      "市场统计",
      "发行人排名",
      "合规监控",
      "市场活跃度",
      "交易类型",
      "市场集中度",
    ]) {
      expect(source).toContain(label);
    }
  });
});

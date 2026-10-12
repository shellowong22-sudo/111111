import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCdrcCompetitiveCalendarSnapshot } from "./routers/municipalResearch";

describe("CDRC competitive underwriting unique contract", () => {
  it("keeps competitive auction data isolated and restricted", () => {
    const snapshot = getCdrcCompetitiveCalendarSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-cdrc-competitive-calendar");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.events).toEqual([]);
    expect(snapshot.competitionTrend).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不复用 CDRN 商议承销、PICK 发行日历、国债拍卖或静态竞价样例"
    );
  });

  it("removes fixed auction outcomes and preserves three original views", () => {
    const source = readFileSync(
      new URL("../client/src/components/CDRCPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/EVENTS|BIDDER_TREND/);
    expect(source).not.toMatch(
      /CR00[1-5]|2024-12-2[3-7]|摩根士丹利|高盛|9\.2家|2\.8bps|Math\.random|https?:\/\//
    );
    for (const label of ["竞价日历", "竞争分析", "中标详情"])
      expect(source).toContain(label);
  });
});

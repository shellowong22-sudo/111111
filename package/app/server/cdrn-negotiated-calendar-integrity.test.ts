import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCdrnNegotiatedCalendarSnapshot } from "./routers/municipalResearch";

describe("CDRN negotiated underwriting unique contract", () => {
  it("does not reuse PICK or other municipal slices", () => {
    const snapshot = getCdrnNegotiatedCalendarSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-cdrn-negotiated-calendar");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.events).toEqual([]);
    expect(snapshot.managerRankings).toEqual([]);
    expect(snapshot.premiumTrend).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不复用 PICK 发行日历、MBWD 询价、MSRB 汇总或静态承销样例"
    );
  });

  it("removes copied projects and preserves all four original entries", () => {
    const source = readFileSync(
      new URL("../client/src/components/CDRNPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/CDRN_EVENTS|MANAGER_STATS|PREMIUM_TREND/);
    expect(source).not.toMatch(
      /C00[1-8]|2024-12-2[3-7]|高盛|摩根士丹利|3\.2bps|Math\.random|https?:\/\//
    );
    for (const label of ["承销日历", "承销商排名", "溢价趋势", "交易详情"])
      expect(source).toContain(label);
  });
});

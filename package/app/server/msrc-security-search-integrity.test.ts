import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMsrcSecuritySearchSnapshot } from "./routers/municipalResearch";

describe("MSRC security search unique contract", () => {
  it("keeps security-directory results isolated from rating and issuer modules", () => {
    const snapshot = getMsrcSecuritySearchSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-msrc-security-search");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.securities).toEqual([]);
    expect(snapshot.resultDistribution).toEqual([]);
    expect(snapshot.matchedRatingChanges).toEqual([]);
    expect(snapshot.stateComparison).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不复用 CDRA 评级研究、SMUN 发行人档案、PICK 发行日历、SLGS"
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\//);
  });

  it("removes fixed province, rating and migration samples while retaining the original views", () => {
    const source = readFileSync(
      new URL("../client/src/components/MSRCPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /name: ['\"]广东|name: ['\"]江苏|month: ['\"]一月|totalIssuance: 1200|stable: 93|Math\.random|https?:\/\//
    );
    expect(source).toContain("地方债信用评级分布仪");
    expect(source).toContain("评级分布");
    expect(source).toContain("迁移趋势");
    expect(source).toContain("州对比");
    expect(source).toContain("getMsrcSecuritySearchStatus");
  });
});

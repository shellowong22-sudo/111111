import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCdraCreditRatingSnapshot } from "./routers/municipalResearch";

describe("CDRA credit rating unique contract", () => {
  it("keeps rating data restricted and isolated", () => {
    const snapshot = getCdraCreditRatingSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-cdra-credit-ratings");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.ratingDistribution).toEqual([]);
    expect(snapshot.migrationMatrix).toEqual([]);
    expect(snapshot.ratingActions).toEqual([]);
    expect(snapshot.spreadHistory).toEqual([]);
    expect(snapshot.defaultHistory).toEqual([]);
    expect(snapshot.limitation).toContain("不使用发行日历、MSRB 汇总");
  });

  it("removes static rating conclusions and preserves four views", () => {
    const source = readFileSync(
      new URL("../client/src/components/CDRAPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /RATING_DIST|MIGRATION_MATRIX|SPREAD_HISTORY|UPGRADE_DOWNGRADE/
    );
    expect(source).not.toMatch(
      /99\.8%|74\.5%|95\.2%|0\.00%|0\.03%|0\.10%|Math\.random|https?:\/\//
    );
    for (const label of ["评级分布", "迁移矩阵", "利差分析", "违约历史"])
      expect(source).toContain(label);
  });
});

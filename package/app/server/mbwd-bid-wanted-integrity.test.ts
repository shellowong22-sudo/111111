import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMbwdBidWantedSnapshot } from "./routers/municipalResearch";

describe("MBWD bid-wanted truth boundary", () => {
  it("keeps dealer RFQ data isolated and empty without authorization", () => {
    const snapshot = getMbwdBidWantedSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-mbwd-bid-wanted");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.inquiries).toEqual([]);
    expect(snapshot.depth).toEqual([]);
    expect(snapshot.liquidityMatrix).toEqual([]);
    expect(snapshot.executionAnalyses).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不使用 MSRB 汇总、SLGS、国债拍卖、静态报价或定时器模拟"
    );
  });

  it("removes fixed quotes and fake live refresh while retaining four views", () => {
    const source = readFileSync(
      new URL("../client/src/components/MBWDPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/BID_WANTED|DEPTH_DATA|LIQUIDITY_HEAT/);
    expect(source).not.toMatch(
      /13063BQR4|64966EZA2|882723QJ5|高盛|摩根士丹利|setInterval|animate-pulse|Math\.random|https?:\/\//
    );
    for (const label of ["实时报价", "市场深度", "流动性热力图", "最优执行"])
      expect(source).toContain(label);
  });
});

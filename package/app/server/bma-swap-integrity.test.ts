import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getBmaSwapIndexSnapshot } from "./routers/municipalResearch";

describe("BMA/SIFMA unique contract", () => {
  it("keeps BMA data independent from other rates", () => {
    const snapshot = getBmaSwapIndexSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-bma-swap-index");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.termRates).toEqual([]);
    expect(snapshot.ratioHistory).toEqual([]);
    expect(snapshot.limitation).toContain("不使用 SOFR、SLGS、VRDN");
  });

  it("removes hard-coded market observations but keeps the input calculator", () => {
    const source = readFileSync(
      new URL("../client/src/components/BMAPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /BMA_RATES|HIST_BMA|BREAKEVEN_DATA|BMA_SOFR_RATIO_HISTORY|BMA_SPREAD_SCATTER/
    );
    expect(source).not.toMatch(/3\.85|4\.28|5\.33|Math\.random/);
    expect(source).toContain("用户输入收益率");
    expect(source).toContain("税等价收益率");
  });
});

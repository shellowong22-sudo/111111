import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getVrdnSevenDaySnapshot } from "./routers/municipalResearch";

describe("VRDN seven-day market unique contract", () => {
  it("does not reuse BMA, BOOM, SLGS or static securities", () => {
    const snapshot = getVrdnSevenDaySnapshot();
    expect(snapshot.dataContractId).toBe("municipal-vrdn-seven-day-market");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.securities).toEqual([]);
    expect(snapshot.rateHistory).toEqual([]);
    expect(snapshot.limitation).toContain("不使用 BMA/SIFMA、BOOM 库存、SLGS");
  });

  it("removes the fixed security, provider and reset datasets", () => {
    const source = readFileSync(
      new URL("../client/src/components/VRDNPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /VRDN_DATA|RATE_HIST|LIQUIDITY_PROVIDERS|VRDN_RESET_HISTORY|VRDN_LIQUIDITY_BUBBLE|VRDN_RESET_CYCLE/
    );
    expect(source).not.toMatch(
      /Wells Fargo|JPMorgan|Goldman Sachs|Math\.random/
    );
    for (const label of [
      "实时监控",
      "历史利率",
      "流动性分析",
      "利率对比",
      "重设周期",
    ])
      expect(source).toContain(label);
  });
});

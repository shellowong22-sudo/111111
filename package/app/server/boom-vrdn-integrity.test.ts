import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getBoomVrdnInventorySnapshot } from "./routers/municipalResearch";

describe("BOOM VRDN inventory truth boundary", () => {
  it("uses a distinct contract and never substitutes another market dataset", () => {
    const snapshot = getBoomVrdnInventorySnapshot();
    expect(snapshot.dataContractId).toBe("municipal-boom-vrdn-inventory");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.inventoryHistory).toEqual([]);
    expect(snapshot.rateRelationship).toEqual([]);
    expect(snapshot.nashDistribution).toEqual([]);
    expect(snapshot.limitation).toContain("不使用国债拍卖、SLGS、SOFR");
  });

  it("removes simulation and preserves every original research entry", () => {
    const source = readFileSync(
      new URL("../client/src/components/BOOMPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /Math\.random|generateMockData|setInterval|胜率 77%/
    );
    for (const label of [
      "纳什均衡投标分布",
      "中标利率历史走势",
      "VPIN流动性毒性",
      "竞标者行为分析",
      "实战信号",
      "库存分析",
      "利率关联",
    ])
      expect(source).toContain(label);
  });
});

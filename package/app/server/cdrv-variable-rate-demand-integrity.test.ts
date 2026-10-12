import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCdrvVariableRateDemandSnapshot } from "./routers/municipalResearch";

describe("CDRV variable-rate demand unique contract", () => {
  it("keeps quotes, history and risk evidence restricted and isolated", () => {
    const snapshot = getCdrvVariableRateDemandSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-cdrv-variable-rate-demand");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.securities).toEqual([]);
    expect(snapshot.rateHistory).toEqual([]);
    expect(snapshot.riskAssessments).toEqual([]);
    expect(snapshot.limitation).toContain("不复用 VRDN、BMA、BOOM、SOFR、SLGS");
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\//);
  });

  it("removes static market values and preserves the original three views", () => {
    const source = readFileSync(
      new URL("../client/src/components/CDRVPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/const VRDNS|const RATE_HIST|setInterval/);
    expect(source).not.toMatch(
      /CA001VRD|NY002VRD|TX003VRD|IL004VRD|FL005VRD|3\.85|3\.68|106\.3|animate-pulse|Math\.random|https?:\/\//
    );
    for (const label of ["实时报价", "利率历史", "风险分析"]) {
      expect(source).toContain(label);
    }
    for (const header of [
      "CUSIP",
      "发行人",
      "规模",
      "当前利率",
      "较昨日",
      "重置频率",
      "流动性提供商",
      "到期",
      "评级",
      "下次重置",
    ]) {
      expect(source).toContain(header);
    }
  });
});

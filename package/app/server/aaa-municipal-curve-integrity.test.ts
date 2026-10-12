import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAaaMunicipalCurveSnapshot } from "./routers/municipalResearch";

describe("AAA municipal curve unique contract", () => {
  it("keeps curve, paired treasury, history and signal slices restricted", () => {
    const snapshot = getAaaMunicipalCurveSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-aaa-benchmark-curve");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.curve).toEqual([]);
    expect(snapshot.history).toEqual([]);
    expect(snapshot.forecasts).toEqual([]);
    expect(snapshot.relativeValueSignals).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不复用 MBIX 指数、CDRA 评级、SLGS、BMA"
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\//);
  });

  it("removes duplicate static curves, forecasts and trading advice", () => {
    const source = readFileSync(
      new URL("../client/src/components/AAAPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /CURVE_TODAY_EXTENDED|HIST_DATA_EXTENDED|CURVE_TODAY|HIST_DATA|RATIO_ZONES|ARBITRAGE_SIGNALS|FORECAST/
    );
    expect(source).not.toMatch(
      /3\.24|5\.32|72\.8|BUY|SELL|超配|回避|animate-pulse|Math\.random|https?:\/\//
    );
    for (const label of [
      "期限结构",
      "历史走势",
      "比率分析",
      "套利信号",
      "展期结构",
      "比値历史",
      "税收等价",
    ]) {
      expect(source).toContain(label);
    }
    for (const header of [
      "期限",
      "AAA BVAL",
      "国债收益率",
      "利差(bps)",
      "较昨日",
      "较上周",
    ]) {
      expect(source).toContain(header);
    }
  });
});

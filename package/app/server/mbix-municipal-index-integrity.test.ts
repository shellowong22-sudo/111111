import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMbixMunicipalIndexSnapshot } from "./routers/municipalResearch";

describe("MBIX municipal index unique contract", () => {
  it("keeps index, curve, sector and attribution slices restricted", () => {
    const snapshot = getMbixMunicipalIndexSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-mbix-index-monitor");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.indices).toEqual([]);
    expect(snapshot.history).toEqual([]);
    expect(snapshot.termStructure).toEqual([]);
    expect(snapshot.sectorSpread).toEqual([]);
    expect(snapshot.factorAttribution).toEqual([]);
    expect(snapshot.subIndexScores).toEqual([]);
    expect(snapshot.historicalPercentile).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不复用 CDRA 评级、MCAL 日历、DEAL 成交"
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\//);
  });

  it("removes static index samples and preserves original views", () => {
    const source = readFileSync(
      new URL("../client/src/components/MBIXPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /const INDICES|const HIST_DATA|const TERM_STRUCT|const SECTOR_SPREAD/
    );
    expect(source).not.toMatch(
      /BVAL-AAA|MUNI-GO|MUNI-HY|6\/3|4\.85|295|2023-01|Math\.random|https?:\/\//
    );
    for (const label of [
      "总览",
      "期限结构",
      "行业利差",
      "指数分解",
      "子指数得分",
      "历史分位",
    ]) {
      expect(source).toContain(label);
    }
    for (const header of ["指数", "收益率", "变动"]) {
      expect(source).toContain(header);
    }
  });
});

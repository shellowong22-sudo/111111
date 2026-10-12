import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDealMunicipalTradeSnapshot } from "./routers/municipalResearch";

describe("DEAL municipal trade execution unique contract", () => {
  it("keeps trade and execution datasets restricted and isolated", () => {
    const snapshot = getDealMunicipalTradeSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-deal-trade-execution");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.trades).toEqual([]);
    expect(snapshot.intraday).toEqual([]);
    expect(snapshot.qualityHistory).toEqual([]);
    expect(snapshot.dealerScores).toEqual([]);
    expect(snapshot.costBreakdown).toEqual([]);
    expect(Object.values(snapshot.executionSummary)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(snapshot.limitation).toContain(
      "不复用 MSRB 汇总、MBWD 询价、PICK 发行、CDRV 重置"
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\//);
  });

  it("removes fixed trades and retains all original views and fields", () => {
    const source = readFileSync(
      new URL("../client/src/components/DEALPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /const TRADES|const INTRADAY|executionQualityData|dealerScoreData|costAnalysisData/
    );
    expect(source).not.toMatch(
      /T001|13063BQR4|64966EZA2|452152AX8|882723QJ5|709226LM3|103\.45|101\.85|82\/100|animate-pulse|Math\.random|https?:\/\//
    );
    for (const label of [
      "成交记录",
      "日内走势",
      "执行分析",
      "执行质量",
      "交易商得分",
      "成本分析",
    ]) {
      expect(source).toContain(label);
    }
    for (const header of [
      "时间",
      "CUSIP",
      "发行人",
      "规模",
      "成交价",
      "收益率",
      "方向",
      "交易商",
      "偏差",
      "标记",
    ]) {
      expect(source).toContain(header);
    }
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getMcalStructuredCalendarSnapshot } from "./routers/municipalResearch";

describe("MCAL structured calendar unique contract", () => {
  it("keeps calendar and analytics datasets restricted", () => {
    const snapshot = getMcalStructuredCalendarSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-mcal-structured-calendar");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.observedAt).toBeNull();
    expect(snapshot.events).toEqual([]);
    expect(snapshot.weeklyIssuance).toEqual([]);
    expect(snapshot.underwriterShare).toEqual([]);
    expect(snapshot.ratingYield).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不复用 PICK 新券、CDRN 商议日程、CDRC 竞价日程"
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:\/\//);
  });

  it("removes fixed issue samples and preserves original calendar workbench", () => {
    const source = readFileSync(
      new URL("../client/src/components/MCALPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(
      /const DEALS|const WEEK_VOL|const UW_SHARE|const RATING_YIELD/
    );
    expect(source).not.toMatch(
      /d1|2025-01-06|加利福尼亚州教育局|Goldman Sachs|4\.25|12\/30|22\.4|MMD利差.*95/
    );
    for (const label of [
      "列表",
      "日历",
      "分析",
      "全部类型",
      "全部状态",
      "全部税务",
    ]) {
      expect(source).toContain(label);
    }
    for (const header of [
      "日期",
      "发行人",
      "州",
      "类型",
      "用途",
      "规模(M)",
      "评级",
      "承销商",
      "票面",
      "税务",
      "利差",
      "状态",
    ]) {
      expect(source).toContain(header);
    }
  });
});

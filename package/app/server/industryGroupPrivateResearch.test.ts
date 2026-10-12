import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzePrivateIndustryObservations } from "./industryGroupPrivateResearchDb";

describe("账户私有行业研究分析", () => {
  it("仅在相同指标、单位和币种内做比较，并保留可比性例外", () => {
    const result = analyzePrivateIndustryObservations([
      { recordId: "a-old", industryGroup: "半导体", metric: "毛利率", value: 50, unit: "%", issuerName: "甲", currency: "USD", sourceReference: "p1", observedAt: new Date("2026-01-01T00:00:00Z") },
      { recordId: "a-new", industryGroup: "半导体", metric: "毛利率", value: 60, unit: "%", issuerName: "甲", currency: "USD", sourceReference: "p2", observedAt: new Date("2026-02-01T00:00:00Z") },
      { recordId: "b", industryGroup: "半导体", metric: "毛利率", value: 40, unit: "%", issuerName: "乙", currency: "USD", sourceReference: "p3", observedAt: new Date("2026-02-01T00:00:00Z") },
      { recordId: "c", industryGroup: "软件", metric: "毛利率", value: 70, unit: "%", issuerName: "丙", currency: "USD", sourceReference: "p4", observedAt: new Date("2026-02-01T00:00:00Z") },
      { recordId: "d", industryGroup: "半导体", metric: "毛利率", value: 0.4, unit: "ratio", issuerName: "丁", currency: "USD", observedAt: new Date("2026-02-01T00:00:00Z") },
    ]);
    const semiconductor = result.summaries.find((row) => row.industryGroup === "半导体" && row.unit === "%");
    expect(semiconductor).toMatchObject({ coverage: 2, average: 50, median: 50, minimum: 40, maximum: 60 });
    expect(result.exceptions.some((item) => item.type === "UNIT_OR_CURRENCY_MISMATCH" && item.industryGroup === "半导体")).toBe(true);
    expect(result.exceptions.some((item) => item.type === "MISSING_SOURCE_REFERENCE" && item.industryGroup === "半导体")).toBe(true);
    expect(result.latestComparableRecordCount).toBe(4);
  });

  it("唯一行业路由只加载高密度工作台，导入分析不进行外部跳转", () => {
    const wrapper = readFileSync("client/src/components/industry-group/IndustryGroupPreservedRoute.tsx", "utf8");
    const workbench = readFileSync("client/src/components/ig/IndustryGroupModuleWorkbench.tsx", "utf8");
    expect(wrapper).toContain("<IndustryGroupAnalysis />");
    expect(wrapper).not.toContain("IndustryGroupPrivateResearchLayer");
    expect(workbench).toContain("trpc.industryGroupPrivateResearch.getDossier.useQuery");
    expect(workbench).not.toMatch(/window\.open|window\.location|href=|https?:\/\//);
    expect(workbench).toContain("数据源未配置");
  });
});

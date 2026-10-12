import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDUSTRY_GROUP_CAPABILITIES } from "../shared/threeModuleCapabilityCatalog";
import { INDUSTRY_GROUP_REFERENCE_SERIES, parseIndustryReferenceCsv } from "./routers/industryGroupReference";

const root = process.cwd();
const terminal = readFileSync(`${root}/client/src/pages/Terminal.tsx`, "utf8");
const app = readFileSync(`${root}/client/src/App.tsx`, "utf8");
const menu = readFileSync(`${root}/client/src/components/IndustryGroupMenu.tsx`, "utf8");
const workbench = readFileSync(`${root}/client/src/components/ig/IndustryGroupModuleWorkbench.tsx`, "utf8");

describe("行业分组 22 项唯一能力与官方参考", () => {
  it("仅接受可解析的官方序列观测，不将缺失值转换为示例数值", () => {
    expect(parseIndustryReferenceCsv("DATE,INDPRO\n2026-01-01,101.2\n2026-02-01,.\ninvalid,row\n")).toEqual([{ observedAt: "2026-01-01", value: 101.2 }]);
    expect(INDUSTRY_GROUP_REFERENCE_SERIES.map((series) => series.id)).toEqual(["INDPRO", "CPIAUCSL", "UNRATE", "RSAFS", "DGS10", "T10Y2Y", "VIXCLS"]);
  });

  it("固定为 22 个唯一行业研究能力，而不是法律、政府或旧卡片功能", () => {
    expect(INDUSTRY_GROUP_CAPABILITIES).toHaveLength(22);
    expect(new Set(INDUSTRY_GROUP_CAPABILITIES.map(item => item.id)).size).toBe(22);
    expect(new Set(INDUSTRY_GROUP_CAPABILITIES.map(item => item.responsibility)).size).toBe(22);
    expect(INDUSTRY_GROUP_CAPABILITIES.map(item => item.id)).toEqual([
      "CLASS", "MEMBERS", "QUOTES", "RETURNS", "VOLUME", "FLOW", "BREADTH", "VALUATION", "EARNINGS", "FORECAST", "REVENUE", "PROFIT", "BALANCE", "CASHFLOW", "CAPEX", "DIVIDEND", "VOLATILITY", "CORRELATION", "ROTATION", "CONTRIBUTION", "CYCLE", "STRESS",
    ]);
    for (const retired of ["BLAW", "BTAX", "BGOV", "INDG", "MAP_VOTE"]) {
      expect(menu).not.toContain(retired);
      expect(workbench).not.toContain(`${retired}:`);
    }
  });

  it("终端只从统一目录打开工作台，并封闭未知或退休 ID", () => {
    expect(menu).toContain("INDUSTRY_GROUP_CAPABILITIES");
    expect(terminal).toContain("INDUSTRY_GROUP_CAPABILITIES.find(item => item.id === itemId)");
    expect(terminal).toContain("<IndustryGroupModuleWorkbench code={itemId} />");
    expect(terminal).toContain("Industry-group owns a closed set of 22 capabilities");
    expect(terminal).not.toContain("IndustrySectorPanel");
    expect(terminal).not.toContain("case 'sectors'");
  });

  it("旧行业卡片路由复用唯一工作台，错误静态页面和随机面板已移除", () => {
    expect(app).not.toContain('import IndustryAnalysis from "./pages/IndustryAnalysis"');
    expect(app).toContain('<Route path={"/industry-analysis"} component={IndustryGroupPreservedRoute} />');
    expect(app).toContain('<Route path={"/industry-group"} component={IndustryGroupPreservedRoute} />');
    expect(existsSync(`${root}/client/src/pages/IndustryAnalysis.tsx`)).toBe(false);
    for (const retiredFile of [
      "client/src/components/ig/IGPanels1to11.tsx",
      "client/src/components/ig/IGPanels12to22.tsx",
      "client/src/components/ig/IndustryGroupOfficialEvidenceDesk.tsx",
      "client/src/components/ig/IndustryGroupWindowPrivateEvidence.tsx",
      "client/src/components/industry-group/IndustryGroupPrivateResearchLayer.tsx",
    ]) expect(existsSync(`${root}/${retiredFile}`)).toBe(false);
    expect(workbench).not.toMatch(/Math\.random|setInterval|<Card\b|from ["']@\/components\/ui\/card/);
  });
});

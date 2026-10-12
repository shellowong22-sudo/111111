import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("行业分组纠偏边界", () => {
  it("入口固定到当前工作台，不再用字节指纹保护错误旧页面", () => {
    const page = readFileSync("client/src/pages/IndustryGroupAnalysis.tsx", "utf8");
    expect(page).toContain('import IndustryGroupModuleWorkbench from "@/components/ig/IndustryGroupModuleWorkbench"');
    expect(page).toContain('<IndustryGroupModuleWorkbench code="CLASS" />');
    expect(page).not.toMatch(/Math\.random|<Card\b|INDUSTRY_DATA/);
  });
});

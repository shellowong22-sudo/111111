import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PREFERRED_STOCK_CAPABILITIES } from "@shared/threeModuleCapabilityCatalog";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/components/preferredstock/PreferredStockResearchLayer.tsx"), "utf8");
const analysis = readFileSync(resolve(import.meta.dirname, "../client/src/components/preferredstock/PreferredAnalysisTools.tsx"), "utf8");

describe("preferred-stock corrected data responsibilities", () => {
  it("uses exactly the 23 preferred-stock responsibilities from the frozen catalog", () => {
    expect(PREFERRED_STOCK_CAPABILITIES).toHaveLength(23);
    expect(source).toContain("PREFERRED_STOCK_CAPABILITIES.find");
    expect(source).not.toMatch(/AI决策|智能投顾|数据层架构|模型层架构|应用层架构|基础设施层/);
  });

  it("keeps licensed quote, book, trade and rating fields in explicit unconfigured states", () => {
    for (const id of ["dat", "inf", "fit", "crd", "liq"]) expect(source).toContain(`${id}: [[`);
    expect(source).toContain("数据源未配置");
    expect(source).toContain("不使用其他优先股页面的数据替代");
    expect(source).not.toMatch(/Math\.random|setInterval/);
  });

  it("uses account terms only for distinct term responsibilities and official series only for rate context", () => {
    for (const id of ["secf", "psch", "wb", "pord", "qfm", "wei", "rpa", "por", "aide"]) expect(source).toContain(`${id}: [`);
    expect(source).toContain('const RATE_MODES = new Set<ModuleId>(["mdl", "aide"]);');
    expect(source).toContain("账户条款 + FRED 公开历史观察");
    expect(source).toContain("不是个券估值");
  });

  it("renders one dense data table and one selected-security detail region instead of data cards", () => {
    expect(source).toContain("<table");
    expect(source).toContain("所选证券字段明细");
    expect(source).not.toContain("function Card");
    expect(source).not.toMatch(/grid-cols-[234]/);
  });

  it("keeps the separate analysis tools and their real term and execution workflows", () => {
    expect(analysis).toContain("账户条款规则筛选与证据判定");
    expect(analysis).toContain("分配类型结构");
    expect(analysis).toContain("首次赎回年度梯队");
    expect(analysis).toContain("未核验日期不进入梯队");
    expect(analysis).toContain("调整 SECF 规则明细分栏");
    expect(analysis).toContain("成交记录与执行成本复核");
  });
});

import { describe, expect, it } from "vitest";
import { FINCEPT_CAPABILITIES, FINCEPT_PLACEHOLDER_SLOT_GROUPS, assertFinceptCapabilityUniqueness } from "./finceptCapabilityCatalog";
import {
  FINCEPT_PROFESSIONAL_APPLICATION_COVERAGE,
  assertFinceptProfessionalApplicationCoverageIntegrity,
} from "./finceptProfessionalApplicationCoverage";

describe("Fincept capability binding", () => {
  it("keeps one existing frontend owner per asset category", () => {
    expect(assertFinceptCapabilityUniqueness()).toBe(true);
    expect(FINCEPT_CAPABILITIES).toHaveLength(12);
    expect(new Set(FINCEPT_CAPABILITIES.map(item => item.moduleId)).size).toBe(FINCEPT_CAPABILITIES.length);
  });

  it("does not claim Python script coverage as a live connection", () => {
    expect(FINCEPT_CAPABILITIES.find(item => item.id === "stocks")).toMatchObject({ status: "connected", moduleId: "stock-eqs" });
    expect(FINCEPT_CAPABILITIES.find(item => item.id === "news")).toMatchObject({ status: "partial_persistent_adapter", moduleId: "news-hub" });
    expect(FINCEPT_CAPABILITIES.find(item => item.id === "crypto")).toMatchObject({ status: "mixed_persistent_adapter", moduleId: "crypto-market" });
    expect(FINCEPT_CAPABILITIES.find(item => item.id === "macro")).toMatchObject({ status: "existing_persistent_adapter", moduleId: "economic-ecst" });
    expect(FINCEPT_CAPABILITIES.every(item => item.note.length > 0)).toBe(true);
  });

  it("keeps ZIP slot mapping separate from professional applications", () => {
    expect(FINCEPT_PLACEHOLDER_SLOT_GROUPS.every(item => item.reason.includes("ZIP 前端能力映射"))).toBe(true);
    expect(FINCEPT_PLACEHOLDER_SLOT_GROUPS.find(item => item.category === "股市")?.positions).toEqual([6, 13, 16, 17, 23, 25, 29, 30]);
    expect(FINCEPT_PLACEHOLDER_SLOT_GROUPS.find(item => item.category === "大宗商品")?.positions).toEqual([8, 12, 14, 16, 31, 32]);
    expect(FINCEPT_PLACEHOLDER_SLOT_GROUPS.find(item => item.category === "指数")?.positions).toEqual([7, 13, 14, 17]);
    expect(FINCEPT_PLACEHOLDER_SLOT_GROUPS.find(item => item.category === "衍生品")?.positions).toEqual([1, 4, 10, 11, 14, 15, 18, 22]);
    expect(FINCEPT_PLACEHOLDER_SLOT_GROUPS.find(item => item.category === "经济分析")?.positions).toEqual([1, 9, 18, 19]);
    expect(assertFinceptProfessionalApplicationCoverageIntegrity()).toBe(true);
    expect(FINCEPT_PROFESSIONAL_APPLICATION_COVERAGE).toHaveLength(7);
    expect(FINCEPT_PROFESSIONAL_APPLICATION_COVERAGE.every(item => item.liveData === false)).toBe(true);
    expect(FINCEPT_PROFESSIONAL_APPLICATION_COVERAGE.map(item => item.frontendPath)).toEqual(expect.arrayContaining([
      "/portfolio-optimizer",
      "/pricing-risk",
      "/order-management",
      "/electronic-trading",
      "/stp-processing",
      "/trade-blotter",
      "/industry-group",
    ]));
  });
});

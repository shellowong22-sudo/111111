import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../audit/scripts/audit_menu_hierarchy.mjs", import.meta.url), "utf8");

describe("菜单层级静态矩阵", () => {
  it("提取条目、标题、可见条件线索和导航方式", () => {
    expect(script).toContain("itemCount");
    expect(script).toContain("headings");
    expect(script).toContain("visibilitySignals");
    expect(script).toContain("usesIndirectMenuHandler");
    expect(script).toContain("usesLocationNavigation");
  });

  it("已生成当前菜单层级矩阵 JSON", () => {
    const matrixPath = new URL("../audit/runtime/menu-hierarchy-matrix.json", import.meta.url);
    expect(existsSync(matrixPath)).toBe(true);
    const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
    expect(matrix.summary.menuComponents).toBe(26);
    expect(matrix.summary.numberedItems).toBeGreaterThan(0);
  });
});

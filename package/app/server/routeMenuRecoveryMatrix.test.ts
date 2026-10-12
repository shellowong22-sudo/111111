import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const app = readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
const baselinePaths = readFileSync(path.join(root, "audit/inventory/routes.tsv"), "utf8")
  .trim().split("\n").slice(1).map((line) => line.split("\t")[0]);
const currentPaths = new Set([...app.matchAll(/<Route\s+path=\{?"([^"\n]+)"\}?/g)].map((match) => match[1]));
const protectedPaths = [...app.matchAll(/<Route\s+path=\{?"([^"\n]+)"\}?\s+component=\{\(\)\s*=>\s*<ProtectedRoute/g)].map((match) => match[1]);
const menuFiles = readFileSync(path.join(root, "audit/inventory/menu-components.tsv"), "utf8")
  .trim().split("\n").slice(1).filter((line) => line && !line.includes("/ui/"));
const menuHandler = readFileSync(path.join(root, "client/src/lib/menuItemHandler.ts"), "utf8");

describe("路由与菜单恢复矩阵", () => {
  it("保留全部 119 条基线路由、参数入口及 404 回退出口", () => {
    expect(baselinePaths).toHaveLength(119);
    expect(baselinePaths.filter((routePath) => !currentPaths.has(routePath))).toEqual([]);
    expect(baselinePaths.filter((routePath) => routePath.includes("/:"))).toEqual(["/curve-detail/:curveId", "/etf-detail/:etfId", "/menu-item/:itemId"]);
    expect(currentPaths.has("/404")).toBe(true);
    expect(app).toMatch(/<Route\s+component=\{NotFound\}\s*\/>/);
  });

  it("保留关键角色守卫和 26 个原始导航组件", () => {
    for (const routePath of ["/risk-management", "/electronic-trading", "/trade-book", "/pricing-risk", "/order-management", "/admin", "/secure-admin"]) {
      expect(protectedPaths).toContain(routePath);
    }
    expect(menuFiles).toHaveLength(26);
    expect(menuFiles.filter((relative) => !existsSync(path.join(root, relative)))).toEqual([]);
    expect(menuHandler).toContain("const path = config.path ?? `/menu-item/${itemId}`");
    expect(currentPaths.has("/menu-item/:itemId")).toBe(true);
  });
});

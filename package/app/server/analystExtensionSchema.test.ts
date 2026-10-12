import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("ZIP 外分析扩展表契约", () => {
  it("确认只读 ZIP 数据库转储不包含两张扩展表", () => {
    const dump = fs.readFileSync(
      "/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql",
      "utf8",
    );

    expect(dump).not.toContain("ai_report_summaries");
    expect(dump).not.toContain("analyst_ratings");
  });

  it("保留两张幂等扩展表定义及其查询索引", () => {
    const migration = source("server/create-analyst-tables.mjs");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS analyst_ratings");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS ai_report_summaries");
    expect(migration).toContain("INDEX idx_rated_at (rated_at)");
    expect(migration).toContain("INDEX idx_created_at (created_at)");
  });

  it("保留两条只读历史路由以在空扩展表上安全返回空集合", () => {
    const router = source("server/routers/res.ts");

    expect(router).toContain("getRatingHistory: publicProcedure");
    expect(router).toContain("FROM analyst_ratings");
    expect(router).toContain("getSummaryHistory: publicProcedure");
    expect(router).toContain("FROM ai_report_summaries");
    expect(router).toContain("return { history: [] }");
    expect(router).toContain("return { summaries: [] }");
  });
});

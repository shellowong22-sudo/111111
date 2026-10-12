import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const seedSource = readFileSync(resolve(root, "server/seed-all-data.mjs"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");

describe("曲线基础数据导入契约", () => {
  it("使用页面读取的曲线观测点字段", () => {
    expect(seedSource).toContain("curve_data_points (curve_id, data_date, period, value)");
    expect(seedSource).not.toContain("curve_data_points (curve_id, tenor, tenor_years, rate, date)");
    expect(schemaSource).toContain('dataDate: varchar("data_date"');
    expect(schemaSource).toContain('period: varchar("period"');
    expect(schemaSource).toContain('value: varchar("value"');
  });

  it("包含基础数据导入需要的分类和区域元数据字段", () => {
    expect(schemaSource).toContain('icon: varchar("icon"');
    expect(schemaSource).toContain('description: text("description")');
    expect(schemaSource).toContain('countries: text("countries")');
  });
});

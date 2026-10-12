import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const script = readFileSync(new URL("../audit/scripts/audit_interface_contracts.mjs", import.meta.url), "utf8");

describe("服务端接口契约矩阵", () => {
  it("生成可复用的过程、访问控制、输入与状态字段盘点", () => {
    expect(script).toContain("publicProcedure");
    expect(script).toContain("protectedProcedure");
    expect(script).toContain("adminProcedure");
    expect(script).toContain("hasInputSchema");
    expect(script).toContain("hasStatusField");
    expect(script).toContain("hasSourceField");
  });

  it("已生成当前接口矩阵 JSON 供后续分片验收使用", () => {
    expect(existsSync(new URL("../audit/runtime/interface-contract-matrix.json", import.meta.url))).toBe(true);
    const matrix = JSON.parse(readFileSync(new URL("../audit/runtime/interface-contract-matrix.json", import.meta.url), "utf8"));
    expect(matrix.summary.procedures).toBeGreaterThan(0);
    expect(matrix.rows).toHaveLength(matrix.summary.procedures);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/components/GlobalTickerTape.tsx", import.meta.url), "utf8");

describe("全局数据库快照状态", () => {
  it("展示导入来源与唯一品种数量，但不再占用终端空间展示读取时间", () => {
    expect(source).toContain('data-snapshot-status="available"');
    expect(source).toContain("项目数据库导入");
    expect(source).toContain("个唯一品种");
    expect(source).not.toContain("最新观测：");
    expect(source).not.toContain("本次读取：");
    expect(source).not.toContain("读取时间：");
  });

  it("在无快照时保持真实空状态，并且不合成行情", () => {
    expect(source).toContain('data-snapshot-status="unavailable"');
    expect(source).toContain("当前数据库没有已导入快照");
    expect(source).toContain("终端保持真实空状态");
    expect(source).not.toContain("fetch(");
  });

  it("按代码去重并只渲染单份行情数据", () => {
    expect(source).toContain("const seenSymbols = new Set<string>()");
    expect(source).toContain("tickerItems.map((item)");
    expect(source).not.toContain("duplicatedItems");
    expect(source).not.toContain("[...tickerItems, ...tickerItems]");
  });
});

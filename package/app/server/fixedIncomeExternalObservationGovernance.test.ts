import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("FIT 外部期货观察治理", () => {
  it("不在预挂载时自动读取 Yahoo 期货数据，保留终端内显式读取入口", () => {
    const source = readFileSync(`${process.cwd()}/client/src/components/FITPanel.tsx`, "utf8");
    expect(source).toContain("const [futuresEnabled, setFuturesEnabled] = useState(false)");
    expect(source).toContain("enabled: futuresEnabled");
    expect(source).toContain("默认不读取外部期货行情");
    expect(source).toContain("读取公开期货参考");
    expect(source).toContain("Yahoo Finance");
  });
});


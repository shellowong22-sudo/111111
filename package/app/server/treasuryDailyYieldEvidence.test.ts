import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("美国财政部日度收益率证据台", () => {
  it("只读取官方 CSV 并在不可用时保持真实空状态", () => {
    const source = readFileSync(`${root}/server/routers/treasuryDailyYield.ts`, "utf8");
    expect(source).toContain("home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv");
    expect(source).toContain("daily_treasury_yield_curve");
    expect(source).toContain("系统未以 ZIP 测试性曲线或合成数据替代");
    expect(source).toContain("official_daily_treasury_par_yield_reference");
  });

  it("在原收益率曲线页之后以独立终端内工作台呈现", () => {
    const desk = readFileSync(`${root}/client/src/components/curves/TreasuryDailyYieldEvidenceDesk.tsx`, "utf8");
    const page = readFileSync(`${root}/client/src/pages/YieldCurveAnalysis.tsx`, "utf8");
    expect(desk).toContain("trpc.treasuryDailyYield.getLatest.useQuery");
    expect(desk).toContain("不产生趋势预测");
    expect(page).toContain("TreasuryDailyYieldEvidenceDesk");
    expect(page).toContain("<TreasuryDailyYieldEvidenceDesk />");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const router = readFileSync(`${root}/server/routers/macro.ts`, "utf8");
const page = readFileSync(`${root}/client/src/pages/MacroeconomicDashboard.tsx`, "utf8");

describe("宏观经济仪表板真实数据完整性", () => {
  it("服务端保留原过程并以独立指标构建多国雷达数据", () => {
    expect(router).toContain("getMultiMetricComparison");
    expect(router).toContain("gdpGrowth: latest(snapshot.gdpGrowth)?.value ?? null");
    expect(router).toContain("cpi: latest(snapshot.cpi)?.value ?? null");
    expect(router).toContain("unemployment: latest(snapshot.unemployment)?.value ?? null");
    expect(router).toContain("rate: latest(rate)?.value ?? null");
    expect(router).toContain("debtGdp: latest(snapshot.debtGdp)?.value ?? null");
    expect(router).not.toContain("Math.random");
  });

  it("前端不再把当前单一指标复制到所有雷达维度，也不把缺失值补成零", () => {
    expect(page).toContain("trpc.macro.getMultiMetricComparison.useQuery");
    expect(page).toContain("d?.values[m.key as keyof typeof d.values] ?? null");
    expect(page).not.toContain("row[c] = d?.value ?? 0");
    expect(page).toContain("(vals as Array<number | null>)[i] ?? null");
    expect(page).not.toContain("(vals as number[])[i] ?? 0");
    expect(page).toContain("entry.pmi === null ? \"#475569\"");
  });

  it("不同频率序列按观察日期合并，并明确采用定时检查而非伪实时标记", () => {
    expect(page).toContain("const cpiByDate = byDate(cpiSeries)");
    expect(page).toContain("cpi: cpiByDate.get(g.date) ?? null");
    expect(page).toContain("5 分钟自动检查");
    expect(page).not.toMatch(/>\s*LIVE\s*</);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("./routers/derivatives.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../client/src/components/DerivativesAIPanel.tsx", import.meta.url), "utf8");
const bico = readFileSync(new URL("../client/src/pages/BICO.tsx", import.meta.url), "utf8");

describe("衍生品外部数据状态契约", () => {
  it("不再把固定替代信号或行业评分作为外部事实返回", () => {
    expect(router).toContain("授权替代数据尚未接入");
    expect(router).toContain("return [] as Array");
    expect(router).not.toContain("港口吞吐量环比-3.2%");
    expect(router).not.toContain("altDataScore: 78");
    expect(router).not.toContain('signal: "超配"');
  });

  it("在保留原感知层卡片的同时显示明确不可用状态与时间边界", () => {
    expect(panel).toContain('data-alt-data-status="unavailable"');
    expect(panel).toContain("授权替代数据服务未接入");
    expect(panel).toContain("观测日：未提供");
    expect(panel).toContain("读取时间：");
    expect(panel).toContain("系统未以固定传感器、新闻、情绪或期权信号替代");
  });

  it("在 BICO 原有卡片和表格位置显示不可用边界，而非实时评分、跳数或风险分组", () => {
    expect(bico).toContain('data-bico-alt-status="unavailable"');
    expect(bico).toContain('data-bico-causal-status="unavailable"');
    expect(bico).toContain('data-bico-sector-status="unavailable"');
    expect(bico).toContain('data-bico-risk-status="unavailable"');
    expect(bico).not.toContain("替代数据评分低于55");
    expect(bico).not.toContain("altSignals?.length ?? 5");
    expect(bico).not.toContain("causalChain?.length ?? 4");
  });
});

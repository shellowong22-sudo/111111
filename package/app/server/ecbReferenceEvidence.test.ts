import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ECB 外汇参考证据台", () => {
  it("仅读取 ECB EXR 官方参考汇率，并明确真实空状态边界", () => {
    const source = readFileSync(`${process.cwd()}/server/routers/ecbForeignExchange.ts`, "utf8");
    expect(source).toContain("data-api.ecb.europa.eu/service/data/EXR");
    expect(source).toContain("official_ecb_reference_exchange_rate");
    expect(source).toContain("系统未以原页面固定数值或模拟数据替代");
  });
  it("作为外汇原工作区之后的独立终端内证据层挂载", () => {
    const desk = readFileSync(`${process.cwd()}/client/src/components/forex/EcbReferenceEvidenceDesk.tsx`, "utf8");
    const hub = readFileSync(`${process.cwd()}/client/src/pages/ForexHub.tsx`, "utf8");
    expect(desk).toContain("trpc.ecbForeignExchange.getReferenceRates.useQuery");
    expect(desk).toContain("reference.data.limitation");
    expect(desk).toContain("终端内来源：{reference.data.source}");
    expect(desk).toContain("本次读取：{new Date(reference.data.fetchedAt).toLocaleString()}");
    expect(hub).toContain("EcbReferenceEvidenceDesk");
    expect(hub).toContain("<EcbReferenceEvidenceDesk />");
  });
});

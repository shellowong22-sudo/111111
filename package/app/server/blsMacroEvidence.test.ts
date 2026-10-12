import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("BLS 宏观发布证据台", () => {
  it("只调用 BLS 公共 API 并在源不可用时维持真实空状态", () => {
    const source = readFileSync(`${process.cwd()}/server/routers/blsMacroEvidence.ts`, "utf8");
    expect(source).toContain("api.bls.gov/publicAPI/v2/timeseries/data");
    expect(source).toContain("CUUR0000SA0");
    expect(source).toContain("LNS14000000");
    expect(source).toContain("CES0000000001");
    expect(source).toContain("系统未用原仪表板固定值、随机序列或预测值替代");
    expect(source).toContain("officialReleaseDate");
    expect(source).toContain("BLS 官方日历可访问且与观测期匹配时展示");
  });
  it("在原宏观仪表板之后挂载终端内发布证据，不改写既有 macro 路由", () => {
    const desk = readFileSync(`${process.cwd()}/client/src/components/macro/BlsMacroReleaseEvidenceDesk.tsx`, "utf8");
    const page = readFileSync(`${process.cwd()}/client/src/pages/MacroeconomicDashboard.tsx`, "utf8");
    const root = readFileSync(`${process.cwd()}/server/routers.ts`, "utf8");
    expect(desk).toContain("trpc.blsMacroEvidence.getLatestReleases.useQuery");
    expect(desk).toContain("终端内来源：{release.data.source}");
    expect(desk).toContain("官方发布日期");
    expect(desk).toContain("BLS 日历本次不可获取");
    expect(desk).toContain("不以本次读取时间或推测日期替代");
    expect(page).toContain("BlsMacroReleaseEvidenceDesk");
    expect(page).toContain("<BlsMacroReleaseEvidenceDesk />");
    expect(root).toContain("blsMacroEvidence: blsMacroEvidenceRouter");
  });
});

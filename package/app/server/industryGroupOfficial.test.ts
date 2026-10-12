import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeFederalRegisterDocument } from "./routers/industryGroupOfficial";

describe("行业分组官方来源边界", () => {
  it("只规范化具有官方文件编号和标题的 Federal Register 实际记录", () => {
    expect(normalizeFederalRegisterDocument({ document_number: "2026-10001", title: "Example rule", publication_date: "2026-08-25", agencies: [{ name: "Securities and Exchange Commission" }] })).toMatchObject({ documentNumber: "2026-10001", title: "Example rule", publicationDate: "2026-08-25", sourceReference: "Federal Register API · 2026-10001" });
    expect(normalizeFederalRegisterDocument({ document_number: "2026-10002" })).toBeNull();
    expect(normalizeFederalRegisterDocument({ title: "Untitled source" })).toBeNull();
  });

  it("行业景气和压力页只把官方宏观序列作为背景，不复活法律政府面板", () => {
    const workbench = readFileSync("client/src/components/ig/IndustryGroupModuleWorkbench.tsx", "utf8");
    expect(workbench).toContain('const showReference = mode === "CYCLE" || mode === "STRESS"');
    expect(workbench).toContain("trpc.industryGroupReference.getSnapshot.useQuery");
    expect(workbench).toContain("官方宏观参考 · 仅作行业景气或压力环境背景");
    expect(workbench).not.toMatch(/BLAW|BTAX|BGOV|法律证据|政府政策/);
  });
});

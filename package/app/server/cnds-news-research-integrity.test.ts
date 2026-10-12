import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCndsMunicipalNewsSnapshot } from "./routers/municipalResearch";

describe("CNDS municipal news and research unique contract", () => {
  it("keeps municipal content isolated from generic news and other slices", () => {
    const snapshot = getCndsMunicipalNewsSnapshot();
    expect(snapshot.dataContractId).toBe("municipal-cnds-news-research");
    expect(snapshot.dataStatus).toBe("restricted");
    expect(snapshot.news).toEqual([]);
    expect(snapshot.researchReports).toEqual([]);
    expect(snapshot.creditAlerts).toEqual([]);
    expect(snapshot.limitation).toContain(
      "不复制新闻中心、CDRA 评级、PICK 发行数据或静态新闻样例"
    );
  });

  it("removes fixed stories and preserves the three original entries", () => {
    const source = readFileSync(
      new URL("../client/src/components/CNDSPanel.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/const NEWS|RESEARCH_REPORTS/);
    expect(source).not.toMatch(
      /2024年财政报告|2025年地方债市场展望|高盛研究|摩根士丹利研究|养老金负债率偏高|animate-pulse|Math\.random|https?:\/\//
    );
    for (const label of ["实时新闻", "研究报告", "信用预警"])
      expect(source).toContain(label);
  });
});

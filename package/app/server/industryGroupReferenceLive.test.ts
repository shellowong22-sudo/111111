import { describe, expect, it } from "vitest";
import { getIndustryGroupReferenceSnapshot } from "./routers/industryGroupReference";

describe("INDG 官方参考实时读取", () => {
  it("在终端内读取产业活动与风险环境序列，并保留来源、观测日期或真实不可用状态", async () => {
    const snapshot = await getIndustryGroupReferenceSnapshot(180);
    expect(snapshot.requestedDays).toBe(180);
    const industrialActivity = snapshot.series.find((series) => series.id === "INDPRO");
    const riskEnvironment = snapshot.series.find((series) => series.id === "VIXCLS");
    expect(industrialActivity).toMatchObject({ category: "产业活动", source: "FRED / Federal Reserve" });
    expect(riskEnvironment).toMatchObject({ category: "风险偏好", source: "FRED / Cboe" });
    for (const series of [industrialActivity, riskEnvironment]) {
      expect(series?.status).toMatch(/available|unavailable/);
      if (series?.status === "available") {
        expect(series.latest?.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof series.latest?.value).toBe("number");
        expect(series.history.length).toBeGreaterThan(0);
      } else {
        expect(series?.latest).toBeNull();
        expect(series?.limitation).toContain("终端");
      }
    }
  }, 20_000);
});

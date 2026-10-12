import { describe, expect, it } from "vitest";
import { projectFundSearch } from "./archivedFundSearch";

describe("open fund archive search", () => {
  const rows = [
    { id: 3, symbol: "000001", observationDate: "2026-09-30", payload: { fundName: "华夏成长混合", netAssetValue: 1.2 } },
    { id: 8, symbol: "000001", observationDate: "2026-10-02", payload: { fundName: "华夏成长混合", netAssetValue: 1.3 } },
    { id: 9, symbol: "000001", observationDate: "2026-10-02", payload: { fundName: "华夏成长混合", netAssetValue: 1.31 } },
    { id: 10, symbol: "000002", observationDate: "2026-10-01", payload: { fundName: "华夏红利混合", netAssetValue: 2.1 } },
    { id: 11, symbol: "999999", observationDate: "2026-10-02", payload: { fundName: "缺失净值", netAssetValue: null } },
  ];
  it("keeps latest revision per code and supports name and code search", () => {
    expect(projectFundSearch(rows, "成长", 0, 50)).toEqual({
      total: 1, rows: [{ code: "000001", name: "华夏成长混合", netAssetValue: 1.31, observationDate: "2026-10-02", currency: "CNY" }],
    });
    expect(projectFundSearch(rows, "000002", 0, 50).rows[0]?.name).toBe("华夏红利混合");
    expect(projectFundSearch(rows, "华夏", 1, 1)).toMatchObject({ total: 2, rows: [{ code: "000002" }] });
    expect(projectFundSearch(rows, "999999", 0, 50).rows).toEqual([{
      code: "999999", name: "缺失净值", netAssetValue: null,
      observationDate: "2026-10-02", currency: "CNY",
    }]);
  });
});

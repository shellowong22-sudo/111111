import { describe, it, expect } from "vitest";
import { projectFxReference } from "./archivedFxReference";

describe("durable FX reference projection", () => {
  it("selects the latest revision, keeps distinct pairs and strips private provenance", () => {
    const base = { observationDate: "2026-09-18", fetchedAt: new Date("2026-09-21T00:00:00Z") };
    const result = projectFxReference([
      { ...base, id: 2, dataContractId: "fx.hkma.daily-reference.v1", payload: { usd: 7.8, eur: 9, cny: 1.1, jpy: 0.05, index: 100, sourceUrl: "https://example.com" } },
      { ...base, id: 1, dataContractId: "fx.hkma.daily-reference.v1", payload: { usd: 7.7 } },
      { ...base, id: 3, dataContractId: "fx.bank-of-canada.usdcad.v1", payload: { value: 1.4 } },
      { ...base, id: 4, dataContractId: "other", payload: { value: 99 } },
    ]);
    expect(result.points).toHaveLength(5);
    expect(new Set(result.points.map(point => point.pair + point.date)).size).toBe(5);
    expect(result.points.find(point => point.pair === "USD/HKD")?.value).toBe(7.8);
    expect(result.points.find(point => point.pair === "JPY/HKD")?.value).toBe(0.05);
    expect(result.indices).toEqual([{ date: "2026-09-18", value: 100, base: "2020 trade weighted" }]);
    expect(JSON.stringify(result)).not.toContain("sourceUrl");
  });
  it("never treats missing, numeric strings, zero or negative rates as an observation", () => {
    const result = projectFxReference([{ id: 1, dataContractId: "fx.hkma.daily-reference.v1", observationDate: "2026-09-18", fetchedAt: new Date(), payload: { usd: null, eur: 0, cny: -1, jpy: "0.05" } }]);
    expect(result.points).toEqual([]);
  });
});

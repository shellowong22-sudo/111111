import { describe, expect, it } from "vitest";
import { getCurveHistoricalYields, getCurveLatestSnapshot } from "./curves-db";

describe("curve data access", () => {
  it("returns the imported latest yield-curve snapshot with service-model fields", async () => {
    const snapshot = await getCurveLatestSnapshot(1);

    expect(snapshot.length).toBeGreaterThan(0);
    expect(snapshot.every((point) => point.dataDate.length > 0 && point.period.length > 0)).toBe(true);
    expect(snapshot.every((point) => Number.isFinite(Number(point.value)))).toBe(true);
  });

  it("returns imported historical records ordered by the service data-date field", async () => {
    const history = await getCurveHistoricalYields(1);

    expect(history.length).toBeGreaterThan(0);
    expect(history[0]?.dataDate).toBeTruthy();
  });
});

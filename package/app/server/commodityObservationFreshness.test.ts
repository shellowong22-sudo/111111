import { describe, expect, it } from "vitest";
import { isCommodityCurrentObservation } from "../client/src/lib/commodityObservationFreshness";

describe("commodity observation freshness", () => {
  const now = Date.parse("2026-10-02T10:00:00Z");

  it("keeps a recent weekly release eligible for the current-observation card", () => {
    expect(isCommodityCurrentObservation("2026-09-25", now)).toBe(true);
  });

  it("preserves very old observations as history, never as current cards", () => {
    expect(isCommodityCurrentObservation("1982-12-24", now)).toBe(false);
    expect(isCommodityCurrentObservation("2008-08-21", now)).toBe(false);
  });

  it("rejects invalid and future observation dates", () => {
    expect(isCommodityCurrentObservation("unknown", now)).toBe(false);
    expect(isCommodityCurrentObservation("2026-12-01", now)).toBe(false);
  });
});

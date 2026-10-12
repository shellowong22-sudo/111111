import { describe, expect, it } from "vitest";
import { assessMarketFreshness } from "./marketFreshness";

const now = new Date("2026-10-01T12:00:00.000Z");

describe("market freshness boundary", () => {
  it("accepts a fresh delayed observation as current", () => {
    const result = assessMarketFreshness({
      status: "delayed",
      observedAt: "2026-10-01T11:15:00.000Z",
      now,
    });
    expect(result).toMatchObject({
      state: "current",
      currentAvailable: true,
      dailyAvailable: false,
    });
  });

  it("rejects an old delayed observation instead of exposing it as a quote", () => {
    const result = assessMarketFreshness({
      status: "delayed",
      observedAt: "2026-10-01T08:00:00.000Z",
      now,
    });
    expect(result).toMatchObject({
      state: "stale",
      currentAvailable: false,
      dailyAvailable: false,
    });
  });

  it("keeps a fresh daily release available only to daily surfaces", () => {
    const result = assessMarketFreshness({
      status: "end_of_day",
      observedAt: "2026-10-01",
      now,
    });
    expect(result).toMatchObject({
      state: "daily",
      currentAvailable: false,
      dailyAvailable: true,
    });
  });

  it("never turns an archived observation into a current or daily value", () => {
    const result = assessMarketFreshness({
      status: "archived",
      observedAt: "2026-09-30",
      now,
    });
    expect(result).toMatchObject({
      state: "archived",
      currentAvailable: false,
      dailyAvailable: false,
    });
  });

  it("requires a timestamp when a provider claims a current observation", () => {
    const result = assessMarketFreshness({
      status: "delayed",
      observedAt: null,
      now,
    });
    expect(result).toMatchObject({
      state: "unknown",
      currentAvailable: false,
      dailyAvailable: false,
    });
  });
});

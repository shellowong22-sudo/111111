import { describe, expect, it } from "vitest";
import { parseCboeIndexSnapshotRows } from "./finceptCboeIndexAdapter";

describe("Fincept CBOE delayed index snapshot adapter", () => {
  it("normalizes delayed index observations and strips the provider caret", () => {
    const rows = parseCboeIndexSnapshotRows([
      {
        symbol: "^SPX",
        security_type: "index",
        current_price: 5_500.25,
        price_change: 12.5,
        price_change_percent: 0.23,
        last_trade_time: "2026-09-30T20:14:59",
        prev_day_close: 5_487.75,
      },
    ], "2026-10-01");
    expect(rows[0]).toMatchObject({
      date: "2026-09-30",
      value: 5_500.25,
      fields: {
        symbol: "SPX",
        currentPrice: 5_500.25,
        priceChange: 12.5,
        previousClose: 5_487.75,
        freshness: "official_delayed_snapshot",
      },
    });
  });

  it("drops rows without a usable positive index value", () => {
    expect(parseCboeIndexSnapshotRows([
      { symbol: "^EMPTY", current_price: "--" },
      { symbol: "^ZERO", current_price: 0 },
    ], "2026-10-01")).toEqual([]);
  });
});

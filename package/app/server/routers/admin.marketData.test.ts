import { describe, expect, it } from "vitest";
import { getMarketDataAssignments } from "./admin";

describe("getMarketDataAssignments", () => {
  it("maps the typed API fields to the actual market_data column names", () => {
    expect(getMarketDataAssignments({
      symbol: "TEST",
      changeVal: "1.25",
      changePct: "2.50",
      volume: "1000",
    })).toEqual([
      { column: "symbol", value: "TEST" },
      { column: "change_val", value: "1.25" },
      { column: "change_pct", value: "2.50" },
      { column: "volume", value: "1000" },
    ]);
  });

  it("ignores missing and unsupported fields instead of forming unsafe SQL columns", () => {
    expect(getMarketDataAssignments({ price: undefined, unsupported: "value" })).toEqual([]);
  });
});

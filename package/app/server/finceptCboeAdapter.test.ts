import { describe, expect, it } from "vitest";
import { parseCboeHistoryCsv } from "./finceptCboeAdapter";

describe("Fincept CBOE public history adapter", () => {
  it("normalizes the official CSV into dated observations without inventing timestamps", () => {
    const rows = parseCboeHistoryCsv(
      "DATE,OPEN,HIGH,LOW,CLOSE\n09/29/2026,16.01,16.62,15.68,16.07\n",
      "VIX",
    );
    expect(rows).toEqual([
      {
        date: "2026-09-29",
        value: 16.07,
        fields: {
          symbol: "VIX",
          close: 16.07,
          open: 16.01,
          high: 16.62,
          low: 15.68,
          indexFamily: "CBOE volatility indices",
          freshness: "official_delayed_history",
        },
      },
    ]);
    expect(parseCboeHistoryCsv("DATE,OPEN,HIGH,LOW,CLOSE\ninvalid,,,,\n", "VIX")).toEqual([]);
  });
});

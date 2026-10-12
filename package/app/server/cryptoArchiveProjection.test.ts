import { describe, expect, it } from "vitest";
import { projectArchivedCoinPrices, projectArchivedCoinMarkets } from "./routers/crypto";

describe("existing crypto-market archive projections", () => {
  it("uses only the exact coin's dated observations within the chosen window", () => {
    const rows = projectArchivedCoinPrices([
      { date: "2026-09-01", payload: { coinId: "bitcoin", price: 100 } },
      { date: "2026-09-30", payload: { coinId: "bitcoin", price: 200 } },
      { date: "2026-10-01", payload: { coinId: "ethereum", price: 900 } },
      { date: "2026-10-01", payload: { coinId: "bitcoin", price: 220 } },
      { date: "2026-10-02", payload: { coinId: "bitcoin", price: -1 } },
    ], "bitcoin", 7, new Date("2026-10-02T00:00:00Z"));
    expect(rows).toEqual([
      { date: "2026-09-30", price: 200 },
      { date: "2026-10-01", price: 220 },
    ]);
  });

  it("keeps one latest archive row per coin id, never mixing duplicate tickers", () => {
    const rows = projectArchivedCoinMarkets([
      { date: "2026-10-01", payload: { coinId: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 100, rank: 1 } },
      { date: "2026-09-30", payload: { coinId: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 50, rank: 1 } },
      { date: "2026-10-01", payload: { coinId: "different-btc", symbol: "BTC", name: "Another BTC", price: 5, rank: 200 } },
      { date: "2026-10-02", payload: { coinId: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 120, rank: 1 } },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "bitcoin", current_price: 120, observedAt: "2026-10-02" });
    expect(rows[1]).toMatchObject({ id: "different-btc", current_price: 5, observedAt: "2026-10-01" });
  });
});

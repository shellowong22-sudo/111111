import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFinceptCoinGeckoMarkets } from "./finceptCryptoAdapter";

afterEach(() => vi.unstubAllGlobals());

describe("CoinGecko market observation dates", () => {
  it("uses the asset's published observation time, not the collection time", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 120000, last_updated: "2026-09-30T12:34:56Z" },
        { id: "invalid", symbol: "bad", current_price: 1 },
      ],
    })));
    const result = await fetchFinceptCoinGeckoMarkets(2);
    expect(result.available).toBe(true);
    expect(result.observedAt).toBe("2026-09-30T12:34:56.000Z");
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      date: "2026-09-30",
      fields: { symbol: "BTC", observedAt: "2026-09-30T12:34:56.000Z" },
    });
  });
});

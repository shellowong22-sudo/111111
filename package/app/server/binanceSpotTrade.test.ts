import { describe, expect, it } from "vitest";
import { parseBinanceSpotTrade } from "./binanceSpotTrade";

const time = Date.parse("2026-10-02T13:14:17.500Z");
const trade = {
  e: "trade", s: "BTCUSDT", p: "86700.01000000", q: "0.001",
  T: time - 50, t: 123456,
};

describe("exchange trade is an identified, fresh spot observation", () => {
  it("keeps quote currency and exchange timestamp rather than relabeling it USD", () => {
    expect(parseBinanceSpotTrade(trade, "bitcoin", "BTCUSDT", time)).toMatchObject({
      coinId: "bitcoin", pair: "BTCUSDT", price: 86700.01,
      quoteCurrency: "USDT", observedAt: "2026-10-02T13:14:17.450Z",
    });
  });
  it("rejects wrong asset, non-trade, stale or malformed data", () => {
    expect(parseBinanceSpotTrade({ ...trade, s: "ETHUSDT" }, "bitcoin", "BTCUSDT", time)).toBeNull();
    expect(parseBinanceSpotTrade({ ...trade, e: "ticker" }, "bitcoin", "BTCUSDT", time)).toBeNull();
    expect(parseBinanceSpotTrade({ ...trade, T: time - 11_000 }, "bitcoin", "BTCUSDT", time)).toBeNull();
    expect(parseBinanceSpotTrade({ ...trade, p: "NaN" }, "bitcoin", "BTCUSDT", time)).toBeNull();
  });
});

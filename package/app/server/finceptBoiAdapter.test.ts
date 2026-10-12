import { describe, expect, it, vi } from "vitest";
import { fetchFinceptBoiFxBasket } from "./finceptBoiAdapter";

describe("Fincept Bank of Israel adapter", () => {
  it("normalizes published units into ILS per currency unit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      exchangeRates: [
        { key: "USD", currentExchangeRate: 3.5, currentChange: "-0.2", unit: 1, lastUpdate: "2026-10-01T08:00:00Z" },
        { key: "JPY", currentExchangeRate: 2.1, currentChange: 0.1, unit: 100, lastUpdate: "2026-10-01T08:00:00Z" },
        { key: "USD", currentExchangeRate: 3.5, currentChange: "-0.2", unit: 1, lastUpdate: "2026-10-01T08:00:00Z" },
      ],
    }), { status: 200 })));
    const result = await fetchFinceptBoiFxBasket();
    expect(result.available).toBe(true);
    expect(result.history).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 3.5, fields: expect.objectContaining({ symbol: "USD/ILS", unit: "ILS/USD", publishedUnit: 1 }) }),
      expect.objectContaining({ value: 0.021, fields: expect.objectContaining({ symbol: "JPY/ILS", unit: "ILS/JPY", publishedUnit: 100 }) }),
    ]));
    expect(result.history).toHaveLength(2);
  });

  it("keeps a failed public request unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("blocked", { status: 503 })));
    const result = await fetchFinceptBoiFxBasket();
    expect(result.available).toBe(false);
    expect(result.history).toEqual([]);
    expect(result.limitation).toContain("BOI_HTTP_503");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFinceptNbpFxBasket, fetchFinceptNbpGold, fetchFinceptNbpUsdPln } from "./finceptNbpAdapter";

describe("Fincept NBP reference adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps gold in PLN per gram with publication dates and no executable quote", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { data: "2026-09-28", cena: 510.11 },
      { data: "2026-09-29", cena: 512.64 },
      { data: "2026-09-30", cena: null },
    ]), { status: 200 }));
    const result = await fetchFinceptNbpGold();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/cenyzlota/last/30/");
    expect(result.realtime).toBe(false);
    expect(result.observedAt).toBe("2026-09-29");
    expect(result.history).toHaveLength(2);
    expect(result.history[1]).toMatchObject({
      value: 512.64,
      fields: { currency: "PLN", unit: "PLN/克", symbol: "NBP:GOLD:PLN:G" },
    });
    expect(result.history[1].fields).not.toHaveProperty("close");
  });

  it("maps only USD/PLN daily mid rates and rejects a wrong currency", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      code: "USD",
      rates: [{ effectiveDate: "2026-09-28", mid: 3.8478 }, { effectiveDate: "2026-09-29", mid: 0 }],
    }), { status: 200 }));
    const result = await fetchFinceptNbpUsdPln();
    expect(result.history).toEqual([expect.objectContaining({
      date: "2026-09-28",
      value: 3.8478,
      fields: expect.objectContaining({ symbol: "USD/PLN", base: "USD", quote: "PLN" }),
    })]);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ code: "EUR", rates: [] }), { status: 200 }));
    const mismatch = await fetchFinceptNbpUsdPln();
    expect(mismatch.available).toBe(false);
    expect(mismatch.history).toEqual([]);
  });

  it("publishes distinct non-USD PLN pairs with per-currency units and observation dates", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { table: "A", effectiveDate: "2026-09-28", rates: [
        { code: "USD", mid: 3.8478 },
        { code: "EUR", mid: 4.3754 },
        { code: "EUR", mid: 4.3754 },
        { code: "JPY", mid: 0.0262 },
        { code: "GBP", mid: 0 },
      ] },
      { table: "C", effectiveDate: "2026-09-29", rates: [{ code: "EUR", mid: 4.4 }] },
    ]), { status: 200 }));
    const result = await fetchFinceptNbpFxBasket();
    expect(result.realtime).toBe(false);
    expect(result.observedAt).toBe("2026-09-28");
    expect(result.history).toHaveLength(2);
    expect(result.history).toEqual([
      expect.objectContaining({ date: "2026-09-28", value: 4.3754, fields: expect.objectContaining({ symbol: "EUR/PLN", base: "EUR", quote: "PLN", unit: "PLN/EUR" }) }),
      expect.objectContaining({ date: "2026-09-28", value: 0.0262, fields: expect.objectContaining({ symbol: "JPY/PLN", unit: "PLN/JPY" }) }),
    ]);
  });
});

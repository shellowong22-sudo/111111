import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFinceptCnbFxBasket } from "./finceptCnbAdapter";

describe("Fincept CNB reference adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes the published amount to one foreign-currency unit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response([
      "25 Sep 2026 #186",
      "Country|Currency|Amount|Code|Rate",
      "EMU|euro|1|EUR|24.350",
      "Hungary|forint|100|HUF|6.663",
      "Invalid|currency|1|BAD|x",
    ].join("\n"), { status: 200 }));

    const result = await fetchFinceptCnbFxBasket();

    expect(result).toMatchObject({
      available: true,
      symbol: "CNB:TABLE:DAILY:CZK",
      observedAt: "2026-09-25",
      realtime: false,
    });
    expect(result.history).toEqual([
      expect.objectContaining({
        date: "2026-09-25",
        value: 24.35,
        fields: expect.objectContaining({ symbol: "EUR/CZK", name: "欧元兑捷克克朗参考汇率", unit: "CZK/EUR", amount: 1, fixingRate: 24.35 }),
      }),
      expect.objectContaining({
        date: "2026-09-25",
        value: 0.06663,
        fields: expect.objectContaining({ symbol: "HUF/CZK", unit: "CZK/HUF", amount: 100, fixingRate: 6.663 }),
      }),
    ]);
  });

  it("returns a truthful unavailable result on a malformed publication", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not-a-cnb-table", { status: 200 }));
    const result = await fetchFinceptCnbFxBasket();
    expect(result.available).toBe(false);
    expect(result.history).toEqual([]);
    expect(result.limitation).toContain("CNB_INVALID_PUBLICATION_DATE");
  });
});

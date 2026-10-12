import { describe, expect, it } from "vitest";
import { fetchFinceptNasdaqScreener } from "./finceptNasdaqAdapter";

describe("Fincept Nasdaq public screener adapter", () => {
  it("does not expose provider internals as a business observation", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({
      data: {
        table: {
          rows: [{
            symbol: "NVDA",
            name: "NVIDIA Corporation Common Stock",
            lastsale: "$179.32",
            netchange: "+1.20",
            pctchange: "+0.67%",
            marketCap: "$4,361,234,000,000",
            ignoredProviderField: "secret",
          }],
        },
      },
    }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    try {
      const result = await fetchFinceptNasdaqScreener();
      expect(result.available).toBe(true);
      expect(result.history[0]).toMatchObject({
        value: 179.32,
        fields: {
          symbol: "NVDA",
          name: "NVIDIA Corporation Common Stock",
          change: 1.2,
          changePct: 0.67,
        },
      });
      expect(JSON.stringify(result)).not.toContain("ignoredProviderField");
    } finally {
      globalThis.fetch = original;
    }
  });
});

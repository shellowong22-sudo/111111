import { describe, expect, it } from "vitest";

describe("TWELVE_DATA_API_KEY", () => {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  // Twelve Data is an optional licensed connector.  A missing secret is an
  // explicit external-authorization boundary, not a reason to fail the whole
  // local suite; free public adapters are covered independently.
  it.skipIf(!apiKey)("can authorize a lightweight EUR/USD latest-price request", async () => {

    const response = await fetch("https://api.twelvedata.com/price?symbol=EUR/USD", {
      headers: { Authorization: `apikey ${apiKey}` },
    });
    const body = await response.json() as { price?: string; code?: number; message?: string };

    expect(response.ok, body.message ?? "Twelve Data request failed").toBe(true);
    expect(body.code, body.message ?? "Twelve Data returned an error payload").toBeUndefined();
    expect(Number(body.price)).toBeGreaterThan(0);
  }, 20_000);
});

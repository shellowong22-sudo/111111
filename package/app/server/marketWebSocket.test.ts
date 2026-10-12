import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("legacy market WebSocket data boundary", () => {
  it("contains no client-visible random tick generation", () => {
    const source = readFileSync(resolve(process.cwd(), "server/marketWebSocket.ts"), "utf8");
    expect(source).not.toContain("Math.random");
    expect(source).not.toMatch(/type:\s*'MARKET_TICK'\s*,/);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("bottom global ticker current-data boundary", () => {
  it("does not render stored snapshots as live quotes", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/components/GlobalTickerTape.tsx"),
      "utf8",
    );
    expect(source).toContain("trpc.market.headerObservations.useQuery");
    expect(source).toContain("market.freshnessState !== 'current'");
    expect(source).toContain("market.available");
    expect(source).toContain("data-ticker-symbol={item.symbol}");
    expect(source).not.toContain("duplicatedItems");
    expect(source).not.toContain("navigate(`/market?symbol=");
  });
});

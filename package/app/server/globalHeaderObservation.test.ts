import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("current market observation boundary", () => {
  it("uses the verified public observation contract for the existing ticker", () => {
    const ticker = read("client/src/components/GlobalTickerTape.tsx");
    const sidebar = read("client/src/components/LiveNewsTicker.tsx");
    expect(ticker).toContain("trpc.market.headerObservations.useQuery");
    expect(sidebar).toContain("trpc.market.headerObservations.useQuery");
    expect(ticker).toContain("refetchInterval: 60_000");
    expect(sidebar).toContain("当前行情不可用 · 不显示旧快照");
  });

  it("filters the ticker to current, explicitly timed observations", () => {
    const ticker = read("client/src/components/GlobalTickerTape.tsx");
    expect(ticker).toContain("market.freshnessState !== 'current'");
    expect(ticker).toContain("['realtime', 'delayed'].includes");
    expect(ticker).toContain("暂无时效合格的当前行情");
    expect(ticker).toContain("const seenSymbols = new Set<string>()");
  });
});

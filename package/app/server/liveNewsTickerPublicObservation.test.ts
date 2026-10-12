import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/LiveNewsTicker.tsx"),
  "utf8",
);

describe("market observation sidebar", () => {
  it("reads the public observation contract and exposes an explicit unavailable state", () => {
    expect(source).toContain("trpc.market.headerObservations.useQuery");
    expect(source).toContain("当前行情读取失败，不显示旧快照");
    expect(source).toContain("时效合格的盘中观察");
    expect(source).toContain("trpc.market.getHistory.useQuery");
    expect(source).not.toContain("useRealtimePrices");
  });
});

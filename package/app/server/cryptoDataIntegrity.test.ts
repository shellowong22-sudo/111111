import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cryptoRouter } from "./routers/crypto";

afterEach(() => vi.unstubAllGlobals());

describe("加密资产真实数据边界", () => {
  it("保留原路由但不生成随机行情或固定市场快照", () => {
    const source = readFileSync(`${process.cwd()}/server/routers/crypto.ts`, "utf8");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("67850");
    expect(source).not.toContain("2.52T");
    expect(source).toContain("公开加密市场总览暂不可用；未使用快照或随机值");
    expect(source).toContain("交易所净流入未配置免密可验证来源，因此保持空值");
    expect(source).toContain('chart === "hash-rate" ? (point.y as number) / 1_000_000');
  });

  it("将公开币种行情清洗为原页面字段，不补造缺失变化", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (!url.includes("/coins/markets")) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify([{ id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 65000, market_cap: 1_280_000_000_000, market_cap_rank: 1, total_volume: 32_000_000_000, circulating_supply: 19_700_000, max_supply: 21_000_000, ath: 73750, ath_date: "2024-03-14T00:00:00Z", price_change_percentage_24h: 1.5, price_change_percentage_1h_in_currency: null, price_change_percentage_7d_in_currency: -2.25 }]), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const rows = await cryptoRouter.createCaller({} as never).getCoinList();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ symbol: "BTC", price: 65000, changePct: 1.5, change1h: null, change7d: -2.25, rank: 1 });
  });

  it("恐贪指数只使用接口返回日期和值", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ value: "71", value_classification: "Greed", timestamp: "1789776000" }] }), { status: 200, headers: { "content-type": "application/json" } })));
    const rows = await cryptoRouter.createCaller({} as never).getFearGreedHistory({ days: 2 });
    expect(rows).toEqual([{ date: "2026-09-19", value: 71, label: "Greed" }]);
  });
});

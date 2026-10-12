import { describe, expect, it } from "vitest";
import { projectVerifiedAShareUniverse, summarizeEqsMarketBreadth, summarizeMarketBreadth } from "./routers/stockMarketResearch";

describe("EQS market breadth projection", () => {
  it("searches all verified A-share symbols by name and code with stable pages and revisions", () => {
    const rows = [
      { id: 1, symbol: "sh600000", observationDate: "2026-09-29", payload: { frequency: "verified_market_session", name: "浦发银行", value: 10 } },
      { id: 2, symbol: "sh600000", observationDate: "2026-09-30", payload: { frequency: "verified_market_session", name: "浦发银行", value: 11 } },
      { id: 3, symbol: "sh600000", observationDate: "2026-09-30", payload: { frequency: "verified_market_session", name: "浦发银行", value: 12 } },
      { id: 4, symbol: "sz000001", observationDate: "2026-09-30", payload: { frequency: "verified_market_session", name: "平安银行", value: 13 } },
      { id: 5, symbol: "sh600001", observationDate: "2026-10-01", payload: { frequency: "unverified", name: "未核实", value: 99 } },
    ];
    expect(projectVerifiedAShareUniverse(rows, "浦发", 0, 30)).toMatchObject({
      observedAt: "2026-09-30", total: 1,
      rows: [{ ticker: "SH600000", securityName: "浦发银行", price: 12, currency: "CNY", observationDate: "2026-09-30" }],
      realtime: false,
    });
    expect(projectVerifiedAShareUniverse(rows, "", 1, 1)).toMatchObject({
      total: 2, page: 1, rows: [{ ticker: "SZ000001" }],
    });
    expect(projectVerifiedAShareUniverse(rows, "600001", 0, 30).rows).toEqual([]);
  });
  it("summarizes only the latest archived observation date", () => {
    const result = summarizeMarketBreadth([
      {
        observationDate: "2026-09-28",
        payload: { symbol: "OLD", change: 99, volume: 1 },
      },
      {
        observationDate: "2026-09-29",
        payload: { symbol: "UP", changePct: "1.20", volume: "100", tradeValue: "1000" },
      },
      {
        observationDate: "2026-09-29",
        payload: { symbol: "DOWN", change: -0.2, volume: 200, tradeValue: 3000 },
      },
      {
        observationDate: "2026-09-29",
        payload: { symbol: "FLAT", change: "0", volume: 300, tradeValue: 5000 },
      },
    ]);

    expect(result).toMatchObject({
      status: "available",
      observedAt: "2026-09-29",
      total: 3,
      advancing: 1,
      declining: 1,
      unchanged: 1,
      totalVolume: 600,
      totalTradeValue: 9000,
    });
    expect(result.topAdvancers[0]).toMatchObject({
      symbol: "UP",
      changePct: 1.2,
      value: null,
    });
    expect(result.topDecliners[0]).toMatchObject({
      symbol: "DOWN",
      change: -0.2,
    });
  });

  it("keeps an empty state when no archived observations exist", () => {
    expect(summarizeMarketBreadth([])).toMatchObject({
      status: "unavailable",
      total: 0,
      observedAt: null,
    });
  });

  it("deduplicates retried rows for the same exchange and symbol", () => {
    const result = summarizeMarketBreadth([
      {
        observationDate: "2026-09-29",
        payload: { symbol: "2330", exchange: "TWSE", change: 10, volume: 100, tradeValue: 1_000 },
      },
      {
        observationDate: "2026-09-29",
        payload: { symbol: "2330", exchange: "TWSE", change: 10, volume: 100, tradeValue: 1_000 },
      },
      {
        observationDate: "2026-09-29",
        payload: { symbol: "AAPL", exchange: "NASDAQ", change: -2, volume: 50, tradeValue: 500 },
      },
    ]);

    expect(result.total).toBe(2);
    expect(result.advancing).toBe(1);
    expect(result.declining).toBe(1);
    expect(result.totalVolume).toBe(150);
    expect(result.totalTradeValue).toBe(1_500);
    expect(result.topAdvancers).toHaveLength(1);
    expect(result.topDecliners).toHaveLength(1);
  });

  it("keeps A-share and Taiwan sessions separate instead of selecting the newest date across markets", () => {
    const result = summarizeEqsMarketBreadth([
      {
        dataContractId: "equity.cn.a.snapshot.akshare.v1",
        observationDate: "2026-09-30",
        payload: { symbol: "sh600000", changePct: 3.268, volume: 100 },
      },
      {
        dataContractId: "equity.twse.snapshot.v1",
        observationDate: "2026-10-01",
        payload: { symbol: "2330", changePct: -1, volume: 200 },
      },
    ]);
    expect(result).toMatchObject({
      marketScope: "A股", observedAt: "2026-09-30",
      total: 1, advancing: 1, declining: 0, totalVolume: 100,
    });
  });
});

import { describe, expect, it } from "vitest";
import { normalizeAkShareDataset } from "./akshareMarketData";

const fetchedAt = "2026-10-02T04:00:00Z";

describe("A-share public market-session integrity", () => {
  it("refuses a clock-only quote rather than assigning the fetch date", () => {
    const result = normalizeAkShareDataset("stock_snapshot", [
      { 代码: "sh600000", 名称: "浦发银行", 最新价: 9.48, 时间戳: "15:34:59" },
    ], fetchedAt);
    expect(result.available).toBe(false);
    expect(result.history).toHaveLength(0);
  });

  it("retains the independently verified session, name and quoted change without a realtime claim", () => {
    const result = normalizeAkShareDataset("stock_snapshot", [
      {
        代码: "sh600000", 名称: "浦发银行", 最新价: 9.48,
        涨跌幅: 3.268, 成交量: 147484820, 交易日期: "2026-09-30",
        时间戳: "15:34:59",
      },
    ], fetchedAt);
    expect(result).toMatchObject({
      available: true, observedAt: "2026-09-30", realtime: false,
      history: [{
        date: "2026-09-30", value: 9.48,
        fields: { symbol: "sh600000", name: "浦发银行", changePct: 3.268 },
      }],
    });
    expect(result.delayStatus).toContain("非盘中实时");
  });

  it("requires a checked trading day for the Chinese index cross-section as well", () => {
    const withoutDate = normalizeAkShareDataset("cn_index_snapshot", [
      { 代码: "sh000001", 名称: "上证指数", 最新价: 3842.1946 },
    ], fetchedAt);
    expect(withoutDate.available).toBe(false);
    const verified = normalizeAkShareDataset("cn_index_snapshot", [
      {
        代码: "sh000001", 名称: "上证指数", 最新价: 3842.1946,
        涨跌幅: 0.307, 交易日期: "2026-09-30",
      },
    ], fetchedAt);
    expect(verified).toMatchObject({
      available: true, observedAt: "2026-09-30", realtime: false,
      history: [{ fields: { symbol: "sh000001", name: "上证指数", changePct: 0.307 } }],
    });
  });
});

describe("central-bank published rates", () => {
  it.each(["macro_japan_bank_rate", "macro_uk_bank_rate"] as const)(
    "stores %s actual on its publication date, never a future empty row",
    operation => {
      const result = normalizeAkShareDataset(operation, [
        { 时间: "2026年09月", 前值: 1, 现值: 1.25, 发布日期: "2026-09-18" },
        { 时间: "2026年10月", 前值: 1.25, 现值: null, 发布日期: "2026-10-30" },
      ], fetchedAt);
      expect(result).toMatchObject({
        available: true, observedAt: "2026-09-18", realtime: false,
        history: [{ date: "2026-09-18", value: 1.25, fields: { previous: 1 } }],
      });
      expect(result.history).toHaveLength(1);
    },
  );
});

describe("ETF dated unit NAV", () => {
  it("keeps unit NAV separate from a trade price and excludes undated/future values", () => {
    const result = normalizeAkShareDataset("etf_snapshot", [
      {
        基金代码: "520970", 基金名称: "嘉实中证港股通创新药ETF",
        "最新-交易日": "2026-09-30", "最新-单位净值": 0.9772,
        "最新-累计净值": 0.9772, "查询日期": "2026-09-30", 增长率: 3.99,
      },
      { 基金代码: "000001", "最新-单位净值": 1.2 },
      { 基金代码: "000002", "最新-交易日": "2026-10-30", "查询日期": "2026-09-30", "最新-单位净值": 1.3 },
    ], fetchedAt);
    expect(result).toMatchObject({
      available: true, observedAt: "2026-09-30", realtime: false,
      history: [{
        date: "2026-09-30", value: 0.9772,
        fields: { fundCode: "520970", netAssetValue: 0.9772, fundType: "ETF", changePct: 3.99 },
      }],
    });
    expect(result.history).toHaveLength(1);
    expect(result.delayStatus).toContain("非成交价格");
  });
});

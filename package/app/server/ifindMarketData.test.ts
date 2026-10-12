import { describe, expect, it, vi } from "vitest";
import {
  createIfindMarketReader,
  createIfindSnapshotReader,
  fetchIfindLicensedDataset,
  normalizeIfindSymbol,
  parseIfindHistory,
} from "./ifindMarketData";
import { getIfindDataCatalog } from "./ifindDataCatalog";

describe("licensed iFinD market adapter", () => {
  it("maps supported market symbols without guessing ambiguous codes", () => {
    expect(normalizeIfindSymbol("600000.SS")).toBe("600000.SH");
    expect(normalizeIfindSymbol("000001")).toBe("000001.SZ");
    expect(normalizeIfindSymbol("AAPL")).toBe("AAPL.O");
    expect(normalizeIfindSymbol("0005.HK")).toBe("0005.HK");
    expect(normalizeIfindSymbol("bad symbol")).toBeNull();
  });

  it("keeps only actual dated positive closes and never fills missing OHLC", () => {
    const result = parseIfindHistory(
      {
        ok: true,
        symbol: "600000.SH",
        records: [
          { date: "2026-09-10", close: 10, open: null, volume: 100 },
          {
            date: "2026-09-11",
            close: 11,
            open: 10.1,
            high: 11.2,
            low: 10,
            volume: 120,
          },
          { date: "2026-09-11", close: 11.1, volume: 125 },
          { date: "bad", close: 99 },
          { date: "2026-09-12", close: 0 },
        ],
        realtime: {
          latest: 11.2,
          preClose: 11.1,
          change: 0.1,
          changeRatio: 0.9009,
          timestamp: "2026-09-11 15:00:00",
        },
        realtimeAvailable: true,
      },
      "600000.SS",
      "2026-09-11T08:00:00.000Z"
    )!;
    expect(result.source).toBe("Tonghuashun iFinD SDK");
    expect(result.currency).toBe("CNY");
    expect(result.history.map(point => [point.date, point.value])).toEqual([
      ["2026-09-10", 10],
      ["2026-09-11", 11.1],
    ]);
    expect(result.history[0].open).toBeNull();
    expect(result.price).toBe(11.2);
    expect(result.meta.realtime).toBe(true);
  });

  it("passes a bounded fixed-schema request to the bridge", async () => {
    const runBridge = vi.fn().mockResolvedValue({
      ok: true,
      symbol: "AAPL.O",
      records: [
        { date: "2026-09-10", close: 100 },
        { date: "2026-09-11", close: 101 },
      ],
    });
    const read = createIfindMarketReader({
      runBridge,
      now: () => new Date("2026-09-12T00:00:00.000Z"),
    });
    expect((await read("AAPL", "1mo"))?.price).toBe(101);
    expect(runBridge).toHaveBeenCalledWith({
      action: "history",
      symbols: ["AAPL.O", "AAPL.N"],
      begin: "2026-08-01",
      end: "2026-09-12",
    });
  });

  it("returns unavailable instead of inventing data on SDK failure", async () => {
    const read = createIfindMarketReader({
      runBridge: vi
        .fn()
        .mockResolvedValue({ ok: false, code: "IFIND_LOGIN_FAILED" }),
      now: () => new Date("2026-09-12T00:00:00.000Z"),
    });
    await expect(read("AAPL", "1mo")).resolves.toBeNull();
  });

  it("reads a bounded batch snapshot and preserves realtime versus daily status", async () => {
    const runBridge = vi.fn().mockResolvedValue({
      ok: true,
      realtimeAvailable: false,
      records: [
        {
          symbol: "AAPL.O",
          timestamp: "2026-09-11",
          preClose: 326.57,
          open: 327.45,
          high: 336.22,
          low: 326.3,
          close: 332.27,
          latest: 332.27,
          change: 5.7,
          changeRatio: 1.7454,
          volume: 50716865,
        },
        { symbol: "0005.HK", close: null },
      ],
    });
    const read = createIfindSnapshotReader({
      runBridge,
      now: () => new Date("2026-09-14T00:00:00.000Z"),
    });
    const rows = await read(["AAPL.O", "0005.HK"]);
    expect(runBridge).toHaveBeenCalledWith({
      action: "snapshot",
      symbols: ["AAPL.O", "0005.HK"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      requestedSymbol: "AAPL.O",
      providerSymbol: "AAPL.O",
      price: 332.27,
      volume: 50716865,
      currency: "USD",
      realtime: false,
    });
  });

  it("rejects undeclared dataset fields before reaching the licensed bridge", async () => {
    await expect(
      fetchIfindLicensedDataset({
        categoryId: "indices",
        mode: "realtime",
        symbols: ["000001.SH"],
        fields: ["latest", "arbitraryExecutableField"],
      })
    ).resolves.toMatchObject({
      available: false,
      categoryId: "indices",
      mode: "realtime",
      columns: [],
      rows: [],
      reason: "字段不在已校验行情白名单：arbitraryExecutableField",
    });
  });

  it("publishes one unique catalogue with all 13 requested categories and 20 SDK functions", () => {
    const catalog = getIfindDataCatalog();
    expect(catalog.categories).toHaveLength(13);
    expect(catalog.functions).toHaveLength(20);
    expect(new Set(catalog.categories.map(item => item.id)).size).toBe(13);
    expect(new Set(catalog.functions.map(item => item.id)).size).toBe(20);
    expect(catalog.fieldGroups.basic.map(item => item.id)).toEqual([
      "ths_stock_short_name_stock",
      "ths_stock_code_stock",
      "ths_pe_stock",
      "ths_pb_stock",
    ]);
  });
});

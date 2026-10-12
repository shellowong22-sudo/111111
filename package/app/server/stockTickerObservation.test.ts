import { describe, expect, it, vi } from "vitest";
import {
  cleanStockHistory,
  createStockTickerReader,
} from "./stockTickerObservation";
import {
  parseNasdaqDate,
  parseNasdaqNumber,
  type YahooChartResult,
} from "./realDataService";

const now = Date.parse("2026-09-10T00:00:00Z");
const point = (date: string, value: number) => ({
  date,
  value,
  open: null,
  high: null,
  low: null,
  close: value,
  volume: null,
});
const data = (): YahooChartResult => ({
  symbol: "AAPL",
  currency: "USD",
  price: 101,
  change: 1,
  changePct: 1,
  meta: {},
  source: "Nasdaq historical market data",
  history: [point("2026-09-08", 100), point("2026-09-09", 101)],
});

describe("honest daily stock observation pipeline", () => {
  it("never parses missing numbers as zero and validates actual dates", () => {
    for (const missing of ["", " ", "$", "--", "N/A", null])
      expect(parseNasdaqNumber(missing)).toBeNull();
    expect(parseNasdaqNumber("$1,234.50")).toBe(1234.5);
    expect(parseNasdaqNumber("0")).toBe(0);
    expect(parseNasdaqDate("02/30/2026")).toBeNull();
    expect(parseNasdaqDate("02/29/2024")).toBe("2024-02-29");
  });
  it("rejects future, impossible, empty and nonpositive rows; deduplicates and sorts", () => {
    const input = data();
    input.history = [
      point("2026-09-09", 100),
      point("2026-09-08", 99),
      point("2026-09-09", 101),
      point("2026-09-11", 102),
      point("2026-08-32", 99),
      point("2026-09-07", NaN),
      point("2026-09-06", 0),
    ];
    expect(
      cleanStockHistory(input, "1mo", now)?.history.map(p => [p.date, p.value])
    ).toEqual([
      ["2026-09-08", 99],
      ["2026-09-09", 101],
    ]);
  });
  it("bounds the requested window while preserving missing OHLC", () => {
    const input = data();
    input.history.unshift(point("2026-08-09", 90));
    const result = cleanStockHistory(input, "1mo", now)!;
    expect(result.history).toHaveLength(2);
    expect(result.history[0].open).toBeNull();
  });
  it("uses the independently available Nasdaq source with correct asset class and coalesces identical reads", async () => {
    const ifind = vi.fn().mockResolvedValue(null);
    const yahoo = vi.fn().mockResolvedValue(null);
    const nasdaq = vi.fn().mockResolvedValue(data());
    const read = createStockTickerReader({
      ifind,
      yahoo,
      nasdaq,
      now: () => now,
    });
    const result = await Promise.all([
      read("SPY", "1mo", "etf"),
      read("SPY", "1mo", "etf"),
    ]);
    expect(ifind).toHaveBeenCalledTimes(1);
    expect(yahoo).toHaveBeenCalledTimes(1);
    expect(nasdaq).toHaveBeenCalledTimes(1);
    expect(nasdaq).toHaveBeenCalledWith("SPY", "1mo", "etf");
    expect(result[0]?.meta.realtime).toBe(false);
    expect(result[0]?.source).toContain("Nasdaq");
    await read("SPY", "1mo", "etf");
    expect(yahoo).toHaveBeenCalledTimes(1);
  });
  it("does not silently substitute a different instrument or fake values when both sources fail", async () => {
    const read = createStockTickerReader({
      ifind: vi.fn().mockResolvedValue(null),
      yahoo: vi.fn().mockRejectedValue(new Error("403")),
      nasdaq: vi.fn().mockResolvedValue(null),
      now: () => now,
    });
    expect(await read("MISSING", "1mo")).toBeNull();
  });
  it("does not refetch the second source when a valid primary observation exists", async () => {
    const nasdaq = vi.fn();
    const read = createStockTickerReader({
      ifind: vi.fn().mockResolvedValue(null),
      yahoo: vi.fn().mockResolvedValue(data()),
      nasdaq,
      now: () => now,
    });
    expect(await read("AAPL", "1mo")).not.toBeNull();
    expect(nasdaq).not.toHaveBeenCalled();
  });
  it("uses licensed iFinD data first without calling public fallbacks", async () => {
    const ifind = vi
      .fn()
      .mockResolvedValue({
        ...data(),
        meta: { realtime: true },
        source: "Tonghuashun iFinD SDK" as const,
      });
    const yahoo = vi.fn();
    const nasdaq = vi.fn();
    const read = createStockTickerReader({
      ifind,
      yahoo,
      nasdaq,
      now: () => now,
    });
    expect((await read("AAPL", "1mo"))?.source).toBe("Tonghuashun iFinD SDK");
    expect((await read("AAPL", "1mo"))?.meta.realtime).toBe(true);
    expect(ifind).toHaveBeenCalledWith("AAPL", "1mo");
    expect(yahoo).not.toHaveBeenCalled();
    expect(nasdaq).not.toHaveBeenCalled();
  });
});

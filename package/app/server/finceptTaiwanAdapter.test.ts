import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchFinceptTaiexSnapshot,
  fetchFinceptTwseEquitySnapshot,
  fetchFinceptTwseValuations,
  normalizeTwseDate,
} from "./finceptTaiwanAdapter";

describe("Fincept TWSE adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes Gregorian and ROC exchange dates", () => {
    expect(normalizeTwseDate("20260923")).toBe("2026-09-23");
    expect(normalizeTwseDate("1150923")).toBe("2026-09-23");
    expect(normalizeTwseDate("invalid")).toBeNull();
  });

  it("maps official equity snapshot rows to EQS observations", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      {
        Date: "20260923",
        Code: "2330",
        Name: "台積電",
        TradeVolume: "1000",
        TradeValue: "100000",
        OpeningPrice: "100.00",
        HighestPrice: "102.00",
        LowestPrice: "99.50",
        ClosingPrice: "101.50",
        Change: "1.50",
        Transaction: "20",
      },
    ]), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await fetchFinceptTwseEquitySnapshot();
    expect(result.available).toBe(true);
    expect(result.realtime).toBe(false);
    expect(result.symbol).toBe("TWSE:ALL");
    expect(result.observedAt).toBe("2026-09-23");
    expect(result.history).toEqual([expect.objectContaining({
      date: "2026-09-23",
      symbol: "2330",
      payload: expect.objectContaining({
        name: "台積電",
        securityName: "台積電",
        close: 101.5,
        volume: 1000,
        currency: "TWD",
      }),
    })]);
  });

  it("maps the latest TAIEX observation without fabricating an intraday time", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { Date: "1150922", TAIEX: "46948.72", Change: "820.25" },
      { Date: "1150923", TAIEX: "47001.12", Change: "52.40" },
    ]), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await fetchFinceptTaiexSnapshot();
    expect(result.available).toBe(true);
    expect(result.realtime).toBe(false);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toEqual(expect.objectContaining({
      date: "2026-09-23",
      symbol: "TAIEX",
      payload: expect.objectContaining({ close: 47001.12, value: 47001.12 }),
    }));
  });

  it("keeps exchange valuations in a distinct contract without duplicating prices", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { Date: "20260924", Code: "1101", Name: "台泥", ClosePrice: "25.25", PEratio: "", PBratio: "0.82", DividendYield: "3.17", FiscalYearQuarter: "2026Q2" },
      { Date: "20260924", Code: "1102", Name: "亞泥", ClosePrice: "33.30", PEratio: "9.86", PBratio: "0.69", DividendYield: "5.18", FiscalYearQuarter: "2026Q2" },
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await fetchFinceptTwseValuations();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d");
    expect(result.available).toBe(true);
    expect(result.realtime).toBe(false);
    expect(result.history).toHaveLength(2);
    expect(result.history[0].payload.pe).toBeNull();
    expect(result.history[1].payload.pe).toBe(9.86);
    expect(result.history[1].payload.fiscalYearQuarter).toBe("2026Q2");
    expect(result.history[1].payload).not.toHaveProperty("close");
  });
});

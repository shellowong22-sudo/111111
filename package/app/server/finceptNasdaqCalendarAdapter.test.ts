import { describe, expect, it } from "vitest";
import {
  parseNasdaqDividendRows,
  parseNasdaqEconomicRows,
  parseNasdaqEarningsRows,
  parseNasdaqIpoRows,
} from "./finceptNasdaqCalendarAdapter";

describe("Fincept Nasdaq calendar adapters", () => {
  it("normalizes earnings without inventing an actual EPS", () => {
    const rows = parseNasdaqEarningsRows([
      {
        symbol: "ACN",
        name: "Accenture plc",
        lastYearEPS: "$3.03",
        epsForecast: "$3.19",
        noOfEsts: "7",
        fiscalQuarterEnding: "Aug/2026",
        time: "time-pre-market",
      },
    ], "2026-10-01");
    expect(rows[0]).toMatchObject({
      date: "2026-10-01",
      value: 3.19,
      fields: {
        eventType: "earnings",
        symbol: "ACN",
        companyName: "Accenture plc",
        epsPrevious: 3.03,
        epsConsensus: 3.19,
        epsActual: null,
        reportingTime: "pre-market",
      },
    });
  });

  it("normalizes dividends by ex-dividend date", () => {
    const rows = parseNasdaqDividendRows([
      {
        symbol: "ANDE",
        companyName: "Andersons, Inc.",
        dividend_Ex_Date: "10/01/2026",
        payment_Date: "10/22/2026",
        record_Date: "10/01/2026",
        announcement_Date: "8/20/2026",
        dividend_Rate: 0.2,
        indicated_Annual_Dividend: 0.8,
      },
    ], "2026-10-01");
    expect(rows[0]).toMatchObject({
      date: "2026-10-01",
      value: 0.2,
      fields: {
        eventType: "dividend",
        symbol: "ANDE",
        paymentDate: "2026-10-22",
        annualizedAmount: 0.8,
      },
    });
  });

  it("keeps IPO events even when a ticker is not published yet", () => {
    const rows = parseNasdaqIpoRows([
      {
        companyName: "Example Holdings",
        proposedTickerSymbol: "",
        expectedPriceDate: "10/15/2026",
        proposedSharePrice: "$12.00",
        dealStatus: "Upcoming",
      },
    ], "upcoming");
    expect(rows[0]).toMatchObject({
      date: "2026-10-15",
      value: 12,
      fields: {
        eventType: "ipo",
        symbol: null,
        companyName: "Example Holdings",
        dealStatus: "Upcoming",
      },
    });
  });

  it("cleans economic event descriptions and preserves empty actuals", () => {
    const rows = parseNasdaqEconomicRows([
      {
        country: "Japan",
        eventName: "BoJ Summary of Opinions",
        gmt: "19:50",
        actual: "&nbsp;",
        consensus: " ",
        previous: "&nbsp;",
        description: "A&lt;BR/&gt;B",
      },
    ], "2026-10-01");
    expect(rows[0]).toMatchObject({
      date: "2026-10-01",
      value: null,
      fields: {
        eventType: "economic_event",
        country: "Japan",
        eventName: "BoJ Summary of Opinions",
        actual: null,
        description: "A B",
      },
    });
  });
});

import { describe, it, expect } from "vitest";
import { centralBankDrilldown } from "../shared/centralBankDrilldown";
import {
  ECONOMIC_SERIES,
  type EconomicSnapshot,
  type EconomicSeriesId,
} from "../shared/economicObservations";
const fixture = (
  histories: Partial<
    Record<EconomicSeriesId, Array<{ date: string; value: number }>>
  >
): EconomicSnapshot => ({
  retrievedAt: "2026-09-19",
  series: Object.entries(histories).map(([id, history]) => ({
    id,
    label: ECONOMIC_SERIES[id as EconomicSeriesId]?.[0] ?? id,
    unit: "test",
    frequency: "test",
    sourceUrl: "",
    retrievedAt: "2026-09-19",
    status: "available",
    error: null,
    history: history!,
  })),
});
describe("central-bank distinct drilldown", () => {
  it("rejects unrelated series instead of applying another field's analysis", () => {
    const data = fixture({ WALCL: [{ date: "2024-01-01", value: 1000 }, { date: "2024-01-08", value: 900 }] });
    expect(centralBankDrilldown("cbrt", "WALCL", data).rows).toEqual([]);
    expect(centralBankDrilldown("fdsp", "CPIAUCSL", data).columns).toEqual([]);
  });
  it("does not infer a continuous policy hold across missing daily observations", () => {
    const data = fixture({ DFEDTARU: [{ date: "2024-01-01", value: 5 }, { date: "2024-01-03", value: 5 }] });
    const drill = centralBankDrilldown("cbrt", "DFEDTARU", data);
    expect(drill.rows).toHaveLength(2);
    expect(drill.rows.map(row => row.elapsed)).toEqual([0, 0]);
  });
  it("does not attribute monthly real-rate changes across a missing month", () => {
    const data = fixture({
      CPIAUCSL: [{ date: "2023-01-01", value: 100 }, { date: "2023-03-01", value: 100 }, { date: "2024-01-01", value: 103 }, { date: "2024-03-01", value: 104 }],
      DFEDTARU: [{ date: "2024-01-31", value: 5 }, { date: "2024-03-31", value: 5.5 }],
    });
    expect(centralBankDrilldown("cbrt", "CPIAUCSL", data).rows.at(-1)).toMatchObject({ policyChange: null, inflationChange: null, realChange: null });
  });
  it("builds rate hold intervals rather than repeating daily observations", () => {
    const d = centralBankDrilldown(
      "cbrt",
      "DFEDTARU",
      fixture({
        DFEDTARU: [
          { date: "2024-01-01", value: 5.5 },
          { date: "2024-01-02", value: 5.5 },
          { date: "2024-01-03", value: 5.25 },
        ],
      })
    );
    expect(d.rows).toEqual([
      { start: "2024-01-01", end: "2024-01-02", rate: 5.5, elapsed: 1 },
      { start: "2024-01-03", end: "2024-01-03", rate: 5.25, elapsed: 0 },
    ]);
  });
  it("computes policy corridor from matching dates only", () => {
    const d = centralBankDrilldown(
      "cbrt",
      "DFEDTARL",
      fixture({
        DFEDTARL: [{ date: "2024-01-01", value: 5 }],
        DFEDTARU: [{ date: "2024-01-01", value: 5.5 }],
      })
    );
    expect(d.rows).toEqual([{ date: "2024-01-01", width: 50, midpoint: 5.25 }]);
  });
  it("computes asset peak drawdown and securities share without copying the balance sheet", () => {
    const d = centralBankDrilldown(
      "fdsp",
      "WALCL",
      fixture({
        WALCL: [
          { date: "2024-01-01", value: 1000 },
          { date: "2024-01-08", value: 900 },
        ],
      })
    );
    expect(d.rows[1]).toMatchObject({
      peakDate: "2024-01-01",
      drawdown: -0.1,
      drawdownPct: -10,
    });
    const s = centralBankDrilldown(
      "fdsp",
      "TREAST",
      fixture({
        TREAST: [{ date: "2024-01-01", value: 400 }],
        WALCL: [{ date: "2024-01-01", value: 1000 }],
      })
    );
    expect(s.rows[0].share).toBe(40);
  });
  it("does not fill unsupported tabs with unrelated fields", () => {
    expect(centralBankDrilldown("cbrt", "DFEDTARU", fixture({})).rows).toEqual(
      []
    );
    expect(
      centralBankDrilldown(
        "fdsp",
        "IORB",
        fixture({ IORB: [{ date: "2024-01-01", value: 5 }] })
      ).rows
    ).toEqual([]);
  });
});

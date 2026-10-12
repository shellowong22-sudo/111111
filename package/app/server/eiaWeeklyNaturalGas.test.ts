import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import { fetchEiaWeeklyNaturalGasStorage } from "./freeMarketData";
import { parseEiaWeeklyNaturalGasWorkbook } from "./eiaWeeklyNaturalGas";

const serial = (date: string) =>
  (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;

function workbook() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["LATEST ESTIMATES (Bcf)"],
    ["Week ending", "Source", "East Region", "Total Lower 48"],
    [serial("2015-01-02"), "Derived EIA Weekly Estimates", 100, 2500],
    [serial("2026-09-18"), "EIA-912", 815, 3351],
    [serial("2026-09-25"), "EIA-912", 840, 3415],
    [serial("2100-01-01"), "EIA-912", 900, 3500],
    [serial("2026-10-02"), "EIA-912", 950, "NA"],
  ]), "html_report_history");
  return XLSX.write(book, { bookType: "xls", type: "array" }) as ArrayBuffer;
}

describe("EIA official weekly natural-gas archive", () => {
  it("uses only actual EIA-912 Lower-48 survey observations", () => {
    expect(parseEiaWeeklyNaturalGasWorkbook(workbook())).toEqual([
      { date: "2026-09-18", value: 3351 },
      { date: "2026-09-25", value: 3415 },
    ]);
  });

  it("falls back to the official workbook after a rate-limited API response", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("ngshistory.xls")
        ? { ok: true, status: 200, arrayBuffer: async () => workbook() } as Response
        : new Response("", { status: 429 })
    );
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const result = await fetchEiaWeeklyNaturalGasStorage(10);
      expect(result).toMatchObject({
        available: true,
        source: "U.S. EIA Weekly Natural Gas",
        observedAt: "2026-09-25",
        realtime: false,
        history: [
          { date: "2026-09-18", value: 3351 },
          { date: "2026-09-25", value: 3415 },
        ],
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import { fetchEiaWeeklyPetroleumSeries } from "./freeMarketData";
import { parseEiaWeeklyPetroleumWorkbook } from "./eiaWeeklyPetroleum";

function workbook(rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Data 1");
  return XLSX.write(book, { bookType: "xls", type: "array" }) as ArrayBuffer;
}

function serial(date: string) {
  return (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

describe("EIA weekly petroleum observations", () => {
  it("retains only dated numeric observations without interpolation or future releases", () => {
    const points = parseEiaWeeklyPetroleumWorkbook(workbook([
      ["Series", "Commercial crude"],
      ["Units", "thousand barrels"],
      ["Date", "Value"],
      [serial("2026-09-18"), 423000],
      [serial("2026-09-25"), 427320],
      [serial("2100-01-01"), 428000],
      [serial("2026-10-02"), "NA"],
      ["not a date", 999999],
    ]));
    expect(points).toEqual([
      { date: "2026-09-18", value: 423000 },
      { date: "2026-09-25", value: 427320 },
    ]);
  });

  it("returns an explicit empty result when the provider fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("", { status: 503 }));
    try {
      const result = await fetchEiaWeeklyPetroleumSeries("WGTSTUS1", 20);
      expect(result).toMatchObject({
        available: false,
        observedAt: null,
        realtime: false,
        delayStatus: "unavailable",
        history: [],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

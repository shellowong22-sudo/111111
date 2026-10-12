import * as XLSX from "xlsx";

export type EiaWeeklyPetroleumPoint = { date: string; value: number };
export type EiaWeeklyPetroleumId = "WCESTUS1" | "WPULEUS3" | "WGTSTUS1" | "WDISTUS1";

const cache = new Map<EiaWeeklyPetroleumId, { until: number; history: EiaWeeklyPetroleumPoint[] }>();
const pending = new Map<EiaWeeklyPetroleumId, Promise<EiaWeeklyPetroleumPoint[]>>();

export function parseEiaWeeklyPetroleumWorkbook(buffer: ArrayBuffer): EiaWeeklyPetroleumPoint[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets["Data 1"];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1, defval: null, raw: true,
  });
  return rows.slice(3).flatMap(row => {
    const serial = Number(row[0]);
    const value = Number(row[1]);
    if (row[0] == null || row[1] == null || !Number.isInteger(serial) ||
      !Number.isFinite(value) || serial < 29_000) return [];
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
    return date <= new Date().toISOString().slice(0, 10) ? [{ date, value }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/** One observed EIA weekly series; no interpolation or synthesized fallback. */
export async function fetchEiaWeeklyPetroleumHistory(id: EiaWeeklyPetroleumId): Promise<EiaWeeklyPetroleumPoint[]> {
  const stored = cache.get(id);
  if (stored && stored.until > Date.now()) return stored.history;
  const active = pending.get(id);
  if (active) return active;
  const request = (async () => {
    const response = await fetch(`https://www.eia.gov/dnav/pet/hist_xls/${id}w.xls`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`EIA_WEEKLY_HTTP_${response.status}`);
    const history = parseEiaWeeklyPetroleumWorkbook(await response.arrayBuffer());
    if (!history.length) throw new Error("EIA_WEEKLY_NO_OBSERVATIONS");
    cache.set(id, { until: Date.now() + 5 * 60_000, history });
    return history;
  })().finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}

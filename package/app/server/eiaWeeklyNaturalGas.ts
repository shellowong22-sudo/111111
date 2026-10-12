import * as XLSX from "xlsx";

export type EiaWeeklyNaturalGasPoint = { date: string; value: number };
const HISTORY_URL = "https://ir.eia.gov/ngs/ngshistory.xls";
let cache: { until: number; history: EiaWeeklyNaturalGasPoint[] } | null = null;
let pending: Promise<EiaWeeklyNaturalGasPoint[]> | null = null;

/** EIA-912 survey observations only. The workbook's pre-2015 derived estimates are excluded. */
export function parseEiaWeeklyNaturalGasWorkbook(buffer: ArrayBuffer): EiaWeeklyNaturalGasPoint[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets.html_report_history;
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1, defval: null, raw: true,
  });
  const headerIndex = rows.findIndex(row =>
    String(row[0]).trim() === "Week ending" &&
    row.includes("Source") &&
    row.includes("Total Lower 48")
  );
  if (headerIndex < 0) return [];
  const sourceIndex = rows[headerIndex].indexOf("Source");
  const totalIndex = rows[headerIndex].indexOf("Total Lower 48");
  const today = new Date().toISOString().slice(0, 10);
  const observations = new Map<string, number>();
  for (const row of rows.slice(headerIndex + 1)) {
    if (String(row[sourceIndex]).trim() !== "EIA-912") continue;
    const serial = Number(row[0]);
    const value = Number(row[totalIndex]);
    if (row[0] == null || row[totalIndex] == null || !Number.isInteger(serial) ||
      serial < 29_000 || !Number.isFinite(value) || value < 0) continue;
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
    if (date <= today) observations.set(date, value);
  }
  return [...observations].map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchEiaWeeklyNaturalGasHistory(): Promise<EiaWeeklyNaturalGasPoint[]> {
  if (cache && cache.until > Date.now()) return cache.history;
  if (pending) return pending;
  const request = (async () => {
    const response = await fetch(HISTORY_URL, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`EIA_NG_WORKBOOK_HTTP_${response.status}`);
    const history = parseEiaWeeklyNaturalGasWorkbook(await response.arrayBuffer());
    if (!history.length) throw new Error("EIA_NG_WORKBOOK_NO_SURVEY_OBSERVATIONS");
    cache = { until: Date.now() + 5 * 60_000, history };
    return history;
  })().finally(() => { pending = null; });
  pending = request;
  return request;
}

export type FredHistoryPoint = { date: string; value: number };

/** FRED observations are dated historical facts, not intraday quotes. */
export function parseFredObservations(csv: string, seriesId: string, asOfDate = new Date().toISOString().slice(0, 10)) {
  const cell = (value: string) => value.trim().replace(/^"(.*)"$/, '$1').trim();
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = (lines.shift() ?? '').split(',').map(cell);
  const dateIndex = header.findIndex((value) => /^(DATE|observation_date)$/i.test(value));
  const valueIndex = header.indexOf(seriesId);
  const quality = { rejectedRows: 0, missingRows: 0, duplicateRows: 0, revisionRows: 0, headerValid: dateIndex >= 0 && valueIndex >= 0 };
  const byDate = new Map<string, FredHistoryPoint>();
  if (!quality.headerValid) return { history: [], quality };

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split(',').map(cell);
    const date = cells[dateIndex] ?? '';
    const raw = cells[valueIndex] ?? '';
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    if (cells.length !== header.length || !parsedDate || !Number.isFinite(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date || date > asOfDate) {
      quality.rejectedRows += 1;
      continue;
    }
    // In particular, Number(' ') is zero; a missing observation must never be
    // converted to a zero price/rate or overwrite a valid same-date record.
    if (!raw || raw === '.' || /^(NA|N\/A|null)$/i.test(raw)) {
      quality.missingRows += 1;
      continue;
    }
    const value = Number(raw);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(value)) {
      quality.rejectedRows += 1;
      continue;
    }
    const previous = byDate.get(date);
    if (previous) {
      if (previous.value === value) quality.duplicateRows += 1;
      else quality.revisionRows += 1;
    }
    // If a response contains a correction, the last valid source record for
    // that date wins. Sort only after dedupe, not by the CSV's incoming order.
    byDate.set(date, { date, value });
  }
  return { history: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)), quality };
}

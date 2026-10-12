export type ObservationPoint = { date: string; value: number; volume: number | null };

/** Reject missing/non-finite values and conflicting duplicate dates instead of inventing points. */
export function normalizeObservationHistory(input: unknown): ObservationPoint[] {
  if (!Array.isArray(input)) return [];
  const points = new Map<string, ObservationPoint>();
  const conflicts = new Set<string>();
  for (const row of input) {
    if (!row || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date) continue;
    if (typeof row.value !== 'number' || !Number.isFinite(row.value)) continue;
    const volume = typeof row.volume === 'number' && Number.isFinite(row.volume) && row.volume >= 0 ? row.volume : null;
    const previous = points.get(row.date);
    if (previous && (previous.value !== row.value || previous.volume !== volume)) conflicts.add(row.date);
    points.set(row.date, { date: row.date, value: row.value, volume });
  }
  return Array.from(points.values()).filter((point) => !conflicts.has(point.date)).sort((a, b) => a.date.localeCompare(b.date));
}

export function observationChanges(points: ObservationPoint[]) {
  return points.map((point, index) => {
    const previous = points[index - 1]?.value;
    const change = previous == null ? null : point.value - previous;
    return { ...point, change, changePct: previous == null || previous === 0 || change == null ? null : change / Math.abs(previous) * 100 };
  });
}

export function observationDistribution(points: ObservationPoint[], requestedBins = 12) {
  if (!points.length) return [];
  const values = points.map((point) => point.value);
  const min = Math.min(...values); const max = Math.max(...values);
  if (min === max) return [{ from: min, to: max, label: min.toFixed(3), count: values.length, share: 100 }];
  const bins = Math.max(1, Math.min(requestedBins, values.length));
  const width = (max - min) / bins;
  const result = Array.from({ length: bins }, (_, index) => ({ from: min + width * index, to: index === bins - 1 ? max : min + width * (index + 1), label: `${(min + width * index).toFixed(2)}–${(min + width * (index + 1)).toFixed(2)}`, count: 0, share: 0 }));
  values.forEach((value) => { result[Math.min(bins - 1, Math.floor((value - min) / width))].count += 1; });
  return result.map((bin) => ({ ...bin, share: bin.count / values.length * 100 }));
}

export function indexedObservationCurve(points: ObservationPoint[]) {
  const base = points[0]?.value;
  if (base == null || base <= 0) return [];
  return points.map((point) => ({ date: point.date, value: point.value / base * 100 }));
}

export function observationWindow(points: ObservationPoint[], days: number | null) {
  if (!days || !points.length) return points;
  const end = Date.parse(points[points.length - 1].date);
  return points.filter((point) => Date.parse(point.date) >= end - days * 86_400_000);
}

export function formatObservation(value: number | null | undefined, precision = 3) {
  return typeof value !== 'number' || !Number.isFinite(value) ? '—' : value.toLocaleString('zh-CN', { maximumFractionDigits: precision });
}

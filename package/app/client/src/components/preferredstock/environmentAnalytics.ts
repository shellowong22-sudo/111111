export type Observation = { date: string; value: number };
export type EnvironmentSeries = {
  id: string;
  label: string;
  group: "rate" | "credit";
  status: string;
  value: number | null;
  observationDate: string | null;
  history: Observation[];
  limitation: string;
};

export function cleanHistory(history: Observation[]) {
  const byDate = new Map<string, number>();
  for (const point of history) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.value))
      byDate.set(point.date, point.value);
  }
  return [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export function windowHistory(history: Observation[], observations: number) {
  return cleanHistory(history).slice(-observations);
}

export function seriesStatistics(history: Observation[]) {
  const points = cleanHistory(history);
  const values = points.map(p => p.value);
  const latest = points.at(-1);
  const previous = points.at(-2);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length
    ? (sorted[Math.floor((sorted.length - 1) / 2)] +
        sorted[Math.floor(sorted.length / 2)]) /
      2
    : null;
  return {
    count: values.length,
    latest: latest?.value ?? null,
    date: latest?.date ?? null,
    changeBps:
      latest && previous ? (latest.value - previous.value) * 100 : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    median,
    percentile:
      latest && values.length > 1
        ? (values.filter(v => v < latest.value).length / values.length) * 100
        : null,
  };
}

/** Absolute changes are in basis points, not percentage returns on a yield. */
export function changeStatistics(history: Observation[]) {
  const points = cleanHistory(history);
  const moves = points
    .slice(1)
    .map((point, index) => (point.value - points[index].value) * 100);
  const mean = moves.length
    ? moves.reduce((sum, value) => sum + value, 0) / moves.length
    : null;
  return {
    count: moves.length,
    up: moves.filter(value => value > 0).length,
    down: moves.filter(value => value < 0).length,
    unchanged: moves.filter(value => value === 0).length,
    maxAbsoluteBps: moves.length ? Math.max(...moves.map(Math.abs)) : null,
    standardDeviationBps:
      moves.length > 1
        ? Math.sqrt(
            moves.reduce((sum, value) => sum + (value - mean!) ** 2, 0) /
              (moves.length - 1)
          )
        : null,
  };
}

export function distribution(history: Observation[], bins = 8) {
  const values = cleanHistory(history).map(p => p.value);
  if (!values.length) return [];
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (low === high) return [{ label: low.toFixed(3), count: values.length }];
  const size = (high - low) / bins;
  const result = Array.from({ length: bins }, (_, index) => ({
    label: `${(low + index * size).toFixed(3)}–${(low + (index + 1) * size).toFixed(3)}`,
    count: 0,
  }));
  values.forEach(value => {
    result[Math.min(bins - 1, Math.floor((value - low) / size))].count += 1;
  });
  return result;
}

// Compare all tenors on the same observation dates, never mix stale tenor endpoints.
export function commonCurve(series: EnvironmentSeries[], comparisonLag = 20) {
  const rates = series.filter(
    s => s.group === "rate" && s.status === "available"
  );
  if (!rates.length) return { date: null, comparisonDate: null, rows: [] };
  const maps = rates.map(
    s => new Map(cleanHistory(s.history).map(p => [p.date, p.value]))
  );
  const commonDates = [...maps[0].keys()]
    .filter(date => maps.every(map => map.has(date)))
    .sort();
  const date = commonDates.at(-1) ?? null;
  const comparisonDate =
    commonDates.length > comparisonLag
      ? commonDates.at(-1 - comparisonLag)!
      : null;
  const rows = date
    ? rates
        .map((series, index) => ({
          tenor: Number(series.id.replace("DGS", "")),
          id: series.id,
          current: maps[index].get(date)!,
          previous: comparisonDate ? maps[index].get(comparisonDate)! : null,
        }))
        .sort((a, b) => a.tenor - b.tenor)
    : [];
  return { date, comparisonDate, rows };
}

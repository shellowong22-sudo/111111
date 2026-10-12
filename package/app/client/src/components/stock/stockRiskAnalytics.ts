import { normalizeObservationHistory } from "./stockObservationModel";

export function priceRiskPath(history: unknown) {
  const rows = normalizeObservationHistory(history).filter(
    row => row.value > 0
  );
  let peak: number | null = null;
  const first = rows[0]?.value;
  return rows.map((row, index) => {
    peak = peak == null ? row.value : Math.max(peak, row.value);
    const previous = rows[index - 1];
    return {
      ...row,
      cumulativeReturn: first ? (row.value / first - 1) * 100 : null,
      drawdown: peak ? (row.value / peak - 1) * 100 : null,
      returnPct: previous ? (row.value / previous.value - 1) * 100 : null,
    };
  });
}

export function priceRiskSummary(history: unknown) {
  const path = priceRiskPath(history);
  if (!path.length)
    return {
      path,
      sampleCount: 0,
      start: null,
      end: null,
      cumulativeReturn: null,
      maxDrawdown: null,
      monthly: [],
    };
  const monthly = Array.from(
    new Set(path.map(row => row.date.slice(0, 7)))
  ).map(month => {
    const rows = path.filter(row => row.date.startsWith(month));
    const firstIndex = path.findIndex(row => row.date === rows[0].date);
    const base = firstIndex > 0 ? path[firstIndex - 1] : rows[0];
    const last = rows.at(-1)!;
    return {
      month,
      start: base.date,
      end: last.date,
      base: base.value,
      close: last.value,
      count: rows.length,
      priceReturn: (last.value / base.value - 1) * 100,
      partialStart: firstIndex === 0,
    };
  });
  return {
    path,
    sampleCount: path.length,
    start: path[0].date,
    end: path.at(-1)!.date,
    cumulativeReturn: path.at(-1)!.cumulativeReturn,
    maxDrawdown: Math.min(...path.map(row => row.drawdown ?? 0)),
    monthly,
  };
}

export function alignedPricePaths(left: unknown, right: unknown) {
  const lhs = normalizeObservationHistory(left).filter(row => row.value > 0);
  const rhs = new Map(
    normalizeObservationHistory(right)
      .filter(row => row.value > 0)
      .map(row => [row.date, row])
  );
  const common = lhs.flatMap(row =>
    rhs.has(row.date)
      ? [{ date: row.date, left: row.value, right: rhs.get(row.date)!.value }]
      : []
  );
  return common.map(row => ({
    ...row,
    leftIndex: (row.left / common[0].left) * 100,
    rightIndex: (row.right / common[0].right) * 100,
    relativeReturn:
      (row.left / common[0].left / (row.right / common[0].right) - 1) * 100,
  }));
}

/** Correlate changes only across identical adjacent observation dates, never
 * forward-fill gaps or correlate non-stationary raw levels. */
export function changeCorrelation(left: unknown, right: unknown) {
  const changes = (input: unknown) => {
    const rows = normalizeObservationHistory(input);
    return rows
      .slice(1)
      .map((row, index) => ({
        key: `${rows[index].date}/${row.date}`,
        value: row.value - rows[index].value,
      }));
  };
  const rhs = new Map(changes(right).map(row => [row.key, row.value]));
  const pairs = changes(left).flatMap(row =>
    rhs.has(row.key)
      ? [{ x: row.value, y: rhs.get(row.key)!, period: row.key }]
      : []
  );
  if (pairs.length < 3)
    return { correlation: null, count: pairs.length, pairs };
  const mx = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
  const my = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;
  const covariance = pairs.reduce(
    (sum, pair) => sum + (pair.x - mx) * (pair.y - my),
    0
  );
  const denominator = Math.sqrt(
    pairs.reduce((sum, pair) => sum + (pair.x - mx) ** 2, 0) *
      pairs.reduce((sum, pair) => sum + (pair.y - my) ** 2, 0)
  );
  return {
    correlation: denominator
      ? Math.max(-1, Math.min(1, covariance / denominator))
      : null,
    count: pairs.length,
    pairs,
  };
}

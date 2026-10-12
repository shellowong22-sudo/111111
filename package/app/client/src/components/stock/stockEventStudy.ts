/** Descriptive event windows, not causal impact estimates or a trading strategy. */
export type EventFiling = { accessionNumber: string | null; filingDate: string | null; form: string };
export type EventPrice = { date: string; value: number };
const day = 86_400_000;

export function validEventDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function eventStudy(filings: EventFiling[], input: EventPrice[], form: string, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const prices = new Map<string, number>();
  const conflicts = new Set<string>();
  for (const point of input) {
    if (!validEventDate(point.date) || point.date > today || !Number.isFinite(point.value) || point.value <= 0) continue;
    if (prices.has(point.date) && prices.get(point.date) !== point.value) conflicts.add(point.date);
    prices.set(point.date, point.value);
  }
  const history = [...prices].filter(([date]) => !conflicts.has(date)).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  const ids = new Map<string, EventFiling>();
  const conflictingIds = new Set<string>();
  for (const filing of filings) {
    if (!filing.accessionNumber || !validEventDate(filing.filingDate) || filing.filingDate > today) continue;
    const previous = ids.get(filing.accessionNumber);
    if (previous && (previous.form !== filing.form || previous.filingDate !== filing.filingDate)) conflictingIds.add(filing.accessionNumber);
    ids.set(filing.accessionNumber, filing);
  }
  const events = [...ids.values()].filter(f => !conflictingIds.has(f.accessionNumber!) && (form === 'all' || f.form === form)).sort((a, b) => b.filingDate!.localeCompare(a.filingDate!) || a.accessionNumber!.localeCompare(b.accessionNumber!));
  const rows = events.map(filing => {
    // SEC filing dates have no reliable release time here: never assume a same-day fill.
    const startIndex = history.findIndex(p => p.date > filing.filingDate!);
    const base = history[startIndex];
    const delay = base ? (Date.parse(base.date) - Date.parse(filing.filingDate!)) / day : Infinity;
    const eligible = Boolean(base && delay <= 7 && startIndex > 0 && history[startIndex - 1].date <= filing.filingDate!);
    const path = eligible ? history.slice(Math.max(0, startIndex - 5), startIndex + 21).map((point, index) => ({ ...point, offset: Math.max(0, startIndex - 5) + index - startIndex, returnPct: (point.value / base.value - 1) * 100 })) : [];
    const horizon = (n: number) => {
      const end = history[startIndex + n];
      const interval = history.slice(startIndex, startIndex + n + 1);
      if (!eligible || !end || interval.some((p, i) => i > 0 && Date.parse(p.date) - Date.parse(interval[i - 1].date) > 7 * day)) return null;
      return { end: end.date, value: (end.value / base.value - 1) * 100 };
    };
    return { ...filing, baseDate: eligible ? base.date : null, basePrice: eligible ? base.value : null, path, one: horizon(1), five: horizon(5), twenty: horizon(20), unavailable: eligible ? null : '事件附近历史不足或数据缺口' };
  });
  // Multiple filings on one day share one market move: do not inflate the sample.
  const distribution = rows.filter((row, index) => row.baseDate && rows.findIndex(other => other.baseDate === row.baseDate) === index);
  const summarize = (key: 'one' | 'five' | 'twenty') => {
    const values = distribution.flatMap(row => row[key] ? [row[key]!.value] : []).sort((a, b) => a - b);
    const n = values.length;
    return { horizon: key, count: n, mean: n ? values.reduce((a, b) => a + b, 0) / n : null, median: n ? (values[Math.floor((n - 1) / 2)] + values[Math.ceil((n - 1) / 2)]) / 2 : null, min: n ? values[0] : null, max: n ? values[n - 1] : null, positiveShare: n ? values.filter(v => v > 0).length / n * 100 : null };
  };
  return { history, rows, distribution, summaries: [summarize('one'), summarize('five'), summarize('twenty')], conflicts: conflicts.size + conflictingIds.size };
}

export function expectationDifference(expected: string, actual: string, unit: string, source: string) {
  const number = (value: string) => value.trim() && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
  const forecast = number(expected), observed = number(actual);
  if (forecast === null || observed === null || !unit.trim() || !source.trim()) return null;
  const difference = observed - forecast;
  return { forecast, actual: observed, difference, relativePct: forecast !== 0 ? difference / Math.abs(forecast) * 100 : null, unit: unit.trim(), source: source.trim() };
}

export function eventCsv(rows: (string | number | null)[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    const text = String(value ?? '');
    const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}

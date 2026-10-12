export type StatisticObservation = { date: string; payload: unknown };
export type StatisticMode = 'rate' | 'quarterly-rate' | 'yoy' | 'payroll-change';

export function annualizeQuarterlyRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= -100) return null;
  return (Math.pow(1 + rate / 100, 4) - 1) * 100;
}

export function deannualizeQuarterlyRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= -100) return null;
  return (Math.pow(1 + rate / 100, 1 / 4) - 1) * 100;
}

export function summarizeAnnualizedQuarterlyGrowth(history: Array<{ date: string; value: number | null }>) {
  const points = history
    .filter((point): point is { date: string; value: number } => /^\d{4}-Q[1-4]$/.test(point.date) && typeof point.value === 'number' && Number.isFinite(point.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  const quarterIndex = (date: string) => Number(date.slice(0, 4)) * 4 + Number(date.at(-1)) - 1;
  const latest = points.at(-1) ?? null;
  const previous = points.at(-2) ?? null;
  const recent = points.slice(-4);
  const contiguous = recent.length === 4 && recent.every((point, index) => index === 0 || quarterIndex(point.date) === quarterIndex(recent[index - 1].date) + 1);
  const deannualized = contiguous ? recent.map(point => deannualizeQuarterlyRate(point.value)) : [];
  return {
    latest,
    previous,
    momentumPp: latest && previous && quarterIndex(latest.date) === quarterIndex(previous.date) + 1 ? latest.value - previous.value : null,
    latestQuarterlyEquivalent: latest ? deannualizeQuarterlyRate(latest.value) : null,
    trailing4ActualGrowth: deannualized.length === 4 && deannualized.every((value): value is number => value !== null)
      ? (deannualized.reduce((product, value) => product * (1 + value / 100), 1) - 1) * 100
      : null,
    positiveQuarters: contiguous ? recent.filter(point => point.value > 0).length : null,
  };
}

export function summarizeQuarterlyGrowth(history: Array<{ date: string; value: number | null }>) {
  const points = history
    .filter((point): point is { date: string; value: number } => /^\d{4}-Q[1-4]$/.test(point.date) && typeof point.value === 'number' && Number.isFinite(point.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  const latest = points.at(-1) ?? null;
  const previous = points.at(-2) ?? null;
  const quarterIndex = (date: string) => {
    const match = date.match(/^(\d{4})-Q([1-4])$/);
    return match ? Number(match[1]) * 4 + Number(match[2]) - 1 : null;
  };
  const momentumPp = latest && previous && quarterIndex(latest.date) === (quarterIndex(previous.date) ?? -2) + 1
    ? latest.value - previous.value
    : null;
  const recent = points.slice(-4);
  const contiguous = recent.length === 4 && recent.every((point, index) => index === 0 || quarterIndex(point.date) === (quarterIndex(recent[index - 1].date) ?? -2) + 1);
  if (!contiguous) return { latest, previous, momentumPp, trailing4Compound: null, positiveQuarters: null, negativeQuarters: null, unchangedQuarters: null, rangeLow: null, rangeHigh: null };
  const values = recent.map(point => point.value);
  return {
    latest,
    previous,
    momentumPp,
    trailing4Compound: (values.reduce((product, value) => product * (1 + value / 100), 1) - 1) * 100,
    positiveQuarters: values.filter(value => value > 0).length,
    negativeQuarters: values.filter(value => value < 0).length,
    unchangedQuarters: values.filter(value => value === 0).length,
    rangeLow: Math.min(...values),
    rangeHigh: Math.max(...values),
  };
}

export function summarizeMonthlyRate(history: Array<{ date: string; value: number | null }>) {
  const points = history
    .filter((point): point is { date: string; value: number } => /^\d{4}-(0[1-9]|1[0-2])$/.test(point.date) && typeof point.value === 'number' && Number.isFinite(point.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  const monthIndex = (date: string) => {
    const [year, month] = date.split('-').map(Number);
    return year * 12 + month - 1;
  };
  const contiguousTail = (length: number) => {
    const tail = points.slice(-length);
    return tail.length === length && tail.every((point, index) => index === 0 || monthIndex(point.date) === monthIndex(tail[index - 1].date) + 1) ? tail : [];
  };
  const latest = points.at(-1) ?? null;
  const prior12 = latest ? points.find(point => monthIndex(point.date) === monthIndex(latest.date) - 12) ?? null : null;
  const recent3 = contiguousTail(3);
  const recent12 = contiguousTail(12);
  return {
    latest,
    average3m: recent3.length ? recent3.reduce((sum, point) => sum + point.value, 0) / recent3.length : null,
    change12mPp: latest && prior12 ? latest.value - prior12.value : null,
    range12mLow: recent12.length ? Math.min(...recent12.map(point => point.value)) : null,
    range12mHigh: recent12.length ? Math.max(...recent12.map(point => point.value)) : null,
  };
}

export function projectStatisticHistory(observations: StatisticObservation[], mode: StatisticMode) {
  const levels = new Map<string, number>();
  for (const row of observations) {
    const value = row.payload && typeof row.payload === 'object' ? (row.payload as { value?: unknown }).value : null;
    const rawDate = String(row.date);
    const monthPeriod = rawDate.slice(0, 7);
    const monthMatch = monthPeriod.match(/^(\d{4})-(01|04|07|10)$/);
    const period = /^\d{4}-Q[1-4]$/.test(rawDate)
      ? rawDate
      : mode === 'quarterly-rate' && monthMatch
        ? `${monthMatch[1]}-Q${Math.floor((Number(monthMatch[2]) - 1) / 3) + 1}`
        : monthPeriod;
    const validPeriod = mode === 'quarterly-rate' ? /^\d{4}-Q[1-4]$/.test(period) : /^\d{4}-(0[1-9]|1[0-2])$/.test(period) || (mode === 'rate' && /^\d{4}-Q[1-4]$/.test(period));
    if (validPeriod && typeof value === 'number' && Number.isFinite(value)) levels.set(period, value);
  }
  return [...levels].sort(([a], [b]) => a.localeCompare(b)).map(([date, level]) => {
    if (mode === 'rate' || mode === 'quarterly-rate') return { date, value: level, level, base: null as number | null };
    const [year, month] = date.split('-').map(Number);
    const offset = mode === 'yoy' ? 12 : 1;
    const priorIndex = year * 12 + month - 1 - offset;
    const prior = `${Math.floor(priorIndex / 12)}-${String(priorIndex % 12 + 1).padStart(2, '0')}`;
    const base = levels.get(prior);
    // Missing calendar periods cannot be replaced by a neighbouring row.
    const value = base === undefined || (mode === 'yoy' && base <= 0) ? null
      : mode === 'yoy' ? (level / base - 1) * 100 : (level - base) / 10;
    return { date, value, level, base: base ?? null };
  });
}

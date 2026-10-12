import { readDatasetNumber, readDatasetText } from './openbbDataset';

type ArchiveDataset = {
  dataset: {
    label: string;
    rows: Array<Record<string, string | number | boolean | null>>;
  };
};

export type PlnReferencePair = {
  pair: string;
  date: string;
  value: number;
  unit: string;
  history: Array<{ date: string; value: number }>;
};

const PLN_REFERENCE_LABELS = new Set([
  '美元兑兹罗提日频参考汇率',
  '多币种兑兹罗提日频参考汇率',
]);

/** One canonical archive, two existing FXC presentations; never copy rows. */
export function parsePlnReferenceDatasets(datasets: ArchiveDataset[]): PlnReferencePair[] {
  const pairs = new Map<string, Map<string, { date: string; value: number; unit: string }>>();
  for (const item of datasets) {
    if (!PLN_REFERENCE_LABELS.has(item.dataset.label)) continue;
    for (const row of item.dataset.rows) {
      const pair = readDatasetText(row, ['symbol', '标的'], '');
      const date = readDatasetText(row, ['date', '观察期'], '');
      const value = readDatasetNumber(row, ['value', '中间参考汇率']);
      const unit = readDatasetText(row, ['单位'], '');
      if (!/^[A-Z]{3}\/PLN$/.test(pair) || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || value === null || value <= 0 || unit !== `PLN/${pair.slice(0, 3)}`) continue;
      const byDate = pairs.get(pair) ?? new Map();
      byDate.set(date, { date, value, unit });
      pairs.set(pair, byDate);
    }
  }
  return [...pairs.entries()].map(([pair, byDate]) => {
    const history = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const latest = history.at(-1)!;
    return { pair, date: latest.date, value: latest.value, unit: latest.unit,
      history: history.map(({ date, value }) => ({ date, value })) };
  }).sort((a, b) => a.pair === 'USD/PLN' ? -1 : b.pair === 'USD/PLN' ? 1 : a.pair.localeCompare(b.pair));
}

/** A derived reference cross is valid only when both legs share a publication date. */
export function derivePlnCrossRate(pairs: PlnReferencePair[], base: string, quote: string): number | null {
  if (base === quote) return 1;
  const baseObservation = base === 'PLN' ? null : pairs.find(row => row.pair === `${base}/PLN`);
  const quoteObservation = quote === 'PLN' ? null : pairs.find(row => row.pair === `${quote}/PLN`);
  if ((base !== 'PLN' && !baseObservation) || (quote !== 'PLN' && !quoteObservation)) return null;
  if (baseObservation && quoteObservation && baseObservation.date !== quoteObservation.date) return null;
  const result = (baseObservation?.value ?? 1) / (quoteObservation?.value ?? 1);
  return Number.isFinite(result) && result > 0 ? result : null;
}

/** The original FXC detail can plot only observations whose two legs share a date. */
export function derivePlnCrossHistory(pairs: PlnReferencePair[], base: string, quote: string): Array<{ date: string; value: number }> {
  if (base === quote) return [];
  const baseObservation = base === 'PLN' ? null : pairs.find(row => row.pair === `${base}/PLN`);
  const quoteObservation = quote === 'PLN' ? null : pairs.find(row => row.pair === `${quote}/PLN`);
  if ((base !== 'PLN' && !baseObservation) || (quote !== 'PLN' && !quoteObservation)) return [];
  const quoteByDate = new Map(quoteObservation?.history.map(row => [row.date, row.value]) ?? []);
  const dates = baseObservation?.history ?? quoteObservation?.history ?? [];
  return dates.flatMap(({ date, value }) => {
    const baseValue = baseObservation ? value : 1;
    const quoteValue = quoteObservation ? (baseObservation ? quoteByDate.get(date) : value) : 1;
    const cross = quoteValue ? baseValue / quoteValue : null;
    return cross && Number.isFinite(cross) && cross > 0 ? [{ date, value: cross }] : [];
  });
}

import { readDatasetNumber, readDatasetText } from "./openbbDataset";

type ArchiveDataset = {
  dataset: {
    label: string;
    rows: Array<Record<string, string | number | boolean | null>>;
  };
};

export type BoiReferencePair = {
  pair: string;
  date: string;
  value: number;
  unit: string;
  history: Array<{ date: string; value: number }>;
};

export function parseBoiReferenceDatasets(datasets: ArchiveDataset[]): BoiReferencePair[] {
  const pairs = new Map<string, Map<string, { date: string; value: number; unit: string }>>();
  for (const item of datasets) {
    if (item.dataset.label !== "以色列银行多币种参考汇率") continue;
    for (const row of item.dataset.rows) {
      const pair = readDatasetText(row, ["symbol", "标的"], "");
      const date = readDatasetText(row, ["date", "观察期"], "");
      const value = readDatasetNumber(row, ["value", "中间参考汇率"]);
      const unit = readDatasetText(row, ["单位"], "");
      if (!/^[A-Z]{3}\/ILS$/.test(pair) || !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || value === null || value <= 0 || unit !== `ILS/${pair.slice(0, 3)}`) continue;
      const byDate = pairs.get(pair) ?? new Map();
      byDate.set(date, { date, value, unit });
      pairs.set(pair, byDate);
    }
  }
  return [...pairs.entries()].map(([pair, byDate]) => {
    const history = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const latest = history.at(-1)!;
    return {
      pair,
      date: latest.date,
      value: latest.value,
      unit: latest.unit,
      history: history.map(({ date, value }) => ({ date, value })),
    };
  }).sort((a, b) => a.pair.localeCompare(b.pair));
}

export function deriveBoiCrossRate(
  pairs: BoiReferencePair[],
  base: string,
  quote: string,
): number | null {
  if (base === quote) return 1;
  const baseObservation = base === "ILS" ? null : pairs.find(row => row.pair === `${base}/ILS`);
  const quoteObservation = quote === "ILS" ? null : pairs.find(row => row.pair === `${quote}/ILS`);
  if ((base !== "ILS" && !baseObservation) || (quote !== "ILS" && !quoteObservation)) return null;
  if (baseObservation && quoteObservation && baseObservation.date !== quoteObservation.date) return null;
  const result = (baseObservation?.value ?? 1) / (quoteObservation?.value ?? 1);
  return Number.isFinite(result) && result > 0 ? result : null;
}

export function deriveBoiCrossHistory(
  pairs: BoiReferencePair[],
  base: string,
  quote: string,
): Array<{ date: string; value: number }> {
  if (base === quote) return [];
  const baseObservation = base === "ILS" ? null : pairs.find(row => row.pair === `${base}/ILS`);
  const quoteObservation = quote === "ILS" ? null : pairs.find(row => row.pair === `${quote}/ILS`);
  if ((base !== "ILS" && !baseObservation) || (quote !== "ILS" && !quoteObservation)) return [];
  const quoteByDate = new Map(quoteObservation?.history.map(row => [row.date, row.value]) ?? []);
  const dates = baseObservation?.history ?? quoteObservation?.history ?? [];
  return dates.flatMap(({ date, value }) => {
    const baseValue = baseObservation ? value : 1;
    const quoteValue = quoteObservation ? (baseObservation ? quoteByDate.get(date) : value) : 1;
    const cross = quoteValue ? baseValue / quoteValue : null;
    return cross && Number.isFinite(cross) && cross > 0 ? [{ date, value: cross }] : [];
  });
}

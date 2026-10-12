import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';

export type OpenBBTreasuryPoint = {
  tenor: number;
  label: string;
  field: string;
  ratePct: number;
};

export type OpenBBTreasuryHistoryPoint = {
  date: string;
  rate: number;
};

export type OpenBBTreasuryObservation = {
  provider: string;
  observedAt: string | null;
  queriedAt: string | null;
  timezone: string;
  quality: string;
  realtimeStatus: string;
  checksum: string;
  sourceRowCount: number;
  displayedRowCount: number;
  points: OpenBBTreasuryPoint[];
  history10Y: OpenBBTreasuryHistoryPoint[];
};

const TREASURY_TENORS = [
  { tenor: 0.25, label: '3M', fields: ['month_3', 'month_3_yield'] },
  { tenor: 0.5, label: '6M', fields: ['month_6', 'month_6_yield'] },
  { tenor: 1, label: '1Y', fields: ['year_1', 'year_1_yield'] },
  { tenor: 2, label: '2Y', fields: ['year_2', 'year_2_yield'] },
  { tenor: 3, label: '3Y', fields: ['year_3', 'year_3_yield'] },
  { tenor: 5, label: '5Y', fields: ['year_5', 'year_5_yield'] },
  { tenor: 7, label: '7Y', fields: ['year_7', 'year_7_yield'] },
  { tenor: 10, label: '10Y', fields: ['year_10', 'year_10_yield'] },
  { tenor: 20, label: '20Y', fields: ['year_20', 'year_20_yield'] },
  { tenor: 30, label: '30Y', fields: ['year_30', 'year_30_yield'] },
] as const;

function finiteNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerYieldToPct(value: unknown, provider: string) {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  // OpenBB's federal_reserve provider returns decimal yields (0.0408 = 4.08%).
  // Other providers are not silently rescaled because their unit contract may differ.
  return provider.toLowerCase() === 'federal_reserve' && Math.abs(parsed) <= 1
    ? parsed * 100
    : parsed;
}

function rowDate(row: Record<string, string | number | boolean | null>) {
  for (const key of ['date', 'observation_date', 'period', 'timestamp']) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function dateOrder(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function findField(row: Record<string, string | number | boolean | null>, candidates: readonly string[]) {
  return candidates.find((field) => providerYieldToPct(row[field], 'federal_reserve') !== null) ?? null;
}

export function extractOpenBBTreasuryObservation(items: ModuleLiveFeedItem[]): OpenBBTreasuryObservation | null {
  const item = items.find((candidate) => {
    const dataset = candidate.dataset;
    if (!dataset || dataset.metadata.provider.toLowerCase() !== 'federal_reserve') return false;
    return dataset.columns.some((column) => /^year_(?:2|10)(?:_yield)?$/i.test(column));
  });
  const dataset = item?.dataset;
  if (!dataset?.rows.length) return null;

  const datedRows = dataset.rows
    .map((row) => ({ row, date: rowDate(row) }))
    .sort((left, right) => dateOrder(left.date) - dateOrder(right.date));
  const latest = datedRows.at(-1)?.row;
  if (!latest) return null;

  const points = TREASURY_TENORS.flatMap(({ tenor, label, fields }) => {
    const field = findField(latest, fields);
    if (!field) return [];
    const ratePct = providerYieldToPct(latest[field], dataset.metadata.provider);
    return ratePct === null ? [] : [{ tenor, label, field, ratePct }];
  });
  if (!points.length) return null;

  const tenYearField = findField(latest, ['year_10', 'year_10_yield']);
  const history10Y = tenYearField
    ? datedRows.flatMap(({ row, date }) => {
      const rate = providerYieldToPct(row[tenYearField], dataset.metadata.provider);
      return date && rate !== null ? [{ date, rate }] : [];
    }).slice(-200)
    : [];

  return {
    provider: dataset.metadata.provider,
    // Prefer the latest transmitted row. Some providers report the first row
    // in metadata.observedAt even when the payload contains newer dates.
    observedAt: datedRows.at(-1)?.date ?? dataset.metadata.observedAt ?? null,
    queriedAt: dataset.metadata.queriedAt,
    timezone: dataset.metadata.timezone,
    quality: dataset.metadata.quality,
    realtimeStatus: dataset.metadata.realtimeStatus,
    checksum: dataset.metadata.checksum,
    sourceRowCount: dataset.metadata.rowCount,
    displayedRowCount: dataset.metadata.displayedRowCount,
    points,
    history10Y,
  };
}

export function observedRateForTenor(observation: OpenBBTreasuryObservation | null, tenor: number) {
  return observation?.points.find((point) => point.tenor === tenor)?.ratePct ?? null;
}

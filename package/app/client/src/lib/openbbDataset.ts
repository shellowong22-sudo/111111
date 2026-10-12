import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';

export type OpenBBDatasetRow = {
  key: string;
  datasetLabel: string;
  provider: string;
  observedAt: string | null;
  realtimeStatus: string;
  quality: string;
  values: Record<string, string | number | boolean | null>;
};

function normalizedKey(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu, '');
}

export function collectOpenBBDatasetRows(items: ModuleLiveFeedItem[]) {
  const rows: OpenBBDatasetRow[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.dataset) continue;
    // Reference histories are displayed in the existing delivery table; they
    // cannot be mapped into quote, yield-curve or trading fields by aliases.
    if (item.dataset.metadata.schemaVersion === 'public-reference-history-v1') continue;
    item.dataset.rows.forEach((values, index) => {
      const signature = `${item.dataset?.metadata.checksum ?? item.itemKey}:${JSON.stringify(values)}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      rows.push({
        key: `${item.itemKey}:${index}`,
        datasetLabel: item.dataset!.label,
        provider: item.dataset!.metadata.provider,
        observedAt: item.dataset!.metadata.observedAt,
        realtimeStatus: item.dataset!.metadata.realtimeStatus,
        quality: item.dataset!.metadata.quality,
        values,
      });
    });
  }
  return rows;
}

export function readDatasetValue(
  row: Record<string, string | number | boolean | null>,
  aliases: string[],
) {
  const normalizedAliases = aliases.map(normalizedKey);
  for (const [key, value] of Object.entries(row)) {
    const candidate = normalizedKey(key);
    if (normalizedAliases.includes(candidate) && value !== '' && value !== null) return value;
  }
  return null;
}

export function readDatasetText(
  row: Record<string, string | number | boolean | null>,
  aliases: string[],
  fallback = '未提供',
) {
  const value = readDatasetValue(row, aliases);
  return value === null ? fallback : String(value);
}

export function readDatasetNumber(
  row: Record<string, string | number | boolean | null>,
  aliases: string[],
) {
  const value = readDatasetValue(row, aliases);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.replaceAll(',', '').replace(/[%$€£¥]/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDatasetNumber(value: number | null, digits = 2) {
  if (value === null) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

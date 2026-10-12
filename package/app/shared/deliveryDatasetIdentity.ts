/** Compare delivered observations, never their presentation title or query time. */
export function deliveryDatasetIdentity(dataset: unknown): string | null {
  if (!dataset || typeof dataset !== 'object') return null;
  const value = dataset as Record<string, any>;
  if (typeof value.metadata?.observationIdentity === 'string' && /^[a-f0-9]{64}$/.test(value.metadata.observationIdentity)) return `observations:${value.metadata.observationIdentity}`;
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows) || !value.rows.length) return null;
  const columns = [...new Set(value.columns.filter((column: unknown): column is string => typeof column === 'string'))].sort();
  if (!columns.length) return null;
  const rows = value.rows.map((row: Record<string, unknown>) => JSON.stringify(columns.map(column => row?.[column] ?? null))).sort();
  return JSON.stringify([value.metadata?.provider ?? '', value.metadata?.unit ?? '', value.metadata?.currency ?? '', columns, rows]);
}

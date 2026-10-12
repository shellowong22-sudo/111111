import { ECONOMIC_API_CONTRACTS } from './economicApiContracts';
import type { EconomicSnapshot } from './economicObservations';
type Delivery = { itemKey: string; dataset?: { rows: Array<Record<string, unknown>>; metadata: { provider: string; queriedAt?: string | null } } };
export const ECSU_ACTIVE_INPUTS = [[], ['TCU','MCUMFN'], ['GSCPI'], ['ISRATIO','BUSINV'], ['JTSJOL','UNRATE','UNEMPLOY'], ['OPHNFB','OUTNFB','HOANBS']] as const;

export function ecsuDeliveryOwner(item: Delivery) {
  const ds = item.dataset;
  if (!ds?.rows.length || !Number.isFinite(Date.parse(ds.metadata.queriedAt ?? ''))) return null;
  const contract = ECONOMIC_API_CONTRACTS.find(c => c.seriesId === ds.rows[0].series && c.primaryModuleId === 'economic-ecsu');
  if (!contract || contract.provider !== ds.metadata.provider) return null;
  const seen = new Set<string>();
  for (const row of ds.rows) {
    if (row.series !== contract.seriesId || row.unit !== contract.unit || typeof row.value !== 'number' || !Number.isFinite(row.value)) return null;
    const date = String(row.date), stamp = Date.parse(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0,10) !== date || seen.has(date)) return null;
    seen.add(date);
  }
  return 'economic-ecsu';
}

/** Merge by series + observation date in the original view; never render a second delivery table. */
export function mergeEcsuDelivery(snapshot: EconomicSnapshot | undefined, items: Delivery[], active: number) {
  if (!snapshot) return { data: snapshot, applied: [] as string[] };
  const owned = items.filter(item => ecsuDeliveryOwner(item));
  const accepted = new Set<Delivery>();
  const series = snapshot.series.map(original => {
    let result = original;
    for (const item of [...owned].sort((a,b) => Date.parse(a.dataset!.metadata.queriedAt!) - Date.parse(b.dataset!.metadata.queriedAt!))) {
      const ds = item.dataset!;
      if (ds.rows[0].series !== result.id || (result.status === 'available' && Date.parse(ds.metadata.queriedAt!) < Date.parse(result.retrievedAt))) continue;
      const values = new Map(result.history.map(p => [p.date, p.value]));
      ds.rows.forEach(row => values.set(String(row.date), Number(row.value)));
      accepted.add(item);
      // Partial transport snapshots do not prove withdrawals. Keep undistributed
      // history, and do not carry an upstream checksum over a merged series.
      result = { ...result, status: 'available', error: null, retrievedAt: ds.metadata.queriedAt!, checksum: undefined, changes: undefined, updateState: undefined, history: [...values].sort(([a],[b]) => a.localeCompare(b)).map(([date,value])=>({date,value})) };
    }
    return result;
  });
  const relevant: readonly string[] = ECSU_ACTIVE_INPUTS[active] ?? [];
  const applied = [...new Set(owned.filter(item => accepted.has(item) && item.dataset!.rows.every(row => relevant.includes(String(row.series)) && series.some(s => s.id === row.series && s.unit === row.unit && s.history.some(p => p.date === row.date && p.value === row.value)))).map(item => item.itemKey))];
  return { data: { ...snapshot, series }, applied };
}

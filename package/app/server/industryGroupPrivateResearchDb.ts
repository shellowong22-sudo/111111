import { and, desc, eq, inArray } from 'drizzle-orm';
import { industryGroupPrivateBatches, industryGroupPrivateObservations } from '../drizzle/schema';
import { getDb } from './db';

export type ImportedIndustryObservation = {
  recordId: string; industryGroup: string; metric: string; value: number; unit: string; observedAt: Date;
  issuerName?: string | null; ticker?: string | null; currency?: string | null; sourceReference?: string | null;
};

type StoredIndustryObservation = ImportedIndustryObservation;
const numeric = (value: unknown) => Number(value);
const keyText = (value: string | null | undefined) => value?.trim() || '—';
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const center = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[center]! : (sorted[center - 1]! + sorted[center]!) / 2; };

export function analyzePrivateIndustryObservations(input: StoredIndustryObservation[]) {
  const latestByEntity = new Map<string, StoredIndustryObservation>();
  for (const observation of input) {
    const entity = observation.ticker?.trim() || observation.issuerName?.trim() || observation.recordId;
    const key = [observation.industryGroup, observation.metric, observation.unit, keyText(observation.currency), entity].join('\u0000');
    const current = latestByEntity.get(key);
    if (!current || observation.observedAt > current.observedAt || (observation.observedAt.getTime() === current.observedAt.getTime() && observation.recordId > current.recordId)) latestByEntity.set(key, observation);
  }
  const latest = [...latestByEntity.values()];
  const aggregate = new Map<string, StoredIndustryObservation[]>();
  latest.forEach((observation) => {
    const key = [observation.industryGroup, observation.metric, observation.unit, keyText(observation.currency)].join('\u0000');
    aggregate.set(key, [...(aggregate.get(key) ?? []), observation]);
  });
  const summaries = [...aggregate.entries()].map(([key, observations]) => {
    const [industryGroup, metric, unit, currency] = key.split('\u0000'); const values = observations.map((entry) => entry.value); const latestObservedAt = observations.reduce((current, entry) => entry.observedAt > current ? entry.observedAt : current, observations[0]!.observedAt);
    return { industryGroup, metric, unit, currency: currency === '—' ? null : currency, coverage: values.length, average: values.reduce((sum, value) => sum + value, 0) / values.length, median: median(values), minimum: Math.min(...values), maximum: Math.max(...values), latestObservedAt, sourceReferenceCoverage: observations.filter((entry) => Boolean(entry.sourceReference?.trim())).length };
  }).sort((left, right) => left.metric.localeCompare(right.metric) || left.unit.localeCompare(right.unit) || right.coverage - left.coverage || left.industryGroup.localeCompare(right.industryGroup));
  const unitSets = new Map<string, Set<string>>();
  latest.forEach((entry) => { const key = `${entry.industryGroup}\u0000${entry.metric}`; unitSets.set(key, new Set([...(unitSets.get(key) ?? []), `${entry.unit}\u0000${keyText(entry.currency)}`])); });
  const exceptions = [
    ...[...unitSets.entries()].filter(([, units]) => units.size > 1).map(([key, units]) => { const [industryGroup, metric] = key.split('\u0000'); return { type: 'UNIT_OR_CURRENCY_MISMATCH', industryGroup, metric, detail: `同一行业与指标存在 ${units.size} 个单位或币种组合，未合并比较。` }; }),
    ...latest.filter((entry) => !entry.sourceReference?.trim()).map((entry) => ({ type: 'MISSING_SOURCE_REFERENCE', industryGroup: entry.industryGroup, metric: entry.metric, detail: `记录 ${entry.recordId} 未提供来源定位，仅保留批次来源标签。` })),
  ];
  const series = [...aggregate.entries()].flatMap(([key, observations]) => {
    const [industryGroup, metric, unit, currency] = key.split('\u0000'); const byDate = new Map<string, number[]>(); observations.forEach((entry) => { const date = entry.observedAt.toISOString().slice(0, 10); byDate.set(date, [...(byDate.get(date) ?? []), entry.value]); }); return [...byDate.entries()].map(([observedDate, values]) => ({ industryGroup, metric, unit, currency: currency === '—' ? null : currency, observedDate, average: values.reduce((sum, value) => sum + value, 0) / values.length, coverage: values.length }));
  }).sort((left, right) => left.observedDate.localeCompare(right.observedDate));
  return { recordCount: input.length, latestComparableRecordCount: latest.length, industryGroupCount: new Set(input.map((entry) => entry.industryGroup)).size, metricCount: new Set(input.map((entry) => entry.metric)).size, summaries, exceptions, series, observations: [...input].sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime() || left.recordId.localeCompare(right.recordId)) };
}

export async function importPrivateIndustryBatch(userId: number, input: { name: string; classification: string; sourceLabel: string; asOfAt: Date; observations: ImportedIndustryObservation[] }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const inserted = await db.insert(industryGroupPrivateBatches).values({ userId, name: input.name.trim().slice(0, 120), classification: input.classification.trim().slice(0, 80), sourceLabel: input.sourceLabel.trim().slice(0, 160), asOfAt: input.asOfAt, recordCount: input.observations.length });
  const batchId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  await db.insert(industryGroupPrivateObservations).values(input.observations.map((entry) => ({ userId, batchId, recordId: entry.recordId.trim().slice(0, 120), industryGroup: entry.industryGroup.trim().slice(0, 160), metric: entry.metric.trim().slice(0, 120), value: String(entry.value), unit: entry.unit.trim().slice(0, 48), issuerName: entry.issuerName?.trim().slice(0, 160) || null, ticker: entry.ticker?.trim().slice(0, 48).toUpperCase() || null, currency: entry.currency?.trim().slice(0, 12).toUpperCase() || null, sourceReference: entry.sourceReference?.trim().slice(0, 255) || null, observedAt: entry.observedAt })));
  return { batchId, imported: input.observations.length };
}

export async function listPrivateIndustryBatches(userId: number) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); return db.select().from(industryGroupPrivateBatches).where(eq(industryGroupPrivateBatches.userId, userId)).orderBy(desc(industryGroupPrivateBatches.createdAt)); }

export async function getPrivateIndustryDossier(userId: number, batchId?: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const batch = batchId ? (await db.select().from(industryGroupPrivateBatches).where(and(eq(industryGroupPrivateBatches.userId, userId), eq(industryGroupPrivateBatches.id, batchId))).limit(1))[0] : (await db.select().from(industryGroupPrivateBatches).where(eq(industryGroupPrivateBatches.userId, userId)).orderBy(desc(industryGroupPrivateBatches.createdAt)).limit(1))[0];
  if (!batch) return null;
  const rows = await db.select().from(industryGroupPrivateObservations).where(and(eq(industryGroupPrivateObservations.userId, userId), eq(industryGroupPrivateObservations.batchId, batch.id))).orderBy(industryGroupPrivateObservations.observedAt);
  const observations: StoredIndustryObservation[] = rows.map((row) => ({ recordId: row.recordId, industryGroup: row.industryGroup, metric: row.metric, value: numeric(row.value), unit: row.unit, issuerName: row.issuerName, ticker: row.ticker, currency: row.currency, sourceReference: row.sourceReference, observedAt: row.observedAt }));
  return { batch, ...analyzePrivateIndustryObservations(observations) };
}

export async function exportPrivateIndustryBatches(userId: number, batchIds?: number[]) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const batches = await db.select().from(industryGroupPrivateBatches).where(and(eq(industryGroupPrivateBatches.userId, userId), ...(batchIds?.length ? [inArray(industryGroupPrivateBatches.id, batchIds.slice(0, 100))] : []))).orderBy(desc(industryGroupPrivateBatches.createdAt));
  if (!batches.length) return { generatedAt: new Date(), batches: [] as unknown[] };
  const ids = batches.map((batch) => batch.id); const observations = await db.select().from(industryGroupPrivateObservations).where(and(eq(industryGroupPrivateObservations.userId, userId), inArray(industryGroupPrivateObservations.batchId, ids))).orderBy(industryGroupPrivateObservations.observedAt);
  return { generatedAt: new Date(), batches: batches.map((batch) => ({ ...batch, observations: observations.filter((entry) => entry.batchId === batch.id) })) };
}

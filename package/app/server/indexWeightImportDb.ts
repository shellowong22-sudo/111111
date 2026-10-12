import { createHash } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { getDb } from './db';
import { indexConstituentArchiveEvents, indexOfficialWeightImportAuditEvents, indexOfficialWeightImportBatches, indexOfficialWeightImportRows } from '../drizzle/schema';

export type OfficialWeightRowInput = { ticker: string; name: string; weightPct: number };
export type OfficialWeightImportInput = { indexId: string; sourceLabel: string; sourceUrl: string; sourceDate: string; sourceFilename: string; rows: OfficialWeightRowInput[] };
const OFFICIAL_WEIGHT_HOSTS = new Set(['nasdaq.com', 'indexes.nasdaqomx.com']);

function normalizeTicker(value: string) { return value.trim().toUpperCase(); }
function parseWeightSourceDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('INDEX_WEIGHT_SOURCE_DATE_INVALID');
  return parsed;
}

export function validateOfficialWeightImport(input: OfficialWeightImportInput) {
  let url: URL;
  try { url = new URL(input.sourceUrl); } catch { throw new Error('INDEX_WEIGHT_SOURCE_URL_INVALID'); }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.protocol !== 'https:' || !OFFICIAL_WEIGHT_HOSTS.has(hostname)) throw new Error('INDEX_WEIGHT_SOURCE_NOT_OFFICIAL');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate)) throw new Error('INDEX_WEIGHT_SOURCE_DATE_INVALID');
  const rows = input.rows.map((row) => ({ ticker: normalizeTicker(row.ticker), name: row.name.trim().slice(0, 240), weightPct: Number(row.weightPct) })).filter((row) => row.ticker || row.name || Number.isFinite(row.weightPct));
  if (!rows.length || rows.length > 500) throw new Error('INDEX_WEIGHT_ROWS_INVALID');
  if (rows.some((row) => !/^[A-Z0-9.\-]{1,20}$/.test(row.ticker) || !row.name || !Number.isFinite(row.weightPct) || row.weightPct <= 0 || row.weightPct > 100)) throw new Error('INDEX_WEIGHT_ROWS_INVALID');
  if (new Set(rows.map((row) => row.ticker)).size !== rows.length) throw new Error('INDEX_WEIGHT_TICKER_DUPLICATE');
  const totalWeightPct = rows.reduce((total, row) => total + row.weightPct, 0);
  if (totalWeightPct < 99.95 || totalWeightPct > 100.05) throw new Error('INDEX_WEIGHT_TOTAL_INVALID');
  const normalized = rows.map((row) => ({ ...row, weightPct: Number(row.weightPct.toFixed(4)) })).sort((left, right) => left.ticker.localeCompare(right.ticker));
  return { sourceUrl: url.toString(), rows: normalized, totalWeightPct: Number(totalWeightPct.toFixed(4)) };
}

export async function importOfficialIndexWeights(userId: number, input: OfficialWeightImportInput) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const normalized = validateOfficialWeightImport(input); const indexId = input.indexId.trim().toUpperCase().slice(0, 64); const sourceLabel = input.sourceLabel.trim().slice(0, 160); const sourceFilename = input.sourceFilename.trim().slice(0, 240);
  if (!indexId || !sourceLabel || !sourceFilename) throw new Error('INDEX_WEIGHT_IMPORT_METADATA_REQUIRED');
  const contentFingerprint = createHash('sha256').update(JSON.stringify({ indexId, sourceUrl: normalized.sourceUrl, sourceDate: input.sourceDate, rows: normalized.rows })).digest('hex');
  const duplicate = (await db.select({ id: indexOfficialWeightImportBatches.id }).from(indexOfficialWeightImportBatches).where(and(eq(indexOfficialWeightImportBatches.userId, userId), eq(indexOfficialWeightImportBatches.contentFingerprint, contentFingerprint))).limit(1))[0];
  if (duplicate) throw new Error('INDEX_WEIGHT_IMPORT_DUPLICATE');
  const insert = await db.insert(indexOfficialWeightImportBatches).values({ userId, indexId, sourceLabel, sourceUrl: normalized.sourceUrl, sourceDate: parseWeightSourceDate(input.sourceDate), sourceFilename, rowCount: normalized.rows.length, totalWeightPct: String(normalized.totalWeightPct), contentFingerprint });
  const batchId = Number((insert as any)[0]?.insertId ?? (insert as any).insertId);
  await db.insert(indexOfficialWeightImportRows).values(normalized.rows.map((row) => ({ batchId, ...row, weightPct: String(row.weightPct) })));
  await db.insert(indexOfficialWeightImportAuditEvents).values({ batchId, actorUserId: userId, action: 'imported', note: `导入 ${indexId} 官方权重表：${normalized.rows.length} 行，表格日期 ${input.sourceDate}` });
  return { id: batchId, indexId, sourceLabel, sourceUrl: normalized.sourceUrl, sourceDate: input.sourceDate, sourceFilename, rowCount: normalized.rows.length, totalWeightPct: normalized.totalWeightPct, contentFingerprint };
}

export async function listOfficialIndexWeightImports(userId: number, indexId = 'NASDAQ-100') {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select({ id: indexOfficialWeightImportBatches.id, indexId: indexOfficialWeightImportBatches.indexId, sourceLabel: indexOfficialWeightImportBatches.sourceLabel, sourceUrl: indexOfficialWeightImportBatches.sourceUrl, sourceDate: indexOfficialWeightImportBatches.sourceDate, sourceFilename: indexOfficialWeightImportBatches.sourceFilename, rowCount: indexOfficialWeightImportBatches.rowCount, totalWeightPct: indexOfficialWeightImportBatches.totalWeightPct, contentFingerprint: indexOfficialWeightImportBatches.contentFingerprint, importedAt: indexOfficialWeightImportBatches.importedAt }).from(indexOfficialWeightImportBatches).where(and(eq(indexOfficialWeightImportBatches.userId, userId), eq(indexOfficialWeightImportBatches.indexId, indexId))).orderBy(desc(indexOfficialWeightImportBatches.sourceDate), desc(indexOfficialWeightImportBatches.importedAt));
}

function eventCodes(value: unknown) { return Array.isArray(value) ? value.map((item) => normalizeTicker(String((item as { ticker?: string }).ticker ?? ''))).filter(Boolean) : []; }

export async function getIndexEventWeightImpact(userId: number, eventId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const event = (await db.select().from(indexConstituentArchiveEvents).where(eq(indexConstituentArchiveEvents.id, eventId)).limit(1))[0];
  if (!event) throw new Error('INDEX_EVENT_NOT_FOUND'); if (!event.effectiveDate) return { status: 'unavailable' as const, reason: '该官方公告未披露生效日，无法匹配事件日前后权重表。' };
  const addedCodes = eventCodes(event.added); const removedCodes = eventCodes(event.removed);
  const beforeBatch = (await db.select().from(indexOfficialWeightImportBatches).where(and(eq(indexOfficialWeightImportBatches.userId, userId), eq(indexOfficialWeightImportBatches.indexId, event.indexId), lt(indexOfficialWeightImportBatches.sourceDate, event.effectiveDate))).orderBy(desc(indexOfficialWeightImportBatches.sourceDate), desc(indexOfficialWeightImportBatches.importedAt)).limit(1))[0];
  const afterBatch = (await db.select().from(indexOfficialWeightImportBatches).where(and(eq(indexOfficialWeightImportBatches.userId, userId), eq(indexOfficialWeightImportBatches.indexId, event.indexId), gte(indexOfficialWeightImportBatches.sourceDate, event.effectiveDate))).orderBy(asc(indexOfficialWeightImportBatches.sourceDate), asc(indexOfficialWeightImportBatches.importedAt)).limit(1))[0];
  if (!beforeBatch || !afterBatch) return { status: 'unavailable' as const, reason: '需要导入事件生效日前最近一张和生效日当日或之后最近一张官方权重表，才能核验实际权重影响。', beforeBatch: beforeBatch ? { id: beforeBatch.id, sourceDate: beforeBatch.sourceDate, sourceLabel: beforeBatch.sourceLabel, sourceUrl: beforeBatch.sourceUrl } : null, afterBatch: afterBatch ? { id: afterBatch.id, sourceDate: afterBatch.sourceDate, sourceLabel: afterBatch.sourceLabel, sourceUrl: afterBatch.sourceUrl } : null };
  const [beforeRows, afterRows] = await Promise.all([
    removedCodes.length ? db.select({ ticker: indexOfficialWeightImportRows.ticker, weightPct: indexOfficialWeightImportRows.weightPct }).from(indexOfficialWeightImportRows).where(and(eq(indexOfficialWeightImportRows.batchId, beforeBatch.id), inArray(indexOfficialWeightImportRows.ticker, removedCodes))) : Promise.resolve([]),
    addedCodes.length ? db.select({ ticker: indexOfficialWeightImportRows.ticker, weightPct: indexOfficialWeightImportRows.weightPct }).from(indexOfficialWeightImportRows).where(and(eq(indexOfficialWeightImportRows.batchId, afterBatch.id), inArray(indexOfficialWeightImportRows.ticker, addedCodes))) : Promise.resolve([]),
  ]);
  const beforeWeights = new Map(beforeRows.map((row) => [row.ticker, Number(row.weightPct)])); const afterWeights = new Map(afterRows.map((row) => [row.ticker, Number(row.weightPct)]));
  const missingRemoved = removedCodes.filter((ticker) => !beforeWeights.has(ticker)); const missingAdded = addedCodes.filter((ticker) => !afterWeights.has(ticker));
  if (missingAdded.length || missingRemoved.length) return { status: 'partial' as const, reason: '导入权重表未覆盖本次事件的全部新增或移除代码，终端不合成部分影响。', missingAdded, missingRemoved, beforeBatch: { id: beforeBatch.id, sourceDate: beforeBatch.sourceDate, sourceLabel: beforeBatch.sourceLabel, sourceUrl: beforeBatch.sourceUrl }, afterBatch: { id: afterBatch.id, sourceDate: afterBatch.sourceDate, sourceLabel: afterBatch.sourceLabel, sourceUrl: afterBatch.sourceUrl } };
  const addedWeightPct = Number([...afterWeights.values()].reduce((total, value) => total + value, 0).toFixed(4)); const removedWeightPct = Number([...beforeWeights.values()].reduce((total, value) => total + value, 0).toFixed(4));
  return { status: 'verified' as const, addedWeightPct, removedWeightPct, netWeightPct: Number((addedWeightPct - removedWeightPct).toFixed(4)), beforeBatch: { id: beforeBatch.id, sourceDate: beforeBatch.sourceDate, sourceLabel: beforeBatch.sourceLabel, sourceUrl: beforeBatch.sourceUrl }, afterBatch: { id: afterBatch.id, sourceDate: afterBatch.sourceDate, sourceLabel: afterBatch.sourceLabel, sourceUrl: afterBatch.sourceUrl }, added: addedCodes.map((ticker) => ({ ticker, weightPct: afterWeights.get(ticker)! })), removed: removedCodes.map((ticker) => ({ ticker, weightPct: beforeWeights.get(ticker)! })) };
}

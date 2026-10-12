import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { moneyMarketModuleUsageEvents, moneyMarketSourceAvailabilitySnapshots } from '../drizzle/schema';
import { getDb } from './db';
import { readMoneyMarketLocalState, updateMoneyMarketLocalState } from './moneyMarketLocalStore';

export const MONEY_MARKET_MODULES = [
  ['des-mm', 'DES'], ['pgm', 'PGM'], ['mktbeat', 'MKTBEAT'], ['btmm', 'BTMM'], ['boom', 'BOOM'], ['tcon', 'TCON'], ['rv', 'RV'], ['ycqsim', 'YCQSIM'], ['gc', 'GC'], ['crvf-mmkt', 'CRVF MMKT'], ['crvf', 'CRVF'], ['fibc', 'FIBC'], ['cdie', 'CDIE'], ['efsf', 'EFSF'], ['mmidx', 'MMIDX'], ['etrade', 'ETRADE'], ['edsf', 'EDSF'], ['wbf', 'WBF'], ['pboc', 'PBOC'], ['twdi', 'TWDI'], ['cenb', 'CENB'], ['news-mm', 'NEWS'], ['source-mm', 'SOURCE'], ['mmflow', 'MMFLOW'],
] as const;

export type MoneyMarketModuleId = typeof MONEY_MARKET_MODULES[number][0];
export type SourceAvailabilityProbe = { sourceId: string; sourceLabel: string; status: 'available' | 'unavailable'; recordCount: number; latencyMs: number | null };

const MODULE_SOURCES: Partial<Record<MoneyMarketModuleId, string[]>> = {
  'des-mm': ['FRED-SOFR', 'FRED-EFFR'], mktbeat: ['NYFED-FUNDING', 'FRED-SOFR', 'FRED-EFFR'], btmm: ['TREASURY-AUCTIONS'], boom: ['TREASURY-AUCTIONS'], tcon: ['FRED-SOFR', 'FRED-EFFR'], rv: ['FRED-SOFR', 'FRED-EFFR'], gc: ['FRED-SOFR', 'FRED-EFFR'], 'crvf-mmkt': ['FRED-SOFR', 'FRED-EFFR', 'TREASURY-AUCTIONS', 'BCB-CDI', 'CBC-CALL'], crvf: ['FRED-SOFR', 'FRED-EFFR', 'TREASURY-AUCTIONS', 'BCB-CDI', 'CBC-CALL'], cdie: ['BCB-CDI'], mmidx: ['FRED-SOFR', 'FRED-EFFR'], twdi: ['CBC-CALL'], cenb: ['FRED-SOFR', 'FRED-EFFR', 'CBC-CALL'], 'news-mm': ['NYFED-FUNDING', 'FRED-SOFR', 'FRED-EFFR', 'TREASURY-AUCTIONS', 'BCB-CDI', 'CBC-CALL'], 'source-mm': ['NYFED-FUNDING', 'FRED-SOFR', 'FRED-EFFR', 'TREASURY-AUCTIONS', 'BCB-CDI', 'CBC-CALL'], mmflow: ['NYFED-FUNDING', 'FRED-SOFR', 'FRED-EFFR', 'TREASURY-AUCTIONS', 'BCB-CDI', 'CBC-CALL'],
};

function hourBucket(value: Date) { const copy = new Date(value); copy.setUTCMinutes(0, 0, 0); return copy; }
function activityBucket(value: Date) { return new Date(Math.floor(value.getTime() / (15 * 60_000)) * 15 * 60_000); }

export async function recordMoneyMarketSourceAvailability(probes: SourceAvailabilityProbe[], now = new Date()) {
  const db = await getDb();
  const sampledAt = hourBucket(now);
  if (!probes.length) return { recorded: 0, sampledAt };
  if (!db) return updateMoneyMarketLocalState((state) => {
    const sampledAtIso = sampledAt.toISOString();
    for (const probe of probes) {
      const current = state.sourceAvailability.find((item) => item.sourceId === probe.sourceId && item.sampledAt === sampledAtIso);
      if (current) Object.assign(current, probe, { sampledAt: sampledAtIso });
      else state.sourceAvailability.push({ ...probe, sampledAt: sampledAtIso });
    }
    const cutoff = now.getTime() - 91 * 86_400_000;
    state.sourceAvailability = state.sourceAvailability.filter((item) => Date.parse(item.sampledAt) >= cutoff);
    return { recorded: probes.length, sampledAt };
  });
  for (const probe of probes) {
    await db.insert(moneyMarketSourceAvailabilitySnapshots).values({ ...probe, sampledAt }).onDuplicateKeyUpdate({ set: { sourceLabel: probe.sourceLabel, latencyMs: sql`COALESCE(${moneyMarketSourceAvailabilitySnapshots.latencyMs}, ${probe.latencyMs})` } });
  }
  return { recorded: probes.length, sampledAt };
}

export async function listMoneyMarketSourceAvailabilityHistory(days = 14, now = new Date()) {
  const db = await getDb();
  const safeDays = Math.min(90, Math.max(1, Math.floor(days)));
  const since = new Date(now.getTime() - safeDays * 86_400_000);
  if (!db) return readMoneyMarketLocalState((state) => state.sourceAvailability
    .filter((item) => Date.parse(item.sampledAt) >= since.getTime())
    .sort((left, right) => left.sampledAt.localeCompare(right.sampledAt))
    .map((item, index) => ({ id: index + 1, ...item, sampledAt: new Date(item.sampledAt) })));
  return db.select().from(moneyMarketSourceAvailabilitySnapshots).where(gte(moneyMarketSourceAvailabilitySnapshots.sampledAt, since)).orderBy(asc(moneyMarketSourceAvailabilitySnapshots.sampledAt));
}

export async function recordMoneyMarketModuleUsage(userId: number, moduleId: MoneyMarketModuleId, now = new Date()) {
  const db = await getDb();
  const bucket = activityBucket(now);
  if (!db) return updateMoneyMarketLocalState((state) => {
    const bucketIso = bucket.toISOString();
    const existing = state.moduleUsage.find((item) => item.userId === userId && item.moduleId === moduleId && item.bucket === bucketIso);
    if (existing) existing.openedAt = now.toISOString();
    else state.moduleUsage.push({ userId, moduleId, bucket: bucketIso, openedAt: now.toISOString() });
    const cutoff = now.getTime() - 91 * 86_400_000;
    state.moduleUsage = state.moduleUsage.filter((item) => Date.parse(item.openedAt) >= cutoff);
    return { moduleId, activityBucket: bucket };
  });
  await db.insert(moneyMarketModuleUsageEvents).values({ userId, moduleId, activityBucket: bucket, openedAt: now }).onDuplicateKeyUpdate({ set: { openedAt: now } });
  return { moduleId, activityBucket: bucket };
}

export async function listMoneyMarketModuleDiagnostics(userId: number, days = 30, now = new Date()) {
  const db = await getDb();
  const safeDays = Math.min(90, Math.max(1, Math.floor(days)));
  const usageSince = new Date(now.getTime() - safeDays * 86_400_000);
  const healthSince = new Date(now.getTime() - 30 * 86_400_000);
  if (!db) return readMoneyMarketLocalState((state) => {
    const usageByModule = new Map<string, { openCount: number; lastOpenedAt: Date | null }>();
    state.moduleUsage.filter((item) => item.userId === userId && Date.parse(item.openedAt) >= usageSince.getTime()).forEach((item) => {
      const current = usageByModule.get(item.moduleId) ?? { openCount: 0, lastOpenedAt: null };
      current.openCount += 1;
      const openedAt = new Date(item.openedAt);
      if (!current.lastOpenedAt || openedAt > current.lastOpenedAt) current.lastOpenedAt = openedAt;
      usageByModule.set(item.moduleId, current);
    });
    const latestBySource = new Map<string, typeof state.sourceAvailability[number]>();
    state.sourceAvailability.filter((item) => Date.parse(item.sampledAt) >= healthSince.getTime()).sort((left, right) => right.sampledAt.localeCompare(left.sampledAt)).forEach((item) => { if (!latestBySource.has(item.sourceId)) latestBySource.set(item.sourceId, item); });
    const modules = MONEY_MARKET_MODULES.map(([moduleId, label]) => {
      const sources = MODULE_SOURCES[moduleId] ?? [];
      const probes = sources.flatMap((sourceId) => { const probe = latestBySource.get(sourceId); return probe ? [probe] : []; });
      const available = probes.filter((probe) => probe.status === 'available').length;
      const status = !sources.length ? 'manual' as const : !probes.length ? 'not_observed' as const : available === probes.length ? 'available' as const : available === 0 ? 'unavailable' as const : 'partial' as const;
      const latestProbeAt = probes.reduce<Date | null>((latest, probe) => { const sampledAt = new Date(probe.sampledAt); return !latest || sampledAt > latest ? sampledAt : latest; }, null);
      return { moduleId, label, ...usageByModule.get(moduleId), dependencyCount: sources.length, observedSourceCount: probes.length, availableSourceCount: available, latestProbeAt, status };
    });
    return { days: safeDays, generatedAt: now, modules };
  });
  const [usageRows, sourceRows] = await Promise.all([
    db.select({ moduleId: moneyMarketModuleUsageEvents.moduleId, openCount: sql<number>`count(*)`, lastOpenedAt: sql<Date | null>`max(${moneyMarketModuleUsageEvents.openedAt})` }).from(moneyMarketModuleUsageEvents).where(and(eq(moneyMarketModuleUsageEvents.userId, userId), gte(moneyMarketModuleUsageEvents.openedAt, usageSince))).groupBy(moneyMarketModuleUsageEvents.moduleId),
    db.select().from(moneyMarketSourceAvailabilitySnapshots).where(gte(moneyMarketSourceAvailabilitySnapshots.sampledAt, healthSince)).orderBy(desc(moneyMarketSourceAvailabilitySnapshots.sampledAt)),
  ]);
  const usageByModule = new Map(usageRows.map((row) => [row.moduleId, { openCount: Number(row.openCount ?? 0), lastOpenedAt: row.lastOpenedAt ?? null }]));
  const latestBySource = new Map<string, typeof sourceRows[number]>();
  sourceRows.forEach((row) => { if (!latestBySource.has(row.sourceId)) latestBySource.set(row.sourceId, row); });
  const modules = MONEY_MARKET_MODULES.map(([moduleId, label]) => {
    const sources = MODULE_SOURCES[moduleId] ?? [];
    const probes = sources.flatMap((sourceId) => { const probe = latestBySource.get(sourceId); return probe ? [probe] : []; });
    const available = probes.filter((probe) => probe.status === 'available').length;
    const status = !sources.length ? 'manual' as const : !probes.length ? 'not_observed' as const : available === probes.length ? 'available' as const : available === 0 ? 'unavailable' as const : 'partial' as const;
    const latestProbeAt = probes.reduce<Date | null>((latest, probe) => !latest || probe.sampledAt > latest ? probe.sampledAt : latest, null);
    return { moduleId, label, ...usageByModule.get(moduleId), dependencyCount: sources.length, observedSourceCount: probes.length, availableSourceCount: available, latestProbeAt, status };
  });
  return { days: safeDays, generatedAt: now, modules };
}

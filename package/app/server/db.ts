import { createHmac } from 'node:crypto';
import { eq, like, or, sql, desc, isNotNull, lt, and, gte, lte, count, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, marketData, userPreferences, pricingRiskExports, curveInteractions, notifications, notificationPreferences, bondPortfolioImportTemplates, researchLedgerAuditEvents, researchLedgerEntries, checklistShares, checklistSnapshots, checklistTemplates, checklistTemplateAuditEvents, checklistExportRecords, sovereignComparisonPresets, sovereignComparisonPresetShares, checklistDeadlineNotificationEvents, sovereignDailyFactSnapshots, financingCalendarReminderRules, financingCalendarReminderNotificationEvents, creditEvidenceLogs, creditEvidenceShares, creditEvidenceAuditEvents, creditOasThresholdRules, creditOasThresholdNotificationEvents, creditResearchPackageTemplates, creditResearchPackages, creditResearchPackageShares, creditResearchPackageSignatures, creditResearchPackageAuditEvents, creditSharedWorkpapers, creditSharedWorkpaperShares, creditSharedWorkpaperAuditEvents, mortgageSharedLedgers, mortgageSharedLedgerShares, mortgageSharedLedgerAuditEvents, mortgageTaxonomyTags, mortgageTaxonomyTagShares, mortgageTaxonomyTagAssignments, mortgageLedgerSavedViews, mortgageLedgerNotificationEvents, gcReportTemplates, mktbeatThresholdNotificationEvents } from "../drizzle/schema";
import { ENV } from './_core/env';
import { fetchOfficialFinancingCalendar } from './realDataService';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export type SovereignDailyFactSnapshotInput = {
  snapshotKey: string;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  observationDate: string;
  status: 'available' | 'partial' | 'unavailable';
  recordCount: number;
  coveredModules: string[];
  payload: unknown;
  limitation?: string | null;
};

/** 每个来源、每个 UTC 日期仅保留一份可追溯快照；重试更新同一事实记录而不重复插入。 */
export async function upsertSovereignDailyFactSnapshot(input: SovereignDailyFactSnapshotInput) {
  const db = await getDb();
  if (!db) throw new Error('数据库不可用，无法保存每日主权债事实快照');
  await db.insert(sovereignDailyFactSnapshots).values({ ...input, limitation: input.limitation ?? null }).onDuplicateKeyUpdate({
    set: {
      sourceLabel: input.sourceLabel,
      sourceUrl: input.sourceUrl,
      status: input.status,
      recordCount: input.recordCount,
      coveredModules: input.coveredModules,
      payload: input.payload,
      limitation: input.limitation ?? null,
      syncedAt: new Date(),
    },
  });
}

/** 每个来源取最新一份快照，用于显示来源、时效、覆盖范围及真实空状态。 */
export async function getLatestSovereignDailyFactSnapshots() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(sovereignDailyFactSnapshots).orderBy(desc(sovereignDailyFactSnapshots.syncedAt));
  const latest = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!latest.has(row.sourceKey)) latest.set(row.sourceKey, row);
  return [...latest.values()];
}

/** 按来源读取最近的日度原始事实快照；只返回已保存记录，不在读取时回填或推算任何数值。 */
export async function getSovereignDailyFactSnapshotHistory(sourceKey: string, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - Math.max(1, Math.min(days, 365)) * 86_400_000).toISOString().slice(0, 10);
  return db.select().from(sovereignDailyFactSnapshots)
    .where(and(eq(sovereignDailyFactSnapshots.sourceKey, sourceKey), gte(sovereignDailyFactSnapshots.observationDate, cutoff)))
    .orderBy(sovereignDailyFactSnapshots.syncedAt);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type GcReportTemplateInput = {
  userId: number;
  name: string;
  headerText: string;
  researchIdPrefix: string;
  footerText: string;
  isDefault: boolean;
};

/** GC 模板只保存用户设置的元数据；同名保存为受控覆盖，不持久化任何曲线观察值。 */
export async function listGcReportTemplates(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(gcReportTemplates).where(eq(gcReportTemplates.userId, userId)).orderBy(desc(gcReportTemplates.isDefault), desc(gcReportTemplates.updatedAt), gcReportTemplates.name);
}

export async function saveGcReportTemplate(input: GcReportTemplateInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.transaction(async (tx) => {
    if (input.isDefault) await tx.update(gcReportTemplates).set({ isDefault: false }).where(eq(gcReportTemplates.userId, input.userId));
    await tx.insert(gcReportTemplates).values(input).onDuplicateKeyUpdate({ set: { headerText: input.headerText, researchIdPrefix: input.researchIdPrefix, footerText: input.footerText, isDefault: input.isDefault, updatedAt: new Date() } });
    const row = (await tx.select().from(gcReportTemplates).where(and(eq(gcReportTemplates.userId, input.userId), eq(gcReportTemplates.name, input.name))).limit(1))[0];
    if (!row) throw new Error('GC_REPORT_TEMPLATE_SAVE_FAILED');
    return row;
  });
}

export async function deleteGcReportTemplate(userId: number, templateId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const result = await db.delete(gcReportTemplates).where(and(eq(gcReportTemplates.id, templateId), eq(gcReportTemplates.userId, userId)));
  if (!Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0)) throw new Error('GC_REPORT_TEMPLATE_NOT_FOUND');
  return { id: templateId, deleted: true };
}

export async function setDefaultGcReportTemplate(userId: number, templateId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.transaction(async (tx) => {
    const existing = (await tx.select({ id: gcReportTemplates.id }).from(gcReportTemplates).where(and(eq(gcReportTemplates.id, templateId), eq(gcReportTemplates.userId, userId))).limit(1))[0];
    if (!existing) throw new Error('GC_REPORT_TEMPLATE_NOT_FOUND');
    await tx.update(gcReportTemplates).set({ isDefault: false }).where(eq(gcReportTemplates.userId, userId));
    await tx.update(gcReportTemplates).set({ isDefault: true, updatedAt: new Date() }).where(eq(gcReportTemplates.id, templateId));
    return { id: templateId, isDefault: true };
  });
}

export type MktbeatThresholdNotificationInput = {
  seriesId: string;
  label: string;
  windowDays: 20 | 60 | 120;
  thresholdBps: number;
  observationDate: string;
  changeBps: number;
};

/** 同一账户、观察日和阈值组合只发出一次提醒；通知正文和未读计数统一交由全局 notifications 表维护。 */
export async function processMktbeatThresholdNotifications(userId: number, alerts: MktbeatThresholdNotificationInput[]) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const preference = (await db.select({ marketAlerts: notificationPreferences.marketAlerts }).from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1))[0];
  if (preference && !preference.marketAlerts) return [];
  const emitted: Array<{ id: number; userId: number; title: string; content: string; type: 'alert' }> = [];
  for (const alert of alerts) {
    const thresholdBps = Number(alert.thresholdBps.toFixed(1));
    const changeBps = Number(alert.changeBps.toFixed(1));
    if (!Number.isFinite(thresholdBps) || !Number.isFinite(changeBps) || Math.abs(changeBps) < thresholdBps) continue;
    const notificationKey = `mktbeat-threshold:${alert.seriesId}:${alert.windowDays}:${thresholdBps}:${alert.observationDate}`;
    const title = `MKTBEAT 阈值提醒：${alert.label}`;
    const content = `${alert.label} 在 ${alert.observationDate} 的 ${alert.windowDays} 日公开观察窗口变化为 ${changeBps.toFixed(1)} bp，达到账户设定绝对阈值 ${thresholdBps.toFixed(1)} bp。来源：FRED 公开历史序列。`;
    const created = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: mktbeatThresholdNotificationEvents.id }).from(mktbeatThresholdNotificationEvents).where(and(eq(mktbeatThresholdNotificationEvents.userId, userId), eq(mktbeatThresholdNotificationEvents.notificationKey, notificationKey))).limit(1);
      if (existing[0]) return null;
      const eventInsert = await tx.insert(mktbeatThresholdNotificationEvents).values({ notificationKey, userId, seriesId: alert.seriesId, windowDays: alert.windowDays, thresholdBps: String(thresholdBps), observationDate: alert.observationDate, observedChangeBps: String(changeBps) });
      const eventId = Number((eventInsert as any)[0]?.insertId ?? (eventInsert as any).insertId);
      const notification = await tx.insert(notifications).values({ userId, title, content, type: 'alert', relatedType: 'mktbeat_threshold', relatedId: eventId });
      return Number((notification as any)[0]?.insertId ?? (notification as any).insertId);
    });
    if (created) emitted.push({ id: created, userId, title, content, type: 'alert' });
  }
  return emitted;
}

// Market data queries
export async function getAllMarketData() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get market data: database not available");
    return [];
  }

  try {
    const result = await db.select().from(marketData);
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to get market data:", error);
    return [];
  }
}

export async function getMarketDataBySymbol(symbol: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get market data: database not available");
    return undefined;
  }

  try {
    const result = await db.select().from(marketData).where(eq(marketData.symbol, symbol)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get market data by symbol:", error);
    return undefined;
  }
}

export async function getMarketDataByType(market: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get market data: database not available");
    return [];
  }

  try {
    const result = await db.select().from(marketData).where(eq(marketData.market, market as any));
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to get market data by type:", error);
    return [];
  }
}

export async function searchMarketData(query: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search market data: database not available");
    return [];
  }

  try {
    const result = await db.select().from(marketData).where(
      or(
        like(marketData.symbol, `%${query}%`),
        like(marketData.name, `%${query}%`)
      )
    );
    return result || [];
  } catch (error) {
    console.error("[Database] Failed to search market data:", error);
    return [];
  }
}

// ─── Market Data CRUD ───────────────────────────────────────────────────────

export async function createMarketData(input: {
  symbol: string;
  name: string;
  market: string;
  price: string;
  changeVal: string;
  changePct: string;
  volume: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(marketData).values({
    symbol: input.symbol,
    name: input.name,
    market: input.market as any,
    price: input.price,
    changeVal: input.changeVal,
    changePct: input.changePct,
    volume: input.volume,
  });
}

export async function updateMarketData(id: number, input: {
  symbol?: string;
  name?: string;
  market?: string;
  price?: string;
  changeVal?: string;
  changePct?: string;
  volume?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (input.symbol !== undefined) updateSet.symbol = input.symbol;
  if (input.name !== undefined) updateSet.name = input.name;
  if (input.market !== undefined) updateSet.market = input.market;
  if (input.price !== undefined) updateSet.price = input.price;
  if (input.changeVal !== undefined) updateSet.changeVal = input.changeVal;
  if (input.changePct !== undefined) updateSet.changePct = input.changePct;
  if (input.volume !== undefined) updateSet.volume = input.volume;
  await db.update(marketData).set(updateSet).where(eq(marketData.id, id));
}

export async function deleteMarketData(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(marketData).where(eq(marketData.id, id));
}


// User Preferences Operations
export async function getUserPreference(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result?.[0] || null;
}

export async function upsertUserPreference(userId: number, data: {
  panelLayout?: string;
  varConfidence?: string;
  volatilityModel?: string;
  valuationModel?: string;
  stressScenario?: string;
  exportFormat?: string;
  lastUpdatedPanel?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserPreference(userId);
  
  if (existing) {
    await db.update(userPreferences).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({
      userId,
      ...data,
    });
  }
}

// Pricing & Risk Exports Operations
export async function createExportRecord(data: {
  userId: number;
  panelId: string;
  panelName?: string;
  exportType: string;
  fileUrl?: string;
  fileSize?: number;
  dataSnapshot?: string;
  exportedAt: number;
  expiresAt?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const id = crypto.randomUUID();
  await db.insert(pricingRiskExports).values({
    id,
    ...data,
  });
  return id;
}

export async function getExportHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(pricingRiskExports).where(eq(pricingRiskExports.userId, userId)).orderBy(desc(pricingRiskExports.createdAt)).limit(limit);
  return result || [];
}

export async function deleteExpiredExports() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const now = Math.floor(Date.now() / 1000);
  await db.delete(pricingRiskExports).where(
    and(
      isNotNull(pricingRiskExports.expiresAt),
      lt(pricingRiskExports.expiresAt, now)
    )
  );
}

// Curve Interactions Operations
export async function recordCurveInteraction(data: {
  userId: number;
  sourcePanelId: string;
  targetPanelId: string;
  curveId?: number;
  period?: string;
  value?: string;
  parametersPassed?: string;
  interactedAt: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const id = crypto.randomUUID();
  await db.insert(curveInteractions).values({
    id,
    ...data,
  });
  return id;
}

export async function getCurveInteractionHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(curveInteractions).where(eq(curveInteractions.userId, userId)).orderBy(desc(curveInteractions.interactedAt)).limit(limit);
  return result || [];
}

// ─── Bond Portfolio CSV Mapping Templates ────────────────────────────────────
export async function getBondPortfolioImportTemplates(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(bondPortfolioImportTemplates)
    .where(eq(bondPortfolioImportTemplates.userId, userId))
    .orderBy(desc(bondPortfolioImportTemplates.updatedAt));
}

export async function saveBondPortfolioImportTemplate(input: { userId: number; name: string; mapping: Record<string, string> }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = (await getBondPortfolioImportTemplates(input.userId)).find((template) => template.name === input.name);
  if (existing) {
    await db.update(bondPortfolioImportTemplates).set({ mapping: input.mapping }).where(eq(bondPortfolioImportTemplates.id, existing.id));
    return { id: existing.id, action: 'updated' as const };
  }
  const result = await db.insert(bondPortfolioImportTemplates).values({ userId: input.userId, name: input.name, mapping: input.mapping });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Failed to save CSV mapping template');
  return { id, action: 'created' as const };
}

export async function deleteBondPortfolioImportTemplate(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = (await getBondPortfolioImportTemplates(userId)).find((item) => item.id === id);
  if (!template) return false;
  await db.delete(bondPortfolioImportTemplates).where(eq(bondPortfolioImportTemplates.id, id));
  return true;
}

// ─── Sovereign Comparison Preset Favorites & Team Sharing ────────────────────
export type SovereignComparisonPresetInput = { name: string; countries: string[] };

export async function saveSovereignComparisonPreset(userId: number, input: SovereignComparisonPresetInput) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(sovereignComparisonPresets)
    .where(and(eq(sovereignComparisonPresets.userId, userId), eq(sovereignComparisonPresets.name, input.name))).limit(1);
  if (existing[0]) {
    await db.update(sovereignComparisonPresets).set({ countries: input.countries }).where(eq(sovereignComparisonPresets.id, existing[0].id));
    return { id: existing[0].id, action: 'updated' as const };
  }
  const result = await db.insert(sovereignComparisonPresets).values({ userId, name: input.name, countries: input.countries });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('COMPARISON_PRESET_CREATE_FAILED');
  return { id, action: 'created' as const };
}

export async function listSovereignComparisonPresets(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [owned, shared] = await Promise.all([
    db.select({ id: sovereignComparisonPresets.id, userId: sovereignComparisonPresets.userId, name: sovereignComparisonPresets.name, countries: sovereignComparisonPresets.countries, createdAt: sovereignComparisonPresets.createdAt, updatedAt: sovereignComparisonPresets.updatedAt, ownerName: users.name }).from(sovereignComparisonPresets).innerJoin(users, eq(users.id, sovereignComparisonPresets.userId)).where(eq(sovereignComparisonPresets.userId, userId)).orderBy(desc(sovereignComparisonPresets.updatedAt)),
    db.select({ id: sovereignComparisonPresets.id, userId: sovereignComparisonPresets.userId, name: sovereignComparisonPresets.name, countries: sovereignComparisonPresets.countries, createdAt: sovereignComparisonPresets.createdAt, updatedAt: sovereignComparisonPresets.updatedAt, ownerName: users.name }).from(sovereignComparisonPresetShares).innerJoin(sovereignComparisonPresets, eq(sovereignComparisonPresets.id, sovereignComparisonPresetShares.presetId)).innerJoin(users, eq(users.id, sovereignComparisonPresets.userId)).where(eq(sovereignComparisonPresetShares.sharedWithUserId, userId)).orderBy(desc(sovereignComparisonPresets.updatedAt)),
  ]);
  return [...owned.map((preset) => ({ ...preset, permission: 'owner' as const })), ...shared.map((preset) => ({ ...preset, permission: 'viewer' as const }))];
}

export async function deleteSovereignComparisonPreset(ownerUserId: number, presetId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const preset = await db.select().from(sovereignComparisonPresets).where(eq(sovereignComparisonPresets.id, presetId)).limit(1);
  if (!preset[0] || preset[0].userId !== ownerUserId) throw new Error('FORBIDDEN_COMPARISON_PRESET');
  await db.delete(sovereignComparisonPresetShares).where(eq(sovereignComparisonPresetShares.presetId, presetId));
  await db.delete(sovereignComparisonPresets).where(eq(sovereignComparisonPresets.id, presetId));
  return { id: presetId, deleted: true };
}

export async function shareSovereignComparisonPreset(ownerUserId: number, input: { presetId: number; sharedWithUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const preset = await db.select().from(sovereignComparisonPresets).where(eq(sovereignComparisonPresets.id, input.presetId)).limit(1);
  if (!preset[0] || preset[0].userId !== ownerUserId) throw new Error('FORBIDDEN_COMPARISON_PRESET');
  if (input.sharedWithUserId === ownerUserId) throw new Error('CANNOT_SHARE_PRESET_WITH_OWNER');
  const target = await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1);
  if (!target[0]) throw new Error('SHARED_USER_NOT_FOUND');
  const existing = await db.select().from(sovereignComparisonPresetShares).where(and(eq(sovereignComparisonPresetShares.presetId, input.presetId), eq(sovereignComparisonPresetShares.sharedWithUserId, input.sharedWithUserId))).limit(1);
  if (existing[0]) return { id: existing[0].id, action: 'unchanged' as const };
  const result = await db.insert(sovereignComparisonPresetShares).values(input);
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('COMPARISON_PRESET_SHARE_FAILED');
  return { id, action: 'created' as const };
}

export async function revokeSovereignComparisonPresetShare(ownerUserId: number, presetId: number, sharedWithUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const preset = await db.select().from(sovereignComparisonPresets).where(eq(sovereignComparisonPresets.id, presetId)).limit(1);
  if (!preset[0] || preset[0].userId !== ownerUserId) throw new Error('FORBIDDEN_COMPARISON_PRESET');
  const share = await db.select().from(sovereignComparisonPresetShares).where(and(eq(sovereignComparisonPresetShares.presetId, presetId), eq(sovereignComparisonPresetShares.sharedWithUserId, sharedWithUserId))).limit(1);
  if (!share[0]) throw new Error('COMPARISON_PRESET_SHARE_NOT_FOUND');
  await db.delete(sovereignComparisonPresetShares).where(eq(sovereignComparisonPresetShares.id, share[0].id));
  return { id: share[0].id, revoked: true };
}

export async function listSovereignComparisonPresetShares(ownerUserId: number, presetId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const preset = await db.select().from(sovereignComparisonPresets).where(eq(sovereignComparisonPresets.id, presetId)).limit(1);
  if (!preset[0] || preset[0].userId !== ownerUserId) throw new Error('FORBIDDEN_COMPARISON_PRESET');
  return db.select({ id: sovereignComparisonPresetShares.id, sharedWithUserId: sovereignComparisonPresetShares.sharedWithUserId, name: users.name, role: users.role, createdAt: sovereignComparisonPresetShares.createdAt }).from(sovereignComparisonPresetShares).innerJoin(users, eq(users.id, sovereignComparisonPresetShares.sharedWithUserId)).where(eq(sovereignComparisonPresetShares.presetId, presetId)).orderBy(desc(sovereignComparisonPresetShares.createdAt));
}

// ─── Research Ledger & Approval Audit Operations ─────────────────────────────
export type ResearchLedgerCreateInput = {
  userId: number;
  moduleCode: string;
  instrument: string;
  purpose: string;
  verifiedSource: string;
  methodBasis: string;
  complianceConfirmed: boolean;
};

export type ResearchLedgerNotification = { id: number; userId: number; title: string; content: string; type: 'alert' | 'info' };

export async function createResearchLedgerEntry(input: ResearchLedgerCreateInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const submittedAt = new Date();
  const approvalDueAt = new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000);

  const result = await db.insert(researchLedgerEntries).values({
    ...input,
    status: "submitted",
    submittedAt,
    approvalDueAt,
    createdAt: submittedAt,
    updatedAt: submittedAt,
  });
  const entryId = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(entryId) || entryId <= 0) throw new Error("Failed to create research ledger entry");

  await db.insert(researchLedgerAuditEvents).values({
    entryId,
    actorUserId: input.userId,
    action: "submitted",
    note: `研究登记已提交，等待管理员审批；审批截止时间：${approvalDueAt.toISOString()}。`,
  });
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
  const adminNotifications: ResearchLedgerNotification[] = [];
  for (const admin of admins) {
    const title = '研究登记待审批';
    const content = `登记 #${entryId}（${input.moduleCode} · ${input.instrument}）已提交，审批截止时间：${approvalDueAt.toLocaleString('zh-CN')}。`;
    const notificationResult = await db.insert(notifications).values({ userId: admin.id, title, content, type: 'alert', relatedId: entryId, relatedType: 'research_ledger' });
    const notificationId = Number((notificationResult as any)[0]?.insertId ?? (notificationResult as any).insertId);
    if (Number.isInteger(notificationId) && notificationId > 0) adminNotifications.push({ id: notificationId, userId: admin.id, title, content, type: 'alert' });
  }
  return { entryId, approvalDueAt, adminNotifications };
}

export async function getResearchLedgerEntryById(entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(researchLedgerEntries).where(eq(researchLedgerEntries.id, entryId)).limit(1);
  return rows[0] ?? null;
}

export async function getResearchLedgerEntriesForUser(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(researchLedgerEntries)
    .where(eq(researchLedgerEntries.userId, userId))
    .orderBy(desc(researchLedgerEntries.updatedAt))
    .limit(limit);
}

export async function getPendingResearchLedgerEntries(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(researchLedgerEntries)
    .where(eq(researchLedgerEntries.status, "submitted"))
    .orderBy(desc(researchLedgerEntries.submittedAt))
    .limit(limit);
}

export async function getResearchLedgerAuditEvents(entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [events, entries] = await Promise.all([
    db.select().from(researchLedgerAuditEvents)
      .where(eq(researchLedgerAuditEvents.entryId, entryId))
      .orderBy(desc(researchLedgerAuditEvents.createdAt)),
    db.select({ submittedAt: researchLedgerEntries.submittedAt, reviewedAt: researchLedgerEntries.reviewedAt })
      .from(researchLedgerEntries)
      .where(eq(researchLedgerEntries.id, entryId))
      .limit(1),
  ]);
  const entry = entries[0];
  return events.map((event) => ({
    ...event,
    createdAt: event.action === "submitted"
      ? (entry?.submittedAt ?? event.createdAt)
      : (entry?.reviewedAt ?? event.createdAt),
  }));
}

export async function reviewResearchLedgerEntry(input: {
  entryId: number;
  reviewerId: number;
  decision: "approved" | "rejected";
  reviewNote: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const entry = await getResearchLedgerEntryById(input.entryId);
  if (!entry) throw new Error('Research ledger entry not found');

  await db.update(researchLedgerEntries).set({
    status: input.decision,
    reviewerId: input.reviewerId,
    reviewNote: input.reviewNote,
    reviewedAt: new Date(),
  }).where(eq(researchLedgerEntries.id, input.entryId));
  await db.insert(researchLedgerAuditEvents).values({
    entryId: input.entryId,
    actorUserId: input.reviewerId,
    action: input.decision,
    note: input.reviewNote,
  });
  const title = input.decision === 'approved' ? '研究登记已批准' : '研究登记已驳回';
  const content = `登记 #${entry.id}（${entry.moduleCode} · ${entry.instrument}）已${input.decision === 'approved' ? '批准' : '驳回'}。审批意见：${input.reviewNote}`;
  const notificationResult = await db.insert(notifications).values({ userId: entry.userId, title, content, type: input.decision === 'approved' ? 'info' : 'alert', relatedId: entry.id, relatedType: 'research_ledger' });
  const notificationId = Number((notificationResult as any)[0]?.insertId ?? (notificationResult as any).insertId);
  return { userNotification: Number.isInteger(notificationId) && notificationId > 0 ? { id: notificationId, userId: entry.userId, title, content, type: input.decision === 'approved' ? 'info' as const : 'alert' as const } : null };
}

// ─── Sovereign Research Checklist Collaboration ───────────────────────────────
export type ChecklistTemplatePermission = 'owner' | 'editor' | 'viewer' | 'none';
export type ChecklistTemplateInput = { name: string; moduleId: string; items: string[]; isPublic: boolean };
export type ChecklistArchiveReviewDecision = 'approved' | 'changes_requested';
export type ChecklistArchiveReviewFilter = 'all' | 'due_soon' | 'overdue';
export type ChecklistVersionExportFormat = 'csv' | 'pdf';

async function appendChecklistTemplateAuditEvent(input: { templateId: number; actorUserId: number; action: 'archived' | 'restored' | 'retention_set' | 'submitted_for_review' | 'review_approved' | 'review_changes_requested' | 'shared' | 'share_revoked' | 'visibility_changed'; targetUserId?: number; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(checklistTemplateAuditEvents).values(input);
}

export async function getChecklistTemplateById(templateId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, templateId)).limit(1);
  return rows[0] ?? null;
}

export async function getChecklistTemplatePermission(templateId: number, userId: number): Promise<ChecklistTemplatePermission> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = await getChecklistTemplateById(templateId);
  if (!template) return 'none';
  if (template.archivedAt && template.userId !== userId) return 'none';
  if (template.userId === userId) return 'owner';
  const shares = await db.select().from(checklistShares).where(and(eq(checklistShares.templateId, templateId), eq(checklistShares.sharedWithUserId, userId))).limit(1);
  if (shares[0]) return shares[0].canEdit ? 'editor' : 'viewer';
  return template.isPublic ? 'viewer' : 'none';
}

export async function listChecklistTemplatesForUser(userId: number, moduleId: string, includeArchived = false) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [templates, shares] = await Promise.all([
    db.select().from(checklistTemplates).where(eq(checklistTemplates.moduleId, moduleId)).orderBy(desc(checklistTemplates.updatedAt)),
    db.select().from(checklistShares).where(eq(checklistShares.sharedWithUserId, userId)),
  ]);
  const shareByTemplateId = new Map(shares.map((share) => [share.templateId, share]));
  return templates.flatMap((template) => {
    if (template.archivedAt && (template.userId !== userId || !includeArchived)) return [];
    const share = shareByTemplateId.get(template.id);
    const permission: ChecklistTemplatePermission = template.userId === userId ? 'owner' : share ? (share.canEdit ? 'editor' : 'viewer') : template.isPublic ? 'viewer' : 'none';
    return permission === 'none' ? [] : [{ ...template, permission }];
  });
}

export async function saveChecklistTemplate(userId: number, input: ChecklistTemplateInput & { templateId?: number }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (input.templateId) {
    const template = await getChecklistTemplateById(input.templateId);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    if (template.archivedAt) throw new Error('TEMPLATE_ARCHIVED');
    const permission = await getChecklistTemplatePermission(input.templateId, userId);
    if (permission !== 'owner' && permission !== 'editor') throw new Error('FORBIDDEN_TEMPLATE_EDIT');
    const updates: { name: string; items: string[]; isPublic?: boolean } = { name: input.name, items: input.items };
    if (permission === 'owner') updates.isPublic = input.isPublic;
    await db.update(checklistTemplates).set(updates).where(eq(checklistTemplates.id, input.templateId));
    if (permission === 'owner') await appendChecklistTemplateAuditEvent({ templateId: input.templateId, actorUserId: userId, action: 'visibility_changed', note: input.isPublic ? '设置为登录账户可发现' : '取消登录账户可发现' });
    return { id: input.templateId, action: 'updated' as const };
  }
  const result = await db.insert(checklistTemplates).values({ userId, name: input.name, moduleId: input.moduleId, items: input.items, isPublic: input.isPublic });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Failed to create checklist template');
  return { id, action: 'created' as const };
}

export async function saveChecklistShare(ownerUserId: number, input: { templateId: number; sharedWithUserId: number; canEdit: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = await getChecklistTemplateById(input.templateId);
  if (!template || template.userId !== ownerUserId) throw new Error('FORBIDDEN_TEMPLATE_SHARE');
  if (template.archivedAt) throw new Error('TEMPLATE_ARCHIVED');
  if (input.sharedWithUserId === ownerUserId) throw new Error('CANNOT_SHARE_WITH_OWNER');
  const usersFound = await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1);
  if (!usersFound[0]) throw new Error('SHARED_USER_NOT_FOUND');
  const existing = await db.select().from(checklistShares).where(and(eq(checklistShares.templateId, input.templateId), eq(checklistShares.sharedWithUserId, input.sharedWithUserId))).limit(1);
  if (existing[0]) {
    await db.update(checklistShares).set({ canEdit: input.canEdit }).where(eq(checklistShares.id, existing[0].id));
    await appendChecklistTemplateAuditEvent({ templateId: input.templateId, actorUserId: ownerUserId, action: 'shared', targetUserId: input.sharedWithUserId, note: input.canEdit ? '更新为可编辑授权' : '更新为只读授权' });
    return { id: existing[0].id, action: 'updated' as const };
  }
  const result = await db.insert(checklistShares).values(input);
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Failed to share checklist template');
  await appendChecklistTemplateAuditEvent({ templateId: input.templateId, actorUserId: ownerUserId, action: 'shared', targetUserId: input.sharedWithUserId, note: input.canEdit ? '授予可编辑权限' : '授予只读权限' });
  return { id, action: 'created' as const };
}

function toRetentionExpiry(retentionDays: number | null) {
  if (!retentionDays) return null;
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + retentionDays);
  return expires;
}

function toArchiveReviewDueAt() {
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 3);
  return due;
}

export function getArchiveReviewDeadlineStatus(dueAt: Date | null, now = new Date()) {
  if (!dueAt) return 'no_deadline' as const;
  const remainingMs = dueAt.getTime() - now.getTime();
  if (remainingMs < 0) return 'overdue' as const;
  if (remainingMs <= 48 * 60 * 60 * 1000) return 'due_soon' as const;
  return 'on_track' as const;
}

export async function setChecklistTemplateArchive(ownerUserId: number, templateId: number, archived: boolean, retentionDays: number | null = null) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = await getChecklistTemplateById(templateId);
  if (!template || template.userId !== ownerUserId) throw new Error('FORBIDDEN_TEMPLATE_ARCHIVE');
  if (archived) {
    const retentionExpiresAt = toRetentionExpiry(retentionDays);
    const archiveReviewDueAt = toArchiveReviewDueAt();
    await db.update(checklistTemplates).set({ archivedAt: new Date(), archivedByUserId: ownerUserId, retentionDays, retentionExpiresAt, archiveReviewStatus: 'pending', archiveReviewDueAt, archiveReviewedByUserId: null, archiveReviewedAt: null, archiveReviewNote: null }).where(eq(checklistTemplates.id, templateId));
    await appendChecklistTemplateAuditEvent({ templateId, actorUserId: ownerUserId, action: 'archived', note: '模板已归档，非创建者不再可见' });
    await appendChecklistTemplateAuditEvent({ templateId, actorUserId: ownerUserId, action: 'retention_set', note: retentionDays ? `保留期限设为 ${retentionDays} 天，截止于 ${retentionExpiresAt?.toISOString().slice(0, 10)}` : '保留期限设为长期保留' });
    await appendChecklistTemplateAuditEvent({ templateId, actorUserId: ownerUserId, action: 'submitted_for_review', note: '已进入管理员归档审阅队列' });
    return { id: templateId, archived, retentionDays, retentionExpiresAt, archiveReviewDueAt, reviewStatus: 'pending' as const };
  }
  await db.update(checklistTemplates).set({ archivedAt: null, archivedByUserId: null, retentionDays: null, retentionExpiresAt: null, archiveReviewStatus: 'not_required', archiveReviewDueAt: null, archiveReviewedByUserId: null, archiveReviewedAt: null, archiveReviewNote: null }).where(eq(checklistTemplates.id, templateId));
  await appendChecklistTemplateAuditEvent({ templateId, actorUserId: ownerUserId, action: 'restored', note: '模板已恢复至活动列表' });
  return { id: templateId, archived, retentionDays: null, retentionExpiresAt: null, archiveReviewDueAt: null, reviewStatus: 'not_required' as const };
}

export async function setChecklistTemplateRetention(ownerUserId: number, templateId: number, retentionDays: number | null) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = await getChecklistTemplateById(templateId);
  if (!template || template.userId !== ownerUserId) throw new Error('FORBIDDEN_TEMPLATE_ARCHIVE');
  if (!template.archivedAt) throw new Error('TEMPLATE_NOT_ARCHIVED');
  const retentionExpiresAt = toRetentionExpiry(retentionDays);
  const archiveReviewDueAt = toArchiveReviewDueAt();
  await db.update(checklistTemplates).set({ retentionDays, retentionExpiresAt, archiveReviewStatus: 'pending', archiveReviewDueAt, archiveReviewedByUserId: null, archiveReviewedAt: null, archiveReviewNote: null }).where(eq(checklistTemplates.id, templateId));
  await appendChecklistTemplateAuditEvent({ templateId, actorUserId: ownerUserId, action: 'retention_set', note: retentionDays ? `保留期限更新为 ${retentionDays} 天，截止于 ${retentionExpiresAt?.toISOString().slice(0, 10)}` : '保留期限更新为长期保留' });
  await appendChecklistTemplateAuditEvent({ templateId, actorUserId: ownerUserId, action: 'submitted_for_review', note: '保留期限变更已重新进入管理员审阅队列' });
  return { id: templateId, retentionDays, retentionExpiresAt, archiveReviewDueAt, reviewStatus: 'pending' as const };
}

export async function listChecklistArchiveReviewQueue(limit = 50, filter: ChecklistArchiveReviewFilter = 'all') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select({ id: checklistTemplates.id, name: checklistTemplates.name, moduleId: checklistTemplates.moduleId, userId: checklistTemplates.userId, ownerName: users.name, archivedAt: checklistTemplates.archivedAt, retentionDays: checklistTemplates.retentionDays, retentionExpiresAt: checklistTemplates.retentionExpiresAt, archiveReviewStatus: checklistTemplates.archiveReviewStatus, archiveReviewDueAt: checklistTemplates.archiveReviewDueAt, archiveReviewNote: checklistTemplates.archiveReviewNote }).from(checklistTemplates).innerJoin(users, eq(users.id, checklistTemplates.userId)).where(and(isNotNull(checklistTemplates.archivedAt), eq(checklistTemplates.archiveReviewStatus, 'pending'))).orderBy(desc(checklistTemplates.archivedAt)).limit(Math.min(Math.max(limit, 1), 100));
  return rows.map((row) => ({ ...row, deadlineStatus: getArchiveReviewDeadlineStatus(row.archiveReviewDueAt) })).filter((row) => filter === 'all' || row.deadlineStatus === filter);
}

export async function reviewChecklistTemplateArchive(adminUserId: number, input: { templateId: number; decision: ChecklistArchiveReviewDecision; reviewNote: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = await getChecklistTemplateById(input.templateId);
  if (!template || !template.archivedAt) throw new Error('ARCHIVE_REVIEW_NOT_FOUND');
  if (template.archiveReviewStatus !== 'pending') throw new Error('ARCHIVE_REVIEW_NOT_PENDING');
  const action = input.decision === 'approved' ? 'review_approved' : 'review_changes_requested';
  await db.update(checklistTemplates).set({ archiveReviewStatus: input.decision, archiveReviewDueAt: null, archiveReviewedByUserId: adminUserId, archiveReviewedAt: new Date(), archiveReviewNote: input.reviewNote }).where(eq(checklistTemplates.id, input.templateId));
  await appendChecklistTemplateAuditEvent({ templateId: input.templateId, actorUserId: adminUserId, action, targetUserId: template.userId, note: input.reviewNote });
  const title = input.decision === 'approved' ? '归档模板审阅已通过' : '归档模板需调整';
  const content = `模板“${template.name}”的归档治理审阅结果：${input.decision === 'approved' ? '通过' : '需调整'}。意见：${input.reviewNote}`;
  await db.insert(notifications).values({ userId: template.userId, title, content, type: input.decision === 'approved' ? 'info' : 'alert', relatedId: input.templateId, relatedType: 'checklist_template_archive' });
  return { id: input.templateId, decision: input.decision, ownerUserId: template.userId };
}

export async function batchReviewChecklistTemplateArchives(adminUserId: number, input: { templateIds: number[]; decision: ChecklistArchiveReviewDecision; reviewNote: string }) {
  const templateIds = Array.from(new Set(input.templateIds)).slice(0, 50);
  if (!templateIds.length) throw new Error('ARCHIVE_REVIEW_NOT_FOUND');
  const templates = await Promise.all(templateIds.map((templateId) => getChecklistTemplateById(templateId)));
  if (templates.some((template) => !template?.archivedAt)) throw new Error('ARCHIVE_REVIEW_NOT_FOUND');
  if (templates.some((template) => template?.archiveReviewStatus !== 'pending')) throw new Error('ARCHIVE_REVIEW_NOT_PENDING');
  const retentionKeys = new Set(templates.map((template) => template?.retentionDays === null ? 'permanent' : String(template?.retentionDays)));
  if (retentionKeys.size !== 1) throw new Error('ARCHIVE_REVIEW_RETENTION_MISMATCH');
  const results = await Promise.all(templateIds.map((templateId) => reviewChecklistTemplateArchive(adminUserId, { templateId, decision: input.decision, reviewNote: input.reviewNote })));
  return { count: results.length, decision: input.decision, templateIds };
}

type ChecklistVersionExportInput = { userId: number; templateId: number; moduleId: string; leftSnapshotId: number; rightSnapshotId: number; exportFormat: ChecklistVersionExportFormat; issuedAt: string };

export function createChecklistVersionExportSignature(input: ChecklistVersionExportInput) {
  const researchId = `SR-${input.moduleId.toUpperCase()}-T${input.templateId}-S${input.leftSnapshotId}-S${input.rightSnapshotId}`;
  const signaturePayload = JSON.stringify({ version: 1, userId: input.userId, templateId: input.templateId, moduleId: input.moduleId, leftSnapshotId: input.leftSnapshotId, rightSnapshotId: input.rightSnapshotId, exportFormat: input.exportFormat, researchId, issuedAt: input.issuedAt });
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('EXPORT_SIGNING_UNAVAILABLE');
  const verificationCode = `CHK-${createHmac('sha256', secret).update(signaturePayload).digest('hex').slice(0, 32).toUpperCase()}`;
  return { researchId, signaturePayload, verificationCode };
}

export async function registerChecklistVersionExport(input: ChecklistVersionExportInput & { verificationCode: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const signature = createChecklistVersionExportSignature(input);
  if (signature.verificationCode !== input.verificationCode) throw new Error('EXPORT_SIGNATURE_INVALID');
  const verificationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const result = await db.insert(checklistExportRecords).values({ userId: input.userId, templateId: input.templateId, moduleId: input.moduleId, researchId: signature.researchId, exportFormat: input.exportFormat, verificationCode: signature.verificationCode, signaturePayload: signature.signaturePayload, verificationExpiresAt });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('EXPORT_RECORD_CREATE_FAILED');
  return { id, researchId: signature.researchId, verificationCode: signature.verificationCode, verificationExpiresAt };
}

export type ChecklistExportRegistryFilter = { userId?: number; moduleId?: string; exportFormat?: ChecklistVersionExportFormat; dateFrom?: Date; dateTo?: Date };

export async function adminListChecklistExportRecords(filter: ChecklistExportRegistryFilter, limit = 30, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const conditions = [
    filter.userId ? eq(checklistExportRecords.userId, filter.userId) : undefined,
    filter.moduleId ? eq(checklistExportRecords.moduleId, filter.moduleId) : undefined,
    filter.exportFormat ? eq(checklistExportRecords.exportFormat, filter.exportFormat) : undefined,
    filter.dateFrom ? gte(checklistExportRecords.downloadedAt, filter.dateFrom) : undefined,
    filter.dateTo ? lte(checklistExportRecords.downloadedAt, filter.dateTo) : undefined,
  ].filter(Boolean) as any[];
  const where = conditions.length ? and(...conditions) : undefined;
  const safeLimit = Math.min(Math.max(limit, 1), 5000);
  const safeOffset = Math.max(offset, 0);
  const [data, totalRows] = await Promise.all([
    db.select({ id: checklistExportRecords.id, userId: checklistExportRecords.userId, userName: users.name, userEmail: users.email, templateId: checklistExportRecords.templateId, moduleId: checklistExportRecords.moduleId, researchId: checklistExportRecords.researchId, exportFormat: checklistExportRecords.exportFormat, verificationCode: checklistExportRecords.verificationCode, verificationExpiresAt: checklistExportRecords.verificationExpiresAt, downloadedAt: checklistExportRecords.downloadedAt }).from(checklistExportRecords).innerJoin(users, eq(users.id, checklistExportRecords.userId)).where(where).orderBy(desc(checklistExportRecords.downloadedAt)).limit(safeLimit).offset(safeOffset),
    db.select({ total: count() }).from(checklistExportRecords).where(where),
  ]);
  return { data, total: totalRows[0]?.total ?? 0, limit: safeLimit, offset: safeOffset };
}

export async function verifyChecklistExportSignature(input: { researchId: string; verificationCode: string }, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const records = await db.select({ id: checklistExportRecords.id, researchId: checklistExportRecords.researchId, moduleId: checklistExportRecords.moduleId, exportFormat: checklistExportRecords.exportFormat, verificationCode: checklistExportRecords.verificationCode, signaturePayload: checklistExportRecords.signaturePayload, verificationExpiresAt: checklistExportRecords.verificationExpiresAt, downloadedAt: checklistExportRecords.downloadedAt }).from(checklistExportRecords).where(and(eq(checklistExportRecords.researchId, input.researchId), eq(checklistExportRecords.verificationCode, input.verificationCode))).limit(1);
  const record = records[0];
  if (!record || !process.env.JWT_SECRET) return { status: 'invalid' as const, record: null };
  const expected = `CHK-${createHmac('sha256', process.env.JWT_SECRET).update(record.signaturePayload).digest('hex').slice(0, 32).toUpperCase()}`;
  if (expected !== input.verificationCode || record.verificationCode !== input.verificationCode) return { status: 'invalid' as const, record: null };
  const status = record.verificationExpiresAt && record.verificationExpiresAt.getTime() < now.getTime() ? 'expired' as const : 'valid' as const;
  return { status, record: { id: record.id, researchId: record.researchId, moduleId: record.moduleId, exportFormat: record.exportFormat, verificationExpiresAt: record.verificationExpiresAt, downloadedAt: record.downloadedAt } };
}

// ─── Checklist Deadline Notifications ─────────────────────────────────────────
export type ChecklistDeadlineEventType = 'signature_expiring' | 'review_due';

export async function findExpiringChecklistExportRecords(windowHours = 24, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const horizon = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
  return db.select().from(checklistExportRecords).where(and(isNotNull(checklistExportRecords.verificationExpiresAt), gte(checklistExportRecords.verificationExpiresAt, now), lte(checklistExportRecords.verificationExpiresAt, horizon))).orderBy(checklistExportRecords.verificationExpiresAt);
}

export async function findDueChecklistArchiveReviews(windowHours = 24, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const horizon = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
  return db.select({ id: checklistTemplates.id, name: checklistTemplates.name, ownerUserId: checklistTemplates.userId, archiveReviewDueAt: checklistTemplates.archiveReviewDueAt }).from(checklistTemplates).where(and(eq(checklistTemplates.archiveReviewStatus, 'pending'), isNotNull(checklistTemplates.archiveReviewDueAt), gte(checklistTemplates.archiveReviewDueAt, now), lte(checklistTemplates.archiveReviewDueAt, horizon))).orderBy(checklistTemplates.archiveReviewDueAt);
}

export async function hasChecklistDeadlineNotificationBeenSent(notificationKey: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select({ id: checklistDeadlineNotificationEvents.id }).from(checklistDeadlineNotificationEvents).where(eq(checklistDeadlineNotificationEvents.notificationKey, notificationKey)).limit(1);
  return Boolean(rows[0]);
}

export async function recordChecklistDeadlineNotification(input: { notificationKey: string; userId: number; eventType: ChecklistDeadlineEventType; dueAt: Date; title: string; content: string; exportRecordId?: number; templateId?: number; relatedType: 'checklist_export' | 'checklist_template_archive'; relatedId: number }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: checklistDeadlineNotificationEvents.id }).from(checklistDeadlineNotificationEvents).where(eq(checklistDeadlineNotificationEvents.notificationKey, input.notificationKey)).limit(1);
    if (existing[0]) return false;
    await tx.insert(checklistDeadlineNotificationEvents).values({ notificationKey: input.notificationKey, userId: input.userId, eventType: input.eventType, dueAt: input.dueAt, exportRecordId: input.exportRecordId, templateId: input.templateId });
    await tx.insert(notifications).values({ userId: input.userId, title: input.title, content: input.content, type: 'alert', relatedType: input.relatedType, relatedId: input.relatedId });
    return true;
  });
}

export async function processChecklistDeadlineNotifications(windowHours = 24, now = new Date()) {
  const [exports, archiveReviews, admins] = await Promise.all([
    findExpiringChecklistExportRecords(windowHours, now),
    findDueChecklistArchiveReviews(windowHours, now),
    (async () => { const db = await getDb(); if (!db) throw new Error('Database not available'); return db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')); })(),
  ]);
  let notified = 0;
  for (const record of exports) {
    if (!record.verificationExpiresAt) continue;
    const notificationKey = `signature:${record.id}:${record.userId}:${record.verificationExpiresAt.toISOString()}`;
    const sent = await recordChecklistDeadlineNotification({ notificationKey, userId: record.userId, eventType: 'signature_expiring', dueAt: record.verificationExpiresAt, exportRecordId: record.id, title: '导出签名即将到期', content: `研究编号 ${record.researchId} 的 ${record.exportFormat.toUpperCase()} 导出签名将于 ${record.verificationExpiresAt.toLocaleString('zh-CN')} 到期。请在到期前完成外部核验或重新导出。`, relatedType: 'checklist_export', relatedId: record.id });
    if (sent) notified += 1;
  }
  for (const review of archiveReviews) {
    if (!review.archiveReviewDueAt) continue;
    for (const admin of admins) {
      const notificationKey = `archive-review:${review.id}:${admin.id}:${review.archiveReviewDueAt.toISOString()}`;
      const sent = await recordChecklistDeadlineNotification({ notificationKey, userId: admin.id, eventType: 'review_due', dueAt: review.archiveReviewDueAt, templateId: review.id, title: '归档模板审阅即将到期', content: `归档模板“${review.name}”的管理员审阅截止时间为 ${review.archiveReviewDueAt.toLocaleString('zh-CN')}。请在审阅队列中完成通过或要求调整。`, relatedType: 'checklist_template_archive', relatedId: review.id });
      if (sent) notified += 1;
    }
  }
  return { notified, expiringExports: exports.length, dueArchiveReviews: archiveReviews.length };
}

// ─── Sovereign Financing Calendar Reminders ───────────────────────────────────
export type FinancingCalendarReminderEventType = 'announcement' | 'auction' | 'settlement';

function parseFinancingCalendarEventDate(eventDate: string) {
  const parsed = new Date(`${eventDate}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function isFinancingCalendarReminderDue(eventDate: string, daysBeforeEvent: number, now = new Date()) {
  const eventAt = parseFinancingCalendarEventDate(eventDate);
  if (!eventAt || !Number.isInteger(daysBeforeEvent) || daysBeforeEvent < 1) return false;
  const reminderStartAt = new Date(eventAt.getTime() - daysBeforeEvent * 86_400_000);
  return now >= reminderStartAt && now < eventAt;
}

export async function listFinancingCalendarReminderRules(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(financingCalendarReminderRules)
    .where(eq(financingCalendarReminderRules.userId, userId))
    .orderBy(financingCalendarReminderRules.eventType, financingCalendarReminderRules.countryCode);
}

export async function upsertFinancingCalendarReminderRule(input: { userId: number; eventType: FinancingCalendarReminderEventType; countryCode: string; daysBeforeEvent: number; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const countryCode = input.countryCode.trim().toUpperCase() || 'ALL';
  await db.insert(financingCalendarReminderRules).values({ ...input, countryCode }).onDuplicateKeyUpdate({
    set: { daysBeforeEvent: input.daysBeforeEvent, isActive: input.isActive, updatedAt: new Date() },
  });
  const rules = await db.select().from(financingCalendarReminderRules).where(and(
    eq(financingCalendarReminderRules.userId, input.userId),
    eq(financingCalendarReminderRules.eventType, input.eventType),
    eq(financingCalendarReminderRules.countryCode, countryCode),
  )).limit(1);
  if (!rules[0]) throw new Error('FINANCING_REMINDER_RULE_SAVE_FAILED');
  return rules[0];
}

export async function deleteFinancingCalendarReminderRule(userId: number, ruleId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.delete(financingCalendarReminderRules).where(and(eq(financingCalendarReminderRules.id, ruleId), eq(financingCalendarReminderRules.userId, userId)));
  const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
  if (!affectedRows) throw new Error('FINANCING_REMINDER_RULE_NOT_FOUND');
  return { id: ruleId, deleted: true };
}

export async function setFinancingCalendarReminderRuleActive(userId: number, ruleId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.update(financingCalendarReminderRules).set({ isActive, updatedAt: new Date() })
    .where(and(eq(financingCalendarReminderRules.id, ruleId), eq(financingCalendarReminderRules.userId, userId)));
  const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
  if (!affectedRows) throw new Error('FINANCING_REMINDER_RULE_NOT_FOUND');
  const rules = await db.select().from(financingCalendarReminderRules).where(and(
    eq(financingCalendarReminderRules.id, ruleId),
    eq(financingCalendarReminderRules.userId, userId),
  )).limit(1);
  if (!rules[0]) throw new Error('FINANCING_REMINDER_RULE_NOT_FOUND');
  return rules[0];
}

export async function listFinancingCalendarReminderNotificationHistory(input: { userId: number; limit?: number; from?: string; to?: string; countryCode?: string; status?: 'active' | 'paused' | 'all' }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const filters = [eq(financingCalendarReminderNotificationEvents.userId, input.userId)];
  const fromDate = input.from ? parseFinancingCalendarEventDate(input.from) : null;
  const toDate = input.to ? parseFinancingCalendarEventDate(input.to) : null;
  if (input.from && !fromDate) throw new Error('INVALID_FINANCING_HISTORY_FROM_DATE');
  if (input.to && !toDate) throw new Error('INVALID_FINANCING_HISTORY_TO_DATE');
  if (fromDate) filters.push(gte(financingCalendarReminderNotificationEvents.eventDate, fromDate));
  if (toDate) filters.push(lte(financingCalendarReminderNotificationEvents.eventDate, toDate));
  if (input.countryCode && input.countryCode !== 'ALL') filters.push(eq(financingCalendarReminderRules.countryCode, input.countryCode));
  if (input.status === 'active') filters.push(eq(financingCalendarReminderRules.isActive, true));
  if (input.status === 'paused') filters.push(eq(financingCalendarReminderRules.isActive, false));
  return db.select({
    id: financingCalendarReminderNotificationEvents.id,
    ruleId: financingCalendarReminderNotificationEvents.ruleId,
    eventRecordId: financingCalendarReminderNotificationEvents.eventRecordId,
    eventDate: financingCalendarReminderNotificationEvents.eventDate,
    sentAt: financingCalendarReminderNotificationEvents.createdAt,
    eventType: financingCalendarReminderRules.eventType,
    countryCode: financingCalendarReminderRules.countryCode,
    daysBeforeEvent: financingCalendarReminderRules.daysBeforeEvent,
    isActive: financingCalendarReminderRules.isActive,
  }).from(financingCalendarReminderNotificationEvents)
    .innerJoin(financingCalendarReminderRules, eq(financingCalendarReminderNotificationEvents.ruleId, financingCalendarReminderRules.id))
    .where(and(...filters))
    .orderBy(desc(financingCalendarReminderNotificationEvents.createdAt))
    .limit(Math.min(Math.max(input.limit ?? 30, 1), 500));
}

export async function setFinancingCalendarReminderRulesActive(userId: number, ruleIds: number[], isActive: boolean) {
  const ids = [...new Set(ruleIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) throw new Error('FINANCING_REMINDER_RULE_IDS_REQUIRED');
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.update(financingCalendarReminderRules).set({ isActive, updatedAt: new Date() })
    .where(and(eq(financingCalendarReminderRules.userId, userId), inArray(financingCalendarReminderRules.id, ids)));
  const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
  return { updated: affectedRows, ids, isActive };
}

/**
 * 每小时扫描已发布的官方融资事件。提醒窗口从事件 UTC 日期前 N 日 00:00 开始，
 * 到事件日 00:00 结束；通知记录用规则与事件标识去重，使平台重试保持幂等。
 */
export async function processFinancingCalendarReminderNotifications(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [rules, calendar] = await Promise.all([
    db.select().from(financingCalendarReminderRules).where(eq(financingCalendarReminderRules.isActive, true)),
    fetchOfficialFinancingCalendar(150),
  ]);
  let notified = 0;
  let matchedEvents = 0;
  for (const rule of rules) {
    for (const record of calendar.records) {
      if (record.eventType !== rule.eventType || (rule.countryCode !== 'ALL' && record.countryCode !== rule.countryCode)) continue;
      if (!isFinancingCalendarReminderDue(record.auctionDate, rule.daysBeforeEvent, now)) continue;
      const eventDate = parseFinancingCalendarEventDate(record.auctionDate);
      if (!eventDate) continue;
      matchedEvents += 1;
      const notificationKey = `fin-cal:${rule.id}:${record.id}:${record.auctionDate}`;
      const created = await db.transaction(async (tx) => {
        const existing = await tx.select({ id: financingCalendarReminderNotificationEvents.id })
          .from(financingCalendarReminderNotificationEvents)
          .where(eq(financingCalendarReminderNotificationEvents.notificationKey, notificationKey)).limit(1);
        if (existing[0]) return false;
        await tx.insert(financingCalendarReminderNotificationEvents).values({
          notificationKey,
          userId: rule.userId,
          ruleId: rule.id,
          eventRecordId: record.id,
          eventDate,
        });
        await tx.insert(notifications).values({
          userId: rule.userId,
          title: `融资日历提醒：${record.country}${eventTypeLabel(record.eventType)}`,
          content: `${record.country} ${record.securityType}${record.securityTerm ? `（${record.securityTerm}）` : ''}的${eventTypeLabel(record.eventType)}日期为 ${record.auctionDate}，已按提前 ${rule.daysBeforeEvent} 天的账户规则提醒。来源：${record.sourceLabel}。`,
          type: 'alert',
          relatedType: 'financing_calendar_event',
          relatedId: rule.id,
        });
        return true;
      });
      if (created) notified += 1;
    }
  }
  return { notified, matchedEvents, activeRules: rules.length };
}

// ─── Credit research evidence & OAS threshold alerts ──────────────────────────
export type CreditEvidencePermission = 'owner' | 'editor' | 'viewer' | 'none';
export type CreditEvidenceInput = { evidenceId?: number; ticker: string; issuer?: string | null; form?: string | null; filingDate?: string | null; sourceUrl: string; quotedText: string; annotation: string; highlightColor: 'amber' | 'cyan' | 'rose' | 'emerald' };

export async function getCreditEvidencePermission(evidenceId: number, userId: number): Promise<CreditEvidencePermission> {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const evidence = (await db.select({ userId: creditEvidenceLogs.userId }).from(creditEvidenceLogs).where(eq(creditEvidenceLogs.id, evidenceId)).limit(1))[0];
  if (!evidence) return 'none';
  if (evidence.userId === userId) return 'owner';
  const share = (await db.select().from(creditEvidenceShares).where(and(eq(creditEvidenceShares.evidenceId, evidenceId), eq(creditEvidenceShares.sharedWithUserId, userId))).limit(1))[0];
  return share ? (share.canEdit ? 'editor' : 'viewer') : 'none';
}

function requireCreditEvidenceAccess(permission: CreditEvidencePermission, mode: 'view' | 'edit') {
  if (mode === 'view' ? permission === 'none' : (permission !== 'owner' && permission !== 'editor')) throw new Error(mode === 'view' ? 'FORBIDDEN_CREDIT_EVIDENCE_VIEW' : 'FORBIDDEN_CREDIT_EVIDENCE_EDIT');
}

export async function listCreditEvidenceLogs(userId: number, ticker?: string, limit = 80) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const shares = await db.select({ evidenceId: creditEvidenceShares.evidenceId, canEdit: creditEvidenceShares.canEdit }).from(creditEvidenceShares).where(eq(creditEvidenceShares.sharedWithUserId, userId));
  const sharedIds = shares.map((share) => share.evidenceId);
  const filters = [or(eq(creditEvidenceLogs.userId, userId), ...(sharedIds.length ? [inArray(creditEvidenceLogs.id, sharedIds)] : []))];
  if (ticker?.trim()) filters.push(eq(creditEvidenceLogs.ticker, ticker.trim().toUpperCase()));
  const rows = await db.select().from(creditEvidenceLogs).where(and(...filters)).orderBy(desc(creditEvidenceLogs.updatedAt)).limit(Math.min(Math.max(limit, 1), 200));
  const editableSharedIds = new Set(shares.filter((share) => share.canEdit).map((share) => share.evidenceId));
  return rows.map((row) => ({ ...row, permission: row.userId === userId ? 'owner' as const : editableSharedIds.has(row.id) ? 'editor' as const : 'viewer' as const }));
}

export async function saveCreditEvidenceLog(userId: number, input: CreditEvidenceInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const values = { ticker: input.ticker.trim().toUpperCase(), issuer: input.issuer?.trim() || null, form: input.form?.trim() || null, filingDate: input.filingDate?.trim() || null, sourceUrl: input.sourceUrl.trim(), quotedText: input.quotedText.trim(), annotation: input.annotation.trim(), highlightColor: input.highlightColor };
  if (input.evidenceId) {
    requireCreditEvidenceAccess(await getCreditEvidencePermission(input.evidenceId, userId), 'edit');
    await db.update(creditEvidenceLogs).set({ ...values, updatedAt: new Date() }).where(eq(creditEvidenceLogs.id, input.evidenceId));
    await db.insert(creditEvidenceAuditEvents).values({ evidenceId: input.evidenceId, actorUserId: userId, action: 'updated', note: '更新 SEC 证据摘录或高亮标注' });
    const row = (await db.select().from(creditEvidenceLogs).where(eq(creditEvidenceLogs.id, input.evidenceId)).limit(1))[0];
    if (!row) throw new Error('CREDIT_EVIDENCE_NOT_FOUND');
    return row;
  }
  const result = await db.insert(creditEvidenceLogs).values({ userId, ...values });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!id) throw new Error('CREDIT_EVIDENCE_SAVE_FAILED');
  await db.insert(creditEvidenceAuditEvents).values({ evidenceId: id, actorUserId: userId, action: 'created', note: '创建 SEC 证据摘录与高亮标注' });
  const row = (await db.select().from(creditEvidenceLogs).where(eq(creditEvidenceLogs.id, id)).limit(1))[0];
  if (!row) throw new Error('CREDIT_EVIDENCE_SAVE_FAILED');
  return row;
}

export async function listCreditEvidenceShares(ownerUserId: number, evidenceId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (await getCreditEvidencePermission(evidenceId, ownerUserId) !== 'owner') throw new Error('FORBIDDEN_CREDIT_EVIDENCE_SHARE');
  return db.select({ id: creditEvidenceShares.id, sharedWithUserId: creditEvidenceShares.sharedWithUserId, canEdit: creditEvidenceShares.canEdit, createdAt: creditEvidenceShares.createdAt, userName: users.name, userEmail: users.email }).from(creditEvidenceShares).innerJoin(users, eq(creditEvidenceShares.sharedWithUserId, users.id)).where(eq(creditEvidenceShares.evidenceId, evidenceId));
}

export async function saveCreditEvidenceShare(ownerUserId: number, input: { evidenceId: number; sharedWithUserId: number; canEdit: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (await getCreditEvidencePermission(input.evidenceId, ownerUserId) !== 'owner') throw new Error('FORBIDDEN_CREDIT_EVIDENCE_SHARE');
  if (input.sharedWithUserId === ownerUserId) throw new Error('CANNOT_SHARE_CREDIT_EVIDENCE_WITH_OWNER');
  const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0];
  if (!target) throw new Error('SHARED_USER_NOT_FOUND');
  await db.insert(creditEvidenceShares).values(input).onDuplicateKeyUpdate({ set: { canEdit: input.canEdit } });
  await db.insert(creditEvidenceAuditEvents).values({ evidenceId: input.evidenceId, actorUserId: ownerUserId, action: 'shared', targetUserId: input.sharedWithUserId, note: input.canEdit ? '授予团队成员编辑证据日志权限' : '授予团队成员查看证据日志权限' });
  return input;
}

export async function revokeCreditEvidenceShare(ownerUserId: number, evidenceId: number, sharedWithUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (await getCreditEvidencePermission(evidenceId, ownerUserId) !== 'owner') throw new Error('FORBIDDEN_CREDIT_EVIDENCE_SHARE');
  const result = await db.delete(creditEvidenceShares).where(and(eq(creditEvidenceShares.evidenceId, evidenceId), eq(creditEvidenceShares.sharedWithUserId, sharedWithUserId)));
  const affectedRows = Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0);
  if (!affectedRows) throw new Error('CREDIT_EVIDENCE_SHARE_NOT_FOUND');
  await db.insert(creditEvidenceAuditEvents).values({ evidenceId, actorUserId: ownerUserId, action: 'share_revoked', targetUserId: sharedWithUserId, note: '撤销团队成员的证据日志访问权限' });
  return { evidenceId, sharedWithUserId, revoked: true };
}

export async function listCreditEvidenceAuditEvents(userId: number, evidenceId: number, limit = 60) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditEvidenceAccess(await getCreditEvidencePermission(evidenceId, userId), 'view');
  return db.select({ id: creditEvidenceAuditEvents.id, action: creditEvidenceAuditEvents.action, note: creditEvidenceAuditEvents.note, createdAt: creditEvidenceAuditEvents.createdAt, actorUserId: creditEvidenceAuditEvents.actorUserId, actorName: users.name, targetUserId: creditEvidenceAuditEvents.targetUserId }).from(creditEvidenceAuditEvents).innerJoin(users, eq(creditEvidenceAuditEvents.actorUserId, users.id)).where(eq(creditEvidenceAuditEvents.evidenceId, evidenceId)).orderBy(desc(creditEvidenceAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 200));
}

export async function listCreditOasThresholdRules(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(creditOasThresholdRules).where(eq(creditOasThresholdRules.userId, userId)).orderBy(creditOasThresholdRules.seriesId);
}

export async function upsertCreditOasThresholdRule(input: { userId: number; seriesId: 'BAMLC0A0CM' | 'BAMLC0A1CAAA' | 'BAMLC0A2CAA' | 'BAMLC0A4CBBB' | 'BAMLH0A0HYM2'; thresholdBps: number; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const thresholdBps = Number(input.thresholdBps.toFixed(1));
  await db.insert(creditOasThresholdRules).values({ ...input, thresholdBps: String(thresholdBps) }).onDuplicateKeyUpdate({ set: { thresholdBps: String(thresholdBps), isActive: input.isActive, updatedAt: new Date() } });
  const row = (await db.select().from(creditOasThresholdRules).where(and(eq(creditOasThresholdRules.userId, input.userId), eq(creditOasThresholdRules.seriesId, input.seriesId))).limit(1))[0];
  if (!row) throw new Error('CREDIT_OAS_THRESHOLD_RULE_SAVE_FAILED');
  return row;
}

export async function deleteCreditOasThresholdRule(userId: number, ruleId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const result = await db.delete(creditOasThresholdRules).where(and(eq(creditOasThresholdRules.id, ruleId), eq(creditOasThresholdRules.userId, userId)));
  if (!Number((result as any)[0]?.affectedRows ?? (result as any).affectedRows ?? 0)) throw new Error('CREDIT_OAS_THRESHOLD_RULE_NOT_FOUND');
  return { id: ruleId, deleted: true };
}

export async function processCreditOasThresholdNotifications(observations: Array<{ id: string; label: string; observationDate: string | null; valueBps: number | null }>, targetUserId?: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rules = await db.select().from(creditOasThresholdRules).where(targetUserId ? and(eq(creditOasThresholdRules.isActive, true), eq(creditOasThresholdRules.userId, targetUserId)) : eq(creditOasThresholdRules.isActive, true));
  const emitted: Array<{ id: number; userId: number; title: string; content: string; type: 'alert' }> = [];
  for (const rule of rules) {
    const observation = observations.find((item) => item.id === rule.seriesId);
    const threshold = Number(rule.thresholdBps);
    const observationDate = observation?.observationDate;
    const observedBps = observation?.valueBps;
    if (!observation || !observationDate || observedBps === null || observedBps === undefined || !Number.isFinite(threshold) || observedBps <= threshold) continue;
    const preference = (await db.select({ marketAlerts: notificationPreferences.marketAlerts }).from(notificationPreferences).where(eq(notificationPreferences.userId, rule.userId)).limit(1))[0];
    if (preference && !preference.marketAlerts) continue;
    const notificationKey = `credit-oas:${rule.id}:${observation.id}:${observationDate}`;
    const created = await db.transaction(async (tx) => {
      const existing = await tx.select({ id: creditOasThresholdNotificationEvents.id }).from(creditOasThresholdNotificationEvents).where(eq(creditOasThresholdNotificationEvents.notificationKey, notificationKey)).limit(1);
      if (existing[0]) return null;
      await tx.insert(creditOasThresholdNotificationEvents).values({ notificationKey, userId: rule.userId, ruleId: rule.id, seriesId: observation.id, observationDate, observedBps: String(observedBps) });
      const notification = await tx.insert(notifications).values({ userId: rule.userId, title: `OAS 阈值提醒：${observation.label}`, content: `${observation.label} 在 ${observationDate} 的公开观察值为 ${observedBps.toFixed(1)} bp，超过账户设定阈值 ${threshold.toFixed(1)} bp。来源：FRED / ICE BofA Indices。`, type: 'alert', relatedType: 'credit_oas_threshold', relatedId: rule.id });
      return Number((notification as any)[0]?.insertId ?? (notification as any).insertId);
    });
    if (created) emitted.push({ id: created, userId: rule.userId, title: `OAS 阈值提醒：${observation.label}`, content: `${observation.label} 在 ${observationDate} 的公开观察值为 ${observedBps.toFixed(1)} bp，超过账户设定阈值 ${threshold.toFixed(1)} bp。来源：FRED / ICE BofA Indices。`, type: 'alert' });
  }
  return emitted;
}

function eventTypeLabel(eventType: FinancingCalendarReminderEventType) {
  return eventType === 'announcement' ? '发行公告' : eventType === 'auction' ? '拍卖' : '交收';
}

export async function revokeChecklistShare(ownerUserId: number, templateId: number, sharedWithUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = await getChecklistTemplateById(templateId);
  if (!template || template.userId !== ownerUserId) throw new Error('FORBIDDEN_TEMPLATE_SHARE');
  if (template.isPublic) throw new Error('PUBLIC_TEMPLATE_STILL_DISCOVERABLE');
  const existing = await db.select().from(checklistShares).where(and(eq(checklistShares.templateId, templateId), eq(checklistShares.sharedWithUserId, sharedWithUserId))).limit(1);
  if (!existing[0]) throw new Error('SHARE_NOT_FOUND');
  await db.delete(checklistShares).where(eq(checklistShares.id, existing[0].id));
  await appendChecklistTemplateAuditEvent({ templateId, actorUserId: ownerUserId, action: 'share_revoked', targetUserId: sharedWithUserId, note: '撤销指定账户的模板访问权限' });
  return { id: existing[0].id, revoked: true };
}

export async function listChecklistShares(ownerUserId: number, templateId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = await getChecklistTemplateById(templateId);
  if (!template || template.userId !== ownerUserId) throw new Error('FORBIDDEN_TEMPLATE_SHARE');
  return db.select({ id: checklistShares.id, templateId: checklistShares.templateId, sharedWithUserId: checklistShares.sharedWithUserId, canEdit: checklistShares.canEdit, createdAt: checklistShares.createdAt, name: users.name, role: users.role }).from(checklistShares).innerJoin(users, eq(users.id, checklistShares.sharedWithUserId)).where(eq(checklistShares.templateId, templateId)).orderBy(desc(checklistShares.createdAt));
}

export async function listChecklistMemberDirectory(userId: number, query = '', limit = 20) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const normalized = query.trim();
  const queryFilter = normalized ? or(like(users.name, `%${normalized}%`), sql`CAST(${users.id} AS CHAR) LIKE ${`%${normalized}%`}`) : undefined;
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(and(sql`${users.id} <> ${userId}`, queryFilter)).orderBy(desc(users.lastSignedIn)).limit(Math.min(Math.max(limit, 1), 30));
  return rows;
}

export async function listChecklistTemplateAuditEvents(ownerUserId: number, templateId: number, limit = 30) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const template = await getChecklistTemplateById(templateId);
  if (!template || template.userId !== ownerUserId) throw new Error('FORBIDDEN_TEMPLATE_ARCHIVE');
  return db.select().from(checklistTemplateAuditEvents).where(eq(checklistTemplateAuditEvents.templateId, templateId)).orderBy(desc(checklistTemplateAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}

export async function listChecklistTemplateReviewSignatures(templateId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select({ id: checklistTemplateAuditEvents.id, action: checklistTemplateAuditEvents.action, note: checklistTemplateAuditEvents.note, createdAt: checklistTemplateAuditEvents.createdAt, reviewerName: users.name, reviewerRole: users.role }).from(checklistTemplateAuditEvents).innerJoin(users, eq(users.id, checklistTemplateAuditEvents.actorUserId)).where(and(eq(checklistTemplateAuditEvents.templateId, templateId), or(eq(checklistTemplateAuditEvents.action, 'review_approved'), eq(checklistTemplateAuditEvents.action, 'review_changes_requested')))).orderBy(desc(checklistTemplateAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 50));
}

export async function createChecklistSnapshot(input: { userId: number; templateId: number; moduleId: string; items: string[]; completedItems: number[]; note: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const latest = await db.select().from(checklistSnapshots).where(eq(checklistSnapshots.templateId, input.templateId)).orderBy(desc(checklistSnapshots.version)).limit(1);
  const version = (latest[0]?.version ?? 0) + 1;
  const result = await db.insert(checklistSnapshots).values({ ...input, version });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Failed to save checklist snapshot');
  return { id, version };
}

export async function listChecklistSnapshots(templateId: number, moduleId: string, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select({ id: checklistSnapshots.id, userId: checklistSnapshots.userId, authorName: users.name, authorRole: users.role, templateId: checklistSnapshots.templateId, moduleId: checklistSnapshots.moduleId, items: checklistSnapshots.items, completedItems: checklistSnapshots.completedItems, note: checklistSnapshots.note, version: checklistSnapshots.version, createdAt: checklistSnapshots.createdAt }).from(checklistSnapshots).innerJoin(users, eq(users.id, checklistSnapshots.userId)).where(and(eq(checklistSnapshots.templateId, templateId), eq(checklistSnapshots.moduleId, moduleId))).orderBy(desc(checklistSnapshots.version)).limit(limit);
}

export async function getChecklistSnapshotById(snapshotId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db.select().from(checklistSnapshots).where(eq(checklistSnapshots.id, snapshotId)).limit(1);
  return rows[0] ?? null;
}

// ─── Credit research package approval and shared workpapers ──────────────────
export type CreditCollaborationPermission = 'owner' | 'editor' | 'reviewer' | 'viewer' | 'none';
export type CreditResearchPackageStatus = 'draft' | 'submitted' | 'changes_requested' | 'approved';
export type CreditWorkpaperReviewStatus = 'draft' | 'in_review' | 'approved' | 'changes_requested';

type CreditPackageContent = { title: string; researchQuestion: string; asOfDate: string | null; sourceUrl: string; note: string | null; sections: unknown; version: number };

function parseCreditAsOfDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('INVALID_CREDIT_AS_OF_DATE');
  return parsed;
}

function serializeCreditAsOfDate(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function normalizeCreditPackageContent(input: CreditPackageContent) {
  return JSON.stringify({ title: input.title.trim(), researchQuestion: input.researchQuestion.trim(), asOfDate: input.asOfDate ?? null, sourceUrl: input.sourceUrl.trim(), note: input.note?.trim() || null, sections: input.sections, version: input.version });
}

function createCreditApprovalSignature(packageId: number, signerUserId: number, action: 'submitted' | 'approved' | 'changes_requested', contentHash: string, issuedAt: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('CREDIT_SIGNATURE_UNAVAILABLE');
  return `CRS-${createHmac('sha256', secret).update(JSON.stringify({ packageId, signerUserId, action, contentHash, issuedAt })).digest('hex').slice(0, 40).toUpperCase()}`;
}

function createCreditContentHash(content: CreditPackageContent) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('CREDIT_SIGNATURE_UNAVAILABLE');
  return createHmac('sha256', secret).update(normalizeCreditPackageContent(content)).digest('hex');
}

async function getCreditResearchPackageById(packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select().from(creditResearchPackages).where(eq(creditResearchPackages.id, packageId)).limit(1);
  return rows[0] ?? null;
}

export async function getCreditResearchPackagePermission(packageId: number, userId: number): Promise<CreditCollaborationPermission> {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const packageRow = await getCreditResearchPackageById(packageId);
  if (!packageRow) return 'none';
  if (packageRow.userId === userId) return 'owner';
  const share = (await db.select().from(creditResearchPackageShares).where(and(eq(creditResearchPackageShares.packageId, packageId), eq(creditResearchPackageShares.sharedWithUserId, userId))).limit(1))[0];
  return share?.permission ?? 'none';
}

function requireCreditPermission(permission: CreditCollaborationPermission, mode: 'view' | 'edit' | 'review' | 'manage') {
  const allowed = mode === 'view' ? permission !== 'none' : mode === 'edit' ? permission === 'owner' || permission === 'editor' : mode === 'review' ? permission === 'reviewer' : permission === 'owner';
  if (!allowed) throw new Error(mode === 'manage' ? 'FORBIDDEN_CREDIT_PACKAGE_SHARE' : mode === 'review' ? 'FORBIDDEN_CREDIT_PACKAGE_REVIEW' : 'FORBIDDEN_CREDIT_PACKAGE_ACCESS');
}

async function appendCreditPackageAudit(input: { packageId: number; actorUserId: number; action: 'created' | 'updated' | 'template_applied' | 'shared' | 'share_revoked' | 'submitted' | 'approved' | 'changes_requested' | 'approval_due_set' | 'revision_created'; targetUserId?: number | null; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(creditResearchPackageAuditEvents).values({ ...input, targetUserId: input.targetUserId ?? null, note: input.note ?? null });
}

export async function listCreditResearchPackageTemplates(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(creditResearchPackageTemplates).where(eq(creditResearchPackageTemplates.userId, userId)).orderBy(desc(creditResearchPackageTemplates.updatedAt));
}

export async function saveCreditResearchPackageTemplate(userId: number, input: { templateId?: number; name: string; sections: string[]; isDefault: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (input.isDefault) await db.update(creditResearchPackageTemplates).set({ isDefault: false }).where(eq(creditResearchPackageTemplates.userId, userId));
  if (input.templateId) {
    const existing = (await db.select().from(creditResearchPackageTemplates).where(eq(creditResearchPackageTemplates.id, input.templateId)).limit(1))[0];
    if (!existing || existing.userId !== userId) throw new Error('FORBIDDEN_CREDIT_PACKAGE_TEMPLATE');
    await db.update(creditResearchPackageTemplates).set({ name: input.name.trim(), sections: input.sections, isDefault: input.isDefault, updatedAt: new Date() }).where(eq(creditResearchPackageTemplates.id, input.templateId));
    return { id: input.templateId, updated: true };
  }
  const result = await db.insert(creditResearchPackageTemplates).values({ userId, name: input.name.trim(), sections: input.sections, isDefault: input.isDefault });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('CREDIT_PACKAGE_TEMPLATE_SAVE_FAILED');
  return { id, created: true };
}

type CreditPackageDeadlineState = { deadlineState: 'not_applicable' | 'on_track' | 'due_soon' | 'overdue'; hoursUntilDue: number | null };

function getCreditPackageDeadlineState(packageRow: { status: string; approvalDueAt: Date | null; approvalReminderDays: number }): CreditPackageDeadlineState {
  if (packageRow.status !== 'submitted' || !packageRow.approvalDueAt) return { deadlineState: 'not_applicable', hoursUntilDue: null };
  const hoursUntilDue = Math.round((packageRow.approvalDueAt.getTime() - Date.now()) / 3_600_000);
  if (hoursUntilDue < 0) return { deadlineState: 'overdue', hoursUntilDue };
  if (hoursUntilDue <= Math.max(1, packageRow.approvalReminderDays) * 24) return { deadlineState: 'due_soon', hoursUntilDue };
  return { deadlineState: 'on_track', hoursUntilDue };
}

export async function listCreditResearchPackages(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const own = await db.select().from(creditResearchPackages).where(eq(creditResearchPackages.userId, userId)).orderBy(desc(creditResearchPackages.updatedAt)).limit(limit);
  const shared = await db.select({ packageRow: creditResearchPackages, permission: creditResearchPackageShares.permission, ownerName: users.name, ownerRole: users.role }).from(creditResearchPackageShares).innerJoin(creditResearchPackages, eq(creditResearchPackages.id, creditResearchPackageShares.packageId)).innerJoin(users, eq(users.id, creditResearchPackages.userId)).where(eq(creditResearchPackageShares.sharedWithUserId, userId)).orderBy(desc(creditResearchPackages.updatedAt)).limit(limit);
  return { own: own.map((item) => ({ ...item, ...getCreditPackageDeadlineState(item), permission: 'owner' as const, ownerName: null, ownerRole: null })), shared: shared.map((item) => ({ ...item.packageRow, ...getCreditPackageDeadlineState(item.packageRow), permission: item.permission, ownerName: item.ownerName, ownerRole: item.ownerRole })) };
}

export async function saveCreditResearchPackage(userId: number, input: { packageId?: number; templateId?: number | null; title: string; researchQuestion: string; asOfDate?: string | null; sourceUrl: string; note?: string | null; sections: string[]; approvalDueAt?: string | null; approvalReminderDays?: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const isDeadlineUpdate = input.approvalDueAt !== undefined;
  const approvalDueAt = input.approvalDueAt ? new Date(input.approvalDueAt) : null;
  if (approvalDueAt && (!Number.isFinite(approvalDueAt.getTime()) || approvalDueAt.getTime() <= Date.now())) throw new Error('INVALID_CREDIT_APPROVAL_DUE_AT');
  const values = { templateId: input.templateId ?? null, title: input.title.trim(), researchQuestion: input.researchQuestion.trim(), asOfDate: parseCreditAsOfDate(input.asOfDate), sourceUrl: input.sourceUrl.trim(), note: input.note?.trim() || null, sections: input.sections };
  const deadlineValues = isDeadlineUpdate ? { approvalDueAt, approvalReminderDays: input.approvalReminderDays ?? 3 } : {};
  if (input.packageId) {
    const packageRow = await getCreditResearchPackageById(input.packageId);
    if (!packageRow) throw new Error('CREDIT_PACKAGE_NOT_FOUND');
    requireCreditPermission(await getCreditResearchPackagePermission(input.packageId, userId), 'edit');
    if (packageRow.status === 'approved') throw new Error('CREDIT_PACKAGE_APPROVED_LOCKED');
    const nextVersion = packageRow.version + 1;
    await db.update(creditResearchPackages).set({ ...values, ...deadlineValues, version: nextVersion, status: 'draft', submittedAt: null, approvedAt: null, approvedByUserId: null, approvalNote: null, contentHash: null, updatedAt: new Date() }).where(eq(creditResearchPackages.id, input.packageId));
    await appendCreditPackageAudit({ packageId: input.packageId, actorUserId: userId, action: 'updated', note: `保存版本 v${nextVersion}` });
    if (approvalDueAt) await appendCreditPackageAudit({ packageId: input.packageId, actorUserId: userId, action: 'approval_due_set', note: `审批截止时间：${approvalDueAt.toISOString()}` });
    return { id: input.packageId, version: nextVersion, updated: true };
  }
  const result = await db.insert(creditResearchPackages).values({ userId, ...values, ...deadlineValues });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('CREDIT_PACKAGE_SAVE_FAILED');
  await appendCreditPackageAudit({ packageId: id, actorUserId: userId, action: 'created', note: '创建研究交付包草稿' });
  if (approvalDueAt) await appendCreditPackageAudit({ packageId: id, actorUserId: userId, action: 'approval_due_set', note: `审批截止时间：${approvalDueAt.toISOString()}` });
  return { id, version: 1, created: true };
}

async function getCreditPackageRootId(packageRow: { id: number; revisionOfPackageId: number | null }) {
  let current = packageRow; let hops = 0;
  while (current.revisionOfPackageId && hops < 32) {
    const parent = await getCreditResearchPackageById(current.revisionOfPackageId);
    if (!parent) break;
    current = parent; hops += 1;
  }
  return current.id;
}

export async function createCreditResearchPackageRevision(userId: number, approvedPackageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const parent = await getCreditResearchPackageById(approvedPackageId);
  if (!parent) throw new Error('CREDIT_PACKAGE_NOT_FOUND');
  requireCreditPermission(await getCreditResearchPackagePermission(approvedPackageId, userId), 'manage');
  if (parent.status !== 'approved') throw new Error('CREDIT_PACKAGE_REVISION_REQUIRES_APPROVAL');
  const result = await db.insert(creditResearchPackages).values({ userId, templateId: parent.templateId, title: `${parent.title} · 修订版`, researchQuestion: parent.researchQuestion, asOfDate: parent.asOfDate, sourceUrl: parent.sourceUrl, note: parent.note, sections: parent.sections, status: 'draft', version: parent.version + 1, revisionOfPackageId: parent.id, approvalReminderDays: parent.approvalReminderDays });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('CREDIT_PACKAGE_REVISION_CREATE_FAILED');
  await appendCreditPackageAudit({ packageId: parent.id, actorUserId: userId, action: 'revision_created', targetUserId: userId, note: `创建后续修订版 #${id}` });
  await appendCreditPackageAudit({ packageId: id, actorUserId: userId, action: 'created', note: `从已批准研究包 #${parent.id} 创建修订草稿` });
  return { id, revisionOfPackageId: parent.id, version: parent.version + 1 };
}

export async function compareCreditResearchPackageVersions(userId: number, input: { leftPackageId: number; rightPackageId: number }) {
  const [left, right] = await Promise.all([getCreditResearchPackageById(input.leftPackageId), getCreditResearchPackageById(input.rightPackageId)]);
  if (!left || !right) throw new Error('CREDIT_PACKAGE_NOT_FOUND');
  requireCreditPermission(await getCreditResearchPackagePermission(left.id, userId), 'view');
  requireCreditPermission(await getCreditResearchPackagePermission(right.id, userId), 'view');
  const [leftRootId, rightRootId] = await Promise.all([getCreditPackageRootId(left), getCreditPackageRootId(right)]);
  if (leftRootId !== rightRootId) throw new Error('CREDIT_PACKAGE_VERSION_NOT_LINKED');
  const changes = [
    { key: 'title', label: '研究标题', left: left.title, right: right.title },
    { key: 'researchQuestion', label: '研究问题', left: left.researchQuestion, right: right.researchQuestion },
    { key: 'asOfDate', label: '资料截止日', left: left.asOfDate ?? '', right: right.asOfDate ?? '' },
    { key: 'sourceUrl', label: '已核验来源', left: left.sourceUrl, right: right.sourceUrl },
    { key: 'note', label: '研究备注', left: left.note ?? '', right: right.note ?? '' },
    { key: 'sections', label: '章节配置', left: JSON.stringify(left.sections), right: JSON.stringify(right.sections) },
    { key: 'approvalDueAt', label: '审批截止', left: left.approvalDueAt?.toISOString() ?? '', right: right.approvalDueAt?.toISOString() ?? '' },
  ].map((field) => ({ ...field, changed: field.left !== field.right }));
  return { left, right, rootPackageId: leftRootId, changes: changes.filter((field) => field.changed), unchangedCount: changes.filter((field) => !field.changed).length };
}

export async function listCreditResearchPackageShares(ownerUserId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditResearchPackagePermission(packageId, ownerUserId), 'manage');
  return db.select({ id: creditResearchPackageShares.id, sharedWithUserId: creditResearchPackageShares.sharedWithUserId, permission: creditResearchPackageShares.permission, createdAt: creditResearchPackageShares.createdAt, name: users.name, role: users.role }).from(creditResearchPackageShares).innerJoin(users, eq(users.id, creditResearchPackageShares.sharedWithUserId)).where(eq(creditResearchPackageShares.packageId, packageId)).orderBy(desc(creditResearchPackageShares.createdAt));
}

export async function saveCreditResearchPackageShare(ownerUserId: number, input: { packageId: number; sharedWithUserId: number; permission: 'editor' | 'reviewer' | 'viewer' }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditResearchPackagePermission(input.packageId, ownerUserId), 'manage');
  if (input.sharedWithUserId === ownerUserId) throw new Error('CANNOT_SHARE_CREDIT_PACKAGE_WITH_OWNER');
  const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0];
  if (!target) throw new Error('SHARED_USER_NOT_FOUND');
  await db.insert(creditResearchPackageShares).values(input).onDuplicateKeyUpdate({ set: { permission: input.permission } });
  await appendCreditPackageAudit({ packageId: input.packageId, actorUserId: ownerUserId, action: 'shared', targetUserId: input.sharedWithUserId, note: `授予 ${input.permission} 权限` });
  return { shared: true };
}

export async function revokeCreditResearchPackageShare(ownerUserId: number, packageId: number, sharedWithUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditResearchPackagePermission(packageId, ownerUserId), 'manage');
  const row = (await db.select().from(creditResearchPackageShares).where(and(eq(creditResearchPackageShares.packageId, packageId), eq(creditResearchPackageShares.sharedWithUserId, sharedWithUserId))).limit(1))[0];
  if (!row) throw new Error('CREDIT_PACKAGE_SHARE_NOT_FOUND');
  await db.delete(creditResearchPackageShares).where(eq(creditResearchPackageShares.id, row.id));
  await appendCreditPackageAudit({ packageId, actorUserId: ownerUserId, action: 'share_revoked', targetUserId: sharedWithUserId, note: '撤销研究包访问权限' });
  return { revoked: true };
}

export async function signCreditResearchPackage(userId: number, input: { packageId: number; action: 'submitted' | 'approved' | 'changes_requested'; attestation: string; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const packageRow = await getCreditResearchPackageById(input.packageId);
  if (!packageRow) throw new Error('CREDIT_PACKAGE_NOT_FOUND');
  const permission = await getCreditResearchPackagePermission(input.packageId, userId);
  if (input.action === 'submitted') requireCreditPermission(permission, 'edit'); else requireCreditPermission(permission, 'review');
  if (input.action !== 'submitted' && packageRow.status !== 'submitted') throw new Error('CREDIT_PACKAGE_NOT_SUBMITTED');
  const contentHash = createCreditContentHash({ title: packageRow.title, researchQuestion: packageRow.researchQuestion, asOfDate: serializeCreditAsOfDate(packageRow.asOfDate), sourceUrl: packageRow.sourceUrl, note: packageRow.note, sections: packageRow.sections, version: packageRow.version });
  const issuedAt = new Date().toISOString(); const signatureCode = createCreditApprovalSignature(input.packageId, userId, input.action, contentHash, issuedAt);
  const signer = (await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1))[0];
  await db.insert(creditResearchPackageSignatures).values({ packageId: input.packageId, signerUserId: userId, signerName: signer?.name ?? null, action: input.action, attestation: input.attestation.trim(), contentHash, signatureCode });
  const action = input.action === 'submitted' ? 'submitted' : input.action === 'approved' ? 'approved' : 'changes_requested';
  const update = input.action === 'submitted' ? { status: 'submitted' as const, submittedAt: new Date(), approvedAt: null, approvedByUserId: null, approvalNote: input.note?.trim() || null, contentHash } : input.action === 'approved' ? { status: 'approved' as const, approvedAt: new Date(), approvedByUserId: userId, approvalNote: input.note?.trim() || null, contentHash } : { status: 'changes_requested' as const, approvedAt: null, approvedByUserId: null, approvalNote: input.note?.trim() || null, contentHash };
  await db.update(creditResearchPackages).set({ ...update, updatedAt: new Date() }).where(eq(creditResearchPackages.id, input.packageId));
  await appendCreditPackageAudit({ packageId: input.packageId, actorUserId: userId, action, note: input.note?.trim() || input.attestation.trim() });
  return { status: update.status, contentHash, signatureCode, signedAt: issuedAt };
}

export async function listCreditResearchPackageSignatures(userId: number, packageId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditResearchPackagePermission(packageId, userId), 'view');
  return db.select().from(creditResearchPackageSignatures).where(eq(creditResearchPackageSignatures.packageId, packageId)).orderBy(desc(creditResearchPackageSignatures.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}

export async function listCreditResearchPackageAudit(userId: number, packageId: number, limit = 80) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditResearchPackagePermission(packageId, userId), 'view');
  return db.select().from(creditResearchPackageAuditEvents).where(eq(creditResearchPackageAuditEvents.packageId, packageId)).orderBy(desc(creditResearchPackageAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 120));
}

async function getCreditWorkpaperById(workpaperId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return (await db.select().from(creditSharedWorkpapers).where(eq(creditSharedWorkpapers.id, workpaperId)).limit(1))[0] ?? null;
}

export async function getCreditWorkpaperPermission(workpaperId: number, userId: number): Promise<CreditCollaborationPermission> {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const workpaper = await getCreditWorkpaperById(workpaperId);
  if (!workpaper) return 'none';
  if (workpaper.userId === userId) return 'owner';
  const share = (await db.select().from(creditSharedWorkpaperShares).where(and(eq(creditSharedWorkpaperShares.workpaperId, workpaperId), eq(creditSharedWorkpaperShares.sharedWithUserId, userId))).limit(1))[0];
  return share?.permission ?? 'none';
}

async function appendCreditWorkpaperAudit(input: { workpaperId: number; actorUserId: number; action: 'created' | 'updated' | 'shared' | 'share_revoked' | 'submitted_for_review' | 'approved' | 'changes_requested'; targetUserId?: number | null; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(creditSharedWorkpaperAuditEvents).values({ ...input, targetUserId: input.targetUserId ?? null, note: input.note ?? null });
}

export async function listCreditSharedWorkpapers(userId: number, moduleId?: string) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const ownWhere = moduleId ? and(eq(creditSharedWorkpapers.userId, userId), eq(creditSharedWorkpapers.moduleId, moduleId)) : eq(creditSharedWorkpapers.userId, userId);
  const own = await db.select().from(creditSharedWorkpapers).where(ownWhere).orderBy(desc(creditSharedWorkpapers.updatedAt));
  const sharedWhere = moduleId ? and(eq(creditSharedWorkpaperShares.sharedWithUserId, userId), eq(creditSharedWorkpapers.moduleId, moduleId)) : eq(creditSharedWorkpaperShares.sharedWithUserId, userId);
  const shared = await db.select({ workpaper: creditSharedWorkpapers, permission: creditSharedWorkpaperShares.permission, ownerName: users.name }).from(creditSharedWorkpaperShares).innerJoin(creditSharedWorkpapers, eq(creditSharedWorkpapers.id, creditSharedWorkpaperShares.workpaperId)).innerJoin(users, eq(users.id, creditSharedWorkpapers.userId)).where(sharedWhere).orderBy(desc(creditSharedWorkpapers.updatedAt));
  return { own: own.map((row) => ({ ...row, permission: 'owner' as const, ownerName: null })), shared: shared.map((row) => ({ ...row.workpaper, permission: row.permission, ownerName: row.ownerName })) };
}

export async function saveCreditSharedWorkpaper(userId: number, input: { workpaperId?: number; moduleId: string; name: string; payload: unknown }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (input.workpaperId) {
    const workpaper = await getCreditWorkpaperById(input.workpaperId);
    if (!workpaper) throw new Error('CREDIT_WORKPAPER_NOT_FOUND');
    requireCreditPermission(await getCreditWorkpaperPermission(input.workpaperId, userId), 'edit');
    const version = workpaper.version + 1;
    await db.update(creditSharedWorkpapers).set({ name: input.name.trim(), payload: input.payload, version, reviewStatus: 'draft', reviewedByUserId: null, reviewNote: null, reviewedAt: null, updatedAt: new Date() }).where(eq(creditSharedWorkpapers.id, input.workpaperId));
    await appendCreditWorkpaperAudit({ workpaperId: input.workpaperId, actorUserId: userId, action: 'updated', note: `保存版本 v${version}` });
    return { id: input.workpaperId, version, updated: true };
  }
  const result = await db.insert(creditSharedWorkpapers).values({ userId, moduleId: input.moduleId, name: input.name.trim(), payload: input.payload });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('CREDIT_WORKPAPER_SAVE_FAILED');
  await appendCreditWorkpaperAudit({ workpaperId: id, actorUserId: userId, action: 'created', note: '创建账户级信用研究工作底稿' });
  return { id, version: 1, created: true };
}

export async function saveCreditWorkpaperShare(ownerUserId: number, input: { workpaperId: number; sharedWithUserId: number; permission: 'editor' | 'reviewer' | 'viewer' }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditWorkpaperPermission(input.workpaperId, ownerUserId), 'manage');
  if (input.sharedWithUserId === ownerUserId) throw new Error('CANNOT_SHARE_CREDIT_WORKPAPER_WITH_OWNER');
  const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0];
  if (!target) throw new Error('SHARED_USER_NOT_FOUND');
  await db.insert(creditSharedWorkpaperShares).values(input).onDuplicateKeyUpdate({ set: { permission: input.permission } });
  await appendCreditWorkpaperAudit({ workpaperId: input.workpaperId, actorUserId: ownerUserId, action: 'shared', targetUserId: input.sharedWithUserId, note: `授予 ${input.permission} 权限` });
  return { shared: true };
}

export async function revokeCreditWorkpaperShare(ownerUserId: number, workpaperId: number, sharedWithUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditWorkpaperPermission(workpaperId, ownerUserId), 'manage');
  const share = (await db.select().from(creditSharedWorkpaperShares).where(and(eq(creditSharedWorkpaperShares.workpaperId, workpaperId), eq(creditSharedWorkpaperShares.sharedWithUserId, sharedWithUserId))).limit(1))[0];
  if (!share) throw new Error('CREDIT_WORKPAPER_SHARE_NOT_FOUND');
  await db.delete(creditSharedWorkpaperShares).where(eq(creditSharedWorkpaperShares.id, share.id));
  await appendCreditWorkpaperAudit({ workpaperId, actorUserId: ownerUserId, action: 'share_revoked', targetUserId: sharedWithUserId, note: '撤销工作底稿访问权限' });
  return { revoked: true };
}

export async function listCreditWorkpaperShares(ownerUserId: number, workpaperId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditWorkpaperPermission(workpaperId, ownerUserId), 'manage');
  return db.select({ id: creditSharedWorkpaperShares.id, sharedWithUserId: creditSharedWorkpaperShares.sharedWithUserId, permission: creditSharedWorkpaperShares.permission, createdAt: creditSharedWorkpaperShares.createdAt, name: users.name, role: users.role }).from(creditSharedWorkpaperShares).innerJoin(users, eq(users.id, creditSharedWorkpaperShares.sharedWithUserId)).where(eq(creditSharedWorkpaperShares.workpaperId, workpaperId)).orderBy(desc(creditSharedWorkpaperShares.createdAt));
}

export async function reviewCreditSharedWorkpaper(userId: number, input: { workpaperId: number; decision: 'approved' | 'changes_requested'; reviewNote: string }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const workpaper = await getCreditWorkpaperById(input.workpaperId);
  if (!workpaper) throw new Error('CREDIT_WORKPAPER_NOT_FOUND');
  requireCreditPermission(await getCreditWorkpaperPermission(input.workpaperId, userId), 'review');
  const reviewStatus = input.decision === 'approved' ? 'approved' as const : 'changes_requested' as const;
  await db.update(creditSharedWorkpapers).set({ reviewStatus, reviewedByUserId: userId, reviewNote: input.reviewNote.trim(), reviewedAt: new Date(), updatedAt: new Date() }).where(eq(creditSharedWorkpapers.id, input.workpaperId));
  await appendCreditWorkpaperAudit({ workpaperId: input.workpaperId, actorUserId: userId, action: input.decision, note: input.reviewNote.trim() });
  return { reviewStatus };
}

export async function submitCreditSharedWorkpaper(userId: number, workpaperId: number, note: string) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditWorkpaperPermission(workpaperId, userId), 'edit');
  await db.update(creditSharedWorkpapers).set({ reviewStatus: 'in_review', reviewNote: note.trim() || null, reviewedByUserId: null, reviewedAt: null, updatedAt: new Date() }).where(eq(creditSharedWorkpapers.id, workpaperId));
  await appendCreditWorkpaperAudit({ workpaperId, actorUserId: userId, action: 'submitted_for_review', note: note.trim() || '提交团队审阅' });
  return { reviewStatus: 'in_review' as const };
}

export async function listCreditWorkpaperAudit(userId: number, workpaperId: number, limit = 80) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireCreditPermission(await getCreditWorkpaperPermission(workpaperId, userId), 'view');
  return db.select().from(creditSharedWorkpaperAuditEvents).where(eq(creditSharedWorkpaperAuditEvents.workpaperId, workpaperId)).orderBy(desc(creditSharedWorkpaperAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 120));
}

const CREDIT_GOVERNANCE_MODULES = [
  { moduleId: '17', label: '库存可得性' },
  { moduleId: '18', label: '研究运行' },
  { moduleId: '21', label: '衍生品权限' },
  { moduleId: '22', label: '风险证据' },
] as const;

function countGovernancePayloadRecords(payload: unknown) {
  if (!payload || typeof payload !== 'object') return 0;
  const records = (payload as { records?: unknown }).records;
  return Array.isArray(records) ? records.length : 0;
}

/** 仅供管理员读取：汇总账户级信用治理台账的使用、共享、审阅和更新时效；不读取或导出记录正文。 */
export async function getCreditGovernanceAdminAudit() {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const moduleIds = CREDIT_GOVERNANCE_MODULES.map((item) => item.moduleId);
  const workpapers = await db.select().from(creditSharedWorkpapers).where(inArray(creditSharedWorkpapers.moduleId, moduleIds));
  const ids = workpapers.map((item) => item.id);
  const [shares, events] = ids.length ? await Promise.all([
    db.select().from(creditSharedWorkpaperShares).where(inArray(creditSharedWorkpaperShares.workpaperId, ids)),
    db.select().from(creditSharedWorkpaperAuditEvents).where(inArray(creditSharedWorkpaperAuditEvents.workpaperId, ids)).orderBy(desc(creditSharedWorkpaperAuditEvents.createdAt)).limit(200),
  ]) : [[], []] as const;
  const now = Date.now(); const staleAfterMs = 30 * 86_400_000;
  const modules = CREDIT_GOVERNANCE_MODULES.map((definition) => {
    const rows = workpapers.filter((item) => item.moduleId === definition.moduleId);
    const rowIds = new Set(rows.map((item) => item.id));
    const latest = rows.reduce<Date | null>((current, item) => !current || item.updatedAt > current ? item.updatedAt : current, null);
    return {
      ...definition,
      workpaperCount: rows.length,
      recordCount: rows.reduce((sum, item) => sum + countGovernancePayloadRecords(item.payload), 0),
      shareCount: shares.filter((share) => rowIds.has(share.workpaperId)).length,
      inReviewCount: rows.filter((item) => item.reviewStatus === 'in_review').length,
      changesRequestedCount: rows.filter((item) => item.reviewStatus === 'changes_requested').length,
      staleCount: rows.filter((item) => now - item.updatedAt.getTime() > staleAfterMs).length,
      latestUpdatedAt: latest,
    };
  });
  return {
    generatedAt: new Date(),
    staleAfterDays: 30,
    totals: {
      workpapers: workpapers.length,
      records: workpapers.reduce((sum, item) => sum + countGovernancePayloadRecords(item.payload), 0),
      shares: shares.length,
      inReview: workpapers.filter((item) => item.reviewStatus === 'in_review').length,
      stale: workpapers.filter((item) => now - item.updatedAt.getTime() > staleAfterMs).length,
    },
    modules,
    recentEvents: events.slice(0, 80),
  };
}

// ─── Mortgage account-level ledger collaboration ───────────────────────────
// 浏览器本机台账只能由所有者明确提交为账户对象；之后的读写、审阅、共享和导出均在服务器端校验。
export type MortgageLedgerPermission = 'owner' | 'editor' | 'reviewer' | 'viewer' | 'none';
export type MortgageLedgerReviewStatus = 'draft' | 'in_review' | 'approved' | 'changes_requested';
type MortgageLedgerAuditAction = 'created' | 'updated' | 'local_migrated' | 'shared' | 'share_revoked' | 'submitted_for_review' | 'approved' | 'changes_requested' | 'exported';

async function getMortgageLedgerById(ledgerId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return (await db.select().from(mortgageSharedLedgers).where(eq(mortgageSharedLedgers.id, ledgerId)).limit(1))[0] ?? null;
}

export async function getMortgageLedgerPermission(ledgerId: number, userId: number): Promise<MortgageLedgerPermission> {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const ledger = await getMortgageLedgerById(ledgerId);
  if (!ledger) return 'none';
  if (ledger.userId === userId) return 'owner';
  const share = (await db.select().from(mortgageSharedLedgerShares).where(and(eq(mortgageSharedLedgerShares.ledgerId, ledgerId), eq(mortgageSharedLedgerShares.sharedWithUserId, userId))).limit(1))[0];
  return share?.permission ?? 'none';
}

function requireMortgageLedgerPermission(permission: MortgageLedgerPermission, mode: 'view' | 'edit' | 'review' | 'manage' | 'export') {
  const allowed = mode === 'view'
    ? permission !== 'none'
    : mode === 'edit'
      ? permission === 'owner' || permission === 'editor'
      : mode === 'review'
        ? permission === 'reviewer'
        : mode === 'manage'
          ? permission === 'owner'
          : permission === 'owner' || permission === 'editor' || permission === 'reviewer';
  if (!allowed) throw new Error(mode === 'manage' ? 'FORBIDDEN_MORTGAGE_LEDGER_SHARE' : mode === 'review' ? 'FORBIDDEN_MORTGAGE_LEDGER_REVIEW' : mode === 'export' ? 'FORBIDDEN_MORTGAGE_LEDGER_EXPORT' : 'FORBIDDEN_MORTGAGE_LEDGER_ACCESS');
}

async function appendMortgageLedgerAudit(input: { ledgerId: number; actorUserId: number; action: MortgageLedgerAuditAction; targetUserId?: number | null; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(mortgageSharedLedgerAuditEvents).values({ ...input, targetUserId: input.targetUserId ?? null, note: input.note ?? null });
}

export async function listMortgageSharedLedgers(userId: number, moduleId?: string) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const ownWhere = moduleId ? and(eq(mortgageSharedLedgers.userId, userId), eq(mortgageSharedLedgers.moduleId, moduleId)) : eq(mortgageSharedLedgers.userId, userId);
  const own = await db.select().from(mortgageSharedLedgers).where(ownWhere).orderBy(desc(mortgageSharedLedgers.updatedAt));
  const sharedWhere = moduleId ? and(eq(mortgageSharedLedgerShares.sharedWithUserId, userId), eq(mortgageSharedLedgers.moduleId, moduleId)) : eq(mortgageSharedLedgerShares.sharedWithUserId, userId);
  const shared = await db.select({ ledger: mortgageSharedLedgers, permission: mortgageSharedLedgerShares.permission, ownerName: users.name }).from(mortgageSharedLedgerShares).innerJoin(mortgageSharedLedgers, eq(mortgageSharedLedgers.id, mortgageSharedLedgerShares.ledgerId)).innerJoin(users, eq(users.id, mortgageSharedLedgers.userId)).where(sharedWhere).orderBy(desc(mortgageSharedLedgers.updatedAt));
  return { own: own.map((ledger) => ({ ...ledger, permission: 'owner' as const, ownerName: null })), shared: shared.map((item) => ({ ...item.ledger, permission: item.permission, ownerName: item.ownerName })) };
}

export async function saveMortgageSharedLedger(userId: number, input: { ledgerId?: number; moduleId: string; localStorageKey?: string | null; name: string; payload: unknown; isLocalMigration?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  if (input.ledgerId) {
    const ledger = await getMortgageLedgerById(input.ledgerId);
    if (!ledger) throw new Error('MORTGAGE_LEDGER_NOT_FOUND');
    requireMortgageLedgerPermission(await getMortgageLedgerPermission(input.ledgerId, userId), 'edit');
    const version = ledger.version + 1;
    await db.update(mortgageSharedLedgers).set({ name: input.name.trim(), payload: input.payload, version, reviewStatus: 'draft', reviewedByUserId: null, reviewNote: null, reviewedAt: null, updatedAt: new Date() }).where(eq(mortgageSharedLedgers.id, input.ledgerId));
    await appendMortgageLedgerAudit({ ledgerId: input.ledgerId, actorUserId: userId, action: 'updated', note: `保存版本 v${version}` });
    return { id: input.ledgerId, version, updated: true };
  }
  const result = await db.insert(mortgageSharedLedgers).values({ userId, moduleId: input.moduleId, localStorageKey: input.localStorageKey ?? null, name: input.name.trim(), payload: input.payload });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('MORTGAGE_LEDGER_SAVE_FAILED');
  await appendMortgageLedgerAudit({ ledgerId: id, actorUserId: userId, action: input.isLocalMigration ? 'local_migrated' : 'created', note: input.isLocalMigration ? '从浏览器本机记录受控迁移到账户级台账' : '创建账户级抵押债台账' });
  return { id, version: 1, created: true };
}

export async function saveMortgageLedgerShare(ownerUserId: number, input: { ledgerId: number; sharedWithUserId: number; permission: 'editor' | 'reviewer' | 'viewer' }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageLedgerPermission(await getMortgageLedgerPermission(input.ledgerId, ownerUserId), 'manage');
  if (input.sharedWithUserId === ownerUserId) throw new Error('CANNOT_SHARE_MORTGAGE_LEDGER_WITH_OWNER');
  const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0];
  if (!target) throw new Error('SHARED_USER_NOT_FOUND');
  await db.insert(mortgageSharedLedgerShares).values(input).onDuplicateKeyUpdate({ set: { permission: input.permission } });
  await appendMortgageLedgerAudit({ ledgerId: input.ledgerId, actorUserId: ownerUserId, action: 'shared', targetUserId: input.sharedWithUserId, note: `授予 ${input.permission} 权限` });
  return { shared: true };
}

export async function revokeMortgageLedgerShare(ownerUserId: number, ledgerId: number, sharedWithUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageLedgerPermission(await getMortgageLedgerPermission(ledgerId, ownerUserId), 'manage');
  const share = (await db.select().from(mortgageSharedLedgerShares).where(and(eq(mortgageSharedLedgerShares.ledgerId, ledgerId), eq(mortgageSharedLedgerShares.sharedWithUserId, sharedWithUserId))).limit(1))[0];
  if (!share) throw new Error('MORTGAGE_LEDGER_SHARE_NOT_FOUND');
  await db.delete(mortgageSharedLedgerShares).where(eq(mortgageSharedLedgerShares.id, share.id));
  await appendMortgageLedgerAudit({ ledgerId, actorUserId: ownerUserId, action: 'share_revoked', targetUserId: sharedWithUserId, note: '撤销抵押债台账访问权限' });
  return { revoked: true };
}

export async function listMortgageLedgerShares(ownerUserId: number, ledgerId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageLedgerPermission(await getMortgageLedgerPermission(ledgerId, ownerUserId), 'manage');
  return db.select({ id: mortgageSharedLedgerShares.id, sharedWithUserId: mortgageSharedLedgerShares.sharedWithUserId, permission: mortgageSharedLedgerShares.permission, createdAt: mortgageSharedLedgerShares.createdAt, name: users.name, role: users.role }).from(mortgageSharedLedgerShares).innerJoin(users, eq(users.id, mortgageSharedLedgerShares.sharedWithUserId)).where(eq(mortgageSharedLedgerShares.ledgerId, ledgerId)).orderBy(desc(mortgageSharedLedgerShares.createdAt));
}

export async function submitMortgageSharedLedger(userId: number, ledgerId: number, note: string) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageLedgerPermission(await getMortgageLedgerPermission(ledgerId, userId), 'edit');
  await db.update(mortgageSharedLedgers).set({ reviewStatus: 'in_review', reviewNote: note.trim() || null, reviewedByUserId: null, reviewedAt: null, updatedAt: new Date() }).where(eq(mortgageSharedLedgers.id, ledgerId));
  await appendMortgageLedgerAudit({ ledgerId, actorUserId: userId, action: 'submitted_for_review', note: note.trim() || '提交团队审阅' });
  return { reviewStatus: 'in_review' as const };
}

export async function reviewMortgageSharedLedger(userId: number, input: { ledgerId: number; decision: 'approved' | 'changes_requested'; reviewNote: string }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const ledger = await getMortgageLedgerById(input.ledgerId);
  if (!ledger) throw new Error('MORTGAGE_LEDGER_NOT_FOUND');
  requireMortgageLedgerPermission(await getMortgageLedgerPermission(input.ledgerId, userId), 'review');
  const reviewStatus = input.decision === 'approved' ? 'approved' as const : 'changes_requested' as const;
  await db.update(mortgageSharedLedgers).set({ reviewStatus, reviewedByUserId: userId, reviewNote: input.reviewNote.trim(), reviewedAt: new Date(), updatedAt: new Date() }).where(eq(mortgageSharedLedgers.id, input.ledgerId));
  await appendMortgageLedgerAudit({ ledgerId: input.ledgerId, actorUserId: userId, action: input.decision, note: input.reviewNote.trim() });
  return { reviewStatus };
}

export async function listMortgageLedgerAudit(userId: number, ledgerId: number, limit = 80) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageLedgerPermission(await getMortgageLedgerPermission(ledgerId, userId), 'view');
  return db.select().from(mortgageSharedLedgerAuditEvents).where(eq(mortgageSharedLedgerAuditEvents.ledgerId, ledgerId)).orderBy(desc(mortgageSharedLedgerAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 120));
}

export async function recordMortgageLedgerExport(userId: number, ledgerId: number, format: 'csv') {
  const ledger = await getMortgageLedgerById(ledgerId);
  if (!ledger) throw new Error('MORTGAGE_LEDGER_NOT_FOUND');
  requireMortgageLedgerPermission(await getMortgageLedgerPermission(ledgerId, userId), 'export');
  await appendMortgageLedgerAudit({ ledgerId, actorUserId: userId, action: 'exported', note: `导出 ${format.toUpperCase()} 台账快照（客户端生成）` });
  return { authorized: true, name: ledger.name, version: ledger.version };
}

const MORTGAGE_GOVERNANCE_MODULES = [
  { moduleId: '1', label: '字段字典' },
  { moduleId: '3', label: '贷款池筛选' },
  { moduleId: '5', label: '发行与公告' },
  { moduleId: '7', label: '数据可得性' },
  { moduleId: '11', label: '担保品观察' },
  { moduleId: '13', label: '研究证据' },
  { moduleId: '15', label: '结构融资管道' },
  { moduleId: '20', label: '报价授权' },
  { moduleId: '21', label: '地域暴露' },
  { moduleId: '22', label: '指数治理' },
  { moduleId: '23', label: 'TBA 观察' },
  { moduleId: '26', label: '交易后表现' },
] as const;

function countMortgageGovernancePayloadRecords(payload: unknown) {
  if (!payload || typeof payload !== 'object') return 0;
  const records = (payload as { records?: unknown }).records;
  return Array.isArray(records) ? records.length : 0;
}

/** 仅供管理员读取：跨抵押债模块汇总台账数量、协作授权、审阅积压与更新时效；不读取或导出记录正文。 */
export async function getMortgageGovernanceAdminAudit() {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const moduleIds = MORTGAGE_GOVERNANCE_MODULES.map((item) => item.moduleId);
  const ledgers = await db.select().from(mortgageSharedLedgers).where(inArray(mortgageSharedLedgers.moduleId, moduleIds));
  const ids = ledgers.map((item) => item.id);
  const shares = ids.length ? await db.select().from(mortgageSharedLedgerShares).where(inArray(mortgageSharedLedgerShares.ledgerId, ids)) : [];
  const now = Date.now(); const staleAfterMs = 30 * 86_400_000;
  const modules = MORTGAGE_GOVERNANCE_MODULES.map((definition) => {
    const rows = ledgers.filter((item) => item.moduleId === definition.moduleId);
    const rowIds = new Set(rows.map((item) => item.id));
    const latestUpdatedAt = rows.reduce<Date | null>((current, item) => !current || item.updatedAt > current ? item.updatedAt : current, null);
    const dueSoon = rows.filter((item) => item.reviewStatus === 'in_review' && item.reviewDueAt && item.reviewDueAt.getTime() >= now && item.reviewDueAt.getTime() - now <= (item.reviewReminderHours ?? 24) * 3_600_000).length;
    const overdue = rows.filter((item) => item.reviewStatus === 'in_review' && item.reviewDueAt && item.reviewDueAt.getTime() < now).length;
    return {
      ...definition,
      ledgerCount: rows.length,
      recordCount: rows.reduce((sum, item) => sum + countMortgageGovernancePayloadRecords(item.payload), 0),
      shareCount: shares.filter((share) => rowIds.has(share.ledgerId)).length,
      inReviewCount: rows.filter((item) => item.reviewStatus === 'in_review').length,
      changesRequestedCount: rows.filter((item) => item.reviewStatus === 'changes_requested').length,
      dueSoonCount: dueSoon,
      overdueCount: overdue,
      staleCount: rows.filter((item) => now - item.updatedAt.getTime() > staleAfterMs).length,
      latestUpdatedAt,
    };
  });
  return {
    generatedAt: new Date(),
    staleAfterDays: 30,
    totals: {
      ledgers: ledgers.length,
      records: ledgers.reduce((sum, item) => sum + countMortgageGovernancePayloadRecords(item.payload), 0),
      shares: shares.length,
      inReview: ledgers.filter((item) => item.reviewStatus === 'in_review').length,
      dueSoon: modules.reduce((sum, item) => sum + item.dueSoonCount, 0),
      overdue: modules.reduce((sum, item) => sum + item.overdueCount, 0),
      stale: ledgers.filter((item) => now - item.updatedAt.getTime() > staleAfterMs).length,
    },
    modules,
  };
}

export type Mbs21FhfaGeographicExposureRow = {
  region: string;
  exposureWeightPct: number;
  hpiChangePct?: number | null;
  observationDate: string;
  sourceUrl: string;
  sourceLabel?: string;
};

export function validateMbs21FhfaGeographicExposureRows(rows: Mbs21FhfaGeographicExposureRow[]) {
  const errors: string[] = []; const validRows: Mbs21FhfaGeographicExposureRow[] = []; const unique = new Set<string>();
  rows.forEach((candidate, index) => {
    const row = index + 2; const region = candidate.region?.trim(); const sourceUrl = candidate.sourceUrl?.trim(); const observationDate = candidate.observationDate?.trim();
    if (!region || region.length > 120) { errors.push(`第 ${row} 行：地区/都会区不能为空且不得超过 120 字符。`); return; }
    if (!Number.isFinite(candidate.exposureWeightPct) || candidate.exposureWeightPct < 0 || candidate.exposureWeightPct > 100) { errors.push(`第 ${row} 行：暴露权重必须为 0–100 的数字。`); return; }
    if (candidate.hpiChangePct != null && (!Number.isFinite(candidate.hpiChangePct) || candidate.hpiChangePct < -100 || candidate.hpiChangePct > 100)) { errors.push(`第 ${row} 行：FHFA HPI 变化必须为 -100–100 的数字或留空。`); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observationDate) || Number.isNaN(new Date(`${observationDate}T00:00:00Z`).getTime())) { errors.push(`第 ${row} 行：观察日必须为 YYYY-MM-DD。`); return; }
    let url: URL;
    try { url = new URL(sourceUrl); } catch { errors.push(`第 ${row} 行：来源 URL 无法解析。`); return; }
    if (url.protocol !== 'https:' || !(url.hostname === 'fhfa.gov' || url.hostname.endsWith('.fhfa.gov'))) { errors.push(`第 ${row} 行：来源必须是 HTTPS FHFA 官方域名。`); return; }
    const key = `${region.toLocaleLowerCase('en-US')}|${observationDate}`;
    if (unique.has(key)) { errors.push(`第 ${row} 行：地区与观察日重复。`); return; }
    unique.add(key);
    validRows.push({ region, exposureWeightPct: candidate.exposureWeightPct, hpiChangePct: candidate.hpiChangePct ?? null, observationDate, sourceUrl, sourceLabel: candidate.sourceLabel?.trim().slice(0, 120) || 'FHFA House Price Index 数据集' });
  });
  const total = validRows.reduce((sum, row) => sum + row.exposureWeightPct, 0);
  if (!errors.length && total > 100.0001) errors.push(`暴露权重合计为 ${total.toFixed(4)}%，不得超过 100%。`);
  return { validRows, errors };
}

function parseMbs21LedgerRecords(payload: unknown) {
  if (!payload || typeof payload !== 'object') return [] as Array<Record<string, unknown>>;
  const candidate = payload as { moduleId?: unknown; records?: unknown };
  return candidate.moduleId === '21' && Array.isArray(candidate.records) ? candidate.records.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
}

/** 导入仅保存经验证的行、来源链接和导入时点；不保存原始 CSV 文件字节。 */
export async function importMbs21FhfaGeographicExposureCsv(userId: number, input: { ledgerId?: number; name: string; rows: Mbs21FhfaGeographicExposureRow[] }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const validation = validateMbs21FhfaGeographicExposureRows(input.rows);
  if (validation.errors.length) throw new Error(`MBS21_CSV_VALIDATION:${validation.errors.slice(0, 3).join(' ')}`);
  const importedAt = new Date();
  const importedRecords = validation.validRows.map((row, index) => ({
    id: `fhfa-${importedAt.getTime()}-${index}`,
    identifier: row.region,
    status: '待审阅',
    observedAt: row.observationDate,
    sourceUrl: row.sourceUrl,
    detail: `地域暴露 ${row.exposureWeightPct.toFixed(4)}% · FHFA HPI 变化 ${row.hpiChangePct == null ? '未提供' : `${row.hpiChangePct.toFixed(4)}%`} · ${row.sourceLabel}`,
    raw: { importKind: 'FHFA geographic exposure CSV', importedAt: importedAt.toISOString(), ...row },
  }));
  if (input.ledgerId) {
    const ledger = await getMortgageLedgerById(input.ledgerId);
    if (!ledger) throw new Error('MORTGAGE_LEDGER_NOT_FOUND');
    if (ledger.moduleId !== '21') throw new Error('MBS21_IMPORT_REQUIRES_GEOGRAPHIC_LEDGER');
    requireMortgageLedgerPermission(await getMortgageLedgerPermission(input.ledgerId, userId), 'edit');
    const version = ledger.version + 1;
    const payload = { schemaVersion: 1, moduleId: '21', localStorageKey: ledger.localStorageKey || 'mbs-cmbs-geo-v1', records: [...parseMbs21LedgerRecords(ledger.payload), ...importedRecords] };
    await db.update(mortgageSharedLedgers).set({ name: input.name.trim(), payload, version, reviewStatus: 'draft', reviewedByUserId: null, reviewNote: null, reviewedAt: null, updatedAt: importedAt }).where(eq(mortgageSharedLedgers.id, input.ledgerId));
    await appendMortgageLedgerAudit({ ledgerId: input.ledgerId, actorUserId: userId, action: 'updated', note: `FHFA 地理暴露 CSV 导入 ${importedRecords.length} 行；仅保存验证行、来源链接和导入时点。` });
    return { id: input.ledgerId, version, updated: true, imported: importedRecords.length, records: importedRecords };
  }
  const payload = { schemaVersion: 1, moduleId: '21', localStorageKey: 'mbs-cmbs-geo-v1', records: importedRecords };
  const result = await db.insert(mortgageSharedLedgers).values({ userId, moduleId: '21', localStorageKey: 'mbs-cmbs-geo-v1', name: input.name.trim(), payload });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('MORTGAGE_LEDGER_SAVE_FAILED');
  await appendMortgageLedgerAudit({ ledgerId: id, actorUserId: userId, action: 'created', note: `创建账户级地域暴露台账并导入 FHFA CSV ${importedRecords.length} 行；未保存原始文件。` });
  return { id, version: 1, created: true, imported: importedRecords.length, records: importedRecords };
}

// ─── Mortgage taxonomy tags, saved grid views & review notifications ──────────
export type MortgageTaxonomyTagPermission = 'owner' | 'editor' | 'viewer' | 'none';
export type MortgageLedgerViewConfig = { query?: string; statuses?: string[]; sourceOnly?: boolean; sort?: Array<{ key: 'identifier' | 'status' | 'observedAt' | 'sourceUrl'; direction: 'asc' | 'desc' }>; visibleColumns?: string[] };

async function getMortgageTaxonomyTagPermission(tagId: number, userId: number): Promise<MortgageTaxonomyTagPermission> {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const tag = (await db.select().from(mortgageTaxonomyTags).where(eq(mortgageTaxonomyTags.id, tagId)).limit(1))[0];
  if (!tag) return 'none';
  if (tag.userId === userId) return 'owner';
  const share = (await db.select().from(mortgageTaxonomyTagShares).where(and(eq(mortgageTaxonomyTagShares.tagId, tagId), eq(mortgageTaxonomyTagShares.sharedWithUserId, userId))).limit(1))[0];
  return share ? (share.canEdit ? 'editor' : 'viewer') : 'none';
}

function requireMortgageTaxonomyTagPermission(permission: MortgageTaxonomyTagPermission, mode: 'view' | 'edit' | 'manage') {
  const allowed = mode === 'view' ? permission !== 'none' : mode === 'edit' ? permission === 'owner' || permission === 'editor' : permission === 'owner';
  if (!allowed) throw new Error(mode === 'manage' ? 'FORBIDDEN_MORTGAGE_TAG_MANAGE' : mode === 'edit' ? 'FORBIDDEN_MORTGAGE_TAG_EDIT' : 'FORBIDDEN_MORTGAGE_TAG_VIEW');
}

export async function listMortgageTaxonomyTags(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const own = await db.select().from(mortgageTaxonomyTags).where(eq(mortgageTaxonomyTags.userId, userId)).orderBy(desc(mortgageTaxonomyTags.updatedAt));
  const shared = await db.select({ tag: mortgageTaxonomyTags, canEdit: mortgageTaxonomyTagShares.canEdit, ownerName: users.name }).from(mortgageTaxonomyTagShares).innerJoin(mortgageTaxonomyTags, eq(mortgageTaxonomyTags.id, mortgageTaxonomyTagShares.tagId)).innerJoin(users, eq(users.id, mortgageTaxonomyTags.userId)).where(eq(mortgageTaxonomyTagShares.sharedWithUserId, userId)).orderBy(desc(mortgageTaxonomyTags.updatedAt));
  const all = [...own.map((tag) => ({ ...tag, permission: 'owner' as const, ownerName: null })), ...shared.map((row) => ({ ...row.tag, permission: row.canEdit ? 'editor' as const : 'viewer' as const, ownerName: row.ownerName }))];
  const assignments = all.length ? await db.select().from(mortgageTaxonomyTagAssignments).where(inArray(mortgageTaxonomyTagAssignments.tagId, all.map((tag) => tag.id))) : [];
  return all.map((tag) => ({ ...tag, categories: assignments.filter((assignment) => assignment.tagId === tag.id).map((assignment) => assignment.categoryKey) }));
}

export async function saveMortgageTaxonomyTag(userId: number, input: { tagId?: number; name: string; color: string }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const name = input.name.trim();
  if (!name) throw new Error('MORTGAGE_TAG_NAME_REQUIRED');
  if (input.tagId) {
    requireMortgageTaxonomyTagPermission(await getMortgageTaxonomyTagPermission(input.tagId, userId), 'edit');
    await db.update(mortgageTaxonomyTags).set({ name, color: input.color, updatedAt: new Date() }).where(eq(mortgageTaxonomyTags.id, input.tagId));
    return { id: input.tagId, updated: true };
  }
  const result = await db.insert(mortgageTaxonomyTags).values({ userId, name, color: input.color });
  const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('MORTGAGE_TAG_SAVE_FAILED');
  return { id, created: true };
}

export async function setMortgageTaxonomyTagAssignments(userId: number, input: { tagId: number; categoryKeys: string[] }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageTaxonomyTagPermission(await getMortgageTaxonomyTagPermission(input.tagId, userId), 'edit');
  const categoryKeys = [...new Set(input.categoryKeys.map((key) => key.trim()).filter(Boolean))].slice(0, 24);
  await db.transaction(async (tx) => {
    await tx.delete(mortgageTaxonomyTagAssignments).where(eq(mortgageTaxonomyTagAssignments.tagId, input.tagId));
    if (categoryKeys.length) await tx.insert(mortgageTaxonomyTagAssignments).values(categoryKeys.map((categoryKey) => ({ tagId: input.tagId, categoryKey, actorUserId: userId })));
  });
  return { tagId: input.tagId, categoryKeys };
}

export async function saveMortgageTaxonomyTagShare(ownerUserId: number, input: { tagId: number; sharedWithUserId: number; canEdit: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageTaxonomyTagPermission(await getMortgageTaxonomyTagPermission(input.tagId, ownerUserId), 'manage');
  if (input.sharedWithUserId === ownerUserId) throw new Error('CANNOT_SHARE_MORTGAGE_TAG_WITH_OWNER');
  const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0];
  if (!target) throw new Error('SHARED_USER_NOT_FOUND');
  await db.insert(mortgageTaxonomyTagShares).values(input).onDuplicateKeyUpdate({ set: { canEdit: input.canEdit } });
  return { shared: true };
}

export async function revokeMortgageTaxonomyTagShare(ownerUserId: number, input: { tagId: number; sharedWithUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageTaxonomyTagPermission(await getMortgageTaxonomyTagPermission(input.tagId, ownerUserId), 'manage');
  await db.delete(mortgageTaxonomyTagShares).where(and(eq(mortgageTaxonomyTagShares.tagId, input.tagId), eq(mortgageTaxonomyTagShares.sharedWithUserId, input.sharedWithUserId)));
  return { revoked: true };
}

export async function listMortgageLedgerSavedViews(userId: number, moduleId: string) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(mortgageLedgerSavedViews).where(and(eq(mortgageLedgerSavedViews.userId, userId), eq(mortgageLedgerSavedViews.moduleId, moduleId))).orderBy(desc(mortgageLedgerSavedViews.updatedAt));
}

export async function saveMortgageLedgerSavedView(userId: number, input: { moduleId: string; name: string; config: MortgageLedgerViewConfig }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const name = input.name.trim();
  if (!name) throw new Error('MORTGAGE_VIEW_NAME_REQUIRED');
  await db.insert(mortgageLedgerSavedViews).values({ userId, moduleId: input.moduleId, name, config: input.config }).onDuplicateKeyUpdate({ set: { config: input.config, updatedAt: new Date() } });
  return { saved: true, name };
}

export async function deleteMortgageLedgerSavedView(userId: number, viewId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.delete(mortgageLedgerSavedViews).where(and(eq(mortgageLedgerSavedViews.id, viewId), eq(mortgageLedgerSavedViews.userId, userId)));
  return { deleted: true };
}

export async function setMortgageLedgerReviewTiming(userId: number, input: { ledgerId: number; reviewDueAt: Date | null; reviewReminderHours: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requireMortgageLedgerPermission(await getMortgageLedgerPermission(input.ledgerId, userId), 'edit');
  const reminderHours = Math.min(Math.max(Math.floor(input.reviewReminderHours), 1), 168);
  await db.update(mortgageSharedLedgers).set({ reviewDueAt: input.reviewDueAt, reviewReminderHours: reminderHours, updatedAt: new Date() }).where(eq(mortgageSharedLedgers.id, input.ledgerId));
  await appendMortgageLedgerAudit({ ledgerId: input.ledgerId, actorUserId: userId, action: 'updated', note: input.reviewDueAt ? `设置审阅截止：${input.reviewDueAt.toISOString()}；提前 ${reminderHours} 小时提醒` : '清除审阅截止时间' });
  return { reviewDueAt: input.reviewDueAt, reviewReminderHours: reminderHours };
}

type MortgageLedgerNotificationType = 'review_submitted' | 'review_due_soon' | 'review_overdue';
type MortgageLedgerNotification = { id: number; userId: number; title: string; content: string; type: 'alert' | 'info' };

async function recordMortgageLedgerNotification(input: { notificationKey: string; userId: number; ledgerId: number; eventType: MortgageLedgerNotificationType; dueAt?: Date | null; title: string; content: string; type?: 'alert' | 'info' }): Promise<MortgageLedgerNotification | null> {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: mortgageLedgerNotificationEvents.id }).from(mortgageLedgerNotificationEvents).where(eq(mortgageLedgerNotificationEvents.notificationKey, input.notificationKey)).limit(1);
    if (existing[0]) return null;
    await tx.insert(mortgageLedgerNotificationEvents).values({ notificationKey: input.notificationKey, userId: input.userId, ledgerId: input.ledgerId, eventType: input.eventType, dueAt: input.dueAt ?? null });
    const result = await tx.insert(notifications).values({ userId: input.userId, title: input.title, content: input.content, type: input.type ?? 'alert', relatedType: 'mortgage_ledger', relatedId: input.ledgerId });
    const id = Number((result as any)[0]?.insertId ?? (result as any).insertId);
    return Number.isInteger(id) && id > 0 ? { id, userId: input.userId, title: input.title, content: input.content, type: input.type ?? 'alert' } : null;
  });
}

async function getMortgageLedgerReviewers(ledgerId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select({ userId: mortgageSharedLedgerShares.sharedWithUserId }).from(mortgageSharedLedgerShares).where(and(eq(mortgageSharedLedgerShares.ledgerId, ledgerId), eq(mortgageSharedLedgerShares.permission, 'reviewer')));
  return rows.map((row) => row.userId);
}

export async function notifyMortgageLedgerReviewSubmitted(ledgerId: number, actorUserId: number) {
  const ledger = await getMortgageLedgerById(ledgerId);
  if (!ledger) throw new Error('MORTGAGE_LEDGER_NOT_FOUND');
  const reviewers = await getMortgageLedgerReviewers(ledgerId);
  const submittedAt = new Date();
  const notificationsOut: MortgageLedgerNotification[] = [];
  for (const userId of reviewers) {
    if (userId === actorUserId) continue;
    const notification = await recordMortgageLedgerNotification({ notificationKey: `mortgage-ledger:submitted:${ledgerId}:${userId}:v${ledger.version}`, userId, ledgerId, eventType: 'review_submitted', dueAt: ledger.reviewDueAt, title: '抵押债台账待审', content: `台账“${ledger.name}”已提交审阅。${ledger.reviewDueAt ? `审阅截止：${ledger.reviewDueAt.toLocaleString('zh-CN')}。` : '尚未设置审阅截止时间。'}`, type: 'alert' });
    if (notification) notificationsOut.push(notification);
  }
  return notificationsOut;
}

export async function processMortgageLedgerReviewNotifications(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const ledgers = await db.select().from(mortgageSharedLedgers).where(and(eq(mortgageSharedLedgers.reviewStatus, 'in_review'), isNotNull(mortgageSharedLedgers.reviewDueAt)));
  const emitted: MortgageLedgerNotification[] = [];
  for (const ledger of ledgers) {
    if (!ledger.reviewDueAt) continue;
    const dueAt = new Date(ledger.reviewDueAt);
    const reminderAt = new Date(dueAt.getTime() - ledger.reviewReminderHours * 60 * 60 * 1000);
    if (now < reminderAt) continue;
    const eventType: MortgageLedgerNotificationType = dueAt < now ? 'review_overdue' : 'review_due_soon';
    const reviewers = await getMortgageLedgerReviewers(ledger.id);
    for (const userId of reviewers) {
      const preference = (await db.select({ systemAlerts: notificationPreferences.systemAlerts }).from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1))[0];
      if (preference && !preference.systemAlerts) continue;
      const notification = await recordMortgageLedgerNotification({ notificationKey: `mortgage-ledger:${eventType}:${ledger.id}:${userId}:${dueAt.toISOString()}`, userId, ledgerId: ledger.id, eventType, dueAt, title: eventType === 'review_overdue' ? '抵押债台账审阅已逾期' : '抵押债台账审阅即将到期', content: `台账“${ledger.name}”当前仍待审阅，截止时间为 ${dueAt.toLocaleString('zh-CN')}。请在团队台账中完成批准或要求修订。`, type: 'alert' });
      if (notification) emitted.push(notification);
    }
  }
  return emitted;
}

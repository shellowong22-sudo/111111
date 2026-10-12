import { and, desc, eq, sql } from 'drizzle-orm';
import { valuationAutomationRuns, valuationAutomationSettings } from '../drizzle/schema';
import { calculateFixedRateBond } from './routers/pricing';
import { fetchFredSeries } from './realDataService';
import { getDb } from './db';

export const VALUATION_AUTOMATION_PRODUCTS = ['UST2Y', 'UST5Y', 'UST10Y', 'UST30Y'] as const;
export type ValuationAutomationProductId = (typeof VALUATION_AUTOMATION_PRODUCTS)[number];
const PRODUCTS: Record<ValuationAutomationProductId, { tenor: string; seriesId: string; maturityYears: number; label: string }> = {
  UST2Y: { tenor: '2Y', seriesId: 'DGS2', maturityYears: 2, label: '2 年期名义国债现金流模板' },
  UST5Y: { tenor: '5Y', seriesId: 'DGS5', maturityYears: 5, label: '5 年期名义国债现金流模板' },
  UST10Y: { tenor: '10Y', seriesId: 'DGS10', maturityYears: 10, label: '10 年期名义国债现金流模板' },
  UST30Y: { tenor: '30Y', seriesId: 'DGS30', maturityYears: 30, label: '30 年期名义国债现金流模板' },
};
const DEFAULT_CRON = '0 0 23 * * 1-5';
const METHOD = '固定票息现金流按每期 FRED Treasury 曲线收益率折现；未计应计利息、税费、回购融资、流动性、信用或期权调整。';
const numberValue = (value: unknown) => value == null ? null : Number(value);
const trimError = (value: unknown) => (value instanceof Error ? value.message : String(value)).slice(0, 2000);
const curveObservationDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

export type ValuationAutomationSettingsInput = { productId: ValuationAutomationProductId; notional: number; couponRate: number; frequency: 1 | 2; cronExpression: string };

function toSettings(row: typeof valuationAutomationSettings.$inferSelect) {
  return { ...row, notional: numberValue(row.notional) ?? 0, couponRate: numberValue(row.couponRate) ?? 0 };
}

export async function ensureValuationAutomationSettings(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(valuationAutomationSettings).values({ userId, cronExpression: DEFAULT_CRON }).onDuplicateKeyUpdate({ set: { userId } });
  const setting = (await db.select().from(valuationAutomationSettings).where(eq(valuationAutomationSettings.userId, userId)).limit(1))[0];
  if (!setting) throw new Error('VALUATION_AUTOMATION_SETTING_UNAVAILABLE');
  return toSettings(setting);
}

export async function getValuationAutomationStatus(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const setting = await ensureValuationAutomationSettings(userId);
  const runs = await db.select().from(valuationAutomationRuns).where(eq(valuationAutomationRuns.userId, userId)).orderBy(desc(valuationAutomationRuns.executedAt)).limit(50);
  return {
    setting,
    products: VALUATION_AUTOMATION_PRODUCTS.map((id) => ({ id, ...PRODUCTS[id] })),
    runs: runs.map((run) => ({ ...run, notional: numberValue(run.notional) ?? 0, couponRate: numberValue(run.couponRate) ?? 0, curveYieldPct: numberValue(run.curveYieldPct), presentValue: numberValue(run.presentValue), cleanPricePer100: numberValue(run.cleanPricePer100), macaulayDuration: numberValue(run.macaulayDuration), modifiedDuration: numberValue(run.modifiedDuration), dv01: numberValue(run.dv01) })),
    sourceBoundary: '自动刷新仅使用 FRED DGS2、DGS5、DGS10 或 DGS30 的有效原始观测。原估值引擎中的蒙特卡洛、波动率曲面、风险或演示逻辑不参与自动更新。',
  };
}

export async function saveValuationAutomationSettings(userId: number, input: ValuationAutomationSettingsInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(valuationAutomationSettings).values({ userId, productId: input.productId, notional: String(input.notional), couponRate: String(input.couponRate), frequency: input.frequency, cronExpression: input.cronExpression }).onDuplicateKeyUpdate({ set: { productId: input.productId, notional: String(input.notional), couponRate: String(input.couponRate), frequency: input.frequency, cronExpression: input.cronExpression } });
  return ensureValuationAutomationSettings(userId);
}

export async function setValuationAutomationTask(userId: number, taskUid: string | null, isEnabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ensureValuationAutomationSettings(userId);
  await db.update(valuationAutomationSettings).set({ scheduleCronTaskUid: taskUid, isEnabled }).where(eq(valuationAutomationSettings.userId, userId));
  return ensureValuationAutomationSettings(userId);
}

async function insertRun(userId: number, setting: Awaited<ReturnType<typeof ensureValuationAutomationSettings>>, input: { triggerType: 'manual' | 'scheduled'; status: 'succeeded' | 'failed' | 'skipped'; curveYieldPct?: number | null; curveObservationDate?: Date | null; presentValue?: number | null; cleanPricePer100?: number | null; macaulayDuration?: number | null; modifiedDuration?: number | null; dv01?: number | null; errorMessage?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const product = PRODUCTS[setting.productId as ValuationAutomationProductId];
  await db.insert(valuationAutomationRuns).values({ userId, settingId: setting.id, triggerType: input.triggerType, status: input.status, productId: setting.productId, notional: String(setting.notional), couponRate: String(setting.couponRate), frequency: setting.frequency, curveYieldPct: input.curveYieldPct == null ? null : String(input.curveYieldPct), curveObservationDate: input.curveObservationDate ?? null, source: `FRED ${product.seriesId}`, methodology: METHOD, presentValue: input.presentValue == null ? null : String(input.presentValue), cleanPricePer100: input.cleanPricePer100 == null ? null : String(input.cleanPricePer100), macaulayDuration: input.macaulayDuration == null ? null : String(input.macaulayDuration), modifiedDuration: input.modifiedDuration == null ? null : String(input.modifiedDuration), dv01: input.dv01 == null ? null : String(input.dv01), errorMessage: input.errorMessage ?? null });
}

async function markSettingRun(userId: number, status: 'succeeded' | 'failed', error: string | null) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.update(valuationAutomationSettings).set({ lastRunAt: new Date(), lastStatus: status, lastError: error }).where(eq(valuationAutomationSettings.userId, userId));
}

export async function runValuationAutomation(userId: number, triggerType: 'manual' | 'scheduled') {
  const setting = await ensureValuationAutomationSettings(userId);
  if (triggerType === 'scheduled' && !setting.isEnabled) {
    await insertRun(userId, setting, { triggerType, status: 'skipped', errorMessage: '自动更新已暂停；本次周期触发未执行。' });
    return { status: 'skipped' as const, reason: 'DISABLED', settingId: setting.id };
  }
    const product = PRODUCTS[setting.productId as ValuationAutomationProductId];
    try {
      const latest = (await fetchFredSeries(product.seriesId, 15)).at(-1);
      if (!latest || !Number.isFinite(latest.value) || latest.value <= 0) throw new Error(`FRED ${product.seriesId} 没有可用于自动估值的有效正收益率观测。`);
      const observationDate = curveObservationDate(latest.date);
      if (triggerType === 'scheduled') {
      const db = await getDb();
      if (!db) throw new Error('DATABASE_UNAVAILABLE');
      // `curve_observation_date` is a MySQL DATE.  Compare the canonical
      // YYYY-MM-DD value rather than a JavaScript Date (which can be coerced
      // through a timezone-aware timestamp and miss the same observation).
      const existing = (await db.select({ id: valuationAutomationRuns.id }).from(valuationAutomationRuns).where(and(eq(valuationAutomationRuns.settingId, setting.id), eq(valuationAutomationRuns.status, 'succeeded'), sql`${valuationAutomationRuns.curveObservationDate} = ${latest.date}`)).limit(1))[0];
      if (existing) return { status: 'skipped' as const, reason: 'ALREADY_REFRESHED_FOR_CURVE_OBSERVATION', settingId: setting.id, curveObservationDate: latest.date };
    }
    const valuation = calculateFixedRateBond(setting.notional, setting.couponRate, latest.value / 100, product.maturityYears, setting.frequency);
    await insertRun(userId, setting, { triggerType, status: 'succeeded', curveYieldPct: latest.value, curveObservationDate: observationDate, presentValue: valuation.presentValue, cleanPricePer100: valuation.cleanPricePer100, macaulayDuration: valuation.macaulayDuration, modifiedDuration: valuation.modifiedDuration, dv01: valuation.dv01 });
    await markSettingRun(userId, 'succeeded', null);
    return { status: 'succeeded' as const, settingId: setting.id, product: { id: setting.productId, ...product }, curveYieldPct: latest.value, curveObservationDate: latest.date, source: `FRED ${product.seriesId}`, methodology: METHOD, valuation, executedAt: new Date() };
  } catch (error) {
    const errorMessage = trimError(error);
    await insertRun(userId, setting, { triggerType, status: 'failed', errorMessage });
    await markSettingRun(userId, 'failed', errorMessage);
    return { status: 'failed' as const, settingId: setting.id, errorMessage };
  }
}

export async function runValuationAutomationByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const setting = (await db.select().from(valuationAutomationSettings).where(and(eq(valuationAutomationSettings.scheduleCronTaskUid, taskUid), eq(valuationAutomationSettings.isEnabled, true))).limit(1))[0];
  if (!setting) return { status: 'skipped' as const, reason: 'ORPHAN_OR_DISABLED' };
  return runValuationAutomation(setting.userId, 'scheduled');
}

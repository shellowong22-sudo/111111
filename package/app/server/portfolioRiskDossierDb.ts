import { and, desc, eq } from 'drizzle-orm';
import { bondPortfolioScenarioSnapshots, portfolioRiskGuardrails, portfolioRiskGuardrailVersions, portfolioRiskResearchDossiers } from '../drizzle/schema';
import { analyzeBondPortfolio, type BondScenarioType } from './bondPortfolioRisk';
import { getDb } from './db';
import { getCreditOasSnapshot } from './routers/creditResearch';

export type RiskGuardrailInput = { id?: number; userId: number; name: string; maxPortfolioDuration?: number | null; maxDv01?: number | null; maxScenarioLoss?: number | null; alertThresholdPct?: number; isActive: boolean };

const numberOrNull = (value: unknown) => value === null || value === undefined ? null : Number(value);
const decimalOrNull = (value: number | null | undefined) => value === null || value === undefined ? null : String(value);
type AuthorizedLiquidityPosition = { bidAskSpreadBps?: number; averageDailyVolume?: number; liquidityScore?: number; lastTradeAt?: string };

function summarizeAuthorizedLiquidity(positions: unknown[]) {
  const rows = positions as AuthorizedLiquidityPosition[];
  const withAnyMetric = rows.filter((row) => Number.isFinite(row.bidAskSpreadBps) || Number.isFinite(row.averageDailyVolume) || Number.isFinite(row.liquidityScore));
  if (!withAnyMetric.length) return { status: 'unavailable' as const, coverageCount: 0, totalPositions: rows.length, limitation: '当前账户快照未包含获授权的买卖价差、日均成交量或流动性评分；系统不使用样本、代理评分或市场猜测替代。' };
  const bidAsk = withAnyMetric.map((row) => Number(row.bidAskSpreadBps)).filter(Number.isFinite);
  const volume = withAnyMetric.map((row) => Number(row.averageDailyVolume)).filter(Number.isFinite);
  const scores = withAnyMetric.map((row) => Number(row.liquidityScore)).filter(Number.isFinite);
  const asOf = withAnyMetric.map((row) => row.lastTradeAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return { status: 'available' as const, coverageCount: withAnyMetric.length, totalPositions: rows.length, asOf, averageBidAskSpreadBps: bidAsk.length ? bidAsk.reduce((sum, value) => sum + value, 0) / bidAsk.length : null, averageDailyVolume: volume.length ? volume.reduce((sum, value) => sum + value, 0) / volume.length : null, averageLiquidityScore: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null, limitation: '仅汇总用户主动保存的获授权流动性字段；未覆盖持仓不参与该维度计算，结果不代表可成交性或交易成本保证。' };
}

export async function listPortfolioRiskGuardrails(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(portfolioRiskGuardrails).where(eq(portfolioRiskGuardrails.userId, userId)).orderBy(desc(portfolioRiskGuardrails.updatedAt));
}

export async function savePortfolioRiskGuardrail(input: RiskGuardrailInput) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const values = { name: input.name.trim(), maxPortfolioDuration: decimalOrNull(input.maxPortfolioDuration), maxDv01: decimalOrNull(input.maxDv01), maxScenarioLoss: decimalOrNull(input.maxScenarioLoss), alertThresholdPct: Math.min(100, Math.max(50, Math.round(input.alertThresholdPct ?? 80))), isActive: input.isActive };
  if (input.id) {
    const existing = (await db.select().from(portfolioRiskGuardrails).where(and(eq(portfolioRiskGuardrails.id, input.id), eq(portfolioRiskGuardrails.userId, input.userId))).limit(1))[0];
    if (!existing) throw new Error('RISK_GUARDRAIL_NOT_FOUND');
    await db.update(portfolioRiskGuardrails).set({ ...values, updatedAt: new Date() }).where(and(eq(portfolioRiskGuardrails.id, input.id), eq(portfolioRiskGuardrails.userId, input.userId)));
    const updated = (await db.select().from(portfolioRiskGuardrails).where(and(eq(portfolioRiskGuardrails.id, input.id), eq(portfolioRiskGuardrails.userId, input.userId))).limit(1))[0];
    const lastVersion = (await db.select({ versionNumber: portfolioRiskGuardrailVersions.versionNumber }).from(portfolioRiskGuardrailVersions).where(and(eq(portfolioRiskGuardrailVersions.userId, input.userId), eq(portfolioRiskGuardrailVersions.guardrailId, input.id))).orderBy(desc(portfolioRiskGuardrailVersions.versionNumber)).limit(1))[0];
    await db.insert(portfolioRiskGuardrailVersions).values({ userId: input.userId, guardrailId: input.id, versionNumber: (lastVersion?.versionNumber ?? 0) + 1, changeType: 'updated', previousState: existing, currentState: updated });
    return updated;
  }
  await db.insert(portfolioRiskGuardrails).values({ userId: input.userId, ...values });
  const created = (await db.select().from(portfolioRiskGuardrails).where(and(eq(portfolioRiskGuardrails.userId, input.userId), eq(portfolioRiskGuardrails.name, values.name))).limit(1))[0];
  if (created) await db.insert(portfolioRiskGuardrailVersions).values({ userId: input.userId, guardrailId: created.id, versionNumber: 1, changeType: 'created', previousState: null, currentState: created });
  return created;
}

export async function deletePortfolioRiskGuardrail(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const existing = (await db.select().from(portfolioRiskGuardrails).where(and(eq(portfolioRiskGuardrails.id, id), eq(portfolioRiskGuardrails.userId, userId))).limit(1))[0];
  if (!existing) return false;
  const lastVersion = (await db.select({ versionNumber: portfolioRiskGuardrailVersions.versionNumber }).from(portfolioRiskGuardrailVersions).where(and(eq(portfolioRiskGuardrailVersions.userId, userId), eq(portfolioRiskGuardrailVersions.guardrailId, id))).orderBy(desc(portfolioRiskGuardrailVersions.versionNumber)).limit(1))[0];
  await db.insert(portfolioRiskGuardrailVersions).values({ userId, guardrailId: id, versionNumber: (lastVersion?.versionNumber ?? 0) + 1, changeType: 'deleted', previousState: existing, currentState: null });
  const result = await db.delete(portfolioRiskGuardrails).where(and(eq(portfolioRiskGuardrails.id, id), eq(portfolioRiskGuardrails.userId, userId)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function listPortfolioRiskGuardrailVersions(userId: number, guardrailId?: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const condition = guardrailId ? and(eq(portfolioRiskGuardrailVersions.userId, userId), eq(portfolioRiskGuardrailVersions.guardrailId, guardrailId)) : eq(portfolioRiskGuardrailVersions.userId, userId);
  return db.select().from(portfolioRiskGuardrailVersions).where(condition).orderBy(desc(portfolioRiskGuardrailVersions.createdAt), desc(portfolioRiskGuardrailVersions.versionNumber));
}

export async function listPortfolioRiskResearchDossiers(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(portfolioRiskResearchDossiers).where(eq(portfolioRiskResearchDossiers.userId, userId)).orderBy(desc(portfolioRiskResearchDossiers.createdAt));
}

export async function listPortfolioRiskTrendTimeline(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const dossiers = await db.select().from(portfolioRiskResearchDossiers).where(eq(portfolioRiskResearchDossiers.userId, userId)).orderBy(desc(portfolioRiskResearchDossiers.createdAt));
  const guardrails = await db.select().from(portfolioRiskGuardrails).where(eq(portfolioRiskGuardrails.userId, userId));
  return dossiers.reverse().map((dossier) => {
    const guardrail = dossier.guardrailId ? guardrails.find((item) => item.id === dossier.guardrailId) : undefined;
    const scenarioLoss = Math.max(0, -Number(dossier.estimatedPnl));
    const ratio = (actual: number, limit: unknown) => { const numericLimit = numberOrNull(limit); return numericLimit !== null && numericLimit > 0 ? actual / numericLimit * 100 : null; };
    const summary = (dossier.sourceSummary ?? {}) as Record<string, unknown>;
    return { id: dossier.id, createdAt: dossier.createdAt, snapshotId: dossier.snapshotId, guardrailId: dossier.guardrailId, scenario: dossier.scenario, magnitudeBp: dossier.magnitudeBp, totalMarketValue: Number(dossier.totalMarketValue), totalDv01: Number(dossier.totalDv01), portfolioDuration: Number(dossier.portfolioDuration), estimatedPnl: Number(dossier.estimatedPnl), breachCount: Array.isArray(dossier.breaches) ? dossier.breaches.length : 0, alertThresholdPct: guardrail?.alertThresholdPct ?? null, consumption: { durationPct: ratio(Number(dossier.portfolioDuration), guardrail?.maxPortfolioDuration), dv01Pct: ratio(Number(dossier.totalDv01), guardrail?.maxDv01), scenarioLossPct: ratio(scenarioLoss, guardrail?.maxScenarioLoss) }, creditRisk: summary.creditRisk ?? { status: 'unavailable', limitation: '该历史研究档案生成时未保存信用利差维度。' }, liquidityRisk: summary.liquidityRisk ?? { status: 'unavailable', limitation: '该历史研究档案生成时未保存获授权流动性字段。' } };
  });
}

export async function createPortfolioRiskResearchDossier(input: { userId: number; snapshotId: number; guardrailId?: number; scenario: BondScenarioType; magnitudeBp: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const snapshot = (await db.select().from(bondPortfolioScenarioSnapshots).where(and(eq(bondPortfolioScenarioSnapshots.id, input.snapshotId), eq(bondPortfolioScenarioSnapshots.userId, input.userId))).limit(1))[0];
  if (!snapshot) throw new Error('SCENARIO_SNAPSHOT_NOT_FOUND');
  const guardrail = input.guardrailId ? (await db.select().from(portfolioRiskGuardrails).where(and(eq(portfolioRiskGuardrails.id, input.guardrailId), eq(portfolioRiskGuardrails.userId, input.userId))).limit(1))[0] : undefined;
  if (input.guardrailId && !guardrail) throw new Error('RISK_GUARDRAIL_NOT_FOUND');
  const analysis = analyzeBondPortfolio(snapshot.positions as Parameters<typeof analyzeBondPortfolio>[0], input.scenario, input.magnitudeBp);
  const maxDuration = numberOrNull(guardrail?.maxPortfolioDuration);
  const maxDv01 = numberOrNull(guardrail?.maxDv01);
  const maxScenarioLoss = numberOrNull(guardrail?.maxScenarioLoss);
  const scenarioLoss = Math.max(0, -analysis.totalPnl);
  const breaches = [
    maxDuration !== null && analysis.portfolioDuration > maxDuration ? { metric: '组合修正久期', actual: analysis.portfolioDuration, limit: maxDuration, unit: '年' } : null,
    maxDv01 !== null && analysis.totalDv01 > maxDv01 ? { metric: 'DV01', actual: analysis.totalDv01, limit: maxDv01, unit: '计价货币/1bp' } : null,
    maxScenarioLoss !== null && scenarioLoss > maxScenarioLoss ? { metric: '情景损失', actual: scenarioLoss, limit: maxScenarioLoss, unit: '计价货币' } : null,
  ].filter(Boolean);
  const topSensitivity = [...analysis.rows]
    .sort((left, right) => Math.abs(right.dv01) - Math.abs(left.dv01))
    .slice(0, 20)
    .map((row) => ({ identifier: row.identifier, maturityYears: row.maturityYears, marketValue: row.marketValue, modifiedDuration: row.modifiedDuration, dv01: row.dv01, appliedShiftBp: row.appliedShiftBp, estimatedPnl: row.estimatedPnl }));
  const creditOas = await getCreditOasSnapshot();
  const creditRisk = { status: creditOas.series.some((item) => item.status === 'available') ? 'available' as const : 'unavailable' as const, asOf: creditOas.asOf, sourceLabel: creditOas.sourceLabel, series: creditOas.series.map((item) => ({ id: item.id, label: item.label, bucket: item.bucket, observationDate: item.observationDate, valueBps: item.valueBps, changeBps: item.changeBps, status: item.status, history: item.history, limitation: item.limitation })), limitation: '指数级 OAS 仅作为评级桶级市场参考，不是单券报价、可成交价差、CDS 点位或投资组合实际信用利差。' };
  const liquidityRisk = summarizeAuthorizedLiquidity(snapshot.positions as unknown[]);
  const sourceSummary = { snapshotId: snapshot.id, snapshotName: snapshot.name, positions: analysis.rows.length, source: '登录账户主动保存的标准化债券持仓快照', asOf: new Date().toISOString(), methodology: '固定票息现金流折现；修正久期与凸性近似；压力情景不预测发生概率，不含信用利差、流动性、税费、外汇或期权性。', topSensitivity, creditRisk, liquidityRisk };
  await db.insert(portfolioRiskResearchDossiers).values({ userId: input.userId, snapshotId: snapshot.id, guardrailId: guardrail?.id ?? null, scenario: input.scenario, magnitudeBp: input.magnitudeBp, totalMarketValue: String(analysis.totalMarketValue), totalDv01: String(analysis.totalDv01), portfolioDuration: String(analysis.portfolioDuration), estimatedPnl: String(analysis.totalPnl), breaches, sourceSummary });
  return { analysis, breaches, sourceSummary };
}

import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { createPortfolioRiskResearchDossier, deletePortfolioRiskGuardrail, listPortfolioRiskGuardrailVersions, listPortfolioRiskResearchDossiers, listPortfolioRiskTrendTimeline, savePortfolioRiskGuardrail } from './portfolioRiskDossierDb';
import { saveBondPortfolioScenarioSnapshot } from './bondPortfolioScenarioDb';

const ownerId = 987654341;
const otherUserId = 987654342;
const positions = [{ identifier: 'UST-5Y', faceValue: 1_000_000, couponRate: 4.1, maturityYears: 5, yieldToMaturity: 4.25, frequency: 2 as const, bidAskSpreadBps: 1.5, averageDailyVolume: 2_000_000, liquidityScore: 82, lastTradeAt: '2026-08-21' }];

afterEach(async () => {
  const db = await getDb();
  await db?.execute(sql`DELETE FROM portfolio_risk_research_dossiers WHERE user_id IN (${ownerId}, ${otherUserId})`);
  await db?.execute(sql`DELETE FROM portfolio_risk_guardrail_versions WHERE user_id IN (${ownerId}, ${otherUserId})`);
  await db?.execute(sql`DELETE FROM portfolio_risk_guardrails WHERE user_id IN (${ownerId}, ${otherUserId})`);
  await db?.execute(sql`DELETE FROM bond_portfolio_scenario_snapshots WHERE user_id IN (${ownerId}, ${otherUserId})`);
});

describe('账户私有风险限额与研究档案', () => {
  it('only derives a dossier from the owner snapshot and records explicit limit breaches', async () => {
    const snapshot = await saveBondPortfolioScenarioSnapshot({ userId: ownerId, name: '风险归档测试快照', positions, magnitudeBp: 50 });
    const guardrail = await savePortfolioRiskGuardrail({ userId: ownerId, name: '严格限额', maxPortfolioDuration: 1, maxDv01: 1, maxScenarioLoss: 1, alertThresholdPct: 75, isActive: true });

    const result = await createPortfolioRiskResearchDossier({ userId: ownerId, snapshotId: snapshot!.id, guardrailId: guardrail!.id, scenario: 'parallel', magnitudeBp: 50 });

    expect(result.analysis.rows).toHaveLength(1);
    expect(result.breaches.length).toBeGreaterThan(0);
    expect(result.sourceSummary.snapshotId).toBe(snapshot!.id);
    expect(result.sourceSummary.topSensitivity).toHaveLength(1);
    expect(result.sourceSummary.topSensitivity[0]?.identifier).toBe('UST-5Y');
    expect(result.sourceSummary.creditRisk.series.every((item) => Array.isArray(item.history))).toBe(true);
    expect(result.sourceSummary.liquidityRisk.status).toBe('available');
    expect(result.sourceSummary.liquidityRisk.coverageCount).toBe(1);
    expect((await listPortfolioRiskResearchDossiers(ownerId)).some((item) => item.snapshotId === snapshot!.id)).toBe(true);
    const timeline = await listPortfolioRiskTrendTimeline(ownerId);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.snapshotId).toBe(snapshot!.id);
    expect(timeline[0]?.alertThresholdPct).toBe(75);
    expect(timeline[0]?.consumption.durationPct).toBeGreaterThanOrEqual(75);
    expect(timeline[0]?.liquidityRisk.status).toBe('available');
    expect(await listPortfolioRiskResearchDossiers(otherUserId)).toEqual([]);
    await expect(createPortfolioRiskResearchDossier({ userId: otherUserId, snapshotId: snapshot!.id, scenario: 'parallel', magnitudeBp: 50 })).rejects.toThrow('SCENARIO_SNAPSHOT_NOT_FOUND');
    expect(await deletePortfolioRiskGuardrail(otherUserId, guardrail!.id)).toBe(false);
  }, 20_000);

  it('records immutable account-scoped guardrail versions for creation, update and deletion', async () => {
    const created = await savePortfolioRiskGuardrail({ userId: ownerId, name: '审计限额', maxPortfolioDuration: 6, maxDv01: 1000, maxScenarioLoss: 5000, alertThresholdPct: 80, isActive: true });
    await savePortfolioRiskGuardrail({ id: created!.id, userId: ownerId, name: '审计限额', maxPortfolioDuration: 5, maxDv01: 900, maxScenarioLoss: 4500, alertThresholdPct: 75, isActive: false });
    expect(await deletePortfolioRiskGuardrail(ownerId, created!.id)).toBe(true);
    const versions = await listPortfolioRiskGuardrailVersions(ownerId, created!.id);
    expect(versions.map((item) => item.changeType).sort()).toEqual(['created', 'deleted', 'updated']);
    expect(versions.find((item) => item.changeType === 'updated')?.previousState).toMatchObject({ alertThresholdPct: 80, isActive: true });
    expect(versions.find((item) => item.changeType === 'deleted')?.currentState).toBeNull();
    expect(await listPortfolioRiskGuardrailVersions(otherUserId, created!.id)).toEqual([]);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const text = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('账户私有债券情景与风险审计', () => {
  it('limits saved scenario snapshots to the owner and preserves only normalized positions plus shock parameters', () => {
    const schema = text('drizzle/schema.ts');
    const db = text('server/bondPortfolioScenarioDb.ts');
    const router = text('server/routers/bondPortfolio.ts');

    expect(schema).toContain('bondPortfolioScenarioSnapshots');
    expect(schema).toContain('bond_portfolio_scenario_user_name_uq');
    expect(schema).toContain('positions: json("positions").notNull()');
    expect(db).toContain('eq(bondPortfolioScenarioSnapshots.userId, userId)');
    expect(db).toContain('SCENARIO_SNAPSHOT_NOT_FOUND');
    expect(router).toContain('saveSnapshot: protectedProcedure');
    expect(router).toContain('deleteSnapshot: protectedProcedure');
  });

  it('records append-only risk action history and keeps audit filtering account-private', () => {
    const schema = text('drizzle/schema.ts');
    const db = text('server/portfolioRiskEventDb.ts');
    const router = text('server/routers/portfolioRisk.ts');

    expect(schema).toContain('portfolioRiskEventActionAudits');
    expect(db).toContain('previousStatus: existing?.status ?? null');
    expect(db).toContain('db.insert(portfolioRiskEventActionAudits)');
    expect(db).toContain('if (input.memberId !== undefined && input.memberId !== userId) return []');
    expect(router).toContain('listActionAudits');
  });

  it('exposes actual save/load/delete snapshot controls and event-history filters in the appended workspaces', () => {
    const curve = text('client/src/components/portfolio/PortfolioBondCurveComparison.tsx');
    const drawer = text('client/src/components/portfolio/PortfolioRiskEventDrawer.tsx');

    expect(curve).toContain('保存快照');
    expect(curve).toContain('覆盖保存');
    expect(curve).toContain('deleteSnapshot.mutate');
    expect(drawer).toContain('处置历史审计');
    expect(drawer).toContain('listActionAudits');
  });
});

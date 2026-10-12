import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('public renewable energy observation desk', () => {
  it('uses World Bank annual indicators and preserves BNEF-specific data as disabled historical content', () => {
    const router = read('server/routers/energyPublic.ts');
    const page = read('client/src/pages/NewsResearchHub.tsx');
    const desk = read('client/src/components/news/PublicRenewableEnergyDesk.tsx');
    expect(router).toContain("fetchWorldBankIndicator('EG.ELC.RNEW.ZS'");
    expect(router).toContain("fetchWorldBankIndicator('EG.FEC.RNEW.ZS'");
    expect(router).toContain('不是 BNEF 专有研究');
    expect(page).toContain('<PublicRenewableEnergyDesk />');
    expect(page).toContain('data-bnef-historical-content="true"');
    expect(page).toContain('data-bnef-historical-boundary="true"');
    expect(desk).toContain('World Bank Open Data');
    expect(desk).toContain('按国家分别保留观测日期和缺失状态');
  });
});

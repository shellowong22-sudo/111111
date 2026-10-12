import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('DASH risk evidence status', () => {
  it('uses public observations and keeps account risk conclusions unavailable without evidence', () => {
    const desk = read('client/src/components/pricing/RiskEvidenceStatusDesk.tsx');
    const legacy = read('client/src/components/pricing/RiskDashboardPanel.tsx');
    expect(desk).toContain('trpc.market.headerObservations.useQuery');
    expect(desk).toContain('没有账户级持仓、衍生品、基准和对手方资料时');
    expect(desk).toContain('组合风险计算前提');
    expect(desk).toContain('PORT 中录入单证券观察；它不自动形成组合风险账户');
    expect(legacy).toContain('<RiskEvidenceStatusDesk />');
    expect(legacy).toContain('data-risk-dashboard-historical-boundary="true"');
    expect(legacy).toContain('固定 AUM、随机蒙特卡洛路径、资产敞口');
  });
});

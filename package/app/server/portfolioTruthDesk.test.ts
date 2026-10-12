import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('portfolio truth desk boundary', () => {
  it('starts from an empty holding state and only values user inputs with traceable quotes', () => {
    const source = read('client/src/components/portfolio/PortfolioTruthDesk.tsx');
    expect(source).toContain("useState<Holding[]>([])");
    expect(source).toContain('trpc.equityListings.list.useQuery');
    expect(source).toContain('trpc.equityListings.quote.useQuery');
    expect(source).toContain('当前未导入或录入任何持仓');
    expect(source).toContain('不同币种不合并');
    expect(source).toContain('不会被提交为委托、账户持仓或交易指令');
  });

  it('preserves original PORT content behind an explicit non-fact boundary', () => {
    const source = read('client/src/components/portfolio/PORTOverviewPanel.tsx');
    expect(source).toContain('<PortfolioTruthDesk />');
    expect(source).toContain('data-port-historical-boundary="true"');
    expect(source).toContain('不是当前账户事实或可执行依据');
    expect(source).toContain('const NAV_DATA');
    expect(source).toContain('const RISK_BUDGET');
  });
});

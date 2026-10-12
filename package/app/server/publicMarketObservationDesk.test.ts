import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('market data center public observation desk', () => {
  it('defaults to source-backed history and isolates fixed market center interactions', () => {
    const desk = read('client/src/components/PublicMarketObservationDesk.tsx');
    const page = read('client/src/pages/MarketDataPage.tsx');
    expect(desk).toContain('trpc.market.headerObservations.useQuery');
    expect(desk).toContain('trpc.market.getHistory.useQuery');
    expect(desk).toContain('不显示固定价格或模拟波动');
    expect(desk).toContain('不以静态图表、合成 K 线或相似品种替代');
    expect(page).toContain('<PublicMarketObservationDesk />');
    expect(page).toContain('data-market-data-historical-boundary="true"');
    expect(page).toContain('pointer-events-none select-none');
    expect(page).toContain('保留区已禁用交互');
  });
});

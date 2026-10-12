import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('行情详情真实 K 线图', () => {
  it('maps real Yahoo OHLC history and preserves an explicit unavailable state', () => {
    const service = source('server/realDataService.ts');
    const router = source('server/routers.ts');

    expect(service).toContain('open: number | null');
    expect(service).toContain('high: number | null');
    expect(service).toContain('low: number | null');
    expect(service).toMatch(/includeAdjustedClose:\s*["']true["']/);
    expect(router).toContain('getHistory: publicProcedure');
    expect(router).toContain('fetchYahooChart(input.symbol, input.range, \'1d\')');
    expect(router).toContain('系统不会构造 K 线替代数据');
    expect(router).toContain("'6mo', '1y', '2y', '5y'");
  });

  it('opens the existing interactive candle chart from detail and never generates client-side price history', () => {
    const marketPage = source('client/src/pages/MarketDataPage.tsx');
    const modal = source('client/src/components/PriceChartModal.tsx');

    expect(marketPage).toContain('trpc.market.getHistory.useQuery');
    expect(marketPage).not.toContain('generatePriceTrend');
    expect(marketPage).toContain('打开交互式 K 线图');
    expect(modal).toContain('K线图');
    expect(modal).toContain('历史 OHLC 来源：Yahoo Finance');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STOCK_CAPABILITIES } from '../shared/threeModuleCapabilityCatalog';

const workspace = readFileSync(resolve(process.cwd(), 'client/src/components/stock/StockCategoryDeepWorkspace.tsx'), 'utf8');
const terminal = readFileSync(resolve(process.cwd(), 'client/src/pages/Terminal.tsx'), 'utf8');
const menu = readFileSync(resolve(process.cwd(), 'client/src/components/StockMarketMenu.tsx'), 'utf8');

describe('stock category deep workspace', () => {
  it('keeps the nine numeric catalog entries in their existing routes without a retired duplicate market page', () => {
    for (const id of ['8', '15', '18', '19', '21', '25', '27', '31', '32']) expect(workspace).toContain(`id: "${id}"`);
    expect(workspace).not.toContain('id: "1"');
    expect(STOCK_CAPABILITIES).toHaveLength(33);
    expect(menu).toContain('STOCK_CAPABILITIES.slice');
    expect(terminal).toContain('title: \'股票市场\'');
    expect(terminal).not.toContain("preserveStock('coverage'");
  });

  it('uses server-backed observations and deterministic local calculations without fake market series or external navigation', () => {
    expect(workspace).toContain('trpc.stockMarketResearch.getWatchlistObservations.useQuery');
    expect(workspace).toContain('trpc.stockMarketResearch.searchIssuers.useQuery');
    expect(workspace).toContain('trpc.stockMarketResearch.getIssuerFilings.useQuery');
    expect(workspace).toContain('function blackScholes');
    expect(workspace).not.toContain('Math.random');
    expect(workspace).not.toContain('window.open');
    expect(workspace).not.toContain('window.location');
    expect(workspace).not.toContain('https://');
  });

  it('states conservative boundaries for portfolio, derivative, client and factor outputs', () => {
    expect(workspace).toContain('不生成 VaR、绩效或配置建议');
    expect(workspace).toContain('不构成可交易报价');
    expect(workspace).toContain('不生成客户结论');
    expect(workspace).toContain('不计算 IC、IR、回测收益或实盘信号');
  });
});

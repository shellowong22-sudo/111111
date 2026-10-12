import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('historical observation desk boundary', () => {
  it('derives descriptive metrics only from traceable imported-equity price history', () => {
    const source = read('client/src/components/pricing/HistoricalObservationDesk.tsx');
    expect(source).toContain('trpc.equityListings.list.useQuery');
    expect(source).toContain('trpc.equityListings.quote.useQuery');
    expect(source).toContain('HISTORICAL PRICE OBSERVATION · NOT A BACKTEST');
    expect(source).toContain('totalReturn');
    expect(source).toContain('maxDrawdown');
    expect(source).toContain('volatility');
    expect(source).toContain('没有策略规则、基准、交易、成本、最优参数、预测、胜率或投资结论');
  });

  it('preserves pricing submodule and actual terminal backtest display behind explicit non-fact boundaries', () => {
    const source = read('client/src/components/pricing/BacktestEnginePanel.tsx');
    expect(source).toContain('<HistoricalObservationDesk />');
    expect(source).toContain('data-backtest-historical-boundary="true"');
    expect(source).toContain('不是当前事实、已执行策略结果或可执行依据');
    expect(source).toContain('const equityCurve');
    expect(source).toContain('const paramSensitivity');
    const terminalSource = read('client/src/components/BacktestEnginePanel.tsx');
    expect(terminalSource).toContain('<HistoricalObservationDesk />');
    expect(terminalSource).toContain('data-terminal-backtest-historical-boundary="true"');
    expect(terminalSource).toContain('原“运行回测”和“高级设置”不提供虚构动作');
    expect(terminalSource).toContain('disabled title="未接入可验证策略规则、订单与成本数据，不能运行回测"');
    expect(terminalSource).toContain('const performanceData');
  });
});

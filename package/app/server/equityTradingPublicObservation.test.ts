import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('equity trading public observation boundary', () => {
  it('uses imported listings and traceable equity quotes for the default observation layer', () => {
    const source = read('client/src/components/electronic-trading/EquityExecutionObservationDesk.tsx');
    expect(source).toContain('trpc.equityListings.list.useQuery');
    expect(source).toContain('trpc.equityListings.quote.useQuery');
    expect(source).toContain('EQUITY MARKET OBSERVATION · NO EXECUTION FEED');
    expect(source).toContain('没有经纪商执行接口、逐笔成交或订单簿授权时');
    expect(source).toContain('来源：{data.source}');
  });

  it('preserves but explicitly bounds the original random execution display', () => {
    const source = read('client/src/components/electronic-trading/EquityTradingPanel.tsx');
    expect(source).toContain('<EquityExecutionObservationDesk />');
    expect(source).toContain('data-equity-trading-historical-boundary="true"');
    expect(source).toContain('不是当前事实、订单簿或执行结果');
    expect(source).toContain('const generateAlgoOrders');
    expect(source).toContain('const generateMicro');
  });
});

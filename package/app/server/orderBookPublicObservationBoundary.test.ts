import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('OMON order book public observation boundary', () => {
  it('defaults to source-backed security observation and disables random legacy order book actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'client/src/components/OrderBookPanel.tsx'), 'utf8');
    expect(source).toContain("import EquityExecutionObservationDesk from './electronic-trading/EquityExecutionObservationDesk'");
    expect(source).toContain('<EquityExecutionObservationDesk />');
    expect(source).toContain('data-order-book-historical-boundary="true"');
    expect(source).toContain('随机数量、价格路径、成交方向、刷新与详情均不是当前订单簿');
    expect(source).toContain('pointer-events-none select-none');
    expect(source).toContain('保留区已禁用交互');
  });
});

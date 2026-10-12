import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('EMSX 模拟交易来源边界', () => {
  it('路由拒绝模拟下单，并把风险接口标为来源不可用', () => {
    const source = readFileSync('server/routers/trading.ts', 'utf8');
    expect(source).toContain('SIMULATED_TRADING_LIMITATION');
    expect(source).toContain('mutation(() => { throw new Error(`来源不可用：${SIMULATED_TRADING_LIMITATION}`); })');
    expect(source).toContain('available: false, limitation: SIMULATED_TRADING_LIMITATION');
    expect(source).not.toContain('return { order, riskChecks, allPassed };');
  });

  it('EMSX 总览和订单录入显示来源不可用，而非模拟实时状态或成交结果', () => {
    const source = readFileSync('client/src/pages/ElectronicTrading.tsx', 'utf8');
    expect(source).toContain('EMSX_SOURCE_UNAVAILABLE');
    expect(source).toContain('EMSX 数据源不可用');
    expect(source).toContain('EMSX 订单录入 · 数据源不可用');
    expect(source).toContain('risk?.available &&');
    expect(source).toContain('不提供模拟下单、成交或风控通过提示。');
  });
});

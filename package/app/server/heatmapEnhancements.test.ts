/**
 * 期权链热力图三个增强功能的单元测试：
 * 1. 合约下钻（getContractIVHistory）
 * 2. 对冲策略回测（backtestHedgeStrategy）
 * 3. 自定义标的支持（validateSymbol / getOptionChain 动态生成）
 */
import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';

function createCaller() {
  return appRouter.createCaller({ user: null, req: {} as any, res: {} as any } as any);
}

describe('功能3：自定义标的支持', () => {
  it('validateSymbol 接受合法的 1-5 位字母代码', async () => {
    const caller = createCaller();
    const res = await caller.futuresOptions.validateSymbol({ symbol: 'MSFT' });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.underlying.symbol).toBe('MSFT');
      expect(res.underlying.price).toBeGreaterThan(0);
      expect(res.underlying.iv30).toBeGreaterThan(0);
    }
  });

  it('validateSymbol 拒绝非法代码（数字/过长/空）', async () => {
    const caller = createCaller();
    for (const bad of ['123', 'ABCDEF', 'A1B', '!@#']) {
      const res = await caller.futuresOptions.validateSymbol({ symbol: bad });
      expect(res.valid).toBe(false);
    }
  });

  it('validateSymbol 对同一 symbol 返回确定性一致的参数', async () => {
    const caller = createCaller();
    const a = await caller.futuresOptions.validateSymbol({ symbol: 'AMD' });
    const b = await caller.futuresOptions.validateSymbol({ symbol: 'amd' });
    expect(a.valid && b.valid).toBe(true);
    if (a.valid && b.valid) {
      expect(a.underlying.price).toBe(b.underlying.price);
      expect(a.underlying.iv30).toBe(b.underlying.iv30);
    }
  });

  it('getOptionChain 支持自定义标的并生成完整期权链', async () => {
    const caller = createCaller();
    const res = await caller.futuresOptions.getOptionChain({ symbol: 'AMD', expiryDays: 30 });
    expect(res.underlying.symbol).toBe('AMD');
    expect(res.chain.length).toBe(13);
    for (const row of res.chain) {
      expect(row.callIV).toBeGreaterThan(0);
      expect(row.callDelta).toBeGreaterThanOrEqual(0);
      expect(row.putDelta).toBeLessThanOrEqual(0);
    }
  });

  it('getOptionChain 内置标的行为不变（SPY 命中硬编码列表）', async () => {
    const caller = createCaller();
    const res = await caller.futuresOptions.getOptionChain({ symbol: 'SPY', expiryDays: 30 });
    expect(res.underlying.name).toBe('SPDR S&P 500 ETF');
    expect(res.underlying.price).toBe(545.20);
  });
});

describe('功能1：合约下钻（getContractIVHistory）', () => {
  it('返回 30 天历史 IV 序列与完整希腊字母', async () => {
    const caller = createCaller();
    const res = await caller.futuresOptions.getContractIVHistory({
      symbol: 'SPY', strike: 545, expiryDays: 30, isCall: true,
    });
    expect(res.ivHistory.length).toBe(30);
    for (const p of res.ivHistory) {
      expect(p.iv).toBeGreaterThan(0);
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // 一阶 + 二阶希腊字母齐全
    const g = res.currentGreeks;
    for (const k of ['delta', 'gamma', 'vega', 'theta', 'rho', 'vanna', 'charm', 'speed', 'vomma', 'zomma', 'color', 'ultima'] as const) {
      expect(typeof g[k]).toBe('number');
      expect(Number.isFinite(g[k])).toBe(true);
    }
    expect(res.contractInfo.theoreticalPrice).toBeGreaterThan(0);
  });

  it('同参数多次调用结果确定性一致', async () => {
    const caller = createCaller();
    const input = { symbol: 'QQQ', strike: 468, expiryDays: 30, isCall: false };
    const a = await caller.futuresOptions.getContractIVHistory(input);
    const b = await caller.futuresOptions.getContractIVHistory(input);
    expect(a.ivHistory).toEqual(b.ivHistory);
  });

  it('Call 与 Put 生成不同的 IV 序列（种子含方向）', async () => {
    const caller = createCaller();
    const call = await caller.futuresOptions.getContractIVHistory({ symbol: 'SPY', strike: 545, expiryDays: 30, isCall: true });
    const put = await caller.futuresOptions.getContractIVHistory({ symbol: 'SPY', strike: 545, expiryDays: 30, isCall: false });
    expect(call.ivHistory.map(p => p.iv)).not.toEqual(put.ivHistory.map(p => p.iv));
  });

  it('无效标的抛出 BAD_REQUEST', async () => {
    const caller = createCaller();
    await expect(
      caller.futuresOptions.getContractIVHistory({ symbol: '12345A', strike: 100, expiryDays: 30, isCall: true })
    ).rejects.toThrow();
  });

  it('Call Delta 位于 [0,1]，Put Delta 位于 [-1,0]', async () => {
    const caller = createCaller();
    const call = await caller.futuresOptions.getContractIVHistory({ symbol: 'TSLA', strike: 250, expiryDays: 60, isCall: true });
    expect(call.currentGreeks.delta).toBeGreaterThanOrEqual(0);
    expect(call.currentGreeks.delta).toBeLessThanOrEqual(1);
    const put = await caller.futuresOptions.getContractIVHistory({ symbol: 'TSLA', strike: 250, expiryDays: 60, isCall: false });
    expect(put.currentGreeks.delta).toBeLessThanOrEqual(0);
    expect(put.currentGreeks.delta).toBeGreaterThanOrEqual(-1);
  });
});

describe('功能2：对冲策略回测（backtestHedgeStrategy）', () => {
  it('Collar 策略在公开历史可用时返回完整结构，不可用时明确拒绝计算', async () => {
    const caller = createCaller();
    let res;
    try { res = await caller.futuresOptions.backtestHedgeStrategy({ symbol: 'SPY', strategyType: 'collar', range: '3mo', initialCapital: 100000 }); }
    catch (error) { expect(String(error)).toContain('不会以合成价格替代'); return; }
    expect(res.symbol).toBe('SPY');
    expect(res.strategyType).toBe('collar');
    expect(res.equityCurve.length).toBeGreaterThan(30);
    expect(res.dataSource).toBe('yahoo');
    // 指标齐全且有限
    const m = res.metrics;
    for (const k of ['totalReturn', 'benchmarkReturn', 'annualizedReturn', 'sharpe', 'maxDrawdown', 'winRate', 'numRounds', 'volatility'] as const) {
      expect(Number.isFinite(m[k])).toBe(true);
    }
    expect(m.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(m.winRate).toBeGreaterThanOrEqual(0);
    expect(m.winRate).toBeLessThanOrEqual(100);
  }, 30000);

  it('多种策略在公开历史可用时含开仓/结算记录，不可用时不生成替代结果', async () => {
    const caller = createCaller();
    for (const st of ['call_spread', 'put_spread', 'butterfly'] as const) {
      let res;
      try { res = await caller.futuresOptions.backtestHedgeStrategy({ symbol: 'QQQ', strategyType: st, range: '3mo', initialCapital: 100000 }); }
      catch (error) { expect(String(error)).toContain('不会以合成价格替代'); return; }
      expect(res.strategyType).toBe(st);
      const opens = res.trades.filter(t => t.action === 'OPEN');
      const settles = res.trades.filter(t => t.action === 'SETTLE');
      expect(opens.length).toBeGreaterThan(0);
      expect(settles.length).toBeGreaterThan(0);
      expect(res.metrics.numRounds).toBe(settles.length);
    }
  }, 60000);

  it('权益曲线在公开历史可用时以初始资金为基准起点', async () => {
    const caller = createCaller();
    let res;
    try { res = await caller.futuresOptions.backtestHedgeStrategy({ symbol: 'IWM', strategyType: 'put_spread', range: '3mo', initialCapital: 50000 }); }
    catch (error) { expect(String(error)).toContain('不会以合成价格替代'); return; }
    const first = res.equityCurve[0];
    expect(first.benchmark).toBeCloseTo(50000, 0);
    // 组合首日仅差开仓成本盯市误差，应在初始资金 ±10% 内
    expect(Math.abs(first.portfolio - 50000) / 50000).toBeLessThan(0.1);
  }, 30000);

  it('无公开历史的自定义标的明确拒绝回测，而不生成合成数据', async () => {
    const caller = createCaller();
    await expect(caller.futuresOptions.backtestHedgeStrategy({
      symbol: 'ZZZQ', strategyType: 'butterfly', range: '3mo', initialCapital: 100000,
    })).rejects.toThrow('不会以合成价格替代');
  }, 30000);

  it('无效标的代码抛出错误', async () => {
    const caller = createCaller();
    await expect(
      caller.futuresOptions.backtestHedgeStrategy({
        symbol: '99!', strategyType: 'collar', range: '3mo', initialCapital: 100000,
      })
    ).rejects.toThrow();
  });
});

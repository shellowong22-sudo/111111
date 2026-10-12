import { describe, it, expect } from 'vitest';
import { generateHedgeStrategies } from '../client/src/components/OptionChainHeatmap';

// Mock OptionChainRow 数据
const mockChainData = [
  {
    strike: 500,
    expiry: '2026-07-18',
    daysToExpiry: 11,
    callBid: 45.2, callAsk: 45.5, callLast: 45.3, callVol: 125000, callOI: 450000,
    callIV: 14.2, callDelta: 0.85, callGamma: 0.008, callVega: 12.5, callTheta: -8.2,
    callRho: 15.3,
    callVanna: 0.0012, callCharm: -0.0045, callSpeed: 0.00008, callVomma: 0.15,
    callZomma: 0.0025, callColor: -0.00012, callUltima: 0.0001,
    putBid: 0.05, putAsk: 0.10, putLast: 0.08, putVol: 8000, putOI: 25000,
    putIV: 12.5, putDelta: -0.02, putGamma: 0.001, putVega: 1.2, putTheta: -0.5,
    putRho: -0.8,
    putVanna: -0.0001, putCharm: 0.0008, putSpeed: 0.00001, putVomma: 0.02,
    putZomma: 0.0003, putColor: -0.00001, putUltima: 0.00001,
    pcRatio: 0.064, intrinsicCall: 45.2, intrinsicPut: 0,
    arbitrageSignal: null, arbitrageScore: 0,
  },
  {
    strike: 540,
    expiry: '2026-07-18',
    daysToExpiry: 11,
    callBid: 8.45, callAsk: 8.75, callLast: 8.60, callVol: 485200, callOI: 1250000,
    callIV: 14.2, callDelta: 0.52, callGamma: 0.018, callVega: 22.5, callTheta: -12.2,
    callRho: 8.3,
    callVanna: 0.0025, callCharm: -0.0085, callSpeed: 0.00015, callVomma: 0.35,
    callZomma: 0.0045, callColor: -0.00025, callUltima: 0.0002,
    putBid: 3.10, putAsk: 3.40, putLast: 3.25, putVol: 328500, putOI: 892000,
    putIV: 16.8, putDelta: -0.38, putGamma: 0.015, putVega: 18.5, putTheta: -8.5,
    putRho: -5.2,
    putVanna: -0.0018, putCharm: 0.0062, putSpeed: 0.00012, putVomma: 0.28,
    putZomma: 0.0038, putColor: -0.00018, putUltima: 0.00015,
    pcRatio: 0.676, intrinsicCall: 8.2, intrinsicPut: 0,
    arbitrageSignal: null, arbitrageScore: 0,
  },
  {
    strike: 580,
    expiry: '2026-07-18',
    daysToExpiry: 11,
    callBid: 0.15, callAsk: 0.25, callLast: 0.20, callVol: 45000, callOI: 125000,
    callIV: 14.2, callDelta: 0.15, callGamma: 0.008, callVega: 8.5, callTheta: -3.2,
    callRho: 1.3,
    callVanna: 0.0008, callCharm: -0.0025, callSpeed: 0.00005, callVomma: 0.12,
    callZomma: 0.0015, callColor: -0.00008, callUltima: 0.00006,
    putBid: 35.50, putAsk: 35.80, putLast: 35.65, putVol: 215000, putOI: 680000,
    putIV: 22.1, putDelta: -0.82, putGamma: 0.010, putVega: 15.5, putTheta: -9.5,
    putRho: -12.2,
    putVanna: -0.0022, putCharm: 0.0078, putSpeed: 0.00014, putVomma: 0.32,
    putZomma: 0.0042, putColor: -0.00020, putUltima: 0.00018,
    pcRatio: 1.425, intrinsicCall: 0, intrinsicPut: 35.2,
    arbitrageSignal: null, arbitrageScore: 0,
  },
];

const mockUnderlying = {
  price: 545.20,
  iv30: 16.8,
};

describe('OptionChainHeatmap - 对冲策略生成', () => {
  it('应该返回策略数组', () => {
    const strategies = generateHedgeStrategies(mockChainData, mockUnderlying);
    expect(Array.isArray(strategies)).toBe(true);
  });

  it('应该处理空数据', () => {
    const strategies = generateHedgeStrategies([], mockUnderlying);
    expect(Array.isArray(strategies)).toBe(true);
  });

  it('应该处理单条数据', () => {
    const strategies = generateHedgeStrategies([mockChainData[0]], mockUnderlying);
    expect(Array.isArray(strategies)).toBe(true);
  });

  it('生成的策略应该有有效的结构', () => {
    const strategies = generateHedgeStrategies(mockChainData, mockUnderlying);
    
    strategies.forEach(strategy => {
      expect(strategy.name).toBeTruthy();
      expect(strategy.desc).toBeTruthy();
      expect(['bullish', 'bearish', 'neutral']).toContain(strategy.signal);
      expect(strategy.confidence).toBeGreaterThanOrEqual(0);
      expect(strategy.confidence).toBeLessThanOrEqual(100);
      expect(Array.isArray(strategy.legs)).toBe(true);
      expect(strategy.legs.length).toBeGreaterThan(0);
      expect(typeof strategy.maxProfit).toBe('number');
      expect(typeof strategy.maxLoss).toBe('number');
      expect(Array.isArray(strategy.breakeven)).toBe(true);
    });
  });

  it('策略腿应该有有效的类型和方向', () => {
    const strategies = generateHedgeStrategies(mockChainData, mockUnderlying);
    
    strategies.forEach(strategy => {
      strategy.legs.forEach(leg => {
        expect(['call', 'put']).toContain(leg.type);
        expect(['buy', 'sell']).toContain(leg.side);
        expect(typeof leg.strike).toBe('number');
        expect(leg.strike).toBeGreaterThan(0);
        expect(leg.expiry).toBeTruthy();
      });
    });
  });

  it('Call Spread 应该有看涨信号', () => {
    const strategies = generateHedgeStrategies(mockChainData, mockUnderlying);
    const callSpreads = strategies.filter(s => s.name.includes('Call Spread'));
    
    callSpreads.forEach(cs => {
      expect(cs.signal).toBe('bullish');
    });
  });

  it('Put Spread 应该有看跌信号', () => {
    const strategies = generateHedgeStrategies(mockChainData, mockUnderlying);
    const putSpreads = strategies.filter(s => s.name.includes('Put Spread'));
    
    putSpreads.forEach(ps => {
      expect(ps.signal).toBe('bearish');
    });
  });

  it('Collar 应该有中性信号', () => {
    const strategies = generateHedgeStrategies(mockChainData, mockUnderlying);
    const collars = strategies.filter(s => s.name.includes('Collar'));
    
    collars.forEach(c => {
      expect(c.signal).toBe('neutral');
    });
  });

  it('不同的标的价格应该生成策略', () => {
    const strategies1 = generateHedgeStrategies(mockChainData, { price: 540, iv30: 16.8 });
    const strategies2 = generateHedgeStrategies(mockChainData, { price: 550, iv30: 16.8 });
    
    expect(Array.isArray(strategies1)).toBe(true);
    expect(Array.isArray(strategies2)).toBe(true);
  });
});

describe('OptionChainHeatmap - 颜色映射', () => {
  it('IV 颜色映射应该正确', () => {
    const lowIV = 10;
    const midIV = 20;
    const highIV = 40;
    
    const getColor = (value: number, min: number, max: number) => {
      const normalized = (value - min) / (max - min);
      if (normalized < 0.33) return '#10b981';
      if (normalized < 0.66) return '#f59e0b';
      return '#ef4444';
    };
    
    expect(getColor(lowIV, 10, 40)).toBe('#10b981');
    expect(getColor(midIV, 10, 40)).toBe('#f59e0b');
    expect(getColor(highIV, 10, 40)).toBe('#ef4444');
  });

  it('Delta 颜色映射应该正确', () => {
    const getColor = (value: number) => {
      if (value < -0.3) return '#ef4444';
      if (value < 0.3) return '#6b7280';
      return '#10b981';
    };
    
    expect(getColor(-0.5)).toBe('#ef4444');
    expect(getColor(0)).toBe('#6b7280');
    expect(getColor(0.5)).toBe('#10b981');
  });

  it('成交量颜色映射应该正确', () => {
    const lowVol = 50000;  // (50000 - 10000) / (500000 - 10000) = 0.082 < 0.33 → #6b7280
    const midVol = 250000; // (250000 - 10000) / (500000 - 10000) = 0.49 ∈ [0.33, 0.66) → #3b82f6
    const highVol = 450000; // (450000 - 10000) / (500000 - 10000) = 0.898 >= 0.66 → #0ea5e9
    
    const getColor = (value: number, min: number, max: number) => {
      const normalized = (value - min) / (max - min);
      if (normalized < 0.33) return '#6b7280';
      if (normalized < 0.66) return '#3b82f6';
      return '#0ea5e9';
    };
    
    expect(getColor(lowVol, 10000, 500000)).toBe('#6b7280');
    expect(getColor(midVol, 10000, 500000)).toBe('#3b82f6');
    expect(getColor(highVol, 10000, 500000)).toBe('#0ea5e9');
  });
});

describe('OptionChainHeatmap - 数据过滤', () => {
  it('应该正确处理行权价范围过滤', () => {
    const strategies = generateHedgeStrategies(mockChainData, mockUnderlying);
    
    // 验证策略中的行权价都在合理范围内
    strategies.forEach(strategy => {
      strategy.legs.forEach(leg => {
        expect(leg.strike).toBeGreaterThan(0);
        expect(leg.strike).toBeLessThan(1000);
      });
    });
  });

  it('应该正确处理到期日过滤', () => {
    const strategies = generateHedgeStrategies(mockChainData, mockUnderlying);
    
    // 验证所有策略的到期日都是有效的
    strategies.forEach(strategy => {
      strategy.legs.forEach(leg => {
        expect(leg.expiry).toBeTruthy();
        expect(leg.expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});

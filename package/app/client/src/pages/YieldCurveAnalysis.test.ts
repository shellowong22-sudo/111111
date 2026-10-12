import { describe, expect, it } from 'vitest';
import { analyzeCurveShape } from './YieldCurveAnalysis';

describe('analyzeCurveShape', () => {
  it('识别倒挂曲线并计算负斜率', () => {
    const result = analyzeCurveShape([
      { tenor: '3M', rate: 5.2, spread: 0 },
      { tenor: '2Y', rate: 4.8, spread: -0.4 },
      { tenor: '10Y', rate: 4.3, spread: -0.9 },
    ]);
    expect(result.label).toBe('倒挂 / 防御');
    expect(result.slope).toBeCloseTo(-0.9, 6);
    expect(result.twoTen).toBeCloseTo(-0.5, 6);
  });

  it('识别长端上行并计算正的 2Y–10Y 利差', () => {
    const result = analyzeCurveShape([
      { tenor: '3M', rate: 3.8, spread: 0 },
      { tenor: '2Y', rate: 4.1, spread: 0.3 },
      { tenor: '10Y', rate: 4.7, spread: 0.9 },
    ]);
    expect(result.label).toBe('陡峭上行');
    expect(result.slope).toBeCloseTo(0.9, 6);
    expect(result.twoTen).toBeCloseTo(0.6, 6);
  });

  it('数据不足时不输出方向性判断', () => {
    const result = analyzeCurveShape([{ tenor: '10Y', rate: 4.5, spread: 0 }]);
    expect(result.label).toBe('数据不足');
    expect(result.slope).toBeNull();
    expect(result.twoTen).toBeNull();
  });
});

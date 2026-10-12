import { describe, expect, it } from 'vitest';
import { evaluateArithmetic } from '../client/src/components/CIXEditors';

describe('CIXN 行情表达式求值', () => {
  const quotes = new Map([
    ['US10Y', 4.25],
    ['BUND', 2.48],
    ['AAPL', 189.4],
    ['MSFT', 415.1],
  ]);

  it('使用传入报价计算确定性的价差', () => {
    expect(evaluateArithmetic('(US10Y - BUND) * 100', quotes)).toBeCloseTo(177, 8);
  });

  it('支持价格比率和括号', () => {
    expect(evaluateArithmetic('(AAPL / MSFT) * 100', quotes)).toBeCloseTo(45.6275596, 6);
  });

  it('拒绝未知代码、非法字符和除以零', () => {
    expect(() => evaluateArithmetic('UNKNOWN + 1', quotes)).toThrow('未找到可计算的行情代码');
    expect(() => evaluateArithmetic('AAPL;alert(1)', quotes)).toThrow('只支持代码、数字、括号与 + - * / 运算符');
    expect(() => evaluateArithmetic('AAPL / 0', quotes)).toThrow('除数不能为 0');
  });
});

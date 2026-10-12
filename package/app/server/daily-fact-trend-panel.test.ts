import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(import.meta.dirname, '../client/src/components/sovereign/DailyFactTrendPanel.tsx'), 'utf8');

describe('每日事实跨日趋势面板', () => {
  it('提供真实快照 CSV 导出、指标选择和阈值控制', () => {
    expect(source).toContain('sovereign-daily-fact-trend-');
    expect(source).toContain('source_key');
    expect(source).toContain('日差阈值');
    expect(source).toContain('导出 CSV');
    expect(source).toContain('getDailyFactTrend.useQuery');
  });

  it('在达到阈值时使用视觉高亮，并保留日期、观测期和非交易信号边界', () => {
    expect(source).toContain('Math.abs(value) >= threshold');
    expect(source).toContain("fill={typeof value === 'number' && Math.abs(value) >= threshold ? '#f43f5e' : '#0ea5e9'}");
    expect(source).toContain('抓取日：');
    expect(source).toContain('观测期：');
    expect(source).toContain('不构成交易信号');
  });
});

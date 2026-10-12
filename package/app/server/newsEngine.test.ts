import { describe, it, expect } from 'vitest';
import {
  generateNewsItems,
  sortByImportance,
  sortByTime,
  sortByMove,
  groupByCategory,
  readScore,
  socialScore,
  timeAgo,
  type MarketRow,
} from '../client/src/lib/newsEngine';

const rows: MarketRow[] = [
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'stock', price: '210.5', changeVal: '-4.5', changePct: '-2.13', volume: '20000000' },
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'stock', price: '189.3', changeVal: '1.2', changePct: '0.64', volume: '5000000' },
  { symbol: 'NG1', name: 'Natural Gas', market: 'commodity', price: '2.8', changeVal: '-0.02', changePct: '-0.91', volume: '800000' },
  { symbol: 'US10Y', name: '10Y US Treasury', market: 'bond', price: '98.5', changeVal: '-0.1', changePct: '-0.12', volume: '0' },
];

describe('newsEngine', () => {
  it('generateNewsItems 为每一行生成确定性条目', () => {
    const a = generateNewsItems(rows, 0);
    const b = generateNewsItems(rows, 0);
    expect(a).toHaveLength(rows.length);
    // 确定性：同 tick 同输入结果一致
    expect(a.map(i => i.id)).toEqual(b.map(i => i.id));
    expect(a.map(i => i.minutesAgo)).toEqual(b.map(i => i.minutesAgo));
  });

  it('情绪与中文板块映射正确', () => {
    const items = generateNewsItems(rows, 0);
    const tsla = items.find(i => i.symbol === 'TSLA')!;
    const aapl = items.find(i => i.symbol === 'AAPL')!;
    expect(tsla.sentiment).toBe('negative');
    expect(aapl.sentiment).toBe('positive');
    expect(tsla.category).toBe('股票');
    expect(items.find(i => i.symbol === 'NG1')!.category).toBe('商品');
    expect(items.find(i => i.symbol === 'US10Y')!.category).toBe('债券');
  });

  it('放量大跌应判定为高重要度', () => {
    const items = generateNewsItems(rows, 0);
    const tsla = items.find(i => i.symbol === 'TSLA')!; // |2.13| + 放量(>1e7) => >2
    expect(tsla.importance).toBe('high');
  });

  it('sortByImportance 高重要度排在前', () => {
    const sorted = sortByImportance(generateNewsItems(rows, 0));
    expect(sorted[0].importance).toBe('high');
  });

  it('sortByTime 最新（minutesAgo 最小）在前', () => {
    const sorted = sortByTime(generateNewsItems(rows, 0));
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].minutesAgo).toBeGreaterThanOrEqual(sorted[i - 1].minutesAgo);
    }
  });

  it('sortByMove 按绝对涨跌幅降序', () => {
    const sorted = sortByMove(generateNewsItems(rows, 0));
    for (let i = 1; i < sorted.length; i++) {
      expect(Math.abs(sorted[i - 1].changePct)).toBeGreaterThanOrEqual(Math.abs(sorted[i].changePct));
    }
  });

  it('groupByCategory 按中文板块聚合', () => {
    const grouped = groupByCategory(generateNewsItems(rows, 0));
    expect(grouped['股票']).toHaveLength(2);
    expect(grouped['商品']).toHaveLength(1);
    expect(grouped['债券']).toHaveLength(1);
  });

  it('readScore 为正数且高重要度更高', () => {
    const items = generateNewsItems(rows, 0);
    for (const it of items) expect(readScore(it)).toBeGreaterThan(0);
  });

  it('socialScore 落在 2-98 区间，涨跌方向影响偏离', () => {
    const items = generateNewsItems(rows, 0);
    for (const it of items) {
      const s = socialScore(it);
      expect(s).toBeGreaterThanOrEqual(2);
      expect(s).toBeLessThanOrEqual(98);
    }
    const tsla = items.find(i => i.symbol === 'TSLA')!;
    const aapl = items.find(i => i.symbol === 'AAPL')!;
    expect(socialScore(aapl)).toBeGreaterThan(socialScore(tsla));
  });

  it('timeAgo 输出合理的中文时间标签', () => {
    expect(timeAgo(5)).toBe('5 分钟前');
    expect(timeAgo(60)).toBe('1 小时前');
    expect(timeAgo(125)).toBe('2 小时 5 分前');
  });
});

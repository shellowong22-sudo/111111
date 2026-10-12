import { describe, it, expect } from 'vitest';
import {
  COLUMNS, deriveColumns, buildSparkline, RANK_VIEWS, TIME_MENU,
} from '../client/src/lib/gmmData';

describe('GMM 全球宏观市场驱动者数据', () => {
  it('5 列资产分组齐全且名称正确', () => {
    expect(COLUMNS).toHaveLength(5);
    expect(COLUMNS.map(c => c.title)).toEqual(['股票指数', '外汇', '主权债', '大宗商品', '主权债CDS']);
  });

  it('每列至少 6 个卡片', () => {
    for (const col of COLUMNS) expect(col.tiles.length).toBeGreaterThanOrEqual(6);
  });

  it('排行视图与时间菜单选项数量符合截图', () => {
    expect(RANK_VIEWS.排行视图).toHaveLength(3);
    expect(RANK_VIEWS.其他视图).toHaveLength(1);
    expect(TIME_MENU.recent).toHaveLength(3);
    expect(TIME_MENU.toDate.map(t => t.label)).toEqual(['月至今', '季至今', '年至今']);
  });

  it('gainers 视图所有 change 非负且按降序排列', () => {
    const cols = deriveColumns('gainers', '1D');
    for (const col of cols) {
      for (const t of col.tiles) expect(t.change).toBeGreaterThanOrEqual(0);
      for (let i = 1; i < col.tiles.length; i++) {
        expect(col.tiles[i - 1].change).toBeGreaterThanOrEqual(col.tiles[i].change);
      }
    }
  });

  it('losers 视图所有 change 非正且按升序排列', () => {
    const cols = deriveColumns('losers', '1D');
    for (const col of cols) {
      for (const t of col.tiles) expect(t.change).toBeLessThanOrEqual(0);
      for (let i = 1; i < col.tiles.length; i++) {
        expect(col.tiles[i - 1].change).toBeLessThanOrEqual(col.tiles[i].change);
      }
    }
  });

  it('trend 方向与 change 符号一致', () => {
    const cols = deriveColumns('volatility', 'MTD');
    for (const col of cols) {
      for (const t of col.tiles) {
        expect(t.trend).toBe(t.change >= 0 ? 'up' : 'down');
      }
    }
  });

  it('volatility 视图按 |change| 降序排列', () => {
    const cols = deriveColumns('volatility', '1D');
    for (const col of cols) {
      for (let i = 1; i < col.tiles.length; i++) {
        expect(Math.abs(col.tiles[i - 1].change)).toBeGreaterThanOrEqual(Math.abs(col.tiles[i].change));
      }
    }
  });

  it('不同时间范围产生不同幅度（MTD 比 1D 放大）', () => {
    const d1 = deriveColumns('gainers', '1D')[0].tiles[0].change;
    const mtd = deriveColumns('gainers', 'MTD')[0].tiles[0].change;
    expect(mtd).toBeGreaterThan(d1);
  });

  it('buildSparkline 生成确定性点序列', () => {
    const a = buildSparkline('WTI原油', 'up');
    const b = buildSparkline('WTI原油', 'up');
    expect(a).toEqual(b);
    expect(a).toHaveLength(24);
    expect(a.every(p => typeof p.v === 'number')).toBe(true);
  });
});

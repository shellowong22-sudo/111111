import { describe, it, expect } from 'vitest';
import {
  CURVE_MENU_GROUPS, CURVE_MENU_ID,
  MARKET_SIDE_OPTIONS, INTERPOLATION_OPTIONS, YIELD_ADJUST_OPTIONS,
  KRR_SHIFT_OPTIONS, DV01_MOVE_OPTIONS,
  DEFAULT_YCDF_SETTINGS, findOptionLabel, validateDefaults, totalCurveMenuItems,
} from '../client/src/lib/ycurveData';

describe('收益曲线子菜单', () => {
  it('共 4 组语义、合计 12 项功能', () => {
    // 数据上分 3 组（自设曲线含 YCDF+CRVF，UI 再拆为"自设曲线/查找曲线"）
    expect(CURVE_MENU_GROUPS.length).toBe(3);
    expect(totalCurveMenuItems()).toBe(12);
  });

  it('编号 1..12 连续且唯一', () => {
    const nums = CURVE_MENU_GROUPS.flatMap(g => g.items.map(i => i.num)).sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('YCDF 与 GC 项存在，GC 标记为 AI', () => {
    const all = CURVE_MENU_GROUPS.flatMap(g => g.items);
    const ycdf = all.find(i => i.ticker === 'YCDF');
    const gc = all.find(i => i.ticker === 'GC');
    expect(ycdf?.name).toBe('现金曲线设定');
    expect(gc?.ai).toBe(true);
  });

  it('MenuId 为 5578', () => {
    expect(CURVE_MENU_ID).toBe('5578');
  });
});

describe('YCDF 现金曲线设定下拉选项', () => {
  it('预设市场方 = 买价/中价/卖价', () => {
    expect(MARKET_SIDE_OPTIONS.map(o => o.label)).toEqual(['买价', '中价', '卖价']);
  });

  it('内插法含 4 种方法', () => {
    expect(INTERPOLATION_OPTIONS.length).toBe(4);
    expect(INTERPOLATION_OPTIONS[2].label).toContain('阶跃函数远期');
  });

  it('KRR 移动方法含 Tent移动 与 篮子', () => {
    expect(KRR_SHIFT_OPTIONS.map(o => o.label)).toEqual(['1 - Tent移动', '2 - 篮子']);
  });

  it('DV01/KRR 曲线移动选项含 4 项', () => {
    expect(DV01_MOVE_OPTIONS.length).toBe(4);
    expect(DV01_MOVE_OPTIONS[0].label).toContain('移动曲线工具');
  });

  it('收益率调整方法含彭博调整方法', () => {
    expect(YIELD_ADJUST_OPTIONS.some(o => o.label.includes('彭博调整方法'))).toBe(true);
  });
});

describe('YCDF 默认设定', () => {
  it('默认值与截图一致（卖价/阶跃函数远期/彭博调整/Tent移动/移动曲线工具）', () => {
    expect(findOptionLabel(MARKET_SIDE_OPTIONS, DEFAULT_YCDF_SETTINGS.marketSide)).toBe('卖价');
    expect(findOptionLabel(INTERPOLATION_OPTIONS, DEFAULT_YCDF_SETTINGS.interpolation)).toContain('阶跃函数远期');
    expect(findOptionLabel(YIELD_ADJUST_OPTIONS, DEFAULT_YCDF_SETTINGS.yieldAdjust)).toContain('彭博调整方法');
    expect(findOptionLabel(KRR_SHIFT_OPTIONS, DEFAULT_YCDF_SETTINGS.krrShift)).toContain('Tent移动');
    expect(findOptionLabel(DV01_MOVE_OPTIONS, DEFAULT_YCDF_SETTINGS.dv01Move)).toContain('移动曲线工具');
  });

  it('退回拟合 与 Fallback to default PCS 默认勾选', () => {
    expect(DEFAULT_YCDF_SETTINGS.fallbackFit).toBe(true);
    expect(DEFAULT_YCDF_SETTINGS.fallbackToDefaultPcs).toBe(true);
  });

  it('所有默认下拉值均可在选项中解析', () => {
    expect(validateDefaults(DEFAULT_YCDF_SETTINGS)).toBe(true);
  });
});

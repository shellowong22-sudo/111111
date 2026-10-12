// 收益曲线 (Yield Curve) 子菜单与 YCDF 现金曲线设定数据
// MenuId: 5578

export interface CurveMenuItem {
  num: number;
  ticker?: string;
  name: string;
  ai?: boolean;
}

export interface CurveMenuGroup {
  title: string;
  items: CurveMenuItem[];
}

// 收益曲线子菜单：4 组 12 项
export const CURVE_MENU_GROUPS: CurveMenuGroup[] = [
  {
    title: '自设曲线',
    items: [
      { num: 1, ticker: 'YCDF', name: '现金曲线设定' },
      { num: 2, ticker: 'CRVF', name: '查找曲线' },
    ],
  },
  {
    title: '当前及历史曲线',
    items: [
      { num: 3, ticker: 'GC', name: '绘制曲线图', ai: true },
      { num: 4, ticker: 'GCT', name: '图表曲线期间' },
      { num: 5, ticker: 'FWCV', name: '远期曲线分析' },
      { num: 6, ticker: 'FWCM', name: '远期曲线矩阵' },
      { num: 7, ticker: 'ICUR', name: '内插收益率' },
      { num: 8, ticker: 'BNCH', name: '公司基准债券' },
      { num: 9, ticker: 'ICVS', name: '掉期曲线建立' },
      { num: 10, ticker: 'GC3D', name: '绘制曲线层面' },
      { num: 11, ticker: 'CRV', name: '自设曲线设定' },
    ],
  },
  {
    title: '波动率',
    items: [
      { num: 12, ticker: 'VCUB', name: '利率波动率立方图' },
    ],
  },
];

export const CURVE_MENU_ID = '5578';

// YCDF 现金曲线设定 — 各下拉选项
export interface SelectOption {
  value: string;   // 选项编号
  label: string;   // 显示文字（含编号前缀）
}

// 预设市场方
export const MARKET_SIDE_OPTIONS: SelectOption[] = [
  { value: '1', label: '买价' },
  { value: '2', label: '中价' },
  { value: '3', label: '卖价' },
];

// 内插法
export const INTERPOLATION_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 - 分段线性（简单复利）' },
  { value: '2', label: '2 - 平滑远期/分段乘方' },
  { value: '3', label: '3 - 阶跃函数远期' },
  { value: '4', label: '4 - 分段线性（连续复利）' },
];

// 收益率调整方法
export const YIELD_ADJUST_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 - 不调整' },
  { value: '2', label: '2 - 简单调整方法' },
  { value: '3', label: '3 - 佑诚调整方法' },
];

// KRR 移动方法
export const KRR_SHIFT_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 - Tent移动' },
  { value: '2', label: '2 - 篮子' },
];

// DV01/KRR 曲线移动选项
export const DV01_MOVE_OPTIONS: SelectOption[] = [
  { value: '1', label: '1 - 移动曲线工具' },
  { value: '2', label: '2 - 移动为远期' },
  { value: '3', label: '3 - 随债券移动' },
  { value: '4', label: '4 - 移动为零利率' },
];

// YCDF 默认设定值
export interface YcdfSettings {
  marketSide: string;       // 预设市场方
  interpolation: string;    // 内插法
  fallbackFit: boolean;     // 退回拟合
  yieldAdjust: string;      // 收益率调整方法
  krrShift: string;         // KRR 移动方法
  dv01Move: string;         // DV01/KRR 曲线移动选项
  curveCcyConvention: string; // DV01/KRR曲线移动货币/曲线常规（禁用）
  iycCurvePcs: string;      // IYC Curve PCS
  fallbackToDefaultPcs: boolean; // Fallback to default PCS
}

export const DEFAULT_YCDF_SETTINGS: YcdfSettings = {
  marketSide: '3',          // 卖价
  interpolation: '3',       // 阶跃函数远期
  fallbackFit: true,        // ☑ 退回拟合
  yieldAdjust: '3',         // 彭博调整方法
  krrShift: '1',            // Tent移动
  dv01Move: '1',            // 移动曲线工具
  curveCcyConvention: '',   // 禁用
  iycCurvePcs: '',
  fallbackToDefaultPcs: true,
};

// 工具函数：根据 value 找 label
export function findOptionLabel(options: SelectOption[], value: string): string {
  return options.find(o => o.value === value)?.label ?? '';
}

// 校验：所有下拉默认值都能在选项中找到
export function validateDefaults(settings: YcdfSettings): boolean {
  return (
    !!findOptionLabel(MARKET_SIDE_OPTIONS, settings.marketSide) &&
    !!findOptionLabel(INTERPOLATION_OPTIONS, settings.interpolation) &&
    !!findOptionLabel(YIELD_ADJUST_OPTIONS, settings.yieldAdjust) &&
    !!findOptionLabel(KRR_SHIFT_OPTIONS, settings.krrShift) &&
    !!findOptionLabel(DV01_MOVE_OPTIONS, settings.dv01Move)
  );
}

// 子菜单总项数（用于测试断言）
export function totalCurveMenuItems(): number {
  return CURVE_MENU_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
}

// 利差与下渗数据定义

export const CR_OPTIONS = [
  { id: '1', label: '利差图', value: 'spread_chart' },
  { id: '2', label: '利差与下渗', value: 'spread_drop' },
  { id: '3', label: '国债流动性指指数', value: 'liquidity_index' },
  { id: '4', label: '面首拟合收益率', value: 'fitted_yield' },
];

export const VIEW_OPTIONS = [
  { id: '1', label: '堆叠视图', value: 'stacked' },
  { id: '2', label: '并列视图', value: 'parallel' },
  { id: '3', label: '仅限利差', value: 'spread_only' },
  { id: '4', label: '仅限下渗', value: 'drop_only' },
  { id: '5', label: '总计', value: 'total' },
];

export const TERM_RANGES = [
  { id: '15', label: '1-3年', value: '1-3y' },
  { id: '16', label: '3-5年', value: '3-5y' },
  { id: '17', label: '5-7年', value: '5-7y' },
  { id: '18', label: '7-10年', value: '7-10y' },
  { id: '19', label: '10-20年', value: '10-20y' },
  { id: '20', label: '20年+', value: '20y+' },
];

export const Y_AXIS_OPTIONS_SPREAD = [
  { id: '1', label: '利差与下渗', value: 'spread_drop' },
  { id: '2', label: '相对价值', value: 'relative_value' },
  { id: '3', label: '简介', value: 'brief' },
];

export const BOND_DATA_TABLE: Array<{ range: string; code: string; value: number }> = [];

// 生成利差与下渗数据
export function generateSpreadDropData(terms: string[]) {
  return terms.map((term) => ({ term, spread: null as number | null, drop: null as number | null }));
}

// 生成堆叠视图数据
export function generateStackedData(terms: string[]) {
  return generateSpreadDropData(terms);
}

// 生成并列视图数据
export function generateParallelData(terms: string[]) {
  return generateSpreadDropData(terms);
}

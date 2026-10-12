// 多期限维度交易员界面字典。市场数值由页面消费后端真实分片，不在客户端生成。
export const TERM_DIMENSIONS = ['0-1y', '1-3y', '3-5y', '5-7y', '7-10y', '10-20y', '20y+'] as const;
export type TermDimension = typeof TERM_DIMENSIONS[number];

export const SPLINE_INDICES = [
  { value: 'spline-spread', label: '样条利差指数' },
  { value: 'cubic-spline', label: '三次样条利差' },
  { value: 'term-match-asw', label: '期限匹配ASW' },
  { value: 'par-value-asw', label: '面值ASW' },
  { value: 'z-spread', label: 'Z-利差' },
  { value: 'yield-rate', label: '收益率' }
];

export const TIME_RANGES = [
  { value: '1M', label: '1个月' },
  { value: '3M', label: '3个月' },
  { value: '6M', label: '6个月' },
  { value: '1Y', label: '1年' }
];

export const Y_AXIS_INDICATORS = [
  { value: 'spread', label: '利差' },
  { value: 'daily-change', label: '日变动' },
  { value: 'z-score', label: 'Z-评分' },
  { value: 'percentile', label: '百分位' },
  { value: 'min-value', label: '最低' },
  { value: 'max-value', label: '最高' }
];

export const INSTRUMENTS = [
  { code: 'GOVY', name: '国债期货' },
  { code: 'BTMM', name: '中期国债期货' },
  { code: 'GBM', name: '长期国债期货' },
  { code: 'YAS', name: '日本国债期货' },
  { code: 'TKA', name: '土耳其国债期货' },
  { code: 'GTP', name: '欧洲国债期货' },
  { code: 'GPC', name: '加拿大国债期货' }
];

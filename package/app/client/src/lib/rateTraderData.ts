// 利率交易员数据定义

export const SPLINE_INDEX_OPTIONS = [
  { id: '1', label: '样条利差指数', value: 'spline_spread' },
  { id: '2', label: '三次样条利差', value: 'cubic_spline' },
  { id: '3', label: '期限匹配ASW、OIS贴现', value: 'term_match_asw' },
  { id: '4', label: '面值ASW、OIS贴现', value: 'par_asw' },
  { id: '5', label: 'Z-利差、OIS贴现', value: 'z_spread' },
  { id: '6', label: '收益率', value: 'yield' },
];

export const TIME_RANGE_OPTIONS = [
  { id: '1M', label: '1个月', value: '1m' },
  { id: '3M', label: '3个月', value: '3m' },
  { id: '6M', label: '6个月', value: '6m' },
  { id: '1Y', label: '1年', value: '1y' },
];

export const Y_AXIS_OPTIONS = [
  { id: '1', label: '利差', value: 'spread' },
  { id: '2', label: '日变动', value: 'daily_change' },
  { id: '3', label: 'Z-评分', value: 'z_score' },
  { id: '4', label: '百分位', value: 'percentile' },
  { id: '5', label: '最低', value: 'minimum' },
  { id: '6', label: '最高', value: 'maximum' },
];

export const TERM_OPTIONS = ['3H', '6M', '1Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y', '50Y', '100Y'];

export const INSTRUMENT_LIST = [
  { code: 'YCDF', name: '现金曲线设定', type: 'curve' },
  { code: 'YCDI', name: '内插曲线', type: 'curve' },
  { code: 'YCRF', name: '远期曲线', type: 'curve' },
  { code: 'YCBM', name: '基准曲线', type: 'curve' },
];

// 确定性伪随机（基于种子，不依赖 Math.random，渲染稳定）
function seededRand(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff;
  };
}

function hashStr(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * 生成期限矩阵数据（确定性：相同 rows/cols/indexId 始终返回相同值）
 * 利差值基于期限结构（长端利差通常更高），加入少量噪声
 */
export function generateTermMatrix(rows: string[], cols: string[], indexId = 'default'): number[][] {
  const rand = seededRand(hashStr(indexId + rows.join('') + cols.join('')));
  // 利率曲线基准：短端低、长端高（正常收益率曲线形态）
  const termBasis: Record<string, number> = {
    '3H': 85, '6M': 90, '1Y': 95, '3Y': 105, '5Y': 115,
    '7Y': 122, '10Y': 130, '20Y': 145, '30Y': 155, '50Y': 165, '100Y': 175,
  };
  return rows.map((row) =>
    cols.map((col) => {
      const base = (termBasis[row] ?? 100) + (termBasis[col] ?? 100) * 0.05;
      const noise = (rand() - 0.5) * 8; // ±4 bps 噪声
      return parseFloat((base + noise).toFixed(2));
    })
  );
}

/**
 * 生成散点图数据（确定性：相同 terms/indexId 始终返回相同值）
 * 利差随期限递增，日变动基于期限波动特征
 */
export function generateScatterData(terms: string[], indexId = 'default') {
  const rand = seededRand(hashStr(indexId + terms.join('')));
  const termBasis: Record<string, number> = {
    '3H': 85, '6M': 92, '1Y': 98, '3Y': 108, '5Y': 118,
    '7Y': 125, '10Y': 133, '20Y': 148, '30Y': 158, '50Y': 168, '100Y': 178,
  };
  return terms.map((term) => {
    const base = termBasis[term] ?? (100 + terms.indexOf(term) * 5);
    const noise = (rand() - 0.5) * 6;
    const change = (rand() - 0.5) * 2.5;
    return {
      term,
      value: parseFloat((base + noise).toFixed(2)),
      change: parseFloat(change.toFixed(3)),
      color: change >= 0 ? 'up' : 'down',
    };
  });
}

/**
 * 生成成交量数据（确定性：相同 terms/indexId 始终返回相同值）
 * 成交量在中短端（1Y-10Y）最活跃，两端较低
 */
export function generateVolumeData(terms: string[], indexId = 'default') {
  const rand = seededRand(hashStr(indexId + terms.join('') + 'vol'));
  const activityPeak: Record<string, number> = {
    '3H': 2000, '6M': 4500, '1Y': 8000, '3Y': 12000, '5Y': 15000,
    '7Y': 13000, '10Y': 18000, '20Y': 9000, '30Y': 6000, '50Y': 3000, '100Y': 1500,
  };
  return terms.map((term) => {
    const base = activityPeak[term] ?? 5000;
    const noise = rand() * base * 0.3;
    return {
      term,
      volume: Math.floor(base + noise),
    };
  });
}

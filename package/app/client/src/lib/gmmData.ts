// GMM 全球宏观市场驱动者 —— 静态数据与纯函数库

export type GMMUnit = 'pct' | 'bp';

export interface GMMTile {
  name: string;          // 资产名称
  value: number;         // 当前值
  valueSuffix?: string;  // 当前值后缀标记，如 c / d / 数字角标省略
  change: number;        // 涨跌幅（pct: %，bp: 基点）
  unit: GMMUnit;         // 涨跌幅单位
  delta: number;         // 绝对变动值（显示在右下）
  // 走势曲线方向标识（用于生成迷你 sparkline）
  trend: 'up' | 'down';
}

export interface GMMColumn {
  title: string;
  tiles: GMMTile[];
}

// ─── 基准数据（对应截图 1D / 波动最大视图）───────────────────────────────────
export const COLUMNS: GMMColumn[] = [
  {
    title: '股票指数',
    tiles: [
      { name: '日本日经', value: 64179.27, valueSuffix: 'c', change: -1.89, unit: 'pct', delta: -1237.3, trend: 'down' },
      { name: '德国DAX', value: 24292.10, change: -0.58, unit: 'pct', delta: -140.96, trend: 'down' },
      { name: '英国富时100指数', value: 10191.89, change: -0.35, unit: 'pct', delta: -35.44, trend: 'down' },
      { name: '标普500', value: 7386.65, valueSuffix: 'c', change: -0.26, unit: 'pct', delta: -19.08, trend: 'down' },
      { name: '荷兰AEX', value: 1044.31, valueSuffix: 'd', change: -0.24, unit: 'pct', delta: -2.55, trend: 'down' },
      { name: '比利时20', value: 5578.04, valueSuffix: 'd', change: 0.23, unit: 'pct', delta: 12.92, trend: 'up' },
    ],
  },
  {
    title: '外汇',
    tiles: [
      { name: '加拿大元', value: 1.3933, change: 0.12, unit: 'pct', delta: -0.0016, trend: 'up' },
      { name: '欧元', value: 1.1557, change: 0.12, unit: 'pct', delta: 0.0014, trend: 'up' },
      { name: '瑞典克朗', value: 9.4835, change: -0.15, unit: 'pct', delta: 0.0139, trend: 'down' },
      { name: '美元指数', value: 1209.89, change: -0.06, unit: 'pct', delta: -0.75, trend: 'down' },
      { name: '英镑', value: 1.3388, change: 0.06, unit: 'pct', delta: 0.0008, trend: 'up' },
      { name: '日元', value: 160.42, change: -0.04, unit: 'pct', delta: 0.06, trend: 'down' },
    ],
  },
  {
    title: '主权债',
    tiles: [
      { name: '日本2年期', value: 1.410, change: 1.1, unit: 'bp', delta: 0, trend: 'up' },
      { name: '德国2年期', value: 2.683, change: 2.3, unit: 'bp', delta: 0, trend: 'up' },
      { name: '美国30年期', value: 5.009, change: 1.2, unit: 'bp', delta: 0, trend: 'up' },
      { name: '意大利2年期', value: 2.847, change: 2.5, unit: 'bp', delta: 0, trend: 'up' },
      { name: '比利时2年期', value: 2.740, change: 2.1, unit: 'bp', delta: 0, trend: 'up' },
      { name: '荷兰2年期', value: 2.669, change: 1.9, unit: 'bp', delta: 0, trend: 'up' },
    ],
  },
  {
    title: '大宗商品',
    tiles: [
      { name: '钢SHF', value: 3166, valueSuffix: 'c', change: 0.54, unit: 'pct', delta: 17, trend: 'up' },
      { name: 'KC小麦CBT', value: 638.5, change: 1.23, unit: 'pct', delta: 7.75, trend: 'up' },
      { name: '取暖油NYM', value: 351.65, change: -0.71, unit: 'pct', delta: -2.53, trend: 'down' },
      { name: 'WTI原油', value: 87.61, change: -0.67, unit: 'pct', delta: -0.59, trend: 'down' },
      { name: '英国天然气', value: 117.910, valueSuffix: 'd', change: 0.61, unit: 'pct', delta: 0.720, trend: 'up' },
      { name: '布伦特原油', value: 90.95, valueSuffix: 'd', change: -0.55, unit: 'pct', delta: -0.50, trend: 'down' },
    ],
  },
  {
    title: '主权债CDS',
    tiles: [
      { name: '加拿大信用违约掉期', value: 13.99, valueSuffix: 'c', change: -0.93, unit: 'bp', delta: 0, trend: 'down' },
      { name: '德国CDS', value: 7.86, change: -0.37, unit: 'bp', delta: 0, trend: 'down' },
      { name: '英国CDS', value: 18.86, change: -0.27, unit: 'bp', delta: 0, trend: 'down' },
      { name: '瑞典CDS', value: 7.66, valueSuffix: 'c', change: 0.07, unit: 'bp', delta: 0, trend: 'up' },
      { name: '法国CDS', value: 28.40, change: 0.16, unit: 'bp', delta: 0, trend: 'up' },
      { name: '荷兰CDS', value: 7.66, valueSuffix: 'c', change: 0.04, unit: 'bp', delta: 0, trend: 'up' },
    ],
  },
];

// ─── 顶部下拉菜单选项 ─────────────────────────────────────────────────────────
export const RANK_VIEWS = {
  排行视图: [
    { id: '1', label: '波动最大', key: 'volatility' as const },
    { id: '2', label: '涨幅最大', key: 'gainers' as const },
    { id: '3', label: '跌幅最大', key: 'losers' as const },
  ],
  其他视图: [
    { id: '4', label: '按地区', key: 'region' as const },
  ],
};
export type RankKey = 'volatility' | 'gainers' | 'losers' | 'region';

export const TIME_MENU = {
  recent: [
    { id: '15m', label: '过去15分钟' },
    { id: '30m', label: '过去30分钟' },
    { id: '1h', label: '过去1小时' },
  ],
  toDate: [
    { id: 'MTD', label: '月至今' },
    { id: 'QTD', label: '季至今' },
    { id: 'YTD', label: '年至今' },
  ],
  custom: { id: 'custom', label: '自设日期和时间…' },
};

export const MY_MARKETS = ['我的市场', '发达市场', '新兴市场', 'G10 外汇', '能源与金属'];

// ─── 派生：根据排行视图与时间范围重算卡片 ────────────────────────────────────
// 不同视图/时间会对涨跌做确定性扰动（合理填充，非随机），保证可测试。
function seedFactor(rank: RankKey, time: string): number {
  const rankSeed: Record<RankKey, number> = { volatility: 1, gainers: 1.4, losers: -1.4, region: 0.8 };
  const timeSeed: Record<string, number> = {
    '1D': 1, '15m': 0.2, '30m': 0.35, '1h': 0.6,
    MTD: 2.1, QTD: 3.4, YTD: 5.2, custom: 1.5,
  };
  return rankSeed[rank] * (timeSeed[time] ?? 1);
}

export function deriveColumns(rank: RankKey, time: string): GMMColumn[] {
  const f = seedFactor(rank, time);
  return COLUMNS.map(col => {
    const tiles = col.tiles.map(t => {
      // change 按因子缩放；gainers/losers 视图强制符号方向
      let change = +(t.change * f).toFixed(t.unit === 'bp' ? 1 : 2);
      if (rank === 'gainers') change = Math.abs(change);
      if (rank === 'losers') change = -Math.abs(change);
      const trend: 'up' | 'down' = change >= 0 ? 'up' : 'down';
      const delta = +(t.delta * Math.abs(f)).toFixed(4);
      return { ...t, change, trend, delta };
    });
    // 各视图按 |change| 排序，模拟"波动/涨幅/跌幅最大"
    const sorted = [...tiles];
    if (rank === 'volatility') sorted.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    else if (rank === 'gainers') sorted.sort((a, b) => b.change - a.change);
    else if (rank === 'losers') sorted.sort((a, b) => a.change - b.change);
    return { title: col.title, tiles: sorted };
  });
}

// 生成确定性 sparkline 数据点（供迷你走势图使用）
export function buildSparkline(seedName: string, trend: 'up' | 'down', points = 24): { i: number; v: number }[] {
  let acc = 0;
  for (let i = 0; i < seedName.length; i++) acc += seedName.charCodeAt(i);
  const arr: { i: number; v: number }[] = [];
  let v = 50;
  for (let i = 0; i < points; i++) {
    const wobble = Math.sin((acc + i * 7) * 0.6) * 6 + Math.cos((acc + i * 3) * 0.9) * 4;
    const drift = (trend === 'up' ? 1 : -1) * (i / points) * 18;
    v = 50 + drift + wobble;
    arr.push({ i, v: +v.toFixed(2) });
  }
  return arr;
}

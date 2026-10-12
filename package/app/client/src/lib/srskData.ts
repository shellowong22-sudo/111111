// SRSK 主权债信用风险 — 静态数据与纯函数（与 SRSKPanel.tsx 共享，便于单测）

export interface SRSKRow {
  n: number;
  name: string;
  flag: string;
  cur: number;   // 当前 1年违约概率(%)
  lo: number;    // 最低
  hi: number;    // 最高
  avg: number;   // 平均
  chg: number;   // 变动
  model: number; // 5年CDS 模型
  market: number | null; // 5年CDS 市场
}

export interface CountryDetail {
  name: string;
  flag: string;
  ig: string;
  dp: number;
  modelCDS: number;
  marketCDS: number | null;
  inflation: number;
  gdpPerCapitaUSD: number;
  gdpPerCapita: number;
  gdpGrowth: number;
  npl: number;
  political: number;
  news: { id: number; title: string; src: string; date: string }[];
}

export const RESERVE_ROWS: SRSKRow[] = [
  { n: 12, name: '黑山',     flag: '🇲🇪', cur: 0.40, lo: 0.37, hi: 0.91, avg: 0.50, chg: -0.51, model: 87, market: null },
  { n: 13, name: '保加利亚', flag: '🇧🇬', cur: 0.33, lo: 0.05, hi: 0.33, avg: 0.13, chg: 0.11, model: 64, market: 45 },
  { n: 14, name: '拉脱维亚', flag: '🇱🇻', cur: 0.32, lo: 0.15, hi: 0.48, avg: 0.31, chg: 0.08, model: 45, market: 53 },
  { n: 15, name: '爱沙尼亚', flag: '🇪🇪', cur: 0.29, lo: 0.14, hi: 0.50, avg: 0.28, chg: 0.02, model: 47, market: 46 },
  { n: 16, name: '斯洛伐克', flag: '🇸🇰', cur: 0.28, lo: 0.20, hi: 0.46, avg: 0.29, chg: 0.04, model: 60, market: 43 },
  { n: 17, name: '希腊',     flag: '🇬🇷', cur: 0.24, lo: 0.21, hi: 11.94, avg: 3.56, chg: -4.96, model: 28, market: 29 },
  { n: 18, name: '葡萄牙',   flag: '🇵🇹', cur: 0.21, lo: 0.15, hi: 0.77, avg: 0.35, chg: -0.55, model: 19, market: 15 },
  { n: 19, name: '克罗地亚', flag: '🇭🇷', cur: 0.21, lo: 0.06, hi: 1.45, avg: 0.49, chg: -1.24, model: 30, market: 52 },
  { n: 20, name: '塞浦路斯', flag: '🇨🇾', cur: 0.20, lo: 0.19, hi: 6.41, avg: 0.91, chg: -6.21, model: 30, market: 40 },
  { n: 21, name: '西班牙',   flag: '🇪🇸', cur: 0.20, lo: 0.14, hi: 0.95, avg: 0.29, chg: -0.06, model: 34, market: 16 },
];

export const NON_RESERVE_ROWS: SRSKRow[] = [
  { n: 23, name: '委内瑞拉', flag: '🇻🇪', cur: 91.78, lo: 0.11, hi: 91.97, avg: 27.35, chg: 82.88, model: 1583, market: null },
  { n: 24, name: '苏丹',     flag: '🇸🇩', cur: 83.32, lo: 17.08, hi: 94.70, avg: 56.21, chg: 45.82, model: 8055, market: null },
  { n: 25, name: '黎巴嫩',   flag: '🇱🇧', cur: 48.45, lo: 0.07, hi: 56.80, avg: 10.02, chg: 48.22, model: 527, market: null },
  { n: 26, name: '塞内加尔', flag: '🇸🇳', cur: 40.74, lo: 21.30, hi: 44.99, avg: 32.69, chg: -3.58, model: 2635, market: null },
  { n: 27, name: '玻利维亚', flag: '🇧🇴', cur: 36.35, lo: 0.11, hi: 41.81, avg: 7.12, chg: 35.11, model: 354, market: null },
  { n: 28, name: '象牙海岸', flag: '🇨🇮', cur: 30.53, lo: 17.97, hi: 63.04, avg: 39.59, chg: -29.24, model: 1929, market: 365 },
  { n: 29, name: '阿根廷',   flag: '🇦🇷', cur: 27.28, lo: 0.34, hi: 43.15, avg: 13.20, chg: 22.06, model: 211, market: 544 },
  { n: 30, name: '莫桑比克', flag: '🇲🇿', cur: 25.32, lo: 0.79, hi: 32.28, avg: 14.21, chg: 20.73, model: 348, market: null },
  { n: 31, name: '土耳其',   flag: '🇹🇷', cur: 23.60, lo: 1.53, hi: 32.81, avg: 11.03, chg: 22.07, model: 389, market: 240 },
  { n: 32, name: '巴基斯坦', flag: '🇵🇰', cur: 20.10, lo: 0.30, hi: 43.14, avg: 12.91, chg: 19.54, model: 465, market: 423 },
];

export const COUNTRY_DETAILS: Record<string, CountryDetail> = {
  '西班牙': {
    name: 'Spain', flag: '🇪🇸', ig: 'IG6', dp: 0.2012, modelCDS: 34, marketCDS: 16,
    inflation: 2.867, gdpPerCapitaUSD: 38290, gdpPerCapita: 27677, gdpGrowth: 2.507, npl: 2.816, political: 72,
    news: [
      { id: 2, title: `Pope Urges Justice for Clergy Abuse Victims During Spain Visit`, src: 'BN', date: '06/08' },
      { id: 3, title: `Spain Yields Mostly Lower`, src: 'BN', date: '06/09' },
      { id: 4, title: `Spanish Hydro Reserves Fell Last Week; Power Output Falls`, src: 'BFW', date: '06/09' },
      { id: 5, title: `Spain says end of joint fighter jet project 'worrying for Europe'`, src: 'AFP', date: '06/09' },
      { id: 6, title: `EU Soft Wheat Exports Rise 7% So Far in Season to June 7`, src: 'BFW', date: '06/09' },
      { id: 7, title: `Spain Yields Mostly Lower`, src: 'BN', date: '06/09' },
    ],
  },
};

export const ALL_ROWS: SRSKRow[] = [...RESERVE_ROWS, ...NON_RESERVE_ROWS];

export const TIME_RANGES = ['6M', '1Y', '3Y', '5Y', '10Y', '20Y', '30Y', 'MAX'];

// 根据主表行派生国家详情（无显式数据时使用合理填充）
export function deriveDetail(row: SRSKRow): CountryDetail {
  if (COUNTRY_DETAILS[row.name]) return COUNTRY_DETAILS[row.name];
  const ig = row.cur < 0.25 ? 'IG6' : row.cur < 1 ? 'IG7' : row.cur < 10 ? 'HY1' : 'HY4';
  const inflation = +(2 + row.cur * 0.05).toFixed(3);
  const gdpGrowth = +(2.5 - row.cur * 0.02).toFixed(3);
  const npl = +(2 + row.cur * 0.08).toFixed(3);
  const political = Math.max(20, Math.round(75 - row.cur * 0.5));
  return {
    name: row.name, flag: row.flag, ig, dp: row.cur, modelCDS: row.model, marketCDS: row.market,
    inflation, gdpPerCapitaUSD: Math.round(35000 - row.cur * 200), gdpPerCapita: Math.round(26000 - row.cur * 150),
    gdpGrowth, npl, political,
    news: [
      { id: 2, title: `${row.name} Sovereign Credit Risk Update`, src: 'BN', date: '06/09' },
      { id: 3, title: `${row.name} Yields Mostly Lower`, src: 'BN', date: '06/09' },
      { id: 4, title: `${row.name} CDS Spreads Tighten on Risk Appetite`, src: 'BFW', date: '06/08' },
      { id: 5, title: `${row.name} Inflation Data In Focus This Week`, src: 'AFP', date: '06/08' },
      { id: 6, title: `${row.name} Bond Auction Draws Solid Demand`, src: 'BFW', date: '06/06' },
    ],
  };
}

// 双轴历史图表数据（确定性，使每个国家曲线稳定且不同）
export function buildHistory(detail: CountryDetail) {
  const buckets = ['2015-2019', '2020-2024', '2025'];
  const seed = detail.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = (i: number) => {
    const x = Math.sin(seed * 7.13 + i * 3.7) * 10000;
    return x - Math.floor(x);
  };
  const points: { period: string; dp: number; inflation: number }[] = [];
  buckets.forEach((b, bi) => {
    for (let i = 0; i < 8; i++) {
      const t = bi * 8 + i;
      points.push({
        period: b,
        dp: +(Math.max(0.01, detail.dp * (0.5 + rnd(t) * 1.5))).toFixed(3),
        inflation: +(Math.max(0.1, detail.inflation * (0.4 + rnd(t + 50) * 1.6))).toFixed(2),
      });
    }
  });
  return points;
}

// 5年CDS 差值（模型 - 市场）
export function cdsDiff(row: SRSKRow): number | null {
  return row.market != null ? row.model - row.market : null;
}

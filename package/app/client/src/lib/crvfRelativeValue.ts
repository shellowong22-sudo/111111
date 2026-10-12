/**
 * crvfRelativeValue.ts — CRVF 查找曲线「相对价值筛选器」计算库
 * 招牌功能（与 CORR/GC 零重叠）：
 *   ① 相对价值排行榜：按 YTM/利差/久期/凸性排序 + 便宜/合理/贵 标签
 *   ② 曲线对比表：并排对比关键期限点
 *   ③ 监控清单：交由后端数据库持久化
 *
 * 指标来源：基于曲线 id 的稳定哈希生成确定性合成指标（同一曲线每次一致），
 * 用于相对价值教学与筛选演示。
 */

import type { CrvfCurve } from './crvfData';

// 稳定字符串哈希 → [0,1)
function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 转无符号并归一化
  return ((h >>> 0) % 100000) / 100000;
}

export interface CurveMetrics {
  id: string;
  name: string;
  ytm: number;            // 到期收益率 %
  spreadBp: number;       // 相对基准利差 bp
  modDuration: number;    // 修正久期
  convexity: number;      // 凸性
  fairSpreadBp: number;   // 模型公允利差 bp
  richCheapBp: number;    // 实际利差 − 公允利差 (bp)；正=便宜(高收益)，负=贵
  rating: string;         // 评级
  zScore: number;         // 相对同组的标准分
  valuation: 'cheap' | 'fair' | 'rich';
}

const RATINGS = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-'];

/** 为单条曲线生成确定性指标 */
export function curveMetrics(curve: CrvfCurve): Omit<CurveMetrics, 'zScore' | 'valuation'> {
  const base = hash01(curve.id, 1);       // 0~1
  const dur = hash01(curve.id, 2);
  const cvx = hash01(curve.id, 3);
  const sprd = hash01(curve.id, 4);
  const fair = hash01(curve.id, 5);
  const rt = hash01(curve.id, 6);

  const ytm = parseFloat((2.0 + base * 6.5).toFixed(3));            // 2.0% ~ 8.5%
  const modDuration = parseFloat((1.5 + dur * 16).toFixed(2));       // 1.5 ~ 17.5
  const convexity = parseFloat((0.3 + cvx * 4.2).toFixed(2));
  const spreadBp = Math.round(-20 + sprd * 320);                     // -20 ~ +300 bp
  const fairSpreadBp = Math.round(-10 + fair * 280);                 // 模型公允
  const richCheapBp = spreadBp - fairSpreadBp;
  const rating = RATINGS[Math.floor(rt * RATINGS.length)];

  return { id: curve.id, name: curve.name, ytm, spreadBp, modDuration, convexity, fairSpreadBp, richCheapBp, rating };
}

export type SortKey = 'ytm' | 'spreadBp' | 'modDuration' | 'convexity' | 'richCheapBp';

/** 为一组曲线生成相对价值排行榜（含组内 zScore 与估值标签） */
export function rankCurves(curves: CrvfCurve[], sortKey: SortKey = 'richCheapBp', desc = true): CurveMetrics[] {
  const metrics = curves.map(curveMetrics);
  // 以 richCheapBp 计算组内 zScore
  const arr = metrics.map(m => m.richCheapBp);
  const mean = arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (arr.length || 1);
  const std = Math.sqrt(variance) || 1;

  const full: CurveMetrics[] = metrics.map(m => {
    const z = parseFloat(((m.richCheapBp - mean) / std).toFixed(2));
    const valuation: CurveMetrics['valuation'] = z > 0.5 ? 'cheap' : z < -0.5 ? 'rich' : 'fair';
    return { ...m, zScore: z, valuation };
  });

  full.sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return desc ? bv - av : av - bv;
  });
  return full;
}

export const VALUATION_LABEL: Record<CurveMetrics['valuation'], string> = {
  cheap: '便宜',
  fair: '合理',
  rich: '偏贵',
};

export const VALUATION_COLOR: Record<CurveMetrics['valuation'], string> = {
  cheap: '#4ade80',
  fair: '#9aa5b1',
  rich: '#f87171',
};

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'richCheapBp', label: '相对价值(便宜度)' },
  { key: 'ytm', label: '到期收益率' },
  { key: 'spreadBp', label: '利差(bp)' },
  { key: 'modDuration', label: '修正久期' },
  { key: 'convexity', label: '凸性' },
];

/** 生成对比表的关键期限点（确定性合成，基于曲线 id + 期限） */
const COMPARE_TENORS = ['3M', '1Y', '2Y', '5Y', '10Y', '30Y'];
export function compareTenors() { return COMPARE_TENORS; }

export function curveTenorValues(curve: CrvfCurve): { tenor: string; value: number }[] {
  const m = curveMetrics(curve);
  // 以 ytm 为锚点，按期限构造一条递增曲线
  return COMPARE_TENORS.map((t, i) => {
    const slopeFactor = i / (COMPARE_TENORS.length - 1); // 0~1
    const wiggle = (hash01(curve.id + t, 7) - 0.5) * 0.4;
    const v = m.ytm - 0.8 + slopeFactor * 1.6 + wiggle;
    return { tenor: t, value: parseFloat(v.toFixed(3)) };
  });
}

export type { CrvfCurve };

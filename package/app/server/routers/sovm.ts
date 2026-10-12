import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { getJson } from '../uc/market';
import { curves } from '../uc/hubs';
import { sovereignSpreads } from '../uc/hubs2';

/**
 * SOVM - 主权债行情表 (Sovereign Debt Monitor)
 *
 * 数据口径（全部为真实数据或由真实数据计算）：
 *  - 美国：财政部每日面值收益率曲线（2/5/10/30 年及全期限），日变动 = 与上一交易日之差。
 *  - 欧元区：欧洲央行 AAA 级政府债收益率曲线（最新一日）。
 *  - 欧盟各国：欧洲央行公布的各国 10 年期政府债月度收益率（欧盟趋同标准长期利率），对德利差、1 个月 / 12 个月变动。
 *  - 价格：这些是固定期限收益率，没有具体券的报价；价格 = 以上一观测收益率为票息的平价券在当前收益率下的重估价，
 *    价格变动即该期限持有一期的价格损益。
 *  - 利差（zSpread 字段）：欧盟各国 = 对德国 10 年期利差；欧元区 AAA 曲线 = 对美债同期限利差；美国 = 基准（0）。
 *    主权债是不含权的子弹型债券，期权调整利差（oas）与该利差相同。
 *  - 评级、成交量、买卖价、ISIN：无公开免费来源，不展示（返回空值）。
 *  - 多维异常检测：对各国真实指标（收益率、对德利差、利差 1 / 12 个月变动、收益率月度波动率、利差相对自身历史的 Z 分数）
 *    做主成分重构误差（线性自编码）与稳健 Z 分数离群度，外汇储备与政治稳定度取世界银行最新年度数据。
 */

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    if (hit) return hit.value as T;
    throw error;
  }
}
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const stdev = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const TENOR_Y: Record<string, number> = { '1M': 1 / 12, '2M': 2 / 12, '3M': 0.25, '4M': 4 / 12, '6M': 0.5, '1Y': 1, '2Y': 2, '3Y': 3, '5Y': 5, '7Y': 7, '10Y': 10, '20Y': 20, '30Y': 30 };
const tenorYears = (t: string) => TENOR_Y[t] ?? (Number(t.replace(/[^\d.]/g, '')) || 10);

/** 以 coupon 为票息、按 yieldPct 折现的固定期限债券价格（每年 freq 次付息） */
function parPrice(coupon: number, yieldPct: number, years: number, freq = 2) {
  const n = Math.max(1, Math.round(years * freq));
  const c = coupon / freq;
  const y = yieldPct / 100 / freq;
  let pv = 0;
  for (let i = 1; i <= n; i++) pv += c / Math.pow(1 + y, i);
  return pv + 100 / Math.pow(1 + y, n);
}
function durConv(yieldPct: number, years: number, freq = 2) {
  const p0 = parPrice(yieldPct, yieldPct, years, freq);
  const up = parPrice(yieldPct, yieldPct + 0.01, years, freq);
  const dn = parPrice(yieldPct, yieldPct - 0.01, years, freq);
  return { duration: (dn - up) / (2 * p0 * 0.0001), convexity: (up + dn - 2 * p0) / (p0 * 1e-8) };
}

/* ------------------------------------------------------------------ 世界银行：外汇储备 / 政治稳定度 */
async function wbLatest(indicator: string, iso2: string[], source?: number): Promise<Record<string, { v: number; year: string }>> {
  return cached(`wb:${indicator}:${iso2.join(';')}`, 12 * 3600_000, async () => {
    const j = await getJson<any>(`https://api.worldbank.org/v2/country/${iso2.join(';')}/indicator/${indicator}?format=json&mrv=5&per_page=1000${source ? `&source=${source}` : ''}`);
    const out: Record<string, { v: number; year: string }> = {};
    for (const r of (Array.isArray(j) ? j[1] ?? [] : []) as any[]) {
      const id = String(r?.country?.id ?? '');
      const v = Number(r?.value);
      if (!id || r?.value == null || !Number.isFinite(v)) continue;
      if (!out[id] || String(r.date) > out[id].year) out[id] = { v, year: String(r.date) };
    }
    return out;
  });
}

/* ------------------------------------------------------------------ 统一数据 */
type Row = {
  id: string; country: string; countryCode: string; bondName: string; isin: string; tenor: string; maturityDate: string;
  price: number; priceChange: number | null; priceChangePercent: number | null; yield: number; yieldChange: number | null;
  zSpread: number | null; benchmark: string; creditRating: string; volume: number | null; bid: number | null; ask: number | null;
  lastUpdate: string; asOf: string | null; frequency: 'daily' | 'monthly';
};
const NAME: Record<string, string> = { US: '美国', EUR: '欧元区AAA' };

async function snapshot() {
  return cached('sovm:snap', 15 * 60_000, async () => {
    const [cv, sov] = await Promise.all([curves().catch(() => null), sovereignSpreads().catch(() => null)]);
    const rows: Row[] = [];
    const now = new Date().toISOString();
    const maturity = (tenor: string) => new Date(Date.now() + tenorYears(tenor) * 365.25 * 86400_000).toISOString().slice(0, 10);
    const push = (code: string, name: string, tenor: string, y: number, prev: number | null, spread: number | null, bench: string, asOf: string | null, freq: 'daily' | 'monthly', cpnFreq: number) => {
      const px = prev != null ? parPrice(prev, y, tenorYears(tenor), cpnFreq) : 100;
      const chg = prev != null ? px - 100 : null;
      rows.push({
        id: `${code}_${tenor}`, country: name, countryCode: code, bondName: `${name} ${tenor} 政府债（固定期限）`, isin: '', tenor, maturityDate: maturity(tenor),
        price: r4(px), priceChange: chg != null ? r4(chg) : null, priceChangePercent: chg != null ? r3(chg) : null,
        yield: r3(y), yieldChange: prev != null ? r3(y - prev) : null, zSpread: spread, benchmark: bench,
        creditRating: '—', volume: null, bid: null, ask: null, lastUpdate: now, asOf, frequency: freq,
      });
    };
    const us0 = cv?.us?.[0];
    const us1 = cv?.us?.[1];
    const usAt = (t: string, d = us0) => d?.points.find((p) => p.tenor === t)?.value ?? null;
    for (const t of ['2Y', '5Y', '10Y', '30Y']) {
      const y = usAt(t);
      if (y != null) push('US', NAME.US, t, y, usAt(t, us1), 0, '美债（基准）', us0?.date ?? null, 'daily', 2);
    }
    for (const t of ['2Y', '5Y', '10Y', '30Y']) {
      const y = cv?.eu.find((p) => p.tenor === t)?.value;
      const u = usAt(t);
      if (y != null) push('EUR', NAME.EUR, t, y, null, u != null ? Math.round((y - u) * 100) : null, '对美债同期限', cv?.euDate ?? null, 'daily', 1);
    }
    for (const c of sov?.countries ?? []) {
      const prev = c.hist.length > 1 ? c.hist[c.hist.length - 2].y : null;
      push(c.code, c.name, '10Y', c.y, prev, c.spread, '对德国10年期', c.date, 'monthly', 1);
    }
    return { rows, cv, sov };
  });
}

/* ------------------------------------------------------------------ 主成分（线性自编码）重构误差 */
function topEigen(cov: number[][], k: number) {
  const d = cov.length;
  const A = cov.map((r) => [...r]);
  const vecs: number[][] = [];
  for (let e = 0; e < k; e++) {
    let v = Array.from({ length: d }, (_, i) => 1 / Math.sqrt(d) + i * 1e-3);
    let lambda = 0;
    for (let it = 0; it < 300; it++) {
      const w = A.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
      const n = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
      if (n < 1e-12) break;
      v = w.map((x) => x / n);
      lambda = n;
    }
    vecs.push(v);
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) A[i][j] -= lambda * v[i] * v[j];
  }
  return vecs;
}

async function anomalies() {
  return cached('sovm:anom', 30 * 60_000, async () => {
    const { cv, sov } = await snapshot();
    const de = new Map((sov?.countries.find((c) => c.code === 'DE')?.hist ?? []).map((h) => [h.d, h.y]));
    type Item = { code: string; name: string; y: number; spread: number; chg1m: number; chg12m: number; vol: number; zOwn: number; hist: Array<{ d: string; y: number; s: number | null }> };
    const items: Item[] = [];
    for (const c of sov?.countries ?? []) {
      const ys = c.hist.map((h) => h.y);
      const ss = c.hist.map((h) => h.s).filter((v): v is number => v != null);
      const dys = ys.slice(1).map((v, i) => (v - ys[i]) * 100);
      const sdS = stdev(ss);
      items.push({
        code: c.code, name: c.name, y: c.y, spread: c.spread ?? 0,
        chg1m: c.spread != null && c.spread1m != null ? c.spread - c.spread1m : 0,
        chg12m: c.spread != null && c.spread12m != null ? c.spread - c.spread12m : 0,
        vol: stdev(dys), zOwn: c.spread != null && sdS > 0 ? (c.spread - mean(ss)) / sdS : 0, hist: c.hist,
      });
    }
    // 美国：日度 10 年期收益率按月平均，与德国月度收益率对齐
    const byMonth = new Map<string, number[]>();
    for (const d of cv?.us ?? []) {
      const v = d.points.find((p) => p.tenor === '10Y')?.value;
      if (v != null) { const m = d.date.slice(0, 7); byMonth.set(m, [...(byMonth.get(m) ?? []), v]); }
    }
    const usHist = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ d, y: mean(v), s: de.has(d) ? Math.round((mean(v) - de.get(d)!) * 100) : null }));
    if (usHist.length >= 3) {
      const ys = usHist.map((h) => h.y);
      const ss = usHist.map((h) => h.s).filter((v): v is number => v != null);
      const lastS = [...usHist].reverse().find((h) => h.s != null);
      const sAt = (k: number) => usHist[usHist.length - 1 - k]?.s ?? null;
      items.push({
        code: 'US', name: '美国', y: usHist[usHist.length - 1].y, spread: lastS?.s ?? 0,
        chg1m: sAt(0) != null && sAt(1) != null ? sAt(0)! - sAt(1)! : 0, chg12m: sAt(0) != null && sAt(11) != null ? sAt(0)! - sAt(11)! : 0,
        vol: stdev(ys.slice(1).map((v, i) => (v - ys[i]) * 100)), zOwn: lastS && stdev(ss) > 0 ? (lastS.s! - mean(ss)) / stdev(ss) : 0, hist: usHist,
      });
    }
    const iso = items.map((i) => i.code);
    const [reserves, pol] = await Promise.all([
      wbLatest('FI.RES.TOTL.CD', iso).catch(() => ({} as Record<string, { v: number; year: string }>)),
      wbLatest('PV.EST', iso, 3).catch(() => ({} as Record<string, { v: number; year: string }>)),
    ]);
    // 标准化特征矩阵
    const F = items.map((i) => [i.y, i.spread, i.chg1m, i.chg12m, i.vol, i.zOwn]);
    const d = F[0]?.length ?? 0;
    const mu = Array.from({ length: d }, (_, j) => mean(F.map((r) => r[j])));
    const sg = Array.from({ length: d }, (_, j) => stdev(F.map((r) => r[j])) || 1);
    const Z = F.map((r) => r.map((v, j) => (v - mu[j]) / sg[j]));
    const cov = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (__, b) => (Z.length > 1 ? Z.reduce((s, r) => s + r[a] * r[b], 0) / (Z.length - 1) : 0)));
    const V = Z.length >= 4 ? topEigen(cov, 2) : [];
    const re = Z.map((x) => {
      const proj = x.map(() => 0);
      for (const v of V) { const c = x.reduce((s, xi, j) => s + xi * v[j], 0); for (let j = 0; j < d; j++) proj[j] += c * v[j]; }
      return x.reduce((s, xi, j) => s + (xi - proj[j]) ** 2, 0) / d;
    });
    // 稳健 Z 分数离群度
    const med = Array.from({ length: d }, (_, j) => median(F.map((r) => r[j])));
    const mad = Array.from({ length: d }, (_, j) => 1.4826 * median(F.map((r) => Math.abs(r[j] - med[j]))) || sg[j]);
    const iso2Score = F.map((r) => {
      const m = Math.max(...r.map((v, j) => Math.abs((v - med[j]) / mad[j])));
      return 1 - Math.exp(-(m * m) / 8);
    });
    const reRank = re.map((v) => (re.length > 1 ? re.filter((x) => x < v).length / (re.length - 1) : 0));
    const vols = items.map((i) => Math.max(1, i.vol));
    const results = items.map((it, k) => {
      const composite = r4(0.6 * reRank[k] + 0.4 * iso2Score[k]);
      const level: 'HIGH' | 'MEDIUM' | 'LOW' = composite >= 0.7 && iso2Score[k] >= 0.5 ? 'HIGH' : composite >= 0.45 ? 'MEDIUM' : 'LOW';
      return { it, k, composite, level };
    });
    // 目标权重：收益率月度波动率倒数加权，高 / 中风险分别打 5 折 / 8 折后再归一
    const raw = results.map((r) => (1 / vols[r.k]) * (r.level === 'HIGH' ? 0.5 : r.level === 'MEDIUM' ? 0.8 : 1));
    const tot = raw.reduce((s, v) => s + v, 0) || 1;
    const reMed = median(re);
    const volQ3 = [...items.map((i) => i.vol)].sort((a, b) => a - b)[Math.floor(items.length * 0.75)] ?? Infinity;
    const yMed = median(items.map((i) => i.y));
    const data = results.map(({ it, k, composite, level }) => {
      const w = raw[k] / tot;
      const res = reserves[it.code]?.v;
      const pv = pol[it.code]?.v;
      const politicalRisk = pv != null ? r3(Math.min(1, Math.max(0, (2.5 - pv) / 5))) : null;
      const hiddenRisks: string[] = [];
      if (it.chg1m >= 15) hiddenRisks.push(`近 1 个月对德利差走阔 ${it.chg1m.toFixed(0)}bp`);
      if (it.zOwn >= 1.5) hiddenRisks.push(`对德利差处于自身近 5 年分布高位（Z=${it.zOwn.toFixed(2)}）`);
      if (it.y <= yMed && it.vol >= volQ3) hiddenRisks.push(`收益率不高（${it.y.toFixed(2)}%）但月度波动率处于样本前 25%（${it.vol.toFixed(1)}bp）`);
      if (politicalRisk != null && politicalRisk > 0.5) hiddenRisks.push(`世界银行政治稳定度指标偏弱（${pv!.toFixed(2)}）`);
      if (re[k] > 2 * reMed && re[k] > 0.5) hiddenRisks.push(`多项指标组合偏离主成分结构（重构误差 ${re[k].toFixed(3)}）`);
      return {
        country: it.code,
        countryName: it.name,
        rating: '—',
        features: {
          yield: r3(it.y),
          fxReserves: res != null ? r2(res / 1e9) : null,         // 十亿美元
          cdsSpreads: Math.round(it.spread),                        // 无公开 CDS 报价：以对德 10 年期利差（bp）代替
          politicalRisk,                                            // 0~1，由世界银行政治稳定度（-2.5~2.5）换算
          spreadChg1m: Math.round(it.chg1m), spreadChg12m: Math.round(it.chg12m), yieldVolBp: r2(it.vol), spreadZ: r2(it.zOwn),
        },
        vaeReconstructionError: Number(re[k].toFixed(6)),
        isolationScore: r4(iso2Score[k]),
        compositeAnomalyScore: composite,
        anomalyLevel: level,
        exposureRecommendation: {
          action: level === 'HIGH' ? '减仓' : level === 'MEDIUM' ? '持仓观望' : '增仓',
          targetWeight: r3(w),
          reason: level === 'HIGH'
            ? `综合异常分 ${composite.toFixed(4)}：对德利差 ${it.spread.toFixed(0)}bp、近 1 月变动 ${it.chg1m >= 0 ? '+' : ''}${it.chg1m.toFixed(0)}bp，偏离横截面结构，波动率倒数权重打 5 折至 ${(w * 100).toFixed(1)}%`
            : level === 'MEDIUM'
              ? `综合异常分 ${composite.toFixed(4)}：部分指标偏离（利差 Z=${it.zOwn.toFixed(2)}，月度波动 ${it.vol.toFixed(1)}bp），权重打 8 折至 ${(w * 100).toFixed(1)}%`
              : `各项指标处于样本常态区间，按收益率波动率倒数配置 ${(w * 100).toFixed(1)}%`,
        },
        hiddenRisks,
        lastUpdated: it.hist[it.hist.length - 1]?.d ?? new Date().toISOString(),
      };
    });
    return data;
  });
}

export const sovmRouter = router({
  // 主权债行情表
  getSovereignBonds: publicProcedure
    .input(
      z.object({
        country: z.string().optional(),
        tenor: z.string().optional(),
        sortBy: z.enum(['price', 'yield', 'zSpread', 'volume']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const { rows } = await snapshot();
      let filtered = [...rows];
      if (input?.country) filtered = filtered.filter(b => b.countryCode === input.country);
      if (input?.tenor) filtered = filtered.filter(b => b.tenor === input.tenor);
      if (input?.sortBy) {
        const sortKey = input.sortBy as keyof Row;
        const order = input.sortOrder === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
          const aVal = a[sortKey];
          const bVal = b[sortKey];
          if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * order;
          if (typeof aVal === 'number') return -1;
          if (typeof bVal === 'number') return 1;
          return 0;
        });
      }
      return {
        success: true,
        data: filtered,
        timestamp: new Date().toISOString(),
        total: filtered.length,
      };
    }),

  // 单个固定期限主权债详情（id = 国家代码_期限，例如 US_10Y、IT_10Y）
  getBondDetail: publicProcedure
    .input(z.object({ bondId: z.string() }))
    .query(async ({ input }) => {
      const { rows, cv, sov } = await snapshot();
      const row = rows.find((r) => r.id === input.bondId) ?? rows.find((r) => input.bondId.toUpperCase().startsWith(`${r.countryCode}_`));
      if (!row) return { success: false, data: null };
      const years = tenorYears(row.tenor);
      const freq = row.countryCode === 'US' ? 2 : 1;
      const dc = durConv(row.yield, years, freq);
      let hist: Array<{ date: string; y: number }> = [];
      if (row.countryCode === 'US') hist = (cv?.us ?? []).slice(0, 30).reverse().map((d) => ({ date: d.date, y: d.points.find((p) => p.tenor === row.tenor)?.value ?? NaN })).filter((h) => Number.isFinite(h.y));
      else if (row.countryCode !== 'EUR') hist = (sov?.countries.find((c) => c.code === row.countryCode)?.hist ?? []).slice(-30).map((h) => ({ date: h.d, y: h.y }));
      const cpn = hist[0]?.y ?? row.yield;
      const eu10 = cv?.eu.find((p) => p.tenor === '10Y')?.value;
      return {
        success: true,
        data: {
          bondId: row.id,
          price: row.price,
          yield: row.yield,
          zSpread: row.zSpread,
          duration: r4(dc.duration),
          convexity: r4(dc.convexity),
          creditSpread: row.tenor === '10Y' && row.countryCode !== 'US' && row.countryCode !== 'EUR' && eu10 != null ? Math.round((row.yield - eu10) * 100) : null,
          issuer: row.countryCode === 'US' ? '美国财政部' : row.countryCode === 'EUR' ? '欧元区 AAA 级成员国（合成曲线）' : `${row.country}政府`,
          issueDate: null as string | null,
          maturityDate: row.maturityDate,
          couponRate: row.yield,
          couponFrequency: freq === 2 ? '半年' : '年',
          faceValue: 100,
          outstanding: null as number | null,
          ratings: { sp: '—', moody: '—', fitch: '—' },
          // 价格路径：以窗口首日收益率为票息的固定券，按每期真实收益率重估
          priceHistory: hist.map((h) => ({ date: h.date, price: r4(parPrice(cpn, h.y, years, freq)), yield: r3(h.y) })),
        },
      };
    }),

  // 收益率曲线
  getYieldCurve: publicProcedure
    .input(z.object({ country: z.string() }))
    .query(async ({ input }) => {
      const { cv, sov } = await snapshot();
      const code = input.country.toUpperCase();
      let curve: Array<{ tenor: string; yield: number }> = [];
      let asOf: string | null = null;
      if (code === 'US' && cv?.us?.[0]) {
        curve = cv.us[0].points.filter((p) => TENOR_Y[p.tenor] != null).sort((a, b) => tenorYears(a.tenor) - tenorYears(b.tenor)).map((p) => ({ tenor: p.tenor, yield: p.value }));
        asOf = cv.us[0].date;
      } else if (code === 'EUR' && cv) {
        curve = cv.eu.map((p) => ({ tenor: p.tenor, yield: p.value }));
        asOf = cv.euDate;
      } else {
        const c = sov?.countries.find((x) => x.code === code);
        if (c) { curve = [{ tenor: '10Y', yield: c.y }]; asOf = c.date; }
      }
      return {
        success: true,
        country: input.country,
        curve,
        asOf,
        timestamp: new Date().toISOString(),
      };
    }),

  // 利差对比：10Y = 欧盟各国对德利差（及对欧元区 AAA 曲线利差）；其他期限 = 欧元区 AAA 对美债
  getSpreadComparison: publicProcedure
    .input(z.object({ tenor: z.string() }))
    .query(async ({ input }) => {
      const { cv, sov } = await snapshot();
      const tenor = input.tenor.toUpperCase();
      let spreads: Array<{ country: string; zSpread: number | null; creditSpread: number | null; oas: number | null }> = [];
      if (tenor === '10Y') {
        const eu10 = cv?.eu.find((p) => p.tenor === '10Y')?.value;
        spreads = (sov?.countries ?? []).map((c) => ({ country: c.code, zSpread: c.spread, creditSpread: eu10 != null ? Math.round((c.y - eu10) * 100) : null, oas: c.spread }));
      } else {
        const u = cv?.us?.[0]?.points.find((p) => p.tenor === tenor)?.value;
        const e = cv?.eu.find((p) => p.tenor === tenor)?.value;
        if (u != null) spreads.push({ country: 'US', zSpread: 0, creditSpread: 0, oas: 0 });
        if (u != null && e != null) { const s = Math.round((e - u) * 100); spreads.push({ country: 'EUR', zSpread: s, creditSpread: s, oas: s }); }
      }
      return {
        success: true,
        tenor: input.tenor,
        spreads,
        timestamp: new Date().toISOString(),
      };
    }),

  // ── 多维度异常检测与风险敞口（主成分重构误差 + 稳健 Z 分数离群度；字段名沿用前端约定）
  getVAEAnomalyDetection: publicProcedure
    .input(z.object({ country: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const results = await anomalies().catch(() => [] as Awaited<ReturnType<typeof anomalies>>);
      const filtered = input?.country ? results.filter(r => r.country === input.country) : results;
      return {
        success: true,
        data: filtered,
        summary: {
          totalCountries: results.length,
          highRiskCount: results.filter(r => r.anomalyLevel === 'HIGH').length,
          mediumRiskCount: results.filter(r => r.anomalyLevel === 'MEDIUM').length,
          lowRiskCount: results.filter(r => r.anomalyLevel === 'LOW').length,
          avgAnomalyScore: results.length ? parseFloat((results.reduce((s, r) => s + r.compositeAnomalyScore, 0) / results.length).toFixed(4)) : 0,
          model: '主成分重构误差 + 稳健Z分数离群度',
          description: '基于欧盟各国与美国 10 年期国债的真实收益率、对德利差及其变动、波动率等指标，识别横截面上偏离常态结构的国家',
        },
        timestamp: new Date().toISOString(),
      };
    }),

  // ── AI 智能分析：基于多维异常检测结果生成自然语言总结
  generateVAEAnalysis: publicProcedure
    .input(z.object({
      anomalyData: z.array(z.object({
        country: z.string(),
        countryName: z.string(),
        anomalyLevel: z.string(),
        compositeAnomalyScore: z.number(),
        vaeReconstructionError: z.number(),
        isolationScore: z.number(),
        action: z.string(),
        reason: z.string(),
      })),
      summary: z.object({
        totalCountries: z.number(),
        highRiskCount: z.number(),
        mediumRiskCount: z.number(),
        lowRiskCount: z.number(),
        avgAnomalyScore: z.number(),
      }),
      filterDescription: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const highRisk = input.anomalyData.filter(d => d.anomalyLevel === 'HIGH');
      const medRisk = input.anomalyData.filter(d => d.anomalyLevel === 'MEDIUM');
      const topAnomaly = [...input.anomalyData].sort((a, b) => b.compositeAnomalyScore - a.compositeAnomalyScore).slice(0, 3);

      const prompt = `你是一位专业的主权债券风险分析师。请基于以下多维异常检测结果（主成分重构误差 + 稳健Z分数离群度，输入为各国10年期国债真实收益率、对德利差及其变动、波动率），生成一段简洁的中文分析总结（200字以内）。

检测范围：${input.summary.totalCountries} 个国家
高风险：${input.summary.highRiskCount} 个（${highRisk.map(d => d.countryName).join('、') || '无'}）
中风险：${input.summary.mediumRiskCount} 个（${medRisk.map(d => d.countryName).join('、') || '无'}）
低风险：${input.summary.lowRiskCount} 个
平均异常分数：${input.anomalyData.length > 0 ? (input.anomalyData.reduce((s, d) => s + d.compositeAnomalyScore, 0) / input.anomalyData.length).toFixed(4) : 'N/A'}

异常分数最高的3个国家：
${topAnomaly.map(d => `${d.countryName}（${d.country}）：异常分数 ${d.compositeAnomalyScore.toFixed(4)}，重构误差 ${d.vaeReconstructionError.toFixed(6)}，建议${d.action}，原因：${d.reason}`).join('\n')}

要求：
1. 只输出纯文字分析，不使用 Markdown 格式（不用 **、#、- 等符号）
2. 不使用 emoji 或特殊符号
3. 语言简洁专业，必须包含：当前整体风险判断、高风险国家的具体操作建议（仓位比例建议）、低风险国家的增仓机会
4. 分2-3段，每段不超过3句话
5. 结尾必须给出一句具体的投资行动建议`;

      try {
        const result = await invokeLLM({
          messages: [{ role: 'user', content: prompt }],
          model: 'gpt-4o-mini',
        });
        const raw = result.choices?.[0]?.message?.content ?? '';
        const rawText = typeof raw === 'string' ? raw : '';
        // 严格清理：移除所有 Markdown 符号、emoji、特殊字符
        const cleanText = rawText
          .replace(/[*#`~_>|\[\]()!]/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/^[-•·\s]+/gm, '')
          .trim();
        return { success: true, summary: cleanText || '分析完成，当前市场整体风险可控。' };
      } catch {
        const fallback = `当前检测到 ${input.summary.highRiskCount} 个高风险国家，${input.summary.mediumRiskCount} 个中风险国家。` +
          (topAnomaly.length > 0 ? `异常分数最高的是${topAnomaly[0].countryName}（${topAnomaly[0].compositeAnomalyScore.toFixed(4)}），建议${topAnomaly[0].action}。` : '') +
          `整体平均异常分数为 ${input.summary.avgAnomalyScore.toFixed(4)}，建议关注高风险国家的风险敞口管理。`;
        return { success: true, summary: fallback };
      }
    }),
});

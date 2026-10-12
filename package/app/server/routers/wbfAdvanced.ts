/**
 * WBF Advanced - 美国国债期货基差 / 最便宜可交割券（CTD）分析
 *
 * 数据口径（全部为真实数据或由真实数据计算，不含任何随机数）：
 *  - 期货价格：各国债期货（ZT/ZF/ZN/ZB/UB）当季主力合约实时报价与各合约月价格。
 *  - 可交割券篮子：美国财政部已发行的固定利率附息国债（剔除通胀保值与浮息），按交易所可交割规则筛选。
 *  - 现券收益率：无公开的逐只国债实时报价，按财政部当日面值收益率曲线插值得到该剩余期限的收益率，再按半年付息精确定价（模型价）。
 *  - 转换因子：交易所标准 6% 票面利率公式（按交割月首日的剩余期限取整）。
 *  - 回购利率：纽约联储公布的最新担保隔夜融资利率（SOFR）。
 *  - 基差 / 净基差 / 隐含回购利率（IRR）：按上面的真实输入逐券计算；IRR 计到最后交割日、不计票息再投资。
 *  - “CTD 概率”：收益率曲线平行移动情景分析——情景幅度按近 60 日 10 年期收益率日变动的实际波动率换算到交割日，
 *    按正态权重统计各券在交割日成为最便宜可交割券（转换后远期价格最低）的权重之和。
 *  - 跨合约相关性：各期货近 90 个交易日日收益率的实际相关系数。
 *  - 基差异常 / 套利信号：当前 CTD 净基差相对该合约近两个月净基差历史的 Z 分数（|Z|≥2 才给信号）。
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getKline, getText, getTicks, yahooChart } from "../uc/market";
import { cotReport, curves } from "../uc/hubs";
import { futuresCurve, moneyMarket } from "../uc/hubs2";

/* ------------------------------------------------------------------ 缓存 */
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
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const DAY = 86400_000;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const parseDay = (s: string) => Date.parse(`${s.slice(0, 10)}T00:00:00Z`);

/* ------------------------------------------------------------------ 合约规则（交易所公开合约细则） */
type Spec = {
  root: string; ticker: string; label: string; face: number;
  /** 剩余期限下限 / 上限（月，自交割月首日起算），原始期限上限（月） */
  minMonths: number; maxMonths: number; maxOrigMonths: number;
  kind: "Note" | "Bond"; cfRound: "month" | "quarter"; lastDelivery: "eom" | "bd3next";
};
const SPECS: Spec[] = [
  { root: "ZT", ticker: "ZT1", label: "2年期美债期货", face: 200_000, minMonths: 21, maxMonths: 24, maxOrigMonths: 63, kind: "Note", cfRound: "month", lastDelivery: "bd3next" },
  { root: "ZF", ticker: "ZF1", label: "5年期美债期货", face: 100_000, minMonths: 50, maxMonths: 63, maxOrigMonths: 63, kind: "Note", cfRound: "month", lastDelivery: "bd3next" },
  { root: "ZN", ticker: "ZN1", label: "10年期美债期货", face: 100_000, minMonths: 78, maxMonths: 96, maxOrigMonths: 120, kind: "Note", cfRound: "quarter", lastDelivery: "eom" },
  { root: "ZB", ticker: "ZB1", label: "30年期美债期货", face: 100_000, minMonths: 180, maxMonths: 299, maxOrigMonths: 360, kind: "Bond", cfRound: "quarter", lastDelivery: "eom" },
  { root: "UB", ticker: "UB1", label: "超长期美债期货", face: 100_000, minMonths: 300, maxMonths: 360, maxOrigMonths: 360, kind: "Bond", cfRound: "quarter", lastDelivery: "eom" },
];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isBiz(ms: number) {
  const w = new Date(ms).getUTCDay();
  return w !== 0 && w !== 6;
}
/** 交割月（YYYY-MM）→ 首个交割日、最后交割日 */
function deliveryDays(month: string, spec: Spec) {
  const [y, m] = month.split("-").map(Number);
  let first = Date.UTC(y, m - 1, 1);
  while (!isBiz(first)) first += DAY;
  let last: number;
  if (spec.lastDelivery === "eom") {
    last = Date.UTC(y, m, 0);
    while (!isBiz(last)) last -= DAY;
  } else {
    last = Date.UTC(y, m, 1);
    let n = 0;
    while (true) {
      if (isBiz(last)) n++;
      if (n === 3) break;
      last += DAY;
    }
  }
  return { first, last, monthStart: Date.UTC(y, m - 1, 1) };
}

/* ------------------------------------------------------------------ 债券数学 */
type Bond = { cusip: string; coupon: number; maturity: number; issue: number; name: string };
function addMonths(ms: number, k: number) {
  const d = new Date(ms);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1));
  const dim = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, dim));
  return t.getTime();
}
/** 结算日之后的下一个付息日、上一个付息日、剩余付息次数 */
function schedule(b: Bond, settle: number) {
  let k = 0;
  while (addMonths(b.maturity, -6 * (k + 1)) > settle) k++;
  const next = addMonths(b.maturity, -6 * k);
  const prev = addMonths(b.maturity, -6 * (k + 1));
  return { next, prev, n: k + 1 };
}
function accrued(b: Bond, settle: number) {
  const s = schedule(b, settle);
  return (b.coupon / 2) * ((settle - s.prev) / (s.next - s.prev));
}
/** 收益率（%，半年复利）→ 全价 / 净价 */
function priceAt(b: Bond, yPct: number, settle: number) {
  const s = schedule(b, settle);
  const w = (s.next - settle) / (s.next - s.prev);
  const y = yPct / 200;
  const c = b.coupon / 2;
  let dirty = 0;
  for (let j = 0; j < s.n; j++) dirty += c / Math.pow(1 + y, j + w);
  dirty += 100 / Math.pow(1 + y, s.n - 1 + w);
  const ai = c * ((settle - s.prev) / (s.next - s.prev));
  return { dirty, clean: dirty - ai, ai };
}
function yieldFromClean(b: Bond, clean: number, settle: number) {
  let lo = -2, hi = 30;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (priceAt(b, mid, settle).clean > clean) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
function riskAt(b: Bond, yPct: number, settle: number) {
  const p0 = priceAt(b, yPct, settle).dirty;
  const up = priceAt(b, yPct + 0.01, settle).dirty;
  const dn = priceAt(b, yPct - 0.01, settle).dirty;
  const modDur = (dn - up) / (2 * p0 * 0.0001);
  const convexity = (up + dn - 2 * p0) / (p0 * 0.0001 * 0.0001);
  return { modDur, convexity, dv01: (dn - up) / 2 };
}
/** 交易所标准转换因子（6% 票面，按交割月首日的剩余期限取整到月 / 季） */
function conversionFactor(b: Bond, monthStart: number, round: "month" | "quarter") {
  const d0 = new Date(monthStart);
  const d1 = new Date(b.maturity);
  let months = (d1.getUTCFullYear() - d0.getUTCFullYear()) * 12 + (d1.getUTCMonth() - d0.getUTCMonth());
  if (d1.getUTCDate() < d0.getUTCDate()) months -= 1;
  if (round === "quarter") months -= months % 3;
  const n = Math.floor(months / 12);
  const zM = months - n * 12;
  const v = zM < 7 ? zM : round === "quarter" ? 3 : zM - 6;
  const cpn = b.coupon / 100;
  const a = 1 / Math.pow(1.03, v / 6);
  const bb = (cpn / 2) * (6 - v) / 6;
  const c = zM < 7 ? 1 / Math.pow(1.03, 2 * n) : 1 / Math.pow(1.03, 2 * n + 1);
  const d = (cpn / 0.06) * (1 - c);
  return a * (cpn / 2 + c + d) - bb;
}
/** 区间 (from, to] 内收到的票息 */
function couponsBetween(b: Bond, from: number, to: number) {
  let sum = 0;
  for (let k = 0; k < 200; k++) {
    const d = addMonths(b.maturity, -6 * k);
    if (d <= from) break;
    if (d <= to) sum += b.coupon / 2;
  }
  return sum;
}

/* ------------------------------------------------------------------ 美债收益率曲线插值 */
function tenorYears(t: string) {
  const m = /^(\d+(?:\.\d+)?)(W|M|Y)$/.exec(t);
  if (!m) return null;
  const v = Number(m[1]);
  return m[2] === "W" ? v / 52 : m[2] === "M" ? v / 12 : v;
}
type CurveDay = { date: string; points: Array<{ tenor: string; value: number }> };
function interp(day: CurveDay, years: number) {
  const pts = day.points.map((p) => ({ t: tenorYears(p.tenor), v: p.value })).filter((p): p is { t: number; v: number } => p.t != null).sort((a, b) => a.t - b.t);
  if (!pts.length) return null;
  if (years <= pts[0].t) return pts[0].v;
  for (let i = 1; i < pts.length; i++) {
    if (years <= pts[i].t) {
      const a = pts[i - 1], b = pts[i];
      return a.v + ((b.v - a.v) * (years - a.t)) / (b.t - a.t);
    }
  }
  return pts[pts.length - 1].v;
}

/* ------------------------------------------------------------------ 已发行国债清单 */
function termMonths(s: string) {
  const y = /(\d+)-Year/.exec(s);
  const m = /(\d+)-Month/.exec(s);
  return (y ? Number(y[1]) * 12 : 0) + (m ? Number(m[1]) : 0);
}
async function treasuryList(kind: "Note" | "Bond"): Promise<Array<Bond & { origMonths: number }>> {
  return cached(`tsy:${kind}`, 12 * 3600_000, async () => {
    const urls = [
      `https://www.treasurydirect.gov/TA_WS/securities/search?type=${kind}&format=json`,
      `https://www.treasurydirect.gov/TA_WS/securities/search?securityType=${kind}&format=json`,
      `https://www.treasurydirect.gov/TA_WS/securities/${kind}?format=json`,
    ];
    let rows: any[] = [];
    for (const u of urls) {
      try {
        const j = JSON.parse(await getText(u, {}, "utf-8", 30_000));
        if (Array.isArray(j) && j.length) { rows = j; break; }
      } catch {
        /* 换下一个接口 */
      }
    }
    const now = Date.now();
    const by = new Map<string, Bond & { origMonths: number }>();
    for (const a of rows) {
      if (a.tips === "Yes" || a.floatingRate === "Yes") continue;
      if (String(a.securityType ?? a.type ?? kind) !== kind) continue;
      const coupon = Number(a.interestRate);
      const maturity = parseDay(String(a.maturityDate ?? ""));
      if (!Number.isFinite(coupon) || coupon <= 0 || !Number.isFinite(maturity) || maturity < now) continue;
      const cusip = String(a.cusip ?? "");
      if (!cusip) continue;
      const orig = termMonths(String(a.originalSecurityTerm ?? a.securityTerm ?? ""));
      const issue = parseDay(String(a.originalIssueDate ?? a.issueDate ?? ""));
      const prev = by.get(cusip);
      const md = new Date(maturity);
      const name = `T ${coupon.toFixed(3)} ${String(md.getUTCMonth() + 1).padStart(2, "0")}/${String(md.getUTCDate()).padStart(2, "0")}/${String(md.getUTCFullYear()).slice(2)}`;
      // 同一券的续发：原始期限取最长的那次（首发）
      if (!prev || orig > prev.origMonths) by.set(cusip, { cusip, coupon, maturity, issue: Number.isFinite(issue) ? issue : 0, name, origMonths: orig || prev?.origMonths || 0 });
    }
    return [...by.values()];
  });
}

/* ------------------------------------------------------------------ 统计工具 */
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};
const npdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
function corr(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 10) return null;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

/* ------------------------------------------------------------------ 主计算 */
type Deliverable = {
  id: string; name: string; cusip: string;
  coupon: number; maturityYears: number; yieldPct: number;
  cleanPrice: number; cf: number; basis: number; netBasis: number;
  irr: number; futuresEquiv: number; modDuration: number; convexity: number;
  dv01: number; isCTD: boolean;
  ctdProbability: number; ctdConfidence: number;
  predictedYield: number; predictedCF: number; predictedIRR: number;
};
type BasisPoint = { date: string; basis: number; netBasis: number; irr: number; futuresPrice: number };
type ContractSnap = {
  ticker: string; root: string; name: string; country: string; exchange: string; currency: string; contract: string; contractCode: string; month: string;
  last: number; chg: number; chgPct: number; vol: number; oi: number; high: number; low: number; settle: number;
  impliedYield: number | null; dv01: number | null; duration: number | null; repoRate: number; daysToDelivery: number;
  deliverables: Deliverable[]; history: BasisPoint[];
  zScore: number | null; anomaly: number; signal: string | null; expectedReturn: number;
};

function evalBond(b: Bond, y: number, settle: number, F: number, cf: number, repo: number, delivery: number) {
  const days = Math.max(1, Math.round((delivery - settle) / DAY));
  const p = priceAt(b, y, settle);
  const aiDel = accrued(b, delivery);
  const cpn = couponsBetween(b, settle, delivery);
  const basis = p.clean - F * cf;
  const carry = cpn + aiDel - p.ai - p.dirty * (repo / 100) * days / 360;
  const netBasis = basis - carry;
  const irr = ((F * cf + aiDel + cpn) / p.dirty - 1) * (360 / days) * 100;
  const fwdDirty = p.dirty * (1 + (repo / 100) * days / 360) - cpn;
  return { p, days, basis, carry, netBasis, irr, fwdClean: fwdDirty - aiDel };
}

async function futuresDaily(code: string | null, root: string, month: string) {
  if (code) {
    const r = await yahooChart(`${code}.CBT`, "1d", "6mo").catch(() => null);
    if (r?.candles.length) return r.candles.map((c) => ({ date: ymd(c.t), c: c.c }));
  }
  // 退回连续主力合约：只保留确定已切换到当前合约月之后的日期（交割月前第三个月起）
  const [y, m] = month.split("-").map(Number);
  const from = Date.UTC(y, m - 4, 1);
  const k = await getKline(root, "1d", 160).catch(() => []);
  return k.filter((c) => c.t >= from).map((c) => ({ date: ymd(c.t), c: c.c }));
}

async function buildAll(): Promise<{ contracts: ContractSnap[]; corrTickers: string[]; matrix: number[][]; asOf: string | null; sigmaDaily: number | null }> {
  return cached("wbf:all", 5 * 60_000, async () => {
    const [cv, mm, ticks, cot, notes, bonds] = await Promise.all([
      curves().catch(() => null),
      moneyMarket().catch(() => null),
      getTicks(SPECS.map((s) => s.root), { budgetMs: 6000 }).catch(() => ({} as Record<string, any>)),
      cotReport().catch(() => []),
      treasuryList("Note").catch(() => []),
      treasuryList("Bond").catch(() => []),
    ]);
    const usDays: CurveDay[] = cv?.us ?? [];
    const today = usDays[0] ?? null;
    const sofr = mm?.series?.SOFR ?? [];
    const repoNow = sofr.length ? sofr[sofr.length - 1].v : null;
    const repoOn = (d: string) => {
      for (let i = sofr.length - 1; i >= 0; i--) if (sofr[i].d <= d) return sofr[i].v;
      return repoNow;
    };
    // 10 年期收益率近 60 日日变动的实际波动率（百分点）
    const y10 = usDays.slice(0, 61).map((d) => d.points.find((p) => p.tenor === "10Y")?.value).filter((v): v is number => v != null).reverse();
    const dy = y10.slice(1).map((v, i) => v - y10[i]);
    const sigmaDaily = dy.length > 10 ? std(dy) : null;

    const settle = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    const contracts: ContractSnap[] = [];
    for (const spec of SPECS) {
      const fc = await futuresCurve(spec.root).catch(() => null);
      const front = fc?.points?.[0] ?? null;
      const tick = (ticks as Record<string, any>)[spec.root] ?? null;
      const last = Number(tick?.price ?? front?.price ?? NaN);
      if (!Number.isFinite(last) || last <= 0 || !front) continue;
      const month = front.month;
      const [yy, mo] = month.split("-").map(Number);
      const dd = deliveryDays(month, spec);
      const repo = repoNow ?? 0;
      const pool = (spec.kind === "Note" ? notes : bonds).filter((b) => {
        const rem = (b.maturity - dd.monthStart) / DAY / 30.4375;
        return rem >= spec.minMonths && rem <= spec.maxMonths + 0.5 && (!b.origMonths || b.origMonths <= spec.maxOrigMonths);
      });
      // 逐券计算
      const rows = today ? pool.map((b) => {
        const yrs = (b.maturity - settle) / DAY / 365.25;
        const y = interp(today, yrs);
        if (y == null) return null;
        const cf = conversionFactor(b, dd.monthStart, spec.cfRound);
        const e = evalBond(b, y, settle, last, cf, repo, dd.last);
        const eFirst = evalBond(b, y, settle, last, cf, repo, dd.first);
        const risk = riskAt(b, y, settle);
        const fwdYield = yieldFromClean(b, e.fwdClean, dd.last);
        return { b, y, yrs, cf, e, eFirst, risk, fwdYield };
      }).filter((r): r is NonNullable<typeof r> => r != null) : [];
      // 当前 CTD：IRR 最高
      const ctdIdx = rows.length ? rows.reduce((bi, r, i) => (r.e.irr > rows[bi].e.irr ? i : bi), 0) : -1;
      // 情景分析：交割日平行移动
      const horizonDays = Math.max(1, (dd.last - settle) / DAY);
      const sig = sigmaDaily != null ? sigmaDaily * Math.sqrt(horizonDays * 252 / 365) : null;
      const prob = new Array(rows.length).fill(0);
      const probNear = new Array(rows.length).fill(0);
      if (rows.length && sig != null && sig > 0) {
        let wSum = 0, wNear = 0;
        for (let k = -24; k <= 24; k++) {
          const zz = k / 8; // -3σ..+3σ
          const w = npdf(zz);
          const shift = zz * sig;
          let best = -1, bestPx = Infinity;
          rows.forEach((r, i) => {
            const px = priceAt(r.b, r.fwdYield + shift, dd.last).clean / r.cf;
            if (px < bestPx) { bestPx = px; best = i; }
          });
          if (best >= 0) { prob[best] += w; if (Math.abs(zz) <= 1) probNear[best] += w; }
          wSum += w;
          if (Math.abs(zz) <= 1) wNear += w;
        }
        for (let i = 0; i < rows.length; i++) { prob[i] /= wSum; probNear[i] /= wNear; }
      } else if (ctdIdx >= 0) {
        prob[ctdIdx] = 1;
        probNear[ctdIdx] = 1;
      }
      const deliverables: Deliverable[] = rows.map((r, i) => ({
        id: r.b.cusip, name: r.b.name, cusip: r.b.cusip,
        coupon: r.b.coupon, maturityYears: r4(r.yrs), yieldPct: r4(r.y),
        cleanPrice: r4(r.e.p.clean), cf: r6(r.cf), basis: r4(r.e.basis), netBasis: r4(r.e.netBasis),
        irr: r4(r.e.irr), futuresEquiv: r4(r.e.p.clean / r.cf), modDuration: r4(r.risk.modDur), convexity: r4(r.risk.convexity),
        dv01: r4(r.risk.dv01), isCTD: i === ctdIdx,
        ctdProbability: r4(prob[i]), ctdConfidence: r4(probNear[i]),
        // 远期收益率（按回购利率持有到最后交割日的盈亏平衡收益率）、转换因子（合约期内固定）、首个交割日交割的 IRR
        predictedYield: r4(r.fwdYield), predictedCF: r6(r.cf), predictedIRR: r4(r.eFirst.irr),
      })).sort((a, b) => b.irr - a.irr);
      const ctd = ctdIdx >= 0 ? rows[ctdIdx] : null;
      // 期货隐含收益率：CTD 在最后交割日按 F×CF 交割对应的收益率
      let impliedYield: number | null = null, dv01: number | null = null, duration: number | null = null;
      if (ctd) {
        impliedYield = yieldFromClean(ctd.b, last * ctd.cf, dd.last);
        const rk = riskAt(ctd.b, impliedYield, dd.last);
        duration = rk.modDur;
        dv01 = (rk.dv01 / ctd.cf) * (spec.face / 100);
      }
      // 基差历史（当前 CTD，按每日真实曲线、真实期货收盘、当日 SOFR）
      const history: BasisPoint[] = [];
      if (ctd) {
        const daily = await futuresDaily(front.code ?? null, spec.root, month).catch(() => []);
        const fBy = new Map(daily.map((x) => [x.date, x.c]));
        const since = ymd(Date.now() - 62 * DAY);
        for (const day of [...usDays].reverse()) {
          if (day.date < since) continue;
          const F = fBy.get(day.date);
          if (!F) continue;
          const s = parseDay(day.date);
          if (s >= dd.last) continue;
          const yv = interp(day, (ctd.b.maturity - s) / DAY / 365.25);
          if (yv == null) continue;
          const e = evalBond(ctd.b, yv, s, F, ctd.cf, repoOn(day.date) ?? repo, dd.last);
          history.push({ date: day.date, basis: r4(e.basis), netBasis: r4(e.netBasis), irr: r4(e.irr), futuresPrice: r4(F) });
        }
      }
      const nb = history.map((h) => h.netBasis);
      const cur = ctd ? ctd.e.netBasis : null;
      const sd = std(nb);
      const zScore = cur != null && nb.length >= 15 && sd > 0 ? (cur - mean(nb)) / sd : null;
      const anomaly = zScore != null ? Math.min(1, Math.abs(zScore) / 3) : 0;
      const signal = zScore != null && Math.abs(zScore) >= 2 ? (zScore > 0 ? "BUY_FUTURES_SELL_CTD" : "SELL_FUTURES_BUY_CTD") : null;
      const expectedReturn = ctd && zScore != null ? (Math.abs((cur ?? 0) - mean(nb)) / ctd.e.p.dirty) * 100 : 0;
      const cotRow = (cot as any[]).find((c) => c.symbol === spec.root);
      contracts.push({
        ticker: spec.ticker, root: spec.root, name: `${spec.label} ${MON[mo - 1]}${String(yy).slice(2)}`, country: "US", exchange: "CBOT", currency: "USD",
        contract: `${MON[mo - 1]} ${String(yy).slice(2)}`, contractCode: front.code, month,
        last: r6(last), chg: r6(Number(tick?.change ?? front.change ?? 0)), chgPct: r4(Number(tick?.changePct ?? front.changePct ?? 0)),
        vol: Number(front.volume ?? tick?.volume ?? 0) || 0,
        oi: Number(cotRow?.oi ?? 0) || 0,
        high: r6(Number(tick?.high ?? last)), low: r6(Number(tick?.low ?? last)), settle: r6(Number(tick?.prevClose ?? front.prev ?? last)),
        impliedYield: impliedYield != null ? r4(impliedYield) : null, dv01: dv01 != null ? Math.round(dv01 * 100) / 100 : null, duration: duration != null ? r4(duration) : null,
        repoRate: r4(repo), daysToDelivery: Math.round((dd.last - settle) / DAY),
        deliverables, history, zScore: zScore != null ? r4(zScore) : null, anomaly: r4(anomaly), signal, expectedReturn: Math.round(expectedReturn * 100) / 100,
      });
    }
    // 跨合约相关性：近 90 个交易日日收益率
    const series = await Promise.all(contracts.map(async (c) => {
      const k = await getKline(c.root, "1d", 130).catch(() => []);
      return new Map(k.map((x) => [ymd(x.t), x.c]));
    }));
    const dates = [...new Set(series.flatMap((m) => [...m.keys()]))].sort().filter((d) => series.every((m) => m.has(d))).slice(-91);
    const rets = series.map((m) => dates.slice(1).map((d, i) => Math.log(m.get(d)! / m.get(dates[i])!)));
    const matrix = contracts.map((_, i) => contracts.map((__, j) => (i === j ? 1 : r4(corr(rets[i], rets[j]) ?? 0))));
    return { contracts, corrTickers: contracts.map((c) => c.ticker), matrix, asOf: today?.date ?? null, sigmaDaily };
  });
}

const EMPTY_CONTRACT = { ticker: "", name: "", last: 0, repoRate: 0, daysToDelivery: 0 };

export const wbfAdvancedRouter = router({
  /** 国债期货列表（实时价格、隐含收益率、DV01、CTD 与基差信号） */
  getContracts: publicProcedure.query(async () => {
    const { contracts } = await buildAll();
    return contracts.map((c) => {
      const ctd = c.deliverables.find((d) => d.isCTD);
      return {
        ticker: c.ticker, name: c.name, country: c.country,
        exchange: c.exchange, currency: c.currency, contract: c.contract,
        last: c.last, chg: c.chg, chgPct: c.chgPct,
        vol: c.vol, oi: c.oi, high: c.high, low: c.low, settle: c.settle,
        impliedYield: c.impliedYield, dv01: c.dv01, duration: c.duration,
        repoRate: c.repoRate, daysToDelivery: c.daysToDelivery,
        basisArbitrageSignal: c.signal,
        basisArbitrageScore: c.anomaly,
        ctdBond: ctd?.name || "N/A",
        ctdProbability: ctd?.ctdProbability || 0,
      };
    });
  }),

  /** 某合约的可交割券篮子（逐券基差 / 净基差 / IRR / 转换因子 / 情景 CTD 概率） */
  getDeliverables: publicProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      const { contracts, sigmaDaily } = await buildAll();
      const c = contracts.find((x) => x.ticker === input.ticker) ?? contracts[0];
      const ctd = c?.deliverables.find((d) => d.isCTD);
      return {
        contract: c ? { ticker: c.ticker, name: c.name, last: c.last, repoRate: c.repoRate, daysToDelivery: c.daysToDelivery } : EMPTY_CONTRACT,
        deliverables: c?.deliverables ?? [],
        modelInfo: {
          name: "收益率曲线平行移动情景 CTD 分析（6% 标准转换因子）",
          stateSpace: ["当日美债面值收益率曲线", "期货实时价格", "SOFR 回购利率", "逐券票息/到期日", "交割日", "10年期收益率实际波动率"],
          actionSpace: ["最便宜可交割券", "对冲比率（CTD DV01 ÷ 转换因子）"],
          rewardFunction: `情景权重 = 正态分布；σ(日) = ${sigmaDaily != null ? (sigmaDaily * 100).toFixed(1) : "—"}bp，按至最后交割日的交易日数放大`,
          trainingEpisodes: 49,
          confidence: ctd?.ctdProbability ?? 0,
        },
      };
    }),

  /** 跨合约相关性矩阵（近 90 个交易日实际日收益率）与基差异常度 */
  getCrossMarketCorrelation: publicProcedure.query(async () => {
    const { contracts, corrTickers, matrix } = await buildAll();
    return {
      tickers: corrTickers,
      matrix,
      anomalyScores: Object.fromEntries(contracts.map((c) => [c.ticker, c.anomaly])) as Record<string, number>,
      modelInfo: {
        name: "国债期货跨期限相关性与净基差异常度",
        graphNodes: "2/5/10/30年及超长期美债期货",
        graphEdges: "近 90 个交易日日对数收益率的皮尔逊相关系数",
        messagePassing: "异常度 = |当前 CTD 净基差相对近两个月历史的 Z 分数| ÷ 3（上限 1）",
        threshold: 0.667,
      },
    };
  }),

  /** 当前 CTD 的基差 / 净基差 / IRR 近两个月历史（每日真实曲线与期货收盘计算） */
  getBasisHistory: publicProcedure
    .input(z.object({ ticker: z.string().default("ZN1") }))
    .query(async ({ input }) => {
      const { contracts } = await buildAll();
      return (contracts.find((c) => c.ticker === input.ticker) ?? contracts[0])?.history ?? [];
    }),

  /** 基差套利信号：净基差 |Z| ≥ 2 */
  getArbitrageSignals: publicProcedure.query(async () => {
    const { contracts } = await buildAll();
    return contracts
      .filter((c) => c.signal !== null)
      .map((c) => {
        const ctd = c.deliverables.find((d) => d.isCTD);
        return {
          ticker: c.ticker, name: c.name,
          signal: c.signal,
          score: c.anomaly,
          ctdBond: ctd?.name || "N/A",
          description: c.signal === "BUY_FUTURES_SELL_CTD"
            ? `CTD 净基差 ${ctd?.netBasis?.toFixed(4)} 高于近两个月均值 ${c.zScore?.toFixed(2)} 个标准差：期货相对现券偏便宜，可考虑卖出基差（买期货、卖 CTD）`
            : `CTD 净基差 ${ctd?.netBasis?.toFixed(4)} 低于近两个月均值 ${Math.abs(c.zScore ?? 0).toFixed(2)} 个标准差：期货相对现券偏贵，可考虑买入基差（买 CTD、卖期货）`,
          expectedReturn: c.expectedReturn,
        };
      });
  }),
});

/**
 * 第二批专业页面的实时数据：期货期限结构（能源 / 金属 / 农产品 / 利率 / 股指）、货币市场利率与联邦基金隐含路径、
 * 美债拍卖、欧元区主权利差、商品机构持仓（分类持仓报告）、隐含波动率扫描（含平台自有历史的隐波分位）、
 * 多标的日线序列（供板块轮动 / 资产配置 / 相关性 / 风险计算）、按揭利率、住房相关物价与就业。
 * 不返回来源字段；拿到的数据同时写入平台自有库（uc_series），永久保留。
 */
import { sql } from "drizzle-orm";
import { getJson, getKline, getText, num } from "./market";
import { exec, query } from "./store";

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

async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

/* ------------------------------------------------------------------ 平台自有时间序列库 */
export async function saveSeries(rows: Array<{ series: string; d: string; v: number }>) {
  const ok = rows.filter((r) => Number.isFinite(r.v) && r.d && r.series);
  for (let i = 0; i < ok.length; i += 400) {
    const batch = ok.slice(i, i + 400);
    await exec(sql`INSERT INTO uc_series (series, d, v) VALUES ${sql.join(batch.map((r) => sql`(${r.series.slice(0, 64)}, ${r.d.slice(0, 10)}, ${r.v})`), sql`, `)} ON DUPLICATE KEY UPDATE v = VALUES(v)`).catch(() => undefined);
  }
}
export async function loadSeries(series: string, n = 500): Promise<Array<{ d: string; v: number }>> {
  const rows = await query<{ d: string; v: number }>(sql`SELECT d, v FROM uc_series WHERE series = ${series} ORDER BY d DESC LIMIT ${n}`).catch(() => []);
  return rows.map((r) => ({ d: String(r.d), v: Number(r.v) })).reverse();
}
const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ 期货期限结构 */
const MCODE = "FGHJKMNQUVXZ";
type Root = { ex: string; months: number[]; n: number; name: string; unit: string };
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const Q = [3, 6, 9, 12];
export const FUT_ROOTS: Record<string, Root> = {
  CL: { ex: "NYM", months: ALL, n: 18, name: "WTI 原油", unit: "美元/桶" },
  BZ: { ex: "NYM", months: ALL, n: 12, name: "布伦特原油", unit: "美元/桶" },
  NG: { ex: "NYM", months: ALL, n: 18, name: "天然气", unit: "美元/百万英热" },
  RB: { ex: "NYM", months: ALL, n: 12, name: "RBOB 汽油", unit: "美元/加仑" },
  HO: { ex: "NYM", months: ALL, n: 12, name: "取暖油", unit: "美元/加仑" },
  GC: { ex: "CMX", months: [2, 4, 6, 8, 10, 12], n: 10, name: "黄金", unit: "美元/盎司" },
  SI: { ex: "CMX", months: [3, 5, 7, 9, 12], n: 8, name: "白银", unit: "美元/盎司" },
  HG: { ex: "CMX", months: ALL, n: 15, name: "铜", unit: "美元/磅" },
  PL: { ex: "NYM", months: [1, 4, 7, 10], n: 5, name: "铂金", unit: "美元/盎司" },
  PA: { ex: "NYM", months: Q, n: 4, name: "钯金", unit: "美元/盎司" },
  ZC: { ex: "CBT", months: [3, 5, 7, 9, 12], n: 8, name: "玉米", unit: "美分/蒲式耳" },
  ZS: { ex: "CBT", months: [1, 3, 5, 7, 8, 9, 11], n: 10, name: "大豆", unit: "美分/蒲式耳" },
  ZW: { ex: "CBT", months: [3, 5, 7, 9, 12], n: 8, name: "小麦", unit: "美分/蒲式耳" },
  KC: { ex: "NYB", months: [3, 5, 7, 9, 12], n: 7, name: "咖啡", unit: "美分/磅" },
  SB: { ex: "NYB", months: [3, 5, 7, 10], n: 7, name: "原糖", unit: "美分/磅" },
  CC: { ex: "NYB", months: [3, 5, 7, 9, 12], n: 7, name: "可可", unit: "美元/吨" },
  CT: { ex: "NYB", months: [3, 5, 7, 10, 12], n: 6, name: "棉花", unit: "美分/磅" },
  LE: { ex: "CME", months: [2, 4, 6, 8, 10, 12], n: 6, name: "活牛", unit: "美分/磅" },
  HE: { ex: "CME", months: [2, 4, 5, 6, 7, 8, 10, 12], n: 8, name: "瘦肉猪", unit: "美分/磅" },
  ZT: { ex: "CBT", months: Q, n: 3, name: "2 年美债期货", unit: "点" },
  ZF: { ex: "CBT", months: Q, n: 3, name: "5 年美债期货", unit: "点" },
  ZN: { ex: "CBT", months: Q, n: 3, name: "10 年美债期货", unit: "点" },
  ZB: { ex: "CBT", months: Q, n: 3, name: "30 年美债期货", unit: "点" },
  UB: { ex: "CBT", months: Q, n: 3, name: "超长美债期货", unit: "点" },
  ZQ: { ex: "CBT", months: ALL, n: 18, name: "30 天联邦基金期货", unit: "点" },
  SR3: { ex: "CME", months: Q, n: 14, name: "3 个月 SOFR 期货", unit: "点" },
  ES: { ex: "CME", months: Q, n: 4, name: "标普 500 期货", unit: "点" },
  NQ: { ex: "CME", months: Q, n: 4, name: "纳指 100 期货", unit: "点" },
  YM: { ex: "CBT", months: Q, n: 3, name: "道指期货", unit: "点" },
  RTY: { ex: "CME", months: Q, n: 3, name: "罗素 2000 期货", unit: "点" },
};

export type CurvePoint = { code: string; month: string; price: number; prev: number | null; change: number | null; changePct: number | null; volume: number | null; time: number | null };

function contractCodes(root: string, cfg: Root) {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  const out: Array<{ code: string; month: string }> = [];
  for (let guard = 0; out.length < cfg.n + 1 && guard < 60; guard++) {
    if (cfg.months.includes(m)) out.push({ code: `${root}${MCODE[m - 1]}${String(y % 100).padStart(2, "0")}.${cfg.ex}`, month: `${y}-${String(m).padStart(2, "0")}` });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

async function sparkMeta(codes: string[]) {
  const out = new Map<string, any>();
  for (let i = 0; i < codes.length; i += 20) {
    const chunk = codes.slice(i, i + 20);
    try {
      const json = await getJson<any>(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${chunk.map(encodeURIComponent).join(",")}&range=1d&interval=1d`);
      for (const r of json?.spark?.result ?? []) {
        const meta = r?.response?.[0]?.meta;
        if (meta && r?.symbol) out.set(String(r.symbol).toUpperCase(), meta);
      }
    } catch {
      /* 本批失败则跳过 */
    }
  }
  return out;
}

export async function futuresCurve(root: string): Promise<{ root: string; name: string; unit: string; points: CurvePoint[]; structure: string; slopePct: number | null }> {
  const cfg = FUT_ROOTS[root];
  if (!cfg) throw new Error("暂不支持该品种");
  return cached(`fc:${root}`, 60_000, async () => {
    const list = contractCodes(root, cfg);
    const meta = await sparkMeta(list.map((x) => x.code));
    const nowS = Date.now() / 1000;
    const points: CurvePoint[] = [];
    for (const c of list) {
      const m = meta.get(c.code.toUpperCase());
      const price = num(m?.regularMarketPrice);
      if (!m || price == null || price <= 0) continue;
      // 已经到期 / 很久没成交的合约不纳入曲线
      const t = num(m.regularMarketTime);
      if (t != null && nowS - t > 12 * 86400) continue;
      const prev = num(m.chartPreviousClose) ?? num(m.previousClose);
      points.push({ code: c.code.split(".")[0], month: c.month, price, prev, change: prev ? price - prev : null, changePct: prev ? ((price - prev) / prev) * 100 : null, volume: num(m.regularMarketVolume), time: t ? t * 1000 : null });
    }
    const pts = points.slice(0, cfg.n);
    const first = pts[0]?.price;
    const last = pts[pts.length - 1]?.price;
    const slopePct = first && last && pts.length > 1 ? ((last - first) / first) * 100 : null;
    const structure = slopePct == null ? "—" : Math.abs(slopePct) < 0.3 ? "平坦" : slopePct > 0 ? "升水（远月高于近月）" : "贴水（近月高于远月）";
    if (pts[0]) void saveSeries([{ series: `fut:${root}:front`, d: today(), v: pts[0].price }, ...(slopePct != null ? [{ series: `fut:${root}:slope`, d: today(), v: slopePct }] : [])]);
    return { root, name: cfg.name, unit: cfg.unit, points: pts, structure, slopePct };
  });
}

export async function futuresCurves(roots: string[]) {
  const ok = roots.filter((r) => FUT_ROOTS[r]).slice(0, 30);
  const res = await pool(ok, 6, (r) => futuresCurve(r).catch(() => null));
  return res.filter(Boolean);
}

/* ------------------------------------------------------------------ 货币市场 */
const MM: Array<[string, string]> = [["SOFR", "secured/sofr"], ["TGCR", "secured/tgcr"], ["BGCR", "secured/bgcr"], ["EFFR", "unsecured/effr"], ["OBFR", "unsecured/obfr"]];
export async function moneyMarket() {
  return cached("mm", 30 * 60_000, async () => {
    const series: Record<string, Array<{ d: string; v: number; vol: number | null; p1: number | null; p99: number | null }>> = {};
    let target: { from: number | null; to: number | null } = { from: null, to: null };
    await Promise.all(MM.map(async ([k, path]) => {
      try {
        const j = JSON.parse(await getText(`https://markets.newyorkfed.org/api/rates/${path}/last/260.json`, {}, "utf-8", 20000));
        const rows = (j?.refRates ?? []) as any[];
        series[k] = rows.map((r) => ({ d: String(r.effectiveDate), v: Number(r.percentRate), vol: num(r.volumeInBillions), p1: num(r.percentPercentile1), p99: num(r.percentPercentile99) })).filter((r) => Number.isFinite(r.v)).reverse();
        if (k === "EFFR" && rows[0]) target = { from: num(rows[0].targetRateFrom), to: num(rows[0].targetRateTo) };
      } catch {
        series[k] = (await loadSeries(`mm:${k}`, 260)).map((r) => ({ ...r, vol: null, p1: null, p99: null }));
      }
    }));
    void saveSeries(Object.entries(series).flatMap(([k, rows]) => rows.slice(-30).map((r) => ({ series: `mm:${k}`, d: r.d, v: r.v }))));
    const [zq, sr3] = await Promise.all([futuresCurve("ZQ").catch(() => null), futuresCurve("SR3").catch(() => null)]);
    const mid = target.from != null && target.to != null ? (target.from + target.to) / 2 : null;
    const path = (zq?.points ?? []).map((p) => ({ month: p.month, rate: +(100 - p.price).toFixed(3), chg: p.change != null ? -p.change : null, cuts: mid != null ? +(((mid - (100 - p.price)) / 0.25)).toFixed(2) : null }));
    const sofrStrip = (sr3?.points ?? []).map((p) => ({ month: p.month, rate: +(100 - p.price).toFixed(3), chg: p.change != null ? -p.change : null, volume: p.volume }));
    return { series, target, path, sofrStrip };
  });
}

/* ------------------------------------------------------------------ 美债拍卖 */
const n0 = (v: unknown) => { const x = num(v); return x == null || x === 0 ? null : x; };
function slimAuction(a: any) {
  const total = n0(a.totalAccepted);
  return {
    cusip: String(a.cusip ?? ""), type: String(a.securityType ?? ""), term: String(a.securityTerm ?? ""), reopening: a.reopening === "Yes",
    announce: String(a.announcementDate ?? "").slice(0, 10), auction: String(a.auctionDate ?? "").slice(0, 10), issue: String(a.issueDate ?? "").slice(0, 10), maturity: String(a.maturityDate ?? "").slice(0, 10),
    offering: n0(a.offeringAmount), coupon: n0(a.interestRate), highYield: n0(a.highYield) ?? n0(a.highInvestmentRate), highDiscount: n0(a.highDiscountRate),
    btc: n0(a.bidToCoverRatio), total, tendered: n0(a.totalTendered),
    direct: total && n0(a.directBidderAccepted) ? (n0(a.directBidderAccepted)! / total) * 100 : null,
    indirect: total && n0(a.indirectBidderAccepted) ? (n0(a.indirectBidderAccepted)! / total) * 100 : null,
    dealer: total && n0(a.primaryDealerAccepted) ? (n0(a.primaryDealerAccepted)! / total) * 100 : null,
    allotted: n0(a.allocationPercentage), tips: a.tips === "Yes", frn: a.floatingRate === "Yes", closing: String(a.closingTimeCompetitive ?? ""),
  };
}
export async function treasuryAuctions() {
  return cached("auctions", 20 * 60_000, async () => {
    const [up, done] = await Promise.all([
      getText("https://www.treasurydirect.gov/TA_WS/securities/upcoming?format=json", {}, "utf-8", 20000).then((t) => JSON.parse(t) as any[]).catch(() => []),
      getText("https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&days=120", {}, "utf-8", 25000).then((t) => JSON.parse(t) as any[]).catch(() => []),
    ]);
    const results = done.map(slimAuction).filter((a) => a.btc != null || a.highYield != null || a.highDiscount != null).sort((a, b) => b.auction.localeCompare(a.auction));
    void saveSeries(results.filter((a) => a.btc != null).map((a) => ({ series: `auction:btc:${a.type}:${a.term}`.slice(0, 64), d: a.auction, v: a.btc! })));
    return { upcoming: up.map(slimAuction).sort((a, b) => a.auction.localeCompare(b.auction)), results };
  });
}

/* ------------------------------------------------------------------ 欧元区主权利差 */
const COUNTRY: Record<string, string> = { AT: "奥地利", BE: "比利时", BG: "保加利亚", CY: "塞浦路斯", CZ: "捷克", DE: "德国", DK: "丹麦", EE: "爱沙尼亚", ES: "西班牙", FI: "芬兰", FR: "法国", GR: "希腊", HR: "克罗地亚", HU: "匈牙利", IE: "爱尔兰", IT: "意大利", LT: "立陶宛", LU: "卢森堡", LV: "拉脱维亚", MT: "马耳他", NL: "荷兰", PL: "波兰", PT: "葡萄牙", RO: "罗马尼亚", SE: "瑞典", SI: "斯洛文尼亚", SK: "斯洛伐克" };
function csvRows(text: string) {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const cells: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}
export async function sovereignSpreads() {
  return cached("sov", 6 * 3600_000, async () => {
    const text = await getText("https://data-api.ecb.europa.eu/service/data/IRS/M..L.L40.CI.0000.EUR.N.Z?lastNObservations=61&format=csvdata", {}, "utf-8", 30000);
    const rows = csvRows(text);
    const head = rows[0] ?? [];
    const iA = head.indexOf("REF_AREA"), iT = head.indexOf("TIME_PERIOD"), iV = head.indexOf("OBS_VALUE");
    const by: Record<string, Array<{ d: string; v: number }>> = {};
    for (const r of rows.slice(1)) {
      const v = Number(r[iV]);
      if (!Number.isFinite(v) || !COUNTRY[r[iA]]) continue;
      (by[r[iA]] ??= []).push({ d: r[iT], v });
    }
    for (const k of Object.keys(by)) by[k].sort((a, b) => a.d.localeCompare(b.d));
    const de = new Map((by.DE ?? []).map((x) => [x.d, x.v]));
    const countries = Object.entries(by).map(([code, s]) => {
      const last = s[s.length - 1];
      const at = (k: number) => s[s.length - 1 - k];
      const spread = (p?: { d: string; v: number }) => (p && de.has(p.d) ? Math.round((p.v - de.get(p.d)!) * 100) : null);
      return { code, name: COUNTRY[code], date: last.d, y: last.v, spread: spread(last), spread1m: spread(at(1)), spread12m: spread(at(12)), chg1m: at(1) ? Math.round((last.v - at(1).v) * 100) : null, chg12m: at(12) ? Math.round((last.v - at(12).v) * 100) : null, hist: s.map((x) => ({ d: x.d, y: x.v, s: de.has(x.d) ? Math.round((x.v - de.get(x.d)!) * 100) : null })) };
    }).sort((a, b) => (b.spread ?? -999) - (a.spread ?? -999));
    void saveSeries(countries.flatMap((c) => c.hist.slice(-3).map((h) => ({ series: `sov10y:${c.code}`, d: h.d, v: h.y }))));
    return { countries };
  });
}

/* ------------------------------------------------------------------ 商品机构持仓（分类报告） */
const DISAGG: Array<[string, string, RegExp]> = [
  ["CL", "WTI 原油", /^WTI-PHYSICAL - NEW YORK MERCANTILE|^CRUDE OIL, LIGHT SWEET.*NEW YORK MERCANTILE/],
  ["BZ", "布伦特原油", /^BRENT LAST DAY/],
  ["NG", "天然气", /^NAT GAS NYME|^NATURAL GAS - NEW YORK MERCANTILE|^HENRY HUB - NEW YORK MERCANTILE/],
  ["RB", "RBOB 汽油", /^GASOLINE RBOB|^GASOLINE BLENDSTOCK \(RBOB\)/],
  ["HO", "取暖油", /^NY HARBOR ULSD|^#2 HEATING OIL/],
  ["GC", "黄金", /^GOLD - COMMODITY EXCHANGE/],
  ["SI", "白银", /^SILVER - COMMODITY EXCHANGE/],
  ["HG", "铜", /^COPPER.*COMMODITY EXCHANGE/],
  ["PL", "铂金", /^PLATINUM - NEW YORK MERCANTILE/],
  ["PA", "钯金", /^PALLADIUM - NEW YORK MERCANTILE/],
  ["ZC", "玉米", /^CORN - CHICAGO BOARD OF TRADE/],
  ["ZS", "大豆", /^SOYBEANS - CHICAGO BOARD OF TRADE/],
  ["ZW", "小麦", /^WHEAT-SRW - CHICAGO BOARD OF TRADE/],
  ["ZM", "豆粕", /^SOYBEAN MEAL - CHICAGO BOARD OF TRADE/],
  ["ZL", "豆油", /^SOYBEAN OIL - CHICAGO BOARD OF TRADE/],
  ["KC", "咖啡", /^COFFEE C - ICE FUTURES U\.S\./],
  ["SB", "原糖", /^SUGAR NO\. 11 - ICE FUTURES U\.S\./],
  ["CC", "可可", /^COCOA - ICE FUTURES U\.S\./],
  ["CT", "棉花", /^COTTON NO\. 2 - ICE FUTURES U\.S\./],
  ["LE", "活牛", /^LIVE CATTLE - CHICAGO MERCANTILE/],
  ["HE", "瘦肉猪", /^LEAN HOGS - CHICAGO MERCANTILE/],
];
export async function cotCommodities() {
  return cached("cotd", 6 * 3600_000, async () => {
    const text = await getText("https://www.cftc.gov/dea/newcot/f_disagg.txt", {}, "utf-8", 30000);
    const best = new Map<string, any>();
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const c = csvRows(line)[0].map((x) => x.trim());
      const name = c[0];
      const hit = DISAGG.find(([, , re]) => re.test(name));
      if (!hit) continue;
      const n = (i: number) => Number(c[i]) || 0;
      const row = {
        key: hit[0], name: hit[1], date: c[2], oi: n(7), oiChg: n(55),
        pmLong: n(8), pmShort: n(9), swapLong: n(10), swapShort: n(11), mmLong: n(13), mmShort: n(14), mmSpread: n(15), otherLong: n(16), otherShort: n(17), nonLong: n(21), nonShort: n(22),
        pmNetChg: n(56) - n(57), swapNetChg: n(58) - n(59), mmLongChg: n(61), mmShortChg: n(62),
      };
      const prev = best.get(hit[0]);
      if (!prev || row.oi > prev.oi) best.set(hit[0], row);
    }
    const rows = DISAGG.map(([k]) => best.get(k)).filter(Boolean).map((r: any) => ({ ...r, mmNet: r.mmLong - r.mmShort, mmNetChg: r.mmLongChg - r.mmShortChg, pmNet: r.pmLong - r.pmShort, swapNet: r.swapLong - r.swapShort, mmNetPctOi: r.oi ? ((r.mmLong - r.mmShort) / r.oi) * 100 : 0 }));
    void saveSeries(rows.map((r: any) => ({ series: `cotd:${r.key}:mmnet`, d: r.date, v: r.mmNet })));
    const hist: Record<string, Array<{ d: string; v: number }>> = {};
    await Promise.all(rows.map(async (r: any) => { hist[r.key] = await loadSeries(`cotd:${r.key}:mmnet`, 156); }));
    return { rows: rows.map((r: any) => ({ ...r, hist: hist[r.key] ?? [] })) };
  });
}

/* ------------------------------------------------------------------ 隐含波动率扫描 */
const CBOE_ALIAS: Record<string, string> = { "^GSPC": "_SPX", SPX: "_SPX", "^NDX": "_NDX", NDX: "_NDX", "^RUT": "_RUT", "^VIX": "_VIX", "^DJI": "_DJX" };
function realizedVol(closes: number[], n: number) {
  if (closes.length < n + 1) return null;
  const s = closes.slice(-(n + 1));
  const r: number[] = [];
  for (let i = 1; i < s.length; i++) r.push(Math.log(s[i] / s[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v * 252) * 100;
}
export async function ivScan(symbols: string[]) {
  const list = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 60);
  return cached(`iv:${list.join(",")}`, 120_000, async () => {
    const rows = await pool(list, 8, async (sym) => {
      const code = CBOE_ALIAS[sym] ?? sym.replace(/^\^/, "_");
      const [q, k] = await Promise.all([
        cached(`cbq:${code}`, 120_000, () => getText(`https://cdn.cboe.com/api/global/delayed_quotes/quotes/${encodeURIComponent(code)}.json`, {}, "utf-8", 12000).then((t) => JSON.parse(t)?.data)).catch(() => null),
        getKline(sym, "1d", 260).catch(() => []),
      ]);
      const closes = k.map((c) => c.c).filter((v) => v > 0);
      const iv = num(q?.iv30);
      if (iv != null && iv > 0) void saveSeries([{ series: `iv30:${sym}`, d: today(), v: iv }]);
      const hist = iv != null ? await loadSeries(`iv30:${sym}`, 252) : [];
      const hv = hist.map((h) => h.v);
      const rank = hv.length >= 20 && iv != null ? ((iv - Math.min(...hv)) / Math.max(1e-9, Math.max(...hv) - Math.min(...hv))) * 100 : null;
      const pct = hv.length >= 20 && iv != null ? (hv.filter((v) => v <= iv).length / hv.length) * 100 : null;
      const rv20 = realizedVol(closes, 20), rv60 = realizedVol(closes, 60), rv120 = realizedVol(closes, 120);
      const hi = closes.length ? Math.max(...closes.slice(-252)) : null;
      return {
        symbol: sym, price: num(q?.current_price) ?? closes[closes.length - 1] ?? null, changePct: num(q?.price_change_percent),
        iv30: iv, iv30Chg: num(q?.iv30_change), rv20, rv60, rv120, ivRv: iv != null && rv20 != null ? iv - rv20 : null,
        ivRank: rank, ivPct: pct, ivDays: hv.length, fromHigh: hi && closes.length ? ((closes[closes.length - 1] - hi) / hi) * 100 : null,
        cone: [10, 20, 30, 60, 90, 120].map((n) => {
          const vals: number[] = [];
          for (let e = n + 1; e <= closes.length; e += 5) { const v = realizedVol(closes.slice(0, e), n); if (v != null) vals.push(v); }
          vals.sort((a, b) => a - b);
          const qt = (p: number) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))] : null);
          return { n, min: qt(0), p25: qt(0.25), med: qt(0.5), p75: qt(0.75), max: qt(1), now: realizedVol(closes, n) };
        }),
      };
    });
    return rows;
  });
}

/* ------------------------------------------------------------------ 多标的日线序列 */
export async function closesPack(symbols: string[], days = 260) {
  const list = [...new Set(symbols)].slice(0, 60);
  const lim = Math.min(Math.max(days, 30), 2600);
  return cached(`pack:${list.join(",")}:${lim}`, 10 * 60_000, async () => {
    const res = await pool(list, 6, async (s) => [s, (await getKline(s, "1d", lim).catch(() => [])).map((c) => [c.t, c.c] as [number, number])] as const);
    return Object.fromEntries(res) as Record<string, Array<[number, number]>>;
  });
}

/* ------------------------------------------------------------------ 房地产：按揭利率 + 住房物价 / 就业 */
export async function housing() {
  return cached("housing", 6 * 3600_000, async () => {
    const pmms = await getText("https://www.freddiemac.com/pmms/docs/PMMS_history.csv", {}, "utf-8", 30000).then((t) => {
      const rows = csvRows(t).slice(1);
      return rows.map((r) => {
        const [m, d, y] = r[0].split("/").map(Number);
        return { d: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, m30: num(r[1]), m15: num(r[3]) };
      }).filter((r) => r.m30 != null && r.d >= "2000-01-01");
    }).catch(async () => (await loadSeries("pmms30", 600)).map((r) => ({ d: r.d, m30: r.v, m15: null })));
    void saveSeries(pmms.slice(-10).map((r) => ({ series: "pmms30", d: r.d, v: r.m30! })));
    const ids: Array<[string, string]> = [["CUUR0000SAH1", "住所（CPI）"], ["CUUR0000SEHA", "主要住所租金"], ["CUUR0000SEHC", "业主等价租金"], ["CES2000000001", "建筑业就业（千人）"], ["CES2023610001", "住宅建筑就业（千人）"]];
    let bls: Array<{ id: string; name: string; points: Array<{ d: string; v: number }> }> = [];
    try {
      const y = new Date().getUTCFullYear();
      const r = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seriesid: ids.map((x) => x[0]), startyear: String(y - 6), endyear: String(y) }), signal: AbortSignal.timeout(25000) });
      const j = await r.json();
      bls = (j?.Results?.series ?? []).map((s: any) => ({
        id: s.seriesID, name: ids.find((x) => x[0] === s.seriesID)?.[1] ?? s.seriesID,
        points: (s.data ?? []).filter((p: any) => /^M\d\d$/.test(p.period) && p.period !== "M13").map((p: any) => ({ d: `${p.year}-${p.period.slice(1)}`, v: Number(p.value) })).filter((p: any) => Number.isFinite(p.v)).reverse(),
      }));
      void saveSeries(bls.flatMap((s) => s.points.slice(-6).map((p) => ({ series: `bls:${s.id}`, d: p.d, v: p.v }))));
    } catch {
      bls = await Promise.all(ids.map(async ([id, name]) => ({ id, name, points: await loadSeries(`bls:${id}`, 80) })));
    }
    return { pmms, bls };
  });
}

/* ------------------------------------------------------------------ 可转债：条款（转股价 / 评级 / 到期）+ 实时正股与转债价格 */
type CbTerm = { code: string; name: string; market: "sh" | "sz"; stock: string; stockName: string; convPrice: number; rating: string | null; expire: string; listing: string | null; scale: number | null; redeemTrig: number | null; resaleTrig: number | null };
async function cbTerms(): Promise<CbTerm[]> {
  return cached("cbterms", 6 * 3600_000, async () => {
    const out: CbTerm[] = [];
    const cols = "SECURITY_CODE,SECURITY_NAME_ABBR,TRADE_MARKET,CONVERT_STOCK_CODE,SECURITY_SHORT_NAME,RATING,LISTING_DATE,DELIST_DATE,EXPIRE_DATE,TRANSFER_PRICE,INITIAL_TRANSFER_PRICE,ACTUAL_ISSUE_SCALE,PUBLIC_START_DATE";
    const td = today();
    for (let page = 1; page <= 3; page++) {
      const j = await getJson<any>(`https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_BOND_CB_LIST&columns=${cols}&sortColumns=PUBLIC_START_DATE&sortTypes=-1&pageSize=500&pageNumber=${page}`);
      const data: any[] = j?.result?.data ?? [];
      for (const r of data) {
        const mk = r.TRADE_MARKET === "CNSESH" ? "sh" : r.TRADE_MARKET === "CNSESZ" ? "sz" : null;
        const exp = String(r.EXPIRE_DATE ?? "").slice(0, 10);
        if (!mk || r.DELIST_DATE || !exp || exp < td) continue;
        const conv = num(r.TRANSFER_PRICE) ?? num(r.INITIAL_TRANSFER_PRICE);
        if (!conv) continue;
        const stock = String(r.CONVERT_STOCK_CODE ?? "");
        out.push({ code: `${mk}${r.SECURITY_CODE}`, name: String(r.SECURITY_NAME_ABBR ?? ""), market: mk, stock: `${stock.startsWith("6") ? "sh" : "sz"}${stock}`, stockName: String(r.SECURITY_SHORT_NAME ?? ""), convPrice: conv, rating: r.RATING ?? null, expire: exp, listing: r.LISTING_DATE ? String(r.LISTING_DATE).slice(0, 10) : null, scale: num(r.ACTUAL_ISSUE_SCALE), redeemTrig: conv * 1.3, resaleTrig: conv * 0.7 });
      }
      if (data.length < 500 || String(data[data.length - 1]?.PUBLIC_START_DATE ?? "") < "2018-01-01") break;
    }
    if (out.length) void saveSeries([{ series: "cb:count", d: td, v: out.length }]);
    return out;
  });
}
export async function convertibles() {
  const terms = await cbTerms();
  return cached("cblive", 15_000, async () => {
    const syms = [...new Set(terms.flatMap((t) => [t.code, t.stock]))];
    const ticks: Record<string, { price: number; changePct: number | null; amount: number | null }> = {};
    const chunks: string[][] = [];
    for (let i = 0; i < syms.length; i += 80) chunks.push(syms.slice(i, i + 80));
    await pool(chunks, 6, async (chunk) => {
      try {
        const text = await getText(`https://qt.gtimg.cn/q=${chunk.join(",")}`, { Referer: "https://gu.qq.com/" }, "gbk", 8000);
        for (const line of text.split(";")) {
          const m = /v_([a-z]{2}\d{6})="([^"]*)"/.exec(line);
          if (!m) continue;
          const f = m[2].split("~");
          const price = num(f[3]);
          if (price == null || price <= 0) continue;
          ticks[m[1]] = { price, changePct: num(f[32]), amount: num(f[37]) != null ? num(f[37])! * 10000 : null };
        }
      } catch {
        /* 单批失败忽略 */
      }
    });
    const td = Date.now();
    const rows = terms.map((t) => {
      const b = ticks[t.code];
      const s = ticks[t.stock];
      // 尚未上市的转债（腾讯返回面值 100、无成交）不计入行情
      const price = b?.price && b.price > 0 && !(!t.listing && !b.amount) ? b.price : null;
      const sp = s?.price && s.price > 0 ? s.price : null;
      const convValue = sp ? (100 / t.convPrice) * sp : null;
      const premium = price && convValue ? (price / convValue - 1) * 100 : null;
      const years = Math.max(0, (Date.parse(t.expire) - td) / (365.25 * 86400_000));
      return { ...t, price, changePct: b?.changePct ?? null, amount: b?.amount ?? null, stockPrice: sp, stockChg: s?.changePct ?? null, convValue, premium, doubleLow: price != null && premium != null ? price + premium : null, years, nearRedeem: sp != null && sp >= t.convPrice * 1.3, nearResale: sp != null && sp <= t.convPrice * 0.7 };
    }).filter((r) => r.price != null || !r.listing);
    return { at: Date.now(), rows };
  });
}

/* ------------------------------------------------------------------ 全球央行政策利率 + 通胀（月度） */
export const CB_AREAS: Array<[string, string, string, string]> = [
  ["US", "美国", "USD", "美联储"], ["XM", "欧元区", "EUR", "欧洲央行"], ["GB", "英国", "GBP", "英格兰银行"], ["JP", "日本", "JPY", "日本银行"],
  ["CH", "瑞士", "CHF", "瑞士央行"], ["CA", "加拿大", "CAD", "加拿大央行"], ["AU", "澳大利亚", "AUD", "澳洲联储"], ["NZ", "新西兰", "NZD", "新西兰联储"],
  ["SE", "瑞典", "SEK", "瑞典央行"], ["NO", "挪威", "NOK", "挪威央行"], ["CN", "中国", "CNY", "中国人民银行"], ["HK", "中国香港", "HKD", "香港金管局"],
  ["KR", "韩国", "KRW", "韩国央行"], ["IN", "印度", "INR", "印度储备银行"], ["ID", "印度尼西亚", "IDR", "印尼央行"], ["TH", "泰国", "THB", "泰国央行"],
  ["MY", "马来西亚", "MYR", "马来西亚央行"], ["PH", "菲律宾", "PHP", "菲律宾央行"], ["BR", "巴西", "BRL", "巴西央行"], ["MX", "墨西哥", "MXN", "墨西哥央行"],
  ["CL", "智利", "CLP", "智利央行"], ["CO", "哥伦比亚", "COP", "哥伦比亚央行"], ["ZA", "南非", "ZAR", "南非储备银行"], ["TR", "土耳其", "TRY", "土耳其央行"],
  ["PL", "波兰", "PLN", "波兰央行"], ["CZ", "捷克", "CZK", "捷克央行"], ["HU", "匈牙利", "HUF", "匈牙利央行"], ["SA", "沙特", "SAR", "沙特央行"],
];
function sdmxCsv(text: string) {
  const rows = csvRows(text);
  const head = rows[0] ?? [];
  const ia = head.indexOf("REF_AREA"), it = head.indexOf("TIME_PERIOD"), iv = head.indexOf("OBS_VALUE");
  const out: Record<string, Array<{ d: string; v: number }>> = {};
  for (const r of rows.slice(1)) {
    const v = Number(r[iv]);
    if (!r[ia] || !r[it] || r[iv] === "" || !Number.isFinite(v)) continue;
    (out[r[ia]] ??= []).push({ d: r[it], v });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.d.localeCompare(b.d));
  return out;
}
export async function cbRates() {
  return cached("cbrates", 12 * 3600_000, async () => {
    const keys = CB_AREAS.map((a) => a[0]).join("+");
    const from = `${new Date().getUTCFullYear() - 6}-01`;
    const [pol, cpi] = await Promise.all([
      getText(`https://stats.bis.org/api/v1/data/WS_CBPOL/M.${keys}/all?startPeriod=${from}&detail=dataonly&format=csv`, {}, "utf-8", 30000).then(sdmxCsv),
      getText(`https://stats.bis.org/api/v1/data/WS_LONG_CPI/M.${keys}.771/all?startPeriod=${from}&detail=dataonly&format=csv`, {}, "utf-8", 30000).then(sdmxCsv).catch(() => ({} as Record<string, Array<{ d: string; v: number }>>)),
    ]);
    const rows = CB_AREAS.map(([area, name, ccy, bank]) => {
      const h = pol[area] ?? [];
      const c = cpi[area] ?? [];
      const last = h[h.length - 1] ?? null;
      let lastMove: { d: string; from: number; to: number } | null = null;
      for (let i = h.length - 1; i > 0; i--) if (h[i].v !== h[i - 1].v) { lastMove = { d: h[i].d, from: h[i - 1].v, to: h[i].v }; break; }
      const at = (m: number) => h[h.length - 1 - m]?.v ?? null;
      const cl = c[c.length - 1] ?? null;
      return { area, name, ccy, bank, rate: last?.v ?? null, date: last?.d ?? null, chg3m: last && at(3) != null ? last.v - at(3)! : null, chg12m: last && at(12) != null ? last.v - at(12)! : null, lastMove, cpi: cl?.v ?? null, cpiDate: cl?.d ?? null, real: last && cl ? last.v - cl.v : null, hist: h.slice(-72), cpiHist: c.slice(-72) };
    });
    void saveSeries(rows.flatMap((r) => [...r.hist.map((x) => ({ series: `cbpol:${r.area}`, d: x.d, v: x.v })), ...r.cpiHist.map((x) => ({ series: `cpi:${r.area}`, d: x.d, v: x.v }))])).catch(() => undefined);
    return { rows: rows.filter((r) => r.rate != null) };
  });
}

/* ------------------------------------------------------------------ 有效汇率（名义 / 实际，宽口径，月度） */
const EER_AREAS = ["US", "XM", "JP", "GB", "CH", "AU", "NZ", "CA", "SE", "NO", "CN", "HK", "SG", "KR", "IN", "ID", "TH", "MY", "PH", "TW", "BR", "MX", "CL", "CO", "ZA", "TR", "PL", "CZ", "HU"];
export async function effectiveRates() {
  return cached("eer", 12 * 3600_000, async () => {
    const keys = EER_AREAS.join("+");
    const from = `${new Date().getUTCFullYear() - 11}-01`;
    const get = (t: "N" | "R") => getText(`https://stats.bis.org/api/v1/data/WS_EER/M.${t}.B.${keys}/all?startPeriod=${from}&detail=dataonly&format=csv`, {}, "utf-8", 40000).then(sdmxCsv);
    const [nom, real] = await Promise.all([get("N"), get("R").catch(() => ({} as Record<string, Array<{ d: string; v: number }>>))]);
    const rows = EER_AREAS.map((area) => ({ area, nominal: nom[area] ?? [], real: real[area] ?? [] })).filter((r) => r.nominal.length || r.real.length);
    void saveSeries(rows.flatMap((r) => [...r.nominal.map((x) => ({ series: `neer:${r.area}`, d: x.d, v: x.v })), ...r.real.map((x) => ({ series: `reer:${r.area}`, d: x.d, v: x.v }))])).catch(() => undefined);
    return { rows };
  });
}

/* ------------------------------------------------------------------ 国际货币基金组织：各国宏观年度数据与预测 */
export const IMF_ECON: Array<[string, string, string]> = [
  ["WEOWORLD", "全球", "全球"], ["ADVEC", "发达经济体", "全球"], ["OEMDC", "新兴与发展中经济体", "全球"],
  ["USA", "美国", "美洲"], ["CAN", "加拿大", "美洲"], ["MEX", "墨西哥", "美洲"], ["BRA", "巴西", "美洲"], ["ARG", "阿根廷", "美洲"], ["CHL", "智利", "美洲"], ["COL", "哥伦比亚", "美洲"],
  ["DEU", "德国", "欧洲"], ["FRA", "法国", "欧洲"], ["ITA", "意大利", "欧洲"], ["ESP", "西班牙", "欧洲"], ["NLD", "荷兰", "欧洲"], ["GBR", "英国", "欧洲"], ["CHE", "瑞士", "欧洲"], ["SWE", "瑞典", "欧洲"], ["NOR", "挪威", "欧洲"], ["POL", "波兰", "欧洲"], ["TUR", "土耳其", "欧洲"], ["RUS", "俄罗斯", "欧洲"],
  ["CHN", "中国", "亚太"], ["JPN", "日本", "亚太"], ["KOR", "韩国", "亚太"], ["IND", "印度", "亚太"], ["IDN", "印度尼西亚", "亚太"], ["THA", "泰国", "亚太"], ["MYS", "马来西亚", "亚太"], ["PHL", "菲律宾", "亚太"], ["VNM", "越南", "亚太"], ["SGP", "新加坡", "亚太"], ["HKG", "中国香港", "亚太"], ["TWN", "中国台湾", "亚太"], ["AUS", "澳大利亚", "亚太"], ["NZL", "新西兰", "亚太"],
  ["SAU", "沙特阿拉伯", "中东非"], ["ARE", "阿联酋", "中东非"], ["ISR", "以色列", "中东非"], ["EGY", "埃及", "中东非"], ["ZAF", "南非", "中东非"], ["NGA", "尼日利亚", "中东非"],
];
export const IMF_IND: Record<string, string> = {
  NGDP_RPCH: "实际GDP增速", PCPIPCH: "通胀（年均）", LUR: "失业率", BCA_NGDPD: "经常账户/GDP", GGXWDG_NGDP: "政府债务/GDP", GGXCNL_NGDP: "财政余额/GDP", NGDPD: "名义GDP（十亿美元）", NGDPDPC: "人均GDP（美元）", PPPSH: "占全球GDP比重（购买力平价）", NGAP_NPGDP: "产出缺口",
};
export async function imfData(codes: string[]) {
  const ok = codes.filter((c) => IMF_IND[c]).slice(0, 10);
  const res = await pool(ok, 4, (code) => cached(`imf:${code}`, 24 * 3600_000, async () => {
    const r = await fetch(`https://www.imf.org/external/datamapper/api/v1/${code}`, { headers: { accept: "application/json", "user-agent": "FinanceHub/1.0 public-data-reader" }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { values?: Record<string, Record<string, Record<string, number>>> };
    const all = j.values?.[code] ?? {};
    const out: Record<string, Array<{ y: number; v: number }>> = {};
    for (const [iso] of IMF_ECON) { const s = all[iso]; if (s) out[iso] = Object.entries(s).map(([y, v]) => ({ y: Number(y), v: Number(v) })).filter((x) => Number.isFinite(x.v)).sort((a, b) => a.y - b.y); }
    void saveSeries(Object.entries(out).flatMap(([iso, arr]) => arr.map((x) => ({ series: `imf:${code}:${iso}`, d: String(x.y), v: x.v })))).catch(() => undefined);
    return out;
  }).catch(() => ({} as Record<string, Array<{ y: number; v: number }>>)));
  return { economies: IMF_ECON.map(([iso, name, region]) => ({ iso, name, region })), indicators: Object.fromEntries(ok.map((c, i) => [c, { label: IMF_IND[c], data: res[i] }])) };
}

/* ------------------------------------------------------------------ 预测市场（宏观 / 央行 / 政策类合约的隐含概率） */
const PM_TAGS = ["fed-rates", "economy", "inflation", "recession", "fed", "tariffs", "china", "gdp"];
export async function predictionMarkets() {
  return cached("pm", 10 * 60_000, async () => {
    const lists = await pool(PM_TAGS, 4, (tag) => getText(`https://gamma-api.polymarket.com/events?closed=false&limit=40&order=volume24hr&ascending=false&tag_slug=${tag}`, {}, "utf-8", 20000).then((t) => ({ tag, events: JSON.parse(t) as any[] })).catch(() => ({ tag, events: [] as any[] })));
    const seen = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);
    const snaps: Array<{ series: string; d: string; v: number }> = [];
    const events = lists.flatMap(({ tag, events }) => events.map((e) => ({ tag, e }))).filter(({ e }) => e?.id && !seen.has(String(e.id)) && seen.add(String(e.id))).map(({ tag, e }) => {
      const markets = (e.markets ?? []).filter((m: any) => !m.closed).map((m: any) => {
        let prices: number[] = []; let outs: string[] = [];
        try { prices = JSON.parse(m.outcomePrices ?? "[]").map(Number); outs = JSON.parse(m.outcomes ?? "[]"); } catch { /* ignore */ }
        const yes = prices[0];
        if (Number.isFinite(yes)) snaps.push({ series: `pm:${m.id}`, d: today, v: yes });
        return { id: String(m.id), label: m.groupItemTitle || m.question, question: m.question, yes: Number.isFinite(yes) ? yes : null, outcomes: outs, bid: num(m.bestBid), ask: num(m.bestAsk), volume: num(m.volume), end: m.endDate ?? null };
      }).filter((m: any) => m.yes != null).sort((a: any, b: any) => (b.yes ?? 0) - (a.yes ?? 0));
      return { id: String(e.id), tag, title: String(e.title ?? ""), end: e.endDate ?? null, volume: num(e.volume), volume24h: num(e.volume24hr), liquidity: num(e.liquidity), markets };
    }).filter((e) => e.markets.length);
    void saveSeries(snaps).catch(() => undefined);
    return { at: Date.now(), events: events.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)).slice(0, 120) };
  });
}

/* ------------------------------------------------------------------ 联储议息声明清单（官方日历页解析） */
export async function fomcStatements() {
  return cached("fomcst", 6 * 3600_000, async () => {
    const html = await getText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", {}, "utf-8", 25000);
    const set = new Set<string>();
    for (const m of html.matchAll(/\/newsevents\/pressreleases\/monetary(\d{8})a\.htm/g)) set.add(m[1]);
    return [...set].sort().reverse().map((d) => ({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, url: `https://www.federalreserve.gov/newsevents/pressreleases/monetary${d}a.htm` }));
  });
}

/* ------------------------------------------------------------------ 分析师一致预期（美股） */
export async function analystView(symbolRaw: string) {
  const sym = symbolRaw.toUpperCase().replace(/[^A-Z.]/g, "");
  return cached(`anr:${sym}`, 6 * 3600_000, async () => {
    const get = (p: string) => getText(`https://api.nasdaq.com/api/analyst/${encodeURIComponent(sym)}/${p}`, { accept: "application/json, text/plain, */*" }, "utf-8", 20000).then((t) => (JSON.parse(t) as { data?: any }).data ?? null).catch(() => null);
    const [target, ratings, forecast] = await Promise.all([get("targetprice"), get("ratings"), get("earnings-forecast")]);
    const co = target?.consensusOverview ?? {};
    const n = (v: unknown) => { const x = typeof v === "string" ? Number(v.replace(/[$,%]/g, "")) : Number(v); return Number.isFinite(x) ? x : null; };
    const hist = (target?.historicalConsensus ?? []).map((h: any) => ({ d: String(h.z?.dateTime ?? h.x ?? ""), v: n(h.z?.consensus ?? h.y) })).filter((h: any) => h.v != null);
    const yearly = (forecast?.yearlyForecast?.rows ?? []).map((r: any) => ({ period: String(r.fiscalEnd ?? ""), eps: n(r.consensusEPSForecast), hi: n(r.highEPSForecast), lo: n(r.lowEPSForecast), count: n(r.noOfEstimates), up: n(r.up), down: n(r.down) }));
    const quarterly = (forecast?.quarterlyForecast?.rows ?? []).map((r: any) => ({ period: String(r.fiscalEnd ?? ""), eps: n(r.consensusEPSForecast), hi: n(r.highEPSForecast), lo: n(r.lowEPSForecast), count: n(r.noOfEstimates), up: n(r.up), down: n(r.down) }));
    const out = { symbol: sym, target: n(co.priceTarget), high: n(co.highPriceTarget), low: n(co.lowPriceTarget), buy: n(co.buy), hold: n(co.hold), sell: n(co.sell), meanRating: ratings?.meanRatingType ?? null, ratingsAsOf: ratings?.ratingsAsOf ?? null, brokers: (ratings?.brokerNames ?? []).slice(0, 30), hist, yearly, quarterly };
    if (out.target != null) void saveSeries([{ series: `anr:${sym}`, d: new Date().toISOString().slice(0, 10), v: out.target }]).catch(() => undefined);
    return out;
  });
}

/* ------------------------------------------------------------------ 最活跃证券（美股 / A 股 / 港股） */
export async function mostActive(market: "us" | "cn" | "hk") {
  return cached(`most:${market}`, 60_000, async () => {
    const region = market === "us" ? "america" : market === "cn" ? "china" : "hongkong";
    const conv = (tv: string) => {
      const [ex, code] = tv.split(":");
      if (market === "cn") return `${ex === "SSE" ? "sh" : ex === "BSE" ? "bj" : "sz"}${code}`;
      if (market === "hk") return `${code.padStart(4, "0")}.HK`;
      return code.replace(/\./g, "-");
    };
    const scan = async (sortBy: string, order: "asc" | "desc", extra: any[] = []) => {
      const body = { filter: [{ left: "type", operation: "equal", right: "stock" }, { left: "is_primary", operation: "equal", right: true }, ...extra], options: { lang: "zh" }, columns: ["name", "description", "close", "change", "volume", "Value.Traded", "market_cap_basic", "relative_volume_10d_calc"], sort: { sortBy, sortOrder: order }, range: [0, 30] };
      const res = await fetch(`https://scanner.tradingview.com/${region}/scan`, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`scan ${res.status}`);
      const j = (await res.json()) as { data?: Array<{ s: string; d: Array<number | string | null> }> };
      return (j.data ?? []).map((r) => ({ symbol: conv(r.s), name: String(r.d[1] ?? r.d[0] ?? ""), price: num(r.d[2]), changePct: num(r.d[3]), volume: num(r.d[4]), amount: num(r.d[5]), mcap: num(r.d[6]), relVol: num(r.d[7]) }));
    };
    const liquid = [{ left: "Value.Traded", operation: "greater", right: market === "us" ? 20_000_000 : market === "cn" ? 100_000_000 : 50_000_000 }];
    const [amt, vol, up, dn, rel] = await Promise.all([scan("Value.Traded", "desc"), scan("volume", "desc"), scan("change", "desc", liquid), scan("change", "asc", liquid), scan("relative_volume_10d_calc", "desc", liquid)]);
    return { at: Date.now(), lists: { 成交额最活跃: amt, 成交量最活跃: vol, 涨幅最大: up, 跌幅最大: dn, 相对放量: rel } };
  });
}

/* ------------------------------------------------------------------ 美国通胀保值国债实际收益率曲线（日度） */
export async function realYieldCurve() {
  return cached("realcurve", 3 * 3600_000, async () => {
    const y = new Date().getUTCFullYear();
    const one = async (yr: number) => {
      const t = await getText(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${yr}/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=${yr}&page&_format=csv`, {}, "utf-8", 30000).catch(() => "");
      const rows = csvRows(t);
      const head = (rows[0] ?? []).map((h) => h.replace(/"/g, "").trim());
      return rows.slice(1).map((r) => {
        const [m, d, yy] = String(r[0] ?? "").replace(/"/g, "").split("/");
        const date = yy ? `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
        const points = head.slice(1).map((h, i) => ({ tenor: h.replace(/\s*YR/i, "Y").replace(/\s+/g, ""), value: Number(r[i + 1]) })).filter((p) => p.value && Number.isFinite(p.value));
        return { date, points };
      }).filter((x) => x.date && x.points.length);
    };
    const all = (await Promise.all([one(y - 2), one(y - 1), one(y)])).flat().sort((a, b) => a.date.localeCompare(b.date));
    void saveSeries(all.flatMap((r) => r.points.map((p) => ({ series: `tips:${p.tenor}`, d: r.date, v: p.value })))).catch(() => undefined);
    return { rows: all };
  });
}

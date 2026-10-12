import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getJson, getKline, getText, getTicks, type UcCandle } from "../uc/market";
import { curves, fxReference, optionChain } from "../uc/hubs";
import { loadSeries, saveSeries, sovereignSpreads } from "../uc/hubs2";
import { symbolSearch } from "../uc/hubs3";
import { macroSnapshot, queryNewsDeep } from "../uc/news";

// ============================================================
// Platform Tools Router（全部为真实数据 / 由真实数据计算）
// BMAP  - 全球国家热力图：股指年初至今涨跌（实时日线）、世界银行最新年度宏观指标、央行政策利率、
//         由真实指标排序合成的风险分（见 riskScore 注释）
// BSRCH - 全球证券检索（证券代码库 + 实时报价）、平台新闻库检索、宏观利率快照检索
// BVOL  - 期权链真实隐含波动率曲面 / 期限结构、真实日线已实现波动率、VIX 体系指数日线、波动率锥
// ============================================================

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
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86400_000;
const closesOf = (k: UcCandle[]) => k.map((c) => c.c).filter((v) => v > 0);
function realizedVol(closes: number[], n: number) {
  if (closes.length < n + 1) return null;
  const s = closes.slice(-(n + 1));
  const r: number[] = [];
  for (let i = 1; i < s.length; i++) r.push(Math.log(s[i] / s[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v * 252) * 100;
}
function quantile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const i = p * (sorted.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// ---- BMAP：国家 / 股指 / 世界银行国家代码 ----
const COUNTRIES: Array<{ code: string; iso3: string; name: string; region: string; index: string; euro?: boolean }> = [
  { code: "US", iso3: "USA", name: "United States", region: "Americas", index: "^GSPC" },
  { code: "CN", iso3: "CHN", name: "China", region: "Asia", index: "sh000300" },
  { code: "JP", iso3: "JPN", name: "Japan", region: "Asia", index: "^N225" },
  { code: "DE", iso3: "DEU", name: "Germany", region: "Europe", index: "^GDAXI", euro: true },
  { code: "GB", iso3: "GBR", name: "United Kingdom", region: "Europe", index: "^FTSE" },
  { code: "FR", iso3: "FRA", name: "France", region: "Europe", index: "^FCHI", euro: true },
  { code: "IN", iso3: "IND", name: "India", region: "Asia", index: "^BSESN" },
  { code: "BR", iso3: "BRA", name: "Brazil", region: "Americas", index: "^BVSP" },
  { code: "AU", iso3: "AUS", name: "Australia", region: "Asia-Pacific", index: "^AXJO" },
  { code: "CA", iso3: "CAN", name: "Canada", region: "Americas", index: "^GSPTSE" },
  { code: "KR", iso3: "KOR", name: "South Korea", region: "Asia", index: "^KS11" },
  { code: "MX", iso3: "MEX", name: "Mexico", region: "Americas", index: "^MXX" },
  { code: "ZA", iso3: "ZAF", name: "South Africa", region: "Africa", index: "^J203.JO" },
  { code: "RU", iso3: "RUS", name: "Russia", region: "Europe", index: "IMOEX.ME" },
  { code: "IT", iso3: "ITA", name: "Italy", region: "Europe", index: "FTSEMIB.MI", euro: true },
  { code: "ES", iso3: "ESP", name: "Spain", region: "Europe", index: "^IBEX", euro: true },
  { code: "NL", iso3: "NLD", name: "Netherlands", region: "Europe", index: "^AEX", euro: true },
  { code: "CH", iso3: "CHE", name: "Switzerland", region: "Europe", index: "^SSMI" },
  { code: "SG", iso3: "SGP", name: "Singapore", region: "Asia", index: "^STI" },
  { code: "HK", iso3: "HKG", name: "Hong Kong", region: "Asia", index: "^HSI" },
];
const WB = {
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",      // 实际 GDP 增速（%）
  inflation: "FP.CPI.TOTL.ZG",         // CPI 通胀（%）
  debtGdp: "GC.DOD.TOTL.GD.ZS",        // 中央政府债务 / GDP（%）
  fdi: "BX.KLT.DINV.CD.WD",            // 外商直接投资净流入（美元）
  portfolio: "BX.PEF.TOTL.CD.WD",      // 证券投资（股权）净流入（美元）
} as const;
type WbKey = keyof typeof WB;

/** 世界银行：各国某指标最近一个有值的年度观测 */
async function wbLatest(indicator: string): Promise<Record<string, { v: number; year: string }>> {
  return cached(`wb:${indicator}`, 12 * 3600_000, async () => {
    const iso = COUNTRIES.map((c) => c.iso3).join(";");
    const j = await getJson<any>(`https://api.worldbank.org/v2/country/${iso}/indicator/${indicator}?format=json&mrv=6&per_page=500`);
    const rows: any[] = Array.isArray(j) ? j[1] ?? [] : [];
    const out: Record<string, { v: number; year: string }> = {};
    for (const r of rows) {
      const code = String(r?.countryiso3code ?? "");
      const v = Number(r?.value);
      if (!code || r?.value == null || !Number.isFinite(v)) continue;
      if (!out[code] || String(r.date) > out[code].year) out[code] = { v, year: String(r.date) };
    }
    return out;
  });
}
function csvLine(line: string) {
  const cells: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}
/** 央行政策利率：国际清算银行政策利率库；取不到时用美联储 / 欧洲央行官方数据 */
async function policyRates(): Promise<Record<string, number>> {
  return cached("policy", 6 * 3600_000, async () => {
    const out: Record<string, number> = {};
    const bisCodes: Record<string, string> = { US: "US", CN: "CN", JP: "JP", GB: "GB", IN: "IN", BR: "BR", AU: "AU", CA: "CA", KR: "KR", MX: "MX", ZA: "ZA", RU: "RU", CH: "CH", HK: "HK", DE: "XM", FR: "XM", IT: "XM", ES: "XM", NL: "XM" };
    try {
      const keys = [...new Set(Object.values(bisCodes))].join("+");
      const t = await getText(`https://stats.bis.org/api/v1/data/WS_CBPOL/M.${keys}?lastNObservations=1&format=csv`, {}, "utf-8", 20000);
      const lines = t.trim().split(/\r?\n/).map(csvLine);
      const head = lines[0] ?? [];
      const iA = head.indexOf("REF_AREA"), iV = head.indexOf("OBS_VALUE");
      const byArea: Record<string, number> = {};
      for (const c of lines.slice(1)) {
        const v = Number(c[iV]);
        const area = (c[iA] ?? "").split(":")[0].trim();
        if (area && Number.isFinite(v)) byArea[area] = v;
      }
      for (const [cc, area] of Object.entries(bisCodes)) if (byArea[area] != null) out[cc] = byArea[area];
    } catch {
      /* 退回官方数据 */
    }
    if (out.US == null || out.DE == null) {
      const fx = await fxReference().catch(() => null);
      for (const p of fx?.policy ?? []) {
        if (p.rate == null) continue;
        if (p.bank.includes("美联储") && out.US == null) out.US = p.rate;
        if (p.bank.includes("欧洲央行")) for (const c of COUNTRIES) if (c.euro && out[c.code] == null) out[c.code] = p.rate;
      }
    }
    return out;
  });
}
type CountryRow = {
  code: string; name: string; region: string;
  equityReturn: number; gdpGrowth: number | null; inflation: number | null; rate: number | null;
  creditRating: string; riskScore: number | null; capitalFlow: number | null; debtGdp: number | null;
  vol1y: number | null; maxDrawdown1y: number | null; dataYear: string | null;
};
async function countryData(): Promise<CountryRow[]> {
  return cached("bmap", 30 * 60_000, async () => {
    const [klines, wb, rates] = await Promise.all([
      Promise.all(COUNTRIES.map((c) => getKline(c.index, "1d", 300).catch(() => [] as UcCandle[]))),
      Promise.all((Object.keys(WB) as WbKey[]).map(async (k) => [k, await wbLatest(WB[k]).catch(() => ({}))] as const)).then((x) => Object.fromEntries(x) as Record<WbKey, Record<string, { v: number; year: string }>>),
      policyRates().catch(() => ({} as Record<string, number>)),
    ]);
    const yearStart = Date.UTC(new Date().getUTCFullYear(), 0, 1);
    const rows: CountryRow[] = COUNTRIES.map((c, i) => {
      const k = klines[i];
      const last = k[k.length - 1]?.c;
      const base = [...k].reverse().find((x) => x.t < yearStart)?.c;
      const yr = k.filter((x) => x.t >= Date.now() - 365 * DAY).map((x) => x.c);
      let peak = 0, mdd = 0;
      for (const v of yr) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
      const fdi = wb.fdi?.[c.iso3]?.v;
      const pf = wb.portfolio?.[c.iso3]?.v;
      const flow = fdi != null || pf != null ? ((fdi ?? 0) + (pf ?? 0)) / 1e9 : null;
      return {
        code: c.code, name: c.name, region: c.region,
        equityReturn: last && base ? Math.round(((last / base) - 1) * 1000) / 10 : NaN,
        gdpGrowth: wb.gdpGrowth?.[c.iso3]?.v ?? null,
        inflation: wb.inflation?.[c.iso3]?.v ?? null,
        rate: rates[c.code] ?? null,
        creditRating: "—", // 无公开免费的主权评级数据源，不展示
        riskScore: null,
        capitalFlow: flow != null ? Math.round(flow * 10) / 10 : null,
        debtGdp: wb.debtGdp?.[c.iso3]?.v ?? null,
        vol1y: realizedVol(yr, Math.min(250, yr.length - 1)),
        maxDrawdown1y: yr.length ? Math.round(mdd * 1000) / 10 : null,
        dataYear: wb.gdpGrowth?.[c.iso3]?.year ?? null,
      };
    });
    // 风险分（0=低，100=高）：股指一年实际波动率、一年最大回撤、通胀、政府债务/GDP 四项真实指标在样本内的百分位均值
    const feats: Array<(r: CountryRow) => number | null> = [(r) => r.vol1y, (r) => (r.maxDrawdown1y != null ? -r.maxDrawdown1y : null), (r) => r.inflation, (r) => r.debtGdp];
    for (const r of rows) {
      const ps: number[] = [];
      for (const f of feats) {
        const v = f(r);
        const all = rows.map(f).filter((x): x is number => x != null && Number.isFinite(x));
        if (v == null || !Number.isFinite(v) || all.length < 3) continue;
        ps.push(all.filter((x) => x < v).length / (all.length - 1));
      }
      r.riskScore = ps.length >= 2 ? Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * 100) : null;
    }
    return rows;
  });
}

// ---- BVOL：标的映射 ----
const UNDER: Record<string, { opt: string; px: string; iv: string | null }> = {
  SPX: { opt: "^GSPC", px: "^GSPC", iv: "^VIX" },
  NDX: { opt: "^NDX", px: "^NDX", iv: "^VXN" },
  RUT: { opt: "^RUT", px: "^RUT", iv: "^RVX" },
  VIX: { opt: "^VIX", px: "^VIX", iv: "^VVIX" },
};
const under = (u: string) => UNDER[u.toUpperCase()] ?? { opt: u.toUpperCase(), px: u.toUpperCase(), iv: null };
const TENORS: Array<[string, number]> = [["1W", 7], ["2W", 14], ["1M", 30], ["2M", 61], ["3M", 91], ["6M", 182], ["9M", 274], ["1Y", 365], ["18M", 548], ["2Y", 730]];
const daysTo = (exp: string) => (Date.parse(`${exp}T21:00:00Z`) - Date.now()) / DAY;

type Chain = NonNullable<Awaited<ReturnType<typeof optionChain>>>;
/** 期权链的隐含波动率统一为百分数 */
const ivPct = (v: number) => (v > 0 && v < 5 ? v * 100 : v);
/** 某到期日按虚值一侧取隐含波动率（低于现价用看跌、高于现价用看涨），按行权价线性插值；超出报价范围取最近行权价 */
function smileAt(chain: Chain, strike: number) {
  const pts = chain.chain.map((r) => {
    const otm = r.strike < chain.spot ? r.put : r.call;
    const alt = r.strike < chain.spot ? r.call : r.put;
    const iv = otm && otm.iv > 0 ? otm.iv : alt && alt.iv > 0 ? alt.iv : 0;
    return { k: r.strike, iv: ivPct(iv) };
  }).filter((p) => p.iv > 0 && p.iv < 400).sort((a, b) => a.k - b.k);
  if (!pts.length) return null;
  if (strike <= pts[0].k) return pts[0].iv;
  for (let i = 1; i < pts.length; i++) if (strike <= pts[i].k) {
    const a = pts[i - 1], b = pts[i];
    return a.iv + ((b.iv - a.iv) * (strike - a.k)) / (b.k - a.k);
  }
  return pts[pts.length - 1].iv;
}
/** 选出与目标天数最接近的真实到期日（只用目标期限覆盖范围内的到期日） */
function nearestExpiry(expiries: string[], target: number) {
  const live = expiries.filter((e) => daysTo(e) > 0.5);
  if (!live.length) return null;
  const maxD = daysTo(live[live.length - 1]);
  if (target > maxD * 1.15) return null;
  return live.reduce((b, e) => (Math.abs(daysTo(e) - target) < Math.abs(daysTo(b) - target) ? e : b), live[0]);
}
async function surfaceOf(u: string) {
  return cached(`surf:${u}`, 60_000, async () => {
    const sym = under(u).opt;
    const base = await optionChain(sym).catch(() => null);
    if (!base) return null;
    const rows: Array<{ label: string; exp: string; days: number; chain: Chain }> = [];
    for (const [label, d] of TENORS) {
      const exp = nearestExpiry(base.expiries, d);
      if (!exp || rows.some((r) => r.exp === exp)) continue;
      const ch = exp === base.expiry ? base : await optionChain(sym, exp).catch(() => null);
      if (ch) rows.push({ label, exp, days: daysTo(exp), chain: ch });
    }
    return { spot: base.spot, base, rows };
  });
}
/** 指定剩余天数的平值隐含波动率：在相邻两个真实到期日之间按总方差线性插值 */
function atmTerm(term: Array<{ exp: string; iv: number | null }>, target: number) {
  const pts = term.filter((t) => t.iv != null && t.iv > 0).map((t) => ({ d: daysTo(t.exp), v: ivPct(t.iv!) })).filter((p) => p.d > 0.5).sort((a, b) => a.d - b.d);
  if (!pts.length || target > pts[pts.length - 1].d * 1.15) return null;
  if (target <= pts[0].d) return pts[0].v;
  for (let i = 1; i < pts.length; i++) if (target <= pts[i].d) {
    const a = pts[i - 1], b = pts[i];
    const w = (target - a.d) / (b.d - a.d);
    const tv = a.v * a.v * a.d + w * (b.v * b.v * b.d - a.v * a.v * a.d);
    return Math.sqrt(Math.max(0, tv / target));
  }
  return pts[pts.length - 1].v;
}

// ---- BSRCH：类型映射 ----
const TYPE_OF: Record<string, string> = { 股票: "equity", "基金/ETF": "equity", 共同基金: "equity", 指数: "index", 期货: "commodity", 外汇: "fx", 加密资产: "fx", 期权: "equity" };
const BOND_FUT = /^(ZT|ZF|ZN|ZB|UB|TN|FGBL|FGBM|FGBS)/;
type SearchItem = { id: string; type: string; code: string; name: string; description: string; exchange: string; price: number; change: number; mktCap: string; sector: string; date?: string };

async function searchAll(q: string): Promise<SearchItem[]> {
  return cached(`bsrch:${q.toLowerCase()}`, 60_000, async () => {
    const [secs, news, macro, cv] = await Promise.all([
      symbolSearch(q).catch(() => []),
      queryNewsDeep({ q, limit: 15 }).catch(() => []),
      macroSnapshot().catch(() => null),
      curves().catch(() => null),
    ]);
    const ticks = await getTicks(secs.slice(0, 25).map((s) => s.symbol), { budgetMs: 3000 }).catch(() => ({} as Record<string, any>));
    const out: SearchItem[] = secs.map((s, i) => {
      const t = (ticks as Record<string, any>)[s.symbol];
      const type = s.type === "期货" && BOND_FUT.test(s.symbol) ? "bond" : TYPE_OF[s.type] ?? "equity";
      return {
        id: `s${i}:${s.symbol}`, type, code: s.symbol, name: s.name,
        description: [s.industry, s.type].filter(Boolean).join(" · "), exchange: s.exchange,
        price: Number(t?.price ?? 0) || 0, change: Number(t?.change ?? 0) || 0, mktCap: "-", sector: String(s.sector ?? s.type ?? ""),
      };
    });
    // 美债各期限收益率（财政部当日曲线）
    const lq = q.toLowerCase();
    const us = cv?.us ?? [];
    if (us[0] && /(t |treasury|美债|国债|收益率|yield|ust|\d+y)/i.test(q)) {
      for (const p of us[0].points) {
        const code = `UST ${p.tenor}`;
        if (/\d+y/i.test(q) && !lq.includes(p.tenor.toLowerCase())) continue;
        const prev = us[1]?.points.find((x) => x.tenor === p.tenor)?.value;
        out.push({ id: `b:${p.tenor}`, type: "bond", code, name: `美国国债 ${p.tenor} 收益率`, description: `财政部面值收益率曲线 ${us[0].date}`, exchange: "UST", price: p.value, change: prev != null ? Math.round((p.value - prev) * 1000) / 1000 : 0, mktCap: "-", sector: "Government" });
      }
    }
    // 宏观利率快照
    for (const r of macro?.rates ?? []) {
      if (!`${r.key} ${r.label}`.toLowerCase().includes(lq)) continue;
      out.push({ id: `e:${r.key}`, type: "economic", code: r.key, name: r.label, description: `${r.label}：${r.value ?? "—"}${r.unit}（${r.date ?? "—"}）`, exchange: "", price: Number(r.value ?? 0), change: 0, mktCap: "-", sector: "Macro" });
    }
    // 平台新闻库
    for (const n of news) {
      out.push({ id: `n:${n.id}`, type: "news", code: "NEWS", name: n.title, description: n.summary ?? "", exchange: "", price: 0, change: 0, mktCap: "-", sector: n.cats?.[0] ?? "", date: ymd(n.time) });
    }
    return out;
  });
}

export const platformToolsRouter = router({
  // BMAP - 全球国家热力图
  getGlobalHeatMap: publicProcedure
    .input(z.object({ metric: z.enum(["equityReturn", "gdpGrowth", "inflation", "rate", "riskScore", "capitalFlow", "debtGdp"]).default("equityReturn") }))
    .query(async ({ input }) => {
      const rows = await countryData();
      const data = rows
        // 只返回该指标与股指收益都有真实值的国家（缺数据的不补造）
        .filter((c) => Number.isFinite(c.equityReturn) && c[input.metric] != null && Number.isFinite(c[input.metric] as number))
        .map((c) => {
          const v = c[input.metric] as number;
          return {
            ...c,
            value: v,
            displayValue: input.metric === "capitalFlow" ? `$${v.toFixed(1)}B` : input.metric === "riskScore" ? v.toFixed(0) : `${v.toFixed(1)}%`,
          };
        });
      return { data, metric: input.metric, timestamp: Date.now() };
    }),

  // BMAP - 资本流动：世界银行最新年度外商直接投资净流入、证券投资（股权）净流入（十亿美元）
  getCapitalFlows: publicProcedure.query(async () => {
    const [fdi, pf] = await Promise.all([wbLatest(WB.fdi).catch(() => ({} as Record<string, { v: number; year: string }>)), wbLatest(WB.portfolio).catch(() => ({} as Record<string, { v: number; year: string }>))]);
    const flows: Array<{ from: string; to: string; amount: number; type: string; sector: string; year: string }> = [];
    for (const c of COUNTRIES) {
      const f = fdi[c.iso3];
      if (f) flows.push({ from: "WORLD", to: c.code, amount: Math.round((f.v / 1e9) * 10) / 10, type: "FDI", sector: "直接投资净流入", year: f.year });
      const p = pf[c.iso3];
      if (p) flows.push({ from: "WORLD", to: c.code, amount: Math.round((p.v / 1e9) * 10) / 10, type: "Portfolio", sector: "股权证券投资净流入", year: p.year });
    }
    return { flows, timestamp: Date.now() };
  }),

  // BSRCH - 全文检索
  search: publicProcedure
    .input(z.object({
      query: z.string(),
      types: z.array(z.string()).optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      if (!input.query || input.query.trim().length < 1) return { results: [], total: 0 };
      let results = await searchAll(input.query.trim().slice(0, 60));
      if (input.types && input.types.length > 0) {
        results = results.filter(r => input.types!.includes(r.type));
      }
      return {
        results: results.slice(0, input.limit),
        total: results.length,
        byType: {
          equity: results.filter(r => r.type === "equity").length,
          bond: results.filter(r => r.type === "bond").length,
          fx: results.filter(r => r.type === "fx").length,
          commodity: results.filter(r => r.type === "commodity").length,
          index: results.filter(r => r.type === "index").length,
          news: results.filter(r => r.type === "news").length,
          economic: results.filter(r => r.type === "economic").length,
        },
        timestamp: Date.now(),
      };
    }),

  // BSRCH - 联想（证券代码库）
  getSuggestions: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      if (!input.query || input.query.trim().length < 1) return { suggestions: [] };
      const secs = await symbolSearch(input.query.trim().slice(0, 60)).catch(() => []);
      const suggestions = secs.slice(0, 8).map((s) => ({ code: s.symbol, name: s.name, type: s.type === "期货" && BOND_FUT.test(s.symbol) ? "bond" : TYPE_OF[s.type] ?? "equity" }));
      return { suggestions };
    }),

  // BVOL - 隐含波动率曲面：真实期权链，行权价为现价的 80%~120%，期限取最接近的真实到期日
  getVolSurface: publicProcedure
    .input(z.object({ underlying: z.string().default("SPX") }))
    .query(async ({ input }) => {
      const s = await surfaceOf(input.underlying).catch(() => null);
      const strikes = [80, 85, 90, 95, 100, 105, 110, 115, 120];
      if (!s) return { underlying: input.underlying, surface: [], atmVol: 0, skew: 0, kurtosis: 0, timestamp: Date.now() };
      const surface = s.rows.map((r) => ({
        expiry: r.label,
        expiryDate: r.exp,
        strikes: strikes.map((k) => {
          const v = smileAt(r.chain, (s.spot * k) / 100);
          return { strike: k, vol: v != null ? v.toFixed(2) : "" };
        }).filter((c) => c.vol !== ""),
      })).filter((r) => r.strikes.length === strikes.length);
      // 以约 1 个月期限为基准：平值、90%-110% 偏斜（点）、90/110 蝶式（翼部相对平值的凸度，点）
      const ref = s.rows.find((r) => r.label === "1M") ?? s.rows[0];
      const atm = ref ? smileAt(ref.chain, s.spot) : null;
      const lo = ref ? smileAt(ref.chain, s.spot * 0.9) : null;
      const hi = ref ? smileAt(ref.chain, s.spot * 1.1) : null;
      return {
        underlying: input.underlying, surface,
        atmVol: atm != null ? Math.round(atm * 100) / 100 : 0,
        skew: lo != null && hi != null ? Math.round((hi - lo) * 100) / 100 : 0,
        kurtosis: lo != null && hi != null && atm != null ? Math.round(((lo + hi) / 2 - atm) * 100) / 100 : 0,
        timestamp: Date.now(),
      };
    }),

  // BVOL - 平值隐含波动率期限结构（真实到期日之间按总方差插值）；日变动 = 与平台库中上一交易日记录之差
  getTermStructure: publicProcedure
    .input(z.object({ underlyings: z.array(z.string()).default(["SPX", "NDX", "RUT"]) }))
    .query(async ({ input }) => {
      const expiries = TENORS.map(([l]) => l);
      const today = ymd(Date.now());
      const list = input.underlyings.slice(0, 6);
      const curvesOut = await Promise.all(list.map(async (u) => {
        const ch = await optionChain(under(u).opt).catch(() => null);
        const vols = await Promise.all(TENORS.map(async ([label, d]) => {
          const v = ch ? atmTerm(ch.term, d) : null;
          let change: number | null = null;
          if (v != null) {
            const key = `bvol:atm:${u.toUpperCase()}:${label}`;
            const hist = await loadSeries(key, 5).catch(() => []);
            const prev = [...hist].reverse().find((h) => h.d < today);
            if (prev) change = Math.round((v - prev.v) * 100) / 100;
            void saveSeries([{ series: key, d: today, v }]);
          }
          return { expiry: label, vol: v != null ? Math.round(v * 100) / 100 : null, change };
        }));
        return { underlying: u, vols };
      }));
      return { expiries, curves: curvesOut, timestamp: Date.now() };
    }),

  // BVOL - 已实现波动率（真实日线）与 30 日隐含波动率（对应波动率指数日线）
  getHistoricalVol: publicProcedure
    .input(z.object({ underlying: z.string().default("SPX"), days: z.number().default(252) }))
    .query(async ({ input }) => {
      const days = Math.max(20, Math.min(input.days, 252));
      const u = under(input.underlying);
      return cached(`hv:${input.underlying}:${days}`, 5 * 60_000, async () => {
        const [px, ivk] = await Promise.all([getKline(u.px, "1d", days + 70).catch(() => []), u.iv ? getKline(u.iv, "1d", days + 10).catch(() => []) : Promise.resolve([] as UcCandle[])]);
        const ivBy = new Map(ivk.map((k) => [ymd(k.t), k.c]));
        const ivSeries = !u.iv ? new Map((await loadSeries(`iv30:${u.opt}`, days + 10).catch(() => [])).map((r) => [r.d, r.v])) : ivBy;
        const closes = px.map((k) => k.c);
        const data: Array<{ date: string; rv20: number; rv60: number | null; iv30: number | null; volPremium: number | null }> = [];
        for (let i = Math.max(21, px.length - days); i < px.length; i++) {
          const rv20 = realizedVol(closes.slice(0, i + 1), 20);
          if (rv20 == null) continue;
          const rv60 = realizedVol(closes.slice(0, i + 1), 60);
          const date = ymd(px[i].t);
          const iv = ivSeries.get(date) ?? null;
          data.push({ date, rv20: Math.round(rv20 * 100) / 100, rv60: rv60 != null ? Math.round(rv60 * 100) / 100 : null, iv30: iv != null ? Math.round(iv * 100) / 100 : null, volPremium: iv != null ? Math.round((iv - rv20) * 100) / 100 : null });
        }
        const last = data[data.length - 1];
        const lastIv = [...data].reverse().find((d) => d.iv30 != null)?.iv30 ?? null;
        return {
          underlying: input.underlying, data,
          currentRv: last?.rv20 ?? 0, currentIv: lastIv ?? 0,
          volPremium: lastIv != null && last ? Math.round((lastIv - last.rv20) * 100) / 100 : 0,
          timestamp: Date.now(),
        };
      });
    }),

  // BVOL - VIX 体系：VIX / VVIX / SKEW / MOVE / VIX3M / VIX6M 真实日线；VIX 分位数取近十年日收盘
  getVixEcosystem: publicProcedure.query(async () => {
    return cached("vixeco", 60_000, async () => {
      const syms = ["^VIX", "^VVIX", "^SKEW", "^MOVE", "^VIX3M", "^VIX6M"];
      const [ticks, ...ks] = await Promise.all([
        getTicks(syms, { budgetMs: 4000 }).catch(() => ({} as Record<string, any>)),
        getKline("^VIX", "1d", 2520).catch(() => []),
        getKline("^VVIX", "1d", 260).catch(() => []),
        getKline("^SKEW", "1d", 260).catch(() => []),
        getKline("^MOVE", "1d", 260).catch(() => []),
      ]);
      const [vixLong, vvix, skew, move] = ks as UcCandle[][];
      const by = (k: UcCandle[]) => new Map(k.map((x) => [ymd(x.t), x.c]));
      const mV = by(vvix), mS = by(skew), mM = by(move);
      const history = vixLong.slice(-252).map((x) => {
        const d = ymd(x.t);
        return { date: d, vix: Math.round(x.c * 100) / 100, vvix: mV.get(d) ?? null, skew: mS.get(d) ?? null, move: mM.get(d) ?? null };
      });
      const lastOf = (sym: string, k?: UcCandle[]) => {
        const t = (ticks as Record<string, any>)[sym]?.price;
        return Number(t ?? k?.[k.length - 1]?.c ?? 0) || 0;
      };
      const sorted = closesOf(vixLong).sort((a, b) => a - b);
      const q = (p: number) => { const v = quantile(sorted, p); return v != null ? Math.round(v * 100) / 100 : 0; };
      return {
        current: { vix: lastOf("^VIX", vixLong), vvix: lastOf("^VVIX", vvix), skew: lastOf("^SKEW", skew), move: lastOf("^MOVE", move), vix3m: lastOf("^VIX3M"), vix6m: lastOf("^VIX6M") },
        history,
        percentiles: { vix10: q(0.1), vix25: q(0.25), vix50: q(0.5), vix75: q(0.75), vix90: q(0.9) },
        timestamp: Date.now(),
      };
    });
  }),

  // BVOL - 波动率锥：近三年真实日线，各窗口已实现波动率的历史分位与当前值
  getVolCone: publicProcedure
    .input(z.object({ underlying: z.string().default("SPX") }))
    .query(async ({ input }) => {
      const windows = [10, 20, 30, 60, 90, 120, 180, 252];
      const closes = closesOf(await getKline(under(input.underlying).px, "1d", 780).catch(() => []));
      const f1 = (v: number | null) => (v != null ? v.toFixed(1) : "0");
      return {
        windows,
        cone: windows.map((w) => {
          const vals: number[] = [];
          for (let e = w + 1; e <= closes.length; e++) { const v = realizedVol(closes.slice(e - w - 1, e), w); if (v != null) vals.push(v); }
          vals.sort((a, b) => a - b);
          return { window: w, p10: f1(quantile(vals, 0.1)), p25: f1(quantile(vals, 0.25)), p50: f1(quantile(vals, 0.5)), p75: f1(quantile(vals, 0.75)), p90: f1(quantile(vals, 0.9)), current: f1(realizedVol(closes, w)) };
        }).filter((r) => r.current !== "0"),
        timestamp: Date.now(),
      };
    }),
});

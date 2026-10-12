/**
 * 各专业页面的实时数据：期权链（含希腊值 / 隐含波动率 / 最大痛点 / 伽马敞口）、外汇参考汇率与政策利率、
 * 美国商品期货交易委员会持仓报告（各类机构多空）、美债与欧元区收益率曲线。
 * 全部来自公开接口的实时 / 最新数据，不返回来源字段。
 */
import { getJson, getText } from "./market";

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

/* ------------------------------------------------------------------ 期权链 */
export type OptionRow = { strike: number; type: "C" | "P"; bid: number; ask: number; last: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; volume: number };
const OPT_ALIAS: Record<string, string> = { "^GSPC": "_SPX", SPX: "_SPX", "^NDX": "_NDX", NDX: "_NDX", "^RUT": "_RUT", "^VIX": "_VIX", VIX: "_VIX", "^XSP": "_XSP" };

export async function optionChain(symbolRaw: string, expiry?: string) {
  const symbol = symbolRaw.toUpperCase().replace(/\.(O|N|A|OQ|US)$/, "");
  const code = OPT_ALIAS[symbol] ?? symbol.replace(".", "_");
  const raw = await cached(`opt|${code}`, 60_000, async () => {
    const text = await getText(`https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(code)}.json`, {}, "utf-8", 30_000);
    const j = JSON.parse(text) as { timestamp?: string; data?: { current_price?: number; price_change?: number; price_change_percent?: number; iv30?: number; iv30_change?: number; options?: any[] } };
    const spot = Number(j.data?.current_price ?? 0);
    const rows: Array<OptionRow & { exp: string }> = [];
    for (const o of j.data?.options ?? []) {
      const m = /^(.*?)(\d{6})([CP])(\d{8})$/.exec(String(o.option));
      if (!m) continue;
      const exp = `20${m[2].slice(0, 2)}-${m[2].slice(2, 4)}-${m[2].slice(4, 6)}`;
      rows.push({ exp, strike: Number(m[4]) / 1000, type: m[3] as "C" | "P", bid: +o.bid || 0, ask: +o.ask || 0, last: +o.last_trade_price || 0, iv: +o.iv || 0, delta: +o.delta || 0, gamma: +o.gamma || 0, theta: +o.theta || 0, vega: +o.vega || 0, oi: +o.open_interest || 0, volume: +o.volume || 0 });
    }
    return { timestamp: j.timestamp ?? null, spot, change: Number(j.data?.price_change ?? 0), changePct: Number(j.data?.price_change_percent ?? 0), iv30: Number(j.data?.iv30 ?? 0), iv30Change: Number(j.data?.iv30_change ?? 0), rows };
  });
  if (!raw.rows.length) return null;
  const expiries = [...new Set(raw.rows.map((r) => r.exp))].sort();
  const exp = expiry && expiries.includes(expiry) ? expiry : expiries.find((e) => e >= new Date().toISOString().slice(0, 10)) ?? expiries[0];
  const sel = raw.rows.filter((r) => r.exp === exp);
  const strikes = [...new Set(sel.map((r) => r.strike))].sort((a, b) => a - b);
  const byStrike = strikes.map((k) => ({ strike: k, call: sel.find((r) => r.strike === k && r.type === "C") ?? null, put: sel.find((r) => r.strike === k && r.type === "P") ?? null }));
  // 最大痛点：到期时期权买方总价值最小的行权价
  let maxPain = strikes[0] ?? 0;
  let minPay = Infinity;
  for (const k of strikes) {
    let pay = 0;
    for (const r of sel) pay += r.oi * (r.type === "C" ? Math.max(0, k - r.strike) : Math.max(0, r.strike - k));
    if (pay < minPay) { minPay = pay; maxPain = k; }
  }
  const sum = (arr: typeof sel, f: (r: OptionRow) => number) => arr.reduce((n, r) => n + f(r), 0);
  const calls = sel.filter((r) => r.type === "C");
  const puts = sel.filter((r) => r.type === "P");
  const allCalls = raw.rows.filter((r) => r.type === "C");
  const allPuts = raw.rows.filter((r) => r.type === "P");
  const spot = raw.spot;
  // 伽马敞口（做市商视角：看涨为正、看跌为负），单位：每 1% 标的变动对应的名义金额
  const gex = byStrike.map((r) => ({ strike: r.strike, gex: ((r.call?.gamma ?? 0) * (r.call?.oi ?? 0) - (r.put?.gamma ?? 0) * (r.put?.oi ?? 0)) * 100 * spot * spot * 0.01 }));
  const atmIv = (rows: typeof raw.rows) => {
    const near = [...rows].filter((r) => r.iv > 0).sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot)).slice(0, 4);
    return near.length ? near.reduce((n, r) => n + r.iv, 0) / near.length : null;
  };
  const term = expiries.slice(0, 16).map((e) => ({ exp: e, iv: atmIv(raw.rows.filter((r) => r.exp === e)), oi: sum(raw.rows.filter((r) => r.exp === e), (r) => r.oi) }));
  const near25 = (rows: OptionRow[], target: number) => rows.filter((r) => r.iv > 0).sort((a, b) => Math.abs(a.delta - target) - Math.abs(b.delta - target))[0];
  const c25 = near25(calls, 0.25);
  const p25 = near25(puts, -0.25);
  return {
    symbol, timestamp: raw.timestamp, spot, change: raw.change, changePct: raw.changePct, iv30: raw.iv30, iv30Change: raw.iv30Change,
    expiries, expiry: exp, chain: byStrike, maxPain, gex,
    stats: {
      callVolume: sum(calls, (r) => r.volume), putVolume: sum(puts, (r) => r.volume), callOi: sum(calls, (r) => r.oi), putOi: sum(puts, (r) => r.oi),
      pcVolumeAll: sum(allPuts, (r) => r.volume) / Math.max(1, sum(allCalls, (r) => r.volume)), pcOiAll: sum(allPuts, (r) => r.oi) / Math.max(1, sum(allCalls, (r) => r.oi)),
      atmIv: atmIv(sel), skew25: c25 && p25 ? p25.iv - c25.iv : null, netGex: gex.reduce((n, g) => n + g.gex, 0),
      totalContracts: raw.rows.length,
    },
    term,
    unusual: raw.rows.filter((r) => r.volume > 500 && r.volume > r.oi * 1.5).sort((a, b) => b.volume - a.volume).slice(0, 25),
  };
}

/* ------------------------------------------------------------------ 外汇：参考汇率 + 政策利率 */
export async function fxReference() {
  return cached("fxref", 30 * 60e3, async () => {
    const latest = await getJson<{ date: string; rates: Record<string, number> }>("https://api.frankfurter.app/latest?from=USD");
    const d = new Date(Date.parse(latest.date) - 35 * 86400e3).toISOString().slice(0, 10);
    const series = await getJson<{ rates: Record<string, Record<string, number>> }>(`https://api.frankfurter.app/${d}..${latest.date}?from=USD`).catch(() => ({ rates: {} as Record<string, Record<string, number>> }));
    const dates = Object.keys(series.rates).sort();
    const hist: Record<string, number[]> = {};
    for (const dt of dates) for (const [c, v] of Object.entries(series.rates[dt])) (hist[c] ??= []).push(v);
    const policy: Array<{ bank: string; rate: number | null; date: string | null }> = [];
    await Promise.all([
      (async () => {
        const j = JSON.parse(await getText("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json", {}, "utf-8", 15000));
        const r = j?.refRates?.[0];
        policy.push({ bank: "美联储（有效联邦基金利率）", rate: r ? Number(r.percentRate) : null, date: r?.effectiveDate ?? null });
      })().catch(() => undefined),
      (async () => {
        const t = await getText("https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?lastNObservations=1&format=csvdata", {}, "utf-8", 15000);
        const line = t.trim().split(/\r?\n/)[1]?.split(",") ?? [];
        const head = t.trim().split(/\r?\n/)[0].split(",");
        policy.push({ bank: "欧洲央行（存款便利利率）", rate: Number(line[head.indexOf("OBS_VALUE")]) || null, date: line[head.indexOf("TIME_PERIOD")] ?? null });
      })().catch(() => undefined),
    ]);
    return { date: latest.date, rates: latest.rates, history: hist, dates, policy };
  });
}

/* ------------------------------------------------------------------ CFTC 持仓报告（金融期货） */
const COT_NAMES: Array<[RegExp, string, string]> = [
  [/^EURO FX - CHICAGO/, "欧元", "EURUSD"], [/^JAPANESE YEN - CHICAGO/, "日元", "USDJPY"], [/^BRITISH POUND - CHICAGO/, "英镑", "GBPUSD"], [/^SWISS FRANC - CHICAGO/, "瑞郎", "USDCHF"],
  [/^CANADIAN DOLLAR - CHICAGO/, "加元", "USDCAD"], [/^AUSTRALIAN DOLLAR - CHICAGO/, "澳元", "AUDUSD"], [/^NZ DOLLAR - CHICAGO|^NEW ZEALAND DOLLAR/, "纽元", "NZDUSD"], [/^MEXICAN PESO - CHICAGO/, "墨西哥比索", "USDMXN"],
  [/^USD INDEX - ICE/, "美元指数", "DXY"], [/^BITCOIN - CHICAGO/, "比特币", "BTC"], [/^E-MINI S&P 500 -/, "标普500", "ES"], [/^NASDAQ MINI - CHICAGO|^NASDAQ-100 Consolidated/, "纳指100", "NQ"],
  [/^RUSSELL E-MINI/, "罗素2000", "RTY"], [/^DJIA x \$5/, "道指", "YM"], [/^VIX FUTURES/, "VIX", "^VIX"], [/^UST 2Y NOTE/, "2年美债", "ZT"], [/^UST 5Y NOTE/, "5年美债", "ZF"],
  [/^UST 10Y NOTE/, "10年美债", "ZN"], [/^UST BOND/, "30年美债", "ZB"], [/^ULTRA UST 10Y/, "超长10年美债", "TN"], [/^SOFR-3M/, "3个月SOFR", "SR3"], [/^FED FUNDS/, "联邦基金", "ZQ"],
];
export async function cotReport() {
  return cached("cot", 6 * 3600e3, async () => {
    const text = await getText("https://www.cftc.gov/dea/newcot/FinFutWk.txt", {}, "utf-8", 30000);
    const out: Array<{ name: string; symbol: string; date: string; oi: number; dealerNet: number; assetMgrNet: number; levNet: number; assetMgrNetChg: number; levNetChg: number; levLongPct: number }> = [];
    for (const line of text.split(/\r?\n/)) {
      const cells = line.match(/("([^"]*)"|[^,]+)/g)?.map((c) => c.replace(/^"|"$/g, "").trim()) ?? [];
      if (cells.length < 33) continue;
      const hit = COT_NAMES.find(([re]) => re.test(cells[0]));
      if (!hit || out.some((o) => o.symbol === hit[2])) continue;
      const n = (i: number) => Number(cells[i]) || 0;
      const levLong = n(14);
      const levShort = n(15);
      out.push({
        name: hit[1], symbol: hit[2], date: cells[2], oi: n(7),
        dealerNet: n(8) - n(9), assetMgrNet: n(11) - n(12), levNet: levLong - levShort,
        assetMgrNetChg: n(28) - n(29), levNetChg: n(31) - n(32), levLongPct: levLong + levShort ? (levLong / (levLong + levShort)) * 100 : 50,
      });
    }
    return out;
  });
}

/* ------------------------------------------------------------------ 收益率曲线（美债历史 + 欧元区） */
export async function curves() {
  return cached("curves", 30 * 60e3, async () => {
    const year = new Date().getUTCFullYear();
    const load = async (y: number) => {
      const text = await getText(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}`, {}, "utf-8", 25000);
      const lines = text.trim().split(/\r?\n/);
      const head = lines[0].split(",").map((h) => h.replace(/"/g, "").replace(/ Mo(nth)?$/, "M").replace(/ Yr$/, "Y").replace("1.5 Month", "6W"));
      return lines.slice(1).map((l) => {
        const c = l.split(",");
        const [mm, dd, yy] = c[0].split("/");
        return { date: `${yy}-${mm}-${dd}`, points: head.slice(1).map((t, i) => ({ tenor: t, value: Number(c[i + 1]) })).filter((p) => Number.isFinite(p.value) && p.value > 0) };
      });
    };
    const us = [...(await load(year).catch(() => [])), ...(await load(year - 1).catch(() => []))].sort((a, b) => b.date.localeCompare(a.date));
    const EU_TENORS = [["3M", "SR_3M"], ["1Y", "SR_1Y"], ["2Y", "SR_2Y"], ["5Y", "SR_5Y"], ["10Y", "SR_10Y"], ["20Y", "SR_20Y"], ["30Y", "SR_30Y"]];
    const eu: Array<{ tenor: string; value: number }> = [];
    let euDate: string | null = null;
    await Promise.all(EU_TENORS.map(async ([tenor, key]) => {
      try {
        const t = await getText(`https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.${key}?lastNObservations=1&format=csvdata`, {}, "utf-8", 15000);
        const lines = t.trim().split(/\r?\n/);
        const head = lines[0].split(",");
        const row = lines[1]?.split(",") ?? [];
        const v = Number(row[head.indexOf("OBS_VALUE")]);
        if (Number.isFinite(v)) eu.push({ tenor, value: v });
        euDate = row[head.indexOf("TIME_PERIOD")] ?? euDate;
      } catch {
        /* 单个期限失败不影响 */
      }
    }));
    eu.sort((a, b) => EU_TENORS.findIndex(([t]) => t === a.tenor) - EU_TENORS.findIndex(([t]) => t === b.tenor));
    const spread = (d: (typeof us)[number], a: string, b: string) => {
      const x = d.points.find((p) => p.tenor === a)?.value;
      const y = d.points.find((p) => p.tenor === b)?.value;
      return x != null && y != null ? Math.round((x - y) * 100) : null;
    };
    const spreads = us.slice(0, 260).reverse().map((d) => ({ date: d.date, s2s10: spread(d, "10Y", "2Y"), s3m10: spread(d, "10Y", "3M"), s5s30: spread(d, "30Y", "5Y"), y10: d.points.find((p) => p.tenor === "10Y")?.value ?? null, y2: d.points.find((p) => p.tenor === "2Y")?.value ?? null }));
    return { us: us.slice(0, 260), eu, euDate, spreads };
  });
}

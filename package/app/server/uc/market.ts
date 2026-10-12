/**
 * 佑诚实时行情服务：WEI 行情综合大屏的唯一数据入口。
 *
 *  - ticks(symbols)        秒级报价（服务端 2 秒合并缓存，多个页面同时看也只请求一次上游）
 *  - kline(symbol, period) 分时 / 1·5·15·30·60 分钟 / 日 / 周 / 月 K 线
 *
 * 上游按顺序自动切换：东方财富 → 腾讯 → 新浪 → Yahoo。每个上游有独立熔断：
 * 连续失败后暂停 60 秒，不会让一个慢源拖住整页（单次请求最长 4 秒）。
 * 返回给前端的数据不带任何来源字段。
 */

import { archiveKline, archiveTick, loadKline, loadTickBars } from "./warehouse";

export type UcPeriod = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1w" | "1M";
export type UcCandle = { t: number; o: number; h: number; l: number; c: number; v: number | null; s?: "pre" | "post" };
export type UcTick = {
  symbol: string;
  name: string | null;
  price: number;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  amount: number | null;
  time: number;
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const TIMEOUT_MS = 4000;

/* ------------------------------------------------------------------ 熔断 */
type ProviderId = "em" | "qq" | "sina" | "yahoo" | "tv";
const health: Record<ProviderId, { fails: number; until: number; lastOk: number; lastError: string | null }> = {
  em: { fails: 0, until: 0, lastOk: 0, lastError: null },
  qq: { fails: 0, until: 0, lastOk: 0, lastError: null },
  sina: { fails: 0, until: 0, lastOk: 0, lastError: null },
  yahoo: { fails: 0, until: 0, lastOk: 0, lastError: null },
  tv: { fails: 0, until: 0, lastOk: 0, lastError: null },
};
const available = (p: ProviderId) => health[p].until <= Date.now();
function ok(p: ProviderId) {
  health[p].fails = 0;
  health[p].lastOk = Date.now();
}
function fail(p: ProviderId, error: unknown) {
  const h = health[p];
  h.fails += 1;
  h.lastError = error instanceof Error ? error.message : String(error);
  if (h.fails >= 3) h.until = Date.now() + 60_000;
}
export function marketHealth() {
  return Object.fromEntries(Object.entries(health).map(([k, v]) => [k, { ...v, paused: v.until > Date.now() }]));
}

export async function getText(url: string, headers: Record<string, string> = {}, encoding: "utf-8" | "gbk" = "utf-8", timeoutMs = TIMEOUT_MS) {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder(encoding).decode(buf);
}
export async function getJson<T = any>(url: string, headers: Record<string, string> = {}) {
  const text = await getText(url, headers);
  return JSON.parse(text.replace(/^[^{[]*?(?=[{[])/, "").replace(/\)\s*;?\s*$/, "")) as T;
}

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "" || v === "-") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ------------------------------------------------------------------ 代码解析 */
export type Parsed =
  | { kind: "cn"; code: string; ex: "SH" | "SZ" | "BJ" }
  | { kind: "hk"; code: string }
  | { kind: "us"; code: string }
  | { kind: "gidx"; code: string }
  | { kind: "em"; secid: string }
  | { kind: "x"; code: string }
  | { kind: "intl"; yahoo: string };

/** 证券清单里各国交易所后缀 → 全球行情代码后缀 */
const INTL_SUFFIX: Record<string, string> = {
  AD: "AD", DU: "DU", VI: "VI", AX: "AX", SA: "SA", TO: "TO", V: "V", CN: "CN", NE: "NE", S: "SW", SW: "SW", DE: "DE", F: "F", BE: "BE", MU: "MU", SG: "SI", SI: "SI",
  CO: "CO", MC: "MC", HE: "HE", PA: "PA", L: "L", IL: "IL", JK: "JK", I: "IR", IR: "IR", TA: "TA", NS: "NS", BO: "BO", IC: "IC", MI: "MI", T: "T", KS: "KS", KQ: "KQ",
  MX: "MX", KL: "KL", AS: "AS", BR: "BR", OL: "OL", NZ: "NZ", PS: "PS", LS: "LS", ME: "ME", SE: "SR", SR: "SR", ST: "ST", TH: "BK", BK: "BK", TW: "TW", TWO: "TWO",
  HM: "VN", VN: "VN", HN: "HN", UP: "UP", DFM: "DFM", KH: "KH", LA: "LA", YG: "YG", SN: "SN", JO: "JO", IS: "IS", WA: "WA", PR: "PR", AT: "AT", BD: "BD", QA: "QA", KW: "KW", CA: "CA", LM: "LM",
};

/** 全球指数：Yahoo 风格代码 → 东方财富 100 市场代码 */
const GLOBAL_INDEX: Record<string, { em: string; qq?: string; sina?: string; name: string }> = {
  "^GSPC": { em: "100.SPX", qq: "usINX", name: "标普500" },
  "^SPX": { em: "100.SPX", qq: "usINX", name: "标普500" },
  "^DJI": { em: "100.DJIA", qq: "usDJI", name: "道琼斯" },
  "^IXIC": { em: "100.NDX", qq: "usIXIC", name: "纳斯达克" },
  "^NDX": { em: "100.NDX100", name: "纳斯达克100" },
  "^FTSE": { em: "100.FTSE", name: "富时100" },
  "^GDAXI": { em: "100.GDAXI", name: "德国DAX" },
  "^FCHI": { em: "100.FCHI", name: "法国CAC40" },
  "^STOXX50E": { em: "100.SX5E", name: "欧洲斯托克50" },
  "^N225": { em: "100.N225", name: "日经225" },
  "^HSI": { em: "100.HSI", qq: "hkHSI", sina: "rt_hkHSI", name: "恒生指数" },
  "^HSCE": { em: "100.HSCEI", qq: "hkHSCEI", name: "国企指数" },
  "^KS11": { em: "100.KS11", name: "韩国综合" },
  "^TWII": { em: "100.TWII", name: "台湾加权" },
  "^BSESN": { em: "100.SENSEX", name: "印度SENSEX" },
  "^AXJO": { em: "100.AS51", name: "澳洲标普200" },
  "^GSPTSE": { em: "100.TSX", name: "加拿大S&P/TSX" },
  "^BVSP": { em: "100.BVSP", name: "巴西IBOVESPA" },
  "^STI": { em: "100.STI", name: "新加坡海峡" },
  "^VIX": { em: "100.VIX", name: "VIX恐慌指数" },
  "^VIX9D": { em: "", name: "9日VIX" }, "^VIX3M": { em: "", name: "3个月VIX" }, "^VIX6M": { em: "", name: "6个月VIX" }, "^VVIX": { em: "", name: "VIX的波动率" }, "^SKEW": { em: "", name: "尾部风险SKEW" },
  "^IRX": { em: "", name: "13周美债收益率" }, "^FVX": { em: "", name: "5年美债收益率" }, "^TNX": { em: "", name: "10年美债收益率" }, "^TYX": { em: "", name: "30年美债收益率" },
  "^MOVE": { em: "", name: "MOVE美债波动率" }, "^RUT": { em: "", name: "罗素2000" },
  "^NSEI": { em: "100.NIFTY", name: "印度NIFTY50" },
  "^MXX": { em: "100.MXX", name: "墨西哥IPC" },
};
/** 期货 / 外汇 / 大宗商品 */
export const EXTRA: Record<string, { yahoo: string; sina?: string; em?: string; name: string }> = {
  ES: { yahoo: "ES=F", name: "标普500期货" },
  NQ: { yahoo: "NQ=F", name: "纳指100期货" },
  YM: { yahoo: "YM=F", name: "道指期货" },
  RTY: { yahoo: "RTY=F", name: "罗素2000期货" },
  NKD: { yahoo: "NKD=F", name: "日经225期货" },
  ZN: { yahoo: "ZN=F", name: "美国10年期国债期货" },
  GC: { yahoo: "GC=F", sina: "hf_GC", em: "101.GC00Y", name: "COMEX黄金" },
  SI: { yahoo: "SI=F", sina: "hf_SI", em: "101.SI00Y", name: "COMEX白银" },
  HG: { yahoo: "HG=F", sina: "hf_HG", em: "101.HG00Y", name: "COMEX铜" },
  CL: { yahoo: "CL=F", sina: "hf_CL", em: "102.CL00Y", name: "WTI原油" },
  BRENT: { yahoo: "BZ=F", sina: "hf_OIL", em: "112.B00Y", name: "布伦特原油" },
  NG: { yahoo: "NG=F", sina: "hf_NG", em: "102.NG00Y", name: "天然气" },
  PL: { yahoo: "PL=F", name: "铂金" },
  ZC: { yahoo: "ZC=F", name: "玉米" },
  ZS: { yahoo: "ZS=F", name: "大豆" },
  ZW: { yahoo: "ZW=F", name: "小麦" },
  DXY: { yahoo: "DX-Y.NYB", em: "100.UDI", name: "美元指数" },
  USDCNH: { yahoo: "CNH=X", em: "133.USDCNH", name: "美元/离岸人民币" },
  USDCNY: { yahoo: "CNY=X", name: "美元/人民币" },
  EURUSD: { yahoo: "EURUSD=X", em: "119.EURUSD", name: "欧元/美元" },
  USDJPY: { yahoo: "JPY=X", em: "119.USDJPY", name: "美元/日元" },
  GBPUSD: { yahoo: "GBPUSD=X", em: "119.GBPUSD", name: "英镑/美元" },
  AUDUSD: { yahoo: "AUDUSD=X", em: "119.AUDUSD", name: "澳元/美元" },
  USDHKD: { yahoo: "HKD=X", name: "美元/港币" },
  EURCNY: { yahoo: "EURCNY=X", name: "欧元/人民币" },
  USDCHF: { yahoo: "CHF=X", name: "美元/瑞郎" }, USDCAD: { yahoo: "CAD=X", name: "美元/加元" }, NZDUSD: { yahoo: "NZDUSD=X", name: "纽元/美元" },
  USDMXN: { yahoo: "MXN=X", name: "美元/墨西哥比索" }, USDINR: { yahoo: "INR=X", name: "美元/印度卢比" }, USDKRW: { yahoo: "KRW=X", name: "美元/韩元" },
  USDSGD: { yahoo: "SGD=X", name: "美元/新加坡元" }, USDBRL: { yahoo: "BRL=X", name: "美元/巴西雷亚尔" }, USDZAR: { yahoo: "ZAR=X", name: "美元/南非兰特" },
  USDTRY: { yahoo: "TRY=X", name: "美元/土耳其里拉" }, USDTWD: { yahoo: "TWD=X", name: "美元/新台币" }, USDTHB: { yahoo: "THB=X", name: "美元/泰铢" },
  EURJPY: { yahoo: "EURJPY=X", name: "欧元/日元" }, EURGBP: { yahoo: "EURGBP=X", name: "欧元/英镑" }, GBPJPY: { yahoo: "GBPJPY=X", name: "英镑/日元" },
  AUDJPY: { yahoo: "AUDJPY=X", name: "澳元/日元" }, EURCHF: { yahoo: "EURCHF=X", name: "欧元/瑞郎" }, CNYJPY: { yahoo: "CNYJPY=X", name: "人民币/日元" },
  ZT: { yahoo: "ZT=F", name: "2年期美债期货" }, ZF: { yahoo: "ZF=F", name: "5年期美债期货" }, ZB: { yahoo: "ZB=F", name: "30年期美债期货" }, UB: { yahoo: "UB=F", name: "超长期美债期货" },
  VX: { yahoo: "^VIX", name: "VIX" },
  BTC: { yahoo: "BTC-USD", name: "比特币" },
  ETH: { yahoo: "ETH-USD", name: "以太坊" },
};

export function parseSymbol(raw: string): Parsed {
  const s = raw.trim().toUpperCase();
  if (GLOBAL_INDEX[s]) return { kind: "gidx", code: s };
  if (EXTRA[s]) return { kind: "x", code: s };
  if (/=F$|=X$|-USD$|\.NYB$/.test(s)) return { kind: "x", code: s };
  let m = /^(\d{6})\.(SH|SS|SZ|BJ)$/.exec(s);
  if (m) return { kind: "cn", code: m[1], ex: m[2] === "SS" ? "SH" : (m[2] as "SH" | "SZ" | "BJ") };
  m = /^(SH|SZ|BJ)(\d{6})$/.exec(s);
  if (m) return { kind: "cn", code: m[2], ex: m[1] as "SH" | "SZ" | "BJ" };
  if (/^\d{6}$/.test(s)) return { kind: "cn", code: s, ex: /^[569]/.test(s) ? "SH" : /^[48]/.test(s) ? "BJ" : "SZ" };
  m = /^(\d{1,5})\.HK$/.exec(s);
  if (m) return { kind: "hk", code: m[1].padStart(5, "0") };
  m = /^(.+)\.([A-Z]{1,3})$/.exec(s);
  if (m && INTL_SUFFIX[m[2]] && !/^\d{1,3}$/.test(m[1])) {
    const base = m[1].replace(/[\s/*]+/g, "");
    if (base) return { kind: "intl", yahoo: `${base}.${INTL_SUFFIX[m[2]]}` };
  }
  if (/^\d{1,3}\.[A-Z0-9_]+$/i.test(raw.trim())) return { kind: "em", secid: raw.trim() };
  m = /^([A-Z][A-Z0-9.\-]{0,9}?)(?:\.(?:O|N|A|OQ|US))?$/.exec(s);
  if (m) return { kind: "us", code: m[1].replace(/\./g, "_") };
  return { kind: "us", code: s };
}

/** 美股交易所在东方财富的市场号需要探测一次（105 纳斯达克 / 106 纽交所 / 107 美交所） */
const usMarketCache = new Map<string, string>();

function emSecidCandidates(p: Parsed): string[] {
  switch (p.kind) {
    case "gidx": return GLOBAL_INDEX[p.code].em ? [GLOBAL_INDEX[p.code].em] : [];
    case "em": return [p.secid];
    case "x": return EXTRA[p.code]?.em ? [EXTRA[p.code].em!] : [];
    case "intl": return [];
    case "cn": {
      // 000001.SH 是上证指数，000001.SZ 是平安银行：沪市 1，深市/北交所 0
      return [`${p.ex === "SH" ? 1 : 0}.${p.code}`];
    }
    case "hk": return [`116.${p.code}`];
    case "us": {
      const known = usMarketCache.get(p.code);
      return known ? [known] : [`105.${p.code}`, `106.${p.code}`, `107.${p.code}`];
    }
  }
}

export function qqCode(p: Parsed): string | null {
  switch (p.kind) {
    case "cn": return `${p.ex.toLowerCase()}${p.code}`;
    case "hk": return `hk${p.code}`;
    case "us": return `us${p.code.replace(/_/g, ".")}`;
    case "gidx": return GLOBAL_INDEX[p.code].qq ?? null;
    default: return null;
  }
}
function sinaCode(p: Parsed): string | null {
  switch (p.kind) {
    case "cn": return `${p.ex.toLowerCase()}${p.code}`;
    case "hk": return `rt_hk${p.code}`;
    case "us": return `gb_${p.code.toLowerCase().replace(/_/g, "$")}`;
    case "gidx": return GLOBAL_INDEX[p.code].sina ?? null;
    case "x": return EXTRA[p.code]?.sina ?? null;
    default: return null;
  }
}
export function yahooCode(p: Parsed, raw: string): string | null {
  switch (p.kind) {
    case "gidx": return p.code;
    case "x": return EXTRA[p.code]?.yahoo ?? p.code;
    case "cn": return `${p.code}.${p.ex === "SH" ? "SS" : p.ex === "SZ" ? "SZ" : "BJ"}`;
    case "hk": return `${String(Number(p.code)).padStart(4, "0")}.HK`;
    case "us": return p.code.replace(/_/g, "-");
    case "intl": return p.yahoo;
    default: return raw.startsWith("^") ? raw : null;
  }
}

export function displayName(symbol: string): string | null {
  const s = symbol.trim().toUpperCase();
  return GLOBAL_INDEX[s]?.name ?? EXTRA[s]?.name ?? null;
}

/* ------------------------------------------------------------------ 报价 */
const tickCache = new Map<string, { at: number; tick: UcTick | null }>();
const TICK_TTL = 1000;

async function emTicks(items: Array<{ symbol: string; parsed: Parsed }>): Promise<Map<string, UcTick>> {
  const out = new Map<string, UcTick>();
  const secidToSymbols = new Map<string, string[]>();
  for (const it of items) for (const secid of emSecidCandidates(it.parsed)) {
    const list = secidToSymbols.get(secid) ?? [];
    list.push(it.symbol);
    secidToSymbols.set(secid, list);
  }
  const secids = [...secidToSymbols.keys()];
  for (let i = 0; i < secids.length; i += 80) {
    const chunk = secids.slice(i, i + 80);
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&secids=${chunk.join(",")}&fields=f2,f3,f4,f5,f6,f12,f13,f14,f15,f16,f17,f18,f124`;
    const json = await getJson<{ data?: { diff?: any[] } }>(url, { Referer: "https://quote.eastmoney.com/" });
    for (const d of json.data?.diff ?? []) {
      const secid = `${d.f13}.${d.f12}`;
      const price = num(d.f2);
      if (price === null) continue;
      const symbols = secidToSymbols.get(secid) ?? secidToSymbols.get(`${d.f13}.${String(d.f12).toUpperCase()}`) ?? [];
      for (const symbol of symbols) {
        const parsed = parseSymbol(symbol);
        if (parsed.kind === "us") usMarketCache.set(parsed.code, secid);
        out.set(symbol, {
          symbol,
          name: displayName(symbol) ?? (typeof d.f14 === "string" ? d.f14 : null),
          price,
          change: num(d.f4),
          changePct: num(d.f3),
          open: num(d.f17),
          high: num(d.f15),
          low: num(d.f16),
          prevClose: num(d.f18),
          volume: num(d.f5),
          amount: num(d.f6),
          time: (num(d.f124) ?? Date.now() / 1000) * 1000,
        });
      }
    }
  }
  return out;
}

/** 美东时间偏移（夏令时 3 月第二个周日 ~ 11 月第一个周日） */
function nyOffsetHours(y: number, mo: number, d: number) {
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + (n - 1) * 7;
  };
  const dstStart = Date.UTC(y, 2, nthSunday(2, 2));
  const dstEnd = Date.UTC(y, 10, nthSunday(10, 1));
  const t = Date.UTC(y, mo, d);
  return t >= dstStart && t < dstEnd ? -4 : -5;
}
/** 腾讯行情时间：A股 20260930161500（北京时间）；美股 2026-10-05 16:48:30（美东）；港股 2026/10/06 16:08:00（香港） */
function qqTime(raw: string | undefined, code: string): number {
  if (!raw) return Date.now();
  const m = /^(\d{4})[-/]?(\d{2})[-/]?(\d{2})[ T]?(\d{2}):?(\d{2}):?(\d{2})?/.exec(raw.trim());
  if (!m) return Date.now();
  const [y, mo, d, h, mi, se] = [+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)];
  const offset = code.startsWith("us") ? nyOffsetHours(y, mo, d) : 8;
  return Date.UTC(y, mo, d, h - offset, mi, se);
}

async function qqTicks(items: Array<{ symbol: string; parsed: Parsed }>): Promise<Map<string, UcTick>> {
  const out = new Map<string, UcTick>();
  const codes = new Map<string, string>();
  for (const it of items) {
    const c = qqCode(it.parsed);
    if (c) codes.set(c, it.symbol);
  }
  if (!codes.size) return out;
  const text = await getText(`https://qt.gtimg.cn/q=${[...codes.keys()].join(",")}`, { Referer: "https://gu.qq.com/" }, "gbk");
  for (const line of text.split(";")) {
    const m = /v_([a-zA-Z0-9_.]+)="([^"]*)"/.exec(line);
    if (!m) continue;
    const symbol = codes.get(m[1]);
    const f = m[2].split("~");
    if (!symbol || f.length < 35) continue;
    const price = num(f[3]);
    if (price === null || price === 0) continue;
    const ts = qqTime(f[30], m[1]);
    out.set(symbol, {
      symbol,
      name: displayName(symbol) ?? f[1] ?? null,
      price,
      change: num(f[31]),
      changePct: num(f[32]),
      open: num(f[5]),
      high: num(f[33]),
      low: num(f[34]),
      prevClose: num(f[4]),
      volume: num(f[6]),
      amount: num(f[37]),
      time: Number.isFinite(ts) ? ts : Date.now(),
    });
  }
  return out;
}

async function sinaTicks(items: Array<{ symbol: string; parsed: Parsed }>): Promise<Map<string, UcTick>> {
  const out = new Map<string, UcTick>();
  const codes = new Map<string, string>();
  for (const it of items) {
    const c = sinaCode(it.parsed);
    if (c) codes.set(c, it.symbol);
  }
  if (!codes.size) return out;
  const text = await getText(`https://hq.sinajs.cn/list=${[...codes.keys()].join(",")}`, { Referer: "https://finance.sina.com.cn/" }, "gbk");
  for (const line of text.split("\n")) {
    const m = /hq_str_([a-zA-Z0-9_$]+)="([^"]*)"/.exec(line);
    if (!m) continue;
    const symbol = codes.get(m[1]);
    const f = m[2].split(",");
    if (!symbol || f.length < 4) continue;
    let tick: UcTick | null = null;
    if (/^(sh|sz|bj)\d/.test(m[1])) {
      const price = num(f[3]), prev = num(f[2]);
      if (price) tick = { symbol, name: f[0], price, prevClose: prev, open: num(f[1]), high: num(f[4]), low: num(f[5]), volume: num(f[8]), amount: num(f[9]), change: prev ? price - prev : null, changePct: prev ? ((price - prev) / prev) * 100 : null, time: Date.parse(`${f[30]}T${f[31]}+08:00`) || Date.now() };
    } else if (m[1].startsWith("gb_")) {
      const price = num(f[1]);
      if (price) tick = { symbol, name: f[0], price, changePct: num(f[2]), change: num(f[4]), open: num(f[5]), high: num(f[6]), low: num(f[7]), prevClose: num(f[26]), volume: num(f[10]), amount: null, time: Date.parse(f[3]) || Date.now() };
    } else if (m[1].startsWith("rt_hk")) {
      const price = num(f[6]);
      if (price) tick = { symbol, name: f[1], price, open: num(f[2]), prevClose: num(f[3]), high: num(f[4]), low: num(f[5]), change: num(f[7]), changePct: num(f[8]), volume: num(f[12]), amount: num(f[11]), time: Date.parse(`${f[17]?.replace(/\//g, "-")}T${f[18]}+08:00`) || Date.now() };
    } else if (m[1].startsWith("hf_")) {
      const price = num(f[0]), prev = num(f[7]);
      if (price) tick = { symbol, name: displayName(symbol) ?? f[13] ?? null, price, prevClose: prev, open: num(f[8]), high: num(f[4]), low: num(f[5]), volume: null, amount: null, change: prev ? price - prev : null, changePct: prev ? ((price - prev) / prev) * 100 : null, time: Date.parse(`${f[12]}T${f[6]}+08:00`) || Date.now() };
    } else if (m[1].startsWith("int_")) {
      const price = num(f[1]);
      if (price) tick = { symbol, name: displayName(symbol) ?? f[0], price, change: num(f[2]), changePct: num(f[3]), open: null, high: null, low: null, prevClose: null, volume: null, amount: null, time: Date.now() };
    }
    if (tick) out.set(symbol, tick);
  }
  return out;
}

async function yahooTick(symbol: string, parsed: Parsed): Promise<UcTick | null> {
  const y0 = yahooCode(parsed, symbol);
  if (!y0) return null;
  let y = y0;
  let json = await getJson<any>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1d&range=5d`).catch(() => null);
  const alt = y.endsWith(".KS") ? y.replace(/\.KS$/, ".KQ") : y.endsWith(".KQ") ? y.replace(/\.KQ$/, ".KS") : y.endsWith(".TWO") ? y.replace(/\.TWO$/, ".TW") : y.endsWith(".TW") ? `${y}O` : null;
  if (!json?.chart?.result?.[0]?.meta?.regularMarketPrice && alt) {
    y = alt;
    json = await getJson<any>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1d&range=5d`).catch(() => null);
  }
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const price = num(meta?.regularMarketPrice);
  if (price === null) return null;
  // 昨收：日线倒数第二根的收盘（chartPreviousClose 是区间起点之前的收盘，不能用）
  const closes: Array<number | null> = (result?.indicators?.quote?.[0]?.close ?? []).map((v: unknown) => num(v));
  const stamps: number[] = result?.timestamp ?? [];
  const lastDay = stamps.length ? new Date((stamps[stamps.length - 1] + (num(meta?.gmtoffset) ?? 0)) * 1000).toISOString().slice(0, 10) : "";
  const marketDay = meta?.regularMarketTime ? new Date((meta.regularMarketTime + (num(meta?.gmtoffset) ?? 0)) * 1000).toISOString().slice(0, 10) : lastDay;
  const valid = closes.filter((v): v is number => v !== null);
  let prev = valid.length >= 2 ? (lastDay === marketDay ? valid[valid.length - 2] : valid[valid.length - 1]) : num(meta?.previousClose);
  if (prev === null) {
    // 外汇等日线不完整时：range=1d 的 chartPreviousClose 就是上一交易日收盘
    try {
      const one = await getJson<any>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1d&range=1d`);
      prev = num(one?.chart?.result?.[0]?.meta?.chartPreviousClose) ?? num(one?.chart?.result?.[0]?.meta?.previousClose);
    } catch {
      /* 没有昨收就只显示价格 */
    }
  }
  return {
    symbol, name: displayName(symbol) ?? meta?.shortName ?? null, price,
    prevClose: prev, change: prev ? price - prev : null, changePct: prev ? ((price - prev) / prev) * 100 : null,
    open: null, high: num(meta?.regularMarketDayHigh), low: num(meta?.regularMarketDayLow), volume: num(meta?.regularMarketVolume), amount: null,
    time: (num(meta?.regularMarketTime) ?? Date.now() / 1000) * 1000,
  };
}

/** 批量报价：一次 20 个代码（全球各交易所股票用这个，速度快、不易限流） */
async function yahooSpark(items: Array<{ symbol: string; parsed: Parsed }>): Promise<Map<string, UcTick>> {
  const out = new Map<string, UcTick>();
  const byCode = new Map<string, string>();
  for (const it of items) {
    const y = yahooCode(it.parsed, it.symbol);
    if (y) byCode.set(y, it.symbol);
  }
  const codes = [...byCode.keys()];
  if (codes.length < 3) return out;
  for (let i = 0; i < codes.length; i += 20) {
    const chunk = codes.slice(i, i + 20);
    const json = await getJson<any>(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${chunk.map(encodeURIComponent).join(",")}&range=1d&interval=5m&includePrePost=false`);
    const results: any[] = json?.spark?.result ?? Object.values(json ?? {}).map((v: any) => ({ symbol: v?.symbol, response: [{ meta: v, ...v }] }));
    for (const r of results) {
      const symbol = byCode.get(r?.symbol) ?? byCode.get(String(r?.symbol ?? "").toUpperCase());
      const resp = r?.response?.[0];
      const meta = resp?.meta ?? {};
      if (!symbol) continue;
      const closes: number[] = (resp?.indicators?.quote?.[0]?.close ?? resp?.close ?? []).filter((v: unknown) => typeof v === "number");
      const price = num(meta.regularMarketPrice) ?? (closes.length ? closes[closes.length - 1] : null);
      if (price === null) continue;
      const prev = num(meta.chartPreviousClose) ?? num(meta.previousClose);
      out.set(symbol, {
        symbol, name: displayName(symbol) ?? meta.shortName ?? meta.longName ?? null, price,
        prevClose: prev, change: prev ? price - prev : null, changePct: prev ? ((price - prev) / prev) * 100 : null,
        open: null, high: num(meta.regularMarketDayHigh), low: num(meta.regularMarketDayLow), volume: num(meta.regularMarketVolume), amount: null,
        time: (num(meta.regularMarketTime) ?? Date.now() / 1000) * 1000,
      });
    }
  }
  return out;
}

/** 批量取报价：缓存命中的直接返回，其余按上游顺序补齐。
 *  慢上游不拖住整页：最多等 2.5 秒，没回来的先用上一笔报价，后台继续补齐，下一轮（3 秒后）就是新价。 */
const refreshing = new Set<string>();
const TICK_BUDGET_MS = 2000;

/** 全球扫描行情：雅虎未覆盖的新兴 / 前沿市场（菲律宾、阿布扎比、柬埔寨、老挝、孟加拉、埃及、卡塔尔、科威特、秘鲁、智利等） */
const TV_EX: Record<string, string> = { PS: "PSE", AD: "ADX", DU: "DFM", DFM: "DFM", KH: "CSX", LA: "LSX", BD: "DSEBD", CA: "EGX", QA: "QSE", KW: "KSE", LM: "BVL", SN: "BCS", JO: "JSE", IS: "BIST", AT: "ATHEX", WA: "GPW", PR: "PSECZ", IC: "ICEX", VI: "VIE", HN: "HNX", UP: "UPCOM", VN: "HOSE", YG: "YSX", SR: "TADAWUL", KL: "MYX", JK: "IDX", BK: "SET" };
function tvCode(p: Parsed): string | null {
  if (p.kind !== "intl") return null;
  const m = /^(.+)\.([A-Z]+)$/.exec(p.yahoo);
  if (!m || !TV_EX[m[2]]) return null;
  return `${TV_EX[m[2]]}:${m[1].replace(/-/g, "_")}`;
}
async function tvTicks(items: Array<{ symbol: string; parsed: Parsed }>): Promise<Map<string, UcTick>> {
  const out = new Map<string, UcTick>();
  const by = new Map<string, string>();
  for (const it of items) { const c = tvCode(it.parsed); if (c) by.set(c, it.symbol); }
  if (!by.size) return out;
  const res = await fetch("https://scanner.tradingview.com/global/scan", { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: JSON.stringify({ symbols: { tickers: [...by.keys()] }, columns: ["close", "change", "change_abs", "volume", "high", "low", "open", "description", "currency"] }), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`tv ${res.status}`);
  const j = await res.json() as { data?: Array<{ s: string; d: Array<number | string | null> }> };
  const now = Date.now();
  for (const row of j.data ?? []) {
    const sym = by.get(row.s);
    const [close, chg, chgAbs, vol, high, low, open, desc] = row.d;
    const price = num(close);
    if (!sym || price == null || price <= 0) continue;
    const pct = num(chg), abs = num(chgAbs);
    const prev = abs != null ? price - abs : pct != null ? price / (1 + pct / 100) : null;
    out.set(sym, { symbol: sym, name: displayName(sym) ?? (typeof desc === "string" ? desc : null), price, prevClose: prev, change: abs, changePct: pct, open: num(open), high: num(high), low: num(low), volume: num(vol), amount: null, time: now });
    // 当日日线写入平台库：雅虎无历史的市场由此逐日积累 K 线
    const o = num(open), h = num(high), l = num(low);
    if (o && h && l) {
      const d = new Date(now); const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      archiveKline(sym, "1d", [{ t: day, o, h, l, c: price, v: num(vol) }]);
    }
  }
  return out;
}

async function refreshTicks(items: Array<{ symbol: string; parsed: Parsed }>) {
  let pending = items;
  // 本机实测：腾讯（A股/港股/美股/美港指数）最快；Yahoo（全球各交易所、期货、外汇）批量；新浪 / 东方财富兜底
  // 俄罗斯 / 越南：交易所直连
  if (pending.some((it) => localOf(it.parsed))) {
    const got = await localTicks(pending).catch(() => new Map<string, UcTick>());
    for (const [sym, tick] of got) { tickCache.set(sym, { at: Date.now(), tick }); archiveTick(sym, tick.time, tick.price, tick.changePct, tick.volume); }
    pending = pending.filter((p) => !got.has(p.symbol));
  }
  const providers: Array<[ProviderId, (items: typeof pending) => Promise<Map<string, UcTick>>]> = [
    ["qq", qqTicks],
    ["yahoo", async (list0) => {
      const out = await yahooSpark(list0).catch(() => new Map<string, UcTick>());
      const list = list0.filter((it) => !out.has(it.symbol)).slice(0, 60);
      for (let i = 0; i < list.length; i += 12) {
        await Promise.all(list.slice(i, i + 12).map(async (it) => {
          const t = await yahooTick(it.symbol, it.parsed).catch(() => null);
          if (t) out.set(it.symbol, t);
        }));
      }
      return out;
    }],
    ["tv", tvTicks],
    ["sina", sinaTicks],
    ["em", emTicks],
  ];
  const supports: Record<ProviderId, (p: Parsed) => boolean> = {
    qq: (p) => qqCode(p) !== null,
    yahoo: () => true,
    tv: (p) => tvCode(p) !== null,
    sina: (p) => sinaCode(p) !== null,
    em: (p) => emSecidCandidates(p).length > 0,
  };
  for (const [id, fn] of providers) {
    if (!pending.length) break;
    if (!available(id)) continue;
    const batch = pending.filter((it) => supports[id](it.parsed));
    if (!batch.length) continue;
    try {
      const got = await fn(batch);
      if (got.size) ok(id);
      for (const [sym, tick] of got) {
        tickCache.set(sym, { at: Date.now(), tick });
        archiveTick(sym, tick.time, tick.price, tick.changePct, tick.volume);
      }
      pending = pending.filter((p) => !got.has(p.symbol));
    } catch (error) {
      fail(id, error);
    }
  }
  // 拿不到的标的也记一笔，避免每 3 秒都去打一遍上游（30 秒后再试）
  for (const p of pending) {
    const old = tickCache.get(p.symbol);
    tickCache.set(p.symbol, { at: Date.now() + 28_000, tick: old?.tick ?? null });
  }
}

export async function getTicks(symbols: string[], options: { budgetMs?: number } = {}): Promise<Record<string, UcTick | null>> {
  const now = Date.now();
  const list = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))].slice(0, 400);
  const stale: Array<{ symbol: string; parsed: Parsed }> = [];
  for (const raw of list) {
    const hit = tickCache.get(raw);
    const ttl = hit?.tick && ["intl", "x", "gidx"].includes(parseSymbol(raw).kind) ? 5000 : TICK_TTL;
    if ((!hit || now - hit.at >= ttl) && !refreshing.has(raw)) stale.push({ symbol: raw, parsed: parseSymbol(raw) });
  }
  if (stale.length) {
    for (const s of stale) refreshing.add(s.symbol);
    const job = refreshTicks(stale).finally(() => { for (const s of stale) refreshing.delete(s.symbol); });
    await Promise.race([job, new Promise((r) => setTimeout(r, options.budgetMs ?? TICK_BUDGET_MS))]);
  }
  const result: Record<string, UcTick | null> = {};
  for (const raw of list) result[raw] = tickCache.get(raw)?.tick ?? null;
  return result;
}

/* ------------------------------------------------------------------ K 线 */
const EM_KLT: Record<UcPeriod, number> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "60m": 60, "1d": 101, "1w": 102, "1M": 103 };
const klineCache = new Map<string, { at: number; candles: UcCandle[] }>();
const KLINE_TTL: Record<UcPeriod, number> = { "1m": 15_000, "5m": 30_000, "15m": 60_000, "30m": 60_000, "60m": 120_000, "1d": 300_000, "1w": 600_000, "1M": 600_000 };

const cnTime = (s: string) => Date.parse(s.length <= 10 ? `${s}T00:00:00+08:00` : `${s.replace(" ", "T")}:00+08:00`);

async function emKline(p: Parsed, period: UcPeriod, limit: number): Promise<UcCandle[]> {
  let lastError: unknown = null;
  for (const secid of emSecidCandidates(p)) {
    try {
      const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=${EM_KLT[period]}&fqt=1&lmt=${limit}&end=20500101&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57`;
      const json = await getJson<{ data?: { klines?: string[] } }>(url, { Referer: "https://quote.eastmoney.com/" });
      const lines = json.data?.klines ?? [];
      if (!lines.length) continue;
      if (p.kind === "us") usMarketCache.set(p.code, secid);
      return lines.map((line) => {
        const [d, o, c, h, l, v] = line.split(",");
        return { t: cnTime(d), o: +o, h: +h, l: +l, c: +c, v: num(v) };
      }).filter((k) => Number.isFinite(k.t) && k.c > 0);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return [];
}

async function qqKline(p: Parsed, period: UcPeriod, limit: number): Promise<UcCandle[]> {
  const code = qqCode(p);
  if (!code) return [];
  if (period === "1d" || period === "1w" || period === "1M") {
    const unit = period === "1d" ? "day" : period === "1w" ? "week" : "month";
    const json = await getJson<any>(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${code},${unit},,,${limit},qfq`, { Referer: "https://gu.qq.com/" });
    const node = json?.data?.[code];
    const rows: any[] = node?.[`qfq${unit}`] ?? node?.[unit] ?? [];
    return rows.map((r) => ({ t: cnTime(r[0]), o: +r[1], c: +r[2], h: +r[3], l: +r[4], v: num(r[5]) })).filter((k) => k.c > 0);
  }
  if (period === "1m") {
    // 分时：当日每分钟成交价
    const json = await getJson<any>(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`, { Referer: "https://gu.qq.com/" });
    const node = json?.data?.[code]?.data;
    const date: string = String(node?.date ?? "");
    const lines: string[] = node?.data ?? [];
    if (!/^\d{8}$/.test(date)) return [];
    let prevVol = 0;
    return lines.map((line) => {
      const [hm, price, vol] = line.split(" ");
      const t = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${hm.slice(0, 2)}:${hm.slice(2, 4)}:00+08:00`);
      const v = num(vol);
      const dv = v === null ? null : Math.max(0, v - prevVol);
      if (v !== null) prevVol = v;
      const c = Number(price);
      return { t, o: c, h: c, l: c, c, v: dv };
    }).filter((k) => Number.isFinite(k.t) && k.c > 0).map((k, i, arr) => (i ? { ...k, o: arr[i - 1].c, h: Math.max(arr[i - 1].c, k.c), l: Math.min(arr[i - 1].c, k.c) } : k));
  }
  const m = { "5m": "m5", "15m": "m15", "30m": "m30", "60m": "m60" }[period];
  const json = await getJson<any>(`https://ifzq.gtimg.cn/appstock/app/kline/mkline?param=${code},${m},,${limit}`, { Referer: "https://gu.qq.com/" });
  const rows: any[] = json?.data?.[code]?.[m] ?? [];
  return rows.map((r) => {
    const s = String(r[0]);
    const t = Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00+08:00`);
    return { t, o: +r[1], c: +r[2], h: +r[3], l: +r[4], v: num(r[5]) };
  }).filter((k) => k.c > 0);
}

async function sinaKline(p: Parsed, period: UcPeriod, limit: number): Promise<UcCandle[]> {
  if (p.kind !== "cn") return [];
  const scale = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "60m": 60, "1d": 240, "1w": 1200, "1M": 7200 }[period];
  const json = await getJson<any[]>(`https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${p.ex.toLowerCase()}${p.code}&scale=${scale}&ma=no&datalen=${limit}`, { Referer: "https://finance.sina.com.cn/" });
  return (json ?? []).map((r) => ({ t: cnTime(r.day), o: +r.open, h: +r.high, l: +r.low, c: +r.close, v: num(r.volume) })).filter((k) => k.c > 0);
}

/** 美股时段：按美东时间判断盘前（4:00-9:30）/ 盘后（16:00-20:00） */
export function usSessionOf(ms: number): "pre" | "post" | undefined {
  const d = new Date(ms);
  const off = nyOffsetHours(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const local = new Date(ms + off * 3600e3);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (minutes < 570) return "pre";
  if (minutes >= 960) return "post";
  return undefined;
}

export async function yahooChart(y: string, interval: string, range: string, prepost = false) {
  let json: any;
  try {
    json = await getJson<any>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=${interval}&range=${range}${prepost ? "&includePrePost=true" : ""}`);
  } catch (error) {
    // 代码不存在（如雅虎未覆盖的市场）不算线路故障，避免把整条线路熔断
    if (/HTTP 404/.test(String(error))) return { meta: {} as Record<string, any>, candles: [] as UcCandle[] };
    throw error;
  }
  const r = json?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const candles = ts.map((t, i) => ({ t: t * 1000, o: q.open?.[i], h: q.high?.[i], l: q.low?.[i], c: q.close?.[i], v: num(q.volume?.[i]) }))
    .filter((k) => [k.o, k.h, k.l, k.c].every((v) => typeof v === "number" && v > 0)) as UcCandle[];
  return { meta: (r?.meta ?? {}) as Record<string, any>, candles };
}

async function yahooKline(p: Parsed, raw: string, period: UcPeriod, limit = 240): Promise<UcCandle[]> {
  const y = yahooCode(p, raw);
  if (!y) return [];
  const map: Record<UcPeriod, [string, string]> = { "1m": ["1m", "1d"], "5m": ["5m", "5d"], "15m": ["15m", "5d"], "30m": ["30m", "1mo"], "60m": ["60m", "1mo"], "1d": ["1d", "1y"], "1w": ["1wk", "5y"], "1M": ["1mo", "10y"] };
  let [interval, range] = map[period];
  if (period === "1d") range = limit > 1260 ? "10y" : limit > 500 ? "5y" : limit > 250 ? "2y" : "1y";
  if (period === "1w" && limit > 260) range = "10y";
  const intraday = period.endsWith("m") && period !== "1M";
  const prepost = intraday && p.kind === "us";
  let { candles } = await yahooChart(y, interval, range, prepost).catch(() => ({ candles: [] as UcCandle[] }));
  // 交易所后缀纠错：韩国主板 / 创业板、台湾上市 / 上柜 互换再试
  if (!candles.length) {
    const alt = y.endsWith(".KS") ? y.replace(/\.KS$/, ".KQ") : y.endsWith(".KQ") ? y.replace(/\.KQ$/, ".KS") : y.endsWith(".TWO") ? y.replace(/\.TWO$/, ".TW") : y.endsWith(".TW") ? `${y}O` : null;
    if (alt) candles = (await yahooChart(alt, interval, range, prepost).catch(() => ({ candles: [] as UcCandle[] }))).candles;
  }
  if (period === "1m" && candles.length < 60) {
    // 开盘前 / 节假日：带上前一交易日，分时图不至于空白
    candles = (await yahooChart(y, interval, "5d", prepost)).candles.slice(-780);
  }
  if (prepost) for (const c of candles) {
    const s = usSessionOf(c.t);
    if (s) c.s = s;
  }
  return candles;
}

/* ------------------------------------------------------------------ 本地交易所直连（俄罗斯 / 越南） */
const localOf = (p: Parsed): { ex: "moex" | "vn"; code: string } | null => {
  if (p.kind !== "intl") return null;
  const [base, suf] = p.yahoo.split(".");
  if (suf === "ME") return { ex: "moex", code: base };
  if (suf === "VN" || suf === "HN" || suf === "UP") return { ex: "vn", code: base };
  return null;
};
async function moexKline(code: string, period: UcPeriod, limit: number): Promise<UcCandle[]> {
  const iv: Record<UcPeriod, number> = { "1m": 1, "5m": 10, "15m": 10, "30m": 10, "60m": 60, "1d": 24, "1w": 7, "1M": 31 };
  const daysBack: Record<UcPeriod, number> = { "1m": 3, "5m": 10, "15m": 20, "30m": 30, "60m": 60, "1d": Math.ceil(limit * 1.5) + 10, "1w": limit * 7 + 30, "1M": limit * 31 + 60 };
  const from = new Date(Date.now() - daysBack[period] * 86400_000).toISOString().slice(0, 10);
  const out: UcCandle[] = [];
  for (let start = 0, page = 0; page < 8; page++) {
    const j = await getJson<any>(`https://iss.moex.com/iss/engines/stock/markets/shares/securities/${encodeURIComponent(code)}/candles.json?interval=${iv[period]}&from=${from}&start=${start}&iss.meta=off`);
    const cols: string[] = j?.candles?.columns ?? [];
    const rows: any[][] = j?.candles?.data ?? [];
    const ix = (k: string) => cols.indexOf(k);
    for (const r of rows) {
      const t = Date.parse(`${String(r[ix("begin")]).replace(" ", "T")}+03:00`);
      out.push({ t, o: +r[ix("open")], h: +r[ix("high")], l: +r[ix("low")], c: +r[ix("close")], v: num(r[ix("volume")]) });
    }
    if (rows.length < 500) break;
    start += rows.length;
  }
  return out.filter((c) => c.c > 0).slice(-limit);
}
async function vnKline(code: string, period: UcPeriod, limit: number): Promise<UcCandle[]> {
  const res: Record<UcPeriod, string> = { "1m": "1", "5m": "5", "15m": "15", "30m": "30", "60m": "60", "1d": "D", "1w": "W", "1M": "M" };
  const span: Record<UcPeriod, number> = { "1m": 3, "5m": 10, "15m": 20, "30m": 40, "60m": 80, "1d": Math.ceil(limit * 1.5) + 10, "1w": limit * 7 + 30, "1M": limit * 31 + 60 };
  const to = Math.floor(Date.now() / 1000), from = to - span[period] * 86400;
  const j = await getJson<any>(`https://dchart-api.vndirect.com.vn/dchart/history?symbol=${encodeURIComponent(code)}&resolution=${res[period]}&from=${from}&to=${to}`);
  const t: number[] = j?.t ?? [];
  // 越南股价以千越南盾计价
  return t.map((x, i) => ({ t: x * 1000, o: j.o[i] * 1000, h: j.h[i] * 1000, l: j.l[i] * 1000, c: j.c[i] * 1000, v: num(j.v?.[i]) })).filter((c) => c.c > 0).slice(-limit);
}
async function localKline(p: Parsed, period: UcPeriod, limit: number) {
  const l = localOf(p);
  if (!l) return [];
  return l.ex === "moex" ? moexKline(l.code, period, limit) : vnKline(l.code, period, limit);
}
async function localTicks(items: Array<{ symbol: string; parsed: Parsed }>) {
  const out = new Map<string, UcTick>();
  await Promise.all(items.filter((it) => localOf(it.parsed)).slice(0, 40).map(async (it) => {
    const k = await localKline(it.parsed, "1d", 5).catch(() => []);
    const a = k[k.length - 1], b = k[k.length - 2];
    if (!a) return;
    out.set(it.symbol, { symbol: it.symbol, name: displayName(it.symbol) ?? null, price: a.c, prevClose: b?.c ?? null, change: b ? a.c - b.c : null, changePct: b ? ((a.c - b.c) / b.c) * 100 : null, open: a.o, high: a.h, low: a.l, volume: a.v, amount: null, time: a.t });
  }));
  return out;
}

export async function getKline(symbol: string, period: UcPeriod, limit = 240): Promise<UcCandle[]> {
  const key = `${symbol}|${period}|${limit}`;
  const hit = klineCache.get(key);
  if (hit && Date.now() - hit.at < KLINE_TTL[period]) return hit.candles;
  const parsed = parseSymbol(symbol);
  const qq: [ProviderId, () => Promise<UcCandle[]>] = ["qq", () => qqKline(parsed, period, limit)];
  const yh: [ProviderId, () => Promise<UcCandle[]>] = ["yahoo", () => yahooKline(parsed, symbol, period, limit)];
  const local: [ProviderId, () => Promise<UcCandle[]>] = ["yahoo", () => localKline(parsed, period, limit)];
  const providers: Array<[ProviderId, () => Promise<UcCandle[]>]> = [
    ...(localOf(parsed) ? [local] : []),
    ...(parsed.kind === "cn" ? [qq, yh] : [yh, qq]),
    ["sina", () => sinaKline(parsed, period, limit)],
    ["em", () => emKline(parsed, period, limit)],
  ];
  for (const [id, fn] of providers) {
    if (!available(id)) continue;
    try {
      const candles = await fn();
      if (candles.length) {
        ok(id);
        const sorted = candles.sort((a, b) => a.t - b.t).slice(-limit);
        klineCache.set(key, { at: Date.now(), candles: sorted });
        archiveKline(symbol, period, sorted);
        if (klineCache.size > 600) klineCache.delete(klineCache.keys().next().value!);
        return sorted;
      }
    } catch (error) {
      fail(id, error);
    }
  }
  if (hit?.candles.length) return hit.candles;
  // 上游全部不可用：用平台自有库里的历史 K 线
  let saved = await loadKline(symbol, period, limit).catch(() => []);
  if (!saved.length) {
    const mins: Partial<Record<UcPeriod, number>> = { "1m": 1, "5m": 5, "15m": 15, "30m": 30, "60m": 60, "1d": 1440 };
    if (mins[period]) saved = await loadTickBars(symbol, mins[period]!, limit).catch(() => []);
  }
  if (saved.length) klineCache.set(key, { at: Date.now() - KLINE_TTL[period] / 2, candles: saved as UcCandle[] });
  return saved as UcCandle[];
}

/* ------------------------------------------------------------------ WEI 大屏的标的分组 */
export const WEI_BOARDS: Record<string, { label: string; symbols: string[] }> = {
  global: { label: "全球指数", symbols: ["^GSPC", "^IXIC", "^DJI", "^FTSE", "^GDAXI", "^FCHI", "^N225", "^HSI", "000001.SH", "399001.SZ", "000300.SH", "^KS11", "^TWII", "^BSESN", "^AXJO", "^STOXX50E"] },
  us: { label: "美股", symbols: ["^GSPC", "^IXIC", "^DJI", "^VIX", "SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "JPM", "BRK.B"] },
  cn: { label: "A股", symbols: ["000001.SH", "399001.SZ", "399006.SZ", "000300.SH", "000688.SH", "000905.SH", "600519.SH", "600036.SH", "000858.SZ", "300750.SZ", "601318.SH", "601899.SH", "600900.SH", "002594.SZ", "688981.SH", "601012.SH"] },
  hk: { label: "港股", symbols: ["^HSI", "^HSCE", "2800.HK", "0700.HK", "9988.HK", "3690.HK", "1299.HK", "2318.HK", "0005.HK", "0941.HK", "1810.HK", "9618.HK", "1211.HK", "0388.HK", "0883.HK", "2020.HK"] },
  eu: { label: "欧股", symbols: ["^FTSE", "^GDAXI", "^FCHI", "^STOXX50E", "ASML.AS", "SAP.DE", "SIE.DE", "ALV.DE", "MC.PA", "OR.PA", "TTE.PA", "SHEL.L", "AZN.L", "HSBA.L", "NESN.SW", "NOVO-B.CO"] },
  apac: { label: "亚太", symbols: ["^N225", "^KS11", "^TWII", "^BSESN", "^AXJO", "^STI", "7203.T", "6758.T", "9984.T", "005930.KS", "000660.KS", "2330.TW", "2317.TW", "RELIANCE.NS", "BHP.AX", "D05.SI"] },
  jp: { label: "日本", symbols: ["^N225", "7203.T", "6758.T", "9984.T", "8306.T", "6861.T", "9983.T", "8035.T", "6501.T", "4063.T", "7974.T", "6098.T", "8058.T", "9432.T", "4502.T", "7267.T"] },
  kr: { label: "韩国/台湾", symbols: ["^KS11", "^TWII", "005930.KS", "000660.KS", "373220.KS", "207940.KS", "005380.KS", "035420.KS", "2330.TW", "2317.TW", "2454.TW", "2308.TW", "2412.TW", "2882.TW", "3711.TW", "2303.TW"] },
  in: { label: "印度/东南亚", symbols: ["^BSESN", "^NSEI", "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "BHARTIARTL.NS", "^STI", "D05.SI", "O39.SI", "BBCA.JK", "1155.KL", "PTT.BK", "VCB.VN", "ALI.PS"] },
  am: { label: "美洲其他", symbols: ["^GSPTSE", "^BVSP", "^MXX", "RY.TO", "TD.TO", "SHOP.TO", "ENB.TO", "CNQ.TO", "VALE3.SA", "PETR4.SA", "ITUB4.SA", "WALMEX.MX", "AMXB.MX", "GFNORTEO.MX"] },
  mea: { label: "中东/大洋洲", symbols: ["^AXJO", "BHP.AX", "CBA.AX", "CSL.AX", "NAB.AX", "2222.SR", "1120.SR", "2010.SR", "FAB.AD", "EMAAR.DU", "TEVA.TA", "NICE.TA", "FPH.NZ", "AIA.NZ"] },
  futures: { label: "期货", symbols: ["ES", "NQ", "YM", "RTY", "NKD", "ZN", "GC", "SI", "CL", "BRENT", "NG", "HG"] },
  fx: { label: "外汇", symbols: ["DXY", "USDCNH", "USDCNY", "EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDHKD", "EURCNY", "BTC", "ETH"] },
  commodity: { label: "大宗商品", symbols: ["GC", "SI", "PL", "HG", "CL", "BRENT", "NG", "ZC", "ZS", "ZW"] },
  etf: { label: "基金/ETF", symbols: ["SPY", "QQQ", "EFA", "EEM", "2800.HK", "510300.SH", "510500.SH", "159915.SZ"] },
};

/**
 * 需求 1 / 需求 3：所有接口返回给前端的数据都不显示数据来源。
 *
 * 规则（仅对前端请求生效；管理员在管理后台里看到的仍是原始来源）：
 *  1. 来源类字段（source / provider / vendor / publisher / sourceFile …）的文字统一显示为「佑诚数据」
 *  2. 说明类字段（limitation / note / boundary / reason …）里出现的供应商名称替换为「佑诚」
 *  3. 链接、数值、日期、名称等业务字段原样保留，不影响任何功能
 */

const BRAND = "佑诚数据";

const SOURCE_KEY = /^(source|sources|sourceName|sourceLabel|sourceText|sourceType|sourceFile|sourceSheet|dataSource|dataSources|provider|providerName|providers|vendor|vendorName|publisher|origin|attribution|feed|feedName|license|licence|upstream|channel|dataProvider|sourceProvider|providerSymbolSource)$/i;
const NOTE_KEY = /^(limitation|limitations|sourceBoundary|boundary|updateBoundary|note|notes|sourceNote|disclaimer|reason|unavailableReason|footer|remark|coverage|coverageNote|methodology|provenance|lineage)$/i;

const VENDORS = new RegExp(
  [
    "Bloomberg", "彭博", "Tonghuashun\\s*iFinD(\\s*SDK)?", "iFinD(\\s*SDK)?", "同花顺", "Wind资讯", "万得", "Yahoo\\s*Finance", "Yahoo",
    "Nasdaq\\s*(public|Data\\s*Link|API|来源|公开源|公开)", "FRED", "ALFRED", "St\\.?\\s*Louis\\s*Fed", "AkShare", "akshare", "OpenBB", "Fincept\\w*",
    "东方财富", "Eastmoney", "EastMoney", "新浪财经", "新浪", "Sina", "腾讯财经", "Tencent", "Alpha\\s*Vantage", "Polygon(\\.io)?", "Finnhub",
    "Tushare", "Refinitiv", "LSEG", "Reuters", "路透", "Quandl", "CoinGecko", "Binance", "EODHD", "Twelve\\s*Data", "Financial\\s*Modeling\\s*Prep",
    "FMP", "Investing\\.com", "TradingEconomics", "Trading\\s*Economics", "Stooq", "Agent[-\\s]?Reach", "Jina\\s*Reader",
  ].join("|"),
  "gi",
);

function replaceVendors(text: string) {
  return text.replace(VENDORS, "佑诚").replace(/佑诚(\s*[·/、,，]\s*佑诚)+/g, "佑诚").replace(/佑诚\s+佑诚/g, "佑诚");
}

function isPlain(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function scrubSources(value: unknown, depth = 0): unknown {
  if (depth > 14) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const n = scrubSources(v, depth + 1);
      if (n !== v) changed = true;
      return n;
    });
    return changed ? out : value;
  }
  if (!isPlain(value)) return value;
  let out: Record<string, unknown> | null = null;
  for (const [key, v] of Object.entries(value)) {
    let next: unknown = v;
    if (typeof v === "string") {
      if (SOURCE_KEY.test(key)) next = /^https?:\/\//i.test(v) ? v : v.trim() ? BRAND : v;
      else if (NOTE_KEY.test(key)) next = replaceVendors(v);
    } else if (Array.isArray(v) && SOURCE_KEY.test(key) && v.every((x) => typeof x === "string")) {
      next = v.length ? [BRAND] : v;
    } else if (v && typeof v === "object") {
      next = scrubSources(v, depth + 1);
    }
    if (next !== v) {
      out ??= { ...value };
      out[key] = next;
    }
  }
  return out ?? value;
}

/** 管理员从管理后台发起的请求保留原始来源；其余请求一律抹掉。 */
export function shouldScrub(ctx: { user?: { role?: string | null } | null; req?: { headers?: Record<string, unknown> } }) {
  const referer = String(ctx.req?.headers?.referer ?? ctx.req?.headers?.referrer ?? "");
  const fromAdmin = /\/admin(\/|\?|$)/.test(referer.replace(/^https?:\/\/[^/]+/, ""));
  return !(ctx.user?.role === "admin" && fromAdmin);
}

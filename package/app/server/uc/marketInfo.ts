/**
 * 佑诚个股资料：盘前盘后、相关新闻（含利好 / 利空判断）、基本面（估值 + 财务）。
 * 返回内容不带任何数据来源字段。
 */
import { getJson, getText, num, parseSymbol, qqCode, usSessionOf, yahooChart, yahooCode, getTicks, displayName } from "./market";

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return value;
  } catch (error) {
    if (hit) return hit.value as T;
    throw error;
  }
}

/* ------------------------------------------------------------------ 盘前盘后 */
export type UcSession = {
  state: "pre" | "regular" | "post" | "closed";
  regular: { price: number | null; prevClose: number | null; time: number | null };
  pre: { price: number; change: number; changePct: number; time: number; high: number; low: number } | null;
  post: { price: number; change: number; changePct: number; time: number; high: number; low: number } | null;
};

export async function getSession(symbol: string): Promise<UcSession | null> {
  const parsed = parseSymbol(symbol);
  if (parsed.kind !== "us") return null;
  const y = yahooCode(parsed, symbol);
  if (!y) return null;
  return cached(`session|${y}`, 10_000, async () => {
    const { meta, candles } = await yahooChart(y, "1m", "1d", true);
    const now = Date.now() / 1000;
    const ctp = meta.currentTradingPeriod ?? {};
    const inP = (p: any) => p && now >= p.start && now < p.end;
    const state: UcSession["state"] = inP(ctp.pre) ? "pre" : inP(ctp.regular) ? "regular" : inP(ctp.post) ? "post" : "closed";
    const regularPrice = num(meta.regularMarketPrice);
    const prevClose = num(meta.chartPreviousClose) ?? num(meta.previousClose);
    const block = (s: "pre" | "post", base: number | null) => {
      const bars = candles.filter((c) => usSessionOf(c.t) === s);
      if (!bars.length || !base) return null;
      const last = bars[bars.length - 1];
      return {
        price: last.c,
        change: last.c - base,
        changePct: ((last.c - base) / base) * 100,
        time: last.t,
        high: Math.max(...bars.map((b) => b.h)),
        low: Math.min(...bars.map((b) => b.l)),
      };
    };
    const regularBars = candles.filter((c) => !usSessionOf(c.t));
    // 盘前还没开盘时 regularMarketPrice 就是上一交易日收盘
    const preBase = regularBars.length ? prevClose : regularPrice ?? prevClose;
    return {
      state,
      regular: { price: regularPrice, prevClose, time: num(meta.regularMarketTime) ? num(meta.regularMarketTime)! * 1000 : null },
      pre: block("pre", preBase),
      post: block("post", regularPrice),
    };
  });
}

/* ------------------------------------------------------------------ 新闻 */
export type UcNews = { id: string; title: string; summary: string | null; url: string | null; time: number; tone: 1 | 0 | -1; tags: string[] };

const POS = ["上涨", "大涨", "涨停", "增长", "超预期", "创新高", "利好", "回购", "增持", "上调", "盈利", "突破", "获批", "中标", "扭亏", "分红", "提振", "强劲", "看涨", "升级",
  "surge", "soar", "jump", "rally", "beat", "record high", "upgrade", "raise", "buyback", "gain", "bullish", "profit rise", "outperform", "approval", "strong"];
const NEG = ["下跌", "大跌", "跌停", "下滑", "不及预期", "亏损", "利空", "减持", "下调", "调查", "处罚", "诉讼", "裁员", "暴跌", "风险", "违约", "警告", "停产", "召回", "看跌", "降级",
  "plunge", "fall", "drop", "slump", "miss", "downgrade", "cut", "lawsuit", "probe", "loss", "bearish", "warning", "recall", "layoff", "decline", "weak", "tumble"];
const TAGS: Array<[string, RegExp]> = [
  ["业绩", /业绩|财报|营收|净利|季报|年报|earnings|revenue|quarter|profit/i],
  ["评级", /评级|目标价|上调|下调|rating|price target|upgrade|downgrade|analyst/i],
  ["政策", /政策|监管|央行|降息|加息|关税|fed|tariff|regulat|rate cut|rate hike/i],
  ["资金", /回购|增持|减持|分红|融资|募资|buyback|dividend|stake|offering/i],
  ["产品", /发布|新品|产品|芯片|模型|launch|product|chip|iphone|ai\b/i],
  ["并购", /收购|并购|合并|重组|acqui|merger|deal/i],
];

function toneOf(text: string): 1 | 0 | -1 {
  const t = text.toLowerCase();
  const p = POS.filter((w) => t.includes(w)).length;
  const n = NEG.filter((w) => t.includes(w)).length;
  return p > n ? 1 : n > p ? -1 : 0;
}
const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/\s+/g, " ").trim();

function parseRss(xml: string, stripSuffix: boolean) {
  const items: Array<{ title: string; url: string | null; summary: string | null; time: number }> = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const body = m[1];
    const pick = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(body);
      return r ? decode(r[1]) : "";
    };
    let title = pick("title");
    if (stripSuffix) title = title.replace(/\s+-\s+[^-]{1,40}$/, "");
    const summary = pick("description");
    const time = Date.parse(pick("pubDate")) || Date.now();
    if (title) items.push({ title, url: pick("link") || null, summary: summary && summary !== title && !stripSuffix ? summary.slice(0, 280) : null, time });
  }
  return items;
}

export async function getNews(symbol: string, nameHint?: string | null): Promise<UcNews[]> {
  const parsed = parseSymbol(symbol);
  const y = yahooCode(parsed, symbol);
  return cached(`news|${symbol}|${nameHint ?? ""}`, 120_000, async () => {
    let name = nameHint ?? displayName(symbol);
    if (!name || !/[一-龥]/.test(name)) {
      const t = (await getTicks([symbol], { budgetMs: 8_000 }).catch(() => ({} as Record<string, any>)))[symbol];
      if (t?.name) name = t.name;
    }
    const cjk = !!name && /[一-龥]/.test(name);
    const tasks: Array<Promise<Array<{ title: string; url: string | null; summary: string | null; time: number }>>> = [];
    // 中文新闻：按名称检索
    const q = cjk ? `${name}${["cn", "hk", "us", "intl"].includes(parsed.kind) ? " 股票" : ""}` : name ?? symbol;
    tasks.push(getText(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`, {}, "utf-8", 12_000).then((x) => parseRss(x, true)).catch(() => []));
    // 英文新闻：海外标的按代码检索（带摘要）
    if (y && parsed.kind !== "cn") {
      tasks.push(getText(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(y)}&region=US&lang=en-US`, {}, "utf-8", 10_000).then((x) => parseRss(x, false)).catch(() => []));
    }
    // 直连原文的检索（可在终端内读全文）：中文名称 + 英文代码 / 名称
    const bingUrl = (query: string, zh: boolean) => `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss${zh ? "&cc=cn" : ""}`;
    const bingParse = (x: string) => parseRss(x, false).map((r) => {
      const real = r.url && /bing\.com\/news\/apiclick/i.test(r.url) ? /[?&]url=([^&]+)/.exec(r.url)?.[1] : null;
      return { ...r, url: real ? decodeURIComponent(real) : r.url };
    });
    if (cjk) tasks.push(getText(bingUrl(q, true), {}, "utf-8", 12_000).then(bingParse).catch(() => []));
    if (parsed.kind !== "cn") tasks.push(getText(bingUrl(`${y ?? symbol} stock`, false), {}, "utf-8", 12_000).then(bingParse).catch(() => []));
    // 英文名称（海外个股常见）：按公司名再检索一次英文报道
    const enName = !cjk && name && name !== symbol ? name.replace(/\b(Inc|Corp|Corporation|Ltd|Limited|PLC|Co|Company|Holdings?|Group|SA|AG|NV|SE|ASA|AB|Oyj|Bhd|Tbk|PCL|JSC)\.?\b/gi, "").trim() : null;
    if (enName && enName.length > 2) {
      tasks.push(getText(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${enName}"`)}&hl=en-US&gl=US&ceid=US:en`, {}, "utf-8", 12_000).then((x) => parseRss(x, true)).catch(() => []));
      tasks.push(getText(bingUrl(`"${enName}"`, false), {}, "utf-8", 12_000).then(bingParse).catch(() => []));
    }
    // 上市地本地语言新闻（日 / 韩 / 台 / 港 / 欧洲 / 东南亚 / 中东 / 拉美 等）
    const suffix = (y ?? "").split(".").pop()?.toUpperCase() ?? "";
    const LOCALE: Record<string, [string, string]> = { T: ["ja", "JP"], KS: ["ko", "KR"], KQ: ["ko", "KR"], TW: ["zh-TW", "TW"], TWO: ["zh-TW", "TW"], HK: ["zh-HK", "HK"], L: ["en-GB", "GB"], DE: ["de", "DE"], F: ["de", "DE"], PA: ["fr", "FR"], MI: ["it", "IT"], MC: ["es", "ES"], AS: ["nl", "NL"], SW: ["de", "CH"], ST: ["sv", "SE"], CO: ["da", "DK"], OL: ["no", "NO"], HE: ["fi", "FI"], SA: ["pt-BR", "BR"], MX: ["es-419", "MX"], TO: ["en-CA", "CA"], AX: ["en-AU", "AU"], NS: ["en-IN", "IN"], BO: ["en-IN", "IN"], JK: ["id", "ID"], KL: ["ms", "MY"], BK: ["th", "TH"], VN: ["vi", "VN"], SI: ["en-SG", "SG"], TA: ["he", "IL"], SR: ["ar", "SA"], AD: ["ar", "AE"], DU: ["ar", "AE"], ME: ["ru", "RU"], PS: ["en-PH", "PH"], NZ: ["en-NZ", "NZ"], LS: ["pt-PT", "PT"], VI: ["de", "AT"], IR: ["en-IE", "IE"], WA: ["pl", "PL"] };
    const loc = LOCALE[suffix];
    if (loc && parsed.kind !== "cn") {
      const base = (y ?? symbol).split(".")[0];
      const lq = enName ? `"${enName}" OR ${base}` : base;
      tasks.push(getText(`https://news.google.com/rss/search?q=${encodeURIComponent(lq)}&hl=${loc[0]}&gl=${loc[1]}&ceid=${loc[1]}:${loc[0].split("-")[0]}`, {}, "utf-8", 12_000).then((x) => parseRss(x, true)).catch(() => []));
    }
    // A股：再补一路英文代码检索与雅虎个股新闻
    if (parsed.kind === "cn" && y) tasks.push(getText(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(y)}&region=US&lang=en-US`, {}, "utf-8", 10_000).then((x) => parseRss(x, false)).catch(() => []));
    // A股：上市公司公告（全文可在终端内阅读）
    if (parsed.kind === "cn") {
      const code6 = /(\d{6})/.exec(symbol)?.[1];
      if (code6) tasks.push(getText(`https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=40&page_index=1&ann_type=A&stock_list=${code6}`, {}, "utf-8", 12_000).then((x) => {
        const list: any[] = JSON.parse(x)?.data?.list ?? [];
        return list.map((a) => ({ title: `【公告】${String(a.title ?? a.title_ch ?? "").trim()}`, url: `https://np-cnotice-stock.eastmoney.com/api/content/ann?art_code=${a.art_code}&client_source=web&page_index=1`, summary: (a.columns ?? []).map((c: any) => c.column_name).filter(Boolean).join(" · ") || null, time: Date.parse(String(a.notice_date ?? a.display_time ?? "").slice(0, 19).replace(" ", "T") + "+08:00") || Date.now() })).filter((a) => a.title.length > 4);
      }).catch(() => []));
    }
    // 中文财经快讯与深度：按名称检索（全文可读）
    if (cjk && name) {
      tasks.push(getText(`https://api-one-wscn.awtmt.com/apiv1/search/article?query=${encodeURIComponent(name.replace(/[-－].*$/, "").slice(0, 12))}&cursor=&limit=30`, {}, "utf-8", 12_000).then((x) => {
        const items: any[] = JSON.parse(x)?.data?.items ?? [];
        return items.map((a) => ({ title: String(a.title ?? "").replace(/<[^>]+>/g, ""), url: a.uri ? String(a.uri).replace(/\?keyword=.*$/, "") : a.id ? `https://wallstreetcn.com/articles/${a.id}` : null, summary: a.content_short ? String(a.content_short).replace(/<[^>]+>/g, "").slice(0, 300) : null, time: (Number(a.display_time) || 0) * 1000 || Date.now() })).filter((a) => a.title);
      }).catch(() => []));
    }
    // 美股：按代码的个股新闻
    if (parsed.kind === "us") {
      const tk = (y ?? symbol).toLowerCase();
      tasks.push(getText(`https://www.nasdaq.com/api/news/topic/articlebysymbol?q=${encodeURIComponent(tk)}|stocks&offset=0&limit=40&fallback=true`, {}, "utf-8", 12_000).then((x) => {
        const rows: any[] = JSON.parse(x)?.data?.rows ?? [];
        return rows.map((a) => ({ title: String(a.title ?? "").trim(), url: a.url ? (String(a.url).startsWith("http") ? a.url : `https://www.nasdaq.com${a.url}`) : null, summary: a.publisher ? `${a.publisher}` : null, time: Date.parse(String(a.created ?? "")) || Date.now() })).filter((a) => a.title);
      }).catch(() => []));
    }
    // 平台新闻库里已识别到该标的的新闻（含历史）
    tasks.push(import("./news").then((m) => m.queryNewsDeep({ symbol, limit: 80, hours: 24 * 60 })).then((list) => list.map((n) => ({ title: n.title, url: n.url, summary: n.summary, time: n.time }))).catch(() => []));
    const all = (await Promise.all(tasks)).flat();
    const seen = new Set<string>();
    const out: UcNews[] = [];
    for (const it of all.sort((a, b) => b.time - a.time)) {
      const key = it.title.toLowerCase().replace(/[\s\p{P}]/gu, "").slice(0, 40);
      if (seen.has(key)) {
        const prev = out.find((o) => o.title.toLowerCase().replace(/[\s\p{P}]/gu, "").slice(0, 40) === key);
        if (prev && prev.url?.includes("news.google.com") && it.url && !it.url.includes("news.google.com")) prev.url = it.url;
        continue;
      }
      seen.add(key);
      const text = `${it.title} ${it.summary ?? ""}`;
      out.push({
        id: `${it.time}-${out.length}`,
        title: it.title,
        summary: it.summary,
        url: it.url,
        time: it.time,
        tone: toneOf(text),
        tags: TAGS.filter(([, re]) => re.test(text)).map(([t]) => t),
      });
      if (out.length >= 200) break;
    }
    // 只保留能在终端内读到正文的：聚合跳转链接且没有摘要的，在直连报道足够时去掉
    const readable = out.filter((n) => (n.url && !n.url.includes("news.google.com")) || (n.summary && n.summary.length > 40));
    void import("./warehouse").then((w) => {
      w.archiveNews(out.map((n) => {
        const id = `s${Math.abs([...(n.url ?? n.title)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`;
        return { id, cluster: id, title: n.title.slice(0, 390), summary: n.summary, url: n.url, time: n.time, lang: /[一-龥]/.test(n.title) ? "zh" : "en", region: "", cats: [], tone: n.tone, toneScore: 0, tickers: [symbol], kind: "article", feed: "symbol" };
      }));
    }).catch(() => undefined);
    return readable.length >= 8 ? readable : out;
  });
}

/* ------------------------------------------------------------------ 基本面 */
export type UcProfile = {
  symbol: string;
  name: string | null;
  currency: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  metrics: Array<{ key: string; label: string; value: number | null; unit?: string }>;
  financials: Array<{ label: string; unit: string; points: Array<{ period: string; value: number }> }>;
};

const SECTOR_CN: Record<string, string> = {
  Technology: "科技", "Financial Services": "金融", Healthcare: "医疗健康", "Consumer Cyclical": "可选消费", "Consumer Defensive": "必需消费", Industrials: "工业",
  "Communication Services": "通信服务", Energy: "能源", "Basic Materials": "原材料", "Real Estate": "房地产", Utilities: "公用事业",
};

export async function getProfile(symbol: string): Promise<UcProfile | null> {
  const parsed = parseSymbol(symbol);
  const y = yahooCode(parsed, symbol);
  return cached(`profile|${symbol}`, 30 * 60_000, async () => {
    const profile: UcProfile = { symbol, name: displayName(symbol), currency: null, exchange: null, sector: null, industry: null, metrics: [], financials: [] };
    const push = (key: string, label: string, value: number | null, unit?: string) => {
      if (value != null && Number.isFinite(value) && !profile.metrics.some((m) => m.key === key)) profile.metrics.push({ key, label, value, unit });
    };
    const jobs: Array<Promise<void>> = [];

    const qc = qqCode(parsed);
    if (qc) jobs.push((async () => {
      const text = await getText(`https://qt.gtimg.cn/q=${qc}`, { Referer: "https://gu.qq.com/" }, "gbk");
      const m = /="([^"]*)"/.exec(text);
      const f = m?.[1].split("~") ?? [];
      if (f.length < 46) return;
      if (!profile.name && f[1]) profile.name = f[1];
      push("pe", "市盈率(TTM)", num(f[39]));
      if (parsed.kind === "cn") push("pb", "市净率", num(f[46]));
      if (parsed.kind === "us") push("eps", "每股收益", num(f[47]));
      push("mcap", "总市值", num(f[45]) != null ? num(f[45])! * 1e8 : null);
      push("float", "流通市值", num(f[44]) != null ? num(f[44])! * 1e8 : null);
      push("turnover", "换手率", num(f[38]), "%");
      push("amplitude", "振幅", num(f[43]), "%");
      if (parsed.kind === "cn") {
        push("limitUp", "涨停价", num(f[47]));
        push("limitDown", "跌停价", num(f[48]));
      }
    })().catch(() => undefined));

    if (y) {
      jobs.push((async () => {
        const { meta } = await yahooChart(y, "1d", "1d");
        profile.currency = meta.currency ?? null;
        profile.exchange = meta.fullExchangeName ?? meta.exchangeName ?? null;
        if (!profile.name) profile.name = meta.longName ?? meta.shortName ?? null;
        push("high52", "52周最高", num(meta.fiftyTwoWeekHigh));
        push("low52", "52周最低", num(meta.fiftyTwoWeekLow));
      })().catch(() => undefined));
      if (["us", "hk", "cn", "intl"].includes(parsed.kind)) {
        jobs.push((async () => {
          const json = await getJson<any>(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(y)}&newsCount=0&quotesCount=1`);
          const q = (json?.quotes ?? []).find((x: any) => String(x.symbol).toUpperCase() === y.toUpperCase()) ?? json?.quotes?.[0];
          if (q?.sector) profile.sector = SECTOR_CN[q.sector] ?? q.sector;
          if (q?.industry) profile.industry = q.industry;
          if (!profile.name) profile.name = q?.longname ?? q?.shortname ?? null;
        })().catch(() => undefined));
        jobs.push((async () => {
          const types = ["trailingPeRatio", "trailingPbRatio", "trailingPsRatio", "trailingMarketCap", "annualTotalRevenue", "annualNetIncome", "annualDilutedEPS", "annualFreeCashFlow", "annualGrossProfit", "quarterlyTotalRevenue", "quarterlyNetIncome"];
          const p2 = Math.floor(Date.now() / 1000) + 86400;
          const json = await getJson<any>(`https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(y)}?type=${types.join(",")}&period1=${p2 - 6 * 365 * 86400}&period2=${p2}`);
          const series = new Map<string, Array<{ period: string; value: number }>>();
          for (const r of json?.timeseries?.result ?? []) {
            const type = r?.meta?.type?.[0];
            const arr: any[] = r?.[type] ?? [];
            const pts = arr.filter((x) => x?.reportedValue?.raw != null).map((x) => ({ period: String(x.asOfDate), value: Number(x.reportedValue.raw) }));
            if (type && pts.length) series.set(type, pts);
          }
          const lastOf = (t: string) => series.get(t)?.at(-1)?.value ?? null;
          push("pe", "市盈率(TTM)", lastOf("trailingPeRatio"));
          push("pb", "市净率", lastOf("trailingPbRatio"));
          push("ps", "市销率", lastOf("trailingPsRatio"));
          push("mcap", "总市值", lastOf("trailingMarketCap"));
          const rev = series.get("annualTotalRevenue");
          const ni = series.get("annualNetIncome");
          if (rev?.length && ni?.length) {
            const r = rev.at(-1)!.value;
            const n = ni.at(-1)!.value;
            if (r) push("margin", "净利率", (n / r) * 100, "%");
            if (rev.length >= 2 && rev.at(-2)!.value) push("revYoY", "营收同比", ((r - rev.at(-2)!.value) / Math.abs(rev.at(-2)!.value)) * 100, "%");
            if (ni.length >= 2 && ni.at(-2)!.value) push("niYoY", "净利同比", ((n - ni.at(-2)!.value) / Math.abs(ni.at(-2)!.value)) * 100, "%");
          }
          const fin: Array<[string, string, string]> = [
            ["annualTotalRevenue", "年度营收", "money"],
            ["annualNetIncome", "年度净利润", "money"],
            ["annualGrossProfit", "年度毛利", "money"],
            ["annualFreeCashFlow", "自由现金流", "money"],
            ["annualDilutedEPS", "每股收益(摊薄)", "per"],
            ["quarterlyTotalRevenue", "季度营收", "money"],
            ["quarterlyNetIncome", "季度净利润", "money"],
          ];
          for (const [t, label, unit] of fin) {
            const pts = series.get(t);
            if (pts?.length) profile.financials.push({ label, unit, points: pts.slice(-8) });
          }
        })().catch(() => undefined));
      }
    }
    await Promise.all(jobs);
    const order = ["mcap", "float", "pe", "pb", "ps", "eps", "margin", "revYoY", "niYoY", "turnover", "amplitude", "high52", "low52", "limitUp", "limitDown"];
    profile.metrics.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    return profile.metrics.length || profile.financials.length ? profile : null;
  });
}


/** 批量盘前盘后（美股）：行情表里每只美股都显示盘前 / 盘后价 */
export async function getSessions(symbols: string[]) {
  const list = [...new Set(symbols)].filter((s) => parseSymbol(s).kind === "us").slice(0, 60);
  const out: Record<string, UcSession | null> = {};
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(list.slice(i, i + 8).map(async (s) => {
      out[s] = await getSession(s).catch(() => null);
    }));
  }
  return out;
}

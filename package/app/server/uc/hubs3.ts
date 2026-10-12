/**
 * 第三批数据：终端小窗功能（抵押债 / 优先股 / 法律与政府）所需的官方公开数据。
 *  - 美联储机构抵押债操作（TBA 买卖结果）、美联储资产负债表持仓（抵押债 / 商业抵押债 / 国债）
 *  - 美国证监会电子披露全文检索（破产、优先股赎回、证券化发行等公告）
 *  - 法院案卷与判决检索、联邦公报（法规 / 拟议法规 / 总统文件）及其统计
 *  - 联邦支出：机构预算与执行、大额合同、各州支出
 *  - 监管机构新闻稿
 *  - 平台自身运行指标（接口调用、延迟、数据仓库、行情线路健康）
 * 均不返回来源字段；获取到的数据同时写入平台自有库。
 */
import os from "node:os";
import { getJson, getText, marketHealth, num } from "./market";
import { saveSeries } from "./hubs2";

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 800) cache.delete(cache.keys().next().value!);
    return value;
  } catch (error) {
    if (hit) return hit.value as T;
    throw error;
  }
}
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => dayStr(new Date(Date.now() - n * 86400_000));

/* ------------------------------------------------------------------ 美联储机构抵押债操作 */
export async function ambsOperations() {
  return cached("ambs", 30 * 60_000, async () => {
    const j = JSON.parse(await getText("https://markets.newyorkfed.org/api/ambs/all/results/details/last/40.json", {}, "utf-8", 25000).catch(() => getText("https://markets.newyorkfed.org/api/ambs/all/results/summary/last/40.json", {}, "utf-8", 25000)));
    const list: any[] = j?.ambs?.auctions ?? [];
    return list.map((a) => ({
      id: String(a.operationId ?? ""), date: String(a.operationDate ?? ""), type: String(a.operationType ?? ""), direction: a.operationDirection === "S" ? "卖出" : "买入",
      method: String(a.method ?? ""), classType: String(a.classType ?? ""), status: String(a.auctionStatus ?? ""),
      submitted: num(a.totalAmtSubmittedPar) ?? num(a.totalSubmittedOrigFace), accepted: num(a.totalAmtAcceptedPar) ?? num(a.totalAcceptedOrigFace), settle: String(a.settlementDate ?? ""),
      details: (a.details ?? []).map((d: any) => ({ security: String(d.securityDescription ?? ""), cusip: String(d.cusip ?? ""), accepted: num(d.amtAcceptedPar ?? d.acceptedOrigFace), submitted: num(d.amtSubmittedPar ?? d.submittedOrigFace), weightedPrice: num(d.weightedAvgPrice ?? d.inclusionWeightedAvgPrice), leastFavorable: num(d.leastFavResultPrice ?? d.leastFavorablePrice) })),
    }));
  });
}

/** 美联储资产负债表持仓（周度），2015 年至今 */
export async function somaHoldings() {
  return cached("soma", 6 * 3600_000, async () => {
    const j = JSON.parse(await getText("https://markets.newyorkfed.org/api/soma/summary.json", {}, "utf-8", 30000));
    const rows = ((j?.soma?.summary ?? []) as any[]).filter((r) => String(r.asOfDate) >= "2015-01-01").map((r) => ({
      d: String(r.asOfDate), mbs: (num(r.mbs) ?? 0) / 1e9, cmbs: (num(r.cmbs) ?? 0) / 1e9, notes: (num(r.notesbonds) ?? 0) / 1e9, bills: (num(r.bills) ?? 0) / 1e9, tips: (num(r.tips) ?? 0) / 1e9, agencies: (num(r.agencies) ?? 0) / 1e9, total: (num(r.total) ?? 0) / 1e9,
    }));
    void saveSeries(rows.slice(-8).flatMap((r) => [{ series: "soma:mbs", d: r.d, v: r.mbs }, { series: "soma:total", d: r.d, v: r.total }]));
    return rows;
  });
}

/* ------------------------------------------------------------------ 证监会电子披露全文检索 */
export type Filing = { id: string; company: string; ticker: string | null; form: string; date: string; items: string[]; state: string | null; sic: string | null; url: string };
export async function edgarSearch(q: string, forms: string[], days: number) {
  const key = `edgar:${q}:${forms.join(",")}:${days}`;
  return cached(key, 20 * 60_000, async () => {
    const u = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}${forms.length ? `&forms=${encodeURIComponent(forms.join(","))}` : ""}&dateRange=custom&startdt=${daysAgo(days)}&enddt=${dayStr(new Date())}`;
    const j = await getJson<any>(u);
    const hits: any[] = j?.hits?.hits ?? [];
    const seen = new Set<string>();
    const out: Filing[] = [];
    for (const h of hits) {
      const s = h._source ?? {};
      const [adsh, file] = String(h._id ?? "").split(":");
      if (!adsh || seen.has(adsh)) continue;
      seen.add(adsh);
      const name = String(s.display_names?.[0] ?? "");
      const m = /^(.*?)\s*(?:\(([A-Z0-9.\-, ]+)\))?\s*\(CIK (\d+)\)/.exec(name);
      const cik = String(Number(s.ciks?.[0] ?? m?.[3] ?? 0));
      out.push({ id: adsh, company: (m?.[1] ?? name).trim(), ticker: m?.[2]?.split(",")[0]?.trim() ?? null, form: String(s.form ?? s.file_type ?? ""), date: String(s.file_date ?? ""), items: s.items ?? [], state: s.biz_states?.[0] ?? null, sic: s.sics?.[0] ?? null, url: `https://www.sec.gov/Archives/edgar/data/${cik}/${adsh.replace(/-/g, "")}/${file}` });
    }
    return { total: Number(j?.hits?.total?.value ?? out.length), rows: out.sort((a, b) => b.date.localeCompare(a.date)) };
  });
}

/* ------------------------------------------------------------------ 法院案卷与判决 */
export async function courtSearch(q: string, type: "r" | "o", days: number) {
  return cached(`court:${q}:${type}:${days}`, 20 * 60_000, async () => {
    const j = await getJson<any>(`https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(q)}&type=${type}&order_by=dateFiled%20desc&filed_after=${daysAgo(days)}`);
    return {
      total: Number(j?.count ?? 0),
      rows: ((j?.results ?? []) as any[]).slice(0, 60).map((r) => ({
        id: String(r.docket_id ?? r.cluster_id ?? r.id ?? Math.abs(hash(String(r.caseName)))),
        caseName: String(r.caseName ?? r.caseNameFull ?? ""), court: String(r.court ?? r.court_id ?? ""), courtId: String(r.court_id ?? ""), date: String(r.dateFiled ?? ""),
        docket: String(r.docketNumber ?? ""), nature: r.suitNature ? String(r.suitNature) : null, cause: r.cause ? String(r.cause) : null, judge: r.judge || r.assignedTo || null,
        snippet: String(r.opinions?.[0]?.snippet ?? r.snippet ?? "").replace(/<[^>]+>/g, "").slice(0, 400),
        url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : r.docket_absolute_url ? `https://www.courtlistener.com${r.docket_absolute_url}` : null,
      })),
    };
  });
}
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

/** 多个主题在同一时间窗内的案件数量（用于实践领域 / 诉讼概况） */
export async function courtCounts(topics: Array<[string, string]>, days: number) {
  return cached(`courtcounts:${topics.map((t) => t[0]).join(",")}:${days}`, 3600_000, async () => {
    const res = await Promise.all(topics.map(async ([k, q]) => {
      try {
        const j = await getJson<any>(`https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(q)}&type=r&filed_after=${daysAgo(days)}`);
        return { key: k, count: Number(j?.count ?? 0) };
      } catch {
        return { key: k, count: null };
      }
    }));
    const d = dayStr(new Date());
    void saveSeries(res.filter((r) => r.count != null).map((r) => ({ series: `court:${r.key}:${days}d`, d, v: r.count! })));
    return res;
  });
}

/* ------------------------------------------------------------------ 联邦公报 */
const FR_TYPE: Record<string, string> = { RULE: "最终法规", PRORULE: "拟议法规", NOTICE: "公告", PRESDOCU: "总统文件" };
export async function fedRegister(opts: { agency?: string; type?: string; q?: string; per?: number }) {
  const per = Math.min(opts.per ?? 40, 100);
  return cached(`fr:${JSON.stringify(opts)}`, 20 * 60_000, async () => {
    const p = new URLSearchParams({ per_page: String(per), order: "newest" });
    for (const f of ["title", "type", "abstract", "document_number", "html_url", "publication_date", "agencies", "significant", "effective_on", "comments_close_on"]) p.append("fields[]", f);
    if (opts.agency) p.append("conditions[agencies][]", opts.agency);
    if (opts.type) p.append("conditions[type][]", opts.type);
    if (opts.q) p.set("conditions[term]", opts.q);
    const j = await getJson<any>(`https://www.federalregister.gov/api/v1/documents.json?${p.toString()}`);
    return ((j?.results ?? []) as any[]).map((d) => ({
      id: String(d.document_number), title: String(d.title ?? ""), type: FR_TYPE[String(d.type ?? "").toUpperCase().replace(/\s/g, "")] ?? String(d.type ?? ""),
      abstract: d.abstract ? String(d.abstract) : null, date: String(d.publication_date ?? ""), agencies: ((d.agencies ?? []) as any[]).map((a) => String(a.name ?? a.raw_name ?? "")).filter(Boolean),
      significant: !!d.significant, effective: d.effective_on ?? null, commentsClose: d.comments_close_on ?? null, url: String(d.html_url ?? ""),
    }));
  });
}
export async function fedRegisterStats(days: number) {
  return cached(`frstats:${days}`, 3 * 3600_000, async () => {
    const since = daysAgo(days);
    const [types, agencies, ...weekly] = await Promise.all([
      getJson<any>(`https://www.federalregister.gov/api/v1/documents/facets/type?conditions[publication_date][gte]=${since}`),
      getJson<any>(`https://www.federalregister.gov/api/v1/documents/facets/agency?conditions[publication_date][gte]=${since}`),
      ...["RULE", "PRORULE", "PRESDOCU"].map((t) => getJson<any>(`https://www.federalregister.gov/api/v1/documents/facets/weekly?conditions[type][]=${t}&conditions[publication_date][gte]=${daysAgo(Math.max(days, 182))}`)),
    ]);
    const wk = (o: any) => Object.entries(o ?? {}).map(([d, v]: [string, any]) => ({ d, n: Number(v?.count ?? 0) })).sort((a, b) => a.d.localeCompare(b.d));
    return {
      types: Object.entries(types ?? {}).map(([k, v]: [string, any]) => ({ key: k, name: FR_TYPE[k] ?? v?.name ?? k, count: Number(v?.count ?? 0) })),
      agencies: Object.entries(agencies ?? {}).map(([k, v]: [string, any]) => ({ key: k, name: String(v?.name ?? k), count: Number(v?.count ?? 0) })).sort((a, b) => b.count - a.count).slice(0, 40),
      weekly: { rule: wk(weekly[0]), proposed: wk(weekly[1]), presidential: wk(weekly[2]) },
    };
  });
}

/* ------------------------------------------------------------------ 联邦支出 */
export async function spendingAgencies() {
  return cached("spend:agencies", 12 * 3600_000, async () => {
    const j = await getJson<any>("https://api.usaspending.gov/api/v2/references/toptier_agencies/");
    const rows = ((j?.results ?? []) as any[]).map((a) => ({ code: String(a.toptier_code), name: String(a.agency_name), abbr: String(a.abbreviation ?? ""), fy: String(a.active_fy ?? ""), budget: num(a.budget_authority_amount) ?? 0, obligated: num(a.obligated_amount) ?? 0, outlay: num(a.outlay_amount) ?? 0, share: (num(a.percentage_of_total_budget_authority) ?? 0) * 100 }))
      .filter((a) => a.budget > 0).sort((a, b) => b.budget - a.budget);
    return rows;
  });
}
export async function spendingAgencyTrend(code: string) {
  return cached(`spend:trend:${code}`, 12 * 3600_000, async () => {
    const j = await getJson<any>(`https://api.usaspending.gov/api/v2/agency/${encodeURIComponent(code)}/budgetary_resources/`);
    return ((j?.agency_data_by_year ?? []) as any[]).filter((y) => y.agency_budgetary_resources).map((y) => ({ fy: Number(y.fiscal_year), resources: num(y.agency_budgetary_resources), obligated: num(y.agency_total_obligated), outlayed: num(y.agency_total_outlayed), periods: ((y.agency_obligation_by_period ?? []) as any[]).map((p) => ({ p: Number(p.period), v: num(p.obligated) })) })).sort((a, b) => a.fy - b.fy);
  });
}
async function usaPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`https://api.usaspending.gov${path}`, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}
export async function spendingAwards(days: number, kind: "contracts" | "grants") {
  return cached(`spend:awards:${kind}:${days}`, 6 * 3600_000, async () => {
    const codes = kind === "contracts" ? ["A", "B", "C", "D"] : ["02", "03", "04", "05"];
    const j = await usaPost<any>("/api/v2/search/spending_by_award/", { filters: { award_type_codes: codes, time_period: [{ start_date: daysAgo(days), end_date: dayStr(new Date()) }] }, fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Awarding Sub Agency", "Start Date", "End Date", "Description", "NAICS"], sort: "Award Amount", order: "desc", limit: 60, page: 1 });
    return ((j?.results ?? []) as any[]).map((r) => ({ id: String(r["Award ID"] ?? r.internal_id), recipient: String(r["Recipient Name"] ?? ""), amount: num(r["Award Amount"]) ?? 0, agency: String(r["Awarding Agency"] ?? ""), sub: String(r["Awarding Sub Agency"] ?? ""), start: String(r["Start Date"] ?? ""), end: String(r["End Date"] ?? ""), desc: String(r.Description ?? "").slice(0, 240), naics: r.NAICS?.description ?? (typeof r.NAICS === "string" ? r.NAICS : null) }));
  });
}
export async function spendingByState(days: number) {
  return cached(`spend:geo:${days}`, 12 * 3600_000, async () => {
    const j = await usaPost<any>("/api/v2/search/spending_by_geography/", { scope: "place_of_performance", geo_layer: "state", filters: { time_period: [{ start_date: daysAgo(days), end_date: dayStr(new Date()) }] } });
    return ((j?.results ?? []) as any[]).map((r) => ({ code: String(r.shape_code ?? ""), name: String(r.display_name ?? ""), amount: num(r.aggregated_amount) ?? 0, population: num(r.population), perCapita: num(r.per_capita) })).filter((r) => r.code).sort((a, b) => b.amount - a.amount);
  });
}

/* ------------------------------------------------------------------ 监管机构新闻稿 */
const PRESS: Array<[string, string, string]> = [
  ["sec", "证券监管", "https://www.sec.gov/news/pressreleases.rss"],
  ["fed", "美联储", "https://www.federalreserve.gov/feeds/press_all.xml"],
  ["cfpb", "消费者金融保护", "https://www.consumerfinance.gov/about-us/newsroom/feed/"],
  ["fedenf", "美联储执法", "https://www.federalreserve.gov/feeds/press_enforcement.xml"],
  ["fedbank", "美联储银行监管", "https://www.federalreserve.gov/feeds/press_bcreg.xml"],
  ["fedmon", "美联储货币政策", "https://www.federalreserve.gov/feeds/press_monetary.xml"],
];
function rssItems(xml: string) {
  const out: Array<{ title: string; link: string; date: number; desc: string }> = [];
  const strip = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const it = m[0];
    const g = (tag: string) => { const x = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(it); return x ? strip(x[1]) : ""; };
    const t = Date.parse(g("pubDate") || g("dc:date"));
    out.push({ title: g("title"), link: g("link") || (/<link[^>]+href="([^"]+)"/.exec(it)?.[1] ?? ""), date: Number.isFinite(t) ? t : 0, desc: g("description").slice(0, 400) });
  }
  return out;
}
export async function regulatorPress(keys?: string[]) {
  const list = PRESS.filter(([k]) => !keys?.length || keys.includes(k));
  return cached(`press:${list.map((p) => p[0]).join(",")}`, 15 * 60_000, async () => {
    const res = await Promise.all(list.map(async ([k, label, url]) => {
      try {
        return rssItems(await getText(url, {}, "utf-8", 20000)).map((x) => ({ ...x, id: `${k}:${hash(x.link || x.title)}`, ch: k, label }));
      } catch {
        return [];
      }
    }));
    const seen = new Set<string>();
    return res.flat().filter((x) => x.title && !seen.has(x.title) && seen.add(x.title)).sort((a, b) => b.date - a.date).slice(0, 200);
  });
}

/* ------------------------------------------------------------------ 平台运行指标（接口调用统计由 http 中间件写入） */
const apiStats = new Map<string, { n: number; err: number; ms: number; max: number; last: number }>();
const minuteHits: number[] = new Array(60).fill(0);
let minuteIdx = Math.floor(Date.now() / 60000);
export function recordApi(path: string, ms: number, ok: boolean) {
  const names = path.split(",").map((p) => p.replace(/^\/+/, "")).filter(Boolean);
  for (const name of names) {
    const s = apiStats.get(name) ?? { n: 0, err: 0, ms: 0, max: 0, last: 0 };
    s.n++;
    if (!ok) s.err++;
    s.ms += ms;
    s.max = Math.max(s.max, ms);
    s.last = Date.now();
    apiStats.set(name, s);
  }
  const m = Math.floor(Date.now() / 60000);
  while (minuteIdx < m) { minuteIdx++; minuteHits[minuteIdx % 60] = 0; }
  minuteHits[m % 60] += names.length || 1;
}
const AREA: Array<[RegExp, string]> = [[/^ucMarket/, "行情"], [/^ucNews/, "新闻资讯"], [/^ucHubs/, "专业数据"], [/^ucAdmin|^admin/, "后台管理"], [/^auth/, "账户"], [/./, "其他"]];
export async function platformStats() {
  const { warehouseStats } = await import("./warehouse");
  const { feedHealthReport } = await import("./news");
  const { ucStreamClientCount } = await import("./stream");
  const wh = await warehouseStats().catch(() => null);
  const { warmLog } = await import("./warm");
  const feeds = feedHealthReport();
  const mh = marketHealth();
  const now = Date.now();
  const lines = Object.values(mh).map((h: any, i) => ({ line: `行情线路 ${String.fromCharCode(65 + i)}`, ok: !h.paused, lastOkSec: h.lastOk ? Math.round((now - h.lastOk) / 1000) : null, fails: h.fails }));
  const procs = [...apiStats.entries()].filter(([k]) => !/^ucAdmin|^admin/.test(k)).map(([k, s]) => ({ name: k.replace(/^uc/, ""), area: AREA.find(([re]) => re.test(k))![1], n: s.n, err: s.err, avg: s.n ? s.ms / s.n : 0, max: s.max, lastSec: Math.round((now - s.last) / 1000) })).sort((a, b) => b.n - a.n);
  const areas = Object.values(procs.reduce<Record<string, { area: string; n: number; ms: number; err: number }>>((acc, p) => { const a = (acc[p.area] ??= { area: p.area, n: 0, ms: 0, err: 0 }); a.n += p.n; a.ms += p.avg * p.n; a.err += p.err; return acc; }, {})).map((a) => ({ ...a, avg: a.n ? a.ms / a.n : 0 }));
  const cur = Math.floor(now / 60000);
  const perMinute = Array.from({ length: 60 }, (_, i) => minuteHits[(cur - 59 + i + 600) % 60] ?? 0);
  const mem = process.memoryUsage();
  return {
    uptimeSec: Math.round(process.uptime()), node: process.version, cpus: os.cpus().length, load: os.loadavg(), sysMemTotal: os.totalmem(), sysMemFree: os.freemem(),
    rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, streamClients: ucStreamClientCount(), cacheEntries: cache.size,
    warehouse: wh, feeds: { total: feeds.length, online: feeds.filter((f: any) => f.lastOk && now - f.lastOk < 3 * 3600_000).length, items: feeds.reduce((s: number, f: any) => s + (f.count ?? 0), 0) },
    lines, procs: procs.slice(0, 40), areas, perMinute, warm: warmLog.slice(-8).reverse(),
  };
}

/* ------------------------------------------------------------------ 全球证券检索 */
const QTYPE: Record<string, string> = { EQUITY: "股票", ETF: "基金/ETF", INDEX: "指数", FUTURE: "期货", CURRENCY: "外汇", CRYPTOCURRENCY: "加密资产", MUTUALFUND: "共同基金", OPTION: "期权" };
export async function symbolSearch(q: string) {
  return cached(`search:${q.toLowerCase()}`, 10 * 60_000, async () => {
    const j = await getJson<any>(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=0&quotesCount=25&enableFuzzyQuery=true`);
    return ((j?.quotes ?? []) as any[]).filter((x) => x.symbol).map((x) => ({ symbol: String(x.symbol), name: String(x.shortname ?? x.longname ?? x.symbol), exchange: String(x.exchDisp ?? x.exchange ?? ""), type: QTYPE[String(x.quoteType ?? "")] ?? String(x.quoteType ?? ""), sector: x.sectorDisp ?? x.sector ?? null, industry: x.industryDisp ?? x.industry ?? null }));
  });
}

/* ------------------------------------------------------------------ 资产负债（信用模型用） */
export async function balanceSheets(symbols: string[]) {
  const list = [...new Set(symbols)].slice(0, 20);
  return cached(`bs:${list.join(",")}`, 12 * 3600_000, async () => {
    const types = ["quarterlyTotalAssets", "quarterlyTotalLiabilitiesNetMinorityInterest", "quarterlyTotalDebt", "quarterlyStockholdersEquity", "quarterlyCashAndCashEquivalents", "trailingMarketCap", "quarterlyPreferredStock", "quarterlyInterestExpense", "quarterlyEBIT"];
    const p2 = Math.floor(Date.now() / 1000);
    const out = await Promise.all(list.map(async (s) => {
      try {
        const j = await getJson<any>(`https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(s)}?type=${types.join(",")}&period1=${p2 - 2 * 365 * 86400}&period2=${p2}`);
        const res: any[] = j?.timeseries?.result ?? [];
        const v: Record<string, number | null> = {};
        let asOf: string | null = null;
        for (const r of res) {
          const t = r?.meta?.type?.[0];
          const pts = (r?.[t] ?? []).filter((x: any) => x?.reportedValue?.raw != null);
          const last = pts[pts.length - 1];
          v[String(t).replace(/^quarterly|^trailing/, "")] = last ? Number(last.reportedValue.raw) : null;
          if (last?.asOfDate && (!asOf || last.asOfDate > asOf)) asOf = last.asOfDate;
        }
        return { symbol: s, asOf, assets: v.TotalAssets ?? null, liabilities: v.TotalLiabilitiesNetMinorityInterest ?? null, debt: v.TotalDebt ?? null, equity: v.StockholdersEquity ?? null, cash: v.CashAndCashEquivalents ?? null, marketCap: v.MarketCap ?? null, preferred: v.PreferredStock ?? null, interest: v.InterestExpense ?? null, ebit: v.EBIT ?? null };
      } catch {
        return { symbol: s, asOf: null, assets: null, liabilities: null, debt: null, equity: null, cash: null, marketCap: null, preferred: null, interest: null, ebit: null };
      }
    }));
    return out;
  });
}

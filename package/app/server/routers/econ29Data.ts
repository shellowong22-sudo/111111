import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getEconomicCalendarOfficialObservations } from "../economicCalendarOfficialData";
import { getOfficialNewsFeed } from "../newsResearchDb";
import { fetchSovereignMacroData } from "../realDataService";
import { getLegacyMarketSnapshot } from "./legacyMarketData";
import { getMoneyMarketSnapshot } from "./moneyMarketResearch";
import { getPolicySourceDirectory } from "./moneyMarketPolicy";
import { inspectOfficialPolicyDocument } from "./moneyMarketPolicy";
import { readLatestFedSep } from "./fedSepPublic";
import { readLatestUsManufacturingPmi } from "./pmiPublic";
import { readLatestTreasuryParYield } from "./treasuryDailyYield";
import { readLatestTicRelease } from "./ticPublic";
import { readLatestBlsMacroReleases } from "./blsMacroEvidence";

const ECON29_IDS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29"] as const;

type Metric = { label: string; value: string; tone: "cyan" | "teal" | "amber" };
type Evidence = { label: string; text: string };
type DataProfile = { id: string; available: boolean; source: string; sourceUrl: string | null; observationDate: string | null; retrievedAt: string; boundary: string; metrics: Metric[]; researchUse: string; evidence?: Evidence[] };
type ProfileOptions = { shockBps?: number; tenor?: "2 Yr" | "10 Yr"; countryCode?: "US" | "DE" | "JP" | "GB"; releaseZone?: "Asia/Shanghai" | "UTC" | "America/New_York"; taylor?: { neutralRate: number; inflationTarget: number; outputGap: number; inflationWeight: number; outputWeight: number } };

function unavailable(id: string, source: string, retrievedAt: string, boundary: string, researchUse: string): DataProfile {
  return { id, available: false, source, sourceUrl: null, observationDate: null, retrievedAt, boundary, metrics: [], researchUse };
}

function value(value: number | null | undefined, digits = 2) { return value === null || value === undefined || !Number.isFinite(value) ? "—" : String(Number(value.toFixed(digits))); }

function date(value: string | null | undefined) { return value ?? "未标注"; }

function latestActualChange(history: Array<{ observationDate: string; value: number }>) {
  const current = history.at(-1); const prior = history.at(-2);
  return current && prior ? current.value - prior.value : null;
}

async function officialProfile(id: string, seriesId: string, researchUse: string, extra?: (series: { value: number | null; previousValue: number | null; observationDate: string | null; history: Array<{ observationDate: string; value: number }>; unit: string; cadence: string; label: string }) => Metric[]): Promise<DataProfile> {
  const snapshot = await getEconomicCalendarOfficialObservations();
  const series = snapshot.observations.find((item) => item.id === seriesId);
  if (!series || series.status !== "available" || series.value === null) return unavailable(id, series?.institution ?? "官方宏观发布", snapshot.asOf, series?.boundary ?? "当前官方序列不可读；终端不以 ZIP 展示值或静态样本替代。", researchUse);
  return {
    id, available: true, source: `${series.institution} · ${series.label}`, sourceUrl: series.endpoint, observationDate: series.observationDate, retrievedAt: series.retrievedAt, boundary: series.boundary,
    metrics: extra?.(series) ?? [
      { label: "最新观察", value: value(series.value), tone: "cyan" },
      { label: "前期观察", value: value(series.previousValue), tone: "teal" },
      { label: "频率", value: series.cadence, tone: "amber" },
    ], researchUse,
  };
}

async function tradeProfile(): Promise<DataProfile> {
  const snapshot = await getEconomicCalendarOfficialObservations();
  const exports = snapshot.observations.find((item) => item.id === "EUROSTAT_EXPORTS_EU27");
  const imports = snapshot.observations.find((item) => item.id === "EUROSTAT_IMPORTS_EU27");
  const usable = exports?.status === "available" && imports?.status === "available" && exports.value !== null && imports.value !== null && exports.observationDate === imports.observationDate;
  if (!usable) return unavailable("03", "Eurostat · 欧盟对外贸易", snapshot.asOf, "出口与进口只有在相同实际观察期均可读取时才计算净额；缺失、日期不一致或不可读时不拼接。", "贸易方向和同期净额只用于口径研究，不代表国家排行或交易信号。");
  return { id: "03", available: true, source: "Eurostat · 欧盟对外出口与进口（季调）", sourceUrl: exports.endpoint, observationDate: exports.observationDate, retrievedAt: snapshot.asOf, boundary: "仅计算同一 Eurostat 实际观察期的出口减进口；金额口径为百万欧元，不推断贸易差额走势。", metrics: [
    { label: "出口", value: value(exports.value!, 0), tone: "cyan" }, { label: "进口", value: value(imports.value!, 0), tone: "teal" }, { label: "同期净额", value: value(exports.value! - imports.value!, 0), tone: "amber" },
  ], researchUse: "用于核对已发布跨境货物流量方向与口径，不构成贸易预测。" };
}

async function ticProfile(): Promise<DataProfile> {
  const tic = await readLatestTicRelease();
  if (!tic.available) return unavailable("04", tic.source, tic.retrievedAt, tic.limitation, "用于观察美国财政部已发布的跨境金融流分项；不将月度统计解释为实时资金流、国家归因或投资信号。");
  return { id: "04", available: true, source: tic.source, sourceUrl: tic.sourceUrl, observationDate: tic.observationPeriod, retrievedAt: tic.retrievedAt, boundary: tic.limitation, metrics: [
    { label: "净 TIC 流入", value: `${value(tic.netTicInflowBillions, 1)} 十亿美元`, tone: "cyan" }, { label: "私人流入", value: `${value(tic.privateInflowBillions, 1)} 十亿美元`, tone: "teal" }, { label: "官方流入", value: `${value(tic.officialInflowBillions, 1)} 十亿美元`, tone: "amber" },
  ], researchUse: "用于核对已发布跨境证券、短期证券与银行流量中的私人/官方分项；长期证券净交易作为来源细节，不构成资金趋势预测。" };
}

async function moneyProfile(id: string, researchUse: string): Promise<DataProfile> {
  const snapshot = await getMoneyMarketSnapshot();
  const available = snapshot.rates.filter((item) => item.status === "available");
  if (!available.length) return unavailable(id, "FRED / 美国财政部公开货币市场资料", snapshot.asOf, "当前公开货币市场序列不可读；系统不以实时盘口、ZIP 测试值或代理利率代替。", researchUse);
  const sofr = available.find((item) => item.id === "SOFR"); const effr = available.find((item) => item.id === "EFFR"); const bills = snapshot.treasuryAuctions;
  return { id, available: true, source: "FRED 公开短端利率 / U.S. Treasury Fiscal Data", sourceUrl: sofr?.sourceUrl ?? bills[0]?.sourceUrl ?? null, observationDate: sofr?.observationDate ?? effr?.observationDate ?? null, retrievedAt: snapshot.asOf, boundary: "仅为公开历史利率与已发布 Bill 拍卖字段，不是可执行融资报价、资金流或利率路径预测。", metrics: [
    { label: "SOFR", value: value(sofr?.value), tone: "cyan" }, { label: "EFFR", value: value(effr?.value), tone: "teal" }, { label: "Bill 公告", value: String(bills.length), tone: "amber" },
  ], researchUse };
}

async function financialConditionsProfile(): Promise<DataProfile> {
  const snapshot = await getMoneyMarketSnapshot();
  const rows = ["SOFR", "IORB", "RRPONTSYD"].map((id) => snapshot.rates.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item && item.status === "available"));
  if (!rows.length) return unavailable("11", "FRED · 公开短端与准备金观察", snapshot.asOf, "SOFR、准备金余额利率与隔夜逆回购余额当前均不可读；不合成金融条件指数或以 ZIP 数值替代。", "用于核对公开短端、准备金和隔夜逆回购的来源可用性，不构成金融条件指数、风险分数或交易建议。");
  return { id: "11", available: true, source: "FRED · 短端、准备金与隔夜逆回购公开观察", sourceUrl: rows[0].sourceUrl, observationDate: rows.map((row) => row.observationDate).filter((item): item is string => Boolean(item)).sort().at(-1) ?? null, retrievedAt: snapshot.asOf, boundary: "不同序列的单位与含义不同：SOFR/IORB 为利率，ON RRP 为余额；仅并列来源状态，不聚合为金融条件指数。", metrics: rows.map((row, index) => ({ label: row.label, value: value(row.value), tone: (index === 0 ? "cyan" : index === 1 ? "teal" : "amber") as Metric["tone"] })), researchUse: "用于观察公开短端、准备金与逆回购资料的可读性和定义差异，不构成市场或投资结论。" };
}

async function auctionProfile(): Promise<DataProfile> {
  const snapshot = await getMoneyMarketSnapshot();
  const auction = snapshot.treasuryAuctions.find((item) => item.auctionDate && item.issueDate && item.maturityDate) ?? null;
  if (!auction) return unavailable("15", "美国财政部 Fiscal Data · Bill 拍卖", snapshot.asOf, "当前没有可验证的已发布 Bill 拍卖、发行与到期三日期字段；系统不推断发行计划或合约到期。", "用于核对已发布 Bill 的拍卖、发行与到期时间尺，不构成期货合约、概率或利率预测。");
  const issueToMaturityDays = auction.issueDate && auction.maturityDate ? Math.round((Date.parse(auction.maturityDate) - Date.parse(auction.issueDate)) / 86_400_000) : null;
  return { id: "15", available: true, source: "美国财政部 Fiscal Data · Treasury Securities Auctions", sourceUrl: auction.sourceUrl, observationDate: auction.auctionDate, retrievedAt: snapshot.asOf, boundary: "仅展示财政部已发布且标记为 Bill 的拍卖、发行和到期字段；不将拍卖记录解释为利率期货概率、发行计划或可执行报价。", metrics: [
    { label: "期限", value: auction.securityTerm ?? "未标注", tone: "cyan" }, { label: "发行至到期", value: issueToMaturityDays === null ? "未标注" : `${issueToMaturityDays} 天`, tone: "teal" }, { label: "发行额", value: auction.offeringAmount ?? "未标注", tone: "amber" },
  ], researchUse: "用于研究已发布国库券的日期链与发行规模，不构成市场定价或预测。" };
}

async function curveProfile(id: string, researchUse: string): Promise<DataProfile> {
  const curve = await readLatestTreasuryParYield();
  if (!curve.available) return unavailable(id, "美国财政部日度 PAR 收益率", new Date().toISOString(), curve.limitation, researchUse);
  const twoYear = curve.points.find((point) => point.tenor === "2 Yr")?.yield ?? null;
  const tenYear = curve.points.find((point) => point.tenor === "10 Yr")?.yield ?? null;
  return { id, available: true, source: "美国财政部 · 日度 PAR 收益率", sourceUrl: curve.sourceUrl, observationDate: curve.observationDate, retrievedAt: new Date().toISOString(), boundary: curve.limitation, metrics: [
    { label: "2 年", value: value(twoYear), tone: "cyan" }, { label: "10 年", value: value(tenYear), tone: "teal" }, { label: "10Y−2Y", value: twoYear === null || tenYear === null ? "—" : value(tenYear - twoYear), tone: "amber" },
  ], researchUse };
}

async function curveShockProfile(options: ProfileOptions): Promise<DataProfile> {
  const shockBps = options.shockBps;
  const tenor = options.tenor;
  if (!tenor || shockBps === undefined || !Number.isFinite(shockBps) || Math.abs(shockBps) > 1_000) return unavailable("09", "美国财政部 · 日度 PAR 收益率", new Date().toISOString(), "请明确选择 2 年或 10 年实际 PAR 期限点，并输入 -1000 至 +1000 bp 的有限平移参数；终端不预设冲击或推断价格/资产影响。", "仅在用户显式输入下对同日美国财政部实际 PAR 点进行透明收益率平移算术；不是情景预测或交易建议。");
  const curve = await readLatestTreasuryParYield();
  if (!curve.available) return unavailable("09", "美国财政部 · 日度 PAR 收益率", new Date().toISOString(), curve.limitation, "用户参数不替代缺失的官方实际曲线。");
  const baseYield = curve.points.find((point) => point.tenor === tenor)?.yield ?? null;
  if (baseYield === null) return unavailable("09", "美国财政部 · 日度 PAR 收益率", new Date().toISOString(), `官方曲线 ${curve.observationDate ?? "当前观察"} 未提供 ${tenor} 实际期限点；不插值或使用其他期限代替。`, "仅对实际存在的期限点做用户参数算术。");
  const shocked = baseYield + shockBps / 100;
  return { id: "09", available: true, source: "美国财政部 · 日度 PAR 收益率", sourceUrl: curve.sourceUrl, observationDate: curve.observationDate, retrievedAt: new Date().toISOString(), boundary: `公式：冲击后收益率 = ${tenor} 实际 PAR + 用户平移 bp/100。这里不估算久期、债券价格、回报、交易成本或任何资产影响。`, metrics: [
    { label: `${tenor} 实际 PAR`, value: `${value(baseYield)}%`, tone: "cyan" }, { label: "用户平移", value: `${value(shockBps, 0)} bp`, tone: "amber" }, { label: "冲击后算术", value: `${value(shocked)}%`, tone: "teal" },
  ], researchUse: "用于复算一条官方实际期限点在用户指定平移下的收益率算术；不构成利率路径、债券价格或投资建议。" };
}

async function fedFeedProfile(id: string, researchUse: string, keyword = ""): Promise<DataProfile> {
  const feed = await getOfficialNewsFeed({ source: "fed_monetary", keyword, limit: 24 });
  const latest = feed.rows[0]; const state = feed.sources[0];
  if (!latest) return unavailable(id, state?.label ?? "美联储货币政策 RSS", state?.cachedAt?.toISOString() ?? new Date().toISOString(), state?.failure ?? "当前官方发布流没有匹配条目；系统不以第三方新闻替代。", researchUse);
  return { id, available: true, source: latest.sourceLabel, sourceUrl: latest.sourceUrl, observationDate: latest.publishedAt?.toISOString() ?? null, retrievedAt: latest.retrievedAt.toISOString(), boundary: "仅展示本次从美联储货币政策官方 RSS 读取的标题、发布日期与来源状态；不生成政策预测、情绪评级或市场影响结论。", metrics: [
    { label: "发布条目", value: latest.headline.slice(0, 42), tone: "cyan" }, { label: "发布日期", value: latest.publishedAt ? latest.publishedAt.toISOString().slice(0, 10) : "未标注", tone: "teal" }, { label: "匹配条目", value: String(feed.rows.length), tone: "amber" },
  ], researchUse };
}

function formatHours(hours: number) {
  const whole = Math.max(0, Math.floor(hours));
  return whole >= 48 ? `${Math.floor(whole / 24)} 天 ${whole % 24} 小时` : `${whole} 小时`;
}

function parseBlsEasternInstant(releaseDate: string, releaseTime: string) {
  const time = releaseTime.match(/^(\d{1,2}):(\d{2})\s+([AP]M)$/i);
  if (!time) return null;
  const month = Number(releaseDate.slice(5, 7));
  const day = Number(releaseDate.slice(8, 10));
  const year = Number(releaseDate.slice(0, 4));
  let hour = Number(time[1]);
  if (time[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (time[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  const expected = Date.UTC(year, month - 1, day, hour, Number(time[2]));
  const probe = new Date(expected);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(probe);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const interpreted = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"));
  return new Date(probe.getTime() + (expected - interpreted));
}

async function blsReleaseTimingProfile(options: ProfileOptions): Promise<DataProfile> {
  const released = await readLatestBlsMacroReleases();
  const row = released.rows.find((item) => item.id === "LNS14000000");
  const zone = options.releaseZone ?? "Asia/Shanghai";
  if (!released.available || !row?.observationPeriod || !row.officialReleaseDate || !row.officialReleaseTime) return unavailable("01", released.source, released.fetchedAt, "BLS 失业率实际观测或其与观察期匹配的官方发布时间当前不可同时读取；终端不将 ZIP 原事件行时刻、浏览器本地时间或预测日历代为官方发布时间。", "用于将 BLS 已发布失业率的官方当地发布时间、观察期和本次读取时点置于同一时间轴；不构成经济预测或交易依据。");
  const releaseInstant = parseBlsEasternInstant(row.officialReleaseDate, row.officialReleaseTime);
  if (!releaseInstant || Number.isNaN(releaseInstant.getTime())) return unavailable("01", released.source, released.fetchedAt, "BLS 官方日历返回了发布时间文本，但无法按美国东部当地时间可靠解析；终端不猜测 UTC 偏移。", "用于核对官方发布时点，不构成市场时点或投资建议。");
  const retrieved = new Date(released.fetchedAt);
  const localized = new Intl.DateTimeFormat("zh-CN", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(releaseInstant);
  return { id: "01", available: true, source: "U.S. BLS 官方发布时间表 / 失业率实际观测", sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm", observationDate: row.observationPeriod, retrievedAt: released.fetchedAt, boundary: `BLS 日历时刻按 America/New_York 解释，再转换为用户选择的 ${zone}。发布后时长仅为“本次终端读取时间−官方发布时间”，不是市场反应窗口或可交易延迟。`, metrics: [{ label: "官方发布（纽约）", value: `${row.officialReleaseDate} ${row.officialReleaseTime}`, tone: "cyan" }, { label: `显示时区（${zone})`, value: localized, tone: "teal" }, { label: "发布至本次读取", value: formatHours((retrieved.getTime() - releaseInstant.getTime()) / 3_600_000), tone: "amber" }], researchUse: "用于审计 BLS 已发布失业率的观察期、官方发布时间和终端读取滞后；不构成经济预测、市场时点或投资建议。" };
}

function releaseDate(row: { publishedAt: Date | null }) { return row.publishedAt?.toISOString().slice(0, 10) ?? "未标注"; }

function findFedItem(rows: Awaited<ReturnType<typeof getOfficialNewsFeed>>["rows"], kind: "minutes" | "statement") {
  const pattern = kind === "minutes" ? /minutes of the federal open market committee/i : /fomc statement|federal reserve issues.*statement/i;
  return rows.find((row) => pattern.test(row.headline));
}

async function fedReleaseChainProfile(): Promise<DataProfile> {
  const feed = await getOfficialNewsFeed({ source: "fed_monetary", limit: 6 });
  const rows = feed.rows.slice(0, 3);
  const source = feed.sources[0];
  if (rows.length < 2) return unavailable("06", source?.label ?? "美联储货币政策 RSS", source?.cachedAt?.toISOString() ?? new Date().toISOString(), source?.failure ?? "美联储官方货币政策 RSS 没有足够已发布条目建立发布链；不以原 RSAN 文本或第三方新闻补齐。", "用于按实际发布日期核对相邻美联储官方货币政策发布的次序和间隔；不制作风险评级或事件传导预测。");
  const dates = rows.map((row) => row.publishedAt?.getTime()).filter((item): item is number => Boolean(item));
  const spanHours = dates.length >= 2 ? Math.abs(dates[0]! - dates.at(-1)!) / 3_600_000 : null;
  return { id: "06", available: true, source: source?.label ?? "美联储货币政策 RSS", sourceUrl: rows[0]?.sourceUrl ?? null, observationDate: releaseDate(rows[0]!), retrievedAt: source?.cachedAt?.toISOString() ?? new Date().toISOString(), boundary: "链条只按官方 RSS 实际发布日期降序排列并计算首末条目的时间跨度；标题不被解释为地缘事件传导、风险评级或市场影响。", metrics: [{ label: "最新发布", value: releaseDate(rows[0]!), tone: "cyan" }, { label: "链条条目", value: String(rows.length), tone: "teal" }, { label: "首末跨度", value: spanHours === null ? "未标注" : formatHours(spanHours), tone: "amber" }], evidence: rows.map((row, index) => ({ label: `P${index + 1} · ${releaseDate(row)}`, text: row.headline })), researchUse: "用于核对同一官方货币政策发布流中相邻发布的实际次序与时间跨度，不构成风险评级、宏观预测或投资建议。" };
}

async function fedMaterialsWindowProfile(): Promise<DataProfile> {
  const feed = await getOfficialNewsFeed({ source: "fed_monetary", limit: 36 });
  const statement = findFedItem(feed.rows, "statement");
  const minutes = findFedItem(feed.rows, "minutes");
  const source = feed.sources[0];
  if (!statement || !minutes) return unavailable("10", source?.label ?? "美联储货币政策 RSS", source?.cachedAt?.toISOString() ?? new Date().toISOString(), source?.failure ?? "当前官方 RSS 未同时提供可识别的 FOMC 声明与会议纪要条目，无法建立材料窗口；终端不以原 WIRP 日期或利率概率替代。", "用于核对已发布 FOMC 声明与会议纪要之间的官方材料窗口；不构造利率概率或会议预测。");
  const gapDays = statement.publishedAt && minutes.publishedAt ? Math.abs(statement.publishedAt.getTime() - minutes.publishedAt.getTime()) / 86_400_000 : null;
  return { id: "10", available: true, source: source?.label ?? "美联储货币政策 RSS", sourceUrl: statement.sourceUrl, observationDate: releaseDate(statement), retrievedAt: source?.cachedAt?.toISOString() ?? new Date().toISOString(), boundary: "窗口仅取官方 RSS 中可识别的最新 FOMC 声明与最新会议纪要发布日期；两项不是同一会议配对时不推断会议日或利率概率。", metrics: [{ label: "最新声明", value: releaseDate(statement), tone: "cyan" }, { label: "最新纪要", value: releaseDate(minutes), tone: "teal" }, { label: "材料发布日期差", value: gapDays === null ? "未标注" : `${value(gapDays, 1)} 天`, tone: "amber" }], evidence: [{ label: `声明 · ${releaseDate(statement)}`, text: statement.headline }, { label: `纪要 · ${releaseDate(minutes)}`, text: minutes.headline }], researchUse: "用于核对美联储官方材料的发布日期窗口与材料类型，不构成会议日程、利率概率或投资建议。" };
}

function deriveFedMinutesHtmlUrl(headline: string, fallback: string) {
  const match = headline.match(/([A-Z][a-z]+)\s+(\d{1,2})(?:[–-](\d{1,2}))?,\s+(20\d{2})/);
  const month = match ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(match[1]!) + 1 : 0;
  const day = match?.[3] ?? match?.[2];
  if (!month || !day || !match?.[4]) return fallback;
  return `https://www.federalreserve.gov/monetarypolicy/fomcminutes${match[4]}${String(month).padStart(2, "0")}${day.padStart(2, "0")}.htm`;
}

async function fedDocumentProfile(id: "18" | "19", kind: "minutes" | "statement"): Promise<DataProfile> {
  const feed = await getOfficialNewsFeed({ source: "fed_monetary", limit: 36 });
  const item = findFedItem(feed.rows, kind);
  const source = feed.sources[0];
  const label = kind === "minutes" ? "FOMC 会议纪要" : "FOMC 声明";
  if (!item) return unavailable(id, source?.label ?? "美联储货币政策 RSS", source?.cachedAt?.toISOString() ?? new Date().toISOString(), source?.failure ?? `官方 RSS 未找到可识别的${label}条目；系统不使用 ZIP 文本统计、第三方转述或情绪评分替代。`, `用于读取已发布${label}官方原文中的有限规则命中上下文；不构成政策解读或投资建议。`);
  try {
    const documentUrl = kind === "minutes" ? deriveFedMinutesHtmlUrl(item.headline, item.sourceUrl) : item.sourceUrl;
    const document = await inspectOfficialPolicyDocument("FED", documentUrl);
    const highlights = document.highlights.slice(0, 3);
    const primary = highlights[0];
    return { id, available: true, source: `${source?.label ?? "美联储货币政策 RSS"} / ${label}官方原文`, sourceUrl: documentUrl, observationDate: releaseDate(item), retrievedAt: document.retrievedAt, boundary: `只展示该则${label}官方 HTML/文本主内容区中规则关键词附近的有限上下文。关键词命中不等同于自动政策立场、情绪、市场影响或利率预测。`, metrics: [{ label: "原文发布日期", value: releaseDate(item), tone: "cyan" }, { label: "规则命中", value: String(document.highlights.length), tone: "teal" }, { label: "首个类别", value: primary?.category ?? "未命中", tone: "amber" }], evidence: highlights.map((highlight, index) => ({ label: `${index + 1} · ${highlight.category}`, text: highlight.context })), researchUse: `用于终端内核对已发布${label}官方原文主内容区的规则关键词上下文；不构成政策解读、利率预测或投资建议。` };
  } catch (error) {
    return unavailable(id, `${source?.label ?? "美联储货币政策 RSS"} / ${label}官方原文`, source?.cachedAt?.toISOString() ?? new Date().toISOString(), `已从官方 RSS 找到${label}入口，但官方原文读取失败：${error instanceof Error ? error.message : "UNKNOWN"}。不使用 ZIP 段落统计或第三方摘要代替。`, `用于核对已发布${label}官方原文；官方正文不可读时不生成情绪或政策结论。`);
  }
}

async function sourceFreshnessProfile(): Promise<DataProfile> {
  const feed = await getOfficialNewsFeed({ source: "all", limit: 60 });
  const now = new Date();
  const readable = feed.sources.filter((source) => source.status === "available");
  const latest = feed.sources.map((source) => source.latestPublishedAt).filter((item): item is Date => Boolean(item)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  if (!readable.length || !latest) return unavailable("21", "SEC / 美联储官方 RSS", now.toISOString(), "当前 SEC 新闻稿、美联储货币政策和美联储研究 RSS 中没有可验证的可读来源与发布日期组合；终端不以 ZIP 新闻文本、缓存猜测或情绪标签替代。", "用于核对多个官方 RSS 的读取可用性、最新实际发布日期与本次读取的时间差；不提供新闻情绪或投资建议。");
  const ageHours = Math.max(0, Math.floor((now.getTime() - latest.getTime()) / 3_600_000));
  return { id: "21", available: true, source: "SEC / 美联储官方 RSS 可用性快照", sourceUrl: "https://www.federalreserve.gov/feeds/press_monetary.xml", observationDate: latest.toISOString(), retrievedAt: now.toISOString(), boundary: "时效仅计算各官方 RSS 的最新实际发布日期到本次读取时点的自然时长；它不代表新闻覆盖完整性、市场反应、情绪或任何投资结论。", metrics: [{ label: "可读官方来源", value: `${readable.length}/${feed.sources.length}`, tone: "cyan" }, { label: "最新发布日期", value: latest.toISOString().slice(0, 10), tone: "teal" }, { label: "最新发布距今", value: formatHours(ageHours), tone: "amber" }], evidence: feed.sources.map((source) => ({ label: `${source.label} · ${source.status === "available" ? "可读" : "不可读"}`, text: source.latestPublishedAt ? `最新官方发布日期 ${source.latestPublishedAt.toISOString()}` : source.failure ?? "未返回发布日期" })), researchUse: "用于核对多个官方发布源的可读取状态与最新发布日期时效，不构成新闻情绪、市场影响或投资建议。" };
}

async function rateLadderProfile(): Promise<DataProfile> {
  const snapshot = await getLegacyMarketSnapshot();
  const ids = ["FEDFUNDS", "ECBDFR", "ECBMRRFR", "BOE_BANK_RATE", "BOJ_LOAN_GROWTH"];
  const rows = ids.map((id) => snapshot.series.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item && item.status === "available"));
  if (!rows.length) return unavailable("17", "FRED / ECB / 英格兰银行 / 日本银行公开观察", snapshot.asOf, "当前没有可核验的央行实际序列；不以政策预期或 ZIP 展示替代。", "用于核对已发布政策相关实际观察的相邻变动，不构成全球利率总览或政策预测。");
  return { id: "17", available: true, source: "FRED / ECB / 英格兰银行 / 日本银行公开观察", sourceUrl: rows[0].sourceUrl, observationDate: rows.map((row) => row.observationDate).filter(Boolean).sort().at(-1) ?? null, retrievedAt: snapshot.asOf, boundary: "各序列频率不同，仅显示各自相邻实际观察的变动，不将其作为同日可比或政策路径。", metrics: rows.slice(0, 3).map((row, index) => ({ label: row.label.slice(0, 11), value: `${value(row.value)} (${value(row.change)})`, tone: (index === 0 ? "cyan" : index === 1 ? "teal" : "amber") as Metric["tone"] })), researchUse: "用于研究已发布央行实际观察的方向与频率差异，不构成交易建议。" };
}

function policyDirectoryProfile(): DataProfile {
  const sources = getPolicySourceDirectory();
  return { id: "16", available: sources.length > 0, source: "已配置的央行官方来源目录", sourceUrl: sources[0]?.homeUrl ?? null, observationDate: null, retrievedAt: new Date().toISOString(), boundary: "目录仅列出可审计的官方机构主页与地区，不声称各辖区均有当前利率或实时政策资料。辖区文本检索仍仅在 ZIP 原 CENB 上下文中执行。", metrics: [
    { label: "官方机构", value: String(sources.length), tone: "cyan" }, { label: "首个来源", value: sources[0]?.label ?? "—", tone: "teal" }, { label: "地区覆盖", value: String(new Set(sources.map((item) => item.region)).size), tone: "amber" },
  ], researchUse: "用于核对用户检索辖区可对应的官方机构目录与来源边界；不构成全球利率总览、地图或政策建议。" };
}

async function officialMatrixProfile(id: string, researchUse: string): Promise<DataProfile> {
  const snapshot = await getEconomicCalendarOfficialObservations();
  const available = snapshot.observations.filter((item) => item.status === "available");
  const regions = new Set(available.map((item) => item.region));
  if (!available.length) return unavailable(id, "BLS / Fed / Eurostat / BOJ / ONS 官方宏观观察", snapshot.asOf, snapshot.sourceBoundary, researchUse);
  return { id, available: true, source: "BLS / Fed / Eurostat / BOJ / ONS 官方宏观观察", sourceUrl: available[0]?.endpoint ?? null, observationDate: available.map((item) => item.observationDate).filter((item): item is string => Boolean(item)).sort().at(-1) ?? null, retrievedAt: snapshot.asOf, boundary: snapshot.sourceBoundary, metrics: [
    { label: "可读序列", value: String(available.length), tone: "cyan" }, { label: "地区覆盖", value: String(regions.size), tone: "teal" }, { label: "不可读序列", value: String(snapshot.observations.length - available.length), tone: "amber" },
  ], researchUse };
}

async function countryProfile(countryCode: ProfileOptions["countryCode"]): Promise<DataProfile> {
  if (!countryCode) return unavailable("23", "World Bank · 主权宏观指标", new Date().toISOString(), "请选择支持的国家代码（US、DE、JP 或 GB）；终端不自动挑选第一个可读国家，也不据此生成风险排序。", "用于用户选定国家的资料字段来源和缺口核对，不构成主权风险评级。");
  const data = await fetchSovereignMacroData([countryCode]);
  const row = data[countryCode];
  if (!row || (row.gdpUsd === null && row.inflationPct === null && row.debtGdpPct === null)) return unavailable("23", "World Bank · 主权宏观指标", new Date().toISOString(), `World Bank 当前没有为 ${countryCode} 返回可验证的 GDP、通胀或债务/GDP 字段；系统不以其他国家、风险评分或静态样本替代。`, "用于用户选定国家的资料字段来源和缺口核对，不构成主权风险评级。");
  return { id: "23", available: true, source: "World Bank · 主权宏观指标", sourceUrl: "https://data.worldbank.org/", observationDate: String(row.year), retrievedAt: new Date().toISOString(), boundary: "仅展示用户选择国家的 World Bank 返回字段及其最新可用年份；字段缺失保持空，不生成主权风险评分、气泡图或国家排序。", metrics: [
    { label: "国家 / 年份", value: `${countryCode} / ${row.year}`, tone: "cyan" }, { label: "通胀", value: row.inflationPct === null ? "—" : `${value(row.inflationPct)}%`, tone: "teal" }, { label: "债务 / GDP", value: row.debtGdpPct === null ? "—" : `${value(row.debtGdpPct)}%`, tone: "amber" },
  ], researchUse: "用于用户选定国家的 World Bank 主权宏观字段与年份缺口核对，不构成主权风险评级或投资建议。" };
}

function annualChange(history: Array<{ observationDate: string; value: number }>) {
  const current = history.at(-1); const priorYear = history.at(-13);
  return current && priorYear && priorYear.value !== 0 ? ((current.value / priorYear.value) - 1) * 100 : null;
}

async function inflationComparisonProfile(): Promise<DataProfile> {
  const retrievedAt = new Date().toISOString();
  const euroUrl = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_midx?geo=EA20&coicop=CP00&unit=I15&sinceTimePeriod=2024-01";
  try {
    const [euroResponse, blsResponse] = await Promise.all([
      fetch(euroUrl, { signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Finance-Hub-HICP-Comparison/1.0" } }),
      fetch(`https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0?startyear=${new Date().getUTCFullYear() - 2}&endyear=${new Date().getUTCFullYear()}`, { signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Finance-Hub-HICP-Comparison/1.0" } }),
    ]);
    if (!euroResponse.ok || !blsResponse.ok) throw new Error(`OFFICIAL_SOURCE_${euroResponse.status}_${blsResponse.status}`);
    const euroPayload = await euroResponse.json() as { value?: Record<string, number>; dimension?: { time?: { category?: { index?: Record<string, number> } } } };
    const euroRows = Object.entries(euroPayload.dimension?.time?.category?.index ?? {}).map(([period, index]) => ({ period, value: euroPayload.value?.[String(index)] ?? null })).filter((row): row is { period: string; value: number } => row.value !== null && Number.isFinite(row.value)).sort((a, b) => a.period.localeCompare(b.period));
    const euroCurrent = euroRows.at(-1);
    const euroPrior = euroCurrent ? euroRows.find((row) => row.period === `${Number(euroCurrent.period.slice(0, 4)) - 1}${euroCurrent.period.slice(4)}`) : undefined;
    const blsPayload = await blsResponse.json() as { status?: string; Results?: { series?: Array<{ data?: Array<{ year: string; period: string; value: string }> }> } };
    const blsRows = (blsPayload.status === "REQUEST_SUCCEEDED" ? blsPayload.Results?.series?.[0]?.data ?? [] : []).filter((row) => /^M\d{2}$/.test(row.period)).map((row) => ({ period: `${row.year}-${row.period.slice(1)}`, value: Number(row.value) })).filter((row) => Number.isFinite(row.value));
    const usCurrent = euroCurrent ? blsRows.find((row) => row.period === euroCurrent.period) : undefined;
    const usPrior = euroCurrent ? blsRows.find((row) => row.period === `${Number(euroCurrent.period.slice(0, 4)) - 1}${euroCurrent.period.slice(4)}`) : undefined;
    if (!euroCurrent || !euroPrior || !usCurrent || !usPrior || euroPrior.value === 0 || usPrior.value === 0) throw new Error("COMMON_MONTH_OR_YEAR_AGO_OBSERVATION_UNAVAILABLE");
    const euroRate = ((euroCurrent.value / euroPrior.value) - 1) * 100;
    const usRate = ((usCurrent.value / usPrior.value) - 1) * 100;
    return { id: "22", available: true, source: "Eurostat HICP（EA20）/ U.S. BLS CPI-U", sourceUrl: euroUrl, observationDate: euroCurrent.period, retrievedAt, boundary: "两项均从共同可得月份的价格指数与其同月一年前指数计算：12 月变化率=(当前指数/12 月前指数−1)×100。它们均为消费者价格指数，但覆盖范围、季调与编制方法不同；终端不由此推导汇率、利率或资产价格结论。", metrics: [
      { label: "欧元区 HICP 12月", value: `${value(euroRate)}%`, tone: "cyan" }, { label: "美国 CPI-U 12月", value: `${value(usRate)}%`, tone: "teal" }, { label: "百分点差", value: `${value(euroRate - usRate)} pp`, tone: "amber" },
    ], researchUse: "用于核验共同可得月份下两项官方消费者价格指数各自的 12 月变化与方法边界；不构成汇率、利率或资产价格预测。" };
  } catch (error) {
    return unavailable("22", "Eurostat HICP / BLS CPI-U 官方指数", retrievedAt, `只有 Eurostat EA20 HICP 与美国 CPI-U 均提供共同月份及其同月一年前实际指数时才计算 12 月变化率：${error instanceof Error ? error.message : "UNKNOWN"}。不同观察月、缺失值或定义差异不强行拼接。`, "用于并列查看两项官方消费者物价指数的各自 12 月变化率与口径边界，不构成跨区域投资判断。");
  }
}

async function taylorResearchProfile(options: ProfileOptions): Promise<DataProfile> {
  const inputs = options.taylor;
  const values = inputs ? Object.values(inputs) : [];
  if (!inputs || values.some((item) => !Number.isFinite(item)) || Math.abs(inputs.outputGap) > 20 || Math.abs(inputs.neutralRate) > 20 || Math.abs(inputs.inflationTarget) > 20 || Math.abs(inputs.inflationWeight) > 10 || Math.abs(inputs.outputWeight) > 10) return unavailable("13", "BLS CPI-U / FRED 有效联邦基金利率 + 用户研究参数", new Date().toISOString(), "请完整输入中性利率、通胀目标、产出缺口、通胀权重和产出权重（有限数字）；终端不预填主观参数、不推荐目标利率。", "仅在用户明确参数与可读官方实际观察同时存在时展示透明的泰勒式研究算术，不构成政策预测或建议。");
  const retrievedAt = new Date().toISOString();
  try {
    const endYear = new Date().getUTCFullYear();
    const [blsResponse, fredResponse] = await Promise.all([
      fetch(`https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0?startyear=${endYear - 1}&endyear=${endYear}`, { signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Finance-Hub-Taylor-Research/1.0" } }),
      fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS", { signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Finance-Hub-Taylor-Research/1.0" } }),
    ]);
    if (!blsResponse.ok || !fredResponse.ok) throw new Error(`OFFICIAL_SOURCE_${blsResponse.status}_${fredResponse.status}`);
    const blsPayload = await blsResponse.json() as { status?: string; Results?: { series?: Array<{ data?: Array<{ year: string; period: string; value: string }> }> } };
    const cpiRows = (blsPayload.status === "REQUEST_SUCCEEDED" ? blsPayload.Results?.series?.[0]?.data ?? [] : []).filter((row) => /^M\d{2}$/.test(row.period)).map((row) => ({ year: Number(row.year), month: row.period.slice(1), value: Number(row.value) })).filter((row) => Number.isFinite(row.value));
    const currentCpi = cpiRows[0];
    const priorCpi = currentCpi ? cpiRows.find((row) => row.year === currentCpi.year - 1 && row.month === currentCpi.month) : undefined;
    const inflation = currentCpi && priorCpi && priorCpi.value !== 0 ? ((currentCpi.value / priorCpi.value) - 1) * 100 : null;
    const fedRows = (await fredResponse.text()).split(/\r?\n/).slice(1).flatMap((line) => { const [observationDate, raw] = line.split(","); const rate = Number(raw); return observationDate && raw && raw !== "." && Number.isFinite(rate) ? [{ observationDate, rate }] : []; });
    const effr = fedRows.at(-1) ?? null;
    if (inflation === null || !effr || !currentCpi) throw new Error("CPI_OR_EFFR_OBSERVATION_UNAVAILABLE");
    const rule = inputs.neutralRate + inflation + inputs.inflationWeight * (inflation - inputs.inflationTarget) + inputs.outputWeight * inputs.outputGap;
    return { id: "13", available: true, source: "U.S. BLS CPI-U / FRED 有效联邦基金利率 + 用户参数", sourceUrl: "https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0", observationDate: `${currentCpi.year}-${currentCpi.month} / ${effr.observationDate}`, retrievedAt, boundary: `公式：r* + π + a(π−π*) + b·gap。r*=${inputs.neutralRate}，π*=${inputs.inflationTarget}，gap=${inputs.outputGap}，a=${inputs.inflationWeight}，b=${inputs.outputWeight} 全部为用户输入；π 为 CPI-U 12 月变化。此算术不是 FOMC 规则、目标利率或政策预测。`, metrics: [
      { label: "CPI-U 12月实际", value: `${value(inflation)}%`, tone: "cyan" }, { label: "EFFR 实际", value: `${value(effr.rate)}%`, tone: "teal" }, { label: "研究算术输出", value: `${value(rule)}%`, tone: "amber" },
    ], researchUse: "用于将用户明确假设与已发布 CPI-U、实际 EFFR 并列并复算一个泰勒式研究表达；不构成利率预测、政策建议或投资建议。" };
  } catch (error) {
    return unavailable("13", "BLS CPI-U / FRED 有效联邦基金利率", retrievedAt, `BLS CPI-U 12 月变化或实际有效联邦基金利率当前不可读：${error instanceof Error ? error.message : "UNKNOWN"}。用户输入不会替代缺失官方观察。`, "仅在用户明确参数与可读官方实际观察同时存在时展示透明的泰勒式研究算术，不构成政策预测或建议。");
  }
}

async function pmiProfile(): Promise<DataProfile> {
  const pmi = await readLatestUsManufacturingPmi();
  if (!pmi.available) return unavailable("24", pmi.source, pmi.retrievedAt, pmi.limitation, "用于核对公开制造业 PMI 相对 50 的实际距离；不替代完整 PMI 订阅数据。");
  return { id: "24", available: true, source: pmi.source, sourceUrl: pmi.sourceUrl, observationDate: pmi.observationPeriod, retrievedAt: pmi.retrievedAt, boundary: pmi.limitation, metrics: [
    { label: "官方当前值", value: value(pmi.value, 1), tone: "cyan" }, { label: "前值", value: value(pmi.previousValue, 1), tone: "teal" }, { label: "相对 50", value: value(pmi.thresholdDistance, 1), tone: "amber" },
  ], researchUse: "用于观察公开制造业 PMI 的扩张/收缩阈值位置，不构成经济预测。" };
}

async function sepProfile(): Promise<DataProfile> {
  const sep = await readLatestFedSep();
  if (!sep.available) return unavailable("20", sep.source, sep.retrievedAt, sep.limitation, "仅在美联储公开可访问 SEP 表可读时展示预测中位数和范围；当前不从点阵图图片或第三方图表补值。");
  const row = (variable: string) => sep.rows.find((item) => item.variable === variable);
  const gdp = row("Change in real GDP"); const pce = row("PCE inflation"); const funds = row("Federal funds rate");
  if (!gdp || !pce || !funds) return unavailable("20", sep.source, sep.retrievedAt, "美联储 SEP 可访问材料已读取，但表 1 缺少 GDP、PCE 或联邦基金利率的必要字段；终端不推断缺失值。", "预测分位栏只展示可解析公开字段，不把未解析图表转为数值。");
  return { id: "20", available: true, source: sep.source, sourceUrl: sep.sourceUrl, observationDate: sep.releaseDate, retrievedAt: sep.retrievedAt, boundary: sep.limitation, metrics: [
    { label: "GDP 2026", value: `${value(gdp.medians["2026"], 1)} / ${gdp.ranges["2026"] ?? "—"}`, tone: "cyan" },
    { label: "PCE 2026", value: `${value(pce.medians["2026"], 1)} / ${pce.ranges["2026"] ?? "—"}`, tone: "teal" },
    { label: "联邦基金 2026", value: `${value(funds.medians["2026"], 1)} / ${funds.ranges["2026"] ?? "—"}`, tone: "amber" },
  ], researchUse: "用于核对指定 SEP 版本表 1 的中位数与全体预测范围；范围不是概率区间，不构成对政策、利率或资产价格的建议。" };
}

export async function readEcon29DataProfile(id: string, options: ProfileOptions = {}): Promise<DataProfile> {
  const now = new Date().toISOString();
  switch (id) {
    case "01": return blsReleaseTimingProfile(options);
    case "02": return officialProfile(id, "BLS_CUUR0000SA0", "用于单一公开统计序列的口径、频率和实际趋势核对。", (series) => [{ label: "当前指数", value: value(series.value), tone: "cyan" }, { label: "上期指数", value: value(series.previousValue), tone: "teal" }, { label: "12 点跨度", value: String(series.history.length), tone: "amber" }]);
    case "03": return tradeProfile();
    case "04": return ticProfile();
    case "05": return officialProfile(id, "BLS_CES0500000003", "用于自选项对实际工资水平、观察期与频率的来源核对；不生成工资投资主题或排名。", (series) => [{ label: "平均时薪", value: value(series.value), tone: "cyan" }, { label: "前期", value: value(series.previousValue), tone: "teal" }, { label: "观察期", value: date(series.observationDate), tone: "amber" }]);
    case "06": return fedReleaseChainProfile();
    case "07": return officialProfile(id, "FED_INDPRO", "用于核对工业产出公开指标的单位、实际日期和相邻观察变化。", (series) => [{ label: "当前指数", value: value(series.value), tone: "cyan" }, { label: "相邻变动", value: value(latestActualChange(series.history)), tone: "teal" }, { label: "频率", value: series.cadence, tone: "amber" }]);
    case "08": return officialProfile(id, "ONS_GDP_MONTHLY_INDEX", "用于实际观察版本、最新期和上期的修订/缺口核对；不作为预测版本。", (series) => [{ label: "最新实际", value: value(series.value), tone: "cyan" }, { label: "前期实际", value: value(series.previousValue), tone: "teal" }, { label: "观察期", value: date(series.observationDate), tone: "amber" }]);
    case "09": return curveShockProfile(options);
    case "10": return fedMaterialsWindowProfile();
    case "11": return financialConditionsProfile();
    case "12": return officialProfile(id, "BLS_JTS000000000000000JOL", "用于已发布职位空缺实际与相邻实际变动；市场预期未接入时明确为空。", (series) => [{ label: "职位空缺", value: value(series.value, 0), tone: "cyan" }, { label: "相邻变动", value: value(latestActualChange(series.history), 0), tone: "teal" }, { label: "预期字段", value: "未接入", tone: "amber" }]);
    case "13": return taylorResearchProfile(options);
    case "14": return officialMatrixProfile(id, "用于已观测变量、单位、频率与数据缺口的假设边界，不生成投资观点。");
    case "15": return auctionProfile();
    case "16": return policyDirectoryProfile();
    case "17": return officialProfile(id, "BOJ_CALL_RATE", "用于日本银行实际隔夜利率的相邻变化记录；不将该单一市场观察作为全球利率路径或日元预测。", (series) => [{ label: "当前利率", value: value(series.value, 3), tone: "cyan" }, { label: "相邻变化", value: value(latestActualChange(series.history), 3), tone: "teal" }, { label: "观察日", value: date(series.observationDate), tone: "amber" }]);
    case "18": return fedDocumentProfile("18", "minutes");
    case "19": return fedDocumentProfile("19", "statement");
    case "20": return sepProfile();
    case "21": return sourceFreshnessProfile();
    case "22": return inflationComparisonProfile();
    case "23": return countryProfile(options.countryCode);
    case "24": return pmiProfile();
    case "25": return { id, available: true, source: "本地 URL · ZIP 原标签集合", sourceUrl: null, observationDate: null, retrievedAt: now, boundary: "只验证当前 ?tab= 是否属于 ZIP 原 24 标签，不发起市场数据读取或创建第二套导航。", metrics: [{ label: "数据类型", value: "深链状态", tone: "cyan" }, { label: "外部来源", value: "无", tone: "teal" }, { label: "回退", value: "ECO", tone: "amber" }], researchUse: "这是原行为完整性回执，不是投资数据模块。" };
    case "26": return officialProfile(id, "EUROSTAT_RETAIL_EA20", "用于原筛选状态下核对欧元区零售销售实际来源、观察期与频率；不复制事件日历或市场预期。 ", (series) => [{ label: "零售指数", value: value(series.value), tone: "cyan" }, { label: "前期", value: value(series.previousValue), tone: "teal" }, { label: "观察期", value: date(series.observationDate), tone: "amber" }]);
    case "27": return officialProfile(id, "BOJ_TANKAN_LARGE_MANUFACTURING", "用于热力单元释义的日本短观实际 DI、观察期和相邻变化；不把保留热力图颜色或国家矩阵重标为当前事实。 ", (series) => [{ label: "短观 DI", value: value(series.value), tone: "cyan" }, { label: "相邻变化", value: value(latestActualChange(series.history)), tone: "teal" }, { label: "季度观察", value: date(series.observationDate), tone: "amber" }]);
    case "28": return officialProfile(id, "ONS_EMPLOYMENT_16_PLUS", "用于为原自选项变更记录附加英国在职人数实际观察；变更顺序仍以原视图本地差异为准。", (series) => [{ label: "在职人数", value: value(series.value, 0), tone: "cyan" }, { label: "前期", value: value(series.previousValue, 0), tone: "teal" }, { label: "滚动观察", value: date(series.observationDate), tone: "amber" }]);
    case "29": return officialProfile(id, "ONS_AWE_REGULAR_PAY", "用于为原视图切换回执附加英国常规薪酬实际观察期；不计算或展示相关性矩阵。", (series) => [{ label: "常规周薪", value: value(series.value), tone: "cyan" }, { label: "前期", value: value(series.previousValue), tone: "teal" }, { label: "观察期", value: date(series.observationDate), tone: "amber" }]);
    default: return unavailable(id, "未识别的一对一扩展", now, "该编号不属于 29 项既定范围；未创建替代数据源。", "无");
  }
}

export const econ29DataRouter = router({
  getProfile: publicProcedure.input(z.object({ id: z.string().refine((id): id is typeof ECON29_IDS[number] => (ECON29_IDS as readonly string[]).includes(id), "必须是 01–29 中的扩展编号"), shockBps: z.number().finite().min(-1_000).max(1_000).optional(), tenor: z.enum(["2 Yr", "10 Yr"]).optional(), countryCode: z.enum(["US", "DE", "JP", "GB"]).optional(), releaseZone: z.enum(["Asia/Shanghai", "UTC", "America/New_York"]).optional(), taylor: z.object({ neutralRate: z.number().finite(), inflationTarget: z.number().finite(), outputGap: z.number().finite(), inflationWeight: z.number().finite(), outputWeight: z.number().finite() }).optional() })).mutation(({ input }) => readEcon29DataProfile(input.id, input)),
});

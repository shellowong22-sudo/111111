import { publicProcedure, router } from "../_core/trpc";

const CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const HOST = "https://www.federalreserve.gov";
const CACHE_MS = 30 * 60_000;
const HEADERS = { Accept: "text/html,application/xhtml+xml", "User-Agent": "FinanceHubResearch/1.0 (+https://finance-hub.local; official-public-data-reader)" };

type SepRow = { variable: string; medians: Record<string, number | null>; ranges: Record<string, string | null> };

function text(value: string) { return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&ndash;|&#8211;/gi, "–").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim(); }
function numeric(value: string | undefined) { const parsed = Number((value ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(parsed) ? parsed : null; }

export function parseSepTable(html: string): SepRow[] {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => [...match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => text(cell[1]))).filter((cells) => cells.length >= 5);
  const years = ["2026", "2027", "2028", "Longer run"];
  const desired = ["Change in real GDP", "Unemployment rate", "PCE inflation", "Core PCE inflation", "Federal funds rate"];
  return desired.flatMap((label) => {
    const cells = rows.find((row) => row[0]?.replace(/[¹²³⁴]/g, "").trim() === label);
    if (!cells) return [];
    const medians = Object.fromEntries(years.map((year, index) => [year, numeric(cells[index + 1])])) as Record<string, number | null>;
    const ranges = Object.fromEntries(years.map((year, index) => [year, cells[index + 9] && /\d/.test(cells[index + 9]) ? cells[index + 9] : null])) as Record<string, string | null>;
    return [{ variable: label, medians, ranges }];
  });
}

export function parseLatestSepUrl(calendarHtml: string) {
  const matches = [...calendarHtml.matchAll(/href=["']([^"']*fomcprojtabl(20\d{6})\.htm)["']/gi)].map((match) => ({ url: new URL(match[1], HOST).toString(), date: match[2] }));
  return matches.filter((item) => item.date <= new Date().toISOString().slice(0, 10).replaceAll("-", "")).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

let cached: { expiresAt: number; value: Awaited<ReturnType<typeof readLatestFedSep>> } | null = null;

export async function readLatestFedSep() {
  const retrievedAt = new Date().toISOString();
  try {
    const calendarResponse = await fetch(CALENDAR_URL, { headers: HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!calendarResponse.ok) throw new Error(`FOMC_CALENDAR_${calendarResponse.status}`);
    const latest = parseLatestSepUrl(await calendarResponse.text());
    if (!latest) throw new Error("SEP_ACCESSIBLE_MATERIAL_NOT_FOUND");
    const materialResponse = await fetch(latest.url, { headers: HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!materialResponse.ok) throw new Error(`SEP_MATERIAL_${materialResponse.status}`);
    const rows = parseSepTable(await materialResponse.text());
    if (rows.length < 4) throw new Error("SEP_TABLE_1_NOT_PARSED");
    const releaseDate = `${latest.date.slice(0, 4)}-${latest.date.slice(4, 6)}-${latest.date.slice(6, 8)}`;
    return { available: true as const, source: "美联储 · Summary of Economic Projections（可访问版）", sourceUrl: latest.url, calendarUrl: CALENDAR_URL, releaseDate, retrievedAt, rows, limitation: "仅提取美联储公开可访问 SEP 表 1 的中位数和全体预测范围。范围不是概率区间，且各参与者是在其各自适当货币政策假设下提交预测；终端不从点阵图图片推断未发布个体数值，也不生成政策建议。" };
  } catch (error) {
    return { available: false as const, source: "美联储 · Summary of Economic Projections（可访问版）", sourceUrl: null, calendarUrl: CALENDAR_URL, releaseDate: null, retrievedAt, rows: [] as SepRow[], limitation: `当前无法读取或结构化美联储 SEP 可访问材料：${error instanceof Error ? error.message : "SEP_SOURCE_UNAVAILABLE"}。系统不以原点阵图、历史截屏、第三方图表或推断值替代。` };
  }
}

export const fedSepPublicRouter = router({
  getLatest: publicProcedure.query(async () => {
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };
    const value = await readLatestFedSep();
    cached = { expiresAt: Date.now() + CACHE_MS, value };
    return { ...value, cached: false };
  }),
});

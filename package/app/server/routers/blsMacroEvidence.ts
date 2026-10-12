import { publicProcedure, router } from "../_core/trpc";

const CACHE_MS = 5 * 60_000;
const SERIES = [
  { id: "CUUR0000SA0", label: "CPI-U 全部项目", definition: "美国城市消费者价格指数，未季调，1982–84=100", unit: "指数", calendar: "cpi" },
  { id: "LNS14000000", label: "失业率", definition: "16 岁及以上劳动力失业率，季调", unit: "%", calendar: "empsit" },
  { id: "CES0000000001", label: "非农就业总人数", definition: "全部雇员：总非农就业，季调", unit: "千人", calendar: "empsit" },
] as const;

type BlsRawPoint = { year: string; period: string; periodName: string; value: string; latest?: string; footnotes?: Array<{ code?: string; text?: string }> };
type CalendarKey = typeof SERIES[number]["calendar"];
type ReleaseSchedule = { available: boolean; entries: Map<string, { date: string; time: string }> };
type MacroRow = { id: string; label: string; definition: string; unit: string; observationPeriod: string | null; officialReleaseDate: string | null; officialReleaseTime: string | null; calendarStatus: "available" | "unavailable"; value: number | null; priorPeriod: string | null; priorValue: number | null; calculated12mChangePct: number | null; monthlyChange: number | null; preliminary: boolean };
let cache: { expiresAt: number; rows: MacroRow[] } | null = null;

function observationPeriod(point: BlsRawPoint) { return /^M\d{2}$/.test(point.period) ? `${point.year}-${point.period.slice(1)}` : null; }

function parseReleaseDate(input: string) {
  const match = input.replace(/\./g, "").match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
  return month > 0 ? `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}` : null;
}

async function readSchedule(key: CalendarKey): Promise<ReleaseSchedule> {
  const url = `https://www.bls.gov/schedule/news_release/${key}.htm`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "finance-hub/bls-release-calendar" }, signal: controller.signal });
    if (!response.ok) return { available: false, entries: new Map() };
    const html = await response.text();
    if (/Access Denied/i.test(html)) return { available: false, entries: new Map() };
    const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const entries = new Map<string, { date: string; time: string }>();
    const row = /([A-Za-z]+\s+20\d{2})\s+([A-Za-z]{3,9}\.?\s+\d{1,2},\s+20\d{2})\s+(\d{2}:\d{2}\s+[AP]M)/g;
    for (const match of text.matchAll(row)) {
      const periodMonth = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(match[1].split(" ")[0].toLowerCase()) + 1;
      const periodYear = match[1].split(" ")[1];
      const date = parseReleaseDate(match[2]);
      if (periodMonth > 0 && date) entries.set(`${periodYear}-${String(periodMonth).padStart(2, "0")}`, { date, time: match[3] });
    }
    return { available: entries.size > 0, entries };
  } catch { return { available: false, entries: new Map() }; } finally { clearTimeout(timer); }
}

async function readSeries(config: typeof SERIES[number], schedules: Record<CalendarKey, ReleaseSchedule>): Promise<MacroRow> {
  const endYear = new Date().getUTCFullYear();
  const startYear = endYear - 1;
  const url = `https://api.bls.gov/publicAPI/v2/timeseries/data/${config.id}?startyear=${startYear}&endyear=${endYear}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "finance-hub/bls-macro-evidence" }, signal: controller.signal });
    if (!response.ok) throw new Error(`BLS HTTP ${response.status}`);
    const payload = await response.json() as { status?: string; Results?: { series?: Array<{ data?: BlsRawPoint[] }> } };
    const points = payload.status === "REQUEST_SUCCEEDED" ? (payload.Results?.series?.[0]?.data ?? []).filter((point) => /^M\d{2}$/.test(point.period)) : [];
    const latest = points[0];
    const prior = points[1];
    const priorYearSameMonth = latest ? points.find((point) => point.year === String(Number(latest.year) - 1) && point.period === latest.period) : undefined;
    const value = Number(latest?.value);
    const priorValue = Number(prior?.value);
    const base = Number(priorYearSameMonth?.value);
    const monthlyChange = Number.isFinite(value) && Number.isFinite(priorValue) ? value - priorValue : null;
    const period = latest ? observationPeriod(latest) : null;
    const release = period ? schedules[config.calendar].entries.get(period) : undefined;
    return {
      ...config,
      observationPeriod: period,
      officialReleaseDate: release?.date ?? null,
      officialReleaseTime: release?.time ?? null,
      calendarStatus: schedules[config.calendar].available ? "available" : "unavailable",
      value: Number.isFinite(value) ? value : null,
      priorPeriod: prior ? observationPeriod(prior) : null,
      priorValue: Number.isFinite(priorValue) ? priorValue : null,
      calculated12mChangePct: Number.isFinite(value) && Number.isFinite(base) && base !== 0 ? ((value / base) - 1) * 100 : null,
      monthlyChange,
      preliminary: latest?.footnotes?.some((note) => note.code === "P" || /preliminary/i.test(note.text ?? "")) ?? false,
    };
  } catch {
    return { ...config, observationPeriod: null, officialReleaseDate: null, officialReleaseTime: null, calendarStatus: schedules[config.calendar].available ? "available" : "unavailable", value: null, priorPeriod: null, priorValue: null, calculated12mChangePct: null, monthlyChange: null, preliminary: false };
  } finally { clearTimeout(timer); }
}

export async function readLatestBlsMacroReleases() {
  const schedules: Record<CalendarKey, ReleaseSchedule> = { cpi: { available: false, entries: new Map() }, empsit: { available: false, entries: new Map() } };
  if (!cache || cache.expiresAt <= Date.now()) {
    const [cpi, empsit] = await Promise.all([readSchedule("cpi"), readSchedule("empsit")]);
    schedules.cpi = cpi;
    schedules.empsit = empsit;
  }
  const rows = cache && cache.expiresAt > Date.now() ? cache.rows : await Promise.all(SERIES.map((series) => readSeries(series, schedules)));
  cache = { rows, expiresAt: Date.now() + CACHE_MS };
  const available = rows.some((row) => row.value !== null);
  return {
    available,
    rows,
    source: "U.S. Bureau of Labor Statistics · Public Data API v2",
    fetchedAt: new Date().toISOString(),
    classification: "official_published_macro_release",
    limitation: available ? "仅反映 BLS 已发布的美国宏观统计观测。CPI 的 12 月变化由同月指数计算；非农就业的月度变化以千人为单位。发布日期仅在 BLS 官方日历可访问且与观测期匹配时展示，日历不可获取时明确留空。该台不提供经济预测、市场影响判断或交易建议。" : "BLS 本次未返回可验证的已发布观测；系统未用原仪表板固定值、随机序列或预测值替代。",
  };
}

export const blsMacroEvidenceRouter = router({
  getLatestReleases: publicProcedure.query(() => readLatestBlsMacroReleases()),
});

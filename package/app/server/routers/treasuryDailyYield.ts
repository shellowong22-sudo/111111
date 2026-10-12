import { publicProcedure, router } from "../_core/trpc";

const CACHE_MS = 5 * 60_000;
const TENORS = ["1 Mo", "3 Mo", "6 Mo", "1 Yr", "2 Yr", "3 Yr", "5 Yr", "7 Yr", "10 Yr", "20 Yr", "30 Yr"] as const;
type TreasuryTenor = typeof TENORS[number];
type TreasuryPoint = { tenor: TreasuryTenor; yield: number };
type CacheValue = { expiresAt: number; value: Awaited<ReturnType<typeof readLatestTreasuryParYield>> };
let cached: CacheValue | null = null;

function csvRows(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [] as Array<Record<string, string>>;
  const parse = (line: string) => {
    const result: string[] = []; let field = ""; let quote = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quote = !quote;
      else if (char === ',' && !quote) { result.push(field.trim()); field = ""; }
      else field += char;
    }
    result.push(field.trim()); return result;
  };
  const header = parse(lines[0]).map((item) => item.replace(/^\uFEFF/, ""));
  return lines.slice(1).map((line) => Object.fromEntries(parse(line).map((value, index) => [header[index] ?? "", value])));
}

function parseObservationDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function readLatestTreasuryParYield() {
  const year = new Date().getUTCFullYear();
  const sourceUrl = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(sourceUrl, { headers: { "User-Agent": "finance-hub/official-treasury-evidence" }, signal: controller.signal });
    if (!response.ok) return { available: false, points: [] as TreasuryPoint[], observationDate: null, sourceUrl, limitation: `美国财政部本次返回 HTTP ${response.status}；系统未使用静态或模拟曲线替代。` };
    const rows = csvRows(await response.text()).map((row) => ({ row, date: parseObservationDate(row.Date ?? "") })).filter((item): item is { row: Record<string, string>; date: Date } => item.date !== null).sort((a, b) => b.date.getTime() - a.date.getTime());
    const latest = rows[0];
    if (!latest) return { available: false, points: [] as TreasuryPoint[], observationDate: null, sourceUrl, limitation: "美国财政部本次没有可解析的日度 PAR 收益率记录；系统保持真实空状态。" };
    const points = TENORS.map((tenor) => ({ tenor, yield: Number(latest.row[tenor]) })).filter((point): point is TreasuryPoint => Number.isFinite(point.yield));
    if (!points.length) return { available: false, points, observationDate: latest.row.Date ?? null, sourceUrl, limitation: "美国财政部记录不含可用期限点；系统未推算或补齐缺失收益率。" };
    return { available: true, points, observationDate: latest.row.Date, sourceUrl, limitation: "收益率为美国财政部基于纽约联储每个营业日下午约 3:30 取得的场外市场指示性买价所导出的 PAR 收益率；不是可执行报价、订单簿或交易建议。" };
  } catch {
    return { available: false, points: [] as TreasuryPoint[], observationDate: null, sourceUrl, limitation: "美国财政部官方日度收益率本次读取不可用；系统未以 ZIP 测试性曲线或合成数据替代。" };
  } finally { clearTimeout(timer); }
}

export const treasuryDailyYieldRouter = router({
  getLatest: publicProcedure.query(async () => {
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true, fetchedAt: new Date().toISOString(), classification: "official_daily_treasury_par_yield_reference" as const };
    const value = await readLatestTreasuryParYield();
    cached = { value, expiresAt: Date.now() + CACHE_MS };
    return { ...value, cached: false, fetchedAt: new Date().toISOString(), classification: "official_daily_treasury_par_yield_reference" as const };
  }),
});

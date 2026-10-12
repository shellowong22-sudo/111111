import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

export const INDUSTRY_GROUP_REFERENCE_SERIES = [
  { id: "INDPRO", label: "工业生产指数", unit: "指数", frequency: "月度", source: "FRED / Federal Reserve", category: "产业活动" },
  { id: "CPIAUCSL", label: "消费者价格指数", unit: "指数", frequency: "月度", source: "FRED / U.S. Bureau of Labor Statistics", category: "通胀" },
  { id: "UNRATE", label: "失业率", unit: "%", frequency: "月度", source: "FRED / U.S. Bureau of Labor Statistics", category: "就业" },
  { id: "RSAFS", label: "零售与餐饮销售", unit: "百万美元", frequency: "月度", source: "FRED / U.S. Census Bureau", category: "消费" },
  { id: "DGS10", label: "美国 10 年期国债收益率", unit: "%", frequency: "日度", source: "FRED / U.S. Treasury", category: "利率" },
  { id: "T10Y2Y", label: "10 年–2 年期限利差", unit: "百分点", frequency: "日度", source: "FRED / U.S. Treasury", category: "利率" },
  { id: "VIXCLS", label: "VIX 波动率指数", unit: "指数点", frequency: "日度", source: "FRED / Cboe", category: "风险偏好" },
] as const;

type SeriesDefinition = typeof INDUSTRY_GROUP_REFERENCE_SERIES[number];
type ReferencePoint = { observedAt: string; value: number };
type ReferenceSeries = SeriesDefinition & {
  status: "available" | "unavailable";
  limitation: string | null;
  latest: ReferencePoint | null;
  previous: ReferencePoint | null;
  change: number | null;
  history: ReferencePoint[];
};

function toPoint(line: string): ReferencePoint | null {
  const [date, raw] = line.split(",");
  const value = Number(raw);
  if (!date || !Number.isFinite(value) || raw === ".") return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : { observedAt: date, value };
}

export function parseIndustryReferenceCsv(text: string): ReferencePoint[] {
  return text.split(/\r?\n/).slice(1).flatMap((line) => {
    const point = toPoint(line.trim());
    return point ? [point] : [];
  });
}

async function readSeries(definition: SeriesDefinition, cutoff: string): Promise<ReferenceSeries> {
  const sourceUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}`;
  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const history = parseIndustryReferenceCsv(await response.text()).filter((point) => point.observedAt >= cutoff);
    const latest = history.at(-1) ?? null;
    const previous = history.length > 1 ? history.at(-2) ?? null : null;
    return {
      ...definition,
      status: latest ? "available" : "unavailable",
      limitation: latest ? null : "该时间窗内未返回可验证观测值；终端不使用缓存样例或推测值填充。",
      latest,
      previous,
      change: latest && previous ? latest.value - previous.value : null,
      history,
    };
  } catch {
    return {
      ...definition,
      status: "unavailable",
      limitation: "当前无法读取官方结构化序列；终端不使用随机路径、静态样例或第三方网页内容替代。",
      latest: null,
      previous: null,
      change: null,
      history: [],
    };
  }
}

type Snapshot = { asOf: string; requestedDays: number; series: ReferenceSeries[] };
let cachedSnapshot: Snapshot | null = null;
let cacheAt = 0;
let activeRead: Promise<Snapshot> | null = null;

export async function getIndustryGroupReferenceSnapshot(days: number): Promise<Snapshot> {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.requestedDays === days && now - cacheAt < 60_000) return cachedSnapshot;
  if (activeRead) return activeRead;
  const cutoff = new Date(now - days * 86_400_000).toISOString().slice(0, 10);
  activeRead = Promise.all(INDUSTRY_GROUP_REFERENCE_SERIES.map((definition) => readSeries(definition, cutoff)))
    .then((series) => {
      const snapshot = { asOf: new Date().toISOString(), requestedDays: days, series };
      cachedSnapshot = snapshot;
      cacheAt = Date.now();
      return snapshot;
    })
    .finally(() => { activeRead = null; });
  return activeRead;
}

export const industryGroupReferenceRouter = router({
  getSnapshot: publicProcedure
    .input(z.object({ days: z.number().int().min(30).max(1_825).default(365) }))
    .query(({ input }) => getIndustryGroupReferenceSnapshot(input.days)),
});

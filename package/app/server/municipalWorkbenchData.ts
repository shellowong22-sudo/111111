import { createHash } from "node:crypto";

export const ISSUER_TERRITORIES = [
  { id: "CA", name: "加利福尼亚州", english: "California", type: "州" },
  { id: "NYC", name: "纽约市", english: "New York City", type: "市" },
  { id: "TX", name: "德克萨斯州", english: "Texas", type: "州" },
  { id: "IL", name: "伊利诺伊州", english: "Illinois", type: "州" },
  { id: "FL", name: "佛罗里达州", english: "Florida", type: "州" },
  { id: "PA", name: "宾夕法尼亚州", english: "Pennsylvania", type: "州" },
  { id: "OH", name: "俄亥俄州", english: "Ohio", type: "州" },
  { id: "WA", name: "华盛顿州", english: "Washington", type: "州" },
] as const;
export type TerritoryId = (typeof ISSUER_TERRITORIES)[number]["id"];
type Definition = {
  id: string;
  label: string;
  unit: string;
  frequency: "月度" | "年度" | "日度";
  source: string;
  definition: string;
};
export type Observation = { date: string; value: number | null };
export type OfficialSeries = Definition & {
  history: Observation[];
  sourceUrl: string;
  checkedAt: string;
  lastSuccessAt: string | null;
  status: "available" | "stale" | "unavailable";
  reason: string | null;
  revision: string;
};
const cache = new Map<string, { value: OfficialSeries; until: number }>();
const pending = new Map<string, Promise<OfficialSeries>>();
const digest = (data: unknown) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 24);
export function parseOfficialCsv(
  text: string,
  expectedId: string
): Observation[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  const headers = lines.shift()?.split(",");
  if (
    !headers ||
    !["observation_date", "DATE"].includes(headers[0]) ||
    headers[1] !== expectedId
  )
    throw new Error("SOURCE_SCHEMA_CHANGED");
  const byDate = new Map<string, number | null>();
  for (const line of lines) {
    const [date, value] = line.split(",");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < "2010-01-01" ||
      date > new Date().toISOString().slice(0, 10)
    )
      continue;
    const number = value?.trim() && value !== "." ? Number(value) : NaN;
    if (
      byDate.has(date) &&
      byDate.get(date) !== (Number.isFinite(number) ? number : null)
    )
      throw new Error("SOURCE_DUPLICATE_DATE_CONFLICT");
    byDate.set(date, Number.isFinite(number) ? number : null);
  }
  const rows = [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
  if (!rows.some(r => r.value !== null)) throw new Error("SOURCE_EMPTY");
  return rows;
}
async function loadSeries(def: Definition): Promise<OfficialSeries> {
  const cached = cache.get(def.id);
  if (cached && cached.until > Date.now()) return cached.value;
  const inflight = pending.get(def.id);
  if (inflight) return inflight;
  const job = (async () => {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(def.id)}`;
    let reason = "SOURCE_UNAVAILABLE";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(9000),
          headers: { Accept: "text/csv" },
        });
        if (!response.ok) {
          reason = `HTTP_${response.status}`;
          if (response.status === 403 || response.status === 429) break;
          throw new Error(reason);
        }
        const text = await response.text();
        if (text.length > 2_000_000) throw new Error("SOURCE_TOO_LARGE");
        const history = parseOfficialCsv(text, def.id),
          checkedAt = new Date().toISOString();
        const value: OfficialSeries = {
          ...def,
          history,
          sourceUrl: url,
          checkedAt,
          lastSuccessAt: checkedAt,
          status: "available",
          reason: null,
          revision: digest(history),
        };
        cache.set(def.id, { value, until: Date.now() + 60_000 });
        return value;
      } catch (error) {
        reason = error instanceof Error ? error.message : "SOURCE_UNAVAILABLE";
      }
    }
    const last = cached?.value;
    const history =
      last?.lastSuccessAt &&
      Date.now() - Date.parse(last.lastSuccessAt) < 86_400_000
        ? last.history
        : [];
    const value: OfficialSeries = {
      ...def,
      history,
      sourceUrl: url,
      checkedAt: new Date().toISOString(),
      lastSuccessAt: last?.lastSuccessAt ?? null,
      status: history.length ? "stale" : "unavailable",
      reason,
      revision: digest(history),
    };
    cache.set(def.id, { value, until: Date.now() + 30_000 });
    return value;
  })().finally(() => pending.delete(def.id));
  pending.set(def.id, job);
  return job;
}
export function issuerDefinitions(id: TerritoryId): Definition[] {
  if (id === "NYC")
    return [
      {
        id: "NYNEWY1URN",
        label: "失业率",
        unit: "%",
        frequency: "月度",
        source: "BLS / FRED",
        definition:
          "纽约市（五区）失业率，未经季节调整；不以纽约州指标替代市级数据。",
      },
    ];
  return [
    {
      id: `${id}UR`,
      label: "失业率",
      unit: "%",
      frequency: "月度",
      source: "BLS / FRED",
      definition:
        "州级失业率，季节调整；可用于观察税基与就业环境，不是信用评级。",
    },
    {
      id: `${id}POP`,
      label: "常住人口",
      unit: "千人",
      frequency: "年度",
      source: "U.S. Census Bureau / FRED",
      definition: "州常住人口年度估计，反映税基规模；不是发行人债务余额。",
    },
    {
      id: `${id}PCPI`,
      label: "人均个人收入",
      unit: "美元",
      frequency: "年度",
      source: "BEA / FRED",
      definition: "名义人均个人收入，不等于家庭收入中位数或人均GDP。",
    },
    {
      id: `${id}NGSP`,
      label: "名义地区生产总值",
      unit: "百万美元",
      frequency: "年度",
      source: "BEA / FRED",
      definition: "当年价格州级GDP；增长率为名义变化，不是实际增长。",
    },
  ];
}
export async function getIssuerFundamentals(id: TerritoryId) {
  const territory = ISSUER_TERRITORIES.find(t => t.id === id)!;
  const series = await Promise.all(issuerDefinitions(id).map(loadSeries));
  return {
    territory,
    series,
    checkedAt: new Date().toISOString(),
    revision: digest(series.map(s => [s.id, s.revision])),
    scope:
      id === "NYC"
        ? "纽约市；年度州级数据不替代市级口径"
        : "州级经济基本面；不代表发行人财务报表或债券报价",
  };
}
export async function getMunicipalReference(kind: "curve" | "funding") {
  const defs: Definition[] =
    kind === "curve"
      ? [
          ["DGS1", "1Y"],
          ["DGS2", "2Y"],
          ["DGS3", "3Y"],
          ["DGS5", "5Y"],
          ["DGS7", "7Y"],
          ["DGS10", "10Y"],
          ["DGS20", "20Y"],
          ["DGS30", "30Y"],
        ].map(([id, label]) => ({
          id,
          label,
          unit: "%",
          frequency: "日度",
          source: "Federal Reserve H.15 / FRED",
          definition:
            "美国国债恒定期限收益率；不是市政债 BVAL 曲线或可执行报价。",
        }))
      : [
          ["SOFR", "担保隔夜融资 SOFR"],
          ["EFFR", "有效联邦基金 EFFR"],
          ["OBFR", "隔夜银行融资 OBFR"],
          ["DGS3MO", "3个月国债"],
        ].map(([id, label]) => ({
          id,
          label,
          unit: "%",
          frequency: "日度",
          source:
            id === "DGS3MO"
              ? "Federal Reserve H.15 / FRED"
              : "Federal Reserve Bank of New York / FRED",
          definition: "官方日度参考利率，按发布频率更新，不是逐笔交易价格。",
        }));
  // Limit each batch to four upstream requests and reuse per-series requests.
  const series: OfficialSeries[] = [];
  for (let i = 0; i < defs.length; i += 4)
    series.push(...(await Promise.all(defs.slice(i, i + 4).map(loadSeries))));
  return {
    series,
    revision: digest(series.map(s => [s.id, s.revision])),
    checkedAt: new Date().toISOString(),
  };
}

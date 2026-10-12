import { publicProcedure, router } from '../_core/trpc';
import { z } from 'zod';

const RATE_SERIES = [
  { id: 'MORTGAGE30US', label: '30 年固定抵押利率', term: '30Y', sourceUrl: 'https://fred.stlouisfed.org/series/MORTGAGE30US' },
  { id: 'MORTGAGE15US', label: '15 年固定抵押利率', term: '15Y', sourceUrl: 'https://fred.stlouisfed.org/series/MORTGAGE15US' },
  { id: 'MORTGAGE5US', label: '5/1 年可调抵押利率', term: '5/1 ARM', sourceUrl: 'https://fred.stlouisfed.org/series/MORTGAGE5US' },
] as const;

export type MortgageRateSeries = { id: string; label: string; term: string; observationDate: string | null; valuePct: number | null; changeBps: number | null; history: Array<{ date: string; valuePct: number }>; sourceUrl: string; status: 'available' | 'unavailable'; limitation: string };

export function parseFredMortgageRateCsv(csv: string, definition: typeof RATE_SERIES[number]): MortgageRateSeries {
  const points = csv.split(/\r?\n/).slice(1).flatMap((line) => { const [date, raw] = line.split(','); const valuePct = Number(raw); return date && raw && raw !== '.' && Number.isFinite(valuePct) ? [{ date: date.trim(), valuePct }] : []; });
  const latest = points.at(-1) ?? null; const previous = points.at(-2) ?? null;
  return { id: definition.id, label: definition.label, term: definition.term, observationDate: latest?.date ?? null, valuePct: latest?.valuePct ?? null, changeBps: latest && previous ? Number(((latest.valuePct - previous.valuePct) * 100).toFixed(1)) : null, history: points.slice(-104), sourceUrl: definition.sourceUrl, status: latest ? 'available' : 'unavailable', limitation: 'FRED 转载 Freddie Mac PMMS 周度抵押利率；不是 MBS/TBA 价格、OAS、指定贷款池利率或可交易报价。' };
}

async function fetchMortgageRate(definition: typeof RATE_SERIES[number]): Promise<MortgageRateSeries> {
  try { const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}`, { signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error(`FRED ${response.status}`); return parseFredMortgageRateCsv(await response.text(), definition); }
  catch { return { id: definition.id, label: definition.label, term: definition.term, observationDate: null, valuePct: null, changeBps: null, history: [], sourceUrl: definition.sourceUrl, status: 'unavailable', limitation: '当前无法读取 FRED/Freddie Mac 周度抵押利率；系统不以缓存样本、随机路径或代理数据替代。' }; }
}

type MortgageRateSnapshot = { asOf: string; sourceLabel: string; series: MortgageRateSeries[] };
let cached: MortgageRateSnapshot | null = null; let cachedAt = 0; let active: Promise<MortgageRateSnapshot> | null = null;
export async function getMortgageRateSnapshot(): Promise<MortgageRateSnapshot> { const now = Date.now(); if (cached && now - cachedAt < 30_000) return cached; if (active) return active; active = Promise.all(RATE_SERIES.map(fetchMortgageRate)).then((series) => { const snapshot = { asOf: new Date().toISOString(), sourceLabel: 'FRED / Freddie Mac PMMS', series }; cached = snapshot; cachedAt = Date.now(); return snapshot; }).finally(() => { active = null; }); return active; }

const FHFA_REGIONAL_URLS = {
  state: 'https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_state.csv',
  metro: 'https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_metro.csv',
} as const;
type FhfaGeography = keyof typeof FHFA_REGIONAL_URLS;
export type FhfaRegionalPoint = { period: string; index: number };
export type FhfaRegionalSeries = { id: string; name: string; latestPeriod: string | null; latestIndex: number | null; quarterChangePct: number | null; yearChangePct: number | null; history: FhfaRegionalPoint[] };
export type FhfaRegionalSnapshot = { asOf: string; geography: FhfaGeography; sourceUrl: string; status: 'available' | 'unavailable'; limitation: string; regions: FhfaRegionalSeries[] };

function splitCsvLine(line: string) { const cells: string[] = []; let cell = ''; let quoted = false; for (let index = 0; index < line.length; index += 1) { const char = line[index]; if (char === '"') { if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; } else if (char === ',' && !quoted) { cells.push(cell.trim()); cell = ''; } else cell += char; } cells.push(cell.trim()); return cells; }

export function parseFhfaRegionalCsv(csv: string, geography: FhfaGeography): FhfaRegionalSeries[] {
  const grouped = new Map<string, { id: string; name: string; history: FhfaRegionalPoint[] }>();
  for (const line of csv.split(/\r?\n/)) { if (!line.trim()) continue; const cells = splitCsvLine(line); const [nameOrCode, codeOrYear, yearOrQuarter, quarterOrIndex, indexRaw] = cells; const name = geography === 'state' ? nameOrCode : nameOrCode; const id = geography === 'state' ? nameOrCode : codeOrYear; const year = Number(geography === 'state' ? codeOrYear : yearOrQuarter); const quarter = Number(geography === 'state' ? yearOrQuarter : quarterOrIndex); const rawIndex = geography === 'state' ? quarterOrIndex : indexRaw; const index = Number(rawIndex); if (!id || !name || !Number.isInteger(year) || !Number.isInteger(quarter) || quarter < 1 || quarter > 4 || !Number.isFinite(index)) continue; const point = { period: `${year}Q${quarter}`, index }; const entry = grouped.get(id) ?? { id, name, history: [] }; entry.history.push(point); grouped.set(id, entry); }
  return [...grouped.values()].map((entry) => { const history = entry.history.sort((left, right) => left.period.localeCompare(right.period)).slice(-24); const latest = history.at(-1); const prior = history.at(-2); const priorYear = history.at(-5); const percentageChange = (current?: number, baseline?: number) => current != null && baseline != null && baseline !== 0 ? Number((((current - baseline) / baseline) * 100).toFixed(2)) : null; return { id: entry.id, name: entry.name, latestPeriod: latest?.period ?? null, latestIndex: latest?.index ?? null, quarterChangePct: percentageChange(latest?.index, prior?.index), yearChangePct: percentageChange(latest?.index, priorYear?.index), history }; }).sort((left, right) => left.name.localeCompare(right.name));
}

const regionalCache = new Map<FhfaGeography, { at: number; snapshot: FhfaRegionalSnapshot }>();
const regionalActive = new Map<FhfaGeography, Promise<FhfaRegionalSnapshot>>();
export async function getFhfaRegionalHpi(geography: FhfaGeography): Promise<FhfaRegionalSnapshot> { const cachedRegional = regionalCache.get(geography); if (cachedRegional && Date.now() - cachedRegional.at < 15 * 60_000) return cachedRegional.snapshot; const existing = regionalActive.get(geography); if (existing) return existing; const sourceUrl = FHFA_REGIONAL_URLS[geography]; const activeRequest: Promise<FhfaRegionalSnapshot> = (async (): Promise<FhfaRegionalSnapshot> => { try { const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(geography === 'state' ? 30_000 : 20_000) }); if (!response.ok) throw new Error(`FHFA ${response.status}`); const regions = parseFhfaRegionalCsv(await response.text(), geography); if (!regions.length) throw new Error('FHFA empty data'); const snapshot: FhfaRegionalSnapshot = { asOf: new Date().toISOString(), geography, sourceUrl, status: 'available', limitation: geography === 'state' ? 'FHFA All-Transactions 季度州级 HPI，反映同一单户住宅重复交易或再融资的平均价格变化；不是单项抵押物估值、抵押债评级或证券价格。' : 'FHFA All-Transactions 季度都市区级 HPI，反映都市区平均价格变化；不是 CMBS 资产权重、租金、入住率、DSCR、损失率或证券价格。', regions }; regionalCache.set(geography, { at: Date.now(), snapshot }); return snapshot; } catch { return { asOf: new Date().toISOString(), geography, sourceUrl, status: 'unavailable', limitation: '当前无法读取 FHFA 官方地区级 HPI 文件；系统不会以历史样例、第三方网页摘录或插补路径替代。', regions: [] }; } finally { regionalActive.delete(geography); } })(); regionalActive.set(geography, activeRequest); return activeRequest; }

export const mortgageResearchRouter = router({
  getRateSnapshot: publicProcedure.query(getMortgageRateSnapshot),
  getRegionalHpi: publicProcedure.input(z.object({ geography: z.enum(['state', 'metro']), query: z.string().trim().max(80).optional() })).query(async ({ input }) => { const snapshot = await getFhfaRegionalHpi(input.geography); const query = input.query?.toLocaleLowerCase(); return { ...snapshot, regions: (query ? snapshot.regions.filter((region) => `${region.name} ${region.id}`.toLocaleLowerCase().includes(query)) : snapshot.regions).slice(0, input.geography === 'state' ? 60 : 80) }; }),
  getOfficialHousingSources: publicProcedure.query(() => ({ generatedAt: new Date().toISOString(), sources: [
    { id: 'FHFA-HPI', label: 'FHFA House Price Index 数据集', frequency: '月度/季度/年度，视数据集而定', url: 'https://www.fhfa.gov/data/hpi/datasets', limitation: '房价指数，不是抵押债评级、损失或证券价格。' },
    { id: 'FREDDIE-SFLLD', label: 'Freddie Mac 单户贷款级数据', frequency: '月度表现数据', url: 'https://www.freddiemac.com/research/datasets/sf-loanlevel-dataset', limitation: '需注册及遵守许可；未接入时系统只提供来源索引。' },
    { id: 'FANNIE-LLPD', label: 'Fannie Mae 单户贷款表现数据', frequency: '披露更新', url: 'https://capitalmarkets.fanniemae.com/credit-risk-transfer/single-family-credit-risk-transfer/fannie-mae-single-family-loan-performance-data', limitation: '使用应遵守 Fannie Mae 的条款；不等同任意 MBS 池的完整表现。' },
    { id: 'FANNIE-MBS', label: 'Fannie Mae 抵押支持证券资料', frequency: '随发行与披露更新', url: 'https://capitalmarkets.fanniemae.com/mortgage-backed-securities', limitation: '机构产品与披露入口；不能替代具体证券文件、许可行情或成交回执。' },
    { id: 'GINNIE-DISC', label: 'Ginnie Mae 披露与报告', frequency: '按披露周期更新', url: 'https://www.ginniemae.gov/investors/disclosures_and_reports/Pages/default.aspx', limitation: '机构披露索引；不推断未披露的贷款池特征、价格或流动性。' },
    { id: 'HMDA-BROWSER', label: 'FFIEC/CFPB HMDA 数据浏览器', frequency: '年度数据并含修订版本', url: 'https://ffiec.cfpb.gov/data-browser/', limitation: '抵押贷款申请与发放统计；不是 MBS 持仓、CMBS 经营数据或证券表现。' },
  ] })),
});

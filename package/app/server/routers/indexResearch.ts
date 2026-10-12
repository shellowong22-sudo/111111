import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { fetchYahooChart } from '../realDataService';

type IndexObservation = { date: string; value: number };
type IndexReferenceDefinition = {
  id: string;
  label: string;
  unit: string;
  category: string;
  source: 'FRED' | 'Yahoo Finance public chart';
  providerSymbol?: string;
};
type IndexReferenceSeries = IndexReferenceDefinition & { status: 'available' | 'unavailable'; latest: number | null; observationDate: string | null; change: number | null; history: IndexObservation[] };
type IndexStudyMode = 'coverage' | 'benchmark-path' | 'cash-volatility' | 'rate-curve' | 'macro-dashboard' | 'single-benchmark' | 'input-audit' | 'cross-asset' | 'relative-path' | 'rebalancing' | 'derivatives-environment';

export const INDEX_REFERENCE_SERIES: IndexReferenceDefinition[] = [
  { id: 'SP500', label: '标普 500', unit: '指数', category: '美国宽基', source: 'FRED' },
  { id: 'NASDAQCOM', label: '纳斯达克综合', unit: '指数', category: '美国宽基', source: 'FRED' },
  { id: 'DJIA', label: '道琼斯工业平均', unit: '指数', category: '美国宽基', source: 'FRED' },
  { id: 'VIXCLS', label: 'VIX 波动率指数', unit: '指数', category: '波动率环境', source: 'FRED' },
  { id: 'DGS2', label: '美国 2 年期国债收益率', unit: '百分比', category: '利率期限', source: 'FRED' },
  { id: 'DGS10', label: '美国 10 年期国债收益率', unit: '百分比', category: '利率期限', source: 'FRED' },
  { id: 'DGS30', label: '美国 30 年期国债收益率', unit: '百分比', category: '利率期限', source: 'FRED' },
  { id: 'BAMLH0A0HYM2', label: '美国高收益 OAS', unit: '百分比', category: '信用环境', source: 'FRED' },
  { id: 'DEXUSEU', label: '美元兑欧元', unit: '美元/欧元', category: '汇率环境', source: 'FRED' },
  { id: 'DCOILWTICO', label: 'WTI 原油', unit: '美元/桶', category: '跨资产', source: 'FRED' },
  { id: 'FTSE100', label: '富时 100', unit: '指数', category: '欧洲宽基', source: 'Yahoo Finance public chart', providerSymbol: '^FTSE' },
  { id: 'DAX', label: '德国 DAX', unit: '指数', category: '欧洲宽基', source: 'Yahoo Finance public chart', providerSymbol: '^GDAXI' },
  { id: 'NIKKEI225', label: '日经 225', unit: '指数', category: '亚太宽基', source: 'Yahoo Finance public chart', providerSymbol: '^N225' },
  { id: 'HSI', label: '恒生指数', unit: '指数', category: '亚太宽基', source: 'Yahoo Finance public chart', providerSymbol: '^HSI' },
  { id: 'SSE', label: '上证综合指数', unit: '指数', category: '中国宽基', source: 'Yahoo Finance public chart', providerSymbol: '000001.SS' },
  { id: 'STOXX50', label: 'Euro Stoxx 50', unit: '指数', category: '欧洲宽基', source: 'Yahoo Finance public chart', providerSymbol: '^STOXX50E' },
];

export const INDEX_MODULE_CONFIG = {
  INDEX_HOME: { title: '指数综合分析中心 · 公开资料总览', focus: '公开宽基、利率、信用、汇率、能源与波动环境的共同日期参考读数。', mode: 'macro-dashboard' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA', 'FTSE100', 'DAX', 'NIKKEI225', 'HSI', 'SSE', 'VIXCLS', 'DGS10', 'BAMLH0A0HYM2'] },
  SECF: { title: 'SECF · 基准资料可读性目录', focus: '核验公开基准序列的实际可读性、最近观测与历史覆盖，不替代证券或指数成分资料。', mode: 'coverage' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA'] },
  HELP_INDX: { title: 'HELP INDX · 公开资料口径地图', focus: '将可读公开序列与未授权字段分开呈现，帮助识别阅读边界。', mode: 'coverage' as IndexStudyMode, seriesIds: ['SP500', 'DGS10', 'VIXCLS', 'BAMLH0A0HYM2'] },
  WEI: { title: 'WEI · 宽基指数共同日期路径', focus: '对比实际可读的全球宽基指数共同期间标准化路径，不把公开历史误称为交易所实时行情。', mode: 'benchmark-path' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA', 'FTSE100', 'DAX', 'NIKKEI225', 'HSI', 'SSE'] },
  WEIF: { title: 'WEIF · 现金与波动环境', focus: '将宽基现金指数与公开波动率环境并列阅读；免费资料不提供完整期货链、基差或可执行报价。', mode: 'cash-volatility' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'VIXCLS'] },
  WBIX: { title: 'WBIX · 债券指数环境', focus: '展示利率期限和高收益利差环境；不以宏观代理替代授权债券指数总回报或成分权重。', mode: 'rate-curve' as IndexStudyMode, seriesIds: ['DGS2', 'DGS10', 'DGS30', 'BAMLH0A0HYM2'] },
  GMM: { title: 'GMM · 宏观市场状态', focus: '汇集实际可读的利率、信用、汇率、能源与波动读数；不形成自动因果归因或预测。', mode: 'macro-dashboard' as IndexStudyMode, seriesIds: ['DGS2', 'DGS10', 'BAMLH0A0HYM2', 'DEXUSEU', 'DCOILWTICO', 'VIXCLS'] },
  IN: { title: 'IN · 单一基准区间观察', focus: '阅读选定宽基公开参考序列的期间路径、最后观察和数据覆盖。', mode: 'single-benchmark' as IndexStudyMode, seriesIds: ['SP500'] },
  INP: { title: 'INP · 输入篮子公开资料核验', focus: '显示可作为篮子研究参考的公开数据覆盖；不会补齐用户未提供的代码、权重或价格。', mode: 'input-audit' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA'] },
  CIX: { title: 'CIX · 自设指数参考覆盖', focus: '将自设指数工作流与可读公开市场参照分开，避免用合成历史替代真实篮子资料。', mode: 'input-audit' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA', 'VIXCLS'] },
  CIXB: { title: 'CIXB · 篮子输入完整性', focus: '提供可读市场参照覆盖，篮子权重、成分和集中度仅以用户已输入的原工作区数据为准。', mode: 'input-audit' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM'] },
  AGG: { title: 'AGG · 利率期限结构环境', focus: '以实际国债收益率曲线观察久期环境，不替代聚合债券指数净值、成分或指数方法。', mode: 'rate-curve' as IndexStudyMode, seriesIds: ['DGS2', 'DGS10', 'DGS30'] },
  FDFD: { title: 'FDFD · 因子资料可用性', focus: '审计可读宽基、利率、信用和波动环境序列；无授权因子收益时保持空状态。', mode: 'coverage' as IndexStudyMode, seriesIds: ['SP500', 'DGS10', 'BAMLH0A0HYM2', 'VIXCLS'] },
  OTHER_INDEX: { title: 'OTHER INDEX · 另类与主题参考覆盖', focus: '将全球股票、汇率与能源的实际公开观察分开展示，不虚构主题、ESG 或另类指数历史。', mode: 'cross-asset' as IndexStudyMode, seriesIds: ['SP500', 'FTSE100', 'DAX', 'NIKKEI225', 'HSI', 'SSE', 'DEXUSEU', 'DCOILWTICO'] },
  RRG: { title: 'RRG · 宽基相对路径', focus: '在共同日期上展示宽基公开参照的相对标准化路径；不伪造行业象限轨迹或成分权重。', mode: 'relative-path' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA', 'VIXCLS'] },
  WT: { title: 'WT · 跨市场共同窗口', focus: '并列读取全球股票、利率、美元、原油和波动环境的实际最近观察及区间变化。', mode: 'cross-asset' as IndexStudyMode, seriesIds: ['SP500', 'FTSE100', 'DAX', 'NIKKEI225', 'DGS10', 'DEXUSEU', 'DCOILWTICO', 'VIXCLS'] },
  CIXN: { title: 'CIXN · 指数命名与阅读路径', focus: '核对指数命名工作流可参照的公开基准覆盖，不改写原命名或治理内容。', mode: 'input-audit' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM'] },
  CIXS: { title: 'CIXS · 宏观环境快照', focus: '提供实际公开宏观市场快照与数据缺口提示，不自动生成情景结果或预测。', mode: 'macro-dashboard' as IndexStudyMode, seriesIds: ['DGS2', 'DGS10', 'BAMLH0A0HYM2', 'VIXCLS', 'DCOILWTICO'] },
  CIXR: { title: 'CIXR · 再平衡观察记录', focus: '记录公开参考序列的实际观察日期和区间变化，不将价格变化伪装为指数成分调整。', mode: 'rebalancing' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA'] },
  CIXC: { title: 'CIXC · 公司行动资料边界', focus: '对可读公开市场参照做覆盖核验；无权威公司行动资料时不填充示例事件。', mode: 'coverage' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA'] },
  CIXX: { title: 'CIXX · 计算输入可读性', focus: '显示原计算工作流可参考的公开输入资料状态，不替代用户设定、原计算或审计记录。', mode: 'input-audit' as IndexStudyMode, seriesIds: ['SP500', 'DGS10', 'VIXCLS'] },
  CIXI: { title: 'CIXI · 指数发行资料覆盖', focus: '区分可读公开市场参照与需授权的指数发行资料，避免将参考序列误作发行人资料。', mode: 'coverage' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA', 'DGS10'] },
  INDEX_DERIV: { title: 'INDEX DERIV · 波动率环境', focus: '查看公开波动率与宽基指数的共同期间路径；期权链、Greeks、期货曲线和可执行报价未授权时保持空状态。', mode: 'derivatives-environment' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'VIXCLS'] },
  BBG: { title: 'BBG · 指数参考资料目录', focus: '列示终端内实际可读的公开基准及其最近观察；不冒充授权指数数据库、成分或许可资料。', mode: 'coverage' as IndexStudyMode, seriesIds: ['SP500', 'NASDAQCOM', 'DJIA', 'FTSE100', 'DAX', 'NIKKEI225', 'HSI', 'SSE', 'DGS10', 'BAMLH0A0HYM2', 'VIXCLS'] },
} as const;

export type IndexModuleId = keyof typeof INDEX_MODULE_CONFIG;
const moduleIds = Object.keys(INDEX_MODULE_CONFIG) as [IndexModuleId, ...IndexModuleId[]];
const moduleInput = z.enum(moduleIds);
const rangeInput = z.enum(['1y', '3y', '5y', 'max']);
const seriesCache = new Map<string, { at: number; value: IndexReferenceSeries }>();
const pendingSeries = new Map<string, Promise<IndexReferenceSeries>>();

export function parseIndexFredCsv(csv: string): IndexObservation[] {
  return csv.split(/\r?\n/).slice(1).flatMap((line) => {
    const [date, raw] = line.split(','); const value = Number(raw);
    return date && raw && raw !== '.' && Number.isFinite(value) ? [{ date: date.trim(), value }] : [];
  });
}

function startForRange(range: z.infer<typeof rangeInput>) {
  if (range === 'max') return null;
  const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() - Number(range.slice(0, -1)));
  return date.toISOString().slice(0, 10);
}

async function fetchReferenceSeries(definition: IndexReferenceDefinition): Promise<IndexReferenceSeries> {
  const cached = seriesCache.get(definition.id);
  if (cached && Date.now() - cached.at < 30_000) return cached.value;
  const inFlight = pendingSeries.get(definition.id); if (inFlight) return inFlight;
  const request = (async (): Promise<IndexReferenceSeries> => {
    try {
      let history: IndexObservation[] = [];
      if (definition.source === 'FRED') {
        const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${definition.id}`, { signal: AbortSignal.timeout(12_000) });
        if (!response.ok) throw new Error(`FRED_${response.status}`);
        history = parseIndexFredCsv(await response.text());
      } else {
        const chart = await fetchYahooChart(definition.providerSymbol ?? definition.id, '5y', '1d');
        history = (chart?.history ?? [])
          .map(point => ({ date: point.date, value: point.value }))
          .filter(point => point.date && Number.isFinite(point.value));
      }
      const latest = history.at(-1) ?? null; const previous = history.at(-2) ?? null;
      return { ...definition, status: latest ? 'available' : 'unavailable', latest: latest?.value ?? null, observationDate: latest?.date ?? null, change: latest && previous ? Number((latest.value - previous.value).toFixed(6)) : null, history };
    } catch {
      return { ...definition, status: 'unavailable', latest: null, observationDate: null, change: null, history: [] };
    }
  })();
  pendingSeries.set(definition.id, request);
  try { const value = await request; seriesCache.set(definition.id, { at: Date.now(), value }); return value; } finally { pendingSeries.delete(definition.id); }
}

function toTimeline(series: IndexReferenceSeries[]) {
  const rows = new Map<string, Record<string, number | string>>();
  for (const row of series) {
    const base = row.history[0]?.value ?? null;
    for (const point of row.history) {
      const record = rows.get(point.date) ?? { date: point.date };
      record[`value_${row.id}`] = point.value;
      if (base !== null && base !== 0) record[`base100_${row.id}`] = Number(((point.value / base) * 100).toFixed(4));
      rows.set(point.date, record);
    }
  }
  return [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function buildIndexModuleStudy(moduleId: IndexModuleId, series: IndexReferenceSeries[], range: z.infer<typeof rangeInput>) {
  const config = INDEX_MODULE_CONFIG[moduleId];
  const readings = series.map((row) => {
    const first = row.history[0] ?? null; const last = row.history.at(-1) ?? null;
    const windowChangePercent = first && last && first.value !== 0 ? Number((((last.value - first.value) / Math.abs(first.value)) * 100).toFixed(3)) : null;
    return { id: row.id, label: row.label, unit: row.unit, category: row.category, status: row.status, latest: last?.value ?? null, observationDate: last?.date ?? null, dailyChange: row.change, historyPoints: row.history.length, historyStart: first?.date ?? null, windowChangePercent };
  });
  return {
    moduleId,
    title: config.title,
    focus: config.focus,
    mode: config.mode,
    range,
    asOf: new Date().toISOString(),
    series,
    readings,
    timeline: toTimeline(series),
    sourceBoundary: '仅展示本次服务端实际读取的 FRED 官方公开序列和 Yahoo Finance 公共历史观察，并保留各序列自己的发布日期与来源。数据并非交易所实时行情、可执行报价、完整指数成分、授权指数总回报、期货链、期权链或投资建议；免费资料不可读时保持真实空状态。',
    sources: [...new Set(series.map(row => row.source))],
  };
}

export const indexResearchRouter = router({
  getModuleStudy: publicProcedure.input(z.object({ moduleId: moduleInput, range: rangeInput.default('3y') })).query(async ({ input }) => {
    const config = INDEX_MODULE_CONFIG[input.moduleId]; const start = startForRange(input.range);
    const definitions = config.seriesIds.map((id) => INDEX_REFERENCE_SERIES.find((row) => row.id === id)).filter((row): row is IndexReferenceDefinition => Boolean(row));
    const loaded = await Promise.all(definitions.map(fetchReferenceSeries));
    const series = loaded.map((row) => ({ ...row, history: start ? row.history.filter((point) => point.date >= start) : row.history }));
    return buildIndexModuleStudy(input.moduleId, series, input.range);
  }),
});

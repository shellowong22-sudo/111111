export type EconomicPoint = { date: string; value: number };
export type EconomicSeries = { id: string; label: string; unit: string; frequency: string; sourceUrl: string; retrievedAt: string; status: 'available' | 'unavailable'; error: string | null; history: EconomicPoint[]; checksum?:string;changedAt?:string;updateState?:'initial'|'unchanged'|'changed';changes?:Array<{date:string;before:number|null;after:number|null}>; metadata?: Record<string, string | number | null> };
export const ECONOMIC_SERIES = {
  STLFSI4: ['美国金融压力指数', '标准差', '周度'],
  VIXCLS: ['VIX 恐慌指数', '指数点', '工作日'],
  NFCI: ['芝加哥联储全国金融条件指数', '标准差', '周度'],
  ANFCI: ['芝加哥联储调整金融条件指数', '标准差', '周度'],
  BAMLC0A0CM: ['美国投资级公司债期权调整利差', '%', '工作日'],
  BAMLH0A0HYM2: ['美国高收益公司债期权调整利差', '%', '工作日'],
  A191RL1Q225SBEA: ['美国实际GDP季环比年化增长', '%', '季度'],
  CPIAUCSL: ['美国消费者价格指数', '1982–84=100', '月度'],
  GDPC1: ['美国实际国内生产总值', '十亿2017年链式美元', '季度'],
  GDPPOT: ['美国实际潜在国内生产总值', '十亿2017年链式美元', '季度'],
  TCU: ['美国总体产能利用率', '%', '月度'],
  MCUMFN: ['美国制造业产能利用率', '%', '月度'],
  ISRATIO: ['美国工商库存销售比', '比率', '月度'],
  BUSINV: ['美国工商库存金额', '百万美元', '月度'],
  JTSJOL: ['美国职位空缺', '千人', '月度'],
  UNEMPLOY: ['美国失业人数', '千人', '月度'],
  UNRATE: ['美国失业率', '%', '月度'],
  OPHNFB: ['美国非农商业劳动生产率', '2017=100', '季度'],
  OUTNFB: ['美国非农商业实际增加值产出', '2017=100', '季度'],
  HOANBS: ['美国非农商业总工时', '2017=100', '季度'],
  GSCPI: ['全球供应链压力指数', '标准差', '月度'],
  WALCL: ['美联储总资产', '百万美元', '周度'],
  TREAST: ['美联储持有国债', '百万美元', '周度'],
  WSHOMCB: ['美联储持有MBS', '百万美元', '周度'],
  WRESBAL: ['存款机构准备金余额', '百万美元', '周度'],
  WTREGEN: ['财政部一般账户', '百万美元', '周度'],
  WCURCIR: ['流通货币', '百万美元', '周度'],
  RRPONTSYD: ['隔夜逆回购余额', '十亿美元', '工作日'],
  IORB: ['准备金余额利率', '%', '工作日'],
  WLCFLPCL: ['美联储一级信贷', '百万美元', '周度'],
  WLCFLP: ['美联储贷款总额', '百万美元', '周度'],
  DFF: ['美国有效联邦基金利率', '%', '工作日'],
  SOFR: ['有担保隔夜融资利率', '%', '工作日'],
  DTB3: ['美国3个月国库券贴现收益率', '%', '工作日'],
  TGCRRATE: ['美国三方一般抵押品回购利率', '%', '工作日'],
  DFEDTARU: ['美国联邦基金目标区间上限', '%', '工作日'],
  DFEDTARL: ['美国联邦基金目标区间下限', '%', '工作日'],
  ECBDFR: ['欧洲央行存款便利利率', '%', '工作日'],
  IRSTCI01GBM156N: ['英国短期同业利率', '%', '月度'],
  IRSTCI01JPM156N: ['日本短期同业利率', '%', '月度'],
  DEXUSEU: ['美元每欧元', '美元/欧元', '工作日'],
  DEXJPUS: ['日元每美元', '日元/美元', '工作日'],
  DEXUSUK: ['美元每英镑', '美元/英镑', '工作日'],
  DEXCHUS: ['人民币每美元', '人民币/美元', '工作日'],
  DEXUSAL: ['美元每澳元', '美元/澳元', '工作日'],
  DEXSZUS: ['瑞士法郎每美元', '瑞士法郎/美元', '工作日'],
  DEXKOUS: ['韩元每美元', '韩元/美元', '工作日'],
  DEXBZUS: ['巴西雷亚尔每美元', '雷亚尔/美元', '工作日'],
} as const;
export type EconomicSeriesId = keyof typeof ECONOMIC_SERIES;
export const ECONOMIC_GROUPS = {
  'wfii-stress': ['STLFSI4','VIXCLS'],
  'wfii-fx': ['DEXUSEU','DEXJPUS','DEXUSUK','DEXCHUS','DEXUSAL','DEXSZUS','DEXKOUS','DEXBZUS'],
  tayl: ['GDPC1', 'GDPPOT', 'CPIAUCSL', 'DFF'],
  'fcon-market': ['NFCI', 'ANFCI', 'BAMLC0A0CM', 'BAMLH0A0HYM2', 'SOFR', 'DFF', 'DTB3', 'TGCRRATE'],
  fcon: ['NFCI', 'ANFCI', 'BAMLC0A0CM', 'BAMLH0A0HYM2', 'A191RL1Q225SBEA', 'CPIAUCSL'],
  ecsu: ['TCU', 'MCUMFN', 'ISRATIO', 'BUSINV', 'JTSJOL', 'UNEMPLOY', 'UNRATE', 'OPHNFB', 'OUTNFB', 'HOANBS', 'GSCPI'],
  fdsp: ['WALCL', 'TREAST', 'WSHOMCB', 'WRESBAL', 'WTREGEN', 'WCURCIR', 'RRPONTSYD', 'IORB', 'WLCFLPCL', 'DFF'],
  cbrt: ['DFEDTARU', 'DFEDTARL', 'ECBDFR', 'CPIAUCSL', 'DEXUSEU'],
} as const satisfies Record<string, readonly EconomicSeriesId[]>;
export type EconomicGroup = keyof typeof ECONOMIC_GROUPS;
export type EconomicSnapshot = { retrievedAt: string; series: EconomicSeries[] };

export function seriesHistory(snapshot: EconomicSnapshot | undefined, id: string): EconomicPoint[] {
  return snapshot?.series.find(series => series.id === id)?.history ?? [];
}
export function latestValue(snapshot: EconomicSnapshot | undefined, id: string) {
  return seriesHistory(snapshot, id).at(-1)?.value ?? null;
}
export function periodLast(points: EconomicPoint[], period: 'month' | 'quarter' = 'month') {
  const map = new Map<string, EconomicPoint>();
  for (const point of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = period === 'month' ? point.date.slice(0, 7) : `${point.date.slice(0, 4)}-Q${Math.floor((Number(point.date.slice(5, 7)) - 1) / 3) + 1}`;
    map.set(key, { date: key, value: point.value });
  }
  return [...map.values()];
}
/** Only joins exact observation periods, never interpolates or forward-fills. */
export function alignSeries(series: Record<string, EconomicPoint[]>, intersection = false) {
  const maps = Object.entries(series).map(([key, points]) => [key, new Map(points.map(point => [point.date, point.value]))] as const);
  const dates = [...new Set(maps.flatMap(([, map]) => [...map.keys()]))].sort();
  return dates.filter(date => !intersection || maps.every(([, map]) => map.has(date))).map(date => ({ date, ...Object.fromEntries(maps.map(([key, map]) => [key, map.get(date) ?? null])) })) as Array<{ date: string } & Record<string, string | number | null>>;
}
export function pearson(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return null;
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const xx = points.reduce((sum, p) => sum + (p.x - x) ** 2, 0);
  const yy = points.reduce((sum, p) => sum + (p.y - y) ** 2, 0);
  if (!xx || !yy) return null;
  return points.reduce((sum, p) => sum + (p.x - x) * (p.y - y), 0) / Math.sqrt(xx * yy);
}
/** FCI at quarter end vs later published quarterly GDP growth; descriptive, not causal. */
export function laggedGrowth(fci: EconomicPoint[], gdp: EconomicPoint[], lagQuarters: number) {
  const quarterMeans = new Map<string, number[]>();
  for (const point of fci) {
    const key = `${point.date.slice(0, 4)}-Q${Math.floor((Number(point.date.slice(5, 7)) - 1) / 3) + 1}`;
    quarterMeans.set(key, [...(quarterMeans.get(key) ?? []), point.value]);
  }
  return gdp.flatMap(point => {
    const date = new Date(`${point.date}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - lagQuarters * 3);
    const key = `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    const values = quarterMeans.get(key);
    return values?.length ? [{ date: point.date, fciPeriod: key, x: values.reduce((sum, value) => sum + value, 0) / values.length, y: point.value }] : [];
  });
}

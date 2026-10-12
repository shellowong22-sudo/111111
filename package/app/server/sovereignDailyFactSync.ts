import { fetchMultipleFred, fetchOecdTenYearGovernmentYields, fetchSovereignMacroData, fetchTreasuryAuctions } from './realDataService';
import { upsertSovereignDailyFactSnapshot, type SovereignDailyFactSnapshotInput } from './db';

const utcDay = () => new Date().toISOString().slice(0, 10);
const latestObservation = (dates: Array<string | null | undefined>) => dates.filter((date): date is string => Boolean(date)).sort().at(-1) ?? utcDay();
const FRED_SERIES = ['DGS1MO', 'DGS3MO', 'DGS2', 'DGS5', 'DGS10', 'DGS30', 'T10Y2Y', 'T10Y3M', 'DFII10', 'FEDFUNDS', 'SOFR'];
const OECD_COUNTRIES = ['AU', 'CA', 'KR', 'FR', 'IT', 'ES', 'BE', 'CH', 'DK', 'NL', 'NO', 'NZ', 'PL', 'PT', 'SE'];
const MACRO_COUNTRIES = ['US', 'DE', 'JP', 'GB', 'FR', 'IT', 'ES', 'CN', 'BR', 'IN', 'MX', 'AU', 'CA', 'KR'];

function statusFor(count: number, expected: number): 'available' | 'partial' | 'unavailable' {
  if (count === 0) return 'unavailable';
  return count >= expected ? 'available' : 'partial';
}

/**
 * 同步公开、可追溯的原始事实数据。该函数不计算预测、信号、评分或投资结论；每个来源失败时保存不可用状态，确保前端不会用旧例子伪装为新数据。
 */
export async function syncDailySovereignFacts() {
  const [fredResult, auctionResult, oecdResult, macroResult] = await Promise.allSettled([
    fetchMultipleFred(FRED_SERIES),
    fetchTreasuryAuctions(50),
    fetchOecdTenYearGovernmentYields(OECD_COUNTRIES),
    fetchSovereignMacroData(MACRO_COUNTRIES),
  ]);

  const fred = fredResult.status === 'fulfilled' ? fredResult.value : {};
  const fredLatest = Object.fromEntries(Object.entries(fred).map(([series, values]) => [series, values.at(-1) ?? null]));
  const fredCount = Object.values(fredLatest).filter(Boolean).length;
  const auctions = auctionResult.status === 'fulfilled' ? auctionResult.value : [];
  const oecd = oecdResult.status === 'fulfilled' ? oecdResult.value : {};
  const oecdValues = Object.values(oecd);
  const oecdCount = oecdValues.filter(Boolean).length;
  const macro = macroResult.status === 'fulfilled' ? macroResult.value : {};
  const macroCount = Object.values(macro).filter((row) => row.gdpUsd !== null || row.debtGdpPct !== null || row.inflationPct !== null || row.currentAccountPct !== null).length;
  const today = utcDay();

  const facts: SovereignDailyFactSnapshotInput[] = [
    { snapshotKey: `fred-rates:${today}`, sourceKey: 'fred-rates', sourceLabel: 'FRED 利率与期限差', sourceUrl: 'https://fred.stlouisfed.org/', observationDate: latestObservation(Object.values(fredLatest).map((row) => row?.date)), status: statusFor(fredCount, FRED_SERIES.length), recordCount: fredCount, coveredModules: ['3', '6', '9', '12', '13', '14', '17', '19', '20', '24'], payload: { series: fredLatest, requestedSeries: FRED_SERIES }, limitation: fredCount ? '仅保存公开 FRED 原始观测与观测日；不同序列的发布频率不同。' : '本次未取得 FRED 可用观测；系统未以静态或模拟利率替代。' },
    { snapshotKey: `treasury-auctions:${today}`, sourceKey: 'treasury-auctions', sourceLabel: '美国财政部拍卖结果', sourceUrl: 'https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/', observationDate: latestObservation(auctions.map((row) => row.recordDate || row.auctionDate)), status: auctions.length ? 'available' : 'unavailable', recordCount: auctions.length, coveredModules: ['3', '6', '10', '15', '21', '23'], payload: { auctions }, limitation: auctions.length ? '官方一级市场拍卖参考；观测期使用财政部记录日，计划或拍卖日期保留在原始载荷中；不包含经授权的二级市场 bid/ask、成交或可执行报价。' : '本次未取得官方拍卖记录；系统未以示例发行或模拟需求替代。' },
    { snapshotKey: `fred-oecd-10y:${today}`, sourceKey: 'fred-oecd-10y', sourceLabel: 'FRED / OECD 十年期政府债参考', sourceUrl: 'https://fred.stlouisfed.org/', observationDate: latestObservation(oecdValues.map((row) => row?.dataDate)), status: statusFor(oecdCount, OECD_COUNTRIES.length), recordCount: oecdCount, coveredModules: ['4', '8', '11', '13'], payload: { countries: oecd, requestedCountries: OECD_COUNTRIES }, limitation: oecdCount ? '仅保存 FRED 发布的 OECD 月度十年期政府债原始观测；不可得国家保持为空。' : '本次未取得 FRED/OECD 可用观测；系统未生成替代收益率。' },
    { snapshotKey: `world-bank-macro:${today}`, sourceKey: 'world-bank-macro', sourceLabel: 'World Bank 宏观事实', sourceUrl: 'https://data.worldbank.org/', observationDate: String(Math.max(...Object.values(macro).map((row) => row.year || 0), 0) || new Date().getUTCFullYear()), status: statusFor(macroCount, MACRO_COUNTRIES.length), recordCount: macroCount, coveredModules: ['4', '8', '11', '12'], payload: { countries: macro, requestedCountries: MACRO_COUNTRIES }, limitation: macroCount ? '仅保存 World Bank 已发布的增长、债务、通胀和外部账户观测；宏观数据可能存在年/季发布滞后。' : '本次未取得 World Bank 可用观测；系统未以预测或示例宏观数据替代。' },
  ];
  await Promise.all(facts.map(upsertSovereignDailyFactSnapshot));
  return { syncedAt: new Date().toISOString(), sources: facts.map(({ sourceKey, status, recordCount, observationDate, coveredModules }) => ({ sourceKey, status, recordCount, observationDate, coveredModules })) };
}

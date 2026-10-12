import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { getAllCurves, getCurveLatestSnapshot } from '../curves-db';
import { fetchMultipleYahoo, fetchOecdTenYearGovernmentYields, fetchSovereignMacroData } from '../realDataService';

const SUPPORTED_COUNTRIES = ['US', 'DE', 'JP', 'GB', 'FR', 'IT', 'ES', 'CN', 'BR', 'IN', 'MX', 'AU', 'CA', 'KR', 'BE', 'CH', 'DK', 'NL', 'NO', 'NZ', 'PL', 'PT', 'SE'] as const;
const currencyPairByCountry: Partial<Record<(typeof SUPPORTED_COUNTRIES)[number], { symbol: string; label: string }>> = {
  US: { symbol: 'DX-Y.NYB', label: '美元指数' },
  DE: { symbol: 'EURUSD=X', label: 'EUR/USD' },
  FR: { symbol: 'EURUSD=X', label: 'EUR/USD' },
  IT: { symbol: 'EURUSD=X', label: 'EUR/USD' },
  ES: { symbol: 'EURUSD=X', label: 'EUR/USD' },
  JP: { symbol: 'JPY=X', label: 'USD/JPY' },
  GB: { symbol: 'GBPUSD=X', label: 'GBP/USD' },
  CN: { symbol: 'CNY=X', label: 'USD/CNY' },
  BR: { symbol: 'BRL=X', label: 'USD/BRL' },
  IN: { symbol: 'INR=X', label: 'USD/INR' },
  MX: { symbol: 'MXN=X', label: 'USD/MXN' },
  AU: { symbol: 'AUDUSD=X', label: 'AUD/USD' },
  CA: { symbol: 'CAD=X', label: 'USD/CAD' },
  KR: { symbol: 'KRW=X', label: 'USD/KRW' },
  BE: { symbol: 'EURUSD=X', label: 'EUR/USD' },
  CH: { symbol: 'CHF=X', label: 'USD/CHF' },
  DK: { symbol: 'DKK=X', label: 'USD/DKK' },
  NL: { symbol: 'EURUSD=X', label: 'EUR/USD' },
  NO: { symbol: 'NOK=X', label: 'USD/NOK' },
  NZ: { symbol: 'NZDUSD=X', label: 'NZD/USD' },
  PL: { symbol: 'PLN=X', label: 'USD/PLN' },
  PT: { symbol: 'EURUSD=X', label: 'EUR/USD' },
  SE: { symbol: 'SEK=X', label: 'USD/SEK' },
};

const codeToName: Record<string, string> = { US: '美国', DE: '德国', JP: '日本', GB: '英国', FR: '法国', IT: '意大利', ES: '西班牙', CN: '中国', BR: '巴西', IN: '印度', MX: '墨西哥', AU: '澳大利亚', CA: '加拿大', KR: '韩国', BE: '比利时', CH: '瑞士', DK: '丹麦', NL: '荷兰', NO: '挪威', NZ: '新西兰', PL: '波兰', PT: '葡萄牙', SE: '瑞典' };
const countryAliases: Record<string, string[]> = { US: ['US', '美国'], DE: ['DE', '德国'], JP: ['JP', '日本'], GB: ['GB', '英国'], FR: ['FR', '法国'], IT: ['IT', '意大利'], ES: ['ES', '西班牙'], CN: ['CN', '中国'], BR: ['BR', '巴西'], IN: ['IN', '印度'], MX: ['MX', '墨西哥'], AU: ['AU', '澳大利亚'], CA: ['CA', '加拿大'], KR: ['KR', '韩国'], BE: ['BE', '比利时'], CH: ['CH', '瑞士'], DK: ['DK', '丹麦'], NL: ['NL', '荷兰'], NO: ['NO', '挪威'], NZ: ['NZ', '新西兰'], PL: ['PL', '波兰'], PT: ['PT', '葡萄牙'], SE: ['SE', '瑞典'] };
const preferredCurveByCountry: Record<string, string> = { US: 'USGG10YR', DE: 'GDBR10', JP: 'JGBK10', GB: 'GUKG10' };
const currencyByCountry: Record<string, string> = { US: 'USD', DE: 'EUR', JP: 'JPY', GB: 'GBP', FR: 'EUR', IT: 'EUR', ES: 'EUR', CN: 'CNY', BR: 'BRL', IN: 'INR', MX: 'MXN', AU: 'AUD', CA: 'CAD', KR: 'KRW', BE: 'EUR', CH: 'CHF', DK: 'DKK', NL: 'EUR', NO: 'NOK', NZ: 'NZD', PL: 'PLN', PT: 'EUR', SE: 'SEK' };

function freshnessFromDate(dataDate: string | null, reviewAfterDays: number, basis: string) {
  if (!dataDate) return { status: 'unavailable' as const, label: '缺少观测日期', reviewAfterDays, validUntil: null, basis };
  const recordedAt = new Date(`${dataDate.slice(0, 10)}T00:00:00.000Z`);
  const ageDays = Math.max(0, Math.floor((Date.now() - recordedAt.getTime()) / 86_400_000));
  const validUntil = new Date(recordedAt.getTime() + reviewAfterDays * 86_400_000).toISOString();
  const status = ageDays <= reviewAfterDays ? 'current' as const : ageDays <= reviewAfterDays * 2 ? 'review' as const : 'stale' as const;
  const label = status === 'current' ? `${basis} · 已过 ${ageDays} 天` : status === 'review' ? `${basis} · 建议复核（已过 ${ageDays} 天）` : `${basis} · 已超复核期（已过 ${ageDays} 天）`;
  return { status, label, ageDays, reviewAfterDays, validUntil, basis };
}

function macroFreshness(year: number) {
  const ageYears = Math.max(0, new Date().getUTCFullYear() - year);
  const status = ageYears <= 1 ? 'current' as const : 'review' as const;
  return { status, label: ageYears <= 1 ? `年度参考 · ${year}` : `历史年度参考 · ${year}（建议复核）`, ageYears, reviewAfterDays: null, validUntil: null, basis: 'World Bank 年度数据' };
}

function tenorValue(points: Array<{ period: string; value: string }>, tenor: string) {
  const match = points.find((point) => point.period.trim().toUpperCase() === tenor);
  const value = match ? Number(match.value) : null;
  return Number.isFinite(value) ? value : null;
}

function observedWithin(dataDate: string | null | undefined, maximumAgeDays: number) {
  if (!dataDate) return false;
  const observed = new Date(dataDate.length <= 10 ? `${dataDate}T00:00:00.000Z` : dataDate).getTime();
  return Number.isFinite(observed) && Date.now() - observed <= maximumAgeDays * 86_400_000;
}

export const sovereignComparisonRouter = router({
  getCrossCountry: publicProcedure
    .input(z.object({ countries: z.array(z.enum(SUPPORTED_COUNTRIES)).min(2).max(6).default(['US', 'DE', 'JP', 'GB']) }))
    .query(async ({ input }) => {
      const retrievedAt = new Date().toISOString();
      const [allCurves, macro, fx, oecdTenYear] = await Promise.all([
        getAllCurves(),
        fetchSovereignMacroData(input.countries),
        fetchMultipleYahoo(input.countries.map((country) => currencyPairByCountry[country]?.symbol).filter((symbol): symbol is string => Boolean(symbol)), '1mo', true),
        fetchOecdTenYearGovernmentYields(input.countries),
      ]);
      const rows = await Promise.all(input.countries.map(async (country) => {
        const candidates = allCurves.filter((curve) => countryAliases[country]?.includes(curve.country ?? '') && curve.type === 'Government');
        const snapshots = await Promise.all(candidates.map(async (curve) => ({ curve, points: await getCurveLatestSnapshot(curve.id) })));
        const selected = snapshots.sort((a, b) => {
          const pointDifference = b.points.length - a.points.length;
          if (pointDifference !== 0) return pointDifference;
          return Number(b.curve.curveId === preferredCurveByCountry[country]) - Number(a.curve.curveId === preferredCurveByCountry[country]);
        })[0];
        const pair = currencyPairByCountry[country];
        const pairQuote = pair ? fx[pair.symbol] : undefined;
        const macroRow = macro[country];
        const oecdReference = oecdTenYear[country];
        const localCurve = selected?.points.length && observedWithin(selected.points[0]?.dataDate, 14) ? {
          curveId: selected.curve.curveId,
          dataDate: selected.points[0]?.dataDate ?? null,
          y2: tenorValue(selected.points, '2Y'),
          y5: tenorValue(selected.points, '5Y'),
          y10: tenorValue(selected.points, '10Y'),
          y30: tenorValue(selected.points, '30Y'),
          frequency: '本地曲线快照',
          source: '已导入曲线数据库快照',
          freshness: freshnessFromDate(selected.points[0]?.dataDate ?? null, 3, '本地快照'),
        } : oecdReference ? {
          curveId: oecdReference.seriesId,
          dataDate: oecdReference.dataDate,
          y2: null,
          y5: null,
          y10: oecdReference.value,
          y30: null,
          frequency: '月度',
          source: `${oecdReference.source} 月度历史参考`,
          freshness: freshnessFromDate(oecdReference.dataDate, 62, 'FRED/OECD 月度参考'),
        } : {
          curveId: `${country}-GOVT-CURVE-UNAVAILABLE`,
          dataDate: null,
          y2: null,
          y5: null,
          y10: null,
          y30: null,
          frequency: '未返回',
          source: '政府曲线源未返回有效节点',
          freshness: freshnessFromDate(null, 1, '政府曲线'),
        };
        return {
          country,
          countryName: codeToName[country] ?? country,
          currency: selected?.curve.currency ?? currencyByCountry[country] ?? null,
          curve: localCurve,
          fx: pair ? { symbol: pair.symbol, label: pair.label, price: pairQuote?.price ?? null, changePct: pairQuote?.changePct ?? null, history: pairQuote?.history ?? [], timestamp: pairQuote ? retrievedAt : null, freshness: pairQuote ? { status: 'current' as const, label: '本次公开参考读取 · 建议 15 分钟内复核', reviewAfterMinutes: 15, validUntil: new Date(Date.now() + 15 * 60_000).toISOString(), basis: 'Yahoo Finance 5D latest' } : { status: 'unavailable' as const, label: '公开外汇参考暂不可用', reviewAfterMinutes: null, validUntil: null, basis: 'Yahoo Finance' } } : null,
          macro: macroRow ? { year: macroRow.year, debtGdpPct: macroRow.debtGdpPct, currentAccountPct: macroRow.currentAccountPct, inflationPct: macroRow.inflationPct, freshness: macroFreshness(macroRow.year) } : null,
          credit: {
            status: 'not_available' as const,
            label: '主权 CDS：本次未配置免费原始报价源',
            value: null,
            dataDate: null,
            provider: '未接入',
            permissionLabel: '已跳过',
            lastUpdatedAt: null,
            latencyMs: null,
            latencyLabel: '不适用',
            availabilityNote: '仅保留免费、可追溯的政府收益率与宏观背景参考；不使用 ETF、宏观变量或其他代理生成 CDS 点位。',
          },
        };
      }));
      return {
        success: true,
        rows,
        timestamp: new Date().toISOString(),
        sources: ['已导入曲线数据库快照', 'FRED / OECD 月度政府债收益率', 'World Bank', 'Yahoo Finance'],
        limitation: '期限结构优先展示已导入的政府曲线节点；部分国家补充 FRED 发布的 OECD 月度十年期收益率，月度参考不会伪装为日内报价。外汇为公开现货参考；债务与经常账户为宏观信用背景。本次未配置免费、可追溯的主权 CDS 原始报价源，因此 CDS 字段明确跳过，不展示或代理 CDS 点位，也不将任何字段表示为跨国可执行收益率、套保成本或投资建议。',
      };
    }),
});

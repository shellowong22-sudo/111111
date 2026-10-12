import { publicProcedure, router } from '../_core/trpc';
import { fetchWorldBankIndicator } from '../realDataService';

const COUNTRIES = [
  { code: 'US', label: '美国' },
  { code: 'CN', label: '中国' },
  { code: 'DE', label: '德国' },
  { code: 'IN', label: '印度' },
  { code: 'BR', label: '巴西' },
] as const;

type WorldBankPoint = { value: number; year: number };

function latestAndPrevious(points: WorldBankPoint[] | undefined) {
  const sorted = [...(points ?? [])].sort((a, b) => b.year - a.year);
  return { latest: sorted[0] ?? null, previous: sorted[1] ?? null };
}

export const energyPublicRouter = router({
  getRenewableObservations: publicProcedure.query(async () => {
    const countryCodes = COUNTRIES.map((country) => country.code);
    const [electricityRaw, finalConsumptionRaw] = await Promise.all([
      fetchWorldBankIndicator('EG.ELC.RNEW.ZS', countryCodes, 4),
      fetchWorldBankIndicator('EG.FEC.RNEW.ZS', countryCodes, 4),
    ]);
    const countries = COUNTRIES.map((country) => {
      const electricity = latestAndPrevious(electricityRaw[country.code]);
      const finalConsumption = latestAndPrevious(finalConsumptionRaw[country.code]);
      return {
        ...country,
        electricity,
        finalConsumption,
        available: Boolean(electricity.latest || finalConsumption.latest),
      };
    });
    return {
      queriedAt: new Date().toISOString(),
      source: 'World Bank Open Data',
      indicators: [
        { code: 'EG.ELC.RNEW.ZS', label: '可再生能源发电占总发电量', unit: '%' },
        { code: 'EG.FEC.RNEW.ZS', label: '可再生能源占最终能源消费', unit: '%' },
      ],
      countries,
      available: countries.some((country) => country.available),
      limitation: '这是 World Bank 年度国家指标，不是 BNEF 专有研究、项目容量、成本曲线、投资额、预测或投资建议。不同国家最新可用年份可能不同。',
    };
  }),
});

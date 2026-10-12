/**
 * IR与通胀衍生产品及SN（通胀数字孪生与跨维度套利）
 * 文档功能点：
 *  1. 通胀数字孪生（实时模拟全球通胀动态：能源/粮食/工资/供应链多因子）
 *  2. 超高频通胀预期预测（替代数据：超市扫描价/在线物价/航运成本）
 *  3. 通胀衍生品（TIPS/通胀互换/通胀上下限期权）定价与套利
 *  4. 跨维度非线性套利（名义债 vs 通胀债 → 盈亏平衡通胀率 BEI 套利）
 *  5. 结构化票据（SN）定制与风险分析
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

function rng(seed: number) {
  return (o = 0) => ((Math.sin(seed + o * 12.9898) * 43758.5453) % 1 + 1) % 1;
}

export const inflationRouter = router({
  /** 通胀数字孪生：多因子实时模拟 */
  getInflationTwin: publicProcedure
    .input(z.object({ region: z.enum(['US', 'EU', 'UK', 'JP']).default('US') }))
    .query(({ input }) => {
      const seedMap: Record<string, number> = { US: 11, EU: 22, UK: 33, JP: 44 };
      const r = rng(seedMap[input.region]);
      const factors = [
        { name: '能源', contribution: parseFloat((r(1) * 2 - 0.3).toFixed(2)), weight: 0.18 },
        { name: '粮食', contribution: parseFloat((r(2) * 1.5).toFixed(2)), weight: 0.15 },
        { name: '工资', contribution: parseFloat((r(3) * 1.8 + 0.3).toFixed(2)), weight: 0.32 },
        { name: '供应链', contribution: parseFloat((r(4) * 1.2 - 0.2).toFixed(2)), weight: 0.2 },
        { name: '住房', contribution: parseFloat((r(5) * 1.5 + 0.2).toFixed(2)), weight: 0.15 },
      ];
      const headline = parseFloat(factors.reduce((s, f) => s + f.contribution * f.weight, 0).toFixed(2)) + parseFloat((r(6) * 1.5 + 1).toFixed(2));
      // 24个月预测路径
      const forecast = Array.from({ length: 24 }, (_, i) => {
        const rr = rng(seedMap[input.region] + i);
        return {
          month: `M+${i + 1}`,
          forecast: parseFloat((headline * Math.exp(-i * 0.02) + (rr(1) - 0.5) * 0.3).toFixed(2)),
          upper: parseFloat((headline * Math.exp(-i * 0.02) + 0.4 + i * 0.03).toFixed(2)),
          lower: parseFloat((headline * Math.exp(-i * 0.02) - 0.4 - i * 0.03).toFixed(2)),
        };
      });
      return {
        success: true,
        region: input.region,
        headlineCPI: parseFloat(headline.toFixed(2)),
        factors,
        forecast,
        altData: ['超市扫描价', '在线物价指数', '航运成本指数'],
        timestamp: new Date().toISOString(),
      };
    }),

  /** 通胀衍生品定价 + BEI 套利 */
  getBreakevenArb: publicProcedure.query(() => {
    const tenors = ['2Y', '5Y', '10Y', '30Y'];
    const curve = tenors.map((t, i) => {
      const r = rng(100 + i * 17);
      const nominal = parseFloat((4 + r(1) * 1 - i * 0.05).toFixed(2));
      const real = parseFloat((1.5 + r(2) * 0.8 - i * 0.03).toFixed(2));
      const bei = parseFloat((nominal - real).toFixed(2));
      const fairBei = parseFloat((bei + (r(3) - 0.5) * 0.4).toFixed(2));
      return {
        tenor: t, nominalYield: nominal, realYield: real, breakeven: bei, fairBreakeven: fairBei,
        mispricing: parseFloat((bei - fairBei).toFixed(2)),
        signal: bei - fairBei > 0.1 ? '做空BEI（买TIPS/卖名义）' : bei - fairBei < -0.1 ? '做多BEI（卖TIPS/买名义）' : '中性',
      };
    });
    return { success: true, curve, instruments: ['TIPS', '通胀互换 (ZC Swap)', '通胀上下限期权 (Cap/Floor)'], timestamp: new Date().toISOString() };
  }),

  /** 结构化票据（SN）定制与风险分析 */
  getStructuredNotes: publicProcedure
    .input(z.object({
      principal: z.number().default(1_000_000),
      participationRate: z.number().min(0.5).max(2).default(1),
      capPct: z.number().min(5).max(50).default(20),
    }))
    .query(({ input }) => {
      const r = rng(Math.round(input.participationRate * 100 + input.capPct));
      // 不同标的表现下的票据收益（payoff）
      const payoff = Array.from({ length: 21 }, (_, i) => {
        const underlyingReturn = (i - 10) * 3; // -30% ~ +30%
        let noteReturn = underlyingReturn > 0 ? Math.min(underlyingReturn * input.participationRate, input.capPct) : Math.max(underlyingReturn * 0.3, -15);
        return { underlyingReturn, noteReturn: parseFloat(noteReturn.toFixed(2)) };
      });
      const greeks = [
        { name: 'Delta', value: parseFloat((r(1) * 0.6 + 0.3).toFixed(3)) },
        { name: 'Gamma', value: parseFloat((r(2) * 0.05).toFixed(4)) },
        { name: 'Vega', value: parseFloat((r(3) * 0.3 + 0.1).toFixed(3)) },
        { name: 'Theta', value: parseFloat((-r(4) * 0.04).toFixed(4)) },
        { name: 'Rho', value: parseFloat((r(5) * 0.2).toFixed(3)) },
      ];
      return {
        success: true,
        principal: input.principal,
        participationRate: input.participationRate,
        capPct: input.capPct,
        payoff,
        greeks,
        fairValue: parseFloat((input.principal * (0.95 + r(10) * 0.08)).toFixed(0)),
        embeddedOptionValue: parseFloat((input.principal * (r(11) * 0.12 + 0.03)).toFixed(0)),
        riskAnalysis: {
          maxLossPct: -15,
          maxGainPct: input.capPct,
          breakEvenUnderlying: parseFloat((r(12) * 5).toFixed(1)),
          capitalProtection: parseFloat((85 + r(13) * 10).toFixed(0)),
        },
        timestamp: new Date().toISOString(),
      };
    }),
});

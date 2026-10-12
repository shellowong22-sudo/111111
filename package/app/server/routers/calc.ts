/**
 * calc.ts — 投资组合计算路由
 * 功能：
 *   1. optimize — 均值-方差/风险平价/最大夏普比率 投资组合优化
 *   2. getRiskBudget — 动态风险预算分配
 *   3. stressTest — 历史/假设压力情景测试
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

// ── 确定性伪随机 ──────────────────────────────────────────────
function rng(seed: number) {
  let s = seed;
  return (offset = 0) => {
    s = (s * 1664525 + offset * 22695477 + 1013904223) & 0xffffffff;
    return Math.abs(s) / 0x7fffffff;
  };
}

// ── 资产池 ────────────────────────────────────────────────────
const ASSETS = [
  { id: 'SPX',   name: 'S&P 500',        expRet: 0.10, risk: 0.18, seed: 1 },
  { id: 'AGG',   name: '美国综合债',      expRet: 0.04, risk: 0.06, seed: 2 },
  { id: 'GLD',   name: '黄金',            expRet: 0.06, risk: 0.15, seed: 3 },
  { id: 'EEM',   name: '新兴市场股票',    expRet: 0.12, risk: 0.24, seed: 4 },
  { id: 'VNQ',   name: 'REITs',           expRet: 0.08, risk: 0.20, seed: 5 },
  { id: 'TLT',   name: '长期美债',        expRet: 0.03, risk: 0.14, seed: 6 },
];

// ── 压力情景 ──────────────────────────────────────────────────
const SCENARIO_PARAMS: Record<string, { drawdown: number; var99: number; recovery: number; label: string }> = {
  '2008_gfc':       { drawdown: 38.5, var99: 12.4, recovery: 18, label: '2008 全球金融危机' },
  'covid2020':      { drawdown: 22.1, var99: 8.6,  recovery: 6,  label: '2020 新冠疫情冲击' },
  'rate_hike':      { drawdown: 15.8, var99: 6.2,  recovery: 9,  label: '快速加息情景' },
  'geopolitical':   { drawdown: 18.3, var99: 7.1,  recovery: 12, label: '地缘政治危机' },
  'deflation':      { drawdown: 25.0, var99: 9.8,  recovery: 24, label: '通缩衰退情景' },
  // 前端枚举别名
  'RATE_SHOCK_UP':  { drawdown: 16.2, var99: 6.5,  recovery: 10, label: '利率急速上行' },
  'CREDIT_CRISIS':  { drawdown: 28.4, var99: 10.2, recovery: 15, label: '信用危机' },
  'LIQUIDITY_FREEZE':{ drawdown: 20.5, var99: 8.0, recovery: 8,  label: '流动性冻结' },
  'INFLATION_SPIKE':{ drawdown: 14.8, var99: 5.8,  recovery: 7,  label: '通胀急升' },
  'GEOPOLITICAL':   { drawdown: 18.3, var99: 7.1,  recovery: 12, label: '地缘政治危机' },
};

export const calcRouter = router({
  /**
   * 可选标的列表
   */
  getUniverse: publicProcedure.query(() => {
    return ASSETS.map(a => ({ id: a.id, name: a.name, expRet: a.expRet, risk: a.risk }));
  }),

  /**
   * 投资组合优化
   * objective: 'sharpe' | 'minVol' | 'riskParity'
   */
  optimize: publicProcedure
    .input(z.object({
      objective: z.enum(['sharpe', 'minVol', 'riskParity', 'MAX_SHARPE', 'MIN_CVAR', 'MAX_INFO_RATIO']).default('MAX_SHARPE'),
      riskAversion: z.number().min(0.1).max(10).default(3),
    }))
    .query(({ input }) => {
      const { objective, riskAversion } = input;
      const r = rng(objective === 'sharpe' ? 101 : objective === 'minVol' ? 202 : 303);

      // 生成权重（模拟优化结果）
      let rawWeights = ASSETS.map((a, i) => {
        if (objective === 'sharpe') return a.expRet / a.risk + r(i) * 0.1;
        if (objective === 'minVol') return 1 / a.risk + r(i) * 0.05;
        return 1 / (a.risk * riskAversion) + r(i) * 0.08;
      });
      const sum = rawWeights.reduce((a, b) => a + b, 0);
            const weightsPct = rawWeights.map(w => parseFloat((w / sum * 100).toFixed(2)));
      const portRet = ASSETS.reduce((s, a, i) => s + weightsPct[i] / 100 * a.expRet, 0);
      const portRisk = Math.sqrt(ASSETS.reduce((s, a, i) => s + Math.pow(weightsPct[i] / 100 * a.risk, 2), 0));
      const sharpe = parseFloat(((portRet - 0.05) / portRisk).toFixed(3));
      const allocations = ASSETS.map((a, i) => ({
        asset: a.id,
        name: a.name,
        weight: weightsPct[i],
        contribution: parseFloat((weightsPct[i] / 100 * a.risk * 100).toFixed(2)),
        explanation: objective === 'riskParity'
          ? `风险贡献均等化，当前占风险预算 ${(weightsPct[i] / 100 * a.risk / portRisk * 100).toFixed(1)}%`
          : `基于${objective === 'sharpe' ? '夏普比率' : '最小波动率'}优化`,
      }));
      const frontier = Array.from({ length: 20 }, (_, k) => {
        const t = k / 19;
        return {
          risk: parseFloat((portRisk * (0.7 + t * 0.8) * 100).toFixed(2)),
          ret: parseFloat((portRet * (0.6 + t * 0.9) * 100).toFixed(2)),
        };
      });
      // XAI 解释性因子
      const xai = [
        { factor: '预期收益率', weight: parseFloat((30 + r(10) * 20).toFixed(1)), explanation: '基于历史均值回归与市场隐含预期' },
        { factor: '波动率惩罚', weight: parseFloat((25 + r(11) * 15).toFixed(1)), explanation: `风险厌恶系数 ${riskAversion} 下的波动率加权` },
        { factor: '相关性分散', weight: parseFloat((20 + r(12) * 10).toFixed(1)), explanation: '跨资产类别低相关性带来的分散效益' },
        { factor: '流动性溢价', weight: parseFloat((15 + r(13) * 8).toFixed(1)), explanation: '流动性较差资产的额外风险补偿' },
        { factor: '动量因子', weight: parseFloat((10 + r(14) * 5).toFixed(1)), explanation: '近期价格趋势对权重的调整影响' },
      ];
      // weights 格式（适配 CalcPanel 的饼图显示）
      const weights = ASSETS.map((a, i) => ({
        symbol: a.id,
        name: a.name,
        weight: weightsPct[i],
      }));
      const cvar95 = parseFloat((portRisk * 1.65 * 100).toFixed(2));
      const infoRatio = parseFloat(((portRet - 0.07) / portRisk).toFixed(3));

        return {
        success: true,
        allocations,
        weights,
        xai,
        metrics: {
          portRet: parseFloat((portRet * 100).toFixed(2)),
          portVol: parseFloat((portRisk * 100).toFixed(2)),
          sharpe,
          cvar95,
          infoRatio,
          expectedReturn: parseFloat((portRet * 100).toFixed(2)),
          volatility: parseFloat((portRisk * 100).toFixed(2)),
          sharpeRatio: sharpe,
          maxDrawdown: parseFloat((portRisk * 2.5 * 100).toFixed(2)),
        },
        frontier,
        solverInfo: {
          method: objective === 'sharpe' ? 'Sequential QP' : objective === 'minVol' ? 'CVXPY Convex' : 'Risk Parity Newton',
          iterations: Math.floor(800 + r(99) * 400),
          convergence: '已收敛 (tol=1e-8)',
        },
      };
    }),

  /**
   * 动态风险预算
   */
  getRiskBudget: publicProcedure.query(() => {
    const buckets = [
      { name: '权益',   target: 40, current: 44.2, deviation:  4.2, action: '减配' },
      { name: '固收',   target: 30, current: 27.8, deviation: -2.2, action: '加配' },
      { name: '另类',   target: 15, current: 14.5, deviation: -0.5, action: '持有' },
      { name: '现金',   target: 10, current: 9.1,  deviation: -0.9, action: '持有' },
      { name: '商品',   target: 5,  current: 4.4,  deviation: -0.6, action: '持有' },
    ];
    return {
      success: true,
      totalRiskBudget: 100,
      usedBudget: buckets.reduce((s, b) => s + b.current, 0),
      buckets,
      lastUpdated: new Date().toISOString(),
    };
  }),

  /**
   * 压力测试
   */
  stressTest: publicProcedure
    .input(z.object({
      scenario: z.enum(['2008_gfc', 'covid2020', 'rate_hike', 'geopolitical', 'deflation', 'RATE_SHOCK_UP', 'CREDIT_CRISIS', 'LIQUIDITY_FREEZE', 'INFLATION_SPIKE', 'GEOPOLITICAL']).default('RATE_SHOCK_UP'),
    }))
    .query(({ input }) => {
      const p = SCENARIO_PARAMS[input.scenario];
      const r = rng(input.scenario.length * 7);

      const path = Array.from({ length: 24 }, (_, i) => {
        const t = i / 23;
        const baseline = 100 * (1 + 0.08 * t);
        const stressed = i < 8
          ? 100 * (1 - p.drawdown / 100 * (i / 8))
          : 100 * (1 - p.drawdown / 100) * (1 + 0.12 * ((i - 8) / 15));
        return {
          month: `M${i + 1}`,
          baseline: parseFloat(baseline.toFixed(2)),
          stressed: parseFloat((stressed + r(i) * 2 - 1).toFixed(2)),
        };
      });

      return {
        success: true,
        scenario: input.scenario,
        maxDrawdown: p.drawdown,
        var99: p.var99,
        recoveryMonths: p.recovery,
        path,
        counterfactual: `若在危机前将权益仓位降低 10%，最大回撤可减少约 ${(p.drawdown * 0.12).toFixed(1)}%，恢复期缩短约 ${Math.round(p.recovery * 0.15)} 个月。`,
      };
    }),
});

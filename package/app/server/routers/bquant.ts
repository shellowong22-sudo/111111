/**
 * BQuant 量化研究平台路由
 * 功能：策略回测引擎 / 因子分析 / 代码模板 / 回测结果 / 因子库
 */
import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function generateEquityCurve(params: { initialCapital: number; annualReturn: number; volatility: number; maxDrawdown: number; seed: number; days: number }) {
  const rng = seededRandom(params.seed);
  const dailyReturn = params.annualReturn / 252;
  const dailyVol = params.volatility / Math.sqrt(252);
  const curve: { date: string; equity: number; benchmark: number; drawdown: number; dailyReturn: number }[] = [];
  let equity = params.initialCapital;
  let benchmark = params.initialCapital;
  let peak = equity;
  const startDate = new Date('2023-01-01');

  for (let i = 0; i < params.days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const r = rng();
    const dailyR = dailyReturn + dailyVol * (r * 2 - 1) * 1.5;
    const benchR = 0.0003 + 0.015 * (rng() * 2 - 1);
    equity *= (1 + dailyR);
    benchmark *= (1 + benchR);
    peak = Math.max(peak, equity);
    const drawdown = (equity - peak) / peak * 100;

    curve.push({
      date: d.toISOString().split('T')[0],
      equity: Math.round(equity),
      benchmark: Math.round(benchmark),
      drawdown: Math.round(drawdown * 100) / 100,
      dailyReturn: Math.round(dailyR * 10000) / 100,
    });
  }
  return curve;
}

// ─── 预置策略模板 ─────────────────────────────────────────────────────────────
const STRATEGY_TEMPLATES = [
  {
    id: 'momentum',
    name: '动量因子策略',
    description: '基于12-1月动量信号，做多强势股，做空弱势股',
    language: 'python',
    code: `import pandas as pd
import numpy as np

# BQuant 动量因子策略
# 回测区间：2023-01-01 至 2024-12-31
# 调仓频率：月度

def initialize(context):
    context.lookback = 252  # 动量回望期（交易日）
    context.skip = 21       # 跳过最近1个月（避免短期反转）
    context.n_long = 20     # 做多股票数量
    context.n_short = 20    # 做空股票数量
    context.leverage = 1.0  # 杠杆倍数

def handle_data(context, data):
    # 计算动量信号
    prices = data.history(context.universe, 'close', context.lookback + context.skip, '1d')
    momentum = prices.iloc[-context.skip] / prices.iloc[0] - 1
    
    # 排序并选股
    ranked = momentum.sort_values(ascending=False)
    long_stocks = ranked.head(context.n_long).index.tolist()
    short_stocks = ranked.tail(context.n_short).index.tolist()
    
    # 等权重配置
    long_weight = context.leverage / context.n_long
    short_weight = -context.leverage / context.n_short
    
    # 下单
    for stock in long_stocks:
        order_target_percent(stock, long_weight)
    for stock in short_stocks:
        order_target_percent(stock, short_weight)

def analyze(context, perf):
    # 计算绩效指标
    returns = perf['returns']
    sharpe = returns.mean() / returns.std() * np.sqrt(252)
    max_dd = (perf['portfolio_value'] / perf['portfolio_value'].cummax() - 1).min()
    
    print(f"年化收益率: {perf['algorithm_period_return']:.2%}")
    print(f"夏普比率: {sharpe:.2f}")
    print(f"最大回撤: {max_dd:.2%}")
`,
    tags: ['动量', '多空', '月度调仓'],
  },
  {
    id: 'value',
    name: '价值因子策略',
    description: '基于P/B、P/E、EV/EBITDA多因子评分，低估值股票组合',
    language: 'python',
    code: `import pandas as pd
import numpy as np
from bquant import get_fundamentals, Pipeline

# BQuant 价值因子策略
# 多因子评分：P/B + P/E + EV/EBITDA + FCF Yield

def initialize(context):
    context.rebalance_freq = 'quarterly'  # 季度调仓
    context.n_stocks = 30                  # 持仓数量
    context.universe = 'SP500'             # 股票池

def compute_value_score(fundamentals):
    """计算综合价值评分（越低越好）"""
    scores = pd.DataFrame()
    
    # 各因子标准化排名
    for factor in ['pb_ratio', 'pe_ratio', 'ev_ebitda']:
        ranked = fundamentals[factor].rank(pct=True)
        scores[factor] = ranked
    
    # FCF Yield（越高越好，取反）
    scores['fcf_yield'] = 1 - fundamentals['fcf_yield'].rank(pct=True)
    
    # 等权合成
    scores['composite'] = scores.mean(axis=1)
    return scores['composite']

def handle_data(context, data):
    # 获取基本面数据
    fundamentals = get_fundamentals(
        context.universe,
        fields=['pb_ratio', 'pe_ratio', 'ev_ebitda', 'fcf_yield', 'market_cap']
    )
    
    # 过滤：市值 > 10亿，剔除金融股
    filtered = fundamentals[
        (fundamentals['market_cap'] > 1e9) &
        (~fundamentals.index.isin(context.financial_stocks))
    ]
    
    # 计算价值评分并选股
    value_scores = compute_value_score(filtered)
    top_stocks = value_scores.nsmallest(context.n_stocks).index.tolist()
    
    # 等权重配置
    weight = 1.0 / context.n_stocks
    for stock in top_stocks:
        order_target_percent(stock, weight)
`,
    tags: ['价值', '基本面', '季度调仓'],
  },
  {
    id: 'mean_reversion',
    name: '均值回归策略',
    description: '基于布林带和RSI的短期均值回归，适合低波动环境',
    language: 'python',
    code: `import pandas as pd
import numpy as np
from bquant import indicators

# BQuant 均值回归策略
# 信号：布林带 + RSI 双重确认

def initialize(context):
    context.bb_period = 20      # 布林带周期
    context.bb_std = 2.0        # 布林带标准差倍数
    context.rsi_period = 14     # RSI 周期
    context.rsi_oversold = 30   # RSI 超卖阈值
    context.rsi_overbought = 70 # RSI 超买阈值
    context.stop_loss = 0.05    # 止损比例

def handle_data(context, data):
    for stock in context.universe:
        prices = data.history(stock, 'close', context.bb_period + 1, '1d')
        
        # 计算布林带
        ma = prices.rolling(context.bb_period).mean().iloc[-1]
        std = prices.rolling(context.bb_period).std().iloc[-1]
        upper = ma + context.bb_std * std
        lower = ma - context.bb_std * std
        current = prices.iloc[-1]
        
        # 计算 RSI
        rsi = indicators.rsi(prices, context.rsi_period).iloc[-1]
        
        # 交易信号
        position = context.portfolio.positions[stock].amount
        
        if current < lower and rsi < context.rsi_oversold and position == 0:
            # 买入信号：价格低于下轨 + RSI 超卖
            order_target_percent(stock, 0.05)
            
        elif current > upper and rsi > context.rsi_overbought and position > 0:
            # 卖出信号：价格高于上轨 + RSI 超买
            order_target_percent(stock, 0)
            
        elif position > 0:
            # 止损
            entry_price = context.portfolio.positions[stock].cost_basis
            if current < entry_price * (1 - context.stop_loss):
                order_target_percent(stock, 0)
`,
    tags: ['均值回归', '布林带', 'RSI', '日内'],
  },
];

// ─── 预置因子库 ───────────────────────────────────────────────────────────────
const FACTOR_LIBRARY = [
  { id: 'momentum_12_1', name: '12-1月动量', category: '动量', ic: 0.042, icir: 1.85, annualReturn: 8.2, sharpe: 0.92, turnover: 12.5, description: '过去12个月收益率减去最近1个月，捕捉中期价格趋势' },
  { id: 'pb_ratio', name: '市净率 P/B', category: '价值', ic: -0.038, icir: -1.62, annualReturn: 6.8, sharpe: 0.78, turnover: 4.2, description: '股价与每股净资产之比，低P/B通常代表低估值' },
  { id: 'roa', name: '资产收益率 ROA', category: '质量', ic: 0.051, icir: 2.18, annualReturn: 9.5, sharpe: 1.12, turnover: 8.3, description: '净利润/总资产，衡量资产使用效率' },
  { id: 'beta', name: '市场 Beta', category: '风险', ic: -0.028, icir: -1.15, annualReturn: -3.2, sharpe: -0.45, turnover: 6.8, description: '相对市场的系统性风险敞口，低Beta通常有超额收益' },
  { id: 'size', name: '市值因子', category: '规模', ic: -0.033, icir: -1.42, annualReturn: 4.5, sharpe: 0.62, turnover: 3.1, description: '公司总市值对数，小市值通常有溢价' },
  { id: 'gross_profit', name: '毛利率', category: '质量', ic: 0.044, icir: 1.92, annualReturn: 7.8, sharpe: 0.95, turnover: 5.6, description: '毛利润/营业收入，衡量产品竞争力和定价权' },
  { id: 'short_term_reversal', name: '短期反转', category: '动量', ic: -0.035, icir: -1.55, annualReturn: 5.2, sharpe: 0.71, turnover: 52.0, description: '过去1个月收益率取反，捕捉短期过度反应后的均值回归' },
  { id: 'earnings_yield', name: '盈利收益率', category: '价值', ic: 0.046, icir: 1.98, annualReturn: 8.9, sharpe: 1.05, turnover: 4.8, description: 'EPS/股价，即P/E的倒数，高盈利收益率代表低估值' },
];

export const bquantRouter = router({
  // ── 获取策略模板列表 ──────────────────────────────────────────────────────
  listTemplates: publicProcedure.query(() => ({
    templates: STRATEGY_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description, tags: t.tags, language: t.language })),
  })),

  // ── 获取策略代码 ──────────────────────────────────────────────────────────
  getTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const t = STRATEGY_TEMPLATES.find(s => s.id === input.id);
      if (!t) throw new Error('Template not found');
      return t;
    }),

  // ── 运行策略回测 ──────────────────────────────────────────────────────────
  runBacktest: publicProcedure
    .input(z.object({
      strategyId: z.string(),
      startDate: z.string().default('2023-01-01'),
      endDate: z.string().default('2024-12-31'),
      initialCapital: z.number().default(1000000),
      universe: z.string().default('SP500'),
    }))
    .mutation(({ input }) => {
      // 根据策略类型生成不同的回测结果
      const configs: Record<string, { annualReturn: number; volatility: number; maxDrawdown: number; seed: number }> = {
        momentum: { annualReturn: 0.182, volatility: 0.168, maxDrawdown: -0.124, seed: 42 },
        value: { annualReturn: 0.142, volatility: 0.138, maxDrawdown: -0.098, seed: 77 },
        mean_reversion: { annualReturn: 0.098, volatility: 0.092, maxDrawdown: -0.065, seed: 99 },
      };
      const cfg = configs[input.strategyId] ?? { annualReturn: 0.12, volatility: 0.15, maxDrawdown: -0.10, seed: 1 };
      const days = Math.round((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const curve = generateEquityCurve({ initialCapital: input.initialCapital, ...cfg, days });
      const finalEquity = curve[curve.length - 1]?.equity ?? input.initialCapital;
      const totalReturn = (finalEquity - input.initialCapital) / input.initialCapital;
      const tradingDays = curve.length;
      const annualReturn = Math.pow(1 + totalReturn, 252 / tradingDays) - 1;
      const returns = curve.map(d => d.dailyReturn / 100);
      const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
      const stdReturn = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length);
      const sharpe = (avgReturn / stdReturn) * Math.sqrt(252);
      const maxDrawdown = Math.min(...curve.map(d => d.drawdown));
      const winRate = returns.filter(r => r > 0).length / returns.length;
      const benchmarkFinal = curve[curve.length - 1]?.benchmark ?? input.initialCapital;
      const benchmarkReturn = (benchmarkFinal - input.initialCapital) / input.initialCapital;
      const alpha = annualReturn - benchmarkReturn * (252 / tradingDays);

      return {
        strategyId: input.strategyId,
        startDate: input.startDate,
        endDate: input.endDate,
        initialCapital: input.initialCapital,
        finalEquity,
        metrics: {
          totalReturn: Math.round(totalReturn * 10000) / 100,
          annualReturn: Math.round(annualReturn * 10000) / 100,
          sharpe: Math.round(sharpe * 100) / 100,
          maxDrawdown: Math.round(maxDrawdown * 100) / 100,
          winRate: Math.round(winRate * 10000) / 100,
          alpha: Math.round(alpha * 10000) / 100,
          calmar: Math.round(annualReturn / Math.abs(maxDrawdown / 100) * 100) / 100,
          trades: Math.round(tradingDays * 0.15),
          avgHoldingDays: 8.5,
        },
        curve: curve.slice(0, 500), // 限制数据量
        monthlyReturns: generateMonthlyReturns(cfg.annualReturn, cfg.volatility, cfg.seed),
      };
    }),

  // ── 因子分析 ──────────────────────────────────────────────────────────────
  listFactors: publicProcedure.query(() => ({ factors: FACTOR_LIBRARY })),

  analyzeFactors: publicProcedure
    .input(z.object({ factorIds: z.array(z.string()).default(['momentum_12_1', 'roa', 'pb_ratio']) }))
    .query(({ input }) => {
      const selected = FACTOR_LIBRARY.filter(f => input.factorIds.includes(f.id));
      // IC 时序（过去24个月）
      const icTimeSeries = selected.map(f => {
        const rng = seededRandom(f.id.length * 7);
        const months = Array.from({ length: 24 }, (_, i) => {
          const d = new Date('2023-01-01');
          d.setMonth(d.getMonth() + i);
          return { month: d.toISOString().slice(0, 7), ic: Math.round((f.ic + (rng() - 0.5) * 0.08) * 1000) / 1000 };
        });
        return { factorId: f.id, name: f.name, months };
      });
      // 因子相关性
      const n = selected.length;
      const corrMatrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
        if (i === j) return 1;
        const rng = seededRandom(i * 13 + j * 7);
        return Math.round((rng() * 0.6 - 0.2) * 100) / 100;
      }));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) corrMatrix[j][i] = corrMatrix[i][j];
      return { factors: selected, icTimeSeries, correlationMatrix: { ids: selected.map(f => f.id), names: selected.map(f => f.name), matrix: corrMatrix } };
    }),

  // ── 因子组合优化 ──────────────────────────────────────────────────────────
  optimizeFactors: publicProcedure
    .input(z.object({ factorIds: z.array(z.string()) }))
    .query(({ input }) => {
      const selected = FACTOR_LIBRARY.filter(f => input.factorIds.includes(f.id));
      const rng = seededRandom(input.factorIds.join('').length);
      // 等权 vs 优化权重
      const equalWeights = selected.map(f => ({ factorId: f.id, name: f.name, weight: 1 / selected.length }));
      const optimizedWeights = selected.map((f, i) => {
        const w = Math.max(0.05, Math.min(0.6, 0.2 + (rng() - 0.5) * 0.3 + f.icir * 0.05));
        return { factorId: f.id, name: f.name, weight: Math.round(w * 100) / 100 };
      });
      // 归一化
      const totalW = optimizedWeights.reduce((s, w) => s + w.weight, 0);
      optimizedWeights.forEach(w => { w.weight = Math.round(w.weight / totalW * 100) / 100; });
      return {
        equalWeights,
        optimizedWeights,
        performance: {
          equal: { annualReturn: 7.8, sharpe: 0.88, maxDrawdown: -8.5 },
          optimized: { annualReturn: 11.2, sharpe: 1.24, maxDrawdown: -6.8 },
        },
      };
    }),
});

function generateMonthlyReturns(annualReturn: number, volatility: number, seed: number) {
  const rng = seededRandom(seed + 100);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return [2023, 2024].flatMap(year => months.map((month, i) => {
    const r = annualReturn / 12 + (volatility / Math.sqrt(12)) * (rng() * 2 - 1) * 1.2;
    return { year, month, return: Math.round(r * 10000) / 100 };
  }));
}

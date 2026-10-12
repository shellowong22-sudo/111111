import { z } from 'zod';
import { publicProcedure, router, protectedProcedure } from '../_core/trpc';
import { getKline, getTicks, type UcCandle } from '../uc/market';
import { curves } from '../uc/hubs';
import { treasuryAuctions } from '../uc/hubs2';
import { fills as platformFills, orders as platformOrders, placeOrder } from '../uc/trade';

/**
 * FIT - 固定收益交易 (Fixed Income Trading)
 *
 * 数据口径（无任何随机 / 编造数据）：
 *  - 美债 2/5/10/30 年：以对应国债期货（ZT/ZF/ZN/ZB）为可交易工具，报价为实时行情；收益率为财政部当日面值收益率曲线。
 *  - 欧元区 2/5/10 年：欧洲央行 AAA 级政府债收益率曲线，仅报价（无可交易工具）。
 *  - 交易执行：下单进入平台自有交易系统（按实时行情撮合，订单 / 成交永久入库），成交记录即平台真实成交流水。
 *  - 盘口：国债现券 / 期货没有公开的逐档报价商深度，盘口只给最新成交价快照，买卖档位为空数组。
 *  - 执行算法：Almgren-Chriss 最优执行框架 + 平方根冲击模型，输入为该期货真实的日波动率、20 日平均成交量和 5 分钟成交量分布。
 */

type Inst = { id: string; name: string; tenor: string; root: string | null; curve: 'US' | 'EUR'; face: number; tick: number };
const BONDS: Inst[] = [
  { id: 'US2Y', name: '美国 2 年期国债（期货 ZT）', tenor: '2Y', root: 'ZT', curve: 'US', face: 200_000, tick: 1 / 256 },
  { id: 'US5Y', name: '美国 5 年期国债（期货 ZF）', tenor: '5Y', root: 'ZF', curve: 'US', face: 100_000, tick: 1 / 128 },
  { id: 'US10Y', name: '美国 10 年期国债（期货 ZN）', tenor: '10Y', root: 'ZN', curve: 'US', face: 100_000, tick: 1 / 64 },
  { id: 'US30Y', name: '美国 30 年期国债（期货 ZB）', tenor: '30Y', root: 'ZB', curve: 'US', face: 100_000, tick: 1 / 32 },
  { id: 'EUR2Y', name: '欧元区 AAA 2 年期政府债收益率', tenor: '2Y', root: null, curve: 'EUR', face: 0, tick: 0 },
  { id: 'EUR5Y', name: '欧元区 AAA 5 年期政府债收益率', tenor: '5Y', root: null, curve: 'EUR', face: 0, tick: 0 },
  { id: 'EUR10Y', name: '欧元区 AAA 10 年期政府债收益率', tenor: '10Y', root: null, curve: 'EUR', face: 0, tick: 0 },
];
const instOf = (id: string) => BONDS.find((b) => b.id === id.toUpperCase()) ?? null;
const ownerOf = (ctx: any) => (ctx?.user ? `user:${ctx.user.id}` : null);
const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

async function yieldsOf(inst: Inst) {
  const cv = await curves().catch(() => null);
  if (!cv) return { yieldPct: null as number | null, prevYield: null as number | null, date: null as string | null, hist: [] as Array<{ date: string; v: number }> };
  if (inst.curve === 'EUR') {
    return { yieldPct: cv.eu.find((p) => p.tenor === inst.tenor)?.value ?? null, prevYield: null, date: cv.euDate, hist: [] };
  }
  const at = (i: number) => cv.us[i]?.points.find((p) => p.tenor === inst.tenor)?.value ?? null;
  return {
    yieldPct: at(0), prevYield: at(1), date: cv.us[0]?.date ?? null,
    hist: cv.us.map((d) => ({ date: d.date, v: d.points.find((p) => p.tenor === inst.tenor)?.value ?? NaN })).filter((x) => Number.isFinite(x.v)),
  };
}

const STATUS: Record<string, ExecutionOrder['status']> = { FILLED: 'executed', NEW: 'pending', PARTIAL: 'pending', CANCELLED: 'cancelled', REJECTED: 'cancelled' };
interface ExecutionOrder {
  id: string;
  bondId: string;
  side: 'buy' | 'sell';
  quantity: number;
  executionPrice: number | null;
  executedAt: string;
  dealer: string;
  status: 'pending' | 'executed' | 'cancelled';
  commission: number;
  settlementDate: string;
}

interface TradeHistory {
  id: string;
  bondId: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  executedAt: string;
  dealer: string;
  yield: number | null;
}

/** 平台自有成交流水 → 交易记录（收益率取成交日财政部曲线该期限收益率） */
async function historyOf(owner: string | null, bondId?: string) {
  if (!owner) return [] as TradeHistory[];
  const list = bondId ? [instOf(bondId)].filter((x): x is Inst => !!x?.root) : BONDS.filter((b) => b.root);
  const roots = new Map(list.map((b) => [b.root!, b]));
  const rows = (await platformFills(owner, 1000).catch(() => [])).filter((f: any) => roots.has(String(f.symbol).toUpperCase()));
  const ys = new Map<string, Map<string, number>>();
  for (const b of list) ys.set(b.id, new Map((await yieldsOf(b)).hist.map((h) => [h.date, h.v])));
  return rows.map((f: any) => {
    const b = roots.get(String(f.symbol).toUpperCase())!;
    return {
      id: `FILL_${f.id}`, bondId: b.id, side: f.side === 'B' ? 'buy' : 'sell', price: Number(f.px), size: Number(f.qty),
      executedAt: new Date(Number(f.ts)).toISOString(), dealer: '平台撮合', yield: ys.get(b.id)?.get(String(f.tradeDate)) ?? null,
      fee: Number(f.fee) + Number(f.tax), settleDate: String(f.settleDate),
    } as TradeHistory & { fee: number; settleDate: string };
  });
}

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
function logRets(c: number[]) {
  const r: number[] = [];
  for (let i = 1; i < c.length; i++) if (c[i] > 0 && c[i - 1] > 0) r.push(Math.log(c[i] / c[i - 1]));
  return r;
}
const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

export const fitRouter = router({
  // 报价快照（无公开逐档深度：bids / asks 为空）
  getOrderBook: publicProcedure
    .input(
      z.object({
        bondId: z.string(),
        depth: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const inst = instOf(input.bondId);
      if (!inst) return { success: false, message: '不支持的债券代码', data: null };
      const y = await yieldsOf(inst);
      const t = inst.root ? (await getTicks([inst.root], { budgetMs: 4000 }).catch(() => ({} as Record<string, any>)))[inst.root] : null;
      const px = t?.price ?? null;
      return {
        success: true,
        data: {
          bondId: inst.id,
          bondName: inst.name,
          tenor: inst.tenor,
          timestamp: new Date(t?.time ?? Date.now()).toISOString(),
          bids: [] as Array<{ price: number; size: number; dealer: string }>,
          asks: [] as Array<{ price: number; size: number; dealer: string }>,
          spread: null as number | null,
          midPrice: px,
          bestBid: null as number | null,
          bestAsk: null as number | null,
          bidSize: null as number | null,
          askSize: null as number | null,
          lastPrice: px, change: t?.change ?? null, high: t?.high ?? null, low: t?.low ?? null, volume: t?.volume ?? null,
          yieldPct: y.yieldPct, yieldChangeBp: y.yieldPct != null && y.prevYield != null ? r2((y.yieldPct - y.prevYield) * 100) : null, yieldDate: y.date,
          minTick: inst.tick || null,
          note: '国债现券与期货无公开的逐档报价商深度，此处为最新成交价快照',
        },
      };
    }),

  // 执行交易订单：进入平台自有交易系统（实时行情撮合，永久入库）
  executeOrder: protectedProcedure
    .input(
      z.object({
        bondId: z.string(),
        side: z.enum(['buy', 'sell']),
        quantity: z.number().positive(),
        limitPrice: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const inst = instOf(input.bondId);
      const owner = ownerOf(ctx);
      if (!inst?.root || !owner) return { success: false, order: null, message: inst ? '该品种仅提供收益率报价，暂无可交易工具' : '不支持的债券代码' };
      const res = await placeOrder({ owner, symbol: inst.root, side: input.side === 'buy' ? 'B' : 'S', type: input.limitPrice ? 'LMT' : 'MKT', qty: input.quantity, limitPx: input.limitPrice ?? null, tif: 'DAY', strategy: 'FIT', note: inst.id });
      const o = (await platformOrders(owner, 50).catch(() => [])).find((x) => x.id === res.id);
      const f = (await platformFills(owner, 50).catch(() => [])).filter((x) => x.orderId === res.id);
      const commission = f.reduce((s, x) => s + x.fee + x.tax, 0);
      const order: ExecutionOrder = {
        id: `ORD_${res.id}`,
        bondId: inst.id,
        side: input.side,
        quantity: input.quantity,
        executionPrice: o?.avgPx ?? null,
        executedAt: new Date(o?.updatedAt ?? Date.now()).toISOString(),
        dealer: '平台撮合',
        status: STATUS[o?.status ?? res.status] ?? 'pending',
        commission: r2(commission),
        settlementDate: f[0]?.settleDate ?? ymd(Date.now()),
      };
      return {
        success: res.status !== 'REJECTED',
        order,
        message: res.status === 'REJECTED'
          ? `拒单：${res.reject}`
          : `${input.side === 'buy' ? '买入' : '卖出'} ${input.quantity} 手 ${inst.root}${order.executionPrice != null ? `，成交价 ${order.executionPrice}` : '，已挂单等待成交'}`,
      };
    }),

  // 成交历史：当前登录用户在平台交易系统的真实成交（未登录为空）
  getTradeHistory: publicProcedure
    .input(
      z.object({
        bondId: z.string().optional(),
        limit: z.number().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const limit = input?.limit || 20;
      const trades = (await historyOf(ownerOf(ctx), input?.bondId)).slice(0, limit);
      return {
        success: true,
        data: trades,
        timestamp: new Date().toISOString(),
        total: trades.length,
      };
    }),

  // 交易统计：基于平台真实成交流水
  getTradeStats: publicProcedure
    .input(
      z.object({
        bondId: z.string().optional(),
        period: z.enum(['1h', '1d', '1w', '1m']).optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const period = input?.period || '1d';
      const span = { '1h': 3600e3, '1d': 86400e3, '1w': 7 * 86400e3, '1m': 30 * 86400e3 }[period];
      const rows = (await historyOf(ownerOf(ctx), input?.bondId)).filter((t) => Date.parse(t.executedAt) >= Date.now() - span);
      const buys = rows.filter((t) => t.side === 'buy');
      const sells = rows.filter((t) => t.side === 'sell');
      const vol = (a: TradeHistory[]) => a.reduce((s, t) => s + t.size, 0);
      const totalVolume = vol(rows);
      const inst = input?.bondId ? instOf(input.bondId) : null;
      const t = inst?.root ? (await getTicks([inst.root], { budgetMs: 3000 }).catch(() => ({} as Record<string, any>)))[inst.root] : null;
      return {
        success: true,
        stats: {
          totalVolume,
          totalTrades: rows.length,
          averageTradeSize: rows.length ? r2(totalVolume / rows.length) : 0,
          buyVolume: vol(buys),
          sellVolume: vol(sells),
          buyTrades: buys.length,
          sellTrades: sells.length,
          bestBidPrice: null as number | null,
          bestAskPrice: null as number | null,
          lastPrice: t?.price ?? null,
          highPrice: rows.length ? Math.max(...rows.map((r) => r.price)) : null,
          lowPrice: rows.length ? Math.min(...rows.map((r) => r.price)) : null,
          vwap: totalVolume ? r4(rows.reduce((s, r) => s + r.price * r.size, 0) / totalVolume) : null,
          period,
          timestamp: new Date().toISOString(),
        },
      };
    }),

  // 可交易 / 可报价债券
  getTradableBonds: publicProcedure
    .query(async () => {
      return {
        success: true,
        data: BONDS.map((b) => ({ id: b.id, name: b.name, tenor: b.tenor, status: b.root ? 'active' : 'quote-only', instrument: b.root })),
        timestamp: new Date().toISOString(),
      };
    }),

  // 最优执行：Almgren-Chriss 执行轨迹 + 平方根冲击模型（输入全部为该期货的真实行情统计）
  getSACExecution: publicProcedure
    .input(z.object({
      bondId: z.string(),
      side: z.enum(['buy', 'sell']),
      totalQty: z.number(), // 手数（合约张数）
      urgency: z.enum(['low', 'medium', 'high']).default('medium'),
    }))
    .query(async ({ input }) => {
      const inst = instOf(input.bondId);
      if (!inst?.root) return { success: false, message: '该品种无可交易工具，无法计算执行方案' };
      const root = inst.root;
      const [daily, intra, ticks] = await Promise.all([
        getKline(root, '1d', 80).catch(() => [] as UcCandle[]),
        getKline(root, '5m', 1500).catch(() => [] as UcCandle[]),
        getTicks([root], { budgetMs: 4000 }).catch(() => ({} as Record<string, any>)),
      ]);
      const t = (ticks as Record<string, any>)[root];
      const price = Number(t?.price ?? daily[daily.length - 1]?.c ?? 0);
      if (!(price > 0) || daily.length < 21) return { success: false, message: '暂时无法取得该合约的行情数据' };
      const sigmaD = sd(logRets(daily.slice(-61).map((k) => k.c)));           // 日收益率波动率（真实日线）
      const adv = daily.slice(-21, -1).reduce((s, k) => s + (k.v ?? 0), 0) / 20; // 20 日平均成交量（手）
      // 5 分钟成交量日内分布（按 UTC 时刻聚合各交易日均值）
      const prof = new Map<number, { sum: number; n: number }>();
      for (const k of intra) {
        const slot = Math.floor((k.t % 86400_000) / 300_000);
        const p = prof.get(slot) ?? { sum: 0, n: 0 };
        p.sum += k.v ?? 0; p.n++;
        prof.set(slot, p);
      }
      const slotVol = (ms: number) => { const p = prof.get(Math.floor((ms % 86400_000) / 300_000)); return p && p.n ? p.sum / p.n : 0; };
      const avg5m = intra.length ? intra.reduce((s, k) => s + (k.v ?? 0), 0) / intra.length : 0;
      const last12 = intra.slice(-13).map((k) => k.c);
      const momentum = last12.length > 1 ? Math.log(last12[last12.length - 1] / last12[0]) : 0;

      const X = Math.max(1, Math.round(input.totalQty));
      const horizonMin = { low: 120, medium: 60, high: 20 }[input.urgency];
      const kappaT = { low: 0.5, medium: 1.5, high: 3 }[input.urgency];   // 风险厌恶程度（越急越前置）
      const riskW = { low: 0.25, medium: 0.5, high: 1 }[input.urgency];
      const N = Math.max(3, Math.min(12, Math.round(horizonMin / 10)));
      const dtMin = horizonMin / N;
      const now = Date.now();
      const bucketVol = Array.from({ length: N }, (_, j) => {
        let v = 0;
        for (let m = 0; m < dtMin; m += 5) v += slotVol(now + (j * dtMin + m) * 60_000);
        return v;
      });
      const horizonVol = bucketVol.reduce((s, v) => s + v, 0);
      const halfSpreadBps = (inst.tick / 2 / price) * 1e4;   // 半个最小变动价位（国债期货盘口通常一档价差）
      const Y = 1;                                            // 平方根冲击模型系数（文献常用标定值）
      const impactBps = (q: number) => (adv > 0 ? Y * sigmaD * Math.sqrt(q / adv) * 1e4 : 0);
      const riskBps = (rem: number[]) => sigmaD * 1e4 * Math.sqrt(rem.reduce((s, x) => s + x * x, 0) * (dtMin / (23 * 60)));
      const evalSched = (q: number[]) => {
        const slip = halfSpreadBps;
        const imp = q.reduce((s, x) => s + x * impactBps(x), 0) / X;
        const rem: number[] = [];
        let left = X;
        for (const x of q) { left -= x; rem.push(left / X); }
        const risk = riskBps(rem);
        return { slippageBps: r2(slip), impactBps: r2(imp), riskBps: r2(risk), totalCostBps: r2(slip + imp + riskW * risk) };
      };
      // Almgren-Chriss 轨迹：x(t) = sinh(κ(T−t)) / sinh(κT)
      const ac: number[] = [];
      for (let j = 1; j <= N; j++) {
        const a = Math.sinh(kappaT * (1 - (j - 1) / N)) / Math.sinh(kappaT);
        const b = Math.sinh(kappaT * (1 - j / N)) / Math.sinh(kappaT);
        ac.push(X * (a - b));
      }
      const twap = Array.from({ length: N }, () => X / N);
      const vwap = horizonVol > 0 ? bucketVol.map((v) => (X * v) / horizonVol) : twap;
      const once = [X, ...Array.from({ length: N - 1 }, () => 0)];
      const sAC = evalSched(ac), sTW = evalSched(twap), sVW = evalSched(vwap), sOnce = evalSched(once);
      const all = [
        { name: 'Almgren-Chriss 最优执行', ...sAC },
        { name: 'TWAP 时间加权', ...sTW },
        { name: 'VWAP 成交量加权', ...sVW },
        { name: '一次性市价单', ...sOnce },
      ];
      const best = all.reduce((b, s) => (s.totalCostBps < b.totalCostBps ? s : b), all[0]);
      const strategyComparison = all.map((s) => ({ name: s.name, slippageBps: s.slippageBps, impactBps: s.impactBps, totalCostBps: s.totalCostBps, savingsBps: r2(sOnce.totalCostBps - s.totalCostBps), recommended: s.name === best.name }));
      const sign = input.side === 'buy' ? 1 : -1;
      const executionPath = ac.map((q, j) => {
        const part = bucketVol[j] > 0 ? q / bucketVol[j] : 1;
        return {
          slice: j + 1,
          qty: Math.round(q),
          suggestedPrice: r4(price + sign * (part < 0.03 ? 0 : inst.tick)),
          action: part < 0.03 ? '限价挂单（排队）' : part < 0.1 ? '对价成交' : '分笔吃单',
          estimatedImpactBps: r2(impactBps(q)),
          confidence: r4(Math.min(1, bucketVol[j] > 0 ? (0.1 * bucketVol[j]) / Math.max(1, q) : 0)), // 该时段 10% 参与率可覆盖的比例
          timeWindow: `T+${Math.round((j + 1) * dtMin)}min`,
        };
      });
      const participation = horizonVol > 0 ? X / horizonVol : 1;
      const marketState = {
        bidAskSpread: inst.tick,
        orderBookDepth: Math.round(avg5m),
        volatility: r4(sigmaD),
        momentum: Number(momentum.toFixed(5)),
        volume: Number(t?.volume ?? daily[daily.length - 1]?.v ?? 0),
        timeOfDay: Number((new Date().getUTCHours() / 24).toFixed(3)),
        marketImpactCoeff: Y,
        liquidityScore: r4(horizonVol > 0 ? horizonVol / (horizonVol + X) : 0),
      };
      const slippageAnalysis = {
        predictedSlippageBps: sAC.slippageBps,
        marketImpactBps: sAC.impactBps,
        priceImprovementBps: r2(sOnce.totalCostBps - sAC.totalCostBps),
        implementationShortfallBps: r2(sAC.slippageBps + sAC.impactBps),
        participationRate: r4(Math.min(1, participation)),
        estimatedDuration: `${horizonMin} 分钟`,
        liquidityStatus: participation < 0.05 ? '充裕' : participation < 0.15 ? '一般' : '偏低',
      };
      const expCost = (sAC.slippageBps + sAC.impactBps) / 1e4;
      return {
        success: true,
        bondId: inst.id,
        side: input.side,
        totalQty: X,
        urgency: input.urgency,
        algorithm: 'Almgren-Chriss 最优执行（平方根冲击模型）',
        marketState,
        executionPath,
        strategyComparison,
        slippageAnalysis,
        reward: -best.totalCostBps,
        benchmarkPrice: r4(price),
        executedPrice: r4(price * (1 + sign * expCost)),
        recommendation: `${best.name}综合成本最低（${best.totalCostBps.toFixed(2)} bps，含时间风险加权）。按 Almgren-Chriss 轨迹分 ${N} 批、${horizonMin} 分钟内完成，预计占同期成交量 ${(participation * 100).toFixed(1)}%，${participation < 0.05 ? '流动性充裕，可适当加快节奏。' : '参与率偏高，建议拉长执行时间以降低冲击。'}`,
        timestamp: new Date().toISOString(),
      };
    }),

  // 一级市场参与者结构：最近一次附息国债拍卖各类投标人获配比例（财政部公布）
  getDealers: publicProcedure
    .query(async () => {
      const a = await treasuryAuctions().catch(() => null);
      const last = a?.results.find((r) => (r.type === 'Note' || r.type === 'Bond') && r.dealer != null);
      const at = last ? new Date(`${last.auction}T00:00:00Z`).toISOString() : new Date().toISOString();
      const pct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : '—');
      return {
        success: true,
        data: last ? [
          { id: 'PD', name: `一级交易商（${last.term} ${last.type} 获配 ${pct(last.dealer)}）`, status: 'reported', lastUpdate: at, share: last.dealer },
          { id: 'DIRECT', name: `直接投标人（获配 ${pct(last.direct)}）`, status: 'reported', lastUpdate: at, share: last.direct },
          { id: 'INDIRECT', name: `间接投标人（含境外官方，获配 ${pct(last.indirect)}）`, status: 'reported', lastUpdate: at, share: last.indirect },
        ] : [],
        timestamp: new Date().toISOString(),
      };
    }),
});

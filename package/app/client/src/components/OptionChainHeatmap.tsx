/**
 * OptionChainHeatmap - 期权链热力图组件
 * 支持行权价 × 到期日矩阵可视化，以及基础对冲策略建议
 */
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, TrendingUp, TrendingDown, PlayCircle, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { trpc } from '@/lib/trpc';

// ============================================================
// 类型定义
// ============================================================

interface OptionChainRow {
  strike: number;
  expiry: string;
  daysToExpiry: number;
  callBid: number; callAsk: number; callLast: number; callVol: number; callOI: number;
  callIV: number; callDelta: number; callGamma: number; callVega: number; callTheta: number;
  callRho: number;
  callVanna: number; callCharm: number; callSpeed: number; callVomma: number;
  callZomma: number; callColor: number; callUltima: number;
  putBid: number; putAsk: number; putLast: number; putVol: number; putOI: number;
  putIV: number; putDelta: number; putGamma: number; putVega: number; putTheta: number;
  putRho: number;
  putVanna: number; putCharm: number; putSpeed: number; putVomma: number;
  putZomma: number; putColor: number; putUltima: number;
  pcRatio: number; intrinsicCall: number; intrinsicPut: number;
  arbitrageSignal: string | null; arbitrageScore: number;
}

interface HedgeStrategy {
  name: string;
  desc: string;
  legs: Array<{ type: 'call' | 'put'; side: 'buy' | 'sell'; strike: number; expiry: string }>;
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
}

type HedgeStrategyType = 'collar' | 'call_spread' | 'put_spread' | 'butterfly';

/** 前端策略名 → 回测引擎策略类型映射 */
export function strategyNameToType(name: string): HedgeStrategyType | null {
  if (name.includes('Call Spread')) return 'call_spread';
  if (name.includes('Put Spread')) return 'put_spread';
  if (name.includes('Collar')) return 'collar';
  if (name.includes('Butterfly')) return 'butterfly';
  return null;
}

// ============================================================
// 对冲策略生成引擎
// ============================================================

export function generateHedgeStrategies(
  chain: OptionChainRow[],
  underlying: { price: number; iv30: number },
  side: 'long' | 'short' = 'long'
): HedgeStrategy[] {
  const S = underlying.price;
  const strategies: HedgeStrategy[] = [];

  // 处理空数据
  if (chain.length === 0) return strategies;

  // 找到 ATM 行权价
  const atmRow = chain.reduce((prev, curr) =>
    Math.abs(curr.strike - S) < Math.abs(prev.strike - S) ? curr : prev
  );

  const atmStrike = atmRow.strike;
  const primaryExpiry = atmRow.expiry;

  // 1. Call Spread（看涨价差）- 适合温和看涨
  const callSpreadCandidates = chain.filter(
    r => r.callDelta > 0.4 && r.callDelta < 0.7 && r.callGamma > 0.01 && r.expiry === primaryExpiry
  );
  if (callSpreadCandidates.length >= 2) {
    const buyStrike = callSpreadCandidates[0].strike;
    const sellStrike = callSpreadCandidates[callSpreadCandidates.length - 1].strike;
    if (buyStrike < sellStrike) {
      const buyRow = chain.find(r => r.strike === buyStrike && r.expiry === primaryExpiry)!;
      const sellRow = chain.find(r => r.strike === sellStrike && r.expiry === primaryExpiry)!;
      strategies.push({
        name: 'Call Spread（看涨价差）',
        desc: `买入 ${buyStrike} Call，卖出 ${sellStrike} Call`,
        legs: [
          { type: 'call', side: 'buy', strike: buyStrike, expiry: primaryExpiry },
          { type: 'call', side: 'sell', strike: sellStrike, expiry: primaryExpiry },
        ],
        signal: 'bullish',
        confidence: Math.min(100, (buyRow.callGamma + sellRow.callGamma) * 500),
        maxProfit: (sellStrike - buyStrike) * 100 - (buyRow.callAsk - sellRow.callBid) * 100,
        maxLoss: (buyRow.callAsk - sellRow.callBid) * 100,
        breakeven: [buyStrike + (buyRow.callAsk - sellRow.callBid) / 100],
      });
    }
  }

  // 2. Put Spread（看跌价差）- 适合温和看跌
  const putSpreadCandidates = chain.filter(
    r => r.putDelta < -0.4 && r.putDelta > -0.7 && r.putGamma > 0.01 && r.expiry === primaryExpiry
  );
  if (putSpreadCandidates.length >= 2) {
    const buyStrike = putSpreadCandidates[putSpreadCandidates.length - 1].strike;
    const sellStrike = putSpreadCandidates[0].strike;
    if (sellStrike < buyStrike) {
      const buyRow = chain.find(r => r.strike === buyStrike && r.expiry === primaryExpiry)!;
      const sellRow = chain.find(r => r.strike === sellStrike && r.expiry === primaryExpiry)!;
      strategies.push({
        name: 'Put Spread（看跌价差）',
        desc: `买入 ${buyStrike} Put，卖出 ${sellStrike} Put`,
        legs: [
          { type: 'put', side: 'buy', strike: buyStrike, expiry: primaryExpiry },
          { type: 'put', side: 'sell', strike: sellStrike, expiry: primaryExpiry },
        ],
        signal: 'bearish',
        confidence: Math.min(100, (buyRow.putGamma + sellRow.putGamma) * 500),
        maxProfit: (buyStrike - sellStrike) * 100 - (buyRow.putAsk - sellRow.putBid) * 100,
        maxLoss: (buyRow.putAsk - sellRow.putBid) * 100,
        breakeven: [buyStrike - (buyRow.putAsk - sellRow.putBid) / 100],
      });
    }
  }

  // 3. Collar（领口策略）- 风险对冲
  const collarPut = chain.find(
    r => Math.abs(r.putDelta - (-0.25)) < 0.05 && r.expiry === primaryExpiry
  );
  const collarCall = chain.find(
    r => Math.abs(r.callDelta - 0.25) < 0.05 && r.expiry === primaryExpiry
  );
  if (collarPut && collarCall) {
    strategies.push({
      name: 'Collar（领口策略）',
      desc: `买入 ${collarPut.strike} Put，卖出 ${collarCall.strike} Call - 对冲下行风险`,
      legs: [
        { type: 'put', side: 'buy', strike: collarPut.strike, expiry: primaryExpiry },
        { type: 'call', side: 'sell', strike: collarCall.strike, expiry: primaryExpiry },
      ],
      signal: 'neutral',
      confidence: 75,
      maxProfit: (collarCall.strike - S) * 100 + (collarCall.callBid - collarPut.putAsk) * 100,
      maxLoss: (S - collarPut.strike) * 100 - (collarCall.callBid - collarPut.putAsk) * 100,
      breakeven: [S],
    });
  }

  // 4. Butterfly（蝶式策略）- 低成本中性策略
  const butterflyRows = chain.filter(r => r.expiry === primaryExpiry);
  const lowerIdx = Math.floor(butterflyRows.length / 3);
  const middleIdx = Math.floor(butterflyRows.length / 2);
  const upperIdx = Math.floor((butterflyRows.length * 2) / 3);
  if (lowerIdx < middleIdx && middleIdx < upperIdx) {
    const lower = butterflyRows[lowerIdx];
    const middle = butterflyRows[middleIdx];
    const upper = butterflyRows[upperIdx];
    const netCost = (lower.callAsk + upper.callAsk - 2 * middle.callBid) * 100;
    strategies.push({
      name: 'Butterfly（蝶式策略）',
      desc: `买入 ${lower.strike} Call，卖出 2× ${middle.strike} Call，买入 ${upper.strike} Call`,
      legs: [
        { type: 'call', side: 'buy', strike: lower.strike, expiry: primaryExpiry },
        { type: 'call', side: 'sell', strike: middle.strike, expiry: primaryExpiry },
        { type: 'call', side: 'sell', strike: middle.strike, expiry: primaryExpiry },
        { type: 'call', side: 'buy', strike: upper.strike, expiry: primaryExpiry },
      ],
      signal: 'neutral',
      confidence: 65,
      maxProfit: (middle.strike - lower.strike) * 100 - netCost,
      maxLoss: netCost,
      breakeven: [lower.strike + netCost / 100, upper.strike - netCost / 100],
    });
  }

  return strategies;
}

// ============================================================
// 颜色映射函数
// ============================================================

function getHeatColor(value: number, min: number, max: number, metric: 'iv' | 'delta' | 'volume'): string {
  const normalized = (value - min) / (max - min);
  if (metric === 'iv') {
    // IV: 低→绿色，高→红色
    if (normalized < 0.33) return '#10b981'; // green
    if (normalized < 0.66) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  } else if (metric === 'delta') {
    // Delta: 负→红色，0→灰色，正→绿色
    if (value < -0.3) return '#ef4444';
    if (value < 0.3) return '#6b7280';
    return '#10b981';
  } else {
    // Volume: 低→灰色，高→蓝色
    if (normalized < 0.33) return '#6b7280';
    if (normalized < 0.66) return '#3b82f6';
    return '#0ea5e9';
  }
}

// ============================================================
// 合约下钻 Dialog（Greeks 面板 + 历史 IV 走势图）
// ============================================================

interface SelectedCell { row: OptionChainRow; side: 'call' | 'put' }

function ContractDetailDialog({
  cell, symbol, onClose,
}: { cell: SelectedCell | null; symbol: string; onClose: () => void }) {
  const enabled = cell !== null;
  const { data, isLoading } = trpc.futuresOptions.getContractIVHistory.useQuery(
    {
      symbol,
      strike: cell?.row.strike ?? 0,
      expiryDays: cell?.row.daysToExpiry ?? 30,
      isCall: cell?.side === 'call',
    },
    { enabled, refetchOnWindowFocus: false }
  );

  const row = cell?.row;
  const isCall = cell?.side === 'call';

  const firstOrder = row ? [
    { label: 'Delta (Δ)', value: isCall ? row.callDelta : row.putDelta, digits: 4 },
    { label: 'Gamma (Γ)', value: isCall ? row.callGamma : row.putGamma, digits: 6 },
    { label: 'Vega (ν)', value: isCall ? row.callVega : row.putVega, digits: 4 },
    { label: 'Theta (Θ)', value: isCall ? row.callTheta : row.putTheta, digits: 4 },
    { label: 'Rho (ρ)', value: isCall ? row.callRho : row.putRho, digits: 4 },
  ] : [];
  const secondOrder = row ? [
    { label: 'Vanna', value: isCall ? row.callVanna : row.putVanna, digits: 6 },
    { label: 'Charm', value: isCall ? row.callCharm : row.putCharm, digits: 6 },
    { label: 'Speed', value: isCall ? row.callSpeed : row.putSpeed, digits: 8 },
    { label: 'Vomma', value: isCall ? row.callVomma : row.putVomma, digits: 6 },
    { label: 'Zomma', value: isCall ? row.callZomma : row.putZomma, digits: 6 },
    { label: 'Color', value: isCall ? row.callColor : row.putColor, digits: 8 },
    { label: 'Ultima', value: isCall ? row.callUltima : row.putUltima, digits: 6 },
  ] : [];

  return (
    <Dialog open={cell !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="bg-[#0d1a15] border-[#1e2a20] text-slate-200 max-w-3xl max-h-[85vh] overflow-y-auto">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="text-teal-400 font-mono">
                {symbol} {row.strike} {isCall ? 'CALL' : 'PUT'} · {row.expiry}
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs">
                合约下钻分析：完整希腊字母 + 30 天历史隐含波动率走势
              </DialogDescription>
            </DialogHeader>

            {/* 合约基本信息 */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
              {[
                { label: 'Bid', value: `$${(isCall ? row.callBid : row.putBid).toFixed(2)}` },
                { label: 'Ask', value: `$${(isCall ? row.callAsk : row.putAsk).toFixed(2)}` },
                { label: 'Last', value: `$${(isCall ? row.callLast : row.putLast).toFixed(2)}` },
                { label: '成交量', value: (isCall ? row.callVol : row.putVol).toLocaleString() },
                { label: '未平仓', value: (isCall ? row.callOI : row.putOI).toLocaleString() },
                { label: 'IV', value: `${(isCall ? row.callIV : row.putIV).toFixed(1)}%` },
              ].map(item => (
                <div key={item.label} className="bg-[#050a08] rounded p-2 border border-[#1e2a20]">
                  <div className="text-slate-500">{item.label}</div>
                  <div className="font-mono font-bold text-slate-200">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Greeks 面板 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-bold text-teal-400 mb-1.5">一阶希腊字母</div>
                <div className="space-y-1">
                  {firstOrder.map(g => (
                    <div key={g.label} className="flex justify-between text-xs bg-[#050a08] rounded px-2 py-1.5 border border-[#1e2a20]">
                      <span className="text-slate-500">{g.label}</span>
                      <span className={`font-mono font-bold ${g.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {g.value.toFixed(g.digits)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-teal-400 mb-1.5">二阶/三阶希腊字母</div>
                <div className="space-y-1">
                  {secondOrder.map(g => (
                    <div key={g.label} className="flex justify-between text-xs bg-[#050a08] rounded px-2 py-1.5 border border-[#1e2a20]">
                      <span className="text-slate-500">{g.label}</span>
                      <span className={`font-mono font-bold ${g.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {g.value.toFixed(g.digits)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 历史 IV 走势图 */}
            <div>
              <div className="text-xs font-bold text-teal-400 mb-1.5">30 天历史隐含波动率走势</div>
              {isLoading && (
                <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载历史 IV 数据…
                </div>
              )}
              {!isLoading && data && data.ivHistory.length > 0 && (
                <div className="h-48 bg-[#050a08] rounded border border-[#1e2a20] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.ivHistory} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2a20" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                      <RTooltip
                        contentStyle={{ backgroundColor: '#0d1a15', border: '1px solid #1e2a20', fontSize: 11 }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(v: number, name: string) => [name === 'iv' ? `${v.toFixed(2)}%` : v.toFixed(4), name === 'iv' ? 'IV' : name === 'delta' ? 'Delta' : 'Gamma']}
                      />
                      <Line type="monotone" dataKey="iv" stroke="#14b8a6" strokeWidth={2} dot={false} name="iv" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {!isLoading && data && data.contractInfo && data.contractInfo.currentIV != null && data.ivHistory.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-[#050a08] rounded p-2 border border-[#1e2a20]">
                    <div className="text-slate-500">当前 IV</div>
                    <div className="font-mono font-bold text-teal-300">{data.contractInfo.currentIV.toFixed(2)}%</div>
                  </div>
                  <div className="bg-[#050a08] rounded p-2 border border-[#1e2a20]">
                    <div className="text-slate-500">30 日最高</div>
                    <div className="font-mono font-bold text-red-400">{Math.max(...data.ivHistory.map(h => h.iv)).toFixed(2)}%</div>
                  </div>
                  <div className="bg-[#050a08] rounded p-2 border border-[#1e2a20]">
                    <div className="text-slate-500">30 日最低</div>
                    <div className="font-mono font-bold text-green-400">{Math.min(...data.ivHistory.map(h => h.iv)).toFixed(2)}%</div>
                  </div>
                </div>
              )}
              {!isLoading && data && (!data.available || data.ivHistory.length === 0 || data.contractInfo?.currentIV == null) && (
                <div className="mt-2 border border-amber-900/60 bg-amber-950/20 px-3 py-3 text-xs text-amber-200">
                  {data.reason}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 策略回测结果 Dialog
// ============================================================

function StrategyBacktestDialog({
  open, onClose, strategyName, symbol,
}: { open: boolean; onClose: () => void; strategyName: string; symbol: string }) {
  const [range, setRange] = useState<'3mo' | '6mo' | '1y'>('6mo');
  const backtest = trpc.futuresOptions.backtestHedgeStrategy.useMutation();
  const strategyType = strategyNameToType(strategyName);

  const runBacktest = (r: '3mo' | '6mo' | '1y') => {
    if (!strategyType) return;
    backtest.mutate({ symbol, strategyType, range: r, initialCapital: 100000 });
  };

  // 打开时自动跑一次
  useEffect(() => {
    if (open && strategyType && !backtest.data && !backtest.isPending) {
      runBacktest(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const result = backtest.data;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); backtest.reset(); } }}>
      <DialogContent className="bg-[#0d1a15] border-[#1e2a20] text-slate-200 max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-teal-400">{strategyName} · 历史回测</DialogTitle>
          <DialogDescription className="text-slate-500 text-xs">
            标的 {symbol} · 每月滚动开仓 30 天期策略 · BSM 每日盯市 · 初始资金 $100,000
          </DialogDescription>
        </DialogHeader>

        {/* 区间选择 */}
        <div className="flex gap-1.5">
          {(['3mo', '6mo', '1y'] as const).map(r => (
            <button
              key={r}
              onClick={() => { setRange(r); runBacktest(r); }}
              disabled={backtest.isPending}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                range === r ? 'bg-teal-500 text-white' : 'bg-[#050a08] text-slate-400 border border-[#1e2a20] hover:border-teal-500/40'
              }`}
            >
              {r === '3mo' ? '3 个月' : r === '6mo' ? '6 个月' : '1 年'}
            </button>
          ))}
        </div>

        {backtest.isPending && (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 回测运行中…
          </div>
        )}

        {backtest.isError && (
          <div className="p-3 rounded border border-red-500/30 bg-red-500/5 text-xs text-red-400">
            回测失败：{backtest.error.message}
          </div>
        )}

        {!backtest.isPending && result && (
          <>
            {/* 绩效指标卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { label: '总收益率', value: `${result.metrics.totalReturn >= 0 ? '+' : ''}${result.metrics.totalReturn.toFixed(2)}%`, color: result.metrics.totalReturn >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: '基准收益率', value: `${result.metrics.benchmarkReturn >= 0 ? '+' : ''}${result.metrics.benchmarkReturn.toFixed(2)}%`, color: 'text-slate-300' },
                { label: '年化收益率', value: `${result.metrics.annualizedReturn.toFixed(2)}%`, color: result.metrics.annualizedReturn >= 0 ? 'text-green-400' : 'text-red-400' },
                { label: '夏普比率', value: result.metrics.sharpe.toFixed(3), color: 'text-teal-300' },
                { label: '最大回撤', value: `-${result.metrics.maxDrawdown.toFixed(2)}%`, color: 'text-red-400' },
                { label: '胜率（轮次）', value: `${result.metrics.winRate.toFixed(1)}%`, color: 'text-slate-300' },
                { label: '滚动轮次', value: `${result.metrics.numRounds}`, color: 'text-slate-300' },
                { label: '年化波动率', value: `${result.metrics.volatility.toFixed(2)}%`, color: 'text-slate-300' },
              ].map(m => (
                <div key={m.label} className="bg-[#050a08] rounded p-2 border border-[#1e2a20]">
                  <div className="text-slate-500">{m.label}</div>
                  <div className={`font-mono font-bold ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* 权益曲线 */}
            <div>
              <div className="text-xs font-bold text-teal-400 mb-1.5">
                权益曲线 vs 买入持有基准
                <span className="ml-2 text-slate-500 font-normal">
                  数据源: {result.dataSource} · 估值模式: {result.valuationMode}
                </span>
              </div>
              <div className="h-56 bg-[#050a08] rounded border border-[#1e2a20] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.equityCurve} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a20" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(d: string) => d.slice(5)} minTickGap={40} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <RTooltip
                      contentStyle={{ backgroundColor: '#0d1a15', border: '1px solid #1e2a20', fontSize: 11 }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name === 'portfolio' ? '策略组合' : '基准(买入持有)']}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v: string) => v === 'portfolio' ? '策略组合' : '基准(买入持有)'} />
                    <ReferenceLine y={100000} stroke="#475569" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="portfolio" stroke="#14b8a6" strokeWidth={2} dot={false} name="portfolio" />
                    <Line type="monotone" dataKey="benchmark" stroke="#64748b" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="benchmark" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 交易记录 */}
            {result.trades.length > 0 && (
              <div>
                <div className="text-xs font-bold text-teal-400 mb-1.5">交易记录（最近 {result.trades.length} 条）</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.trades.slice().reverse().map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-[#050a08] rounded px-2 py-1.5 border border-[#1e2a20]">
                      <span className="text-slate-500 font-mono shrink-0">{t.date}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${t.action === 'OPEN' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                        {t.action === 'OPEN' ? '开仓' : '结算'}
                      </Badge>
                      <span className="text-slate-400 truncate">{t.detail}</span>
                      {t.action === 'SETTLE' && (
                        <span className={`ml-auto font-mono font-bold shrink-0 ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(0)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// OptionChainHeatmap 主组件
// ============================================================

interface OptionChainHeatmapProps {
  chain: OptionChainRow[];
  underlying: { symbol: string; price: number; iv30: number };
  isLoading?: boolean;
}

export function OptionChainHeatmap({ chain, underlying, isLoading = false }: OptionChainHeatmapProps) {
  const [metric, setMetric] = useState<'iv' | 'delta' | 'volume'>('iv');
  const [strikeMin, setStrikeMin] = useState(0);
  const [strikeMax, setStrikeMax] = useState(100);
  const [rangeInited, setRangeInited] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [optionType, setOptionType] = useState<'call' | 'put' | 'both'>('both');
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [backtestStrategy, setBacktestStrategy] = useState<string | null>(null);

  // 提取唯一的到期日和行权价范围
  const expiries = useMemo(() => Array.from(new Set(chain.map(r => r.expiry))).sort(), [chain]);
  const strikes = useMemo(() => Array.from(new Set(chain.map(r => r.strike))).sort((a, b) => a - b), [chain]);

  // 根据实际期权链数据同步行权价范围（首次加载或标的切换后范围失效时）
  useEffect(() => {
    if (strikes.length === 0) return;
    const lo = strikes[0];
    const hi = strikes[strikes.length - 1];
    // 未初始化，或当前范围与实际行权价完全不相交时，重置为全范围
    if (!rangeInited || strikeMax < lo || strikeMin > hi) {
      setStrikeMin(lo);
      setStrikeMax(hi);
      setRangeInited(true);
    }
  }, [strikes, rangeInited, strikeMin, strikeMax]);

  // 初始化到期日选择
  const activeExpiry = useMemo(() => {
    if (selectedExpiry && expiries.includes(selectedExpiry)) return selectedExpiry;
    return expiries[0] || '';
  }, [selectedExpiry, expiries]);

  // 过滤数据
  const filteredChain = useMemo(() => {
    return chain.filter(r => {
      if (activeExpiry && r.expiry !== activeExpiry) return false;
      if (r.strike < strikeMin || r.strike > strikeMax) return false;
      return true;
    });
  }, [chain, activeExpiry, strikeMin, strikeMax]);

  // 计算热力图数据
  const heatmapData = useMemo(() => {
    if (metric === 'iv') {
      const callData = filteredChain.map(r => ({
        strike: r.strike,
        value: r.callIV,
        label: `${r.strike} Call IV: ${r.callIV.toFixed(1)}%`,
      }));
      const putData = filteredChain.map(r => ({
        strike: r.strike,
        value: r.putIV,
        label: `${r.strike} Put IV: ${r.putIV.toFixed(1)}%`,
      }));
      return { call: callData, put: putData };
    } else if (metric === 'delta') {
      const callData = filteredChain.map(r => ({
        strike: r.strike,
        value: r.callDelta,
        label: `${r.strike} Call Δ: ${r.callDelta.toFixed(3)}`,
      }));
      const putData = filteredChain.map(r => ({
        strike: r.strike,
        value: r.putDelta,
        label: `${r.strike} Put Δ: ${r.putDelta.toFixed(3)}`,
      }));
      return { call: callData, put: putData };
    } else {
      const callData = filteredChain.map(r => ({
        strike: r.strike,
        value: r.callVol,
        label: `${r.strike} Call Vol: ${r.callVol.toLocaleString()}`,
      }));
      const putData = filteredChain.map(r => ({
        strike: r.strike,
        value: r.putVol,
        label: `${r.strike} Put Vol: ${r.putVol.toLocaleString()}`,
      }));
      return { call: callData, put: putData };
    }
  }, [filteredChain, metric]);

  // 计算值域范围
  const valueRanges = useMemo(() => {
    const allValues = [...heatmapData.call, ...heatmapData.put].map(d => d.value);
    if (allValues.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...allValues),
      max: Math.max(...allValues),
    };
  }, [heatmapData]);

  // 生成对冲策略
  const strategies = useMemo(() => {
    if (!activeExpiry || filteredChain.length === 0) return [];
    return generateHedgeStrategies(filteredChain, underlying);
  }, [filteredChain, underlying, activeExpiry]);

  if (isLoading) {
    return (
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
        <div className="text-center py-12 text-slate-500">加载期权链热力图…</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 控制面板 */}
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-slate-500 mb-1">热力图指标</div>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value as any)}
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5"
            >
              <option value="iv">隐含波动率 (IV)</option>
              <option value="delta">Delta 敏感度</option>
              <option value="volume">成交量</option>
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">到期日</div>
            <select
              value={activeExpiry}
              onChange={e => setSelectedExpiry(e.target.value)}
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5"
            >
              {expiries.map(exp => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">期权类型</div>
            <select
              value={optionType}
              onChange={e => setOptionType(e.target.value as any)}
              className="text-xs bg-[#050a08] border border-[#1e2a20] text-slate-300 rounded px-2 py-1.5"
            >
              <option value="both">全部</option>
              <option value="call">Call 看涨</option>
              <option value="put">Put 看跌</option>
            </select>
          </div>

          <div className="flex-1 min-w-48">
            <div className="text-xs text-slate-500 mb-1">行权价范围: {strikeMin} - {strikeMax}</div>
            <Slider
              value={[strikeMin, strikeMax]}
              onValueChange={([min, max]) => {
                setStrikeMin(min);
                setStrikeMax(max);
              }}
              min={Math.min(...strikes)}
              max={Math.max(...strikes)}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* 热力图表 */}
      <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
        <h3 className="text-sm font-bold text-teal-400 mb-3">期权链热力图 ({underlying.symbol})</h3>
        <div className="space-y-4">
          {/* Call 热力图 */}
          {(optionType === 'call' || optionType === 'both') && (
            <div>
              <div className="text-xs text-green-400 font-bold mb-2">看涨期权 (Call)</div>
              <div className="flex gap-1 flex-wrap">
                {heatmapData.call.map(d => (
                  <div
                    key={`call-${d.strike}`}
                    className="px-2 py-1 rounded text-xs font-mono text-white transition-all hover:scale-110 cursor-pointer hover:ring-1 hover:ring-teal-400"
                    style={{
                      backgroundColor: getHeatColor(d.value, valueRanges.min, valueRanges.max, metric),
                      opacity: 0.8,
                    }}
                    title={`${d.label}（点击查看合约详情）`}
                    onClick={() => {
                      const row = filteredChain.find(r => r.strike === d.strike);
                      if (row) setSelectedCell({ row, side: 'call' });
                    }}
                  >
                    {d.strike}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Put 热力图 */}
          {(optionType === 'put' || optionType === 'both') && (
            <div>
              <div className="text-xs text-red-400 font-bold mb-2">看跌期权 (Put)</div>
              <div className="flex gap-1 flex-wrap">
                {heatmapData.put.map(d => (
                  <div
                    key={`put-${d.strike}`}
                    className="px-2 py-1 rounded text-xs font-mono text-white transition-all hover:scale-110 cursor-pointer hover:ring-1 hover:ring-teal-400"
                    style={{
                      backgroundColor: getHeatColor(d.value, valueRanges.min, valueRanges.max, metric),
                      opacity: 0.8,
                    }}
                    title={`${d.label}（点击查看合约详情）`}
                    onClick={() => {
                      const row = filteredChain.find(r => r.strike === d.strike);
                      if (row) setSelectedCell({ row, side: 'put' });
                    }}
                  >
                    {d.strike}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 图例 */}
        <div className="mt-4 flex gap-4 text-xs">
          {metric === 'iv' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }} />
                <span>低 IV</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }} />
                <span>中 IV</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
                <span>高 IV</span>
              </div>
            </>
          )}
          {metric === 'delta' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
                <span>看跌 (Δ &lt; -0.3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6b7280' }} />
                <span>中性</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }} />
                <span>看涨 (Δ &gt; 0.3)</span>
              </div>
            </>
          )}
          {metric === 'volume' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6b7280' }} />
                <span>低成交量</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }} />
                <span>中成交量</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#0ea5e9' }} />
                <span>高成交量</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* 对冲策略建议 */}
      {strategies.length > 0 && (
        <Card className="bg-[#0d1a15] border-[#1e2a20] p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-bold text-teal-400">基础对冲策略建议</h3>
          </div>

          <div className="space-y-3">
            {strategies.map((strategy, idx) => (
              <div
                key={idx}
                className={`p-3 rounded border ${
                  strategy.signal === 'bullish'
                    ? 'border-green-500/30 bg-green-500/5'
                    : strategy.signal === 'bearish'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-slate-500/30 bg-slate-500/5'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-slate-200">{strategy.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{strategy.desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-xs ${
                        strategy.signal === 'bullish'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : strategy.signal === 'bearish'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {strategy.signal === 'bullish' && <TrendingUp className="w-3 h-3 mr-1" />}
                      {strategy.signal === 'bearish' && <TrendingDown className="w-3 h-3 mr-1" />}
                      {strategy.signal === 'bullish'
                        ? '看涨'
                        : strategy.signal === 'bearish'
                        ? '看跌'
                        : '中性'}
                    </Badge>
                    <div className="text-xs text-slate-500">
                      信心度: <span className="font-bold text-slate-300">{strategy.confidence.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* 策略腿 */}
                <div className="text-xs text-slate-500 mb-2">
                  <span className="font-bold">策略腿:</span>
                  {strategy.legs.map((leg, i) => (
                    <div key={i} className="ml-2 text-slate-400">
                      {leg.side === 'buy' ? '🟢 买入' : '🔴 卖出'} {leg.strike} {leg.type.toUpperCase()}
                    </div>
                  ))}
                </div>

                {/* 风险收益 */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-[#050a08] rounded p-2">
                    <div className="text-slate-500">最大收益</div>
                    <div className="font-mono font-bold text-green-400">${strategy.maxProfit.toFixed(0)}</div>
                  </div>
                  <div className="bg-[#050a08] rounded p-2">
                    <div className="text-slate-500">最大亏损</div>
                    <div className="font-mono font-bold text-red-400">${strategy.maxLoss.toFixed(0)}</div>
                  </div>
                  <div className="bg-[#050a08] rounded p-2">
                    <div className="text-slate-500">盈亏平衡点</div>
                    <div className="font-mono font-bold text-slate-300">
                      {strategy.breakeven.map(be => be.toFixed(2)).join(', ')}
                    </div>
                  </div>
                </div>

                {/* 一键回测 */}
                {strategyNameToType(strategy.name) && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-teal-600 hover:bg-teal-500 text-white"
                      onClick={() => setBacktestStrategy(strategy.name)}
                    >
                      <PlayCircle className="w-3.5 h-3.5 mr-1" /> 一键回测
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {strategies.length === 0 && filteredChain.length > 0 && (
        <Card className="bg-[#0d1a15] border-[#1e2a20] p-4 text-center text-slate-500 text-sm">
          当前筛选条件下无合适对冲策略建议
        </Card>
      )}

      {/* 合约下钻 Dialog */}
      <ContractDetailDialog
        cell={selectedCell}
        symbol={underlying.symbol}
        onClose={() => setSelectedCell(null)}
      />

      {/* 策略回测 Dialog */}
      {backtestStrategy && (
        <StrategyBacktestDialog
          open={backtestStrategy !== null}
          onClose={() => setBacktestStrategy(null)}
          strategyName={backtestStrategy}
          symbol={underlying.symbol}
        />
      )}
    </div>
  );
}

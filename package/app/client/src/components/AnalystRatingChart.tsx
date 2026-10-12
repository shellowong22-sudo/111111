/**
 * AnalystRatingChart — 分析师评级趋势可视化（增强版）
 *
 * 三个子视图：
 * 1. 月度评级分布堆叠柱状图（买入/持有/卖出）— 自定义详细 Tooltip
 * 2. 目标价历史走势折线图（各机构目标价 + 当前价）— 自定义详细 Tooltip
 * 3. 评级变动时间轴（升级/降级/首次覆盖明细）— 按评级机构筛选
 */
import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, BarChart2, Clock,
  Filter, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { DataLoadingSkeleton } from '@/components/ChartSkeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubView = 'distribution' | 'target' | 'changes';

interface Props {
  ticker: string;
  currentPrice?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHG_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  upgrade:   { label: '升级',    color: '#22c55e', dotColor: '#22c55e' },
  downgrade: { label: '降级',    color: '#ef4444', dotColor: '#ef4444' },
  initiate:  { label: '首次覆盖', color: '#f5a623', dotColor: '#f5a623' },
  reiterate: { label: '重申',    color: '#666',    dotColor: '#444'    },
};

const RATING_COLOR: Record<string, string> = {
  'Buy': '#22c55e', 'Strong Buy': '#16a34a', 'Outperform': '#4ade80',
  'Overweight': '#86efac', 'Positive': '#bbf7d0',
  'Hold': '#f5a623', 'Neutral': '#fbbf24', 'Market Perform': '#fcd34d',
  'Equal Weight': '#fde68a', 'Sector Perform': '#fef3c7',
  'Sell': '#ef4444', 'Strong Sell': '#dc2626', 'Underperform': '#f87171',
  'Underweight': '#fca5a5', 'Negative': '#fee2e2',
  '买入': '#22c55e', '增持': '#4ade80', '中性': '#f5a623',
  '持有': '#fbbf24', '减持': '#f87171', '卖出': '#ef4444',
};

// ─── Custom Tooltip: Distribution ────────────────────────────────────────────

function DistributionTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{
    name: string; value: number; color: string;
    payload: { buy: number; hold: number; sell: number; prevBuyPct: number | null; prevHoldPct: number | null; prevSellPct: number | null };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  const raw = payload[0]?.payload;

  const buyPct  = total ? ((raw?.buy  ?? 0) / total * 100) : 0;
  const holdPct = total ? ((raw?.hold ?? 0) / total * 100) : 0;
  const sellPct = total ? ((raw?.sell ?? 0) / total * 100) : 0;
  const sentiment = buyPct > 60 ? '看多' : buyPct > 40 ? '中性偏多' : sellPct > 30 ? '看空' : '中性';
  const sentimentColor = buyPct > 60 ? '#22c55e' : buyPct > 40 ? '#f5a623' : sellPct > 30 ? '#ef4444' : '#888';

  // 环比变化
  const pctMap: Record<string, { cur: number; prev: number | null }> = {
    '买入': { cur: buyPct,  prev: raw?.prevBuyPct  ?? null },
    '持有': { cur: holdPct, prev: raw?.prevHoldPct ?? null },
    '卖出': { cur: sellPct, prev: raw?.prevSellPct ?? null },
  };

  return (
    <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg shadow-xl p-3 text-[10px] min-w-[185px]">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#1a1a1a]">
        <span className="text-[#aaa] font-bold">{label} 月</span>
        <span className="font-bold" style={{ color: sentimentColor }}>{sentiment}</span>
      </div>
      {/* 各评级明细 + 环比 */}
      {payload.map(p => {
        const m = pctMap[p.name];
        const delta = m && m.prev != null ? m.cur - m.prev : null;
        return (
          <div key={p.name} className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
              <span className="text-[#888]">{p.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
              <span className="text-[#555] w-7 text-right">{total ? ((p.value / total) * 100).toFixed(0) : 0}%</span>
              {delta != null && (
                <span className={`w-9 text-right font-bold ${
                  delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-[#444]'
                }`}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
      {/* 环比说明 */}
      {raw?.prevBuyPct != null && (
        <div className="text-[#333] text-[9px] mb-1.5">右侧数字为较上月占比变化</div>
      )}
      {/* 合计 + 买入占比进度条 */}
      <div className="mt-1 pt-1.5 border-t border-[#1a1a1a]">
        <div className="flex justify-between text-[#555] mb-1.5">
          <span>合计 {total} 条评级</span>
          <span>买入占比 {buyPct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${buyPct}%` }} />
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${holdPct}%` }} />
          <div className="h-full bg-red-500 transition-all" style={{ width: `${sellPct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Custom Tooltip: Target Price ─────────────────────────────────────────────

function TargetPriceTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{
    name: string; value: number; color: string;
    payload: { month: string; avgTarget: number; maxTarget: number; minTarget: number; currentPrice: number | null; count?: number };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const spread = d.maxTarget - d.minTarget;
  const upside = d.currentPrice
    ? ((d.avgTarget - d.currentPrice) / d.currentPrice * 100)
    : null;

  return (
    <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg shadow-xl p-3 text-[10px] min-w-[170px]">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#1a1a1a]">
        <span className="text-[#aaa] font-bold">{label ?? d.month} 月</span>
        {d.count != null && <span className="text-[#555]">{d.count} 条评级</span>}
      </div>
      {/* 目标价区间 */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between">
          <span className="text-[#555]">均值目标价</span>
          <span className="text-[#f5a623] font-bold">${d.avgTarget}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">最高目标价</span>
          <span className="text-green-400">${d.maxTarget}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">最低目标价</span>
          <span className="text-red-400">${d.minTarget}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#555]">目标价区间</span>
          <span className="text-[#888]">${spread.toFixed(0)}</span>
        </div>
      </div>
      {/* 当前价 + 上行空间 */}
      {d.currentPrice != null && (
        <div className="pt-1.5 border-t border-[#1a1a1a] space-y-1">
          <div className="flex justify-between">
            <span className="text-[#555]">当前股价</span>
            <span className="text-[#eee]">${d.currentPrice}</span>
          </div>
          {upside != null && (
            <div className="flex justify-between">
              <span className="text-[#555]">均值上行空间</span>
              <span className={upside >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
              </span>
            </div>
          )}
          {/* 可视化进度条：当前价在目标价区间中的位置 */}
          <div className="mt-1.5">
            <div className="text-[#444] mb-1">当前价在目标区间位置</div>
            <div className="relative w-full h-2 bg-[#1a1a1a] rounded-full">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 via-amber-500/30 to-green-500/30 rounded-full" />
              {d.currentPrice >= d.minTarget && d.currentPrice <= d.maxTarget && (
                <div
                  className="absolute top-0 w-1.5 h-2 bg-white rounded-full -translate-x-1/2"
                  style={{
                    left: `${((d.currentPrice - d.minTarget) / (d.maxTarget - d.minTarget)) * 100}%`
                  }}
                />
              )}
            </div>
            <div className="flex justify-between text-[#333] mt-0.5">
              <span>${d.minTarget}</span>
              <span>${d.maxTarget}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-view: Distribution ───────────────────────────────────────────────────

function DistributionView({ ticker }: { ticker: string }) {
  const { data, isLoading } = trpc.res.getMonthlyRatingDistribution.useQuery({ ticker, months: 12 });

  if (isLoading) return <DataLoadingSkeleton variant="bar" height={180} label="正在加载月度评级分布" />;

  if (!data?.data?.length) return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <BarChart2 size={28} className="text-[#333]" />
      <p className="text-[#555] text-xs">暂无月度评级分布数据</p>
    </div>
  );

  const chartData = data.data.map((d, idx) => {
    const prev = idx > 0 ? data.data[idx - 1] : null;
    const prevTotal = prev ? (prev.buy + prev.hold + prev.sell) || 1 : 0;
    return {
      ...d,
      month: d.month.slice(5),
      prevBuyPct:  prev ? Math.round(prev.buy  / prevTotal * 100) : null,
      prevHoldPct: prev ? Math.round(prev.hold / prevTotal * 100) : null,
      prevSellPct: prev ? Math.round(prev.sell / prevTotal * 100) : null,
    };
  });

  const totals = data.data.reduce((acc, d) => ({
    buy: acc.buy + d.buy,
    hold: acc.hold + d.hold,
    sell: acc.sell + d.sell,
  }), { buy: 0, hold: 0, sell: 0 });
  const grand = totals.buy + totals.hold + totals.sell || 1;

  // 近 3 个月 vs 前 3 个月买入占比趋势
  const recent = data.data.slice(-3);
  const earlier = data.data.slice(-6, -3);
  const recentBuyPct = recent.length
    ? recent.reduce((s, d) => s + d.buy, 0) / recent.reduce((s, d) => s + d.buy + d.hold + d.sell, 0) * 100
    : 0;
  const earlierBuyPct = earlier.length
    ? earlier.reduce((s, d) => s + d.buy, 0) / earlier.reduce((s, d) => s + d.buy + d.hold + d.sell, 0) * 100
    : 0;
  const trendDelta = recentBuyPct - earlierBuyPct;

  return (
    <div className="space-y-3">
      {/* 汇总指标 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '买入/增持', value: totals.buy, pct: totals.buy / grand, color: '#22c55e' },
          { label: '持有/中性', value: totals.hold, pct: totals.hold / grand, color: '#f5a623' },
          { label: '卖出/减持', value: totals.sell, pct: totals.sell / grand, color: '#ef4444' },
        ].map(m => (
          <div key={m.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-2 text-center">
            <div className="text-[9px] text-[#555] mb-0.5">{m.label}</div>
            <div className="font-bold text-sm" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[9px]" style={{ color: m.color }}>{(m.pct * 100).toFixed(0)}%</div>
          </div>
        ))}
      </div>

      {/* 近期趋势提示 */}
      {earlier.length > 0 && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] border ${
          trendDelta > 3 ? 'bg-green-500/5 border-green-500/20 text-green-400'
          : trendDelta < -3 ? 'bg-red-500/5 border-red-500/20 text-red-400'
          : 'bg-[#111] border-[#1a1a1a] text-[#666]'
        }`}>
          {trendDelta > 3
            ? <TrendingUp size={11} />
            : trendDelta < -3
            ? <TrendingDown size={11} />
            : <span className="w-2.5 h-0.5 bg-current inline-block" />
          }
          <span>
            近 3 个月买入占比 {recentBuyPct.toFixed(0)}%，
            较前 3 个月{trendDelta >= 0 ? '上升' : '下降'} {Math.abs(trendDelta).toFixed(0)}%
          </span>
        </div>
      )}

      {/* 堆叠柱状图 */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-3">
        <div className="text-[#888] text-[10px] mb-2">近 12 个月评级分布（悬浮查看详情）</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            style={{ cursor: 'crosshair' }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              content={<DistributionTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Legend
              iconSize={8}
              formatter={(v) => <span style={{ color: '#888', fontSize: 9 }}>{v}</span>}
            />
            <Bar dataKey="buy" name="买入" stackId="a" fill="#22c55e" />
            <Bar dataKey="hold" name="持有" stackId="a" fill="#f5a623" />
            <Bar dataKey="sell" name="卖出" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Sub-view: Target Price ───────────────────────────────────────────────────

function TargetView({ ticker, currentPrice }: { ticker: string; currentPrice?: number }) {
  const { data, isLoading } = trpc.res.getTargetPriceTrend.useQuery({ ticker, limit: 60 });

  if (isLoading) return <DataLoadingSkeleton variant="line" height={190} label="正在加载目标价历史走势" />;

  if (!data?.data?.length) return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <Target size={28} className="text-[#333]" />
      <p className="text-[#555] text-xs">暂无目标价数据</p>
    </div>
  );

  const targets = data.data.map(d => d.target);
  const avgTarget = targets.reduce((a, b) => a + b, 0) / targets.length;
  const maxTarget = Math.max(...targets);
  const minTarget = Math.min(...targets);

  // 按月分组，计算均值/最高/最低/条数
  const grouped = data.data.reduce<Record<string, { targets: number[]; currentPrice: number | null }>>((acc, d) => {
    const key = d.date.slice(0, 7);
    if (!acc[key]) acc[key] = { targets: [], currentPrice: d.currentPrice };
    acc[key].targets.push(d.target);
    return acc;
  }, {});

  const chartData = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month: month.slice(5),
      avgTarget: Math.round(v.targets.reduce((a, b) => a + b, 0) / v.targets.length),
      maxTarget: Math.max(...v.targets),
      minTarget: Math.min(...v.targets),
      currentPrice: v.currentPrice,
      count: v.targets.length,
    }));

  const refPrice = currentPrice ?? data.data[data.data.length - 1]?.currentPrice ?? undefined;
  const latestAvg = chartData[chartData.length - 1]?.avgTarget ?? avgTarget;
  const upsidePct = refPrice ? ((latestAvg - refPrice) / refPrice * 100) : null;

  return (
    <div className="space-y-3">
      {/* 统计摘要 */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '平均目标价', value: `$${avgTarget.toFixed(0)}`, color: '#f5a623' },
          { label: '最高目标价', value: `$${maxTarget}`, color: '#22c55e' },
          { label: '最低目标价', value: `$${minTarget}`, color: '#ef4444' },
          {
            label: '均值上行空间',
            value: upsidePct != null ? `${upsidePct >= 0 ? '+' : ''}${upsidePct.toFixed(1)}%` : 'N/A',
            color: upsidePct != null ? (upsidePct >= 0 ? '#22c55e' : '#ef4444') : '#888',
          },
        ].map(m => (
          <div key={m.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-2 text-center">
            <div className="text-[9px] text-[#555] mb-0.5">{m.label}</div>
            <div className="font-bold text-xs" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* 目标价折线图 */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded p-3">
        <div className="text-[#888] text-[10px] mb-2">目标价历史走势（悬浮查看详情）</div>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            style={{ cursor: 'crosshair' }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="month" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              content={<TargetPriceTooltip />}
              cursor={{ stroke: '#333', strokeWidth: 1, strokeDasharray: '3 2' }}
            />
            {refPrice && (
              <ReferenceLine y={refPrice} stroke="#555" strokeDasharray="4 2"
                label={{ value: `$${refPrice}`, position: 'right', fill: '#666', fontSize: 9 }} />
            )}
            {/* 目标价区间阴影（最高/最低之间） */}
            <Line type="monotone" dataKey="maxTarget" name="最高目标价"
              stroke="#22c55e" strokeWidth={1} strokeDasharray="3 2" dot={false}
              activeDot={{ r: 3, fill: '#22c55e' }} />
            <Line type="monotone" dataKey="minTarget" name="最低目标价"
              stroke="#ef4444" strokeWidth={1} strokeDasharray="3 2" dot={false}
              activeDot={{ r: 3, fill: '#ef4444' }} />
            <Line type="monotone" dataKey="avgTarget" name="平均目标价"
              stroke="#f5a623" strokeWidth={2.5}
              dot={{ r: 3, fill: '#f5a623', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#f5a623', stroke: '#f5a62340', strokeWidth: 4 }} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-1 justify-center flex-wrap">
          {[
            { color: '#f5a623', label: '均值', dash: false },
            { color: '#22c55e', label: '最高', dash: true },
            { color: '#ef4444', label: '最低', dash: true },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <svg width="16" height="6">
                <line x1="0" y1="3" x2="16" y2="3"
                  stroke={l.color} strokeWidth={l.dash ? 1 : 2}
                  strokeDasharray={l.dash ? '3 2' : undefined} />
              </svg>
              <span className="text-[9px] text-[#555]">{l.label}</span>
            </div>
          ))}
          {refPrice && (
            <div className="flex items-center gap-1">
              <svg width="16" height="6">
                <line x1="0" y1="3" x2="16" y2="3" stroke="#555" strokeWidth={1} strokeDasharray="4 2" />
              </svg>
              <span className="text-[9px] text-[#555]">现价</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-view: Changes (with firm filter) ─────────────────────────────────────

function ChangesView({ ticker }: { ticker: string }) {
  const { data, isLoading } = trpc.res.getRatingChanges.useQuery({ ticker, limit: 50 });
  const [selectedFirms, setSelectedFirms] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  // 提取所有机构列表（含出现频次）
  const firmStats = useMemo(() => {
    if (!data?.data) return [];
    const counts: Record<string, number> = {};
    data.data.forEach(d => {
      counts[d.firm] = (counts[d.firm] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([firm, count]) => ({ firm, count }));
  }, [data]);

  // 筛选后的数据
  const filtered = useMemo(() => {
    if (!data?.data) return [];
    if (selectedFirms.size === 0) return data.data;
    return data.data.filter(d => selectedFirms.has(d.firm));
  }, [data, selectedFirms]);

  const toggleFirm = (firm: string) => {
    setSelectedFirms(prev => {
      const next = new Set(prev);
      if (next.has(firm)) next.delete(firm);
      else next.add(firm);
      return next;
    });
  };

  const selectAll = () => setSelectedFirms(new Set());
  const selectOnly = (firm: string) => setSelectedFirms(new Set([firm]));

  if (isLoading) return <DataLoadingSkeleton variant="table" rows={6} cols={4} label="正在加载评级变动记录" />;

  if (!data?.data?.length) return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <Clock size={28} className="text-[#333]" />
      <p className="text-[#555] text-xs">暂无评级变动记录</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* 机构筛选器 */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded overflow-hidden">
        {/* 筛选器头部 */}
        <button
          onClick={() => setFilterOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-[10px] hover:bg-[#111] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={10} className={selectedFirms.size > 0 ? 'text-[#f5a623]' : 'text-[#555]'} />
            <span className={selectedFirms.size > 0 ? 'text-[#f5a623] font-bold' : 'text-[#666]'}>
              {selectedFirms.size > 0
                ? `已筛选 ${selectedFirms.size} 家机构 · ${filtered.length} 条记录`
                : `按机构筛选 · 共 ${firmStats.length} 家 · ${data.data.length} 条记录`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedFirms.size > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); selectAll(); }}
                className="flex items-center gap-1 text-[#555] hover:text-[#f5a623] transition-colors"
              >
                <X size={9} />
                <span>清空</span>
              </button>
            )}
            {filterOpen ? <ChevronUp size={10} className="text-[#555]" /> : <ChevronDown size={10} className="text-[#555]" />}
          </div>
        </button>

        {/* 机构列表（展开时显示） */}
        {filterOpen && (
          <div className="border-t border-[#1a1a1a] p-2.5">
            {/* 全选 / 清空操作行 */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-[#444]">共 {firmStats.length} 家机构</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFirms(new Set(firmStats.map(f => f.firm)))}
                  className="text-[9px] text-[#555] hover:text-[#f5a623] transition-colors"
                >
                  全选
                </button>
                <span className="text-[#333]">|</span>
                <button
                  onClick={selectAll}
                  className="text-[9px] text-[#555] hover:text-[#f5a623] transition-colors"
                >
                  清空
                </button>
              </div>
            </div>
            {/* Checkbox 列表 */}
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {firmStats.map(({ firm, count }) => {
                const isChecked = selectedFirms.size === 0 ? false : selectedFirms.has(firm);
                const isAllMode = selectedFirms.size === 0;
                return (
                  <label
                    key={firm}
                    className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer hover:bg-[#111] transition-colors group"
                  >
                    {/* 自定义 Checkbox */}
                    <div
                      onClick={() => toggleFirm(firm)}
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                        isAllMode
                          ? 'border-[#333] bg-[#0a0a0a]'
                          : isChecked
                          ? 'border-[#f5a623] bg-[#f5a623]'
                          : 'border-[#333] bg-[#0a0a0a] group-hover:border-[#555]'
                      }`}
                    >
                      {isChecked && !isAllMode && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    {/* 机构名称 + 频次 */}
                    <div
                      className="flex items-center justify-between flex-1 min-w-0"
                      onClick={() => toggleFirm(firm)}
                    >
                      <span className={`text-[10px] truncate ${
                        isAllMode ? 'text-[#666]' : isChecked ? 'text-[#eee] font-bold' : 'text-[#555]'
                      }`}>
                        {firm}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className={`text-[9px] ${
                          isAllMode ? 'text-[#444]' : isChecked ? 'text-[#f5a623]' : 'text-[#333]'
                        }`}>
                          {count}条
                        </span>
                        {/* 仅看此机构按鈕 */}
                        <button
                          onClick={(e) => { e.stopPropagation(); selectOnly(firm); }}
                          className="text-[8px] text-[#333] hover:text-[#f5a623] transition-colors opacity-0 group-hover:opacity-100"
                          title="仅看此机构"
                        >
                          仅
                        </button>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-2 text-[9px] text-[#2a2a2a]">勾选多家可同时显示 · 悬浮显示“仅”可单独查看</div>
          </div>
        )}
      </div>

      {/* 时间轴列表 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 gap-2">
          <Filter size={20} className="text-[#333]" />
          <p className="text-[#555] text-xs">所选机构无评级记录</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {filtered.map((item, idx) => {
            const cfg = CHG_CONFIG[item.chg] ?? CHG_CONFIG.reiterate;
            const ratingColor = RATING_COLOR[item.rating] || '#aaa';
            const isLast = idx === filtered.length - 1;
            return (
              <div key={item.id} className="relative flex gap-3 group">
                {/* 时间轴线 */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full border-2 mt-1 shrink-0 transition-all group-hover:scale-125"
                    style={{ borderColor: cfg.dotColor, background: '#0a0a0a' }}
                  />
                  {!isLast && <div className="w-px flex-1 bg-[#1a1a1a] mt-0.5 mb-0.5 min-h-[20px]" />}
                </div>
                {/* 内容卡片 */}
                <div className={`flex-1 pb-2 rounded px-2 py-1.5 transition-colors group-hover:bg-[#0f0f0f]`}>
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ color: cfg.color, background: `${cfg.color}18` }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs font-bold" style={{ color: ratingColor }}>
                        {item.rating}
                      </span>
                      {item.prevRating && item.prevRating !== item.rating && (
                        <span className="text-[#444] text-[9px]">← {item.prevRating}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      {item.target && (
                        <span className="text-[#aaa]">
                          目标 <span className="text-[#eee] font-bold">${item.target}</span>
                          {item.prevTarget && (
                            <span className={item.target > item.prevTarget ? 'text-green-400' : 'text-red-400'}>
                              {' '}({item.target > item.prevTarget ? '+' : ''}
                              {((item.target - item.prevTarget) / item.prevTarget * 100).toFixed(0)}%)
                            </span>
                          )}
                        </span>
                      )}
                      {item.upside != null && (
                        <span className={item.upside >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {item.upside >= 0
                            ? <TrendingUp size={9} className="inline" />
                            : <TrendingDown size={9} className="inline" />}
                          {' '}{Math.abs(item.upside).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-[#555]">
                    <span className="text-[#888] font-medium">{item.firm}</span>
                    <span className="text-[#333]">·</span>
                    <span>{item.analyst}</span>
                    <span className="text-[#333]">·</span>
                    <span>{item.date}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalystRatingChart({ ticker, currentPrice }: Props) {
  const [subView, setSubView] = useState<SubView>('distribution');

  const SUB_TABS: { id: SubView; label: string; icon: React.ReactNode }[] = [
    { id: 'distribution', label: '月度分布',   icon: <BarChart2 size={10} /> },
    { id: 'target',       label: '目标价走势', icon: <Target size={10} /> },
    { id: 'changes',      label: '变动时间轴', icon: <Clock size={10} /> },
  ];

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <span className="text-[#f5a623] font-bold text-xs">{ticker}</span>
          <span className="text-[#555] text-[10px]">分析师评级趋势</span>
        </div>
        {/* Sub-view Tabs */}
        <div className="flex gap-0.5">
          {SUB_TABS.map(t => (
            <button key={t.id} onClick={() => setSubView(t.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-all ${
                subView === t.id
                  ? 'bg-[#f5a623] text-black'
                  : 'text-[#555] hover:text-[#f5a623] hover:bg-[#111]'
              }`}>
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {subView === 'distribution' && <DistributionView ticker={ticker} />}
        {subView === 'target' && <TargetView ticker={ticker} currentPrice={currentPrice} />}
        {subView === 'changes' && (
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <ChangesView ticker={ticker} />
          </div>
        )}
      </div>
    </div>
  );
}

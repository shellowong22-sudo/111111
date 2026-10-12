import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, BarChart, Bar
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart2, Clock, AlertTriangle } from 'lucide-react';

export type SignalType = 'buy' | 'sell' | 'arbitrage' | 'warning' | 'neutral';

export interface SignalHistoryConfig {
  /** 信号名称，如 "OAS 均值回归做多" */
  signalName: string;
  /** 信号类型 */
  signalType: SignalType;
  /** 当前信号值，如 "OAS: 92bps" */
  currentValue: string;
  /** 触发逻辑说明 */
  triggerLogic: string;
  /** 所属功能模块，如 "SecInfo - 证券与功能说明" */
  module: string;
  /** 自定义历史数据（可选，不传则自动生成） */
  customData?: Array<{ date: string; returnPct: number; signal: boolean }>;
}

/** 根据信号类型生成模拟历史收益率数据（近 90 天） */
function generateHistoryData(config: SignalHistoryConfig) {
  if (config.customData) return config.customData.map(d => ({ ...d, cumReturn: 0, benchmark: 0 }));

  const days = 90;
  const data: Array<{ date: string; returnPct: number; cumReturn: number; signal: boolean; benchmark: number }> = [];
  let cumReturn = 0;
  let cumBench = 0;

  // 根据信号类型设置基础参数
  const params: Record<SignalType, { mu: number; sigma: number; winRate: number }> = {
    buy:       { mu: 0.08,  sigma: 0.6,  winRate: 0.65 },
    sell:      { mu: 0.06,  sigma: 0.55, winRate: 0.60 },
    arbitrage: { mu: 0.04,  sigma: 0.3,  winRate: 0.72 },
    warning:   { mu: -0.02, sigma: 0.8,  winRate: 0.45 },
    neutral:   { mu: 0.02,  sigma: 0.35, winRate: 0.52 },
  };
  const p = params[config.signalType];

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;

    // 模拟每日收益（正态分布）
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const dailyReturn = p.mu + p.sigma * z;

    // 基准（10Y国债）
    const benchReturn = 0.01 + 0.4 * (Math.random() - 0.5);

    cumReturn += dailyReturn;
    cumBench += benchReturn;

    // 信号触发日（每隔 7-14 天触发一次）
    const signal = i % Math.floor(7 + Math.random() * 7) === 0;

    data.push({
      date: label,
      returnPct: +dailyReturn.toFixed(3),
      cumReturn: +cumReturn.toFixed(2),
      signal,
      benchmark: +cumBench.toFixed(2),
    });
  }
  return data;
}

/** 计算统计指标 */
function calcStats(data: ReturnType<typeof generateHistoryData>) {
  const returns = data.map(d => d.returnPct);
  const positive = returns.filter(r => r > 0).length;
  const winRate = ((positive / returns.length) * 100).toFixed(1);
  const avgReturn = (returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(3);
  const maxDrawdown = (() => {
    let peak = -Infinity, maxDD = 0, cum = 0;
    for (const d of data) {
      cum += d.returnPct;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD.toFixed(2);
  })();
  const sharpe = ((+avgReturn / (Math.sqrt(returns.reduce((a, b) => a + (b - +avgReturn) ** 2, 0) / returns.length) || 1)) * Math.sqrt(252)).toFixed(2);
  const totalReturn = data[data.length - 1]?.cumReturn ?? 0;
  const benchTotal = data[data.length - 1]?.benchmark ?? 0;
  const alpha = (totalReturn - benchTotal).toFixed(2);
  return { winRate, avgReturn, maxDrawdown, sharpe, totalReturn: totalReturn.toFixed(2), alpha };
}

const SIGNAL_COLOR: Record<SignalType, string> = {
  buy:       '#22c55e',
  sell:      '#ef4444',
  arbitrage: '#f59e0b',
  warning:   '#f97316',
  neutral:   '#eab308',
};

const SIGNAL_LABEL: Record<SignalType, string> = {
  buy:       '做多',
  sell:      '做空',
  arbitrage: '套利',
  warning:   '预警',
  neutral:   '中性',
};

interface Props {
  config: SignalHistoryConfig;
  open: boolean;
  onClose: () => void;
}

export function SignalHistoryDialog({ config, open, onClose }: Props) {
  const [tab, setTab] = useState('cumulative');
  const data = useMemo(() => generateHistoryData(config), [config.signalName]);
  const stats = useMemo(() => calcStats(data), [data]);
  const color = SIGNAL_COLOR[config.signalType];
  const label = SIGNAL_LABEL[config.signalType];

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label: lbl }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-background border border-border rounded-md p-2 text-xs shadow-lg">
        <div className="font-semibold text-foreground mb-1">{lbl}</div>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2">
            <span style={{ color: p.color }}>●</span>
            <span className="text-muted-foreground">{p.name}:</span>
            <span style={{ color: p.color }} className="font-mono font-semibold">
              {p.value > 0 ? '+' : ''}{p.value}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BarChart2 className="w-4 h-4" style={{ color }} />
            <span>历史表现分析</span>
            <Badge style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }} variant="outline" className="text-xs">
              {label}信号
            </Badge>
            <span className="text-muted-foreground font-normal">— {config.signalName}</span>
          </DialogTitle>
        </DialogHeader>

        {/* 信号说明 */}
        <div className="bg-muted/20 border border-border rounded-md p-2 text-xs text-muted-foreground mb-2">
          <span className="font-semibold text-foreground">触发逻辑：</span>{config.triggerLogic}
          <span className="ml-3 text-muted-foreground/70">当前值：</span>
          <span className="font-mono font-semibold" style={{ color }}>{config.currentValue}</span>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-6 gap-2 mb-2">
          {[
            { label: '胜率', value: `${stats.winRate}%`, icon: <TrendingUp className="w-3 h-3" />, good: +stats.winRate > 55 },
            { label: '日均收益', value: `${+stats.avgReturn > 0 ? '+' : ''}${stats.avgReturn}%`, icon: <TrendingUp className="w-3 h-3" />, good: +stats.avgReturn > 0 },
            { label: '最大回撤', value: `-${stats.maxDrawdown}%`, icon: <TrendingDown className="w-3 h-3" />, good: +stats.maxDrawdown < 3 },
            { label: 'Sharpe', value: stats.sharpe, icon: <BarChart2 className="w-3 h-3" />, good: +stats.sharpe > 1 },
            { label: '90天收益', value: `${+stats.totalReturn > 0 ? '+' : ''}${stats.totalReturn}%`, icon: <TrendingUp className="w-3 h-3" />, good: +stats.totalReturn > 0 },
            { label: 'Alpha', value: `${+stats.alpha > 0 ? '+' : ''}${stats.alpha}%`, icon: <AlertTriangle className="w-3 h-3" />, good: +stats.alpha > 0 },
          ].map(s => (
            <div key={s.label} className="bg-muted/20 border border-border rounded p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: s.good ? '#22c55e' : '#ef4444' }}>
                {s.icon}
                <span className="text-xs font-mono font-bold">{s.value}</span>
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 图表 Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-7 text-xs mb-2">
            <TabsTrigger value="cumulative" className="text-xs px-3 h-6">累计收益</TabsTrigger>
            <TabsTrigger value="daily" className="text-xs px-3 h-6">每日收益</TabsTrigger>
            <TabsTrigger value="distribution" className="text-xs px-3 h-6">收益分布</TabsTrigger>
          </TabsList>

          {/* 累计收益折线图 */}
          <TabsContent value="cumulative" className="mt-0">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="sigGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6b7280" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6b7280" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} interval={14} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" strokeOpacity={0.6} />
                  <Area type="monotone" dataKey="cumReturn" stroke={color} strokeWidth={2} fill="url(#sigGrad)" name="信号收益" dot={false} />
                  <Area type="monotone" dataKey="benchmark" stroke="#6b7280" strokeWidth={1.5} fill="url(#benchGrad)" name="基准(10Y)" dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground justify-center">
              <span className="flex items-center gap-1"><span style={{ color }} className="text-base">—</span> 信号累计收益</span>
              <span className="flex items-center gap-1"><span className="text-gray-500 text-base">- -</span> 基准(10Y国债)</span>
            </div>
          </TabsContent>

          {/* 每日收益柱状图 */}
          <TabsContent value="daily" className="mt-0">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.slice(-30)} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#6b7280" />
                  <Bar
                    dataKey="returnPct"
                    name="日收益"
                    fill={color}
                    opacity={0.8}
                    radius={[2, 2, 0, 0]}
                    // 正负颜色区分
                    label={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-1">近 30 日每日收益率（绿色=正收益，红色=负收益）</div>
          </TabsContent>

          {/* 收益分布直方图 */}
          <TabsContent value="distribution" className="mt-0">
            <div className="h-52">
              {(() => {
                // 构建分布数据
                const returns = data.map(d => d.returnPct);
                const min = Math.min(...returns), max = Math.max(...returns);
                const bins = 12;
                const step = (max - min) / bins;
                const distData = Array.from({ length: bins }, (_, i) => {
                  const lo = min + i * step, hi = lo + step;
                  return {
                    range: `${lo.toFixed(1)}~${hi.toFixed(1)}`,
                    count: returns.filter(r => r >= lo && r < hi).length,
                    positive: lo >= 0,
                  };
                });
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.4} />
                      <XAxis dataKey="range" tick={{ fontSize: 8, fill: '#9ca3af' }} interval={1} angle={-30} textAnchor="end" height={30} />
                      <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                      <RechartsTooltip
                        formatter={(v: any) => [`${v} 天`, '频次']}
                        contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                      />
                      <Bar dataKey="count" name="频次" radius={[2, 2, 0, 0]}>
                        {distData.map((entry, index) => (
                          <rect key={index} fill={entry.positive ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
            <div className="text-xs text-muted-foreground text-center mt-1">收益率频率分布（绿=正收益区间，红=负收益区间）</div>
          </TabsContent>
        </Tabs>

        {/* 投资建议摘要 */}
        <div className="mt-2 p-2 rounded-md border text-xs" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
          <div className="font-semibold mb-1" style={{ color }}>
            {config.signalType === 'buy' && '📈 做多建议'}
            {config.signalType === 'sell' && '📉 做空建议'}
            {config.signalType === 'arbitrage' && '⚡ 套利建议'}
            {config.signalType === 'warning' && '⚠️ 风险预警'}
          </div>
          <div className="text-muted-foreground leading-relaxed">
            {+stats.winRate > 60
              ? `历史胜率 ${stats.winRate}%，信号质量较高。`
              : `历史胜率 ${stats.winRate}%，需结合其他指标综合判断。`}
            {' '}90天累计Alpha {stats.alpha}%（相对10Y国债基准），
            最大回撤 {stats.maxDrawdown}%，Sharpe比率 {stats.sharpe}。
            {+stats.sharpe > 1.5
              ? ' 风险调整后收益优秀，可适当加大仓位。'
              : +stats.sharpe > 0.8
              ? ' 风险调整后收益合理，建议标准仓位。'
              : ' 风险调整后收益偏低，建议小仓位试探或等待更强信号。'}
          </div>
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>数据周期：近 90 个交易日 | 模块：{config.module}</span>
          </div>
          <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-xs">关闭</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 便捷触发按钮组件 */
interface TriggerProps {
  config: SignalHistoryConfig;
  className?: string;
}

export function SignalHistoryButton({ config, className }: TriggerProps) {
  const [open, setOpen] = useState(false);
  const color = SIGNAL_COLOR[config.signalType];
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border transition-colors hover:opacity-80 ${className ?? ''}`}
        style={{ borderColor: `${color}40`, backgroundColor: `${color}10`, color }}
        title={`查看"${config.signalName}"历史表现`}
      >
        <BarChart2 className="w-3 h-3" />
        历史
      </button>
      <SignalHistoryDialog config={config} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

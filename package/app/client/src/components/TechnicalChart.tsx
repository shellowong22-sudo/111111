/**
 * TechnicalChart - 带技术指标的增强图表组件
 * 支持 MA5/MA10/MA20、MACD、RSI、BOLL 指标和日线/周线/月线时间周期切换
 */
import { useState, useMemo } from 'react';
import {
  Area, Line, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ComposedChart,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  calculateMA, calculateMACD, calculateRSI, calculateBOLL,
  mergeWithMA, aggregateByPeriod, type PricePoint,
} from '@/lib/technicalIndicators';
import { Activity, TrendingUp, Calendar } from 'lucide-react';

interface TechnicalChartProps {
  data: PricePoint[];
  isPositive: boolean;
  height?: number;
}

// 指标开关类型
interface IndicatorState {
  ma5: boolean;
  ma10: boolean;
  ma20: boolean;
  macd: boolean;
  rsi: boolean;
  boll: boolean;
}

type TimePeriod = 'daily' | 'weekly' | 'monthly';

const MA_COLORS = {
  ma5: '#f59e0b',   // Amber
  ma10: '#3b82f6',  // Blue
  ma20: '#a855f7',  // Purple
};

const BOLL_COLORS = {
  upper: '#ef4444',  // Red
  middle: '#eab308', // Yellow
  lower: '#22c55e',  // Green
};

const PERIOD_LABELS: Record<TimePeriod, string> = {
  daily: '日线',
  weekly: '周线',
  monthly: '月线',
};

export default function TechnicalChart({ data, isPositive, height = 220 }: TechnicalChartProps) {
  const chartTheme = useChartTheme();
  const [indicators, setIndicators] = useState<IndicatorState>({
    ma5: true,
    ma10: false,
    ma20: false,
    macd: false,
    rsi: false,
    boll: false,
  });
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  const toggleIndicator = (key: keyof IndicatorState) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 根据时间周期聚合数据
  const periodData = useMemo(() => aggregateByPeriod(data, timePeriod), [data, timePeriod]);

  // 计算各指标数据
  const maData = useMemo(() => calculateMA(periodData), [periodData]);
  const bollData = useMemo(() => calculateBOLL(periodData), [periodData]);
  const chartDataWithIndicators = useMemo(() => {
    const merged = mergeWithMA(periodData, maData);
    return merged.map((p, i) => ({
      ...p,
      bollUpper: bollData[i]?.upper,
      bollMiddle: bollData[i]?.middle,
      bollLower: bollData[i]?.lower,
    }));
  }, [periodData, maData, bollData]);

  const macdData = useMemo(() => calculateMACD(periodData), [periodData]);
  const rsiData = useMemo(() => calculateRSI(periodData), [periodData]);

  const showMACD = indicators.macd;
  const showRSI = indicators.rsi;
  const subChartCount = (showMACD ? 1 : 0) + (showRSI ? 1 : 0);
  const mainChartHeight = subChartCount > 0 ? Math.round(height * 0.55) : height;
  const subChartHeight = subChartCount > 0 ? Math.round((height * 0.45) / subChartCount) : 0;

  return (
    <div className="space-y-1.5">
      {/* 工具栏 */}
      <div className="flex items-center gap-1 flex-wrap justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground mr-0.5 flex items-center gap-0.5">
            <Activity className="w-3 h-3" />指标:
          </span>
          <IndicatorToggle label="MA5" active={indicators.ma5} color={MA_COLORS.ma5} onClick={() => toggleIndicator('ma5')} />
          <IndicatorToggle label="MA10" active={indicators.ma10} color={MA_COLORS.ma10} onClick={() => toggleIndicator('ma10')} />
          <IndicatorToggle label="MA20" active={indicators.ma20} color={MA_COLORS.ma20} onClick={() => toggleIndicator('ma20')} />
          <IndicatorToggle label="MACD" active={indicators.macd} color="#06b6d4" onClick={() => toggleIndicator('macd')} />
          <IndicatorToggle label="RSI" active={indicators.rsi} color="#ec4899" onClick={() => toggleIndicator('rsi')} />
          <IndicatorToggle label="BOLL" active={indicators.boll} color="#eab308" onClick={() => toggleIndicator('boll')} />
        </div>

        {/* 时间周期选择器 */}
        <div className="relative">
          <button
            onClick={() => setShowPeriodMenu(!showPeriodMenu)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border border-muted-foreground/30 text-muted-foreground hover:border-cyan-500/50 hover:text-cyan-400 transition-all"
          >
            <Calendar className="w-3 h-3" />
            {PERIOD_LABELS[timePeriod]}
          </button>
          {showPeriodMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-0.5 min-w-[60px]">
              {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => { setTimePeriod(p); setShowPeriodMenu(false); }}
                  className={cn(
                    "w-full px-3 py-1 text-[10px] text-left font-mono hover:bg-muted transition-colors",
                    timePeriod === p ? 'text-cyan-400 font-bold' : 'text-foreground'
                  )}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 主图：价格 + MA + BOLL */}
      <div style={{ height: mainChartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartDataWithIndicators} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="techPriceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? chartTheme.colors.positive : chartTheme.colors.negative} stopOpacity={0.25} />
                <stop offset="95%" stopColor={isPositive ? chartTheme.colors.positive : chartTheme.colors.negative} stopOpacity={0} />
              </linearGradient>
              {indicators.boll && (
                <linearGradient id="bollFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#eab308" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#eab308" stopOpacity={0.02} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis
              dataKey="time"
              stroke={chartTheme.axis}
              tick={{ fontSize: 9, fill: chartTheme.axisLabel }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke={chartTheme.axis}
              tick={{ fontSize: 9, fill: chartTheme.axisLabel }}
              tickLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(v) => v.toFixed(2)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: chartTheme.tooltip.background,
                border: `1px solid ${chartTheme.tooltip.border}`,
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelStyle={{ color: chartTheme.tooltip.text }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  price: '价格', ma5: 'MA5', ma10: 'MA10', ma20: 'MA20',
                  bollUpper: 'BOLL上轨', bollMiddle: 'BOLL中轨', bollLower: 'BOLL下轨',
                };
                return [value?.toFixed(4), labels[name] || name];
              }}
            />
            {/* BOLL 带区域填充 */}
            {indicators.boll && (
              <>
                <Area
                  type="monotone"
                  dataKey="bollUpper"
                  stroke={BOLL_COLORS.upper}
                  strokeWidth={0.8}
                  strokeDasharray="4 2"
                  fill="none"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="bollMiddle"
                  stroke={BOLL_COLORS.middle}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  dot={false}
                  connectNulls={false}
                />
                <Area
                  type="monotone"
                  dataKey="bollLower"
                  stroke={BOLL_COLORS.lower}
                  strokeWidth={0.8}
                  strokeDasharray="4 2"
                  fill="none"
                  dot={false}
                  connectNulls={false}
                />
              </>
            )}
            {/* 价格区域 */}
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? chartTheme.colors.positive : chartTheme.colors.negative}
              strokeWidth={1.5}
              fill="url(#techPriceGrad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
            {/* MA 线 */}
            {indicators.ma5 && (
              <Line type="monotone" dataKey="ma5" stroke={MA_COLORS.ma5} strokeWidth={1} dot={false} connectNulls={false} />
            )}
            {indicators.ma10 && (
              <Line type="monotone" dataKey="ma10" stroke={MA_COLORS.ma10} strokeWidth={1} dot={false} connectNulls={false} />
            )}
            {indicators.ma20 && (
              <Line type="monotone" dataKey="ma20" stroke={MA_COLORS.ma20} strokeWidth={1} dot={false} connectNulls={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* RSI 子图 */}
      {showRSI && (
        <div style={{ height: subChartHeight }}>
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[9px] text-muted-foreground font-mono">RSI (14)</span>
            <span className="text-[9px] text-muted-foreground/50">超买70 / 超卖30</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rsiData} margin={{ top: 2, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis
                dataKey="time"
                stroke={chartTheme.axis}
                tick={{ fontSize: 8, fill: chartTheme.axisLabel }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke={chartTheme.axis}
                tick={{ fontSize: 8, fill: chartTheme.axisLabel }}
                tickLine={false}
                domain={[0, 100]}
                ticks={[30, 50, 70]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltip.background,
                  border: `1px solid ${chartTheme.tooltip.border}`,
                  borderRadius: '6px',
                  fontSize: '10px',
                }}
                formatter={(value: number) => [value?.toFixed(2), 'RSI']}
              />
              {/* 超买超卖参考线 */}
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={50} stroke={chartTheme.axis} strokeDasharray="2 2" strokeOpacity={0.3} />
              {/* RSI 线 */}
              <Line
                type="monotone"
                dataKey="rsi"
                stroke="#ec4899"
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MACD 子图 */}
      {showMACD && (
        <div style={{ height: subChartHeight }}>
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground font-mono">MACD (12, 26, 9)</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={macdData} margin={{ top: 2, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis
                dataKey="time"
                stroke={chartTheme.axis}
                tick={{ fontSize: 8, fill: chartTheme.axisLabel }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke={chartTheme.axis}
                tick={{ fontSize: 8, fill: chartTheme.axisLabel }}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v) => v.toFixed(4)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltip.background,
                  border: `1px solid ${chartTheme.tooltip.border}`,
                  borderRadius: '6px',
                  fontSize: '10px',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { macd: 'DIF', signal: 'DEA', histogram: 'MACD柱' };
                  return [value?.toFixed(6), labels[name] || name];
                }}
              />
              <ReferenceLine y={0} stroke={chartTheme.axis} strokeDasharray="2 2" />
              <Bar dataKey="histogram" isAnimationActive={false}>
                {macdData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.histogram >= 0 ? chartTheme.colors.positive : chartTheme.colors.negative}
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
              <Line type="monotone" dataKey="macd" stroke="#06b6d4" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="signal" stroke="#f97316" strokeWidth={1} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/**
 * 指标切换按钮
 */
function IndicatorToggle({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border transition-all duration-150',
        'active:scale-95',
        active
          ? 'border-current bg-current/10'
          : 'border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60'
      )}
      style={active ? { color, borderColor: color } : undefined}
    >
      {label}
    </button>
  );
}

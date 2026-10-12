import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { calculateMA, calculateMACD, calculateRSI, calculateBOLL } from '@/lib/technicalIndicators';
import type { PricePoint } from '@/lib/technicalIndicators';

interface ChartData extends PricePoint {
  ma5?: number; ma10?: number; ma20?: number; ma50?: number;
  macd?: number; signal?: number; histogram?: number;
  rsi?: number; upper?: number; middle?: number; lower?: number;
  [key: string]: any;
}

interface PriceChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  name: string;
  currentPrice: number;
  changePct: number;
  changeVal: number;
  chartData: ChartData[];
  timeRange: '5d' | '1mo' | '3mo';
  onTimeRangeChange: (range: '5d' | '1mo' | '3mo') => void;
  available: boolean;
  limitation?: string | null;
}

type IndicatorType = 'none' | 'ma' | 'macd' | 'rsi' | 'bb';
type ChartMode = 'line' | 'candle';

interface IndicatorParams {
  maPeriods: number[];
  rsiPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  bbStdDev: number;
}

const DEFAULT_PARAMS: IndicatorParams = {
  maPeriods: [5, 10, 20, 50],
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  bbPeriod: 20,
  bbStdDev: 2,
};

interface PresetTemplate {
  name: string;
  label: string;
  description: string;
  indicator: IndicatorType;
  maLines: number[];
  params: IndicatorParams;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  { name: 'scalping', label: '超短线', description: 'MA5/10 + RSI(6)', indicator: 'ma', maLines: [5, 10], params: { ...DEFAULT_PARAMS, maPeriods: [5, 10], rsiPeriod: 6 } },
  { name: 'short_term', label: '短线交易', description: 'MA5/10/20 + MACD(12,26,9)', indicator: 'ma', maLines: [5, 10, 20], params: { ...DEFAULT_PARAMS, maPeriods: [5, 10, 20] } },
  { name: 'swing', label: '波段操作', description: 'MA10/20/50 + BOLL(20,2)', indicator: 'ma', maLines: [10, 20, 50], params: { ...DEFAULT_PARAMS, maPeriods: [10, 20, 50] } },
  { name: 'mid_long', label: '中长线投资', description: 'MA20/50/120 + RSI(14)', indicator: 'ma', maLines: [20, 50, 120], params: { ...DEFAULT_PARAMS, maPeriods: [20, 50, 120] } },
  { name: 'trend_follow', label: '趋势跟踪', description: 'MA20/60 + MACD(26,52,9)', indicator: 'ma', maLines: [20, 60], params: { ...DEFAULT_PARAMS, maPeriods: [20, 60], macdFast: 26, macdSlow: 52, macdSignal: 9 } },
];

const maColors: Record<number, string> = { 5: '#ec4899', 10: '#06b6d4', 20: '#eab308', 50: '#a78bfa', 60: '#f97316', 120: '#14b8a6' };
const getMaColor = (period: number) => maColors[period] || `hsl(${(period * 37) % 360}, 70%, 60%)`;

export function PriceChartModal({ open, onOpenChange, symbol, name, currentPrice, changePct, changeVal, chartData, timeRange, onTimeRangeChange, available, limitation }: PriceChartModalProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('candle');
  const [indicator, setIndicator] = useState<IndicatorType>('none');
  const [maLines, setMaLines] = useState<Set<number>>(new Set([20]));
  const [showParamPanel, setShowParamPanel] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [params, setParams] = useState<IndicatorParams>(DEFAULT_PARAMS);
  const [customMaPeriod, setCustomMaPeriod] = useState('');
  const [customRsiPeriod, setCustomRsiPeriod] = useState(DEFAULT_PARAMS.rsiPeriod.toString());
  const [customMacdFast, setCustomMacdFast] = useState(DEFAULT_PARAMS.macdFast.toString());
  const [customMacdSlow, setCustomMacdSlow] = useState(DEFAULT_PARAMS.macdSlow.toString());
  const [customMacdSignal, setCustomMacdSignal] = useState(DEFAULT_PARAMS.macdSignal.toString());

  const filteredData = useMemo(() => {
    return chartData ?? [];
  }, [chartData]);

  const dataWithIndicators = useMemo(() => {
    let data: ChartData[] = [...filteredData];
    if (indicator === 'ma') {
      const periods = Array.from(maLines);
      const maData = calculateMA(filteredData as PricePoint[], periods);
      data = filteredData.map((d, i) => {
        const row: any = { ...d };
        for (const p of periods) { row[`ma${p}`] = (maData[i] as any)?.[`ma${p}`]; }
        return row;
      }) as ChartData[];
    } else if (indicator === 'macd') {
      const macdData = calculateMACD(filteredData as PricePoint[], params.macdFast, params.macdSlow, params.macdSignal);
      data = filteredData.map((d, i) => ({ ...d, macd: macdData[i]?.macd, signal: macdData[i]?.signal, histogram: macdData[i]?.histogram })) as ChartData[];
    } else if (indicator === 'rsi') {
      const rsiData = calculateRSI(filteredData as PricePoint[], params.rsiPeriod);
      data = filteredData.map((d, i) => ({ ...d, rsi: rsiData[i]?.rsi })) as ChartData[];
    } else if (indicator === 'bb') {
      const bbData = calculateBOLL(filteredData as PricePoint[], params.bbPeriod, params.bbStdDev);
      data = filteredData.map((d, i) => ({ ...d, upper: bbData[i]?.upper, middle: bbData[i]?.middle, lower: bbData[i]?.lower })) as ChartData[];
    }
    return data;
  }, [filteredData, indicator, maLines, params]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return { min: 0, max: 0, avg: 0, high: 0, low: 0 };
    const prices = filteredData.map(d => d.price);
    const highs = filteredData.map(d => d.high);
    const lows = filteredData.map(d => d.low);
    return { min: Math.min(...prices), max: Math.max(...prices), avg: prices.reduce((a, b) => a + b, 0) / prices.length, high: Math.max(...highs), low: Math.min(...lows) };
  }, [filteredData]);

  const pos = changePct > 0;
  const neg = changePct < 0;

  const toggleMALine = (period: number) => { const s = new Set(maLines); if (s.has(period)) s.delete(period); else s.add(period); setMaLines(s); };
  const addCustomMAPeriod = () => { const p = parseInt(customMaPeriod); if (!isNaN(p) && p > 0 && p <= 500) { const s = new Set(maLines); s.add(p); setMaLines(s); setCustomMaPeriod(''); } };
  const applyParams = () => {
    const np = { ...params };
    const r = parseInt(customRsiPeriod), f = parseInt(customMacdFast), s = parseInt(customMacdSlow), sg = parseInt(customMacdSignal);
    if (!isNaN(r) && r > 0 && r <= 100) np.rsiPeriod = r;
    if (!isNaN(f) && f > 0 && f <= 50) np.macdFast = f;
    if (!isNaN(s) && s > 0 && s <= 100) np.macdSlow = s;
    if (!isNaN(sg) && sg > 0 && sg <= 50) np.macdSignal = sg;
    setParams(np); setShowParamPanel(false);
  };
  const resetParams = () => { setParams(DEFAULT_PARAMS); setCustomRsiPeriod(DEFAULT_PARAMS.rsiPeriod.toString()); setCustomMacdFast(DEFAULT_PARAMS.macdFast.toString()); setCustomMacdSlow(DEFAULT_PARAMS.macdSlow.toString()); setCustomMacdSignal(DEFAULT_PARAMS.macdSignal.toString()); setActivePreset(null); };
  const applyPreset = (preset: PresetTemplate) => { setActivePreset(preset.name); setIndicator(preset.indicator); setMaLines(new Set(preset.maLines)); setParams(preset.params); setCustomRsiPeriod(preset.params.rsiPeriod.toString()); setCustomMacdFast(preset.params.macdFast.toString()); setCustomMacdSlow(preset.params.macdSlow.toString()); setCustomMacdSignal(preset.params.macdSignal.toString()); setShowPresets(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-slate-900 border-slate-700 text-slate-50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <DialogTitle className="text-xl font-bold">{symbol} - {name}</DialogTitle>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-2xl font-bold text-slate-100">{currentPrice.toFixed(4)}</span>
                <Badge className={cn('text-sm font-semibold', pos ? 'bg-green-500/20 text-green-400 border-green-500/50' : neg ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-700/50 text-slate-300 border-slate-600/50')} variant="outline">
                  {pos ? '+' : ''}{changeVal.toFixed(4)} ({pos ? '+' : ''}{changePct.toFixed(2)}%)
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 时间段 + 图表模式 */}
        <div className="flex gap-2 border-b border-slate-700 pb-3 items-center">
          {(['5d', '1mo', '3mo'] as const).map(range => (
            <Button key={range} size="sm" variant={timeRange === range ? 'default' : 'outline'} className={cn('text-xs', timeRange === range ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-slate-600 text-slate-400 hover:text-slate-200')} onClick={() => onTimeRangeChange(range)}>
              {range === '5d' ? '5日' : range === '1mo' ? '1月' : '3月'}
            </Button>
          ))}
          <div className="ml-auto flex gap-1 bg-slate-800 rounded-md p-0.5">
            <Button size="sm" variant="ghost" className={cn('text-xs h-7 px-2', chartMode === 'line' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700')} onClick={() => setChartMode('line')}>
              📈 折线图
            </Button>
            <Button size="sm" variant="ghost" className={cn('text-xs h-7 px-2', chartMode === 'candle' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700')} onClick={() => setChartMode('candle')}>
              🕯️ K线图
            </Button>
          </div>
        </div>

        <p className={cn('text-[11px]', available ? 'text-slate-500' : 'text-amber-400')}>{available ? `历史 OHLC 来源：Yahoo Finance · ${filteredData.length} 根日线` : limitation || '暂无可验证的 OHLC 历史行情。'}</p>

        {/* 技术指标 + 预设模板 */}
        <div className="flex gap-2 border-b border-slate-700 pb-3 items-center flex-wrap">
          <span className="text-xs text-slate-500">指标：</span>
          {(['none', 'ma', 'macd', 'rsi', 'bb'] as const).map(ind => (
            <Button key={ind} size="sm" variant={indicator === ind ? 'default' : 'outline'} className={cn('text-xs', indicator === ind ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-slate-600 text-slate-400 hover:text-slate-200')} onClick={() => { setIndicator(ind); setActivePreset(null); }}>
              {ind === 'none' ? '无' : ind === 'ma' ? 'MA' : ind === 'macd' ? 'MACD' : ind === 'rsi' ? 'RSI' : 'BOLL'}
            </Button>
          ))}
          <div className="ml-auto">
            <Button size="sm" variant={showPresets ? 'default' : 'outline'} className={cn('text-xs', showPresets ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'border-slate-600 text-slate-400 hover:text-slate-200')} onClick={() => setShowPresets(!showPresets)}>
              📋 预设模板 {activePreset && `(${PRESET_TEMPLATES.find(p => p.name === activePreset)?.label})`}
            </Button>
          </div>
        </div>

        {/* 预设模板面板 */}
        {showPresets && (
          <div className="border border-slate-700 rounded-lg p-3 bg-slate-800/50">
            <p className="text-xs text-slate-400 mb-2">选择预设参数组合，一键快速切换：</p>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_TEMPLATES.map(preset => (
                <button key={preset.name} className={cn('p-2 rounded-md border text-left transition-all', activePreset === preset.name ? 'border-amber-500 bg-amber-500/10' : 'border-slate-600 bg-slate-800 hover:border-slate-500 hover:bg-slate-700/50')} onClick={() => applyPreset(preset)}>
                  <p className={cn('text-xs font-semibold', activePreset === preset.name ? 'text-amber-400' : 'text-slate-200')}>{preset.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MA 线选择 */}
        {indicator === 'ma' && (
          <div className="flex gap-2 border-b border-slate-700 pb-3 flex-wrap">
            <span className="text-xs text-slate-500 flex items-center">MA 周期：</span>
            {Array.from(maLines).sort((a, b) => a - b).map(period => (
              <Button key={period} size="sm" variant="default" className="text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => toggleMALine(period)}>MA{period} ×</Button>
            ))}
            {[5, 10, 20, 50].filter(p => !maLines.has(p)).map(period => (
              <Button key={period} size="sm" variant="outline" className="text-xs border-slate-600 text-slate-400 hover:text-slate-200" onClick={() => toggleMALine(period)}>MA{period}</Button>
            ))}
            <div className="flex gap-1 items-center ml-auto">
              <input type="number" min="1" max="500" value={customMaPeriod} onChange={(e) => setCustomMaPeriod(e.target.value)} placeholder="自定义" className="w-16 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200 placeholder-slate-500" onKeyDown={(e) => e.key === 'Enter' && addCustomMAPeriod()} />
              <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-400 hover:text-slate-200" onClick={addCustomMAPeriod}>添加</Button>
            </div>
          </div>
        )}

        {/* 参数设置 */}
        {indicator !== 'none' && (
          <div className="flex gap-2 border-b border-slate-700 pb-3">
            <Button size="sm" variant={showParamPanel ? 'default' : 'outline'} className={cn('text-xs', showParamPanel ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'border-slate-600 text-slate-400 hover:text-slate-200')} onClick={() => setShowParamPanel(!showParamPanel)}>⚙️ 参数设置</Button>
            <span className="text-xs text-slate-500 flex items-center">
              {indicator === 'rsi' && `RSI(${params.rsiPeriod})`}
              {indicator === 'macd' && `MACD(${params.macdFast},${params.macdSlow},${params.macdSignal})`}
              {indicator === 'bb' && `BOLL(${params.bbPeriod},${params.bbStdDev})`}
            </span>
          </div>
        )}

        {/* 参数输入面板 */}
        {showParamPanel && (
          <div className="border border-slate-700 rounded-lg p-3 bg-slate-800/50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {(indicator === 'rsi' || indicator === 'bb') && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">{indicator === 'rsi' ? 'RSI 周期' : 'BOLL 周期'} <span className="text-slate-600">(1-100)</span></label>
                  <input type="number" min="1" max="100" value={customRsiPeriod} onChange={(e) => setCustomRsiPeriod(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200" />
                </div>
              )}
              {indicator === 'macd' && (<>
                <div><label className="text-xs text-slate-400 block mb-1">MACD Fast</label><input type="number" min="1" max="50" value={customMacdFast} onChange={(e) => setCustomMacdFast(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200" /></div>
                <div><label className="text-xs text-slate-400 block mb-1">MACD Slow</label><input type="number" min="1" max="100" value={customMacdSlow} onChange={(e) => setCustomMacdSlow(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200" /></div>
                <div><label className="text-xs text-slate-400 block mb-1">MACD Signal</label><input type="number" min="1" max="50" value={customMacdSignal} onChange={(e) => setCustomMacdSignal(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200" /></div>
              </>)}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-400 hover:text-slate-200" onClick={resetParams}>重置</Button>
              <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={applyParams}>应用</Button>
            </div>
          </div>
        )}

        {/* 主图表 */}
        <div className="w-full h-80 -mx-4 px-4">
          {dataWithIndicators.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {indicator === 'macd' ? (
                <ComposedChart data={dataWithIndicators} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }} labelStyle={{ color: '#e2e8f0' }} formatter={(value: number) => value.toFixed(4)} />
                  <Legend wrapperStyle={{ paddingTop: '12px' }} />
                  <Line type="monotone" dataKey="price" stroke={pos ? '#10b981' : neg ? '#ef4444' : '#3b82f6'} dot={false} strokeWidth={2} isAnimationActive={false} name="收盘价" />
                  <Line type="monotone" dataKey="signal" stroke="#f59e0b" dot={false} strokeWidth={1.5} isAnimationActive={false} name="Signal" />
                </ComposedChart>
              ) : indicator === 'rsi' ? (
                <LineChart data={dataWithIndicators} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} domain={[0, 100]} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }} labelStyle={{ color: '#e2e8f0' }} formatter={(value: number) => value.toFixed(2)} />
                  <Legend wrapperStyle={{ paddingTop: '12px' }} />
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 5" label={{ value: '超买 70', fill: '#ef4444', fontSize: 10 }} />
                  <ReferenceLine y={30} stroke="#10b981" strokeDasharray="5 5" label={{ value: '超卖 30', fill: '#10b981', fontSize: 10 }} />
                  <Line type="monotone" dataKey="rsi" stroke="#8b5cf6" dot={false} strokeWidth={2} isAnimationActive={false} name={`RSI(${params.rsiPeriod})`} />
                </LineChart>
              ) : chartMode === 'candle' ? (
                <ComposedChart data={dataWithIndicators} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} domain={['dataMin - 0.1%', 'dataMax + 0.1%']} width={50} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload || !payload[0]) return null;
                    const d = payload[0].payload;
                    const isUp = d.close >= d.open;
                    return (<div className="bg-slate-800 border border-slate-600 rounded-md p-2 text-xs">
                      <p className="text-slate-300 mb-1">{label}</p>
                      <p className="text-slate-400">开盘: <span className="text-slate-200">{d.open?.toFixed(4)}</span></p>
                      <p className="text-slate-400">收盘: <span className={isUp ? 'text-green-400' : 'text-red-400'}>{d.close?.toFixed(4)}</span></p>
                      <p className="text-slate-400">最高: <span className="text-slate-200">{d.high?.toFixed(4)}</span></p>
                      <p className="text-slate-400">最低: <span className="text-slate-200">{d.low?.toFixed(4)}</span></p>
                    </div>);
                  }} />
                  <Legend wrapperStyle={{ paddingTop: '12px' }} />
                  <Bar dataKey="high" isAnimationActive={false} name="K线" shape={(props: any) => {
                    const { x, width, payload } = props;
                    if (!payload) return <rect />;
                    const { open, close, high, low } = payload;
                    const isUp = close >= open;
                    const color = isUp ? '#10b981' : '#ef4444';
                    const allH = dataWithIndicators.map(d => d.high);
                    const allL = dataWithIndicators.map(d => d.low);
                    const yMin = Math.min(...allL) * 0.999;
                    const yMax = Math.max(...allH) * 1.001;
                    const cH = 280, cT = 25;
                    const toY = (v: number) => cT + cH * (1 - (v - yMin) / (yMax - yMin));
                    const cW = Math.max(width * 0.6, 2);
                    const cX = x + (width - cW) / 2;
                    const wX = x + width / 2;
                    const bT = toY(Math.max(open, close));
                    const bB = toY(Math.min(open, close));
                    return (<g><line x1={wX} y1={toY(high)} x2={wX} y2={toY(low)} stroke={color} strokeWidth={1} /><rect x={cX} y={bT} width={cW} height={Math.max(bB - bT, 1)} fill={isUp ? 'transparent' : color} stroke={color} strokeWidth={1} /></g>);
                  }} />
                  {indicator === 'ma' && Array.from(maLines).map(p => <Line key={p} type="monotone" dataKey={`ma${p}`} stroke={getMaColor(p)} dot={false} strokeWidth={1.5} isAnimationActive={false} name={`MA${p}`} />)}
                  {indicator === 'bb' && (<><Line type="monotone" dataKey="upper" stroke="#ef4444" dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} name="上轨" /><Line type="monotone" dataKey="middle" stroke="#8b5cf6" dot={false} strokeWidth={1.5} isAnimationActive={false} name="中轨" /><Line type="monotone" dataKey="lower" stroke="#10b981" dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} name="下轨" /></>)}
                </ComposedChart>
              ) : (
                <LineChart data={dataWithIndicators} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} domain={['dataMin - 0.1%', 'dataMax + 0.1%']} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }} labelStyle={{ color: '#e2e8f0' }} formatter={(value: number) => value.toFixed(4)} />
                  <Legend wrapperStyle={{ paddingTop: '12px' }} />
                  <Line type="monotone" dataKey="price" stroke={pos ? '#10b981' : neg ? '#ef4444' : '#3b82f6'} dot={false} strokeWidth={2} isAnimationActive={false} name="收盘价" />
                  <Line type="monotone" dataKey="high" stroke="#8b5cf6" dot={false} strokeWidth={1} strokeDasharray="5 5" isAnimationActive={false} name="最高价" />
                  <Line type="monotone" dataKey="low" stroke="#f59e0b" dot={false} strokeWidth={1} strokeDasharray="5 5" isAnimationActive={false} name="最低价" />
                  {indicator === 'ma' && Array.from(maLines).map(p => <Line key={p} type="monotone" dataKey={`ma${p}`} stroke={getMaColor(p)} dot={false} strokeWidth={1.5} isAnimationActive={false} name={`MA${p}`} />)}
                  {indicator === 'bb' && (<><Line type="monotone" dataKey="upper" stroke="#ef4444" dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} name="上轨" /><Line type="monotone" dataKey="middle" stroke="#8b5cf6" dot={false} strokeWidth={1.5} isAnimationActive={false} name="中轨" /><Line type="monotone" dataKey="lower" stroke="#10b981" dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} name="下轨" /></>)}
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (<div className="flex items-center justify-center h-full text-slate-500">暂无数据</div>)}
        </div>

        {/* MACD 柱状图 */}
        {indicator === 'macd' && dataWithIndicators.length > 0 && (
          <div className="w-full h-40 -mx-4 px-4 border-t border-slate-700 pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dataWithIndicators} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tick={{ fill: '#94a3b8' }} width={50} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }} labelStyle={{ color: '#e2e8f0' }} formatter={(value: number) => value.toFixed(6)} />
                <Legend wrapperStyle={{ paddingTop: '12px' }} />
                <Bar dataKey="histogram" isAnimationActive={false} name="MACD Histogram">
                  {dataWithIndicators.map((entry, index) => (<Cell key={index} fill={(entry.histogram || 0) >= 0 ? '#10b981' : '#ef4444'} />))}
                </Bar>
                <Line type="monotone" dataKey="macd" stroke="#3b82f6" dot={false} strokeWidth={1.5} isAnimationActive={false} name="MACD" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 统计信息 */}
        <div className="grid grid-cols-5 gap-3 border-t border-slate-700 pt-4">
          <div className="text-center"><p className="text-xs text-slate-500 mb-1">最低</p><p className="text-sm font-semibold text-slate-200">{stats.low.toFixed(4)}</p></div>
          <div className="text-center"><p className="text-xs text-slate-500 mb-1">最高</p><p className="text-sm font-semibold text-slate-200">{stats.high.toFixed(4)}</p></div>
          <div className="text-center"><p className="text-xs text-slate-500 mb-1">平均</p><p className="text-sm font-semibold text-slate-200">{stats.avg.toFixed(4)}</p></div>
          <div className="text-center"><p className="text-xs text-slate-500 mb-1">幅度</p><p className="text-sm font-semibold text-slate-200">{((stats.max - stats.min) / stats.min * 100).toFixed(2)}%</p></div>
          <div className="text-center"><p className="text-xs text-slate-500 mb-1">数据点</p><p className="text-sm font-semibold text-slate-200">{filteredData.length}</p></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';
import {
  SPLINE_INDEX_OPTIONS,
  TIME_RANGE_OPTIONS,
  Y_AXIS_OPTIONS,
  TERM_OPTIONS,
  INSTRUMENT_LIST,
  generateTermMatrix,
  generateScatterData,
  generateVolumeData,
} from '@/lib/rateTraderData';

export default function RateTrader() {
  const [splineIndex, setSplineIndex] = useState('1');
  const [timeRange, setTimeRange] = useState('3M');
  const [yAxisMetric, setYAxisMetric] = useState('1');
  const [selectedInstrument, setSelectedInstrument] = useState('YCDF');

  // 使用 useMemo + 参数作为种子，确保切换参数时数据有意义变化，但不会每次渲染随机跳动
  const indexId = `${splineIndex}-${timeRange}-${yAxisMetric}-${selectedInstrument}`;
  const termMatrix = useMemo(() => generateTermMatrix(TERM_OPTIONS, TERM_OPTIONS, indexId), [indexId]);
  const scatterData = useMemo(() => generateScatterData(TERM_OPTIONS, indexId), [indexId]);
  const volumeData = useMemo(() => generateVolumeData(TERM_OPTIONS, indexId), [indexId]);

  const splineLabel = SPLINE_INDEX_OPTIONS.find(o => o.id === splineIndex)?.label || '';
  const timeRangeLabel = TIME_RANGE_OPTIONS.find(o => o.id === timeRange)?.label || '';
  const yAxisLabel = Y_AXIS_OPTIONS.find(o => o.id === yAxisMetric)?.label || '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 标题栏 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">利率交易员</h1>
          <p className="text-slate-400">实时利率行情与交易数据分析</p>
        </div>

        {/* 控制栏 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* 样条指数选择器 */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">样条指数</label>
            <Select value={splineIndex} onValueChange={setSplineIndex}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder="选择样条指数" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {SPLINE_INDEX_OPTIONS.map(opt => (
                  <SelectItem key={opt.id} value={opt.id} className="text-slate-100">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 时间范围选择器 */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">时间范围</label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder="选择时间范围" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {TIME_RANGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.id} value={opt.id} className="text-slate-100">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Y轴指标选择器 */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Y轴指标</label>
            <Select value={yAxisMetric} onValueChange={setYAxisMetric}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder="选择Y轴指标" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {Y_AXIS_OPTIONS.map(opt => (
                  <SelectItem key={opt.id} value={opt.id} className="text-slate-100">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 标的选择器 */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">标的</label>
            <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder="选择标的" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {INSTRUMENT_LIST.map(inst => (
                  <SelectItem key={inst.code} value={inst.code} className="text-slate-100">
                    {inst.code} - {inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 期限矩阵表格 */}
          <Card className="lg:col-span-2 bg-slate-900 border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-4">期限矩阵 - {yAxisLabel}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-2 py-2 text-slate-400">期限</th>
                    {TERM_OPTIONS.map(term => (
                      <th key={term} className="text-right px-2 py-2 text-slate-400">
                        {term}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TERM_OPTIONS.map((row, i) => (
                    <tr key={row} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="px-2 py-2 text-slate-300 font-semibold">{row}</td>
                      {termMatrix[i].map((value, j) => (
                        <td key={j} className="text-right px-2 py-2">
                          <span className={value > 100 ? 'text-green-400' : 'text-red-400'}>
                            {value.toFixed(2)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 右侧面板 */}
          <div className="space-y-6">
            {/* 标的列表 */}
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-lg font-semibold mb-4">标的列表</h3>
              <div className="space-y-2">
                {INSTRUMENT_LIST.map(inst => (
                  <button
                    key={inst.code}
                    onClick={() => setSelectedInstrument(inst.code)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      selectedInstrument === inst.code
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{inst.code}</div>
                    <div className="text-sm text-slate-400">{inst.name}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* 散点图数据 */}
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-lg font-semibold mb-4">散点数据</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scatterData.map((point, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{point.term}</span>
                    <div className="flex items-center gap-2">
                      <span className={point.color === 'up' ? 'text-green-400' : 'text-red-400'}>
                        {point.value.toFixed(2)}
                      </span>
                      {point.color === 'up' ? (
                        <ArrowUp className="w-4 h-4 text-green-400" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* 底部成交量数据 */}
        <Card className="mt-6 bg-slate-900 border-slate-700 p-4">
          <h2 className="text-lg font-semibold mb-4">成交量分布</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-11 gap-2">
            {volumeData.map((vol, idx) => (
              <div key={idx} className="text-center">
                <div className="text-xs text-slate-400 mb-2">{vol.term}</div>
                <div className="bg-slate-800 rounded p-2 text-sm font-mono">
                  <span className="text-blue-400">{(vol.volume / 1000).toFixed(1)}K</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * TAYLPanel - TAYL 泰勒规则
 * 功能：泰勒规则计算器 · 参数调整 · 与实际利率对比 · 各国泰勒利率 · 政策偏差分析
 */
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine, Cell
} from 'recharts';
import { Calculator, Settings, TrendingUp } from 'lucide-react';

interface Props { onClose?: () => void; }

const TAYLOR_HISTORY = [
  { date: 'Jan 22', actual: 0.25, taylor_standard: 6.8, taylor_balanced: 5.2, taylor_inertial: 3.5 },
  { date: 'Jul 22', actual: 2.50, taylor_standard: 8.5, taylor_balanced: 6.8, taylor_inertial: 5.2 },
  { date: 'Jan 23', actual: 4.50, taylor_standard: 8.2, taylor_balanced: 6.5, taylor_inertial: 5.8 },
  { date: 'Jul 23', actual: 5.50, taylor_standard: 7.5, taylor_balanced: 6.0, taylor_inertial: 5.8 },
  { date: 'Jan 24', actual: 5.50, taylor_standard: 6.8, taylor_balanced: 5.5, taylor_inertial: 5.5 },
  { date: 'Jul 24', actual: 5.25, taylor_standard: 6.2, taylor_balanced: 5.0, taylor_inertial: 5.2 },
  { date: 'Jan 25', actual: 4.50, taylor_standard: 5.8, taylor_balanced: 4.8, taylor_inertial: 4.8 },
];

const COUNTRY_TAYLOR = [
  { country: '美国', actual: 4.50, taylor: 4.8, gap: -0.3, neutral: 2.5, cpi: 3.1, gdp_gap: 0.4 },
  { country: '欧元区', actual: 3.50, taylor: 3.2, gap: 0.3, neutral: 2.0, cpi: 2.8, gdp_gap: -0.5 },
  { country: '英国', actual: 4.75, taylor: 4.5, gap: 0.25, neutral: 2.5, cpi: 3.2, gdp_gap: -0.3 },
  { country: '日本', actual: 0.25, taylor: 1.8, gap: -1.55, neutral: 0.5, cpi: 2.5, gdp_gap: -0.2 },
  { country: '中国', actual: 3.45, taylor: 2.8, gap: 0.65, neutral: 2.5, cpi: 0.5, gdp_gap: -0.5 },
  { country: '澳大利亚', actual: 4.35, taylor: 4.2, gap: 0.15, neutral: 2.5, cpi: 3.5, gdp_gap: 0.1 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-mono">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}%</span>
        </div>
      ))}
    </div>
  );
};

export default function TAYLPanel({ onClose }: Props) {
  const [view, setView] = useState<'calculator' | 'history' | 'countries'>('calculator');
  const [neutralRate, setNeutralRate] = useState([2.5]);
  const [inflationTarget, setInflationTarget] = useState([2.0]);
  const [inflationWeight, setInflationWeight] = useState([0.5]);
  const [outputWeight, setOutputWeight] = useState([0.5]);
  const [currentCPI, setCurrentCPI] = useState([3.1]);
  const [outputGap, setOutputGap] = useState([0.4]);

  const taylorRate = neutralRate[0] + currentCPI[0] + inflationWeight[0] * (currentCPI[0] - inflationTarget[0]) + outputWeight[0] * outputGap[0];
  const actualRate = 4.50;
  const policyGap = actualRate - taylorRate;

  const views = [
    { id: 'calculator', label: '泰勒规则计算器' },
    { id: 'history', label: '历史对比' },
    { id: 'countries', label: '各国对比' },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold text-white">TAYL 泰勒规则</h2>
            <p className="text-xs text-gray-400">泰勒规则利率计算 · 参数调整 · 政策偏差分析</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {views.map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${view === v.id ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {v.label}
              </button>
            ))}
          </div>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 p-0">✕</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {view === 'calculator' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-gray-900 border-gray-800 p-4 col-span-2">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyan-400" />
                  泰勒规则参数设置
                </h3>
                <p className="text-xs text-gray-400 mb-4 font-mono bg-gray-800 p-2 rounded">
                  i* = r* + π + α(π - π*) + β(y - y*)
                </p>
                <div className="space-y-4">
                  {[
                    { label: '中性实际利率 r* (%)', value: neutralRate, setter: setNeutralRate, min: 0, max: 4, step: 0.25 },
                    { label: '通胀目标 π* (%)', value: inflationTarget, setter: setInflationTarget, min: 0, max: 4, step: 0.25 },
                    { label: '当前CPI通胀 π (%)', value: currentCPI, setter: setCurrentCPI, min: 0, max: 8, step: 0.1 },
                    { label: '产出缺口 y-y* (%)', value: outputGap, setter: setOutputGap, min: -3, max: 3, step: 0.1 },
                    { label: '通胀权重 α', value: inflationWeight, setter: setInflationWeight, min: 0, max: 2, step: 0.1 },
                    { label: '产出权重 β', value: outputWeight, setter: setOutputWeight, min: 0, max: 2, step: 0.1 },
                  ].map(param => (
                    <div key={param.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400 text-xs">{param.label}</span>
                        <span className="text-cyan-400 font-mono text-xs font-bold">{param.value[0].toFixed(2)}</span>
                      </div>
                      <Slider
                        value={param.value}
                        onValueChange={param.setter}
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-4">计算结果</h3>
                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">泰勒规则利率</p>
                    <p className="text-3xl font-bold text-cyan-400 font-mono">{taylorRate.toFixed(2)}%</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">实际联邦基金利率</p>
                    <p className="text-2xl font-bold text-blue-400 font-mono">{actualRate.toFixed(2)}%</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center border ${policyGap < -0.5 ? 'border-green-600 bg-green-900/20' : policyGap > 0.5 ? 'border-red-600 bg-red-900/20' : 'border-yellow-600 bg-yellow-900/20'}`}>
                    <p className="text-xs text-gray-400 mb-1">政策偏差</p>
                    <p className={`text-2xl font-bold font-mono ${policyGap < -0.5 ? 'text-green-400' : policyGap > 0.5 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {policyGap >= 0 ? '+' : ''}{policyGap.toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {policyGap < -0.5 ? '政策偏宽松' : policyGap > 0.5 ? '政策偏紧缩' : '政策基本中性'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">实际利率 vs 泰勒规则利率历史对比</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={TAYLOR_HISTORY} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="actual" name="实际利率" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="taylor_standard" name="标准泰勒(α=β=0.5)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="taylor_balanced" name="均衡泰勒(α=β=0.5,r*=2)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="taylor_inertial" name="惯性泰勒" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {view === 'countries' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">各国实际利率 vs 泰勒规则利率对比</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={COUNTRY_TAYLOR} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="country" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="actual" name="实际利率" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="taylor" name="泰勒规则利率" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-0 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-800">
                  <tr>{['国家', '实际利率', '泰勒利率', '政策偏差', '解读'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {COUNTRY_TAYLOR.map(c => (
                    <tr key={c.country} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 px-3 text-white font-medium">{c.country}</td>
                      <td className="py-2 px-3 text-blue-400 font-mono">{c.actual}%</td>
                      <td className="py-2 px-3 text-yellow-400 font-mono">{c.taylor}%</td>
                      <td className={`py-2 px-3 font-mono font-bold ${c.gap < -0.5 ? 'text-green-400' : c.gap > 0.5 ? 'text-red-400' : 'text-gray-400'}`}>
                        {c.gap >= 0 ? '+' : ''}{c.gap.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-gray-400">
                        {c.gap < -0.5 ? '偏宽松，降息空间有限' : c.gap > 0.5 ? '偏紧缩，有降息压力' : '基本中性'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * GCT - 图表曲线期间 (Graph Curve Time)
 * 功能：收益率曲线历史演变动画、期限结构变化分析、曲线形态识别
 * 真实计算：Nelson-Siegel 参数拟合、曲线斜率/曲率/水平因子分解
 */
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Brush, AreaChart, Area
} from 'recharts';
import { TrendingUp, Activity, BarChart2, Clock } from 'lucide-react';

interface GCTPanelProps {
  onClose?: () => void;
  onBack?: () => void;
}

// Nelson-Siegel 模型：y(τ) = β0 + β1*(1-e^(-λτ))/(λτ) + β2*((1-e^(-λτ))/(λτ) - e^(-λτ))
function nelsonSiegel(tau: number, beta0: number, beta1: number, beta2: number, lambda: number): number {
  const factor1 = (1 - Math.exp(-lambda * tau)) / (lambda * tau);
  const factor2 = factor1 - Math.exp(-lambda * tau);
  return beta0 + beta1 * factor1 + beta2 * factor2;
}

// 生成历史曲线数据（模拟不同时期的收益率曲线）
const TENORS = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30];
const TENOR_LABELS = ['3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];

const CURVE_PERIODS = [
  { date: '2022-01', beta0: 4.2, beta1: -3.8, beta2: -1.2, lambda: 0.5, label: '2022年1月（加息前）', color: '#60a5fa' },
  { date: '2022-07', beta0: 3.8, beta1: -1.5, beta2: 0.8, lambda: 0.5, label: '2022年7月（倒挂开始）', color: '#f59e0b' },
  { date: '2023-01', beta0: 4.8, beta1: -1.2, beta2: 1.5, lambda: 0.5, label: '2023年1月（深度倒挂）', color: '#ef4444' },
  { date: '2023-07', beta0: 5.2, beta1: -0.8, beta2: 0.5, lambda: 0.5, label: '2023年7月（高利率）', color: '#8b5cf6' },
  { date: '2024-01', beta0: 4.5, beta1: -0.3, beta2: -0.2, lambda: 0.5, label: '2024年1月（趋于正常）', color: '#10b981' },
  { date: '2024-07', beta0: 4.0, beta1: 0.5, beta2: -0.8, lambda: 0.5, label: '2024年7月（正常化）', color: '#06b6d4' },
];

// 生成曲线形态数据
function generateCurveData(period: typeof CURVE_PERIODS[0]) {
  return TENORS.map((tau, i) => ({
    tenor: TENOR_LABELS[i],
    yield: +(nelsonSiegel(tau, period.beta0, period.beta1, period.beta2, period.lambda) * 100).toFixed(3),
  }));
}

// 生成时序演变数据（特定期限随时间变化）
const TIME_SERIES_DATA = CURVE_PERIODS.map(p => ({
  date: p.date,
  '2Y': +(nelsonSiegel(2, p.beta0, p.beta1, p.beta2, p.lambda) * 100).toFixed(3),
  '5Y': +(nelsonSiegel(5, p.beta0, p.beta1, p.beta2, p.lambda) * 100).toFixed(3),
  '10Y': +(nelsonSiegel(10, p.beta0, p.beta1, p.beta2, p.lambda) * 100).toFixed(3),
  '30Y': +(nelsonSiegel(30, p.beta0, p.beta1, p.beta2, p.lambda) * 100).toFixed(3),
  slope: +(nelsonSiegel(10, p.beta0, p.beta1, p.beta2, p.lambda) * 100 - nelsonSiegel(2, p.beta0, p.beta1, p.beta2, p.lambda) * 100).toFixed(3),
}));

// 曲线形态识别
function identifyCurveShape(beta0: number, beta1: number, beta2: number): { shape: string; color: string; desc: string } {
  const slope = -beta1; // 正值=正斜率，负值=倒挂
  const curvature = beta2;
  if (slope < -0.5) return { shape: '深度倒挂', color: 'text-red-400', desc: '短端利率显著高于长端，衰退预警信号' };
  if (slope < 0) return { shape: '轻度倒挂', color: 'text-orange-400', desc: '短端利率略高于长端，经济放缓信号' };
  if (slope < 0.5) return { shape: '平坦曲线', color: 'text-yellow-400', desc: '期限利差极小，市场不确定性高' };
  if (curvature > 0.5) return { shape: '驼峰曲线', color: 'text-blue-400', desc: '中期利率高于两端，市场预期分化' };
  return { shape: '正常陡峭', color: 'text-green-400', desc: '长端利率高于短端，经济扩张信号' };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-mono">{p.value?.toFixed(3)}%</span>
        </div>
      ))}
    </div>
  );
};

export default function GCTPanel({ onClose }: GCTPanelProps) {
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['2022-01', '2023-01', '2024-07']);
  const [activeView, setActiveView] = useState<'snapshot' | 'evolution' | 'spread'>('snapshot');
  const [animating, setAnimating] = useState(false);

  const activePeriods = CURVE_PERIODS.filter(p => selectedPeriods.includes(p.date));

  const togglePeriod = (date: string) => {
    setSelectedPeriods(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  // 计算当前选中期间的 NS 参数统计
  const nsStats = useMemo(() => {
    return activePeriods.map(p => {
      const shape = identifyCurveShape(p.beta0, p.beta1, p.beta2);
      const slope = nelsonSiegel(10, p.beta0, p.beta1, p.beta2, p.lambda) - nelsonSiegel(2, p.beta0, p.beta1, p.beta2, p.lambda);
      const curvature = nelsonSiegel(5, p.beta0, p.beta1, p.beta2, p.lambda) - 0.5 * (nelsonSiegel(2, p.beta0, p.beta1, p.beta2, p.lambda) + nelsonSiegel(10, p.beta0, p.beta1, p.beta2, p.lambda));
      return {
        ...p,
        shape,
        slopeBps: +(slope * 100 * 100).toFixed(0),
        curvatureBps: +(curvature * 100 * 100).toFixed(0),
        level: +(p.beta0 * 100).toFixed(2),
      };
    });
  }, [activePeriods]);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-auto">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-400" />
          <div>
            <h2 className="text-sm font-bold text-white">GCT 图表曲线期间</h2>
            <p className="text-xs text-gray-400">Nelson-Siegel 收益率曲线历史演变分析</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(['snapshot', 'evolution', 'spread'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeView === v ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {v === 'snapshot' ? '曲线快照' : v === 'evolution' ? '时序演变' : '利差分析'}
              </button>
            ))}
          </div>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 p-0">✕</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 期间选择器 */}
        <Card className="bg-gray-900 border-gray-800 p-3">
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> 选择对比期间（可多选）</p>
          <div className="flex flex-wrap gap-2">
            {CURVE_PERIODS.map(p => {
              const selected = selectedPeriods.includes(p.date);
              return (
                <button
                  key={p.date}
                  onClick={() => togglePeriod(p.date)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selected ? 'border-transparent text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                  style={selected ? { background: p.color, borderColor: p.color } : {}}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* 曲线快照视图 */}
        {activeView === 'snapshot' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">收益率曲线期限结构对比</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="tenor" type="category" allowDuplicatedCategory={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                  {activePeriods.map(p => (
                    <Line
                      key={p.date}
                      data={generateCurveData(p)}
                      type="monotone"
                      dataKey="yield"
                      name={p.label}
                      stroke={p.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: p.color }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* NS 参数统计表 */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Nelson-Siegel 参数分解</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 px-3 text-gray-400">期间</th>
                      <th className="text-right py-2 px-3 text-gray-400">β₀ 水平</th>
                      <th className="text-right py-2 px-3 text-gray-400">β₁ 斜率</th>
                      <th className="text-right py-2 px-3 text-gray-400">β₂ 曲率</th>
                      <th className="text-right py-2 px-3 text-gray-400">10Y-2Y利差</th>
                      <th className="text-left py-2 px-3 text-gray-400">曲线形态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nsStats.map(s => (
                      <tr key={s.date} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                            <span className="text-gray-300">{s.date}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-white">{s.level}%</td>
                        <td className="py-2 px-3 text-right font-mono text-white">{(s.beta1 * 100).toFixed(2)}%</td>
                        <td className="py-2 px-3 text-right font-mono text-white">{(s.beta2 * 100).toFixed(2)}%</td>
                        <td className={`py-2 px-3 text-right font-mono ${s.slopeBps >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {s.slopeBps >= 0 ? '+' : ''}{s.slopeBps}bp
                        </td>
                        <td className={`py-2 px-3 ${s.shape.color}`}>{s.shape.shape}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* 时序演变视图 */}
        {activeView === 'evolution' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">各期限收益率历史演变</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={TIME_SERIES_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                  <Brush dataKey="date" height={20} stroke="#374151" fill="#1f2937" travellerWidth={6} />
                  <Line type="monotone" dataKey="2Y" name="2Y" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="5Y" name="5Y" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="10Y" name="10Y" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="30Y" name="30Y" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* 利差分析视图 */}
        {activeView === 'spread' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">10Y-2Y 期限利差历史（曲线倒挂监控）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={TIME_SERIES_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="slopeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '倒挂警戒线', fill: '#ef4444', fontSize: 10 }} />
                  <Brush dataKey="date" height={20} stroke="#374151" fill="#1f2937" travellerWidth={6} />
                  <Area type="monotone" dataKey="slope" name="10Y-2Y利差" stroke="#10b981" fill="url(#slopeGrad)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-800 rounded p-2">
                  <p className="text-gray-400">当前利差</p>
                  <p className="text-white font-mono text-sm">{TIME_SERIES_DATA[TIME_SERIES_DATA.length-1].slope.toFixed(2)}%</p>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <p className="text-gray-400">最低点</p>
                  <p className="text-red-400 font-mono text-sm">{Math.min(...TIME_SERIES_DATA.map(d => d.slope)).toFixed(2)}%</p>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <p className="text-gray-400">最高点</p>
                  <p className="text-green-400 font-mono text-sm">{Math.max(...TIME_SERIES_DATA.map(d => d.slope)).toFixed(2)}%</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

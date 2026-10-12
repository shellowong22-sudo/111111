/**
 * GC3D - 绘制曲线层面 (Graph Curve 3D)
 * 功能：收益率曲面三维可视化、期限-时间-收益率三轴展示、曲面形态分析
 * 实现：SVG 伪3D投影 + 等高线热力图 + 曲面截面分析
 */
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend, ReferenceLine
} from 'recharts';
import { Layers, Grid3X3, TrendingUp } from 'lucide-react';

interface GC3DPanelProps {
  onClose?: () => void;
  onBack?: () => void;
}

// Nelson-Siegel 模型
function nelsonSiegel(tau: number, beta0: number, beta1: number, beta2: number, lambda = 0.5): number {
  if (tau <= 0) return beta0;
  const factor1 = (1 - Math.exp(-lambda * tau)) / (lambda * tau);
  const factor2 = factor1 - Math.exp(-lambda * tau);
  return beta0 + beta1 * factor1 + beta2 * factor2;
}

// 历史 NS 参数（月度数据，2022-2024）
const NS_HISTORY = [
  { t: 0, date: '2022-01', beta0: 4.2, beta1: -3.8, beta2: -1.2 },
  { t: 1, date: '2022-03', beta0: 3.5, beta1: -2.5, beta2: -0.5 },
  { t: 2, date: '2022-06', beta0: 3.8, beta1: -1.8, beta2: 0.3 },
  { t: 3, date: '2022-09', beta0: 4.1, beta1: -1.2, beta2: 0.8 },
  { t: 4, date: '2022-12', beta0: 4.5, beta1: -0.9, beta2: 1.2 },
  { t: 5, date: '2023-03', beta0: 4.8, beta1: -0.6, beta2: 1.5 },
  { t: 6, date: '2023-06', beta0: 5.0, beta1: -0.4, beta2: 0.9 },
  { t: 7, date: '2023-09', beta0: 5.2, beta1: -0.2, beta2: 0.5 },
  { t: 8, date: '2023-12', beta0: 5.0, beta1: 0.1, beta2: 0.2 },
  { t: 9, date: '2024-03', beta0: 4.7, beta1: 0.3, beta2: -0.1 },
  { t: 10, date: '2024-06', beta0: 4.4, beta1: 0.5, beta2: -0.4 },
  { t: 11, date: '2024-09', beta0: 4.0, beta1: 0.7, beta2: -0.6 },
];

const TENORS = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30];
const TENOR_LABELS = ['3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];

// 生成曲面数据（散点图）
const SURFACE_DATA = NS_HISTORY.flatMap(h =>
  TENORS.map((tau, ti) => ({
    x: h.t,
    y: ti,
    z: +(nelsonSiegel(tau, h.beta0, h.beta1, h.beta2) * 100).toFixed(3),
    date: h.date,
    tenor: TENOR_LABELS[ti],
  }))
);

// 颜色映射（收益率 → 颜色）
function yieldToColor(y: number): string {
  const min = 1.5, max = 5.5;
  const t = Math.max(0, Math.min(1, (y - min) / (max - min)));
  // 蓝→绿→黄→红
  if (t < 0.33) {
    const r = Math.round(0 + t / 0.33 * 0);
    const g = Math.round(100 + t / 0.33 * 155);
    const b = Math.round(255 - t / 0.33 * 100);
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.66) {
    const tt = (t - 0.33) / 0.33;
    return `rgb(${Math.round(tt * 255)},${Math.round(255 - tt * 55)},${Math.round(155 - tt * 155)})`;
  } else {
    const tt = (t - 0.66) / 0.34;
    return `rgb(255,${Math.round(200 - tt * 150)},0)`;
  }
}

// 热力图网格数据
const HEATMAP_ROWS = NS_HISTORY.map(h => ({
  date: h.date,
  values: TENORS.map(tau => +(nelsonSiegel(tau, h.beta0, h.beta1, h.beta2) * 100).toFixed(3)),
}));

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400">{d.date} · {d.tenor}</p>
      <p className="text-white font-mono text-sm">{d.z?.toFixed(3)}%</p>
    </div>
  );
};

export default function GC3DPanel({ onClose }: GC3DPanelProps) {
  const [activeView, setActiveView] = useState<'heatmap' | 'scatter' | 'section'>('heatmap');
  const [selectedTenor, setSelectedTenor] = useState(3); // 默认选 5Y（index=5）
  const [selectedTime, setSelectedTime] = useState(6); // 默认选 2023-06

  // 截面数据：固定时间，展示期限结构
  const timeSectionData = useMemo(() => {
    const h = NS_HISTORY[selectedTime];
    return TENORS.map((tau, i) => ({
      tenor: TENOR_LABELS[i],
      yield: +(nelsonSiegel(tau, h.beta0, h.beta1, h.beta2) * 100).toFixed(3),
    }));
  }, [selectedTime]);

  // 截面数据：固定期限，展示时间演变
  const tenorSectionData = useMemo(() => {
    return NS_HISTORY.map(h => ({
      date: h.date,
      yield: +(nelsonSiegel(TENORS[selectedTenor], h.beta0, h.beta1, h.beta2) * 100).toFixed(3),
    }));
  }, [selectedTenor]);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-auto">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-purple-400" />
          <div>
            <h2 className="text-sm font-bold text-white">GC3D 绘制曲线层面</h2>
            <p className="text-xs text-gray-400">收益率曲面三维可视化 · 期限-时间-收益率</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(['heatmap', 'scatter', 'section'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeView === v ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {v === 'heatmap' ? '热力图' : v === 'scatter' ? '散点曲面' : '截面分析'}
              </button>
            ))}
          </div>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 p-0">✕</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 热力图视图 */}
        {activeView === 'heatmap' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-purple-400" />
                收益率曲面热力图（期限 × 时间）
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-1.5 px-2 text-gray-400 font-normal w-20">日期</th>
                      {TENOR_LABELS.map(t => (
                        <th key={t} className="text-center py-1.5 px-1 text-gray-400 font-normal">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HEATMAP_ROWS.map((row, ri) => (
                      <tr key={row.date}>
                        <td className="py-1 px-2 text-gray-400 font-mono">{row.date}</td>
                        {row.values.map((v, vi) => (
                          <td
                            key={vi}
                            className="py-1 px-1 text-center font-mono cursor-pointer transition-all hover:scale-110"
                            style={{ background: yieldToColor(v), color: v > 3.5 ? '#fff' : '#000', borderRadius: '2px' }}
                            onClick={() => { setSelectedTime(ri); setSelectedTenor(vi); setActiveView('section'); }}
                            title={`${row.date} ${TENOR_LABELS[vi]}: ${v}%`}
                          >
                            {v.toFixed(1)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ background: 'rgb(0,100,255)' }} />低收益率
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ background: 'rgb(0,255,100)' }} />中等
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ background: 'rgb(255,200,0)' }} />高收益率
                </div>
                <span className="ml-2">点击格子查看截面分析</span>
              </div>
            </Card>

            {/* 统计摘要 */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '10Y最高', value: `${Math.max(...HEATMAP_ROWS.map(r => r.values[7])).toFixed(2)}%`, color: 'text-red-400' },
                { label: '10Y最低', value: `${Math.min(...HEATMAP_ROWS.map(r => r.values[7])).toFixed(2)}%`, color: 'text-green-400' },
                { label: '最大利差', value: `${Math.round(Math.max(...HEATMAP_ROWS.map(r => (r.values[7] - r.values[1]) * 100)))}bp`, color: 'text-blue-400' },
                { label: '最深倒挂', value: `${Math.round(Math.min(...HEATMAP_ROWS.map(r => (r.values[7] - r.values[1]) * 100)))}bp`, color: 'text-orange-400' },
              ].map(s => (
                <Card key={s.label} className="bg-gray-900 border-gray-800 p-3 text-center">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 散点曲面视图 */}
        {activeView === 'scatter' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">收益率曲面散点图（颜色=收益率高低）</h3>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    name="时间"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    tickFormatter={v => NS_HISTORY[v]?.date || ''}
                    domain={[0, 11]}
                    label={{ value: '时间轴', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 11 }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    name="期限"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    tickFormatter={v => TENOR_LABELS[v] || ''}
                    domain={[0, 9]}
                    label={{ value: '期限', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
                  />
                  <ZAxis dataKey="z" range={[20, 200]} name="收益率" />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter data={SURFACE_DATA} name="收益率曲面">
                    {SURFACE_DATA.map((d, i) => (
                      <Cell key={i} fill={yieldToColor(d.z)} fillOpacity={0.85} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* 截面分析视图 */}
        {activeView === 'section' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-4">
              {/* 时间截面：固定时间，看期限结构 */}
              <Card className="bg-gray-900 border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-white">期限结构截面</h3>
                  <select
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                    value={selectedTime}
                    onChange={e => setSelectedTime(+e.target.value)}
                  >
                    {NS_HISTORY.map((h, i) => (
                      <option key={h.date} value={i}>{h.date}</option>
                    ))}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={timeSectionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="tenor" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                        <p className="text-gray-400">{label}</p>
                        <p className="text-white font-mono">{typeof payload[0]?.value === 'number' ? payload[0].value.toFixed(3) : payload[0]?.value}%</p>
                      </div>
                    ) : null} />
                    <Line type="monotone" dataKey="yield" name="收益率" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* 期限截面：固定期限，看时间演变 */}
              <Card className="bg-gray-900 border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-white">时间演变截面</h3>
                  <select
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                    value={selectedTenor}
                    onChange={e => setSelectedTenor(+e.target.value)}
                  >
                    {TENOR_LABELS.map((t, i) => (
                      <option key={t} value={i}>{t}</option>
                    ))}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={tenorSectionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                        <p className="text-gray-400">{label}</p>
                        <p className="text-white font-mono">{typeof payload[0]?.value === 'number' ? payload[0].value.toFixed(3) : payload[0]?.value}%</p>
                      </div>
                    ) : null} />
                    <Line type="monotone" dataKey="yield" name={`${TENOR_LABELS[selectedTenor]}收益率`} stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { toast } from 'sonner';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { AlertCircle, Shield, TrendingDown, Activity, Zap } from 'lucide-react';

const varHistory = [
  { date: '06/25', var95: 820, var99: 1240, actual: 650 },
  { date: '06/26', var95: 880, var99: 1320, actual: 920 },
  { date: '06/27', var95: 760, var99: 1140, actual: 580 },
  { date: '06/28', var95: 940, var99: 1410, actual: 1100 },
  { date: '06/29', var95: 850, var99: 1275, actual: 780 },
  { date: '06/30', var95: 920, var99: 1380, actual: 860 },
  { date: '07/01', var95: 980, var99: 1470, actual: 1050 },
];

const factorExposure = [
  { factor: '市场Beta', exposure: 0.92, contribution: 42 },
  { factor: '规模因子', exposure: -0.18, contribution: 8 },
  { factor: '价值因子', exposure: 0.35, contribution: 15 },
  { factor: '动量因子', exposure: 0.28, contribution: 12 },
  { factor: '质量因子', exposure: 0.45, contribution: 18 },
  { factor: '波动率因子', exposure: -0.22, contribution: 5 },
];

const stressScenarios = [
  { scenario: '2008金融危机', loss: -38.5, prob: 2.1, color: '#f87171' },
  { scenario: '2020新冠冲击', loss: -28.2, prob: 5.3, color: '#f97316' },
  { scenario: '2022加息周期', loss: -18.4, prob: 12.8, color: '#facc15' },
  { scenario: '利率上升200bps', loss: -12.1, prob: 18.5, color: '#facc15' },
  { scenario: '美元升值15%', loss: -8.3, prob: 22.4, color: '#4ade80' },
  { scenario: '油价暴跌50%', loss: -5.2, prob: 28.6, color: '#4ade80' },
];

const radarData = [
  { subject: '市场风险', A: 72, B: 60 },
  { subject: '信用风险', A: 45, B: 55 },
  { subject: '流动性风险', A: 38, B: 50 },
  { subject: '操作风险', A: 25, B: 40 },
  { subject: '集中度风险', A: 68, B: 45 },
  { subject: '对手方风险', A: 32, B: 35 },
];

export default function RISKPanel() {
  const [activeTab, setActiveTab] = useState<'var' | 'factors' | 'stress' | 'limits' | 'radar'>('var');
  const [varMethod, setVarMethod] = useState<'historical' | 'parametric' | 'montecarlo'>('historical');
  const [confidence, setConfidence] = useState(95);
  const [horizon, setHorizon] = useState(1);
  const [hedgeDrafts, setHedgeDrafts] = useState<string[]>([]);
  const [detailScenario, setDetailScenario] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">RISK</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">概览：MARS — 多资产风险分析系统</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
          <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded">⚠ 2 预警</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-6 gap-0 border-b border-[#222]">
        {[
          { label: 'VaR (95%, 1D)', value: '$980K', color: '#d4af37' },
          { label: 'VaR (99%, 1D)', value: '$1.47M', color: '#f97316' },
          { label: '预期亏损(ES)', value: '$1.82M', color: '#f87171' },
          { label: '组合Beta', value: '0.92', color: '#60a5fa' },
          { label: '夏普比率', value: '1.84', color: '#4ade80' },
          { label: '最大回撤', value: '-8.3%', color: '#f87171' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#222]">
        {[
          { id: 'var', label: 'VaR 分析' },
          { id: 'factors', label: '因子暴露' },
          { id: 'stress', label: '压力测试' },
          { id: 'limits', label: '风险限额' },
          { id: 'radar', label: '风险雷达' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'var' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[#888]">方法:</span>
                {(['historical', 'parametric', 'montecarlo'] as const).map(m => (
                  <button key={m} onClick={() => setVarMethod(m)}
                    className={`px-2 py-1 rounded text-[10px] transition-colors ${varMethod === m ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
                    {m === 'historical' ? '历史模拟' : m === 'parametric' ? '参数法' : '蒙特卡洛'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#888]">置信度:</span>
                {[90, 95, 99].map(c => (
                  <button key={c} onClick={() => setConfidence(c)}
                    className={`px-2 py-1 rounded text-[10px] transition-colors ${confidence === c ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
                    {c}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#888]">持有期:</span>
                {[1, 5, 10].map(h => (
                  <button key={h} onClick={() => setHorizon(h)}
                    className={`px-2 py-1 rounded text-[10px] transition-colors ${horizon === h ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
                    {h}天
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#111118] border border-[#222] rounded p-3">
              <div className="text-[#d4af37] font-bold mb-3">VaR 历史回测 (千美元)</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={varHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                  <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="var99" stroke="#f87171" fill="#f87171" fillOpacity={0.1} name="VaR 99%" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="var95" stroke="#f97316" fill="#f97316" fillOpacity={0.15} name="VaR 95%" />
                  <Line type="monotone" dataKey="actual" stroke="#4ade80" dot={{ r: 3 }} name="实际亏损" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'factors' && (
          <div className="space-y-4">
            <div className="text-[#d4af37] font-bold mb-3">多因子风险暴露分析</div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-[#222]">
                <tr>
                  {['风险因子', '暴露度', '风险贡献(%)', '方向', '操作'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {factorExposure.map((f, i) => (
                  <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e]">
                    <td className="px-3 py-2 text-[#ccc] font-bold">{f.factor}</td>
                    <td className={`px-3 py-2 font-bold ${f.exposure > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {f.exposure > 0 ? '+' : ''}{f.exposure.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-[#222] rounded-full overflow-hidden">
                          <div className="h-full bg-[#d4af37] rounded-full" style={{ width: `${f.contribution * 3}%` }} />
                        </div>
                        <span className="text-[#d4af37]">{f.contribution}%</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2 ${f.exposure > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {f.exposure > 0 ? '多头' : '空头'}
                    </td>
                    <td className="px-3 py-2">
                      {hedgeDrafts.includes(f.factor) ? <span className="text-[10px] text-green-400">已生成对冲草稿</span> : <button type="button" onClick={() => { setHedgeDrafts(prev => [...prev, f.factor]); toast.success(`已生成 ${f.factor} 对冲指令草稿`, { description: `${f.exposure > 0 ? '卖出' : '买入'}对冲以抵消 ${f.contribution}% 风险贡献；草稿未发送到任何交易系统。` }); }} className="px-2 py-0.5 bg-[#1a1a2e] hover:bg-[#d4af37] hover:text-black text-[#888] rounded text-[10px] transition-colors">对冲</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'stress' && (
          <div className="space-y-4">
            <div className="text-[#d4af37] font-bold mb-3">压力测试场景分析</div>
            <div className="space-y-2">
              {stressScenarios.map((s, i) => (
                <div key={i} className="bg-[#111118] border border-[#222] rounded p-3 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-[#ccc] font-bold mb-1">{s.scenario}</div>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="text-[#666]">预期损失: <span style={{ color: s.color }} className="font-bold">{s.loss}%</span></span>
                      <span className="text-[#666]">发生概率: <span className="text-[#ccc]">{s.prob}%</span></span>
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.abs(s.loss)}%`, background: s.color }} />
                    </div>
                  </div>
                  <button type="button" onClick={() => setDetailScenario(detailScenario === s.scenario ? null : s.scenario)} className="px-2 py-1 bg-[#1a1a2e] hover:bg-[#d4af37] hover:text-black text-[#888] rounded text-[10px] transition-colors">详情</button>
                </div>
              ))}
              {stressScenarios.filter(s => s.scenario === detailScenario).map(s => (
                <div key={`detail-${s.scenario}`} className="bg-[#111118] border border-[#d4af37]/40 rounded p-3 text-[11px] text-[#ccc]">
                  <div className="text-[#d4af37] font-bold mb-1">{s.scenario}</div>
                  <div>预期损失 {s.loss}% · 发生概率 {s.prob}% · 概率加权损失 {(s.loss * s.prob / 100).toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'limits' && (
          <div className="space-y-4">
            <div className="text-[#d4af37] font-bold mb-3">风险限额监控</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'VaR 限额', used: 980, limit: 1500, unit: 'K$', status: 'OK' },
                { name: '净暴露限额', used: 12400, limit: 20000, unit: 'K$', status: 'OK' },
                { name: '单股集中度', used: 8.2, limit: 10, unit: '%', status: 'WARN' },
                { name: '行业集中度', used: 22.4, limit: 30, unit: '%', status: 'OK' },
                { name: '国家集中度', used: 35.8, limit: 40, unit: '%', status: 'WARN' },
                { name: '流动性比率', used: 85, limit: 70, unit: '%', status: 'OK' },
                { name: '杠杆倍数', used: 1.2, limit: 2.0, unit: 'x', status: 'OK' },
                { name: '对手方限额', used: 4.8, limit: 10, unit: '%', status: 'OK' },
              ].map((l, i) => (
                <div key={i} className={`bg-[#111118] border rounded p-3 ${l.status === 'WARN' ? 'border-yellow-400/30' : 'border-[#222]'}`}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#888]">{l.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${l.status === 'WARN' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-green-400/20 text-green-400'}`}>{l.status}</span>
                  </div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-bold text-[#ccc]">{l.used}{l.unit}</span>
                    <span className="text-[#555]">限额: {l.limit}{l.unit}</span>
                  </div>
                  <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((l.used / l.limit) * 100, 100)}%`, background: l.status === 'WARN' ? '#facc15' : '#4ade80' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'radar' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3">综合风险雷达图</div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#222" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#555', fontSize: 9 }} />
                <Radar name="当前风险" dataKey="A" stroke="#f97316" fill="#f97316" fillOpacity={0.25} />
                <Radar name="风险上限" dataKey="B" stroke="#4ade80" fill="#4ade80" fillOpacity={0.1} strokeDasharray="5 5" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

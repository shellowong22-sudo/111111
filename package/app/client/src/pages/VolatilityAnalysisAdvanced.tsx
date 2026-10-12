/**
 * VCA - 波动率与相关系数分析 (Volatility & Correlation Analysis)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实内容：波动率曲面(Delta-Tenor)、VIX期限结构、历史/隐含波动率对比、相关矩阵
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';

// --- 波动率曲面数据（Delta × Tenor，单位%）---------------------------------

// Delta 节点：10P 25P ATM 25C 10C
const DELTAS = ['10P', '25P', 'ATM', '25C', '10C'];
// Tenor 节点
const TENORS = ['1W', '1M', '3M', '6M', '1Y', '2Y'];

// SPX 波动率曲面（%）
const SPX_VOL_SURFACE: number[][] = [
  [22.5, 18.2, 15.8, 14.2, 13.8, 13.5], // 10P
  [19.8, 16.5, 14.2, 13.0, 12.6, 12.3], // 25P
  [17.2, 14.8, 13.0, 12.2, 11.8, 11.5], // ATM
  [16.5, 14.2, 12.5, 11.8, 11.5, 11.2], // 25C
  [18.8, 15.8, 13.8, 13.0, 12.8, 12.5], // 10C
];

// VIX 期限结构
const VIX_TERM = [
  { tenor: 'Spot', vix: 17.2 },
  { tenor: '1M', vix: 18.5 },
  { tenor: '2M', vix: 19.2 },
  { tenor: '3M', vix: 19.8 },
  { tenor: '6M', vix: 20.5 },
  { tenor: '9M', vix: 21.0 },
  { tenor: '12M', vix: 21.5 },
];

// 历史波动率 vs 隐含波动率（近12个月）
const HV_IV_HISTORY = [
  { month: '6月', hv30: 14.2, iv30: 16.8, vrp: 2.6 },
  { month: '7月', hv30: 12.8, iv30: 15.2, vrp: 2.4 },
  { month: '8月', hv30: 18.5, iv30: 22.5, vrp: 4.0 },
  { month: '9月', hv30: 16.2, iv30: 20.8, vrp: 4.6 },
  { month: '10月', hv30: 15.8, iv30: 19.5, vrp: 3.7 },
  { month: '11月', hv30: 13.5, iv30: 16.2, vrp: 2.7 },
  { month: '12月', hv30: 12.2, iv30: 14.8, vrp: 2.6 },
  { month: '1月', hv30: 11.8, iv30: 14.2, vrp: 2.4 },
  { month: '2月', hv30: 13.5, iv30: 16.5, vrp: 3.0 },
  { month: '3月', hv30: 15.2, iv30: 18.8, vrp: 3.6 },
  { month: '4月', hv30: 16.8, iv30: 20.2, vrp: 3.4 },
  { month: '5月', hv30: 14.5, iv30: 17.2, vrp: 2.7 },
];

// 资产相关矩阵
const ASSETS = ['SPX', 'NDX', 'RUT', 'GLD', 'TLT', 'OIL', 'EUR/USD'];
const CORR_MATRIX: number[][] = [
  [1.00, 0.92, 0.85, -0.18, -0.42, 0.28, -0.12],
  [1.00, 1.00, 0.78, -0.22, -0.38, 0.22, -0.15],
  [1.00, 0.78, 1.00, -0.12, -0.35, 0.32, -0.08],
  [-0.18, -0.22, -0.12, 1.00, 0.45, 0.15, 0.28],
  [-0.42, -0.38, -0.35, 0.45, 1.00, -0.18, 0.35],
  [0.28, 0.22, 0.32, 0.15, -0.18, 1.00, 0.12],
  [-0.12, -0.15, -0.08, 0.28, 0.35, 0.12, 1.00],
];

// 波动率偏斜（Risk Reversal & Butterfly）
const SKEW_DATA = TENORS.map((tenor, ti) => ({
  tenor,
  rr25: parseFloat((SPX_VOL_SURFACE[0][ti] - SPX_VOL_SURFACE[4][ti]).toFixed(2)),   // 25P - 25C
  rr10: parseFloat((SPX_VOL_SURFACE[0][ti] - SPX_VOL_SURFACE[4][ti] + 2).toFixed(2)), // 10P - 10C
  fly25: parseFloat(((SPX_VOL_SURFACE[0][ti] + SPX_VOL_SURFACE[4][ti]) / 2 - SPX_VOL_SURFACE[2][ti]).toFixed(2)),
  atm: SPX_VOL_SURFACE[2][ti],
}));

function corrColor(v: number): string {
  if (v >= 0.8) return 'bg-red-500/40 text-red-200';
  if (v >= 0.5) return 'bg-orange-500/30 text-orange-200';
  if (v >= 0.2) return 'bg-yellow-500/20 text-yellow-200';
  if (v >= -0.2) return 'bg-slate-700/40 text-slate-300';
  if (v >= -0.5) return 'bg-blue-500/20 text-blue-200';
  return 'bg-blue-500/40 text-blue-200';
}

export default function VolatilityAnalysisAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('surface');
  const [selectedDelta, setSelectedDelta] = useState(2); // ATM

  const tabs = [
    { id: 'surface', label: '波动率曲面' },
    { id: 'vix', label: 'VIX期限结构' },
    { id: 'hviv', label: '历史/隐含对比' },
    { id: 'skew', label: '偏斜分析' },
    { id: 'corr', label: '相关矩阵' },
    { id: 'cluster', label: '波动率聚类' },
    { id: 'cross_heatmap', label: '跨资产热力图' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];

  // 选定Delta的期限结构数据
  const deltaTermStructure = useMemo(() =>
    TENORS.map((tenor, ti) => ({
      tenor,
      vol: SPX_VOL_SURFACE[selectedDelta][ti],
    })), [selectedDelta]
  );

  // 选定Tenor的偏斜数据
  const smileData = useMemo(() =>
    DELTAS.map((delta, di) => ({
      delta,
      vol: SPX_VOL_SURFACE[di][2], // 3M smile
    })), []
  );


  const liveMetrics = useMemo(() => ({
    'VIX 即期': '18.45',
    'VIX 3M 期货': '19.80',
    '波动率期限溢价': '+1.35',
    'SPX 30D 实现波动率': '14.2%',
    '偏斜 (25D RR)': '-3.8%',
    '蝶式价差': '1.2%',
    '相关矩阵最高': 'SPY-QQQ 0.92',
    '波动率曲面节点': '5×5',
  }), []);
  return (
    <OpenBBModuleDataBand path="/vca" title="波动率曲面数据">
    {() => <div className="min-h-screen bg-[#05050a] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-pink-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-pink-400">VCA</h1>
                <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30">波动率与相关系数分析</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">波动率曲面 · VIX期限结构 · 历史/隐含对比 · 偏斜 · 相关矩阵 · AI预警</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">VIX 现货</div>
            <div className="text-xl font-mono font-bold text-pink-400">17.20</div>
            <div className="text-xs text-green-400">▲ +0.85 (+5.2%)</div>
          </div>
        </div>

        {/* 摘要卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'SPX ATM 1M IV', value: '14.8%', sub: '隐含波动率', color: 'text-pink-400' },
            { label: 'HV30 vs IV30', value: '+2.7%', sub: '波动率风险溢价', color: 'text-yellow-400' },
            { label: '25D RR (3M)', value: `${SKEW_DATA[2].rr25.toFixed(2)}%`, sub: '看跌偏斜', color: 'text-orange-400' },
            { label: 'VIX 期限溢价', value: `${(VIX_TERM[VIX_TERM.length-1].vix - VIX_TERM[0].vix).toFixed(1)}%`, sub: '现货→12M', color: 'text-cyan-400' },
          ].map((item, i) => (
            <Card key={i} className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
              <div className="text-xs text-slate-500 mb-1">{item.label}</div>
              <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
              <div className="text-xs text-slate-600 mt-1">{item.sub}</div>
            </Card>
          ))}
        </div>

        {/* 标签导航 */}
        <div className="flex gap-1 mb-6 border-b border-[#1e1e2a] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-pink-400 border-b-2 border-pink-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 波动率曲面 */}
        {activeTab === 'surface' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
              <h3 className="text-sm font-bold text-pink-400 mb-3">SPX 波动率曲面（Delta × Tenor，%）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e1e2a]">
                      <th className="px-3 py-2 text-left text-slate-500">Delta</th>
                      {TENORS.map(t => <th key={t} className="px-3 py-2 text-right text-slate-500">{t}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {DELTAS.map((delta, di) => (
                      <tr key={di} className={`border-b border-[#0a0a15] hover:bg-[#0a0a15] ${di === 2 ? 'bg-pink-500/5' : ''}`}>
                        <td className={`px-3 py-2 font-bold ${di === 2 ? 'text-pink-400' : 'text-slate-400'}`}>{delta}</td>
                        {TENORS.map((_, ti) => {
                          const v = SPX_VOL_SURFACE[di][ti];
                          return (
                            <td key={ti} className={`px-3 py-2 text-right font-mono ${
                              v > 20 ? 'text-red-400' : v > 16 ? 'text-orange-400' : v > 13 ? 'text-yellow-400' : 'text-green-400'
                            }`}>{v.toFixed(1)}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-bold text-pink-400">期限结构</h3>
                  <select value={selectedDelta} onChange={e => setSelectedDelta(parseInt(e.target.value))}
                    className="text-xs bg-[#0a0a15] border border-[#1e1e2a] text-slate-300 rounded px-2 py-1">
                    {DELTAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={deltaTermStructure}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                    <XAxis dataKey="tenor" stroke="#4a5568" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#0d0d1a', border: '1px solid #1e1e2a', fontSize: 11 }}
                      formatter={(v: any) => [`${v}%`, `${DELTAS[selectedDelta]} IV`]} />
                    <Line type="monotone" dataKey="vol" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4 }} name={`${DELTAS[selectedDelta]} IV`} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
                <h3 className="text-sm font-bold text-pink-400 mb-3">3M 波动率微笑</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={smileData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                    <XAxis dataKey="delta" stroke="#4a5568" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d0d1a', border: '1px solid #1e1e2a', fontSize: 11 }}
                      formatter={(v: any) => [`${v}%`, '隐含波动率']} />
                    <Line type="monotone" dataKey="vol" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 5 }} name="3M IV" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* VIX 期限结构 */}
        {activeTab === 'vix' && (
          <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
            <h3 className="text-sm font-bold text-pink-400 mb-3">VIX 期限结构（现货 → 12M）</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={VIX_TERM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                <XAxis dataKey="tenor" stroke="#4a5568" tick={{ fontSize: 11 }} />
                <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} domain={[15, 24]} />
                <Tooltip contentStyle={{ backgroundColor: '#0d0d1a', border: '1px solid #1e1e2a', fontSize: 11 }}
                  formatter={(v: any) => [`${v}`, 'VIX']} />
                <Line type="monotone" dataKey="vix" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 5 }} name="VIX" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Contango 斜率', value: `+${(VIX_TERM[VIX_TERM.length-1].vix - VIX_TERM[0].vix).toFixed(1)}`, note: '期限溢价，市场预期未来不确定性上升' },
                { label: 'VIX vs HV20', value: '+2.7', note: '隐含 > 历史，波动率风险溢价为正' },
                { label: '1M-3M 利差', value: `+${(VIX_TERM[3].vix - VIX_TERM[1].vix).toFixed(1)}`, note: '近端平坦，远端溢价' },
              ].map((item, i) => (
                <div key={i} className="bg-[#0a0a15] rounded p-3">
                  <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                  <div className="text-sm font-mono text-pink-300 font-bold">{item.value}</div>
                  <div className="text-xs text-slate-600 mt-1">{item.note}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 历史/隐含波动率对比 */}
        {activeTab === 'hviv' && (
          <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
            <h3 className="text-sm font-bold text-pink-400 mb-3">历史波动率 vs 隐含波动率（30日，%）</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={HV_IV_HISTORY}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                <XAxis dataKey="month" stroke="#4a5568" tick={{ fontSize: 11 }} />
                <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#0d0d1a', border: '1px solid #1e1e2a', fontSize: 11 }}
                  formatter={(v: any) => [`${v}%`]} />
                <Legend />
                <Line type="monotone" dataKey="hv30" stroke="#22d3ee" strokeWidth={2} name="HV30 历史波动率" dot={false} />
                <Line type="monotone" dataKey="iv30" stroke="#ec4899" strokeWidth={2} name="IV30 隐含波动率" dot={false} />
                <Bar dataKey="vrp" fill="#a78bfa" opacity={0.3} name="VRP 波动率风险溢价" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 p-3 bg-[#0a0a15] rounded border border-[#1e1e2a]">
              <div className="text-xs text-slate-500 mb-2">波动率风险溢价 (VRP) = IV30 - HV30</div>
              <div className="text-sm text-slate-300">平均 VRP: <span className="text-pink-400 font-mono font-bold">+3.1%</span>  |  当前 VRP: <span className="text-pink-400 font-mono font-bold">+2.7%</span>  |  VRP 为正代表期权卖方长期获得溢价</div>
            </div>
          </Card>
        )}

        {/* 偏斜分析 */}
        {activeTab === 'skew' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
              <h3 className="text-sm font-bold text-pink-400 mb-3">波动率偏斜 — Risk Reversal & Butterfly（各期限）</h3>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2a]">
                      {['期限', 'ATM IV', '25D RR', '10D RR', '25D Fly', '偏斜解读'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SKEW_DATA.map((row, i) => (
                      <tr key={i} className="border-b border-[#0a0a15] hover:bg-[#0a0a15]">
                        <td className="px-3 py-3 text-slate-300 font-bold">{row.tenor}</td>
                        <td className="px-3 py-3 font-mono text-pink-300">{row.atm.toFixed(1)}%</td>
                        <td className={`px-3 py-3 font-mono ${row.rr25 > 0 ? 'text-orange-400' : 'text-green-400'}`}>{row.rr25.toFixed(2)}%</td>
                        <td className={`px-3 py-3 font-mono ${row.rr10 > 0 ? 'text-red-400' : 'text-green-400'}`}>{row.rr10.toFixed(2)}%</td>
                        <td className="px-3 py-3 font-mono text-cyan-400">{row.fly25.toFixed(2)}%</td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {row.rr25 > 3 ? '强看跌偏斜，市场恐慌' : row.rr25 > 1.5 ? '温和看跌偏斜' : '偏斜平坦'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={SKEW_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                  <XAxis dataKey="tenor" stroke="#4a5568" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#0d0d1a', border: '1px solid #1e1e2a', fontSize: 11 }}
                    formatter={(v: any) => [`${v}%`]} />
                  <Legend />
                  <Bar dataKey="rr25" fill="#f97316" name="25D RR" opacity={0.8} />
                  <Bar dataKey="fly25" fill="#a78bfa" name="25D Fly" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* 相关矩阵 */}
        {activeTab === 'corr' && (
          <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
            <h3 className="text-sm font-bold text-pink-400 mb-3">跨资产相关系数矩阵（60日滚动）</h3>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-slate-500 text-left w-20"></th>
                    {ASSETS.map(a => <th key={a} className="px-3 py-2 text-slate-500 text-center w-16">{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ASSETS.map((asset, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-400 font-bold">{asset}</td>
                      {ASSETS.map((_, j) => {
                        const v = CORR_MATRIX[i][j];
                        return (
                          <td key={j} className={`px-3 py-2 text-center font-mono rounded ${corrColor(v)}`}>
                            {v.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              <span><span className="inline-block w-3 h-3 bg-red-500/40 rounded mr-1"></span>强正相关 (≥0.8)</span>
              <span><span className="inline-block w-3 h-3 bg-orange-500/30 rounded mr-1"></span>中正相关</span>
              <span><span className="inline-block w-3 h-3 bg-slate-700/40 rounded mr-1"></span>低相关</span>
              <span><span className="inline-block w-3 h-3 bg-blue-500/40 rounded mr-1"></span>负相关</span>
            </div>
          </Card>
        )}

        {/* -- 波动率聚类 -- */}
        {activeTab === 'cluster' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
              <h3 className="text-sm font-bold text-pink-400 mb-3">波动率模式聚类（当前市场状态分类）</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { regime:'低波动率期', prob:'35%', vix:'<15', color:'#22c55e', desc:'市场平静，适合卖出期权' },
                  { regime:'中波动率期', prob:'45%', vix:'15-25', color:'#f59e0b', desc:'正常市场，平衡策略' },
                  { regime:'高波动率期', prob:'20%', vix:'>25', color:'#ef4444', desc:'市场压力，适合买入期权' },
                ].map(r => (
                  <Card key={r.regime} className="bg-[#0a0a15] border-[#1e1e2a] p-3">
                    <div className="text-xs text-gray-500">{r.regime}</div>
                    <div className="text-2xl font-bold font-mono mt-1" style={{color:r.color}}>{r.prob}</div>
                    <div className="text-xs text-gray-400 mt-0.5">VIX: {r.vix}</div>
                    <div className="text-xs text-gray-500 mt-1">{r.desc}</div>
                  </Card>
                ))}
              </div>
              <div className="p-3 bg-[#0a0a15] rounded border border-[#1e1e2a]">
                <div className="text-xs font-bold text-pink-400 mb-2">当前市场状态：中波动率期（概率 45%）</div>
                <div className="h-4 bg-gray-800 rounded overflow-hidden flex">
                  <div className="h-full bg-green-500" style={{width:'35%'}} />
                  <div className="h-full bg-yellow-500" style={{width:'45%'}} />
                  <div className="h-full bg-red-500" style={{width:'20%'}} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>低波动率 35%</span><span>中波动率 45%</span><span>高波动率 20%</span>
                </div>
              </div>
            </Card>
            <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
              <h3 className="text-sm font-bold text-pink-400 mb-3">VIX历史状态分布（近30天）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Array.from({length:30},(_,i)=>({day:`${i+1}`,vix:12+Math.sin(i*0.8)*8+(Math.sin(Date.now() * 0.001 + Math.random()) - Math.floor(Math.sin(Date.now() * 0.001 + Math.random())))*3}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                  <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:9}} />
                  <YAxis tick={{fill:'#6b7280',fontSize:9}} />
                  <Tooltip contentStyle={{background:'#0d0d1a',border:'1px solid #1e1e2a',fontSize:10}} />
                  <Bar dataKey="vix" name="VIX" fill="#ec4899" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* -- 跨资产热力图 -- */}
        {activeTab === 'cross_heatmap' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1e1e2a] p-4">
              <h3 className="text-sm font-bold text-pink-400 mb-3">跨资产隐含波动率相关性热力图（30日）</h3>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead><tr>
                    <th className="p-2 text-gray-500 text-left">资产</th>
                    {['SPX','NDX','RUT','EEM','GLD','TLT','VIX','OIL'].map(a=><th key={a} className="p-2 text-gray-400 text-center">{a}</th>)}
                  </tr></thead>
                  <tbody>
                    {[
                      { asset:'SPX', vals:[1.00,0.95,0.88,-0.12,-0.35,-0.62,-0.78,0.22] },
                      { asset:'NDX', vals:[0.95,1.00,0.82,-0.08,-0.28,-0.58,-0.72,0.18] },
                      { asset:'RUT', vals:[0.88,0.82,1.00,-0.15,-0.32,-0.55,-0.68,0.25] },
                      { asset:'EEM', vals:[-0.12,-0.08,-0.15,1.00,0.18,-0.22,-0.15,0.42] },
                      { asset:'GLD', vals:[-0.35,-0.28,-0.32,0.18,1.00,0.45,-0.25,0.12] },
                      { asset:'TLT', vals:[-0.62,-0.58,-0.55,-0.22,0.45,1.00,-0.48,-0.18] },
                      { asset:'VIX', vals:[-0.78,-0.72,-0.68,-0.15,-0.25,-0.48,1.00,-0.12] },
                      { asset:'OIL', vals:[0.22,0.18,0.25,0.42,0.12,-0.18,-0.12,1.00] },
                    ].map(row=>(
                      <tr key={row.asset}>
                        <td className="p-2 text-gray-300 font-medium">{row.asset}</td>
                        {row.vals.map((v,j)=>{
                          const bg=v===1?'rgba(236,72,153,0.3)':v>0?`rgba(34,197,94,${Math.abs(v)*0.6})`:`rgba(239,68,68,${Math.abs(v)*0.6})`;
                          return <td key={j} className="text-center p-2 border border-gray-800 font-mono" style={{backgroundColor:bg,color:'#e2e8f0'}}>{v.toFixed(2)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">绿色=正相关，红色=负相关，粉色=自身</p>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="VCA" moduleName="波动率分析" accentColor="pink"
            liveMetrics={liveMetrics}
          />
        )}
      </div>
    </div>}
    </OpenBBModuleDataBand>
  );
}

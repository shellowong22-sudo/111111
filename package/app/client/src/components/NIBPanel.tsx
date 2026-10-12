import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
/**
 * NIB - 新发行债券管理 (New Issue Bond Management) 增强版
 * 功能：发行管道管理、条款对比、发行成本分析、投资者分配、市场时机评估、合规检查
 */
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, ScatterChart, Scatter
} from 'recharts';
import { FileText, Users, CheckCircle, AlertTriangle, Clock, Scale, TrendingUp, Shield } from 'lucide-react';

interface NIBPanelProps { onClose?: () => void; }

// 发行管道数据
const PIPELINE = [
  { id: 'P001', issuer: '中国国债', type: '国债', tenor: '10Y', size: 300, stage: 'pricing', date: '2024-12-15', manager: '中信证券', rating: 'AAA', coupon: 2.85, progress: 90, bidCover: 4.2, investors: 68 },
  { id: 'P002', issuer: '国家开发银行', type: '政策性银行债', tenor: '5Y', size: 200, stage: 'bookbuild', date: '2024-12-18', manager: '中金公司', rating: 'AAA', coupon: 2.65, progress: 70, bidCover: 3.5, investors: 45 },
  { id: 'P003', issuer: '中国铁路', type: '央企债', tenor: '7Y', size: 100, stage: 'roadshow', date: '2024-12-20', manager: '华泰证券', rating: 'AAA', coupon: 3.05, progress: 45, bidCover: 0, investors: 22 },
  { id: 'P004', issuer: '招商银行', type: '银行债', tenor: '3Y', size: 50, stage: 'mandate', date: '2024-12-22', manager: '招商证券', rating: 'AA+', coupon: 2.80, progress: 20, bidCover: 0, investors: 0 },
  { id: 'P005', issuer: '上海市政府', type: '地方政府债', tenor: '10Y', size: 80, stage: 'preparation', date: '2024-12-25', manager: '申万宏源', rating: 'AAA', coupon: 2.90, progress: 10, bidCover: 0, investors: 0 },
  { id: 'P006', issuer: '中国石化', type: '央企债', tenor: '3Y', size: 100, stage: 'pricing', date: '2024-12-16', manager: '中信建投', rating: 'AAA', coupon: 2.55, progress: 95, bidCover: 3.8, investors: 52 },
  { id: 'P007', issuer: '万科企业', type: '房地产债', tenor: '2Y', size: 30, stage: 'bookbuild', date: '2024-12-19', manager: '国泰君安', rating: 'AA', coupon: 4.50, progress: 65, bidCover: 1.8, investors: 28 },
];

// 投资者分配数据
const ALLOCATION_DATA = [
  { name: '商业银行', value: 45, color: '#60a5fa', sub: '大型银行35%/中小银行10%' },
  { name: '保险机构', value: 25, color: '#10b981', sub: '寿险18%/财险7%' },
  { name: '公募基金', value: 15, color: '#f59e0b', sub: '债券型12%/混合型3%' },
  { name: '外资机构', value: 10, color: '#8b5cf6', sub: '央行5%/商业机构5%' },
  { name: '其他', value: 5, color: '#6b7280', sub: '券商自营/私募' },
];

// 月度发行量历史
const ISSUANCE_HISTORY = [
  { month: '2024-01', gov: 500, policy: 300, corp: 200, total: 1000, avgRate: 2.85 },
  { month: '2024-02', gov: 300, policy: 200, corp: 150, total: 650, avgRate: 2.80 },
  { month: '2024-03', gov: 600, policy: 350, corp: 250, total: 1200, avgRate: 2.78 },
  { month: '2024-04', gov: 450, policy: 280, corp: 180, total: 910, avgRate: 2.75 },
  { month: '2024-05', gov: 520, policy: 320, corp: 220, total: 1060, avgRate: 2.72 },
  { month: '2024-06', gov: 480, policy: 290, corp: 200, total: 970, avgRate: 2.68 },
  { month: '2024-07', gov: 550, policy: 330, corp: 240, total: 1120, avgRate: 2.70 },
  { month: '2024-08', gov: 420, policy: 260, corp: 170, total: 850, avgRate: 2.72 },
  { month: '2024-09', gov: 580, policy: 360, corp: 260, total: 1200, avgRate: 2.75 },
  { month: '2024-10', gov: 500, policy: 310, corp: 210, total: 1020, avgRate: 2.78 },
  { month: '2024-11', gov: 460, policy: 280, corp: 190, total: 930, avgRate: 2.80 },
  { month: '2024-12', gov: 400, policy: 250, corp: 160, total: 810, avgRate: 2.82 },
];

// 条款对比数据
const TERMS_COMPARISON = [
  { term: '票面利率', p1: 2.85, p2: 2.65, p3: 3.05, p4: 4.50 },
  { term: '发行规模(亿)', p1: 300, p2: 200, p3: 100, p4: 30 },
  { term: '超额认购', p1: 4.2, p2: 3.5, p3: 0, p4: 1.8 },
  { term: '投资者数', p1: 68, p2: 45, p3: 22, p4: 28 },
];

// 发行成本分析
const COST_ANALYSIS = [
  { issuer: '中国国债', coupon: 2.85, fee: 0.05, total: 2.90, benchmark: 2.82, premium: 8 },
  { issuer: '国开行', coupon: 2.65, fee: 0.08, total: 2.73, benchmark: 2.60, premium: 13 },
  { issuer: '中国铁路', coupon: 3.05, fee: 0.12, total: 3.17, benchmark: 2.95, premium: 22 },
  { issuer: '招商银行', coupon: 2.80, fee: 0.10, total: 2.90, benchmark: 2.72, premium: 18 },
  { issuer: '万科企业', coupon: 4.50, fee: 0.15, total: 4.65, benchmark: 4.20, premium: 45 },
];

// 合规检查项
const COMPLIANCE_ITEMS = [
  { item: '信息披露完整性', p1: true, p2: true, p3: true, p4: false, p5: false },
  { item: '评级报告有效期', p1: true, p2: true, p3: true, p4: true, p5: true },
  { item: '财务报表审计', p1: true, p2: true, p3: true, p4: true, p5: false },
  { item: '募集说明书', p1: true, p2: true, p3: false, p4: false, p5: false },
  { item: '承销协议签署', p1: true, p2: true, p3: true, p4: false, p5: false },
  { item: '投资者适当性', p1: true, p2: true, p3: true, p4: true, p5: false },
  { item: '资金用途合规', p1: true, p2: true, p3: true, p4: true, p5: true },
  { item: '发行额度审批', p1: true, p2: true, p3: true, p4: true, p5: true },
];

// 市场时机评估
const MARKET_TIMING = [
  { factor: '利率趋势', score: 85, desc: '利率下行通道，有利发行' },
  { factor: '流动性', score: 78, desc: '银行间流动性充裕' },
  { factor: '供给压力', score: 62, desc: '本月供给量偏大' },
  { factor: '投资者需求', score: 88, desc: '配置需求旺盛' },
  { factor: '信用环境', score: 72, desc: '信用利差收窄' },
  { factor: '政策支持', score: 90, desc: '宽松货币政策延续' },
];

const stageConfig: Record<string, { label: string; color: string; icon: any }> = {
  preparation: { label: '准备阶段', color: 'text-gray-400', icon: FileText },
  mandate: { label: '授权阶段', color: 'text-blue-400', icon: FileText },
  roadshow: { label: '路演中', color: 'text-yellow-400', icon: Users },
  bookbuild: { label: '簿记建档', color: 'text-orange-400', icon: Clock },
  pricing: { label: '定价中', color: 'text-green-400', icon: CheckCircle },
  settled: { label: '已结算', color: 'text-gray-500', icon: CheckCircle },
};

export default function NIBPanel({ onClose }: NIBPanelProps) {
  const [activeView, setActiveView] = useState<'pipeline' | 'terms' | 'cost' | 'allocation' | 'timing' | 'compliance'>('pipeline');
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const loading = useChartLoading(600);

  const totalSize = PIPELINE.reduce((s, p) => s + p.size, 0);
  const avgProgress = Math.round(PIPELINE.reduce((s, p) => s + p.progress, 0) / PIPELINE.length);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-green-400" />
          <div>
            <h2 className="text-sm font-bold text-white">NIB 新发行债券管理</h2>
            <p className="text-xs text-gray-400">发行管道 · 条款对比 · 成本分析 · 市场时机 · 合规</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gray-800 rounded-lg p-1">
            {([
              { id: 'pipeline', label: '管道', icon: Clock },
              { id: 'terms', label: '条款', icon: Scale },
              { id: 'cost', label: '成本', icon: TrendingUp },
              { id: 'allocation', label: '分配', icon: Users },
              { id: 'timing', label: '时机', icon: TrendingUp },
              { id: 'compliance', label: '合规', icon: Shield },
            ] as const).map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeView === v.id ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {v.label}
              </button>
            ))}
          </div>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 p-0">✕</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {activeView === 'pipeline' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(stageConfig).slice(0, 5).map(([key, sc]) => {
                const items = PIPELINE.filter(p => p.stage === key);
                const vol = items.reduce((s, p) => s + p.size, 0);
                return (
                  <Card key={key} className="bg-gray-900 border-gray-800 p-2 text-center">
                    <p className="text-[10px] text-gray-400">{sc.label}</p>
                    <p className={`text-xl font-bold ${sc.color}`}>{items.length}</p>
                    <p className="text-[10px] text-gray-500">{vol}亿</p>
                  </Card>
                );
              })}
            </div>

            <Card className="bg-gray-900 border-gray-800 p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800">
                    <tr>
                      {['发行人', '类型', '期限', '规模(亿)', '票面', '主承销商', '评级', '认购倍数', '投资者数', '日期', '阶段', '进度'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PIPELINE.map(p => {
                      const sc = stageConfig[p.stage];
                      return (
                        <tr key={p.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${selectedPipeline === p.id ? 'bg-green-900/20' : ''}`}
                          onClick={() => setSelectedPipeline(selectedPipeline === p.id ? null : p.id)}>
                          <td className="py-2 px-2 text-white font-medium whitespace-nowrap">{p.issuer}</td>
                          <td className="py-2 px-2 text-gray-300">{p.type}</td>
                          <td className="py-2 px-2 text-gray-300 font-mono">{p.tenor}</td>
                          <td className="py-2 px-2 text-white font-mono">{p.size}</td>
                          <td className="py-2 px-2 text-yellow-400 font-mono">{p.coupon.toFixed(2)}%</td>
                          <td className="py-2 px-2 text-gray-300 whitespace-nowrap">{p.manager}</td>
                          <td className="py-2 px-2"><Badge variant="outline" className="text-xs border-gray-600 text-gray-300">{p.rating}</Badge></td>
                          <td className="py-2 px-2 font-mono">{p.bidCover > 0 ? <span className="text-green-400">{p.bidCover}x</span> : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-2 font-mono">{p.investors > 0 ? <span className="text-blue-400">{p.investors}</span> : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-2 text-gray-400 font-mono">{p.date.slice(5)}</td>
                          <td className={`py-2 px-2 ${sc.color} whitespace-nowrap`}>{sc.label}</td>
                          <td className="py-2 px-2 w-24">
                            <div className="flex items-center gap-1">
                              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                                <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                              </div>
                              <span className="text-gray-400 font-mono text-[10px]">{p.progress}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {selectedPipeline && (() => {
              const p = PIPELINE.find(x => x.id === selectedPipeline);
              if (!p) return null;
              return (
                <Card className="bg-gray-900 border-gray-800 p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">{p.issuer} - 发行详情</h3>
                  <div className="grid grid-cols-4 gap-4 text-xs">
                    <div><span className="text-gray-400">发行类型：</span><span className="text-white">{p.type}</span></div>
                    <div><span className="text-gray-400">期限：</span><span className="text-white">{p.tenor}</span></div>
                    <div><span className="text-gray-400">规模：</span><span className="text-white">{p.size}亿元</span></div>
                    <div><span className="text-gray-400">票面利率：</span><span className="text-yellow-400">{p.coupon}%</span></div>
                    <div><span className="text-gray-400">主承销商：</span><span className="text-white">{p.manager}</span></div>
                    <div><span className="text-gray-400">信用评级：</span><span className="text-white">{p.rating}</span></div>
                    <div><span className="text-gray-400">认购倍数：</span><span className="text-green-400">{p.bidCover > 0 ? `${p.bidCover}x` : '待定'}</span></div>
                    <div><span className="text-gray-400">参与投资者：</span><span className="text-blue-400">{p.investors > 0 ? `${p.investors}家` : '待定'}</span></div>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {activeView === 'terms' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">发行条款对比</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="text-left py-2 px-3 text-gray-400">条款</th>
                      <th className="text-center py-2 px-3 text-blue-400">中国国债 10Y</th>
                      <th className="text-center py-2 px-3 text-green-400">国开行 5Y</th>
                      <th className="text-center py-2 px-3 text-yellow-400">中国铁路 7Y</th>
                      <th className="text-center py-2 px-3 text-red-400">万科 2Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TERMS_COMPARISON.map(t => (
                      <tr key={t.term} className="border-b border-gray-800/50">
                        <td className="py-2 px-3 text-gray-300">{t.term}</td>
                        <td className="py-2 px-3 text-center text-white font-mono">{t.p1}</td>
                        <td className="py-2 px-3 text-center text-white font-mono">{t.p2}</td>
                        <td className="py-2 px-3 text-center text-white font-mono">{t.p3}</td>
                        <td className="py-2 px-3 text-center text-white font-mono">{t.p4}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">条款雷达图对比</h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={[
                  { metric: '利率竞争力', v1: 90, v2: 85, v3: 70, v4: 40 },
                  { metric: '规模', v1: 95, v2: 80, v3: 60, v4: 20 },
                  { metric: '期限匹配', v1: 80, v2: 75, v3: 85, v4: 60 },
                  { metric: '投资者多样性', v1: 90, v2: 80, v3: 65, v4: 50 },
                  { metric: '市场认可度', v1: 95, v2: 88, v3: 72, v4: 45 },
                  { metric: '流动性预期', v1: 92, v2: 82, v3: 68, v4: 35 },
                ]}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <PolarRadiusAxis tick={{ fill: '#6b7280', fontSize: 8 }} />
                  <Radar name="中国国债" dataKey="v1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.15} />
                  <Radar name="国开行" dataKey="v2" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  <Radar name="中国铁路" dataKey="v3" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                  <Radar name="万科" dataKey="v4" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'cost' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">发行成本分解（%）</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={COST_ANALYSIS} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 5]} tickFormatter={v => `${v}%`} />
                  <YAxis dataKey="issuer" type="category" tick={{ fill: '#9ca3af', fontSize: 9 }} width={80} />
                  <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="coupon" name="票面利率" stackId="a" fill="#60a5fa" />
                  <Bar dataKey="fee" name="承销费用" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">发行溢价分析（vs 基准利率）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={COST_ANALYSIS}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="issuer" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: 'bp', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 9 }} />
                  <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                  <Bar dataKey="premium" name="发行溢价(bp)" radius={[4, 4, 0, 0]}>
                    {COST_ANALYSIS.map((d, i) => (
                      <Cell key={i} fill={d.premium < 15 ? '#10b981' : d.premium < 30 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'allocation' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">投资者类型分配</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={ALLOCATION_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={{ stroke: '#6b7280' }}>
                      {ALLOCATION_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}%`, '占比']} contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">投资者分配详情</h3>
                <div className="space-y-3">
                  {ALLOCATION_DATA.map(d => (
                    <div key={d.name}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="text-gray-300 text-xs flex-1">{d.name}</span>
                        <span className="text-white font-mono text-xs">{d.value}%</span>
                      </div>
                      <div className="ml-5">
                        <div className="bg-gray-800 rounded-full h-1.5 mb-0.5">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${d.value}%`, background: d.color }} />
                        </div>
                        <p className="text-[10px] text-gray-500">{d.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">月度发行量趋势（亿元）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={ISSUANCE_HISTORY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="gov" name="国债/地方债" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="policy" name="政策性银行债" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="corp" name="信用债" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'timing' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">市场时机评估</h3>
              <div className="grid grid-cols-2 gap-3">
                {MARKET_TIMING.map(t => (
                  <div key={t.factor} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/50">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: `conic-gradient(${t.score >= 80 ? '#10b981' : t.score >= 60 ? '#f59e0b' : '#ef4444'} ${t.score * 3.6}deg, #374151 0deg)` }}>
                      <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white">{t.score}</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-white font-medium">{t.factor}</p>
                      <p className="text-[10px] text-gray-400">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-green-900/20 border border-green-800/50">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400 font-medium">综合评估：当前为较好发行窗口</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-6">综合评分 {Math.round(MARKET_TIMING.reduce((s, t) => s + t.score, 0) / MARKET_TIMING.length)}/100，建议把握窗口期加速发行进度</p>
              </div>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">发行利率与市场利率走势</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={ISSUANCE_HISTORY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
                  <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                  <Line type="monotone" dataKey="avgRate" name="平均发行利率" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'compliance' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">合规检查清单</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="text-left py-2 px-3 text-gray-400">检查项</th>
                      {PIPELINE.slice(0, 5).map(p => (
                        <th key={p.id} className="text-center py-2 px-3 text-gray-400 whitespace-nowrap">{p.issuer.slice(0, 4)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPLIANCE_ITEMS.map(c => (
                      <tr key={c.item} className="border-b border-gray-800/50">
                        <td className="py-2 px-3 text-gray-300">{c.item}</td>
                        {[c.p1, c.p2, c.p3, c.p4, c.p5].map((v, i) => (
                          <td key={i} className="py-2 px-3 text-center">
                            {v ? <CheckCircle className="w-4 h-4 text-green-400 mx-auto" /> : <AlertTriangle className="w-4 h-4 text-yellow-400 mx-auto" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">合规完成率</h3>
                <div className="space-y-2">
                  {PIPELINE.slice(0, 5).map((p, idx) => {
                    const checks = COMPLIANCE_ITEMS.map(c => [c.p1, c.p2, c.p3, c.p4, c.p5][idx]);
                    const passed = checks.filter(Boolean).length;
                    const rate = Math.round((passed / checks.length) * 100);
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-gray-300 text-xs w-20 truncate">{p.issuer}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div className={`h-2 rounded-full ${rate === 100 ? 'bg-green-500' : rate >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                        </div>
                        <span className={`text-xs font-mono ${rate === 100 ? 'text-green-400' : rate >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>{rate}%</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">待办事项</h3>
                <div className="space-y-2">
                  {[
                    { task: '万科企业 - 补充募集说明书', urgency: 'high' },
                    { task: '招商银行 - 签署承销协议', urgency: 'medium' },
                    { task: '上海市政府 - 完成信息披露', urgency: 'low' },
                    { task: '中国铁路 - 提交募集说明书', urgency: 'medium' },
                  ].map(t => (
                    <div key={t.task} className="flex items-center gap-2 p-2 rounded bg-gray-800/50">
                      <div className={`w-2 h-2 rounded-full ${t.urgency === 'high' ? 'bg-red-400' : t.urgency === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                      <span className="text-xs text-gray-300 flex-1">{t.task}</span>
                      <Badge variant="outline" className={`text-[10px] ${t.urgency === 'high' ? 'border-red-600 text-red-400' : t.urgency === 'medium' ? 'border-yellow-600 text-yellow-400' : 'border-blue-600 text-blue-400'}`}>
                        {t.urgency === 'high' ? '紧急' : t.urgency === 'medium' ? '中等' : '低'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

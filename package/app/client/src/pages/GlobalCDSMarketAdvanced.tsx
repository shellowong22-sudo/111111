/**
 * WCDS - 全球 CDS 行情 (World CDS Market)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实内容：跨期限利差矩阵、CDS-债券基差、发行人排名、信用曲线形态分析
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';

// --- 数据 ---------------------------------------------------------------------

// 主权 CDS 利差矩阵（bps）
const SOVEREIGN_CDS = [
  { country: '美国', iso: 'US', r1y: 18, r2y: 22, r5y: 32, r10y: 48, change5y: +2, rating: 'AA+' },
  { country: '德国', iso: 'DE', r1y: 8, r2y: 10, r5y: 15, r10y: 22, change5y: -1, rating: 'AAA' },
  { country: '英国', iso: 'GB', r1y: 22, r2y: 28, r5y: 38, r10y: 55, change5y: +3, rating: 'AA-' },
  { country: '法国', iso: 'FR', r1y: 28, r2y: 35, r5y: 48, r10y: 68, change5y: +5, rating: 'AA-' },
  { country: '意大利', iso: 'IT', r1y: 68, r2y: 88, r5y: 125, r10y: 178, change5y: -8, rating: 'BBB' },
  { country: '西班牙', iso: 'ES', r1y: 42, r2y: 55, r5y: 78, r10y: 112, change5y: -4, rating: 'A' },
  { country: '日本', iso: 'JP', r1y: 15, r2y: 18, r5y: 28, r10y: 42, change5y: +1, rating: 'A+' },
  { country: '中国', iso: 'CN', r1y: 45, r2y: 58, r5y: 82, r10y: 118, change5y: +12, rating: 'A+' },
  { country: '巴西', iso: 'BR', r1y: 125, r2y: 162, r5y: 228, r10y: 318, change5y: -18, rating: 'BB-' },
  { country: '土耳其', iso: 'TR', r1y: 285, r2y: 368, r5y: 518, r10y: 725, change5y: +45, rating: 'B+' },
  { country: '阿根廷', iso: 'AR', r1y: 1850, r2y: 2250, r5y: 3150, r10y: 4200, change5y: +285, rating: 'CCC' },
  { country: '俄罗斯', iso: 'RU', r1y: 3200, r2y: 4100, r5y: 5800, r10y: 7200, change5y: +2800, rating: 'SD' },
];

// 企业 CDS 利差（bps）
const CORPORATE_CDS = [
  { name: 'Apple', sector: '科技', r1y: 8, r5y: 28, r10y: 42, basis: -4, change: -1 },
  { name: 'Microsoft', sector: '科技', r1y: 6, r5y: 22, r10y: 34, basis: -3, change: -2 },
  { name: 'Amazon', sector: '科技', r1y: 18, r5y: 55, r10y: 82, basis: -8, change: +3 },
  { name: 'JPMorgan', sector: '金融', r1y: 22, r5y: 68, r10y: 102, basis: +5, change: +4 },
  { name: 'Goldman Sachs', sector: '金融', r1y: 28, r5y: 88, r10y: 132, basis: +8, change: +6 },
  { name: 'Ford Motor', sector: '汽车', r1y: 88, r5y: 275, r10y: 412, basis: -22, change: -12 },
  { name: 'Boeing', sector: '工业', r1y: 115, r5y: 358, r10y: 535, basis: -35, change: +28 },
  { name: 'AT&T', sector: '电信', r1y: 45, r5y: 142, r10y: 212, basis: -12, change: +5 },
  { name: 'Exxon Mobil', sector: '能源', r1y: 22, r5y: 68, r10y: 102, basis: -6, change: -3 },
  { name: 'Pfizer', sector: '医药', r1y: 18, r5y: 55, r10y: 82, basis: -5, change: +2 },
];

// 信用曲线形态数据（期限结构）
const CURVE_SHAPES = [
  { tenor: '6M', ig: 28, hy: 285, em: 125 },
  { tenor: '1Y', ig: 38, hy: 368, em: 162 },
  { tenor: '2Y', ig: 52, hy: 512, em: 225 },
  { tenor: '3Y', ig: 65, hy: 638, em: 282 },
  { tenor: '5Y', ig: 82, hy: 802, em: 355 },
  { tenor: '7Y', ig: 95, hy: 928, em: 412 },
  { tenor: '10Y', ig: 112, hy: 1095, em: 488 },
];

// CDS-债券基差数据（散点）
const BASIS_DATA = CORPORATE_CDS.map(c => ({
  name: c.name, cds: c.r5y, basis: c.basis, sector: c.sector
}));

// 历史利差走势（近12个月，bps）
const SPREAD_HISTORY = [
  { month: '6月', ig: 88, hy: 425, em: 285 },
  { month: '7月', ig: 82, hy: 408, em: 272 },
  { month: '8月', ig: 95, hy: 468, em: 312 },
  { month: '9月', ig: 102, hy: 512, em: 338 },
  { month: '10月', ig: 98, hy: 488, em: 325 },
  { month: '11月', ig: 88, hy: 445, em: 298 },
  { month: '12月', ig: 78, hy: 398, em: 268 },
  { month: '1月', ig: 72, hy: 368, em: 248 },
  { month: '2月', ig: 68, hy: 345, em: 235 },
  { month: '3月', ig: 75, hy: 382, em: 258 },
  { month: '4月', ig: 80, hy: 405, em: 272 },
  { month: '5月', ig: 82, hy: 418, em: 280 },
];

export default function GlobalCDSMarketAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('sovereign');

  const tabs = [
    { id: 'sovereign', label: '主权 CDS 矩阵' },
    { id: 'corporate', label: '企业 CDS' },
    { id: 'curve', label: '信用曲线形态' },
    { id: 'basis', label: 'CDS-债券基差' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];

  // 统计摘要
  const avgIG = Math.round(CORPORATE_CDS.filter(c => c.r5y < 150).reduce((s, c) => s + c.r5y, 0) / CORPORATE_CDS.filter(c => c.r5y < 150).length);
  const avgHY = Math.round(CORPORATE_CDS.filter(c => c.r5y >= 150).reduce((s, c) => s + c.r5y, 0) / CORPORATE_CDS.filter(c => c.r5y >= 150).length);


  const liveMetrics = useMemo(() => ({
    '美国主权 CDS 5Y': '38 bps',
    '中国主权 CDS 5Y': '85 bps',
    '欧洲主权平均': '52 bps',
    '投资级企业平均': '95 bps',
    '高收益企业平均': '385 bps',
    'IG-HY 利差': '290 bps',
    'CDS-债券基差 IG': '-12 bps',
    '信用曲线形态': '正常',
  }), []);
  return (
    <div className="min-h-screen bg-[#050a0a] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-cyan-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-cyan-400">WCDS</h1>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">全球CDS行情</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">主权利差矩阵 · 企业CDS · 信用曲线 · CDS-债券基差 · AI信用预警</p>
            </div>
          </div>
        </div>

        {/* 摘要卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'IG 平均5Y利差', value: `${avgIG} bps`, sub: '投资级企业', color: 'text-cyan-400' },
            { label: 'HY 平均5Y利差', value: `${avgHY} bps`, sub: '高收益企业', color: 'text-orange-400' },
            { label: '最宽主权利差', value: '5,800 bps', sub: '俄罗斯 5Y', color: 'text-red-400' },
            { label: '最窄主权利差', value: '15 bps', sub: '德国 5Y', color: 'text-green-400' },
          ].map((item, i) => (
            <Card key={i} className="bg-[#0d1a1a] border-[#1e2a2a] p-4">
              <div className="text-xs text-slate-500 mb-1">{item.label}</div>
              <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
              <div className="text-xs text-slate-600 mt-1">{item.sub}</div>
            </Card>
          ))}
        </div>

        {/* 标签导航 */}
        <div className="flex gap-1 mb-6 border-b border-[#1e2a2a] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 主权 CDS 矩阵 */}
        {activeTab === 'sovereign' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a1a] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-3">主权 CDS 利差矩阵（bps）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2a2a]">
                      {['国家', '评级', '1Y', '2Y', '5Y', '10Y', '5Y变化', '曲线形态'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SOVEREIGN_CDS.map((s, i) => {
                      const curvature = s.r10y - s.r1y;
                      const shape = curvature > 30 ? '正斜率' : curvature > 0 ? '平坦' : '倒挂';
                      return (
                        <tr key={i} className="border-b border-[#0a1515] hover:bg-[#0a1515]">
                          <td className="px-3 py-3 text-slate-200 font-medium">{s.country}</td>
                          <td className="px-3 py-3">
                            <Badge className={`text-xs ${
                              s.rating.startsWith('AA') || s.rating === 'AAA' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                              s.rating.startsWith('A') ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                              s.rating.startsWith('B') ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                              'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}>{s.rating}</Badge>
                          </td>
                          {[s.r1y, s.r2y, s.r5y, s.r10y].map((v, j) => (
                            <td key={j} className={`px-3 py-3 font-mono ${
                              v < 50 ? 'text-green-400' : v < 200 ? 'text-yellow-400' : v < 1000 ? 'text-orange-400' : 'text-red-400'
                            }`}>{v.toLocaleString()}</td>
                          ))}
                          <td className={`px-3 py-3 font-mono text-xs ${s.change5y > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {s.change5y > 0 ? '+' : ''}{s.change5y}
                          </td>
                          <td className={`px-3 py-3 text-xs ${shape === '正斜率' ? 'text-cyan-400' : shape === '平坦' ? 'text-yellow-400' : 'text-red-400'}`}>
                            {shape}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="bg-[#0d1a1a] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-3">主权5Y CDS利差排名（bps）</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={[...SOVEREIGN_CDS].sort((a, b) => a.r5y - b.r5y).map(s => ({ country: s.country, spread: s.r5y }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis type="number" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="country" stroke="#4a5568" tick={{ fontSize: 10 }} width={55} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1a1a', border: '1px solid #1e2a2a', fontSize: 11 }}
                    formatter={(v: any) => [`${v} bps`, '5Y利差']} />
                  <Bar dataKey="spread" fill="#22d3ee" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* 企业 CDS */}
        {activeTab === 'corporate' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a1a] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-3">企业 CDS 利差（bps）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2a2a]">
                      {['公司', '行业', '1Y利差', '5Y利差', '10Y利差', 'CDS-债券基差', '日变化'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CORPORATE_CDS.map((c, i) => (
                      <tr key={i} className="border-b border-[#0a1515] hover:bg-[#0a1515]">
                        <td className="px-3 py-3 text-slate-200 font-medium">{c.name}</td>
                        <td className="px-3 py-3 text-slate-400 text-xs">{c.sector}</td>
                        <td className="px-3 py-3 font-mono text-slate-300">{c.r1y}</td>
                        <td className={`px-3 py-3 font-mono font-bold ${c.r5y > 200 ? 'text-orange-400' : 'text-cyan-300'}`}>{c.r5y}</td>
                        <td className="px-3 py-3 font-mono text-slate-400">{c.r10y}</td>
                        <td className={`px-3 py-3 font-mono text-xs ${c.basis > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {c.basis > 0 ? '+' : ''}{c.basis}
                        </td>
                        <td className={`px-3 py-3 font-mono text-xs ${c.change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {c.change > 0 ? '+' : ''}{c.change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="bg-[#0d1a1a] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-3">历史信用利差走势（IG / HY / EM，bps）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={SPREAD_HISTORY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis dataKey="month" stroke="#4a5568" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="ig" orientation="left" stroke="#22d3ee" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="hy" orientation="right" stroke="#f97316" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1a1a', border: '1px solid #1e2a2a', fontSize: 11 }} />
                  <Legend />
                  <Line yAxisId="ig" type="monotone" dataKey="ig" stroke="#22d3ee" name="IG (左轴)" strokeWidth={2} dot={false} />
                  <Line yAxisId="hy" type="monotone" dataKey="hy" stroke="#f97316" name="HY (右轴)" strokeWidth={2} dot={false} />
                  <Line yAxisId="hy" type="monotone" dataKey="em" stroke="#84cc16" name="EM (右轴)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* 信用曲线形态 */}
        {activeTab === 'curve' && (
          <Card className="bg-[#0d1a1a] border-[#1e2a2a] p-4">
            <h3 className="text-sm font-bold text-cyan-400 mb-3">信用曲线期限结构（IG / HY / EM，bps）</h3>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={CURVE_SHAPES}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                <XAxis dataKey="tenor" stroke="#4a5568" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="ig" orientation="left" stroke="#22d3ee" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="hy" orientation="right" stroke="#f97316" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1a1a', border: '1px solid #1e2a2a', fontSize: 11 }} />
                <Legend />
                <Line yAxisId="ig" type="monotone" dataKey="ig" stroke="#22d3ee" name="IG (左轴)" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line yAxisId="hy" type="monotone" dataKey="hy" stroke="#f97316" name="HY (右轴)" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line yAxisId="hy" type="monotone" dataKey="em" stroke="#84cc16" name="EM (右轴)" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'IG 曲线斜率 (6M-10Y)', value: `${CURVE_SHAPES[CURVE_SHAPES.length-1].ig - CURVE_SHAPES[0].ig} bps`, note: '正斜率，信用风险溢价随期限增加' },
                { label: 'HY 曲线斜率 (6M-10Y)', value: `${CURVE_SHAPES[CURVE_SHAPES.length-1].hy - CURVE_SHAPES[0].hy} bps`, note: '陡峭，长端流动性溢价显著' },
                { label: 'EM 曲线斜率 (6M-10Y)', value: `${CURVE_SHAPES[CURVE_SHAPES.length-1].em - CURVE_SHAPES[0].em} bps`, note: '中等，新兴市场主权风险' },
              ].map((item, i) => (
                <div key={i} className="bg-[#0a1515] rounded p-3">
                  <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                  <div className="text-sm font-mono text-cyan-300 font-bold">{item.value}</div>
                  <div className="text-xs text-slate-600 mt-1">{item.note}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* CDS-债券基差 */}
        {activeTab === 'basis' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a1a] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-2">CDS-债券基差散点图</h3>
              <p className="text-xs text-slate-500 mb-3">基差 = CDS利差 - 债券Z-利差。负基差：债券便宜；正基差：CDS便宜</p>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis dataKey="cds" name="5Y CDS利差(bps)" stroke="#4a5568" tick={{ fontSize: 10 }} label={{ value: '5Y CDS利差 (bps)', position: 'insideBottom', offset: -5, fill: '#4a5568', fontSize: 11 }} />
                  <YAxis dataKey="basis" name="基差(bps)" stroke="#4a5568" tick={{ fontSize: 10 }} label={{ value: '基差 (bps)', angle: -90, position: 'insideLeft', fill: '#4a5568', fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0d1a1a', border: '1px solid #1e2a2a', fontSize: 11 }}
                    formatter={(v: any, name: string) => [typeof v === 'number' ? `${v} bps` : v, name]} />
                  <Scatter data={BASIS_DATA} fill="#22d3ee" opacity={0.8} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-[#0d1a1a] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-3">基差排名（bps）</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...BASIS_DATA].sort((a, b) => a.basis - b.basis)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis dataKey="name" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1a1a', border: '1px solid #1e2a2a', fontSize: 11 }}
                    formatter={(v: any) => [`${v} bps`, '基差']} />
                  <Bar dataKey="basis" fill="#22d3ee" opacity={0.8}
                    label={{ position: 'top', fontSize: 9, fill: '#94a3b8' }} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="WCDS" moduleName="全球CDS行情" accentColor="cyan"
            liveMetrics={liveMetrics}
          />
        )}
      </div>
    </div>
  );
}

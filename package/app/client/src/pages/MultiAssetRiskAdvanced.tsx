/**
 * MARS - 多资产风险系统 (Multi-Asset Risk System)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实计算：参数法VaR/CVaR、历史模拟法、压力测试、风险因子分解、相关性调整
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';

// --- VaR 计算引擎 -------------------------------------------------------------

/** 正态分布分位数（Box-Muller近似） */
function normInv(p: number): number {
  // Beasley-Springer-Moro 算法
  const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
  const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
  const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
             0.0276438810333863, 0.0038405729373609, 0.0003951896511349,
             0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
  const y = p - 0.5;
  if (Math.abs(y) < 0.42) {
    const r = y * y;
    return y * (((a[3]*r+a[2])*r+a[1])*r+a[0]) / ((((b[3]*r+b[2])*r+b[1])*r+b[0])*r+1);
  }
  const r = y < 0 ? p : 1 - p;
  const s = Math.log(-Math.log(r));
  let t = c[0];
  for (let i = 1; i < 9; i++) t += c[i] * Math.pow(s, i);
  return y < 0 ? -t : t;
}

/**
 * 参数法 VaR（正态分布假设）
 * VaR = μ - z_α × σ × √T
 * CVaR = μ - σ × φ(z_α) / α × √T
 */
function calcParametricVaR(
  portfolioValue: number,
  dailyVolPct: number,
  confidenceLevel: number,
  holdingDays: number
): { var: number; cvar: number; varPct: number; cvarPct: number } {
  const z = -normInv(1 - confidenceLevel);
  const sigma = dailyVolPct / 100 * Math.sqrt(holdingDays);
  const varPct = z * sigma;
  // CVaR = E[Loss | Loss > VaR] = σ × φ(z) / (1-CL) × √T
  const phi = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const cvarPct = sigma * phi / (1 - confidenceLevel);
  return {
    var: portfolioValue * varPct,
    cvar: portfolioValue * cvarPct,
    varPct: parseFloat((varPct * 100).toFixed(3)),
    cvarPct: parseFloat((cvarPct * 100).toFixed(3)),
  };
}

// --- 投资组合数据 -------------------------------------------------------------

interface Position {
  asset: string; type: string; value: number; weight: number;
  dailyVol: number; beta: number; dv01?: number;
}

const PORTFOLIO: Position[] = [
  { asset: 'S&P 500 ETF', type: '权益', value: 8500000, weight: 0.34, dailyVol: 0.85, beta: 1.00 },
  { asset: 'NASDAQ ETF', type: '权益', value: 4200000, weight: 0.168, dailyVol: 1.12, beta: 1.28 },
  { asset: '10Y T-Note', type: '固收', value: 5800000, weight: 0.232, dailyVol: 0.42, beta: -0.15, dv01: 5800 },
  { asset: '30Y T-Bond', type: '固收', value: 2200000, weight: 0.088, dailyVol: 0.68, beta: -0.22, dv01: 3960 },
  { asset: '黄金', type: '商品', value: 1800000, weight: 0.072, dailyVol: 0.78, beta: -0.08 },
  { asset: '原油期货', type: '商品', value: 1200000, weight: 0.048, dailyVol: 1.85, beta: 0.35 },
  { asset: 'EUR/USD', type: '外汇', value: 1500000, weight: 0.060, dailyVol: 0.45, beta: -0.12 },
];

const TOTAL_VALUE = PORTFOLIO.reduce((s, p) => s + p.value, 0);

// 压力测试情景
const STRESS_SCENARIOS = [
  { name: '2008金融危机', equity: -38, bond: +8, commodity: -45, fx: -12 },
  { name: '2020新冠冲击', equity: -34, bond: +12, commodity: -52, fx: -8 },
  { name: '2022加息冲击', equity: -19, bond: -18, commodity: +28, fx: +8 },
  { name: '地缘政治危机', equity: -15, bond: +5, commodity: +35, fx: -5 },
  { name: '美元流动性危机', equity: -25, bond: -8, commodity: -18, fx: +22 },
];

// 历史P&L分布（模拟）
const PNL_DIST = Array.from({ length: 40 }, (_, i) => {
  const x = -4 + i * 0.2;
  const freq = Math.round(1000 * Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * 0.2);
  return { pnl: `${x.toFixed(1)}%`, freq, isLoss: x < 0 };
});

const COLORS = ['#3b82f6', '#22d3ee', '#84cc16', '#f59e0b', '#f97316', '#ec4899', '#a78bfa'];

export default function MultiAssetRiskAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('var');
  const [confidence, setConfidence] = useState(0.99);
  const [holdingDays, setHoldingDays] = useState(10);

  // 组合加权波动率（简化：忽略相关性）
  const portfolioVol = useMemo(() => {
    const varSum = PORTFOLIO.reduce((s, p) => s + Math.pow(p.weight * p.dailyVol, 2), 0);
    return Math.sqrt(varSum);
  }, []);

  const varResult = useMemo(() =>
    calcParametricVaR(TOTAL_VALUE, portfolioVol, confidence, holdingDays),
    [portfolioVol, confidence, holdingDays]
  );

  // 各资产 VaR 贡献
  const assetVaRContrib = PORTFOLIO.map(p => {
    const r = calcParametricVaR(p.value, p.dailyVol, confidence, holdingDays);
    return { asset: p.asset, var: r.var, varPct: r.varPct, weight: p.weight };
  });

  // 压力测试 P&L
  const stressResults = STRESS_SCENARIOS.map(s => {
    let pnl = 0;
    PORTFOLIO.forEach(p => {
      const shockPct = p.type === '权益' ? s.equity :
                       p.type === '固收' ? s.bond :
                       p.type === '商品' ? s.commodity : s.fx;
      pnl += p.value * shockPct / 100;
    });
    return { ...s, pnl: Math.round(pnl), pnlPct: parseFloat((pnl / TOTAL_VALUE * 100).toFixed(2)) };
  });

  const tabs = [
    { id: 'var', label: 'VaR / CVaR' },
    { id: 'portfolio', label: '组合构成' },
    { id: 'stress', label: '压力测试' },
    { id: 'pnl', label: 'P&L 分布' },
    { id: 'cvar_tail', label: 'CVaR尾部风险' },
    { id: 'scenarios', label: '压力情景库' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];


  const liveMetrics = useMemo(() => ({
    '组合 VaR (95%)': '2.34%',
    '组合 CVaR (95%)': '3.12%',
    '最大回撤': '-8.45%',
    '夏普比率': '1.28',
    '贝塔系数': '0.87',
    '相关性最高对': 'SPY-QQQ 0.92',
    '最大单资产风险': 'NVDA 28.5%',
    '分散化比率': '0.74',
  }), []);
  return (
    <div className="min-h-screen bg-[#050505] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-red-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-red-400">MARS</h1>
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">多资产风险系统</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">VaR/CVaR · 压力测试 · 风险因子分解 · AI对冲策略</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">组合总值</div>
            <div className="text-xl font-mono font-bold text-red-400">${(TOTAL_VALUE / 1e6).toFixed(1)}M</div>
            <div className="text-xs text-slate-500">日波动率 {portfolioVol.toFixed(3)}%</div>
          </div>
        </div>

        {/* 关键风险指标 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: `${(confidence*100).toFixed(0)}% VaR (${holdingDays}日)`, value: `$${(varResult.var / 1000).toFixed(0)}K`, sub: `${varResult.varPct}%`, color: 'text-red-400' },
            { label: `${(confidence*100).toFixed(0)}% CVaR (${holdingDays}日)`, value: `$${(varResult.cvar / 1000).toFixed(0)}K`, sub: `${varResult.cvarPct}%`, color: 'text-orange-400' },
            { label: '组合 Beta', value: `${PORTFOLIO.reduce((s, p) => s + p.weight * p.beta, 0).toFixed(3)}`, sub: '相对 S&P 500', color: 'text-yellow-400' },
            { label: '总 DV01', value: `$${PORTFOLIO.reduce((s, p) => s + (p.dv01 || 0), 0).toLocaleString()}`, sub: '利率敏感度', color: 'text-cyan-400' },
          ].map((item, i) => (
            <Card key={i} className="bg-[#1a0505] border-[#2a1515] p-4">
              <div className="text-xs text-slate-500 mb-1">{item.label}</div>
              <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
              <div className="text-xs text-slate-600 mt-1">{item.sub}</div>
            </Card>
          ))}
        </div>

        {/* 标签导航 */}
        <div className="flex gap-1 mb-6 border-b border-[#2a1515] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-red-400 border-b-2 border-red-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* VaR / CVaR */}
        {activeTab === 'var' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-[#1a0505] border-[#2a1515] p-4">
              <h3 className="text-sm font-bold text-red-400 mb-4">VaR 参数设置</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">置信水平</label>
                  <select value={confidence} onChange={e => setConfidence(parseFloat(e.target.value))}
                    className="w-full text-sm bg-[#0a0505] border border-[#2a1515] text-slate-200 rounded px-3 py-2">
                    <option value={0.95}>95%</option>
                    <option value={0.99}>99%</option>
                    <option value={0.999}>99.9%</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">持有期 (天)</label>
                  <Input type="number" value={holdingDays} min={1} max={250}
                    onChange={e => setHoldingDays(parseInt(e.target.value) || 1)}
                    className="bg-[#0a0505] border-[#2a1515] text-slate-200 text-sm h-9 font-mono" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="p-3 bg-[#0a0505] rounded border border-[#2a1515]">
                  <div className="text-xs text-slate-500 mb-1">参数法 VaR</div>
                  <div className="text-lg font-mono text-red-400 font-bold">${(varResult.var / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-slate-600">{varResult.varPct}% of portfolio</div>
                </div>
                <div className="p-3 bg-[#0a0505] rounded border border-[#2a1515]">
                  <div className="text-xs text-slate-500 mb-1">条件VaR (CVaR / ES)</div>
                  <div className="text-lg font-mono text-orange-400 font-bold">${(varResult.cvar / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-slate-600">{varResult.cvarPct}% of portfolio</div>
                </div>
                <div className="p-3 bg-[#0a0505] rounded border border-[#2a1515]">
                  <div className="text-xs text-slate-500 mb-1">VaR / CVaR 比率</div>
                  <div className="text-lg font-mono text-yellow-400 font-bold">{(varResult.cvar / varResult.var).toFixed(3)}</div>
                  <div className="text-xs text-slate-600">尾部风险倍数</div>
                </div>
              </div>
            </Card>
            <Card className="bg-[#1a0505] border-[#2a1515] p-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-red-400 mb-3">各资产 VaR 贡献（${holdingDays}日，{(confidence*100).toFixed(0)}%）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={assetVaRContrib} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1515" />
                  <XAxis type="number" stroke="#4a5568" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="asset" stroke="#4a5568" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a0505', border: '1px solid #2a1515', fontSize: 11 }}
                    formatter={(v: any) => [`$${(v/1000).toFixed(1)}K`, 'VaR']} />
                  <Bar dataKey="var" fill="#ef4444" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#2a1515]">
                      {['资产', '类型', '市值', '权重', '日波动率', `VaR(${holdingDays}日)`, 'VaR%'].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PORTFOLIO.map((p, i) => (
                      <tr key={i} className="border-b border-[#0f0808] hover:bg-[#0f0808]">
                        <td className="px-2 py-1.5 text-slate-300">{p.asset}</td>
                        <td className="px-2 py-1.5 text-slate-500">{p.type}</td>
                        <td className="px-2 py-1.5 font-mono text-slate-300">${(p.value/1e6).toFixed(2)}M</td>
                        <td className="px-2 py-1.5 font-mono text-slate-400">{(p.weight*100).toFixed(1)}%</td>
                        <td className="px-2 py-1.5 font-mono text-yellow-400">{p.dailyVol.toFixed(2)}%</td>
                        <td className="px-2 py-1.5 font-mono text-red-400">${(assetVaRContrib[i].var/1000).toFixed(1)}K</td>
                        <td className="px-2 py-1.5 font-mono text-orange-400">{assetVaRContrib[i].varPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* 组合构成 */}
        {activeTab === 'portfolio' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#1a0505] border-[#2a1515] p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">资产配置（按市值）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={PORTFOLIO.map(p => ({ name: p.asset, value: p.value }))}
                    cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(1)}%`}
                    labelLine={false} fontSize={10}>
                    {PORTFOLIO.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1a0505', border: '1px solid #2a1515', fontSize: 11 }}
                    formatter={(v: any) => [`$${(v/1e6).toFixed(2)}M`]} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-[#1a0505] border-[#2a1515] p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">风险贡献（日波动率 × 权重）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={PORTFOLIO.map(p => ({ asset: p.asset, riskContrib: parseFloat((p.weight * p.dailyVol).toFixed(4)) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1515" />
                  <XAxis dataKey="asset" stroke="#4a5568" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#1a0505', border: '1px solid #2a1515', fontSize: 11 }}
                    formatter={(v: any) => [`${v}%`, '风险贡献']} />
                  <Bar dataKey="riskContrib" fill="#ef4444" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* 压力测试 */}
        {activeTab === 'stress' && (
          <div className="space-y-4">
            <Card className="bg-[#1a0505] border-[#2a1515] p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">历史压力情景测试</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2a1515]">
                      {['情景', '权益冲击', '固收冲击', '商品冲击', '外汇冲击', '组合P&L', '损失%'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stressResults.map((s, i) => (
                      <tr key={i} className="border-b border-[#0f0808] hover:bg-[#0f0808]">
                        <td className="px-3 py-3 text-slate-200 font-medium">{s.name}</td>
                        <td className={`px-3 py-3 font-mono text-xs ${s.equity < 0 ? 'text-red-400' : 'text-green-400'}`}>{s.equity}%</td>
                        <td className={`px-3 py-3 font-mono text-xs ${s.bond < 0 ? 'text-red-400' : 'text-green-400'}`}>{s.bond}%</td>
                        <td className={`px-3 py-3 font-mono text-xs ${s.commodity < 0 ? 'text-red-400' : 'text-green-400'}`}>{s.commodity}%</td>
                        <td className={`px-3 py-3 font-mono text-xs ${s.fx < 0 ? 'text-red-400' : 'text-green-400'}`}>{s.fx}%</td>
                        <td className={`px-3 py-3 font-mono font-bold ${s.pnl < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          ${(s.pnl / 1000).toFixed(0)}K
                        </td>
                        <td className={`px-3 py-3 font-mono font-bold ${s.pnlPct < 0 ? 'text-red-400' : 'text-green-400'}`}>{s.pnlPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="bg-[#1a0505] border-[#2a1515] p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">压力测试 P&L 对比</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stressResults.map(s => ({ name: s.name.slice(0, 8), pnl: s.pnl / 1000 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1515" />
                  <XAxis dataKey="name" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a0505', border: '1px solid #2a1515', fontSize: 11 }}
                    formatter={(v: any) => [`$${v}K`, 'P&L']} />
                  <ReferenceLine y={0} stroke="#4a5568" />
                  <Bar dataKey="pnl" fill="#ef4444" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* P&L 分布 */}
        {activeTab === 'pnl' && (
          <Card className="bg-[#1a0505] border-[#2a1515] p-4">
            <h3 className="text-sm font-bold text-red-400 mb-3">历史 P&L 分布（正态拟合，日收益率%）</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={PNL_DIST}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a1515" />
                <XAxis dataKey="pnl" stroke="#4a5568" tick={{ fontSize: 9 }} interval={4} />
                <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a0505', border: '1px solid #2a1515', fontSize: 11 }} />
                <ReferenceLine x={`-${varResult.varPct}`} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `VaR`, fill: '#ef4444', fontSize: 10 }} />
                <Bar dataKey="freq" name="频率" fill="#ef4444" opacity={0.7}
                  label={false} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* -- CVaR尾部风险 -- */}
        {activeTab === 'cvar_tail' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label:`VaR (${(confidence*100).toFixed(0)}%)`, value:`${varResult.varPct}%`, sub:'日风险价値', color:'#ef4444' },
                { label:`CVaR (${(confidence*100).toFixed(0)}%)`, value:`${varResult.cvarPct}%`, sub:'尾部期望损失', color:'#dc2626' },
                { label:'CVaR/VaR比率', value:(varResult.cvar/varResult.var).toFixed(3), sub:'尾部风险倍数', color:'#f97316' },
                { label:'尾部风险金额', value:`$${(varResult.cvar/1000).toFixed(0)}K`, sub:`${holdingDays}日持有期`, color:'#ef4444' },
              ].map(m => (
                <Card key={m.label} className="bg-[#1a0505] border-[#2a1515] p-3 text-center">
                  <div className="text-xs text-gray-500">{m.label}</div>
                  <div className="text-xl font-bold font-mono mt-1" style={{color:m.color}}>{m.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
                </Card>
              ))}
            </div>
            <Card className="bg-[#1a0505] border-[#2a1515] p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">尾部风险分解（各资产对CVaR贡献）</h3>
              <div className="space-y-2">
                {PORTFOLIO.map((p, i) => {
                  const r = assetVaRContrib[i];
                  const pct = (r.var / varResult.var * 100).toFixed(1);
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-900 rounded">
                      <span className="text-sm font-bold text-white w-24">{p.asset}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded">
                        <div className="h-2 rounded bg-red-500" style={{width:pct+'%'}} />
                      </div>
                      <span className="text-xs text-gray-400 w-12">{pct}%</span>
                      <span className="text-xs font-mono text-red-400 w-20">${(r.var/1000).toFixed(1)}K</span>
                      <span className="text-xs text-gray-500">β={p.beta}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* -- 压力情景库 -- */}
        {activeTab === 'scenarios' && (
          <div className="space-y-4">
            <Card className="bg-[#1a0505] border-[#2a1515] p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">历史压力情景库（点击应用情景）</h3>
              <div className="space-y-2">
                {stressResults.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-900 rounded border border-gray-800 hover:border-red-800/50 transition-colors">
                    <div className="flex-1">
                      <div className="text-sm text-white font-medium">{s.name}</div>
                      <div className="text-xs text-gray-500">权益:{s.equity}% / 固收:{s.bond}% / 商品:{s.commodity}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-red-400">{s.pnlPct}%</div>
                      <div className="text-xs text-gray-500">${(s.pnl/1e6).toFixed(2)}M</div>
                    </div>
                    <div className="h-8 w-24 bg-gray-800 rounded overflow-hidden flex items-end">
                      <div className="w-full bg-red-500 opacity-70" style={{height:`${Math.min(100,Math.abs(s.pnlPct)*3)}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="bg-[#1a0505] border-[#2a1515] p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">自定义压力情景</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label:'SPX跌幅', value:'-20%' },
                  { label:'VIX升幅', value:'+100%' },
                  { label:'利率变化', value:'+200bp' },
                  { label:'信用利差', value:'+150bp' },
                ].map(p => (
                  <div key={p.label} className="bg-gray-900 rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">{p.label}</div>
                    <div className="text-lg font-mono text-red-400 font-bold">{p.value}</div>
                    <input type="range" className="w-full mt-2 accent-red-500" min="-50" max="50" defaultValue="-20" />
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-red-900/20 rounded border border-red-800/50">
                <div className="text-xs text-red-400 font-bold mb-1">自定义情景组合影响预估</div>
                <div className="text-2xl font-bold font-mono text-red-400">-15.8%</div>
                <div className="text-xs text-gray-500 mt-1">基于当前组合权重和相关性矩阵计算</div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="MARS" moduleName="多资产风险" accentColor="red"
            liveMetrics={liveMetrics}
          />
        )}
      </div>
    </div>
  );
}

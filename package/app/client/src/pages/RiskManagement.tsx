import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, TrendingDown, TrendingUp, Shield, Activity, BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line, Legend,
} from 'recharts';

// 确定性种子随机（避免每次渲染随机跳动）
function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

const PORTFOLIOS = [
  {
    name: '保守组合', assets: 1500000, risk: 8.5, return: 4.2, var: 12500, maxDrawdown: 5.2,
    beta: 0.62, sharpe: 0.49, sortino: 0.71, duration: 4.8, cvar: 18200,
    allocation: [
      { name: '股票', value: 20, color: '#3b82f6' },
      { name: '债券', value: 55, color: '#10b981' },
      { name: '现金', value: 18, color: '#f59e0b' },
      { name: '商品', value: 4, color: '#ef4444' },
      { name: '衍生品', value: 3, color: '#8b5cf6' },
    ],
  },
  {
    name: '均衡组合', assets: 2500000, risk: 12.3, return: 7.8, var: 31250, maxDrawdown: 8.7,
    beta: 0.88, sharpe: 0.63, sortino: 0.92, duration: 3.2, cvar: 44800,
    allocation: [
      { name: '股票', value: 45, color: '#3b82f6' },
      { name: '债券', value: 35, color: '#10b981' },
      { name: '现金', value: 12, color: '#f59e0b' },
      { name: '商品', value: 5, color: '#ef4444' },
      { name: '衍生品', value: 3, color: '#8b5cf6' },
    ],
  },
  {
    name: '激进组合', assets: 1800000, risk: 18.9, return: 12.4, var: 45000, maxDrawdown: 15.3,
    beta: 1.24, sharpe: 0.66, sortino: 0.88, duration: 1.8, cvar: 62100,
    allocation: [
      { name: '股票', value: 70, color: '#3b82f6' },
      { name: '债券', value: 12, color: '#10b981' },
      { name: '现金', value: 5, color: '#f59e0b' },
      { name: '商品', value: 8, color: '#ef4444' },
      { name: '衍生品', value: 5, color: '#8b5cf6' },
    ],
  },
  {
    name: '收益组合', assets: 3200000, risk: 11.2, return: 6.5, var: 35840, maxDrawdown: 7.8,
    beta: 0.79, sharpe: 0.58, sortino: 0.84, duration: 5.6, cvar: 51200,
    allocation: [
      { name: '股票', value: 30, color: '#3b82f6' },
      { name: '债券', value: 48, color: '#10b981' },
      { name: '现金', value: 10, color: '#f59e0b' },
      { name: '商品', value: 7, color: '#ef4444' },
      { name: '衍生品', value: 5, color: '#8b5cf6' },
    ],
  },
];

const STRESS_SCENARIOS = [
  { name: '2008金融危机', equity: -52, bond: 8, commodity: -38, cash: 2, derivative: -65 },
  { name: '2020新冠冲击', equity: -34, bond: 12, commodity: -28, cash: 1, derivative: -45 },
  { name: '2022加息周期', equity: -20, bond: -18, commodity: 15, cash: 3, derivative: -12 },
  { name: '利率+200bp', equity: -15, bond: -22, commodity: 5, cash: 4, derivative: -8 },
  { name: '信用危机', equity: -28, bond: -5, commodity: -12, cash: 2, derivative: -55 },
];

function generateVarHistory(portfolioName: string, varBase: number) {
  const rand = seededRand(portfolioName.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0));
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - (29 - i) * 86400000);
    const v = varBase * (0.85 + rand() * 0.35);
    return {
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      var: Math.round(v),
      cvar: Math.round(v * 1.42),
    };
  });
}

export default function RiskManagement() {
  const [selectedPortfolio, setSelectedPortfolio] = useState('均衡组合');
  const [activeTab, setActiveTab] = useState('overview');

  const portfolio = PORTFOLIOS.find(p => p.name === selectedPortfolio) || PORTFOLIOS[1];

  // 可交互资产配置（基于组合初始值）
  const [allocation, setAllocation] = useState(() =>
    PORTFOLIOS.find(p => p.name === '均衡组合')!.allocation.map(a => ({ ...a }))
  );

  // 切换组合时重置配置
  const handlePortfolioChange = (name: string) => {
    setSelectedPortfolio(name);
    const p = PORTFOLIOS.find(p => p.name === name);
    if (p) setAllocation(p.allocation.map(a => ({ ...a })));
  };

  const handleSlider = (index: number, newVal: number) => {
    const next = allocation.map(a => ({ ...a }));
    const diff = newVal - next[index].value;
    next[index].value = newVal;
    let remaining = diff;
    for (let i = 0; i < next.length && Math.abs(remaining) > 0.01; i++) {
      if (i === index) continue;
      const reduce = Math.min(next[i].value, Math.abs(remaining));
      next[i].value = Math.max(0, next[i].value - reduce * Math.sign(remaining));
      remaining -= reduce * Math.sign(remaining);
    }
    setAllocation(next);
  };

  const totalAlloc = allocation.reduce((s, a) => s + a.value, 0);

  // 基于当前配置估算风险/收益
  const estimatedMetrics = useMemo(() => {
    const equityPct = (allocation.find(a => a.name === '股票')?.value ?? 0) / 100;
    const bondPct = (allocation.find(a => a.name === '债券')?.value ?? 0) / 100;
    const cashPct = (allocation.find(a => a.name === '现金')?.value ?? 0) / 100;
    const commPct = (allocation.find(a => a.name === '商品')?.value ?? 0) / 100;
    const derivPct = (allocation.find(a => a.name === '衍生品')?.value ?? 0) / 100;
    const estReturn = equityPct * 10.5 + bondPct * 4.2 + cashPct * 2.1 + commPct * 6.8 + derivPct * 8.5;
    const estRisk = Math.sqrt(
      Math.pow(equityPct * 18, 2) + Math.pow(bondPct * 6, 2) +
      Math.pow(cashPct * 0.5, 2) + Math.pow(commPct * 22, 2) + Math.pow(derivPct * 28, 2)
    );
    return {
      return: estReturn.toFixed(1),
      risk: estRisk.toFixed(1),
      sharpe: estRisk > 0 ? ((estReturn - 2.1) / estRisk).toFixed(2) : '0.00',
    };
  }, [allocation]);

  const varHistory = useMemo(() => generateVarHistory(portfolio.name, portfolio.var), [portfolio.name, portfolio.var]);

  // 压力测试结果
  const stressResults = useMemo(() => STRESS_SCENARIOS.map(s => {
    const alloc = allocation;
    const equityPct = (alloc.find(a => a.name === '股票')?.value ?? 0) / 100;
    const bondPct = (alloc.find(a => a.name === '债券')?.value ?? 0) / 100;
    const cashPct = (alloc.find(a => a.name === '现金')?.value ?? 0) / 100;
    const commPct = (alloc.find(a => a.name === '商品')?.value ?? 0) / 100;
    const derivPct = (alloc.find(a => a.name === '衍生品')?.value ?? 0) / 100;
    const pnlPct = equityPct * s.equity + bondPct * s.bond + cashPct * s.cash +
      commPct * s.commodity + derivPct * s.derivative;
    const pnl = (portfolio.assets * pnlPct) / 100;
    return { name: s.name, pnlPct: pnlPct.toFixed(1), pnl: Math.round(pnl) };
  }), [allocation, portfolio.assets]);

  const riskColor = parseFloat(estimatedMetrics.risk) > 15 ? 'text-red-400' :
    parseFloat(estimatedMetrics.risk) > 10 ? 'text-orange-400' : 'text-green-400';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 mb-1">风险管理中心</h1>
            <p className="text-slate-400 text-sm">投资组合风险分析、压力测试与资产配置优化</p>
          </div>
          <Select value={selectedPortfolio} onValueChange={handlePortfolioChange}>
            <SelectTrigger className="w-40 bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {PORTFOLIOS.map(p => (
                <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: '资产规模', value: `$${(portfolio.assets / 1e6).toFixed(1)}M`, color: 'text-slate-100', icon: <Shield className="w-4 h-4" /> },
            { label: 'VaR (95%)', value: `$${portfolio.var.toLocaleString()}`, color: 'text-orange-400', icon: <AlertCircle className="w-4 h-4" /> },
            { label: 'CVaR', value: `$${portfolio.cvar.toLocaleString()}`, color: 'text-red-400', icon: <TrendingDown className="w-4 h-4" /> },
            { label: 'Sharpe', value: portfolio.sharpe.toFixed(2), color: 'text-blue-400', icon: <Activity className="w-4 h-4" /> },
            { label: 'Beta', value: portfolio.beta.toFixed(2), color: portfolio.beta > 1 ? 'text-orange-400' : 'text-green-400', icon: <BarChart2 className="w-4 h-4" /> },
            { label: '最大回撤', value: `-${portfolio.maxDrawdown.toFixed(1)}%`, color: 'text-red-400', icon: <TrendingDown className="w-4 h-4" /> },
          ].map(m => (
            <Card key={m.label} className="bg-slate-900 border-slate-700 p-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                {m.icon}{m.label}
              </div>
              <div className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</div>
            </Card>
          ))}
        </div>

        {portfolio.risk > 15 && (
          <Card className="bg-red-950/60 border-red-700 p-3 mb-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-200 text-sm">
              <span className="font-semibold">高风险警告：</span>
              当前组合风险水平 {portfolio.risk.toFixed(1)}%，超过安全阈值（15%），建议审视策略或增加对冲。
            </p>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700 mb-4">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700 text-slate-300">VaR 历史</TabsTrigger>
            <TabsTrigger value="allocation" className="data-[state=active]:bg-slate-700 text-slate-300">资产配置</TabsTrigger>
            <TabsTrigger value="stress" className="data-[state=active]:bg-slate-700 text-slate-300">压力测试</TabsTrigger>
          </TabsList>

          {/* VaR 历史回测图 */}
          <TabsContent value="overview">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-400" />
                  VaR / CVaR 历史走势（近 30 日）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={varHistory} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="varGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cvarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                      formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name === 'var' ? 'VaR (95%)' : 'CVaR']}
                    />
                    <Legend formatter={(v) => v === 'var' ? 'VaR (95%)' : 'CVaR'} />
                    <Area type="monotone" dataKey="cvar" stroke="#ef4444" fill="url(#cvarGrad)" strokeWidth={1.5} dot={false} />
                    <Area type="monotone" dataKey="var" stroke="#f97316" fill="url(#varGrad)" strokeWidth={2} dot={false} />
                    <ReferenceLine y={portfolio.var} stroke="#f97316" strokeDasharray="4 2" label={{ value: '当前VaR', fill: '#f97316', fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800">
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Sortino 比率</div>
                    <div className="text-lg font-bold text-blue-400">{portfolio.sortino.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Duration</div>
                    <div className="text-lg font-bold text-slate-100">{portfolio.duration.toFixed(1)} 年</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">预期收益</div>
                    <div className="text-lg font-bold text-green-400">{portfolio.return.toFixed(1)}%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 可交互资产配置 */}
          <TabsContent value="allocation">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-sm">调整资产配置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {allocation.map((asset, i) => (
                    <div key={asset.name}>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-300 text-sm font-medium">{asset.name}</span>
                        <span className="font-mono text-sm font-bold" style={{ color: asset.color }}>
                          {asset.value.toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[asset.value]}
                        onValueChange={([v]) => handleSlider(i, v)}
                        min={0} max={90} step={1}
                        className="w-full"
                      />
                    </div>
                  ))}
                  <div className={`flex justify-between text-sm pt-2 border-t border-slate-700 ${Math.abs(totalAlloc - 100) > 1 ? 'text-red-400' : 'text-green-400'}`}>
                    <span>合计</span>
                    <span className="font-mono font-bold">{totalAlloc.toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-sm">估算指标（基于当前配置）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-4">
                    {[
                      { label: '预期年化收益', value: `${estimatedMetrics.return}%`, color: 'text-green-400' },
                      { label: '估算波动率', value: `${estimatedMetrics.risk}%`, color: riskColor },
                      { label: 'Sharpe 比率', value: estimatedMetrics.sharpe, color: 'text-blue-400' },
                    ].map(m => (
                      <div key={m.label} className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">{m.label}</span>
                        <span className={`font-mono font-bold text-lg ${m.color}`}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {allocation.map(a => (
                      <div key={a.name} className="flex items-center gap-2">
                        <div className="h-2 rounded-full flex-1 bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${a.value}%`, backgroundColor: a.color }} />
                        </div>
                        <span className="text-xs text-slate-400 w-12 text-right">{a.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 压力测试 */}
          <TabsContent value="stress">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  历史情景压力测试（基于当前配置）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stressResults} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                      formatter={(v: number) => [`${v}%`, '组合损益']}
                    />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar dataKey="pnlPct" fill="#ef4444" radius={[4, 4, 0, 0]}
                      label={{ position: 'top', fontSize: 10, fill: '#94a3b8', formatter: (v: number) => `${v}%` }}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {stressResults.map(r => (
                    <div key={r.name} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                      <span className="text-slate-300 text-sm">{r.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-red-400 font-mono text-sm">{r.pnlPct}%</span>
                        <span className="text-red-300 font-mono text-sm font-bold">
                          ${Math.abs(r.pnl).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="border-red-800 text-red-400 text-xs">损失</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

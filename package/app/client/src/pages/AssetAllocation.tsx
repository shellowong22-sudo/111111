import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, RotateCcw, TrendingUp, Shield, Target, Zap } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis,
  ReferenceLine, BarChart, Bar,
} from 'recharts';

// 各资产类别的预期收益率、波动率、与股票相关性
const ASSET_PARAMS: Record<string, { ret: number; vol: number; corr: number }> = {
  '股票':   { ret: 10.5, vol: 18.0, corr: 1.00 },
  '债券':   { ret: 4.2,  vol: 6.0,  corr: -0.15 },
  '现金':   { ret: 2.1,  vol: 0.5,  corr: 0.02 },
  '商品':   { ret: 6.8,  vol: 22.0, corr: 0.25 },
  '房地产': { ret: 7.5,  vol: 14.0, corr: 0.55 },
};

const DEFAULT_ALLOCATION = [
  { name: '股票',   value: 40, color: '#3b82f6' },
  { name: '债券',   value: 30, color: '#10b981' },
  { name: '现金',   value: 15, color: '#f59e0b' },
  { name: '商品',   value: 10, color: '#ef4444' },
  { name: '房地产', value: 5,  color: '#8b5cf6' },
];

const PRESET_STRATEGIES = [
  { name: '保守型', alloc: [15, 55, 20, 5, 5] },
  { name: '均衡型', alloc: [40, 30, 15, 10, 5] },
  { name: '激进型', alloc: [70, 10, 5, 10, 5] },
  { name: '全天候', alloc: [30, 40, 5, 15, 10] },
];

// 基于权重计算组合指标
function calcMetrics(allocation: { name: string; value: number }[]) {
  const total = allocation.reduce((s, a) => s + a.value, 0);
  if (total === 0) return { ret: 0, vol: 0, sharpe: 0, maxDD: 0 };
  const weights = allocation.map(a => a.value / total);
  const ret = weights.reduce((s, w, i) => s + w * (ASSET_PARAMS[allocation[i].name]?.ret ?? 0), 0);
  // 简化协方差矩阵（对角线主导）
  const vol = Math.sqrt(weights.reduce((s, w, i) => {
    const vi = ASSET_PARAMS[allocation[i].name]?.vol ?? 0;
    return s + Math.pow(w * vi, 2);
  }, 0) + 2 * weights[0] * weights[1] * (ASSET_PARAMS['股票'].vol * ASSET_PARAMS['债券'].vol * -0.15));
  const sharpe = vol > 0 ? (ret - 2.1) / vol : 0;
  const maxDD = vol * 2.2 * (1 + weights[0] * 0.3); // 估算最大回撤
  return { ret, vol, sharpe, maxDD };
}

// 生成有效前沿数据（100个随机组合点）
function generateFrontier() {
  const points = [];
  for (let i = 0; i <= 100; i += 2) {
    const eq = i;
    const bond = Math.max(0, 80 - i);
    const cash = Math.max(0, 20 - i * 0.1);
    const comm = Math.min(15, i * 0.1);
    const re = Math.max(0, 10 - i * 0.05);
    const alloc = [
      { name: '股票', value: eq },
      { name: '债券', value: bond },
      { name: '现金', value: cash },
      { name: '商品', value: comm },
      { name: '房地产', value: re },
    ];
    const m = calcMetrics(alloc);
    points.push({ vol: parseFloat(m.vol.toFixed(2)), ret: parseFloat(m.ret.toFixed(2)), eq });
  }
  return points;
}

const FRONTIER_DATA = generateFrontier();

export default function AssetAllocation() {
  const [allocation, setAllocation] = useState(DEFAULT_ALLOCATION.map(a => ({ ...a })));
  const [savedSchemes, setSavedSchemes] = useState<{ name: string; alloc: typeof DEFAULT_ALLOCATION }[]>([]);
  const [schemeName, setSchemeName] = useState('');
  const [activeTab, setActiveTab] = useState('config');

  const total = allocation.reduce((s, a) => s + a.value, 0);
  const metrics = useMemo(() => calcMetrics(allocation), [allocation]);

  const riskProfile = metrics.vol < 8 ? '保守型' : metrics.vol < 14 ? '平衡型' : '激进型';
  const riskColor = metrics.vol < 8 ? 'text-green-400' : metrics.vol < 14 ? 'text-orange-400' : 'text-red-400';

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

  const applyPreset = (preset: typeof PRESET_STRATEGIES[0]) => {
    setAllocation(DEFAULT_ALLOCATION.map((a, i) => ({ ...a, value: preset.alloc[i] })));
  };

  const saveScheme = () => {
    const name = schemeName.trim() || `方案 ${savedSchemes.length + 1}`;
    setSavedSchemes(prev => [...prev, { name, alloc: allocation.map(a => ({ ...a })) }]);
    setSchemeName('');
    toast.success(`已保存方案「${name}」`);
  };

  const loadScheme = (scheme: typeof savedSchemes[0]) => {
    setAllocation(scheme.alloc.map(a => ({ ...a })));
    toast.success(`已加载方案「${scheme.name}」`);
  };

  // 当前组合在有效前沿图上的位置
  const currentPoint = [{ vol: parseFloat(metrics.vol.toFixed(2)), ret: parseFloat(metrics.ret.toFixed(2)) }];

  const normalized = allocation.map(a => ({ ...a, displayValue: total > 0 ? ((a.value / total) * 100).toFixed(1) : '0.0' }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 mb-1">资产配置分析</h1>
            <p className="text-slate-400 text-sm">基于权重的实时收益/风险估算与有效前沿可视化</p>
          </div>
          <div className="flex gap-2">
            {PRESET_STRATEGIES.map(p => (
              <Button key={p.name} size="sm" onClick={() => applyPreset(p)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                {p.name}
              </Button>
            ))}
          </div>
        </div>

        {/* 核心指标卡片（实时计算） */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: '预期年化收益', value: `${metrics.ret.toFixed(1)}%`, color: 'text-green-400', icon: <TrendingUp className="w-4 h-4" /> },
            { label: '年化波动率', value: `${metrics.vol.toFixed(1)}%`, color: riskColor, icon: <Zap className="w-4 h-4" /> },
            { label: 'Sharpe 比率', value: metrics.sharpe.toFixed(2), color: 'text-blue-400', icon: <Target className="w-4 h-4" /> },
            { label: '估算最大回撤', value: `-${metrics.maxDD.toFixed(1)}%`, color: 'text-red-400', icon: <Shield className="w-4 h-4" /> },
          ].map(m => (
            <Card key={m.label} className="bg-slate-900 border-slate-700 p-4">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-2">{m.icon}{m.label}</div>
              <div className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</div>
              <div className="text-xs text-slate-500 mt-1">{m.label === '预期年化收益' ? riskProfile : ''}</div>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700 mb-4">
            <TabsTrigger value="config" className="data-[state=active]:bg-slate-700 text-slate-300">配置调整</TabsTrigger>
            <TabsTrigger value="frontier" className="data-[state=active]:bg-slate-700 text-slate-300">有效前沿</TabsTrigger>
            <TabsTrigger value="schemes" className="data-[state=active]:bg-slate-700 text-slate-300">
              保存方案 {savedSchemes.length > 0 && <Badge className="ml-1 text-xs bg-blue-600">{savedSchemes.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* 配置调整 */}
          <TabsContent value="config">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-sm">资产权重调整</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {allocation.map((asset, i) => (
                    <div key={asset.name}>
                      <div className="flex justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }} />
                          <span className="text-slate-300 text-sm">{asset.name}</span>
                          <span className="text-xs text-slate-500">
                            预期收益 {ASSET_PARAMS[asset.name]?.ret}% / 波动 {ASSET_PARAMS[asset.name]?.vol}%
                          </span>
                        </div>
                        <span className="font-mono text-sm font-bold" style={{ color: asset.color }}>
                          {asset.value.toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[asset.value]}
                        onValueChange={([v]) => handleSlider(i, v)}
                        min={0} max={90} step={1}
                      />
                    </div>
                  ))}
                  <div className={`flex justify-between text-sm pt-2 border-t border-slate-700 ${Math.abs(total - 100) > 1 ? 'text-red-400' : 'text-green-400'}`}>
                    <span>合计</span>
                    <span className="font-mono font-bold">{total.toFixed(0)}%</span>
                  </div>
                  <Button onClick={() => setAllocation(DEFAULT_ALLOCATION.map(a => ({ ...a })))}
                    variant="outline" size="sm" className="w-full text-slate-300 border-slate-600">
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> 重置为均衡型
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-100 text-sm">配置分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={normalized} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        dataKey="value" labelLine={false}
                        label={({ name, displayValue }) => `${name} ${displayValue}%`}>
                        {normalized.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                        formatter={(v: number) => [`${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%`, '权重']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {allocation.map(a => (
                      <div key={a.name} className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full flex-1 bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${a.value}%`, backgroundColor: a.color }} />
                        </div>
                        <span className="text-xs text-slate-400 w-16 text-right font-mono">{a.name} {a.value.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 有效前沿 */}
          <TabsContent value="frontier">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm">
                  有效前沿图（风险 vs 收益）
                  <span className="ml-2 text-xs text-slate-400 font-normal">蓝点=有效前沿，橙点=当前配置</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="vol" type="number" name="波动率" unit="%" tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: '年化波动率 (%)', position: 'insideBottom', offset: -4, fill: '#64748b', fontSize: 11 }} />
                    <YAxis dataKey="ret" type="number" name="收益率" unit="%" tick={{ fontSize: 10, fill: '#64748b' }}
                      label={{ value: '预期收益 (%)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
                    <ZAxis range={[40, 40]} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6 }}
                      formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name === 'vol' ? '波动率' : '预期收益']}
                    />
                    <Scatter name="有效前沿" data={FRONTIER_DATA} fill="#3b82f6" opacity={0.5} />
                    <Scatter name="当前配置" data={currentPoint} fill="#f97316" opacity={1} />
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {PRESET_STRATEGIES.map(p => {
                    const m = calcMetrics(DEFAULT_ALLOCATION.map((a, i) => ({ ...a, value: p.alloc[i] })));
                    return (
                      <div key={p.name} className="bg-slate-800/50 rounded p-3 cursor-pointer hover:bg-slate-800 transition-colors"
                        onClick={() => applyPreset(p)}>
                        <div className="text-xs text-slate-400 mb-1">{p.name}</div>
                        <div className="text-sm font-mono text-green-400">{m.ret.toFixed(1)}% 收益</div>
                        <div className="text-xs font-mono text-orange-400">{m.vol.toFixed(1)}% 波动</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 保存方案 */}
          <TabsContent value="schemes">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm">保存当前配置方案</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    value={schemeName}
                    onChange={e => setSchemeName(e.target.value)}
                    placeholder="方案名称（如：2026Q3均衡方案）"
                    className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                    onKeyDown={e => e.key === 'Enter' && saveScheme()}
                  />
                  <Button onClick={saveScheme} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                    <Save className="w-4 h-4 mr-1.5" /> 保存
                  </Button>
                </div>

                {savedSchemes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无保存的方案，调整配置后点击「保存」即可记录
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedSchemes.map((s, i) => {
                      const m = calcMetrics(s.alloc);
                      return (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700 hover:border-slate-600 transition-colors">
                          <div>
                            <div className="text-slate-100 font-medium text-sm">{s.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5 font-mono">
                              收益 {m.ret.toFixed(1)}% · 波动 {m.vol.toFixed(1)}% · Sharpe {m.sharpe.toFixed(2)}
                            </div>
                          </div>
                          <Button size="sm" onClick={() => loadScheme(s)}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200">
                            加载
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * BQuant 量化研究平台
 * 功能：在线代码编辑器 / 策略回测引擎 / 因子分析 / 回测结果可视化
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell
} from 'recharts';
import {
  Code2, Play, TrendingUp, BarChart2, Zap, BookOpen,
  CheckCircle, Clock, AlertCircle, RefreshCw, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

// ─── 颜色常量 ────────────────────────────────────────────────────────────────
const C = {
  amber: '#f59e0b', red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
  purple: '#a855f7', cyan: '#06b6d4', orange: '#f97316', slate: '#94a3b8',
  emerald: '#10b981', rose: '#f43f5e',
};

function fmtM(n: number) { return Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : n?.toFixed(0); }
function fmtPct(n: number) { return `${n >= 0 ? '+' : ''}${n?.toFixed(2)}%`; }

// ─── 代码编辑器组件（模拟 Monaco Editor 样式）──────────────────────────────
function CodeEditor({ code, onChange }: { code: string; onChange: (v: string) => void }) {
  const lines = code.split('\n');
  return (
    <div className="relative bg-[#1e1e2e] rounded-lg border border-slate-700 overflow-hidden font-mono text-sm">
      {/* 编辑器工具栏 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#181825] border-b border-slate-700/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-slate-400 ml-2">strategy.py</span>
        <Badge className="ml-auto text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">Python 3.11</Badge>
      </div>
      {/* 代码区域 */}
      <div className="flex">
        {/* 行号 */}
        <div className="select-none bg-[#181825] px-3 py-3 text-right text-slate-600 border-r border-slate-700/50 min-w-[3rem]">
          {lines.map((_, i) => (
            <div key={i} className="leading-6 text-xs">{i + 1}</div>
          ))}
        </div>
        {/* 代码文本域 */}
        <textarea
          value={code}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent text-slate-200 p-3 leading-6 text-xs resize-none outline-none min-h-[400px] w-full"
          spellCheck={false}
          style={{ fontFamily: "'Fira Code', 'Cascadia Code', monospace" }}
        />
      </div>
    </div>
  );
}

// ─── 策略模板卡片 ─────────────────────────────────────────────────────────────
function TemplateCard({ template, selected, onSelect }: {
  template: { id: string; name: string; description: string; tags: string[] };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${selected ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="font-medium text-sm text-slate-200">{template.name}</div>
        {selected && <CheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
      </div>
      <div className="text-xs text-slate-400 mb-2">{template.description}</div>
      <div className="flex flex-wrap gap-1">
        {template.tags.map(tag => (
          <Badge key={tag} className="text-xs px-1.5 py-0 bg-slate-700/60 text-slate-300 border-slate-600">{tag}</Badge>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 1：策略编辑器与回测 ──────────────────────────────────────────────────
function BacktestTab() {
  const [selectedTemplate, setSelectedTemplate] = useState('momentum');
  const [code, setCode] = useState('');
  const [backtestParams, setBacktestParams] = useState({
    startDate: '2023-01-01',
    endDate: '2024-12-31',
    initialCapital: 1000000,
    universe: 'SP500',
  });
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { data: templates } = trpc.bquant.listTemplates.useQuery();
  const { data: templateData } = trpc.bquant.getTemplate.useQuery({ id: selectedTemplate });
  const runBacktest = trpc.bquant.runBacktest.useMutation({
    onMutate: () => setIsRunning(true),
    onSuccess: (data) => {
      setBacktestResult(data);
      setIsRunning(false);
      toast.success('回测完成', { description: `年化收益率: ${data.metrics.annualReturn}%，夏普比率: ${data.metrics.sharpe}` });
    },
    onError: () => { setIsRunning(false); toast.error('回测失败'); },
  });

  const handleLoadTemplate = useCallback((id: string) => {
    setSelectedTemplate(id);
  }, []);

  const handleRun = () => {
    runBacktest.mutate({ strategyId: selectedTemplate, ...backtestParams });
  };

  const displayCode = code || templateData?.code || '';

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* 左侧：模板选择 + 参数 */}
      <div className="col-span-12 lg:col-span-3 space-y-3">
        <Card className="bg-slate-900/80 border-slate-700">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-400 flex items-center gap-2"><BookOpen className="w-4 h-4" />策略模板库</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {templates?.templates.map(t => (
              <TemplateCard key={t.id} template={t} selected={selectedTemplate === t.id}
                onSelect={() => { handleLoadTemplate(t.id); setCode(''); }} />
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-700">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">回测参数</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'startDate', label: '开始日期', type: 'date' },
              { key: 'endDate', label: '结束日期', type: 'date' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <Label className="text-xs text-slate-400 mb-1 block">{label}</Label>
                <Input type={type} value={backtestParams[key as keyof typeof backtestParams]}
                  onChange={e => setBacktestParams(p => ({ ...p, [key]: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-slate-200 text-xs h-8" />
              </div>
            ))}
            <div>
              <Label className="text-xs text-slate-400 mb-1 block">初始资金</Label>
              <Select value={String(backtestParams.initialCapital)} onValueChange={v => setBacktestParams(p => ({ ...p, initialCapital: Number(v) }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200 text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {[100000, 500000, 1000000, 5000000, 10000000].map(v => (
                    <SelectItem key={v} value={String(v)} className="text-slate-200">${fmtM(v)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1 block">股票池</Label>
              <Select value={backtestParams.universe} onValueChange={v => setBacktestParams(p => ({ ...p, universe: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200 text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {['SP500', 'NASDAQ100', 'RUSSELL2000', 'CSI300', 'HSCEI'].map(v => (
                    <SelectItem key={v} value={v} className="text-slate-200">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold" onClick={handleRun} disabled={isRunning}>
              {isRunning ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />运行中...</> : <><Play className="w-4 h-4 mr-2" />运行回测</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 中间：代码编辑器 */}
      <div className="col-span-12 lg:col-span-5">
        <CodeEditor code={displayCode} onChange={setCode} />
        {/* 控制台输出 */}
        <div className="mt-2 bg-[#0d1117] rounded-lg border border-slate-700 p-3 font-mono text-xs max-h-32 overflow-y-auto">
          <div className="text-slate-500 mb-1"># 控制台输出</div>
          {isRunning && <div className="text-amber-400 animate-pulse">▶ 正在执行回测...</div>}
          {backtestResult && !isRunning && (
            <>
              <div className="text-green-400">✓ 回测完成 [{backtestResult.startDate} → {backtestResult.endDate}]</div>
              <div className="text-slate-300">年化收益率: {backtestResult.metrics.annualReturn}%</div>
              <div className="text-slate-300">夏普比率: {backtestResult.metrics.sharpe}</div>
              <div className="text-slate-300">最大回撤: {backtestResult.metrics.maxDrawdown}%</div>
              <div className="text-slate-300">胜率: {backtestResult.metrics.winRate}%</div>
              <div className="text-slate-300">交易次数: {backtestResult.metrics.trades}</div>
            </>
          )}
          {!backtestResult && !isRunning && <div className="text-slate-600">等待运行...</div>}
        </div>
      </div>

      {/* 右侧：回测结果 */}
      <div className="col-span-12 lg:col-span-4 space-y-3">
        {backtestResult ? (
          <>
            {/* 绩效指标 */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '年化收益', value: `${backtestResult.metrics.annualReturn}%`, color: backtestResult.metrics.annualReturn > 0 ? C.green : C.red },
                { label: '夏普比率', value: backtestResult.metrics.sharpe, color: backtestResult.metrics.sharpe > 1 ? C.green : C.amber },
                { label: '最大回撤', value: `${backtestResult.metrics.maxDrawdown}%`, color: C.red },
                { label: '胜率', value: `${backtestResult.metrics.winRate}%`, color: C.blue },
                { label: 'Alpha', value: `${backtestResult.metrics.alpha}%`, color: backtestResult.metrics.alpha > 0 ? C.green : C.red },
                { label: 'Calmar', value: backtestResult.metrics.calmar, color: backtestResult.metrics.calmar > 1 ? C.green : C.amber },
              ].map(({ label, value, color }) => (
                <Card key={label} className="bg-slate-900/80 border-slate-700 p-2">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="text-base font-bold font-mono" style={{ color }}>{value}</div>
                </Card>
              ))}
            </div>

            {/* 净值曲线 */}
            <Card className="bg-slate-900/80 border-slate-700">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-slate-300">净值曲线 vs 基准</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={backtestResult.curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => v.slice(5)} interval={Math.floor(backtestResult.curve.length / 6)} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={v => `$${fmtM(v)}`} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number, n: string) => [`$${fmtM(v)}`, n === 'equity' ? '策略' : '基准']} />
                    <Area type="monotone" dataKey="equity" stroke={C.amber} fill={C.amber} fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="benchmark" stroke={C.slate} fill={C.slate} fillOpacity={0.05} strokeWidth={1.5} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 月度收益热图 */}
            <Card className="bg-slate-900/80 border-slate-700">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-slate-300">月度收益率</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-slate-500 text-left py-1 px-1">年份</th>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                          <th key={m} className="text-slate-500 text-center py-1 px-0.5 w-7">{m.slice(0, 1)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[2023, 2024].map(year => (
                        <tr key={year}>
                          <td className="text-slate-400 py-1 px-1 font-mono">{year}</td>
                          {backtestResult.monthlyReturns.filter((m: any) => m.year === year).map((m: any, i: number) => {
                            const intensity = Math.min(Math.abs(m.return) / 5, 1);
                            const bg = m.return > 0 ? `rgba(34,197,94,${intensity * 0.8})` : `rgba(239,68,68,${intensity * 0.8})`;
                            return (
                              <td key={i} className="text-center py-1 px-0.5 rounded font-mono" style={{ background: bg, color: intensity > 0.5 ? '#fff' : '#94a3b8', fontSize: 9 }}>
                                {m.return > 0 ? '+' : ''}{m.return.toFixed(1)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
            <Play className="w-12 h-12 opacity-30" />
            <div className="text-sm">选择策略模板，点击运行回测</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2：因子分析 ──────────────────────────────────────────────────────────
function FactorAnalysisTab() {
  const [selectedFactors, setSelectedFactors] = useState<string[]>(['momentum_12_1', 'roa', 'pb_ratio']);
  const { data: factorList } = trpc.bquant.listFactors.useQuery();
  const { data: analysis } = trpc.bquant.analyzeFactors.useQuery({ factorIds: selectedFactors });
  const { data: optimization } = trpc.bquant.optimizeFactors.useQuery({ factorIds: selectedFactors }, { enabled: selectedFactors.length >= 2 });

  const toggleFactor = (id: string) => {
    setSelectedFactors(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const categoryColors: Record<string, string> = { 动量: C.amber, 价值: C.blue, 质量: C.green, 风险: C.red, 规模: C.purple };

  return (
    <div className="space-y-4">
      {/* 因子选择 */}
      <Card className="bg-slate-900/80 border-slate-700">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-400">因子库 — 选择分析因子</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {factorList?.factors.map(f => (
              <div key={f.id}
                onClick={() => toggleFactor(f.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedFactors.includes(f.id) ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-200">{f.name}</span>
                  <Badge className="text-xs px-1.5 py-0" style={{ background: `${categoryColors[f.category]}20`, color: categoryColors[f.category], border: 'none' }}>{f.category}</Badge>
                </div>
                <div className="text-xs text-slate-400 mb-2">{f.description}</div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div><span className="text-slate-500">IC</span><div className="font-mono" style={{ color: f.ic > 0 ? C.green : C.red }}>{f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}</div></div>
                  <div><span className="text-slate-500">ICIR</span><div className="font-mono" style={{ color: f.icir > 0 ? C.green : C.red }}>{f.icir.toFixed(2)}</div></div>
                  <div><span className="text-slate-500">年化</span><div className="font-mono" style={{ color: f.annualReturn > 0 ? C.green : C.red }}>{fmtPct(f.annualReturn)}</div></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <div className="grid grid-cols-12 gap-4">
          {/* IC 时序 */}
          <div className="col-span-12 lg:col-span-7">
            <Card className="bg-slate-900/80 border-slate-700">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">IC 时序（月度，过去24个月）</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" type="category" allowDuplicatedCategory={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[-0.15, 0.15]} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#475569" />
                    {analysis.icTimeSeries.map((series, i) => (
                      <Line key={series.factorId} data={series.months} type="monotone" dataKey="ic" name={series.name}
                        stroke={[C.amber, C.blue, C.green, C.purple, C.cyan][i % 5]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 因子相关性矩阵 */}
          <div className="col-span-12 lg:col-span-5">
            <Card className="bg-slate-900/80 border-slate-700">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">因子相关性矩阵</CardTitle></CardHeader>
              <CardContent>
                {analysis.correlationMatrix.matrix.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>
                          <th className="w-24" />
                          {analysis.correlationMatrix.names.map((name, i) => (
                            <th key={i} className="text-slate-400 font-normal px-1 py-1 text-center text-xs" style={{ maxWidth: 60 }}>
                              {name.split(' ')[0]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.correlationMatrix.matrix.map((row, i) => (
                          <tr key={i}>
                            <td className="text-slate-400 px-1 py-1 text-right text-xs">{analysis.correlationMatrix.names[i].split(' ')[0]}</td>
                            {row.map((v, j) => {
                              const bg = v === 1 ? '#1e3a5f' : v > 0 ? `rgba(59,130,246,${Math.abs(v) * 0.7})` : `rgba(239,68,68,${Math.abs(v) * 0.7})`;
                              return (
                                <td key={j} className="text-center px-1 py-2 rounded font-mono" style={{ background: bg, color: Math.abs(v) > 0.5 ? '#fff' : '#94a3b8' }}>
                                  {v === 1 ? '—' : v.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm text-center py-8">请选择至少2个因子</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 因子绩效对比 */}
          <div className="col-span-12 lg:col-span-6">
            <Card className="bg-slate-900/80 border-slate-700">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">因子绩效对比</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analysis.factors}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => v.split(' ')[0]} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                      formatter={(v: number, n: string) => [`${v}%`, n === 'annualReturn' ? '年化收益' : '夏普比率']} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar dataKey="annualReturn" name="年化收益" radius={[4, 4, 0, 0]}>
                      {analysis.factors.map((f, i) => <Cell key={i} fill={f.annualReturn > 0 ? C.green : C.red} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 因子组合优化 */}
          {optimization && selectedFactors.length >= 2 && (
            <div className="col-span-12 lg:col-span-6">
              <Card className="bg-slate-900/80 border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm text-slate-300">因子权重优化</CardTitle>
                    <div className="flex gap-3 text-xs">
                      <span className="text-slate-400">等权: <span className="text-amber-300 font-mono">{optimization.performance.equal.annualReturn}%</span></span>
                      <span className="text-slate-400">优化: <span className="text-green-400 font-mono">{optimization.performance.optimized.annualReturn}%</span></span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {optimization.optimizedWeights.map((w, i) => (
                      <div key={w.factorId} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-28 truncate">{w.name.split(' ')[0]}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-2 relative">
                            <div className="h-2 rounded-full bg-slate-600 absolute" style={{ width: `${optimization.equalWeights[i]?.weight * 100}%` }} />
                          </div>
                          <span className="text-xs font-mono text-slate-500 w-8">{(optimization.equalWeights[i]?.weight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded-full h-2">
                            <div className="h-2 rounded-full bg-amber-500" style={{ width: `${w.weight * 100}%` }} />
                          </div>
                          <span className="text-xs font-mono text-amber-300 w-8">{(w.weight * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    {[
                      { label: '年化收益', eq: `${optimization.performance.equal.annualReturn}%`, opt: `${optimization.performance.optimized.annualReturn}%`, better: true },
                      { label: '夏普比率', eq: optimization.performance.equal.sharpe.toFixed(2), opt: optimization.performance.optimized.sharpe.toFixed(2), better: true },
                      { label: '最大回撤', eq: `${optimization.performance.equal.maxDrawdown}%`, opt: `${optimization.performance.optimized.maxDrawdown}%`, better: false },
                    ].map(({ label, eq, opt, better }) => (
                      <div key={label} className="bg-slate-800/60 rounded p-2 text-center">
                        <div className="text-slate-500 mb-1">{label}</div>
                        <div className="text-slate-400">{eq}</div>
                        <div className="text-green-400 font-bold">{opt}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────
export default function BQuant() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      {/* 页头 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Code2 className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl font-bold text-amber-400">UQuant 量化研究平台</h1>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">策略回测 · 因子分析</Badge>
          </div>
          <p className="text-slate-400 text-sm">在线策略编辑器 · 多因子回测引擎 · 因子库分析 · 权重优化</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span>引擎就绪</span></div>
          <div className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /><span>因子库: {8} 个</span></div>
        </div>
      </div>

      <Tabs defaultValue="backtest">
        <TabsList className="bg-slate-800/60 border border-slate-700 mb-4">
          <TabsTrigger value="backtest" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <Play className="w-3 h-3 mr-1" />策略回测
          </TabsTrigger>
          <TabsTrigger value="factor" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-black">
            <BarChart2 className="w-3 h-3 mr-1" />因子分析
          </TabsTrigger>
        </TabsList>
        <TabsContent value="backtest"><BacktestTab /></TabsContent>
        <TabsContent value="factor"><FactorAnalysisTab /></TabsContent>
      </Tabs>
    </div>
  );
}

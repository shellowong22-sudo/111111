/**
 * WBF Advanced - 全球债券期货 AI增强版
 * AI：DRL(SAC) CTD预测 + GNN跨市场基差套利 + 多任务学习转换因子
 * 超越彭博：实时CTD概率分布 + 基差异常检测 + 跨市场相关性热图
 */
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Brain, Zap, TrendingUp, TrendingDown, BarChart2, Network, Bell, BellOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts';
import { trpc } from '@/lib/trpc';

const clr = (v: number) => v >= 0 ? '#22c55e' : '#ef4444';
const fmt = (v: number, d = 4) => v?.toFixed(d) ?? '—';
const fmtK = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', DE: '🇩🇪', JP: '🇯🇵', CA: '🇨🇦', GB: '🇬🇧', FR: '🇫🇷', AU: '🇦🇺',
};

export default function WBFAdvanced() {
  const [, setLocation] = useLocation();
  const [selectedTicker, setSelectedTicker] = useState('ZN1');
  const [activeTab, setActiveTab] = useState('contracts');
  // 阈值预警状态
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState(0.65); // 套利空间阈值（异常分数）
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const alertedRef = useRef<Set<string>>(new Set()); // 已预警的信号 ID，避免重复弹出

  const { data: contracts, isLoading: contractsLoading } = trpc.wbfAdvanced.getContracts.useQuery();
  const { data: deliverables } = trpc.wbfAdvanced.getDeliverables.useQuery({ ticker: selectedTicker });
  const { data: correlation } = trpc.wbfAdvanced.getCrossMarketCorrelation.useQuery();
  const { data: basisHistory } = trpc.wbfAdvanced.getBasisHistory.useQuery({ ticker: selectedTicker });
  const { data: arbitrageSignals } = trpc.wbfAdvanced.getArbitrageSignals.useQuery();

  const selectedContract = contracts?.find(c => c.ticker === selectedTicker);

  // 监听套利信号，超过阈值时右上角弹出预警
  useEffect(() => {
    if (!alertEnabled || !arbitrageSignals) return;
    arbitrageSignals.forEach(sig => {
      const sigId = `${sig.ticker}-${sig.signal}`;
      if (sig.score >= alertThreshold && !alertedRef.current.has(sigId)) {
        alertedRef.current.add(sigId);
        toast.warning(
          `⚡ GNN 基差套利预警：${sig.ticker}`,
          {
            description: `套利空间 ${(sig.score * 100).toFixed(1)}% 超过阈值 ${(alertThreshold * 100).toFixed(0)}%\n${sig.signal} | 预期收益 ${sig.expectedReturn?.toFixed(2)}%`,
            duration: 8000,
            position: 'top-right',
            action: {
              label: '查看详情',
              onClick: () => setActiveTab('arbitrage'),
            },
          }
        );
      }
    });
  }, [arbitrageSignals, alertEnabled, alertThreshold]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="text-zinc-400 hover:text-zinc-100 p-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-400" />
          <span className="text-blue-400 font-bold text-lg">WBF</span>
          <span className="text-zinc-400 text-sm">全球债券期货 AI增强版</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-blue-900/60 text-blue-400 border-blue-700 text-xs">DRL CTD PREDICT</Badge>
          <Badge className="bg-purple-900/60 text-purple-400 border-purple-700 text-xs">GNN BASIS ARB</Badge>
          <Badge className="bg-green-900/60 text-green-400 border-green-700 text-xs">MULTI-TASK MTL</Badge>
          {/* 预警控制区 */}
          <div className="relative">
            <div className="flex items-center gap-1 border border-zinc-700 rounded px-2 py-1 bg-zinc-900">
              <button
                onClick={() => setAlertEnabled(v => !v)}
                className={`transition-colors ${alertEnabled ? 'text-orange-400' : 'text-zinc-600'}`}
                title={alertEnabled ? '预警已开启' : '预警已关闭'}
              >
                {alertEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
              <span className="text-zinc-400 text-xs">阈值</span>
              <button
                onClick={() => setShowAlertSettings(v => !v)}
                className="text-zinc-400 hover:text-orange-400 transition-colors"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
            {showAlertSettings && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-orange-700/60 rounded-lg p-4 w-72 shadow-2xl">
                <div className="text-orange-300 font-bold text-sm mb-3">⚡ GNN 套利预警设置</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-xs">预警开关</span>
                    <button
                      onClick={() => setAlertEnabled(v => !v)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                        alertEnabled ? 'bg-orange-600 text-white' : 'bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      {alertEnabled ? '开启' : '关闭'}
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-zinc-400 text-xs">套利空间阈值</span>
                      <span className="text-orange-400 font-bold text-sm">{(alertThreshold * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={0.95}
                      step={0.05}
                      value={alertThreshold}
                      onChange={e => {
                        setAlertThreshold(Number(e.target.value));
                        alertedRef.current.clear(); // 重置已预警集合
                      }}
                      className="w-full accent-orange-500"
                    />
                    <div className="flex justify-between text-zinc-600 text-xs mt-1">
                      <span>30%</span><span>60%</span><span>95%</span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 border-t border-zinc-700 pt-2">
                    当 GNN 异常分数 ≥ {(alertThreshold * 100).toFixed(0)}% 时，在页面右上角弹出预警提示
                  </div>
                  <button
                    onClick={() => {
                      alertedRef.current.clear();
                      toast.info('已重置预警记录，将重新扫描全部信号');
                    }}
                    className="w-full py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors"
                  >
                    重置预警记录
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Contract Selector */}
        <div className="flex flex-wrap gap-2">
          {contracts?.map(c => (
            <button
              key={c.ticker}
              onClick={() => setSelectedTicker(c.ticker)}
              className={`px-3 py-1.5 rounded text-xs border transition-all ${
                selectedTicker === c.ticker
                  ? 'bg-blue-500 text-white border-blue-400'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-blue-500'
              }`}
            >
              <span>{COUNTRY_FLAGS[c.country] || ''} {c.ticker}</span>
              <span className={`ml-2 ${c.chgPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {c.chgPct >= 0 ? '+' : ''}{c.chgPct?.toFixed(3)}%
              </span>
              {c.basisArbitrageSignal && <span className="ml-1 text-orange-400">⚡</span>}
            </button>
          ))}
        </div>

        {/* Selected Contract Stats */}
        {selectedContract && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { label: 'Last', value: selectedContract.last?.toFixed(5), color: '#f5f5f5' },
              { label: 'Chg', value: `${selectedContract.chg >= 0 ? '+' : ''}${selectedContract.chg?.toFixed(5)}`, color: clr(selectedContract.chg) },
              { label: 'Chg%', value: `${selectedContract.chgPct >= 0 ? '+' : ''}${selectedContract.chgPct?.toFixed(3)}%`, color: clr(selectedContract.chgPct) },
              { label: 'Volume', value: fmtK(selectedContract.vol), color: '#a1a1aa' },
              { label: 'OI', value: fmtK(selectedContract.oi), color: '#a1a1aa' },
              { label: 'Impl.Yield', value: `${selectedContract.impliedYield?.toFixed(3)}%`, color: '#f59e0b' },
              { label: 'DV01', value: `$${selectedContract.dv01?.toFixed(1)}`, color: '#8b5cf6' },
              { label: 'CTD Prob', value: `${((selectedContract.ctdProbability || 0) * 100).toFixed(1)}%`, color: '#22c55e' },
            ].map(item => (
              <Card key={item.label} className="bg-zinc-900 border-zinc-800 p-2 text-center">
                <div className="text-zinc-500 text-xs">{item.label}</div>
                <div className="font-bold text-sm" style={{ color: item.color }}>{item.value}</div>
              </Card>
            ))}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="contracts" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">合约行情</TabsTrigger>
            <TabsTrigger value="ctd" className="text-xs data-[state=active]:bg-green-600 data-[state=active]:text-white">DRL CTD预测</TabsTrigger>
            <TabsTrigger value="basis" className="text-xs data-[state=active]:bg-yellow-600 data-[state=active]:text-black">基差分析</TabsTrigger>
            <TabsTrigger value="gnn" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white">GNN跨市场</TabsTrigger>
            <TabsTrigger value="arbitrage" className="text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white">套利信号</TabsTrigger>
          </TabsList>

          {/* -- 合约行情 ------------------------------------------------ */}
          <TabsContent value="contracts">
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-left">代码</th>
                      <th className="px-2 py-1 text-left">名称</th>
                      <th className="px-2 py-1 text-right">最新</th>
                      <th className="px-2 py-1 text-right">涨跌%</th>
                      <th className="px-2 py-1 text-right">成交量</th>
                      <th className="px-2 py-1 text-right">持仓量</th>
                      <th className="px-2 py-1 text-right">隐含收益率</th>
                      <th className="px-2 py-1 text-right">DV01</th>
                      <th className="px-2 py-1 text-right">久期</th>
                      <th className="px-2 py-1 text-right">CTD债券</th>
                      <th className="px-2 py-1 text-right">CTD概率</th>
                      <th className="px-2 py-1 text-center">套利</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractsLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i} className="border-b border-zinc-900">
                          {Array.from({ length: 12 }).map((_, j) => (
                            <td key={j} className="px-2 py-2">
                              <div className="h-3 bg-zinc-800 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : contracts?.map((c, i) => (
                      <tr
                        key={i}
                        className={`border-b border-zinc-900 hover:bg-zinc-800/50 cursor-pointer ${selectedTicker === c.ticker ? 'bg-blue-950/20' : ''}`}
                        onClick={() => setSelectedTicker(c.ticker)}
                      >
                        <td className="px-2 py-1.5 font-bold text-blue-400">{COUNTRY_FLAGS[c.country] || ''} {c.ticker}</td>
                        <td className="px-2 py-1.5 text-zinc-300 max-w-[160px] truncate">{c.name}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-zinc-100">{c.last?.toFixed(5)}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${clr(c.chgPct)}`}>{c.chgPct >= 0 ? '+' : ''}{c.chgPct?.toFixed(3)}%</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{fmtK(c.vol)}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-500">{fmtK(c.oi)}</td>
                        <td className="px-2 py-1.5 text-right text-yellow-400">{c.impliedYield?.toFixed(3)}%</td>
                        <td className="px-2 py-1.5 text-right text-purple-400">${c.dv01?.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{c.duration?.toFixed(2)}Y</td>
                        <td className="px-2 py-1.5 text-right text-zinc-300 max-w-[120px] truncate">{c.ctdBond}</td>
                        <td className="px-2 py-1.5 text-right text-green-400">{((c.ctdProbability || 0) * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-center">
                          {c.basisArbitrageSignal
                            ? <Badge className="bg-orange-900/60 text-orange-300 border-orange-700 text-xs">⚡ {c.basisArbitrageSignal.split('_')[0]}</Badge>
                            : <span className="text-zinc-700">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* -- DRL CTD预测 --------------------------------------------- */}
          <TabsContent value="ctd" className="space-y-4">
            {/* Model Info */}
            <Card className="bg-green-950/20 border-green-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-green-400" />
                <span className="text-green-300 font-bold text-sm">SAC强化学习 CTD动态预测引擎</span>
                <Badge className="bg-green-900/60 text-green-300 border-green-700 text-xs ml-auto">
                  置信度: {((deliverables?.modelInfo?.confidence || 0.87) * 100).toFixed(0)}%
                </Badge>
              </div>
              {deliverables?.modelInfo && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div><span className="text-zinc-500">算法: </span><span className="text-zinc-300">{deliverables.modelInfo.name}</span></div>
                  <div><span className="text-zinc-500">训练轮次: </span><span className="text-zinc-300">{deliverables.modelInfo.trainingEpisodes?.toLocaleString()}</span></div>
                  <div><span className="text-zinc-500">状态空间: </span><span className="text-zinc-300">{deliverables.modelInfo.stateSpace?.join(', ')}</span></div>
                  <div><span className="text-zinc-500">奖励函数: </span><span className="text-zinc-300">{deliverables.modelInfo.rewardFunction}</span></div>
                </div>
              )}
            </Card>

            {/* CTD Probability Bar Chart */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">可交割债券 CTD概率分布 — {selectedTicker}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deliverables?.deliverables?.map(d => ({ name: d.name.split(' ')[1], prob: (d.ctdProbability * 100).toFixed(1), isCTD: d.isCTD }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }}
                    formatter={(v: number) => [`${v}%`, 'CTD概率']}
                  />
                  <Bar dataKey="prob" name="CTD概率">
                    {deliverables?.deliverables?.map((d, i) => (
                      <Cell key={i} fill={d.isCTD ? '#22c55e' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Deliverables Table */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">可交割债券池 — 含DRL预测 + 多任务学习</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="px-2 py-1 text-left">债券</th>
                      <th className="px-2 py-1 text-right">票息</th>
                      <th className="px-2 py-1 text-right">净价</th>
                      <th className="px-2 py-1 text-right">收益率</th>
                      <th className="px-2 py-1 text-right">转换因子CF</th>
                      <th className="px-2 py-1 text-right">基差</th>
                      <th className="px-2 py-1 text-right">净基差</th>
                      <th className="px-2 py-1 text-right">IRR%</th>
                      <th className="px-2 py-1 text-right">修正久期</th>
                      <th className="px-2 py-1 text-right">DV01</th>
                      <th className="px-2 py-1 text-right text-green-400">CTD概率</th>
                      <th className="px-2 py-1 text-right text-yellow-400">预测收益率</th>
                      <th className="px-2 py-1 text-right text-blue-400">预测IRR</th>
                      <th className="px-2 py-1 text-center">CTD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliverables?.deliverables?.map((d, i) => (
                      <tr key={i} className={`border-b border-zinc-900 hover:bg-zinc-800/30 ${d.isCTD ? 'bg-green-950/20' : ''}`}>
                        <td className="px-2 py-1.5 text-zinc-300 max-w-[140px] truncate">{d.name}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{d.coupon?.toFixed(3)}%</td>
                        <td className="px-2 py-1.5 text-right text-zinc-100">{d.cleanPrice?.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-right text-yellow-400">{d.yieldPct?.toFixed(4)}%</td>
                        <td className="px-2 py-1.5 text-right text-blue-400">{d.cf?.toFixed(6)}</td>
                        <td className={`px-2 py-1.5 text-right ${d.basis < 0 ? 'text-red-400' : 'text-green-400'}`}>{d.basis?.toFixed(4)}</td>
                        <td className={`px-2 py-1.5 text-right ${d.netBasis < 0 ? 'text-red-400' : 'text-green-400'}`}>{d.netBasis?.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-right text-purple-400">{d.irr?.toFixed(4)}%</td>
                        <td className="px-2 py-1.5 text-right text-zinc-400">{d.modDuration?.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-right text-zinc-500">{d.dv01?.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-right text-green-400 font-bold">{(d.ctdProbability * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-right text-yellow-400">{d.predictedYield?.toFixed(4)}%</td>
                        <td className="px-2 py-1.5 text-right text-blue-400">{d.predictedIRR?.toFixed(4)}%</td>
                        <td className="px-2 py-1.5 text-center">
                          {d.isCTD
                            ? <Badge className="bg-green-900/60 text-green-300 border-green-700 text-xs">CTD ✓</Badge>
                            : <span className="text-zinc-700">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* -- 基差分析 ------------------------------------------------ */}
          <TabsContent value="basis" className="space-y-4">
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">60日基差 / 净基差 / IRR历史 — {selectedTicker}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={basisHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 9 }}
                    tickFormatter={v => v.slice(5)} />
                  <YAxis yAxisId="left" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine yAxisId="left" y={0} stroke="#52525b" strokeDasharray="4 4" />
                  <Line yAxisId="left" type="monotone" dataKey="basis" stroke="#3b82f6" dot={false} name="基差" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="netBasis" stroke="#8b5cf6" dot={false} name="净基差" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="irr" stroke="#f59e0b" dot={false} name="IRR%" strokeWidth={1.5} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Basis Scatter */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">净基差 vs IRR 散点图 — {selectedTicker}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="netBasis" name="净基差" tick={{ fill: '#71717a', fontSize: 10 }}
                    label={{ value: '净基差', fill: '#71717a', fontSize: 10, position: 'insideBottom', offset: -5 }} />
                  <YAxis dataKey="irr" name="IRR%" tick={{ fill: '#71717a', fontSize: 10 }}
                    label={{ value: 'IRR%', fill: '#71717a', fontSize: 10, angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }} />
                  <Scatter
                    name="净基差 vs IRR"
                    data={basisHistory?.slice(-30)}
                    fill="#8b5cf6"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* -- GNN跨市场 ----------------------------------------------- */}
          <TabsContent value="gnn" className="space-y-4">
            <Card className="bg-purple-950/20 border-purple-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Network className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-bold text-sm">图神经网络 (GNN) 跨市场基差套利引擎</span>
              </div>
              {correlation?.modelInfo && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div><span className="text-zinc-500">图节点: </span><span className="text-zinc-300">{correlation.modelInfo.graphNodes}</span></div>
                  <div><span className="text-zinc-500">图边: </span><span className="text-zinc-300">{correlation.modelInfo.graphEdges}</span></div>
                  <div><span className="text-zinc-500">消息传递: </span><span className="text-zinc-300">{correlation.modelInfo.messagePassing}</span></div>
                  <div><span className="text-zinc-500">异常阈值: </span><span className="text-zinc-300">{correlation.modelInfo.threshold}</span></div>
                </div>
              )}
            </Card>

            {/* Correlation Heatmap */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">跨市场相关性矩阵 (GNN学习)</h3>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-zinc-500"></th>
                      {correlation?.tickers?.map(t => (
                        <th key={t} className="px-2 py-1 text-zinc-400 text-center">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlation?.tickers?.map((t1, i) => (
                      <tr key={t1}>
                        <td className="px-2 py-1 text-zinc-400 font-bold">{t1}</td>
                        {correlation.matrix[i]?.map((val, j) => {
                          const intensity = Math.abs(val);
                          const bg = i === j ? 'bg-zinc-700' :
                            intensity > 0.8 ? 'bg-blue-900/80' :
                            intensity > 0.6 ? 'bg-blue-900/50' :
                            intensity > 0.4 ? 'bg-blue-900/30' : 'bg-zinc-900';
                          return (
                            <td key={j} className={`px-2 py-1 text-center ${bg}`}>
                              <span className={intensity > 0.7 ? 'text-blue-300' : 'text-zinc-500'}>
                                {val?.toFixed(2)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Anomaly Scores */}
            <Card className="bg-zinc-900 border-zinc-800 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3">GNN 基差异常分数</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={correlation?.tickers?.map(t => ({
                    ticker: t,
                    score: ((correlation.anomalyScores[t] || 0) * 100).toFixed(2),
                    isAnomaly: (correlation.anomalyScores[t] || 0) > 0.08,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="ticker" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11 }} />
                  <ReferenceLine y={8} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Threshold 8%', fill: '#f59e0b', fontSize: 10 }} />
                  <Bar dataKey="score" name="异常分数%">
                    {correlation?.tickers?.map((t, i) => (
                      <Cell key={i} fill={(correlation.anomalyScores[t] || 0) > 0.08 ? '#f59e0b' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* -- 套利信号 ------------------------------------------------ */}
          <TabsContent value="arbitrage" className="space-y-4">
            <Card className="bg-orange-950/20 border-orange-800/40 p-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                <span className="text-orange-300 font-bold text-sm">GNN 识别的跨市场基差套利机会</span>
                <Badge className="ml-auto bg-orange-900/60 text-orange-300 border-orange-700 text-xs">
                  {arbitrageSignals?.length || 0} 信号
                </Badge>
              </div>
            </Card>

            <div className="space-y-3">
              {arbitrageSignals?.map((sig, i) => (
                <Card key={i} className="bg-zinc-900 border-orange-800/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-blue-400">{sig.ticker}</span>
                        <Badge className="bg-orange-900/60 text-orange-300 border-orange-700 text-xs">{sig.signal}</Badge>
                        <span className="text-zinc-500 text-xs">预期收益: <span className="text-green-400 font-bold">{sig.expectedReturn?.toFixed(2)}%</span></span>
                      </div>
                      <div className="text-xs text-zinc-400 mb-1">{sig.name}</div>
                      <div className="text-xs text-zinc-300">{sig.description}</div>
                      <div className="text-xs text-zinc-500 mt-1">CTD债券: <span className="text-zinc-300">{sig.ctdBond}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">异常分数</div>
                      <div className="text-orange-400 font-bold">{(sig.score * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </Card>
              ))}
              {(!arbitrageSignals || arbitrageSignals.length === 0) && (
                <div className="text-center text-zinc-500 py-8">当前无显著基差套利机会</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

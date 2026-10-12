import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Brain, Zap, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Send, Activity, BarChart2, Globe, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis } from "recharts";

// -- 感知层信号面板 ------------------------------
function AltDataSignalPanel({ signals, readAt }: { signals: any[]; readAt?: number }) {
  if (!signals.length) return <div data-bico-alt-status="unavailable" className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200">状态：不可用。授权替代数据服务未接入；来源、观测日均未提供；读取时间：{readAt ? new Date(readAt).toLocaleString('zh-CN', { hour12: false }) : '未提供'}。系统未以固定传感器、情绪或期权信号替代。</div>;
  return (
    <div className="grid grid-cols-1 gap-2">
      {signals.map((s, i) => (
        <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-800/60 border border-slate-700/50">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="text-xs text-slate-400">{s.source}</span>
          </div>
          <span className="text-xs text-slate-200 flex-1 mx-3">{s.signal}</span>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${s.impact === "negative" ? "bg-red-400" : s.impact === "warning" ? "bg-yellow-400" : "bg-green-400"}`} />
            <span className="text-xs text-slate-400">{Math.round(s.confidence * 100)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// -- 因果链可视化 ---------------------------------
function CausalChainViz({ chain, readAt }: { chain: any[]; readAt?: number }) {
  if (!chain.length) return <div data-bico-causal-status="unavailable" className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200">状态：不可用。未接入可验证事件与市场观测，无法给出概率、时滞或因果链；读取时间：{readAt ? new Date(readAt).toLocaleString('zh-CN', { hour12: false }) : '未提供'}。</div>;
  return (
    <div className="flex flex-col gap-1">
      {chain.map((node, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
            node.type === "trigger" ? "bg-red-400" :
            node.type === "direct" ? "bg-orange-400" :
            node.type === "secondary" ? "bg-yellow-400" : "bg-blue-400"
          }`} />
          <div className="flex-1 flex items-center justify-between p-1.5 rounded bg-slate-800/60 border border-slate-700/30">
            <span className="text-xs text-slate-200">{node.node}</span>
            <div className="flex items-center gap-2">
              {node.lag && <span className="text-xs text-slate-500">{node.lag}</span>}
              <span className="text-xs font-mono text-cyan-400">{Math.round(node.probability * 100)}%</span>
            </div>
          </div>
          {i < chain.length - 1 && (
            <div className="absolute ml-0.5 mt-4 w-px h-2 bg-slate-600" />
          )}
        </div>
      ))}
    </div>
  );
}

// -- 行业信号雷达图 -------------------------------
function SectorRadar({ sectors }: { sectors: any[] }) {
  const radarData = sectors.slice(0, 6).map(s => ({
    sector: s.name,
    altDataScore: s.altDataScore,
    momentum: Math.abs(s.performance) * 10 + 50,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={radarData}>
        <PolarGrid stroke="#334155" />
        <PolarAngleAxis dataKey="sector" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#475569", fontSize: 9 }} />
        <Radar name="替代数据评分" dataKey="altDataScore" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} />
        <Radar name="动量信号" dataKey="momentum" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
        <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// -- 行业轮动热力图 -------------------------------
function SectorHeatmap({ sectors }: { sectors: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={sectors} layout="vertical" margin={{ left: 60, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={v => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`} />
        <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={55} />
        <Tooltip
          contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 6 }}
          labelStyle={{ color: "#e2e8f0" }}
          formatter={(v: any) => [`${v > 0 ? "+" : ""}${Number(v).toFixed(2)}%`, "表现"]}
        />
        <Bar dataKey="performance" fill="#22d3ee" radius={[0, 3, 3, 0]}
          label={{ position: "right", fill: "#94a3b8", fontSize: 9, formatter: (v: any) => `${v > 0 ? "+" : ""}${Number(v).toFixed(1)}%` }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// -- 主组件 ---------------------------------------
export default function BICO() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSector, setSelectedSector] = useState<any>(null);
  const [fromSector, setFromSector] = useState("科技");
  const [toSector, setToSector] = useState("金融");
  const [trigger, setTrigger] = useState("央行加息");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<string>("");
  const [causalResult, setCausalResult] = useState<any>(null);

  // 感知层：获取行业数据
  const { data: sectors, isLoading, dataUpdatedAt: sectorsReadAt } = trpc.derivatives.bico.getSectorOverview.useQuery({});
  // 感知层：替代数据信号
  const { data: altSignals, dataUpdatedAt: signalsReadAt } = trpc.derivatives.ai.getAltDataSignals.useQuery({ module: "BICO" });
  // 感知层：因果链
  const { data: causalChain, dataUpdatedAt: causalReadAt } = trpc.derivatives.ai.getCausalChain.useQuery({ event: "央行加息" });
  const hasSectors = Boolean(sectors?.length);

  // 执行层：行业轮动分析
  const rotateMutation = trpc.derivatives.bico.analyzeSectorRotation.useMutation({
    onSuccess: (data) => {
      setCausalResult(data);
      setAiResult(String(data.strategy || ""));
    },
  });

  // 执行层：AI 因果查询
  const aiMutation = trpc.derivatives.ai.causalQuery.useMutation({
    onSuccess: (data) => setAiResult(String(data.answer || "")),
  });

  const handleAiQuery = () => {
    if (!aiQuery.trim()) return;
    aiMutation.mutate({ module: "BICO 佑诚行业研究", query: aiQuery });
  };

  const handleRotationAnalysis = () => {
    rotateMutation.mutate({ fromSector, toSector, trigger });
  };

  const signalColor = (signal: string) => {
    if (signal === "超配") return "text-green-400";
    if (signal === "低配") return "text-red-400";
    return "text-yellow-400";
  };

  const riskColor = (risk: string) => {
    if (risk === "高") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (risk === "中") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-green-500/20 text-green-400 border-green-500/30";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-slate-400 hover:text-white p-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-cyan-400">BICO</span>
            <span className="text-sm text-slate-300">佑诚行业研究概况</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
            <Brain className="w-3 h-3 mr-1" />感知-推理-执行
          </Badge>
          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-300 bg-amber-500/10">
            <AlertTriangle className="w-3 h-3 mr-1" />外部数据未接入
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 三段式智能体状态栏 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-slate-900/60 border-cyan-500/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold text-cyan-400">感知层</span>
              <span className="text-xs text-slate-500">授权替代数据</span>
            </div>
            <div className="text-xs text-slate-400">来源与观测未提供</div>
            <div className="text-lg font-bold text-amber-300 mt-1">{altSignals?.length ?? 0} 个可验证信号</div>
          </Card>
          <Card className="bg-slate-900/60 border-orange-500/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-xs font-bold text-orange-400">推理层</span>
              <span className="text-xs text-slate-500">市场关联分析</span>
            </div>
            <div className="text-xs text-slate-400">仅在有可验证事件与观测时计算</div>
            <div className="text-lg font-bold text-amber-300 mt-1">{causalChain?.length ?? 0} 条可验证链</div>
          </Card>
          <Card className="bg-slate-900/60 border-green-500/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-bold text-green-400">执行层</span>
              <span className="text-xs text-slate-500">自主策略生成</span>
            </div>
            <div className="text-xs text-slate-400">行业轮动·衍生品策略</div>
            <div className="text-lg font-bold text-green-300 mt-1">待命</div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="overview" className="text-xs">行业概览</TabsTrigger>
            <TabsTrigger value="signals" className="text-xs">感知信号</TabsTrigger>
            <TabsTrigger value="rotation" className="text-xs">轮动分析</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">AI 因果查询</TabsTrigger>
          </TabsList>

          {/* 行业概览 */}
          <TabsContent value="overview" className="space-y-4 mt-3">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-slate-800 p-3">
                <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                  <BarChart2 className="w-3 h-3" /> 行业表现热力图
                </div>
                {isLoading ? (
                  <div className="h-40 flex items-center justify-center text-slate-500 text-xs">加载中...</div>
                ) : hasSectors ? <SectorHeatmap sectors={sectors || []} /> : <div data-bico-sector-status="unavailable" className="h-40 flex items-center justify-center text-center text-xs leading-5 text-amber-200">行业表现不可用：未接入可验证市场观测，不显示固定表现。</div>}
              </Card>
              <Card className="bg-slate-900/60 border-slate-800 p-3">
                <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> 替代数据评分雷达
                </div>
                {isLoading ? (
                  <div className="h-40 flex items-center justify-center text-slate-500 text-xs">加载中...</div>
                ) : hasSectors ? <SectorRadar sectors={sectors || []} /> : <div className="h-40 flex items-center justify-center text-center text-xs leading-5 text-amber-200">替代数据评分不可用：未接入授权来源，不显示评分或动量。</div>}
              </Card>
            </div>

            {/* 行业详情表格 */}
            <Card className="bg-slate-900/60 border-slate-800 p-3">
              <div className="text-xs text-slate-400 mb-3">行业研究矩阵 — 感知信号驱动的超/低配建议</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-1.5 px-2 text-slate-500">行业</th>
                      <th className="text-right py-1.5 px-2 text-slate-500">代码</th>
                      <th className="text-right py-1.5 px-2 text-slate-500">表现</th>
                      <th className="text-right py-1.5 px-2 text-slate-500">替代数据评分</th>
                      <th className="text-right py-1.5 px-2 text-slate-500">风险</th>
                      <th className="text-right py-1.5 px-2 text-slate-500">AI信号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasSectors && <tr><td colSpan={6} className="py-6 text-center text-amber-200">行业表现、评分、风险与配置建议均不可用；来源、观测日和读取时间未提供。</td></tr>}
                    {(sectors || []).map((s: any) => (
                      <tr
                        key={s.id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/40 cursor-pointer transition-colors"
                        onClick={() => setSelectedSector(s)}
                      >
                        <td className="py-1.5 px-2 text-slate-200">{s.name}</td>
                        <td className="py-1.5 px-2 text-right text-slate-400">{s.code}</td>
                        <td className={`py-1.5 px-2 text-right font-mono ${s.performance >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.performance >= 0 ? "+" : ""}{s.performance.toFixed(2)}%
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                style={{ width: `${s.altDataScore}%` }}
                              />
                            </div>
                            <span className="text-slate-300 font-mono">{s.altDataScore}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <Badge variant="outline" className={`text-xs ${riskColor(s.risk)}`}>{s.risk}</Badge>
                        </td>
                        <td className={`py-1.5 px-2 text-right font-bold ${signalColor(s.signal)}`}>{s.signal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 选中行业详情 */}
            {selectedSector && (
              <Card className="bg-slate-900/60 border-cyan-500/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-cyan-400">{selectedSector.name} 深度分析</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSector(null)} className="text-slate-500 text-xs h-6 px-2">关闭</Button>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2 rounded bg-slate-800/60">
                    <div className="text-slate-500 mb-1">替代数据评分</div>
                    <div className="text-2xl font-bold text-cyan-300">{selectedSector.altDataScore}</div>
                    <div className="text-slate-400">/ 100</div>
                  </div>
                  <div className="p-2 rounded bg-slate-800/60">
                    <div className="text-slate-500 mb-1">AI 配置建议</div>
                    <div className={`text-2xl font-bold ${signalColor(selectedSector.signal)}`}>{selectedSector.signal}</div>
                    <div className="text-slate-400">基于因果推理</div>
                  </div>
                  <div className="p-2 rounded bg-slate-800/60">
                    <div className="text-slate-500 mb-1">近期表现</div>
                    <div className={`text-2xl font-bold ${selectedSector.performance >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {selectedSector.performance >= 0 ? "+" : ""}{selectedSector.performance.toFixed(2)}%
                    </div>
                    <div className="text-slate-400">日涨跌幅</div>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* 感知信号 */}
          <TabsContent value="signals" className="space-y-4 mt-3">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-slate-800 p-3">
                <div className="text-xs font-bold text-cyan-400 mb-3 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> 全频谱替代数据信号
                </div>
                {altSignals ? <AltDataSignalPanel signals={altSignals} readAt={signalsReadAt} /> : (
                  <div className="text-xs text-slate-500">加载中...</div>
                )}
              </Card>
              <Card className="bg-slate-900/60 border-slate-800 p-3">
                <div className="text-xs font-bold text-orange-400 mb-3 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> 市场关联分析（央行加息）
                </div>
                {causalChain ? <CausalChainViz chain={causalChain} readAt={causalReadAt} /> : (
                  <div className="text-xs text-slate-500">加载中...</div>
                )}
              </Card>
            </div>
            <Card className="bg-slate-900/60 border-slate-800 p-3"><div className="text-xs font-bold text-yellow-400 mb-3">行业风险预警矩阵</div><div data-bico-risk-status="unavailable" className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200">状态：不可用。未接入可验证的行业表现、授权替代数据和事件观测；系统不以固定高/中/低风险分组、评分或配置建议替代。</div></Card>
          </TabsContent>

          {/* 行业轮动分析 */}
          <TabsContent value="rotation" className="space-y-4 mt-3">
            <Card className="bg-slate-900/60 border-slate-800 p-3">
              <div className="text-xs font-bold text-orange-400 mb-3 flex items-center gap-1">
                <Brain className="w-3 h-3" /> 行业轮动因果分析引擎
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">触发事件</label>
                  <Input
                    value={trigger}
                    onChange={e => setTrigger(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-200 text-xs h-8"
                    placeholder="如：央行加息"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">流出行业</label>
                  <Input
                    value={fromSector}
                    onChange={e => setFromSector(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-200 text-xs h-8"
                    placeholder="如：科技"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">流入行业</label>
                  <Input
                    value={toSector}
                    onChange={e => setToSector(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-200 text-xs h-8"
                    placeholder="如：金融"
                  />
                </div>
              </div>
              <Button
                onClick={handleRotationAnalysis}
                disabled={rotateMutation.isPending}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs h-8"
              >
                {rotateMutation.isPending ? (
                  <><RefreshCw className="w-3 h-3 mr-2 animate-spin" />因果推理中...</>
                ) : (
                  <><Zap className="w-3 h-3 mr-2" />启动因果分析</>
                )}
              </Button>
            </Card>

            {causalResult && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-900/60 border-orange-500/20 p-3">
                  <div className="text-xs font-bold text-orange-400 mb-2">因果链（{causalResult.causalChain?.length} 节点）</div>
                  <CausalChainViz chain={causalResult.causalChain || []} />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">置信度</span>
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${causalResult.confidence}%` }} />
                    </div>
                    <span className="text-xs text-orange-400 font-mono">{causalResult.confidence}%</span>
                  </div>
                </Card>
                <Card className="bg-slate-900/60 border-green-500/20 p-3">
                  <div className="text-xs font-bold text-green-400 mb-2">执行层：衍生品策略</div>
                  <div className="text-xs text-slate-300 leading-relaxed">{causalResult.strategy}</div>
                  <div className="mt-3">
                    <div className="text-xs text-slate-500 mb-1">关键风险</div>
                    {(causalResult.risks || []).map((r: string, i: number) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-red-400 mb-0.5">
                        <AlertTriangle className="w-3 h-3" />{r}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* AI 因果查询 */}
          <TabsContent value="ai" className="space-y-4 mt-3">
            <Card className="bg-slate-900/60 border-slate-800 p-3">
              <div className="text-xs font-bold text-cyan-400 mb-3 flex items-center gap-1">
                <Brain className="w-3 h-3" /> 自然语言因果查询引擎
              </div>
              <div className="flex gap-2 mb-3">
                <Input
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAiQuery()}
                  placeholder="例：如果美联储在下次会议加息50bp，哪些行业会受益？"
                  className="bg-slate-800 border-slate-700 text-slate-200 text-xs"
                />
                <Button
                  onClick={handleAiQuery}
                  disabled={aiMutation.isPending}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3"
                >
                  {aiMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
              </div>
              {/* 快捷问题 */}
              <div className="flex flex-wrap gap-1 mb-3">
                {[
                  "当前哪个行业的替代数据信号最强？",
                  "利率上升50bp对行业轮动的因果链是什么？",
                  "如何用行业ETF期权构建行业轮动策略？",
                  "哪些行业在地缘政治风险下表现最好？",
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setAiQuery(q); }}
                    className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
              {aiResult && (
                <div className="p-3 rounded bg-slate-800/60 border border-cyan-500/20">
                  <div className="text-xs text-cyan-400 mb-2 flex items-center gap-1">
                    <Brain className="w-3 h-3" /> AI 因果分析结果
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <Streamdown>{aiResult}</Streamdown>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

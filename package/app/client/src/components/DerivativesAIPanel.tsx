/**
 * DerivativesAIPanel — 衍生品 AI 智能体闭环面板 v2
 * 感知层（全频谱替代数据信号）→ 推理层（市场关联分析）→ 执行层（自主策略生成 + 动态风险报告）
 * 新增：接收页面实时计算指标，调用 LLM 生成基于真实数据的风险分析报告
 */
import { useState } from "react";
import { Brain, Zap, Activity, Send, RefreshCw, AlertTriangle, ChevronRight, FileText, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

// -- 感知层信号面板 ------------------------------
function SignalPanel({ signals, readAt }: { signals: any[]; readAt?: number }) {
  if (!signals.length) {
    return <div data-alt-data-status="unavailable" className="rounded border border-amber-900/60 bg-amber-950/20 p-2 text-xs leading-5 text-amber-200">状态：不可用。来源：授权替代数据服务未接入；观测日：未提供；读取时间：{readAt ? new Date(readAt).toLocaleString('zh-CN', { hour12: false }) : '未提供'}。系统未以固定传感器、新闻、情绪或期权信号替代。</div>;
  }
  return (
    <div className="space-y-1.5">
      {signals.map((s, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded bg-slate-800/60 border border-slate-700/40">
          <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
            s.impact === "negative" ? "bg-red-400" :
            s.impact === "warning" ? "bg-yellow-400" : "bg-green-400"
          }`} />
          <span className="text-xs text-slate-400 w-20 flex-shrink-0">{s.source}</span>
          <span className="text-xs text-slate-200 flex-1">{s.signal}</span>
          <span className="text-xs font-mono text-cyan-400">{Math.round(s.confidence * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

// -- 因果链可视化 ---------------------------------
function CausalChain({ chain }: { chain: any[] }) {
  return (
    <div className="space-y-1">
      {chain.map((node, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              node.type === "trigger" ? "bg-red-400" :
              node.type === "direct" ? "bg-orange-400" :
              node.type === "secondary" ? "bg-yellow-400" : "bg-blue-400"
            }`} />
            {i < chain.length - 1 && <div className="w-px h-3 bg-slate-700" />}
          </div>
          <div className="flex-1 flex items-center justify-between p-1.5 rounded bg-slate-800/60 border border-slate-700/30">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs px-1 rounded ${
                node.type === "trigger" ? "bg-red-500/20 text-red-400" :
                node.type === "direct" ? "bg-orange-500/20 text-orange-400" :
                node.type === "secondary" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"
              }`}>{node.type === "trigger" ? "触发" : node.type === "direct" ? "直接" : node.type === "secondary" ? "间接" : "三阶"}</span>
              <span className="text-xs text-slate-200">{node.node}</span>
            </div>
            <div className="flex items-center gap-2">
              {node.lag && <span className="text-xs text-slate-500">{node.lag}</span>}
              <span className="text-xs font-mono text-cyan-400">{Math.round(node.probability * 100)}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// -- 主组件 ---------------------------------------
interface DerivativesAIPanelProps {
  moduleCode: string;
  moduleName: string;
  accentColor?: string;
  /** 页面实时计算指标，用于 LLM 动态风险报告 */
  liveMetrics?: Record<string, string | number>;
}

export default function DerivativesAIPanel({
  moduleCode,
  moduleName,
  accentColor = "cyan",
  liveMetrics,
}: DerivativesAIPanelProps) {
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [causalEvent, setCausalEvent] = useState("央行加息");
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [riskReport, setRiskReport] = useState("");
  const [activeTab, setActiveTab] = useState("strategy");

  // 感知层：替代数据信号
  const { data: altSignals, isLoading: signalsLoading, dataUpdatedAt: signalsReadAt } = trpc.derivatives.ai.getAltDataSignals.useQuery(
    { module: moduleCode },
    { staleTime: 60000 }
  );

  // 推理层：因果链
  const { data: causalChain, isLoading: chainLoading } = trpc.derivatives.ai.getCausalChain.useQuery(
    { event: causalEvent },
    { staleTime: 60000 }
  );

  // 执行层：AI 因果查询
  const aiMutation = trpc.derivatives.ai.causalQuery.useMutation({
    onSuccess: (data) => setAiResult(String(data.answer || "")),
  });

  // 执行层：模块专属策略生成
  const strategyMutation = trpc.derivatives.ai.generateStrategy.useMutation({
    onSuccess: (data) => {
      setExecutionResult(data);
      setAiResult(String(data.strategy || ""));
    },
  });

  // 新增：动态风险报告（基于实时指标）
  const riskReportMutation = trpc.derivatives.ai.generateRiskReport.useMutation({
    onSuccess: (data) => {
      setRiskReport(String(data.report || ""));
      setActiveTab("report");
    },
  });

  const handleAiQuery = () => {
    if (!aiQuery.trim()) return;
    aiMutation.mutate({ module: `${moduleCode} ${moduleName}`, query: aiQuery });
  };

  const handleGenerateStrategy = () => {
    strategyMutation.mutate({ module: moduleCode, moduleName, causalEvent });
  };

  const handleGenerateRiskReport = () => {
    const metrics = liveMetrics && Object.keys(liveMetrics).length > 0
      ? liveMetrics
      : { "状态": "页面未提供实时指标，请基于通用市场状态分析" };
    riskReportMutation.mutate({ module: moduleCode, moduleName, metrics });
  };

  const quickQuestions: Record<string, string[]> = {
    SWPM: ["当前掉期利差的因果驱动因素是什么？", "如何用掉期对冲利率上行风险？", "SOFR曲线倒挂对掉期定价的影响？"],
    OVME: ["当前隐含波动率偏斜的成因是什么？", "如何构建Delta中性的期权组合？", "VIX飙升对期权策略的影响？"],
    OVCV: ["可转债的期权价值如何分解？", "信用利差走阔对可转债的影响？", "如何用可转债套利策略？"],
    DLIB: ["当前最活跃的衍生品策略有哪些？", "如何用期权组合实现行业轮动？", "衍生品库中的最优对冲工具？"],
    VCA: ["当前波动率曲面的异常信号？", "如何用波动率套利策略？", "隐含波动率与实现波动率的偏差？"],
    MARS: ["当前投资组合的VaR超标风险？", "如何降低多资产组合的尾部风险？", "压力测试显示的最大回撤场景？"],
    BICO: ["当前哪个行业的替代数据信号最强？", "利率上升对行业轮动的因果链？", "如何用行业ETF期权构建轮动策略？"],
    CDSW: ["当前信用违约互换利差的驱动因素？", "如何用CDS对冲信用风险？", "CDS利差走阔的因果链？"],
    WBF: ["当前债券期货的最优对冲比率？", "如何用债券期货管理久期风险？", "国债期货曲线的异常信号？"],
    DERI: ["当前衍生品市场的系统性风险？", "如何构建跨资产衍生品策略？", "衍生品定价模型的选择依据？"],
    MOSO: ["当前期权流异常信号的含义？", "P/C比率偏低意味着什么？", "如何跟踪大单扫描信号交易？"],
    OVML: ["Garman-Kohlhagen模型的关键假设？", "外汇期权的Delta对冲频率？", "波动率微笑对外汇期权定价的影响？"],
    WVOL: ["当前FX波动率曲面的异常点？", "Risk Reversal信号的交易含义？", "跨货币波动率套利机会？"],
    WCDS: ["当前主权CDS利差扩大的原因？", "CDS-债券基差的套利机会？", "高收益债CDS与IG的利差分化？"],
  };

  const questions = quickQuestions[moduleCode] || [
    "当前市场的主要风险因素是什么？",
    "如何构建最优对冲策略？",
    "替代数据信号显示什么趋势？",
  ];

  const hasLiveMetrics = liveMetrics && Object.keys(liveMetrics).length > 0;

  return (
    <div className="space-y-4">
      {/* 三段式状态栏 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "感知层", desc: "全频谱替代数据", count: altSignals?.length ?? 5, unit: "个信号", color: "cyan", dot: "bg-cyan-400" },
          { label: "推理层", desc: "市场关联分析", count: causalChain?.length ?? 4, unit: "跳因果", color: "orange", dot: "bg-orange-400" },
          { label: "执行层", desc: "自主策略生成", count: executionResult ? 1 : 0, unit: executionResult ? "策略就绪" : "待命", color: "green", dot: "bg-green-400" },
        ].map((item, i) => (
          <div key={i} className={`p-2.5 rounded-lg border ${
            item.color === "cyan" ? "border-cyan-500/20 bg-cyan-500/5" :
            item.color === "orange" ? "border-orange-500/20 bg-orange-500/5" :
            "border-green-500/20 bg-green-500/5"
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${item.dot}`} />
              <span className={`text-xs font-bold ${
                item.color === "cyan" ? "text-cyan-400" :
                item.color === "orange" ? "text-orange-400" : "text-green-400"
              }`}>{item.label}</span>
            </div>
            <div className="text-xs text-slate-500">{item.desc}</div>
            <div className={`text-base font-bold mt-0.5 ${
              item.color === "cyan" ? "text-cyan-300" :
              item.color === "orange" ? "text-orange-300" : "text-green-300"
            }`}>{item.count} {item.unit}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 感知层：替代数据信号 */}
        <Card className="bg-slate-900/60 border-slate-800 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-400">感知层 — 全频谱替代数据信号</span>
          </div>
          {signalsLoading ? (
            <div className="text-xs text-slate-500">加载信号中...</div>
          ) : (
            <SignalPanel signals={altSignals || []} readAt={signalsReadAt} />
          )}
        </Card>

        {/* 推理层：因果链 */}
        <Card className="bg-slate-900/60 border-slate-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-orange-400" />
              <span className="text-xs font-bold text-orange-400">推理层 — 市场关联分析</span>
            </div>
            <select
              value={causalEvent}
              onChange={e => setCausalEvent(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded px-1 py-0.5"
            >
              <option value="央行加息">央行加息</option>
              <option value="地缘政治风险">地缘政治风险</option>
              <option value="default">市场信号</option>
            </select>
          </div>
          {chainLoading ? (
            <div className="text-xs text-slate-500">推理中...</div>
          ) : (
            <CausalChain chain={causalChain || []} />
          )}
        </Card>
      </div>

      {/* 执行层：策略生成 + 动态风险报告 */}
      <Card className="bg-slate-900/60 border-slate-800 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Brain className="w-3 h-3 text-green-400" />
            <span className="text-xs font-bold text-green-400">执行层 — 自主策略 & 风险报告</span>
          </div>
          <div className="flex gap-2">
            {/* 动态风险报告按钮 */}
            <Button
              onClick={handleGenerateRiskReport}
              disabled={riskReportMutation.isPending}
              size="sm"
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 px-3"
              title={hasLiveMetrics ? `基于页面 ${Object.keys(liveMetrics!).length} 个实时指标生成报告` : "生成通用风险报告"}
            >
              {riskReportMutation.isPending ? (
                <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />报告生成中...</>
              ) : (
                <><FileText className="w-3 h-3 mr-1" />
                {hasLiveMetrics ? `实时风险报告 (${Object.keys(liveMetrics!).length}项数据)` : "生成风险报告"}
                </>
              )}
            </Button>
            <Button
              onClick={handleGenerateStrategy}
              disabled={strategyMutation.isPending}
              size="sm"
              className="bg-green-600 hover:bg-green-500 text-white text-xs h-7 px-3"
            >
              {strategyMutation.isPending ? (
                <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />生成中...</>
              ) : (
                <><Zap className="w-3 h-3 mr-1" />生成策略</>
              )}
            </Button>
          </div>
        </div>

        {/* 实时指标预览（若有） */}
        {hasLiveMetrics && (
          <div className="mb-3 p-2 rounded bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-amber-400 font-bold">页面实时指标（将传入 LLM 分析）</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(liveMetrics!).slice(0, 9).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs p-1 rounded bg-slate-800/60">
                  <span className="text-slate-500 truncate mr-1">{k}</span>
                  <span className="text-amber-300 font-mono flex-shrink-0">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI 自然语言查询 */}
        <div className="flex gap-2 mb-2">
          <Input
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAiQuery()}
            placeholder={`向 ${moduleCode} AI 智能体提问...`}
            className="bg-slate-800 border-slate-700 text-slate-200 text-xs h-8"
          />
          <Button
            onClick={handleAiQuery}
            disabled={aiMutation.isPending}
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white h-8 px-3"
          >
            {aiMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </div>

        {/* 快捷问题 */}
        <div className="flex flex-wrap gap-1 mb-3">
          {questions.map((q, i) => (
            <button
              key={i}
              onClick={() => setAiQuery(q)}
              className="text-xs px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* 结果展示：策略 / 风险报告 Tab */}
        {(aiResult || riskReport) && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800 h-7 mb-2">
              {aiResult && (
                <TabsTrigger value="strategy" className="text-xs h-6 data-[state=active]:bg-slate-700">
                  <Zap className="w-3 h-3 mr-1" />策略分析
                </TabsTrigger>
              )}
              {riskReport && (
                <TabsTrigger value="report" className="text-xs h-6 data-[state=active]:bg-slate-700">
                  <FileText className="w-3 h-3 mr-1" />风险报告
                </TabsTrigger>
              )}
            </TabsList>

            {aiResult && (
              <TabsContent value="strategy" className="mt-0">
                <div className="p-3 rounded bg-slate-800/60 border border-cyan-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-3 h-3 text-cyan-400" />
                    <span className="text-xs text-cyan-400 font-bold">AI 因果分析 / 策略建议</span>
                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400 ml-auto">
                      {moduleCode}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <Streamdown>{aiResult}</Streamdown>
                  </div>
                  {executionResult?.risks && executionResult.risks.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <div className="text-xs text-slate-500 mb-1">关键风险</div>
                      {executionResult.risks.map((r: string, i: number) => (
                        <div key={i} className="flex items-center gap-1 text-xs text-red-400 mb-0.5">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />{r}
                        </div>
                      ))}
                    </div>
                  )}
                  {executionResult?.confidence && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-500">置信度</span>
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full">
                        <div className="h-full rounded-full bg-green-400" style={{ width: `${executionResult.confidence}%` }} />
                      </div>
                      <span className="text-xs text-green-400 font-mono">{executionResult.confidence}%</span>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {riskReport && (
              <TabsContent value="report" className="mt-0">
                <div className="p-3 rounded bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-amber-400 font-bold">实时风险分析报告</span>
                    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 ml-auto">
                      {moduleName} · {new Date().toLocaleTimeString()}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed prose prose-invert prose-xs max-w-none">
                    <Streamdown>{riskReport}</Streamdown>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* 执行层策略结果（独立展示，非 Tab） */}
        {executionResult && !aiResult && (
          <div className="mt-3 p-3 rounded bg-green-500/5 border border-green-500/20">
            <div className="flex items-center gap-1.5 mb-2">
              <ChevronRight className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-400 font-bold">执行层 — 自主策略建议</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

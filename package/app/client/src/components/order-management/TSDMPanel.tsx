import React, { useState } from 'react';
import { Play, Pause, RotateCcw, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const demoScenarios = [
  {
    id: 'aim_basic',
    title: 'AIM 基础委托演示',
    category: 'AIM OMS',
    duration: '3分钟',
    difficulty: '入门',
    description: '演示如何在 AIM 系统中创建、监控和管理一笔标准股票买入委托，包括算法选择和风险检查。',
    steps: [
      { step: 1, action: '打开新建委托面板', detail: '点击"新建委托"标签，界面显示委托输入表单' },
      { step: 2, action: '输入证券代码 AAPL', detail: '系统自动加载 Apple Inc. 当前行情：$175.42' },
      { step: 3, action: '设置委托参数', detail: '方向: BUY | 数量: 10,000 | 限价: $176.00 | 算法: VWAP' },
      { step: 4, action: '风险预检', detail: '系统检查：单笔限额 ✓ | 集中度 ✓ | VaR 影响 ✓' },
      { step: 5, action: '提交委托', detail: '委托号 AIM-20240702-001 已提交，状态: PENDING' },
      { step: 6, action: '监控执行进度', detail: 'VWAP 算法开始执行，已成交 2,340/10,000 (23.4%)' },
    ]
  },
  {
    id: 'toms_rfq',
    title: 'TOMS RFQ 债券询价演示',
    category: 'TOMS',
    duration: '5分钟',
    difficulty: '中级',
    description: '演示债券 RFQ 询价完整流程：从客户询价到多商报价比较，再到最优执行成交。',
    steps: [
      { step: 1, action: '接收客户询价请求', detail: '客户: ABC Fund | 债券: US912828ZL65 | 数量: $5M | 方向: BUY' },
      { step: 2, action: '发送询价至交易商', detail: '同时向 Goldman Sachs、JPMorgan、Citi、BofA 发送 RFQ' },
      { step: 3, action: '收集报价', detail: 'GS: 98.125 | JPM: 98.110 | Citi: 98.135 | BofA: 98.090' },
      { step: 4, action: '最优报价分析', detail: '最优: Citi 98.135（收益率 3.842%），节省约 $12,500' },
      { step: 5, action: '确认成交', detail: '向 Citi 确认成交，发送 FIX ExecutionReport' },
      { step: 6, action: '生成确认书', detail: '自动生成成交确认书，提交 TRACE 报告，更新持仓' },
    ]
  },
  {
    id: 'risk_breach',
    title: 'MARS 风险突破处理演示',
    category: 'RISK',
    duration: '4分钟',
    difficulty: '高级',
    description: '演示当委托触发风险限额时，系统如何自动拦截并提示交易员进行风险处置。',
    steps: [
      { step: 1, action: '提交大额委托', detail: '尝试买入 AAPL 500,000 股，金额约 $87.7M' },
      { step: 2, action: '风险检查触发', detail: '集中度检查失败：AAPL 将占组合 12.3%，超过 10% 限额' },
      { step: 3, action: '系统拦截委托', detail: '委托状态: RISK_REJECTED | 原因: CONCENTRATION_LIMIT' },
      { step: 4, action: '风险覆盖申请', detail: '交易员申请风险覆盖，填写理由并提交风控审批' },
      { step: 5, action: '风控审批', detail: '风控主管审批通过，临时提升 AAPL 集中度限额至 15%' },
      { step: 6, action: '委托重新提交', detail: '委托重新提交成功，系统记录风险覆盖日志' },
    ]
  },
  {
    id: 'etf_creation',
    title: 'ETF 一级市场申购演示',
    category: 'ETF',
    duration: '6分钟',
    difficulty: '高级',
    description: '演示 ETF 申购创建完整流程：从篮子计算到实物申购，再到 ETF 份额交付。',
    steps: [
      { step: 1, action: '选择 ETF 产品', detail: 'ETF: SPY（SPDR S&P 500）| 申购单位: 50,000 份' },
      { step: 2, action: '获取申购篮子', detail: '系统从基金公司获取当日 PCF（Portfolio Composition File）' },
      { step: 3, action: '篮子股票采购', detail: '需采购 503 只成分股，总金额约 $24.2M，使用 VWAP 算法' },
      { step: 4, action: '实物交割', detail: '所有成分股采购完成，提交实物申购至基金公司' },
      { step: 5, action: '份额确认', detail: '基金公司确认收到实物，生成 50,000 份 SPY ETF 份额' },
      { step: 6, action: '二级市场上市', detail: 'ETF 份额在 NYSE Arca 上市交易，套利窗口关闭' },
    ]
  },
];

export default function TSDMPanel() {
  const [selectedScenario, setSelectedScenario] = useState(demoScenarios[0]);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const handleStart = () => {
    setRunning(true);
    setCurrentStep(0);
    setCompletedSteps([]);
    runNextStep(0);
  };

  const runNextStep = (step: number) => {
    if (step >= selectedScenario.steps.length) {
      setRunning(false);
      toast.success('演示完成！', { description: `${selectedScenario.title} 演示已成功完成` });
      return;
    }
    setTimeout(() => {
      setCurrentStep(step);
      setCompletedSteps(prev => [...prev, step]);
      runNextStep(step + 1);
    }, 1800);
  };

  const handleReset = () => {
    setRunning(false);
    setCurrentStep(0);
    setCompletedSteps([]);
  };

  const difficultyColor = { '入门': 'text-green-400 bg-green-400/10', '中级': 'text-yellow-400 bg-yellow-400/10', '高级': 'text-red-400 bg-red-400/10' } as Record<string, string>;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <span className="text-[#d4af37] font-bold text-sm">TSDM</span>
        <span className="text-[#888]">|</span>
        <span className="text-[#ccc]">交易系统演示功能中心 — 交互式场景演练</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Scenario List */}
        <div className="w-64 bg-[#0d0d14] border-r border-[#1a1a2e] overflow-auto">
          <div className="p-3 text-[#666] text-[10px] border-b border-[#1a1a2e]">选择演示场景</div>
          {demoScenarios.map(scenario => (
            <button key={scenario.id} onClick={() => { setSelectedScenario(scenario); handleReset(); }}
              className={`w-full text-left p-3 border-b border-[#111] transition-colors ${selectedScenario.id === scenario.id ? 'bg-[#d4af37]/10 border-l-2 border-l-[#d4af37]' : 'hover:bg-[#1a1a2e]'}`}>
              <div className="flex justify-between items-start mb-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedScenario.id === scenario.id ? 'text-[#d4af37]' : 'text-[#888]'} font-bold`}>{scenario.category}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${difficultyColor[scenario.difficulty]}`}>{scenario.difficulty}</span>
              </div>
              <div className={`font-bold text-[11px] ${selectedScenario.id === scenario.id ? 'text-[#d4af37]' : 'text-[#ccc]'}`}>{scenario.title}</div>
              <div className="text-[#555] text-[10px] mt-0.5 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{scenario.duration}</div>
            </button>
          ))}
        </div>

        {/* Demo Area */}
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-[#d4af37] font-bold text-sm">{selectedScenario.title}</h2>
                <p className="text-[#888] text-[11px] mt-1">{selectedScenario.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleReset} disabled={running} className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a2e] rounded text-[#888] hover:text-[#ccc] text-[11px] disabled:opacity-50">
                  <RotateCcw className="w-3 h-3" />重置
                </button>
                <button onClick={handleStart} disabled={running}
                  className="flex items-center gap-1 px-4 py-1.5 bg-[#d4af37] rounded text-black font-bold text-[11px] hover:bg-[#e5c158] disabled:opacity-50">
                  {running ? <><Pause className="w-3 h-3" />演示中...</> : <><Play className="w-3 h-3" />开始演示</>}
                </button>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {selectedScenario.steps.map((step, i) => {
              const isCompleted = completedSteps.includes(i);
              const isCurrent = currentStep === i && running;
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded border transition-all ${isCompleted ? 'border-green-400/30 bg-green-400/5' : isCurrent ? 'border-[#d4af37]/50 bg-[#d4af37]/5' : 'border-[#222] bg-[#111118]'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${isCompleted ? 'bg-green-400 text-black' : isCurrent ? 'bg-[#d4af37] text-black' : 'bg-[#222] text-[#555]'}`}>
                    {isCompleted ? <CheckCircle className="w-3.5 h-3.5" /> : step.step}
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold text-[11px] ${isCompleted ? 'text-green-400' : isCurrent ? 'text-[#d4af37]' : 'text-[#888]'}`}>{step.action}</div>
                    {(isCompleted || isCurrent) && (
                      <div className="text-[#666] text-[11px] mt-0.5 flex items-center gap-1">
                        <ArrowRight className="w-2.5 h-2.5" />{step.detail}
                      </div>
                    )}
                  </div>
                  {isCurrent && <div className="w-3 h-3 rounded-full bg-[#d4af37] animate-pulse flex-shrink-0 mt-1" />}
                </div>
              );
            })}
          </div>

          {completedSteps.length === selectedScenario.steps.length && completedSteps.length > 0 && (
            <div className="mt-4 p-4 bg-green-400/10 border border-green-400/30 rounded text-center">
              <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <div className="text-green-400 font-bold">演示完成！</div>
              <div className="text-[#888] text-[11px] mt-1">您已完成 {selectedScenario.title} 的全部 {selectedScenario.steps.length} 个步骤</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

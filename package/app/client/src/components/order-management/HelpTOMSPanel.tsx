import React, { useState } from 'react';
import { Search, BookOpen, ChevronRight, ChevronDown } from 'lucide-react';

const tomsHelp = [
  {
    category: '系统架构',
    icon: '🏗️',
    topics: [
      { title: 'TOMS 系统概述', content: 'TOMS（Trade Order Management System）是专为卖方机构设计的债券委托管理系统，支持政府债、公司债、资产支持证券、可转债等全品种固收产品的委托管理、报价、执行和报告。系统每日处理委托量超过 9000 笔，平均延迟 1.8ms。' },
      { title: '核心模块架构', content: '系统分为六大核心模块：1）委托接收与路由（FIX/API/语音）；2）报价引擎（实时双边报价）；3）执行引擎（DMA/算法/RFQ）；4）持仓管理；5）风险控制（MARS 集成）；6）监管报告（MiFID II/TRACE）。' },
      { title: 'FIX 协议集成', content: 'TOMS 支持 FIX 4.2/4.4/5.0 协议，提供标准 FIX 消息类型：NewOrderSingle(D)、OrderCancelRequest(F)、ExecutionReport(8)、OrderCancelReplaceRequest(G)。FIX 会话心跳间隔 30 秒，重连最多 5 次。' },
    ]
  },
  {
    category: '债券委托管理',
    icon: '📋',
    topics: [
      { title: '债券委托类型', content: '支持以下委托类型：1）市价委托（Market）- 立即以最优价格成交；2）限价委托（Limit）- 指定价格或更优价格成交；3）止损委托（Stop）- 触发价格后转为市价；4）冰山委托（Iceberg）- 隐藏大单，分批显示；5）RFQ 询价委托 - 向多个交易商询价后执行。' },
      { title: 'RFQ 询价流程', content: 'RFQ（Request for Quote）流程：1）客户发起询价请求，指定债券、数量、方向；2）系统同时向 3-5 家交易商发送询价；3）交易商在 30 秒内回复报价；4）系统显示最优报价并推荐执行；5）客户确认后系统自动成交并发送确认书。' },
      { title: '债券定价与估值', content: '系统集成实时债券定价：收益率曲线（国债/信用利差）、久期/凸性计算、DV01/CS01 风险指标、全价/净价转换、应计利息计算。支持 Ucheer BVAL、Markit、内部估值模型三种定价源。' },
    ]
  },
  {
    category: '报告与合规',
    icon: '📊',
    topics: [
      { title: 'TRACE 报告', content: 'TRACE（Trade Reporting and Compliance Engine）要求所有公司债交易在成交后 15 分钟内上报。TOMS 自动生成并提交 TRACE 报告，包括：CUSIP、成交量、价格、成交时间、买卖方向、交易商标识。' },
      { title: 'MiFID II 报告', content: 'MiFID II 要求在 T+1 向 ARM（Approved Reporting Mechanism）提交交易报告，包含 65 个必填字段。TOMS 自动填充所有字段，包括 LEI 码、CFI 码、MIC 码、ISIN 码，合规率 100%。' },
      { title: '日终报告生成', content: '系统每日 16:30 自动生成日终报告：成交确认书、持仓变动报告、风险敞口报告、P&L 报告、监管报告汇总。报告格式支持 PDF、Excel、XML 导出。' },
    ]
  },
];

export default function HelpTOMSPanel() {
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('系统架构');
  const [selectedTopic, setSelectedTopic] = useState<any>(tomsHelp[0].topics[0]);

  const filtered = tomsHelp.map(cat => ({
    ...cat,
    topics: cat.topics.filter(t => !search || t.title.includes(search) || t.content.includes(search))
  })).filter(cat => cat.topics.length > 0);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <span className="text-[#d4af37] font-bold text-sm">HELP TOMS</span>
        <span className="text-[#888]">|</span>
        <span className="text-[#ccc]">TOMS 功能说明 — 卖方债券委托管理系统用户手册</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 bg-[#0d0d14] border-r border-[#1a1a2e] flex flex-col overflow-hidden">
          <div className="p-2 border-b border-[#1a1a2e]">
            <div className="flex items-center gap-1 bg-[#1a1a2e] rounded px-2 py-1">
              <Search className="w-3 h-3 text-[#666]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜索..." className="bg-transparent outline-none text-xs w-full text-[#ccc] placeholder-[#444]" />
            </div>
          </div>
          <div className="overflow-auto flex-1">
            {filtered.map(cat => (
              <div key={cat.category}>
                <button onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a2e]">
                  <span>{cat.icon}</span>
                  <span className="text-[#d4af37] font-bold text-[11px] flex-1">{cat.category}</span>
                  {expandedCategory === cat.category ? <ChevronDown className="w-3 h-3 text-[#555]" /> : <ChevronRight className="w-3 h-3 text-[#555]" />}
                </button>
                {expandedCategory === cat.category && cat.topics.map(topic => (
                  <button key={topic.title} onClick={() => setSelectedTopic(topic)}
                    className={`w-full text-left px-6 py-1.5 text-[11px] transition-colors ${selectedTopic?.title === topic.title ? 'text-[#d4af37] bg-[#d4af37]/10' : 'text-[#888] hover:text-[#ccc]'}`}>
                    {topic.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {selectedTopic ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-[#d4af37]" />
                <h2 className="text-[#d4af37] font-bold text-base">{selectedTopic.title}</h2>
              </div>
              <div className="bg-[#111118] border border-[#222] rounded p-4">
                <p className="text-[#ccc] leading-relaxed text-[12px]">{selectedTopic.content}</p>
              </div>
              <div className="mt-4 p-3 bg-[#1a1a2e] rounded border border-[#d4af37]/20">
                <div className="text-[#d4af37] font-bold text-[11px] mb-2">📌 操作要点</div>
                <p className="text-[#888] text-[11px]">如需进一步了解 TOMS 系统功能，请参阅完整用户手册或联系系统管理员。所有配置变更需经过合规审批方可生效。</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[#444]">请从左侧选择主题</div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Activity, TrendingUp, Shield, Zap, Globe, BarChart2 } from 'lucide-react';

const performanceData = [
  { month: 'Jan', alpha: 1.2, benchmark: 0.8, tracking: 0.4 },
  { month: 'Feb', alpha: -0.3, benchmark: 1.1, tracking: 0.6 },
  { month: 'Mar', alpha: 2.1, benchmark: 1.5, tracking: 0.3 },
  { month: 'Apr', alpha: 0.8, benchmark: 0.5, tracking: 0.5 },
  { month: 'May', alpha: 1.5, benchmark: 1.2, tracking: 0.4 },
  { month: 'Jun', alpha: -0.5, benchmark: 0.3, tracking: 0.7 },
];

const radarData = [
  { subject: '执行质量', A: 92, B: 75 },
  { subject: '成本控制', A: 88, B: 70 },
  { subject: '风险管理', A: 95, B: 80 },
  { subject: '合规性', A: 98, B: 90 },
  { subject: '流动性', A: 85, B: 72 },
  { subject: '技术能力', A: 90, B: 68 },
];

const solutions = [
  { name: 'AIM - 买方OMS', desc: '全功能委托管理系统，支持多资产类别、算法执行、实时风险监控', status: 'ACTIVE', users: 1240, coverage: '全球' },
  { name: 'PORT - 投资组合管理', desc: '组合构建、再平衡、绩效归因、风险分解', status: 'ACTIVE', users: 890, coverage: '全球' },
  { name: 'MARS - 风险分析', desc: '多因子风险模型、VaR计算、情景分析、压力测试', status: 'ACTIVE', users: 650, coverage: '全球' },
  { name: 'EMSX - 执行管理', desc: '算法执行、智能路由、暗池接入、TCA分析', status: 'ACTIVE', users: 780, coverage: '全球' },
  { name: 'PRTU - 组合追踪', desc: '基准追踪、偏差预警、再平衡建议', status: 'ACTIVE', users: 420, coverage: '全球' },
  { name: 'BVAL - 债券估值', desc: '固定收益产品实时估值、模型定价、价格验证', status: 'ACTIVE', users: 560, coverage: '全球' },
];

export default function BBSPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'solutions' | 'workflow'>('overview');

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">BBS</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">Overview: Buy-Side Solutions — 买方解决方案概览</span>
        </div>
        <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
      </div>

      <div className="flex border-b border-[#222]">
        {[
          { id: 'overview', label: '平台概览' },
          { id: 'performance', label: '绩效分析' },
          { id: 'solutions', label: '解决方案' },
          { id: 'workflow', label: '工作流程' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: <Globe className="w-5 h-5" />, label: '覆盖市场', value: '150+', sub: '全球交易所', color: '#d4af37' },
                { icon: <Activity className="w-5 h-5" />, label: '日均委托', value: '2.4M', sub: '笔/日', color: '#4ade80' },
                { icon: <Shield className="w-5 h-5" />, label: '合规覆盖', value: '98.7%', sub: 'MiFID II/SEC', color: '#60a5fa' },
                { icon: <Zap className="w-5 h-5" />, label: '执行延迟', value: '<2ms', sub: '平均响应', color: '#f97316' },
              ].map((kpi, i) => (
                <div key={i} className="bg-[#111118] border border-[#222] rounded p-4 flex items-start gap-3">
                  <div style={{ color: kpi.color }}>{kpi.icon}</div>
                  <div>
                    <div className="text-[#666] text-[10px]">{kpi.label}</div>
                    <div className="font-bold text-lg" style={{ color: kpi.color }}>{kpi.value}</div>
                    <div className="text-[#555] text-[10px]">{kpi.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#d4af37] font-bold mb-3">买方能力雷达图</div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#222" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#555', fontSize: 9 }} />
                    <Radar name="Ucheer BBS" dataKey="A" stroke="#d4af37" fill="#d4af37" fillOpacity={0.2} />
                    <Radar name="行业平均" dataKey="B" stroke="#4ade80" fill="#4ade80" fillOpacity={0.1} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#d4af37] font-bold mb-3">月度 Alpha 贡献</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} unit="%" />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="alpha" fill="#d4af37" name="Alpha" radius={[2,2,0,0]} />
                    <Bar dataKey="benchmark" fill="#4ade80" name="基准" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'solutions' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3">Ucheer 买方解决方案套件</div>
            <div className="grid grid-cols-2 gap-3">
              {solutions.map((s, i) => (
                <div key={i} className="bg-[#111118] border border-[#222] rounded p-4 hover:border-[#d4af37]/30 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[#d4af37] font-bold">{s.name}</div>
                    <span className="text-[10px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded">{s.status}</span>
                  </div>
                  <div className="text-[#888] text-[11px] mb-3">{s.desc}</div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#555]">用户数: <span className="text-[#ccc]">{s.users.toLocaleString()}</span></span>
                    <span className="text-[#555]">覆盖: <span className="text-[#ccc]">{s.coverage}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3">买方执行绩效综合分析</div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: '平均 TCA 节省', value: '3.2bps', trend: '↑0.4bps', color: '#4ade80' },
                { label: '算法执行比例', value: '78.4%', trend: '↑5.2%', color: '#d4af37' },
                { label: '暗池成交比例', value: '22.1%', trend: '↑1.8%', color: '#60a5fa' },
                { label: '平均成交时间', value: '18.3min', trend: '↓2.1min', color: '#4ade80' },
                { label: '市场冲击成本', value: '0.08%', trend: '↓0.02%', color: '#4ade80' },
                { label: '委托取消率', value: '2.3%', trend: '↓0.5%', color: '#4ade80' },
              ].map((m, i) => (
                <div key={i} className="bg-[#111118] border border-[#222] rounded p-3">
                  <div className="text-[#666] text-[10px]">{m.label}</div>
                  <div className="font-bold text-lg" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-green-400 text-[10px]">{m.trend} vs 上月</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-4">买方交易工作流程</div>
            <div className="space-y-3">
              {[
                { step: '1', title: '投资决策', desc: '基于研究报告、量化信号、组合分析生成交易意向', tools: ['PORT', 'MARS', 'FactorLab'], color: '#d4af37' },
                { step: '2', title: '委托创建', desc: '在 AIM 系统中创建委托单，设定算法、限价、紧急度', tools: ['AIM', 'EMSX'], color: '#60a5fa' },
                { step: '3', title: '风险检查', desc: '实时风险预检：头寸限额、集中度、VaR、合规规则', tools: ['MARS', 'PRTU'], color: '#f97316' },
                { step: '4', title: '算法执行', desc: 'VWAP/TWAP/IS/POV 算法自动执行，智能路由至最优场所', tools: ['EMSX', 'ALGO'], color: '#4ade80' },
                { step: '5', title: '成交确认', desc: '实时成交回报，自动匹配，生成 FIX 消息', tools: ['AIM', 'STP'], color: '#a78bfa' },
                { step: '6', title: '结算清算', desc: 'T+1/T+2 结算，STP 直通处理，托管行对账', tools: ['STP', 'DTCC'], color: '#4ade80' },
              ].map(w => (
                <div key={w.step} className="flex items-start gap-4 bg-[#111118] border border-[#222] rounded p-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: w.color + '20', color: w.color }}>{w.step}</div>
                  <div className="flex-1">
                    <div className="font-bold text-[#ccc] mb-1">{w.title}</div>
                    <div className="text-[#888] text-[11px] mb-2">{w.desc}</div>
                    <div className="flex gap-1">
                      {w.tools.map(t => <span key={t} className="px-1.5 py-0.5 bg-[#1a1a2e] text-[#d4af37] rounded text-[10px]">{t}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

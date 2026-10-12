import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Shield, CheckCircle, AlertCircle, FileText, Activity } from 'lucide-react';

const bestExData = [
  { venue: 'NASDAQ', orders: 4820, pct: 38, avgSlippage: -0.02, score: 94 },
  { venue: 'NYSE', orders: 3240, pct: 26, avgSlippage: -0.04, score: 91 },
  { venue: 'LSE', orders: 1850, pct: 15, avgSlippage: -0.06, score: 88 },
  { venue: 'BATS', orders: 1120, pct: 9, avgSlippage: -0.01, score: 96 },
  { venue: 'IEX', orders: 750, pct: 6, avgSlippage: +0.01, score: 97 },
  { venue: 'Other', orders: 740, pct: 6, avgSlippage: -0.08, score: 82 },
];

const reportingData = [
  { month: 'Jan', tradeReports: 48200, txReports: 12400, compliance: 99.8 },
  { month: 'Feb', tradeReports: 52100, txReports: 13800, compliance: 99.9 },
  { month: 'Mar', tradeReports: 61800, txReports: 16200, compliance: 100 },
  { month: 'Apr', tradeReports: 55400, txReports: 14600, compliance: 99.7 },
  { month: 'May', tradeReports: 58900, txReports: 15800, compliance: 99.9 },
  { month: 'Jun', tradeReports: 63200, txReports: 17100, compliance: 100 },
];

const COLORS = ['#d4af37', '#4ade80', '#60a5fa', '#f97316', '#a78bfa', '#888'];

export default function MIFIPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'bestex' | 'reporting' | 'transparency' | 'checklist'>('overview');

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">MIFI</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">概览：MiFID II 解决方案 — 欧盟金融工具市场指令合规</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-green-400/20 text-green-400 px-2 py-0.5 rounded font-bold">✓ 合规</span>
          <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-0 border-b border-[#222]">
        {[
          { label: '最优执行合规率', value: '99.8%', color: '#4ade80' },
          { label: '交易报告及时率', value: '100%', color: '#4ade80' },
          { label: '交易前透明度', value: '98.4%', color: '#4ade80' },
          { label: '交易后透明度', value: '99.2%', color: '#4ade80' },
          { label: '监管报告提交', value: '0 逾期', color: '#4ade80' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#222]">
        {[
          { id: 'overview', label: '合规概览' },
          { id: 'bestex', label: '最优执行' },
          { id: 'reporting', label: '交易报告' },
          { id: 'transparency', label: '透明度' },
          { id: 'checklist', label: '合规清单' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { title: 'MiFID II 核心要求', items: ['最优执行义务', '交易前/后透明度', '系统性内化商规则', '交易报告义务', '投资者保护'], status: 'COMPLIANT' },
                { title: 'MiFIR 报告要求', items: ['交易报告 (Art.26)', '参考数据报告', '双边报告机制', 'ARM 接入', 'LEI 识别码'], status: 'COMPLIANT' },
                { title: 'RTS 技术标准', items: ['RTS 27 执行质量', 'RTS 28 执行政策', 'RTS 1 股票透明度', 'RTS 2 非股票透明度', 'RTS 22 交易报告'], status: 'COMPLIANT' },
              ].map((section, i) => (
                <div key={i} className="bg-[#111118] border border-[#222] rounded p-3">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-[#d4af37] font-bold">{section.title}</div>
                    <span className="text-[10px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded">{section.status}</span>
                  </div>
                  <div className="space-y-1.5">
                    {section.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-2 text-[11px]">
                        <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                        <span className="text-[#888]">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'bestex' && (
          <div className="space-y-4">
            <div className="text-[#d4af37] font-bold mb-3">最优执行分析 (RTS 27/28)</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#888] font-bold mb-3">场所分布</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={bestExData} dataKey="pct" nameKey="venue" cx="50%" cy="50%" outerRadius={65} label={({ venue, pct }) => `${venue} ${pct}%`} labelLine={false}>
                      {bestExData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#888] font-bold mb-3">场所执行质量评分</div>
                <div className="space-y-2">
                  {bestExData.map((v, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-[#ccc]">{v.venue}</span>
                        <span style={{ color: COLORS[i] }}>{v.score}/100</span>
                      </div>
                      <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${v.score}%`, background: COLORS[i] }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-[#222]">
                <tr>
                  {['交易场所', '委托数', '占比', '平均滑点(bps)', '质量评分', '状态'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bestExData.map((v, i) => (
                  <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e]">
                    <td className="px-3 py-2 font-bold" style={{ color: COLORS[i] }}>{v.venue}</td>
                    <td className="px-3 py-2 text-[#ccc]">{v.orders.toLocaleString()}</td>
                    <td className="px-3 py-2 text-[#ccc]">{v.pct}%</td>
                    <td className={`px-3 py-2 font-bold ${v.avgSlippage <= 0 ? 'text-green-400' : 'text-red-400'}`}>{v.avgSlippage > 0 ? '+' : ''}{v.avgSlippage.toFixed(2)}</td>
                    <td className="px-3 py-2 text-[#d4af37]">{v.score}</td>
                    <td className="px-3 py-2"><span className="text-[10px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded">合规</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reporting' && (
          <div className="space-y-4">
            <div className="text-[#d4af37] font-bold mb-3">交易报告统计 (Art.26 MiFIR)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={reportingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="tradeReports" fill="#d4af37" name="交易报告" radius={[2,2,0,0]} />
                <Bar dataKey="txReports" fill="#4ade80" name="交易确认" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="space-y-3">
            <div className="text-[#d4af37] font-bold mb-3">MiFID II 合规检查清单</div>
            {[
              { category: '最优执行', items: [
                { item: '制定最优执行政策', done: true },
                { item: '每年审查执行政策', done: true },
                { item: '向客户披露执行场所', done: true },
                { item: '发布 RTS 28 年度报告', done: true },
                { item: '监控执行质量', done: true },
              ]},
              { category: '交易报告', items: [
                { item: 'T+1 提交交易报告', done: true },
                { item: 'LEI 码维护', done: true },
                { item: 'ARM 接入测试', done: true },
                { item: '报告字段完整性检查', done: true },
                { item: '错误报告修正流程', done: true },
              ]},
              { category: '透明度', items: [
                { item: '交易前价格透明度', done: true },
                { item: '交易后价格透明度', done: true },
                { item: 'SI 门槛监控', done: true },
                { item: '延迟发布申请', done: false },
              ]},
            ].map((section, i) => (
              <div key={i} className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#d4af37] font-bold mb-2">{section.category}</div>
                <div className="grid grid-cols-2 gap-1">
                  {section.items.map((item, j) => (
                    <div key={j} className="flex items-center gap-2 text-[11px]">
                      {item.done ? <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" /> : <AlertCircle className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                      <span className={item.done ? 'text-[#888]' : 'text-yellow-400'}>{item.item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

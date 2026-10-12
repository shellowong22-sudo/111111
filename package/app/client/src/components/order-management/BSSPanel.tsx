import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { Activity, TrendingUp, Shield, Zap, Globe, Users, DollarSign, Clock } from 'lucide-react';

const volumeData = [
  { time: '09:30', equity: 1200, fixed: 850, fx: 620, deriv: 380 },
  { time: '10:00', equity: 1850, fixed: 1100, fx: 780, deriv: 520 },
  { time: '10:30', equity: 2100, fixed: 1350, fx: 920, deriv: 680 },
  { time: '11:00', equity: 1750, fixed: 1200, fx: 850, deriv: 590 },
  { time: '11:30', equity: 1900, fixed: 1280, fx: 890, deriv: 610 },
  { time: '12:00', equity: 1400, fixed: 980, fx: 720, deriv: 440 },
  { time: '13:00', equity: 2200, fixed: 1450, fx: 1050, deriv: 720 },
  { time: '14:00', equity: 2500, fixed: 1620, fx: 1180, deriv: 820 },
  { time: '15:00', equity: 3100, fixed: 1950, fx: 1420, deriv: 980 },
];

const clientData = [
  { name: 'BlackRock', type: '资管', aum: 9800, trades: 1240, revenue: 4.2, tier: 'PLATINUM' },
  { name: 'Vanguard', type: '资管', aum: 8200, trades: 980, revenue: 3.8, tier: 'PLATINUM' },
  { name: 'PIMCO', type: '资管', aum: 1800, trades: 650, revenue: 2.1, tier: 'GOLD' },
  { name: 'Fidelity', type: '资管', aum: 4500, trades: 820, revenue: 2.9, tier: 'GOLD' },
  { name: 'Citadel', type: '对冲基金', aum: 620, trades: 2100, revenue: 5.8, tier: 'PLATINUM' },
  { name: 'Two Sigma', type: '量化', aum: 580, trades: 3200, revenue: 7.2, tier: 'PLATINUM' },
  { name: 'Bridgewater', type: '对冲基金', aum: 1500, trades: 480, revenue: 1.8, tier: 'GOLD' },
  { name: 'AQR Capital', type: '量化', aum: 1200, trades: 1850, revenue: 4.5, tier: 'PLATINUM' },
];

const tierColors: Record<string, string> = {
  PLATINUM: 'text-[#e5e4e2] bg-[#e5e4e2]/10',
  GOLD: 'text-[#d4af37] bg-[#d4af37]/10',
  SILVER: 'text-[#aaa] bg-[#aaa]/10',
};

export default function BSSPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'volume' | 'compliance'>('overview');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [detailClient, setDetailClient] = useState<string | null>(null);

  const filteredClients = selectedTier === 'ALL' ? clientData : clientData.filter(c => c.tier === selectedTier);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">BSS</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">Overview: Sell-Side Solutions — 卖方解决方案概览</span>
        </div>
        <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-5 gap-0 border-b border-[#222]">
        {[
          { label: '活跃客户', value: '2,840', color: '#d4af37' },
          { label: '日均成交量', value: '$48.2B', color: '#4ade80' },
          { label: '市场份额', value: '12.4%', color: '#60a5fa' },
          { label: '今日佣金', value: '$3.8M', color: '#f97316' },
          { label: '系统可用性', value: '99.98%', color: '#4ade80' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#222]">
        {[
          { id: 'overview', label: '平台概览' },
          { id: 'clients', label: '客户管理' },
          { id: 'volume', label: '成交量分析' },
          { id: 'compliance', label: '合规监控' },
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
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#d4af37] font-bold mb-3">卖方核心解决方案</div>
                <div className="space-y-2">
                  {[
                    { name: 'TOMS', desc: '卖方债券委托单管理，支持RFQ/RFS/多协议', status: 'ACTIVE' },
                    { name: 'EMSX', desc: '执行管理系统，算法路由、TCA、暗池', status: 'ACTIVE' },
                    { name: 'SSEOMS', desc: '卖方股票OMS，DMA/算法/程序化交易', status: 'ACTIVE' },
                    { name: 'TSOX', desc: '固定收益交易系统，做市、库存管理', status: 'ACTIVE' },
                    { name: 'FXGO', desc: '外汇电子交易平台，多资产FX执行', status: 'ACTIVE' },
                    { name: 'DLIB', desc: '衍生品库存管理，Greeks监控、对冲', status: 'ACTIVE' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#1a1a2e] last:border-0">
                      <div>
                        <span className="text-[#d4af37] font-bold mr-2">{s.name}</span>
                        <span className="text-[#888]">{s.desc}</span>
                      </div>
                      <span className="text-[10px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded">{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#d4af37] font-bold mb-3">卖方市场地位</div>
                <div className="space-y-3">
                  {[
                    { market: '美国股票', share: 14.2, rank: 2, color: '#d4af37' },
                    { market: '美国固收', share: 11.8, rank: 3, color: '#4ade80' },
                    { market: '欧洲股票', share: 9.5, rank: 4, color: '#60a5fa' },
                    { market: '亚太股票', share: 7.2, rank: 5, color: '#f97316' },
                    { market: '全球外汇', share: 6.8, rank: 6, color: '#a78bfa' },
                  ].map(m => (
                    <div key={m.market}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#ccc]">{m.market}</span>
                        <span style={{ color: m.color }}>{m.share}% (第{m.rank}名)</span>
                      </div>
                      <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${m.share * 5}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              {['ALL', 'PLATINUM', 'GOLD', 'SILVER'].map(t => (
                <button key={t} onClick={() => setSelectedTier(t)}
                  className={`px-2 py-1 rounded text-[10px] transition-colors ${selectedTier === t ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
                  {t}
                </button>
              ))}
            </div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-[#222]">
                <tr>
                  {['客户名称', '类型', 'AUM($B)', '今日委托', '佣金贡献($M)', '客户等级', '操作'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c, i) => (
                  <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e]">
                    <td className="px-3 py-2 text-white font-bold">{c.name}</td>
                    <td className="px-3 py-2 text-[#888]">{c.type}</td>
                    <td className="px-3 py-2 text-[#d4af37]">${c.aum.toLocaleString()}</td>
                    <td className="px-3 py-2 text-[#ccc]">{c.trades.toLocaleString()}</td>
                    <td className="px-3 py-2 text-green-400">${c.revenue}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tierColors[c.tier]}`}>{c.tier}</span>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setDetailClient(detailClient === c.name ? null : c.name)} className="px-2 py-0.5 bg-[#d4af37] text-black rounded text-[10px] font-bold hover:bg-[#e5c158]">详情</button>
                    </td>
                  </tr>
                ))}
                {filteredClients.filter(c => c.name === detailClient).map(c => (
                  <tr key={`detail-${c.name}`} className="border-b border-[#111] bg-[#111118]">
                    <td colSpan={7} className="px-3 py-2 text-[11px] text-[#ccc]">
                      {Object.entries(c).map(([key, value]) => <span key={key} className="mr-4"><span className="text-[#666]">{key}：</span>{String(value)}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'volume' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3">日内成交量分布 (百万美元)</div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="equity" stackId="1" stroke="#d4af37" fill="#d4af37" fillOpacity={0.3} name="股票" />
                <Area type="monotone" dataKey="fixed" stackId="1" stroke="#4ade80" fill="#4ade80" fillOpacity={0.3} name="固收" />
                <Area type="monotone" dataKey="fx" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.3} name="外汇" />
                <Area type="monotone" dataKey="deriv" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.3} name="衍生品" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { rule: 'MiFID II 最优执行', status: '合规', score: 98.7, color: '#4ade80' },
                { rule: 'SEC Rule 606', status: '合规', score: 100, color: '#4ade80' },
                { rule: 'FINRA 4370', status: '合规', score: 99.2, color: '#4ade80' },
                { rule: 'Basel III 资本要求', status: '合规', score: 97.8, color: '#4ade80' },
                { rule: 'Dodd-Frank 报告', status: '合规', score: 99.5, color: '#4ade80' },
                { rule: 'EMIR 衍生品报告', status: '合规', score: 98.1, color: '#4ade80' },
              ].map((r, i) => (
                <div key={i} className="bg-[#111118] border border-[#222] rounded p-3">
                  <div className="text-[#ccc] font-bold text-[11px] mb-1">{r.rule}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded">{r.status}</span>
                    <span className="font-bold" style={{ color: r.color }}>{r.score}%</span>
                  </div>
                  <div className="mt-2 h-1 bg-[#222] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: r.color }} />
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

import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Users, Activity, TrendingUp, Search } from 'lucide-react';

const clientData = [
  { id: 'CL-001', name: 'BlackRock Asset Management', type: 'INSTITUTIONAL', aum: '9.4T', etfHoldings: ['SPY', 'QQQ', 'IWM', 'GLD'], totalUnits: 4820, ytdCreations: 280, ytdRedemptions: 195, netFlow: 85, tier: 'PLATINUM' },
  { id: 'CL-002', name: 'Vanguard Group', type: 'INSTITUTIONAL', aum: '8.1T', etfHoldings: ['SPY', 'TLT', 'HYG'], totalUnits: 3640, ytdCreations: 210, ytdRedemptions: 180, netFlow: 30, tier: 'PLATINUM' },
  { id: 'CL-003', name: 'State Street Global', type: 'INSTITUTIONAL', aum: '4.1T', etfHoldings: ['SPY', 'QQQ'], totalUnits: 2180, ytdCreations: 145, ytdRedemptions: 122, netFlow: 23, tier: 'GOLD' },
  { id: 'CL-004', name: 'Fidelity Investments', type: 'INSTITUTIONAL', aum: '4.5T', etfHoldings: ['QQQ', 'IWM', 'GLD'], totalUnits: 1920, ytdCreations: 98, ytdRedemptions: 85, netFlow: 13, tier: 'GOLD' },
  { id: 'CL-005', name: 'Capital Group', type: 'INSTITUTIONAL', aum: '2.6T', etfHoldings: ['SPY', 'TLT'], totalUnits: 840, ytdCreations: 52, ytdRedemptions: 48, netFlow: 4, tier: 'SILVER' },
  { id: 'CL-006', name: 'Wellington Management', type: 'INSTITUTIONAL', aum: '1.2T', etfHoldings: ['HYG', 'TLT'], totalUnits: 620, ytdCreations: 38, ytdRedemptions: 42, netFlow: -4, tier: 'SILVER' },
];

const TIER_COLORS: Record<string, string> = { PLATINUM: '#e5e4e2', GOLD: '#d4af37', SILVER: '#c0c0c0' };
const COLORS = ['#d4af37', '#4ade80', '#60a5fa', '#f97316', '#a78bfa', '#888'];

export default function CKPVPanel() {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');

  const filtered = clientData.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search));

  const flowData = clientData.map(c => ({ name: c.name.split(' ')[0], creations: c.ytdCreations, redemptions: c.ytdRedemptions, netFlow: c.netFlow }));

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">CKPV</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">ETFP 客户数据 — ETF 授权参与商客户管理</span>
        </div>
        <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
      </div>

      <div className="grid grid-cols-4 gap-0 border-b border-[#222]">
        {[
          { label: '机构客户', value: String(clientData.length), color: '#d4af37' },
          { label: '铂金客户', value: String(clientData.filter(c => c.tier === 'PLATINUM').length), color: '#e5e4e2' },
          { label: '年内净申购', value: String(clientData.reduce((s, c) => s + Math.max(0, c.netFlow), 0)), color: '#4ade80' },
          { label: '年内净赎回', value: String(Math.abs(clientData.reduce((s, c) => s + Math.min(0, c.netFlow), 0))), color: '#f87171' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#222]">
        {[{ id: 'list', label: '客户列表' }, { id: 'analytics', label: '流量分析' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <>
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0d14] border-b border-[#1a1a2e]">
            <div className="flex items-center gap-1 bg-[#1a1a2e] rounded px-2 py-1">
              <Search className="w-3 h-3 text-[#666]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="搜索客户..." className="bg-transparent outline-none text-xs w-32 text-[#ccc] placeholder-[#444]" />
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[#0d0d14] border-b border-[#222]">
                  <tr>
                    {['客户', '类型', 'AUM', 'ETF 持仓', '总单位', '年内申购', '年内赎回', '净流量', '级别'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[#666] font-normal whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={i} className={`border-b border-[#111] hover:bg-[#1a1a2e] cursor-pointer ${selectedClient?.id === c.id ? 'bg-[#d4af37]/5' : ''}`}
                      onClick={() => setSelectedClient(c)}>
                      <td className="px-3 py-2 text-[#ccc] font-bold">{c.name}</td>
                      <td className="px-3 py-2 text-[#888]">{c.type}</td>
                      <td className="px-3 py-2 text-[#ccc]">{c.aum}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-0.5">
                          {c.etfHoldings.map(e => <span key={e} className="px-1 py-0.5 bg-[#1a1a2e] text-[#d4af37] rounded text-[9px]">{e}</span>)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[#ccc]">{c.totalUnits.toLocaleString()}</td>
                      <td className="px-3 py-2 text-green-400">{c.ytdCreations}</td>
                      <td className="px-3 py-2 text-red-400">{c.ytdRedemptions}</td>
                      <td className={`px-3 py-2 font-bold ${c.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {c.netFlow >= 0 ? '+' : ''}{c.netFlow}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-bold text-[11px]" style={{ color: TIER_COLORS[c.tier] }}>{c.tier}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'analytics' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="text-[#d4af37] font-bold mb-3">客户申购赎回流量分析</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={flowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 10 }} />
              <YAxis tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="creations" fill="#4ade80" name="申购" radius={[2,2,0,0]} />
              <Bar dataKey="redemptions" fill="#f87171" name="赎回" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

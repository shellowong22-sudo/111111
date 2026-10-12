import React, { useState } from 'react';
import { Activity, Plus, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

const apOrders = [
  { id: 'AP-2024-001', ap: 'Goldman Sachs', etf: 'SPY', type: 'CREATION', units: 5, shares: 250000, nav: 485.32, status: 'COMPLETED', submitted: '09:15:22', completed: '09:48:35', cashComp: 12450 },
  { id: 'AP-2024-002', ap: 'JPMorgan', etf: 'QQQ', type: 'REDEMPTION', units: 3, shares: 150000, nav: 448.75, status: 'IN_PROGRESS', submitted: '10:02:18', completed: null, cashComp: 8200 },
  { id: 'AP-2024-003', ap: 'Citadel', etf: 'IWM', type: 'CREATION', units: 10, shares: 500000, nav: 198.42, status: 'PENDING', submitted: '10:45:00', completed: null, cashComp: 5600 },
  { id: 'AP-2024-004', ap: 'Jane Street', etf: 'GLD', type: 'REDEMPTION', units: 2, shares: 200000, nav: 182.65, status: 'COMPLETED', submitted: '11:20:45', completed: '11:52:18', cashComp: 0 },
  { id: 'AP-2024-005', ap: 'Virtu Financial', etf: 'TLT', type: 'CREATION', units: 8, shares: 400000, nav: 88.42, status: 'FAILED', submitted: '13:15:30', completed: null, cashComp: 3200 },
  { id: 'AP-2024-006', ap: 'Goldman Sachs', etf: 'HYG', type: 'CREATION', units: 4, shares: 200000, nav: 76.18, status: 'IN_PROGRESS', submitted: '14:08:22', completed: null, cashComp: 1800 },
];

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  COMPLETED: { color: 'text-green-400', bg: 'bg-green-400/10', label: '已完成' },
  IN_PROGRESS: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: '处理中' },
  PENDING: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: '待处理' },
  FAILED: { color: 'text-red-400', bg: 'bg-red-400/10', label: '失败' },
};

export default function BSKAPanel() {
  const [orders, setOrders] = useState(apOrders);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ ap: 'Goldman Sachs', etf: 'SPY', type: 'CREATION', units: 1 });

  const filtered = orders.filter(o => {
    if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
    if (filterType !== 'ALL' && o.type !== filterType) return false;
    if (search && !o.id.includes(search) && !o.ap.toLowerCase().includes(search.toLowerCase()) && !o.etf.includes(search.toUpperCase())) return false;
    return true;
  });

  const handleSubmitNew = () => {
    const id = `AP-2024-00${orders.length + 1}`;
    const etfNavs: Record<string, number> = { SPY: 485.32, QQQ: 448.75, IWM: 198.42, GLD: 182.65, TLT: 88.42, HYG: 76.18 };
    const etfUnits: Record<string, number> = { SPY: 50000, QQQ: 50000, IWM: 50000, GLD: 100000, TLT: 50000, HYG: 50000 };
    setOrders(prev => [{
      id, ap: newOrder.ap, etf: newOrder.etf, type: newOrder.type,
      units: newOrder.units, shares: newOrder.units * (etfUnits[newOrder.etf] || 50000),
      nav: etfNavs[newOrder.etf] || 100, status: 'PENDING',
      submitted: new Date().toLocaleTimeString(), completed: null, cashComp: 5000,
    }, ...prev]);
    setShowNewOrder(false);
    toast.success('AP 委托已提交', { description: `${id} 已创建，状态: 待处理` });
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">BSKA</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">AP ETF 委托单管理 — 授权参与商委托管理</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewOrder(!showNewOrder)} className="flex items-center gap-1 px-3 py-1.5 bg-[#d4af37] text-black rounded text-[11px] font-bold hover:bg-[#e5c158]">
            <Plus className="w-3 h-3" />新建 AP 委托
          </button>
          <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-5 gap-0 border-b border-[#222]">
        {[
          { label: '今日委托', value: String(orders.length), color: '#d4af37' },
          { label: '已完成', value: String(orders.filter(o => o.status === 'COMPLETED').length), color: '#4ade80' },
          { label: '处理中', value: String(orders.filter(o => o.status === 'IN_PROGRESS').length), color: '#facc15' },
          { label: '待处理', value: String(orders.filter(o => o.status === 'PENDING').length), color: '#60a5fa' },
          { label: '失败', value: String(orders.filter(o => o.status === 'FAILED').length), color: '#f87171' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* New Order Form */}
      {showNewOrder && (
        <div className="px-4 py-3 bg-[#111118] border-b border-[#d4af37]/30">
          <div className="flex items-center gap-3">
            <span className="text-[#d4af37] font-bold">新建委托:</span>
            {[
              { label: 'AP', key: 'ap', type: 'select', options: ['Goldman Sachs', 'JPMorgan', 'Citadel', 'Jane Street', 'Virtu Financial'] },
              { label: 'ETF', key: 'etf', type: 'select', options: ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'HYG'] },
              { label: '类型', key: 'type', type: 'select', options: ['CREATION', 'REDEMPTION'] },
              { label: '单位数', key: 'units', type: 'number' },
            ].map(f => (
              <div key={f.key} className="flex items-center gap-1">
                <span className="text-[#666]">{f.label}:</span>
                {f.type === 'select' ? (
                  <select value={(newOrder as any)[f.key]} onChange={e => setNewOrder(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="bg-[#1a1a2e] border border-[#333] rounded px-2 py-1 text-[#ccc] text-xs outline-none focus:border-[#d4af37]">
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type="number" value={(newOrder as any)[f.key]} onChange={e => setNewOrder(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                    className="w-16 bg-[#1a1a2e] border border-[#333] rounded px-2 py-1 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
                )}
              </div>
            ))}
            <button onClick={handleSubmitNew} className="px-3 py-1.5 bg-[#d4af37] text-black rounded text-[11px] font-bold hover:bg-[#e5c158]">提交</button>
            <button onClick={() => setShowNewOrder(false)} className="px-3 py-1.5 bg-[#1a1a2e] text-[#888] rounded text-[11px] hover:text-[#ccc]">取消</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0d14] border-b border-[#1a1a2e]">
        <div className="flex items-center gap-1 bg-[#1a1a2e] rounded px-2 py-1">
          <Search className="w-3 h-3 text-[#666]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索委托..." className="bg-transparent outline-none text-xs w-28 text-[#ccc] placeholder-[#444]" />
        </div>
        {['ALL', 'COMPLETED', 'IN_PROGRESS', 'PENDING', 'FAILED'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-2 py-1 rounded text-[10px] transition-colors ${filterStatus === s ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
            {s === 'ALL' ? '全部' : s === 'COMPLETED' ? '完成' : s === 'IN_PROGRESS' ? '处理中' : s === 'PENDING' ? '待处理' : '失败'}
          </button>
        ))}
        <div className="ml-2 flex gap-1">
          {['ALL', 'CREATION', 'REDEMPTION'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-2 py-1 rounded text-[10px] transition-colors ${filterType === t ? 'bg-[#60a5fa] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
              {t === 'ALL' ? '全部类型' : t === 'CREATION' ? '申购' : '赎回'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0d0d14] border-b border-[#222]">
            <tr>
              {['委托号', 'AP 机构', 'ETF', '类型', '单位数', 'ETF份额', 'NAV', '现金补偿', '状态', '提交时间', '完成时间'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[#666] font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => {
              const sc = statusConfig[o.status];
              return (
                <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e]">
                  <td className="px-3 py-2 text-[#d4af37] font-bold">{o.id}</td>
                  <td className="px-3 py-2 text-[#ccc]">{o.ap}</td>
                  <td className="px-3 py-2 text-[#d4af37] font-bold">{o.etf}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${o.type === 'CREATION' ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'}`}>
                      {o.type === 'CREATION' ? '申购' : '赎回'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#ccc]">{o.units}</td>
                  <td className="px-3 py-2 text-[#ccc]">{o.shares.toLocaleString()}</td>
                  <td className="px-3 py-2 text-[#ccc]">${o.nav.toFixed(2)}</td>
                  <td className="px-3 py-2 text-[#ccc]">${o.cashComp.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sc.color} ${sc.bg}`}>{sc.label}</span>
                  </td>
                  <td className="px-3 py-2 text-[#888]">{o.submitted}</td>
                  <td className="px-3 py-2 text-[#888]">{o.completed || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

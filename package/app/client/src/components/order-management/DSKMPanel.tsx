import React, { useState } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckCircle, XCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';

const brokerPermissions = [
  { id: 1, broker: 'Goldman Sachs', apCode: 'GS_AP_001', etfs: ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'HYG'], maxUnitsPerDay: 100, usedToday: 32, status: 'ACTIVE', permissions: ['CREATION', 'REDEMPTION', 'INTRADAY'] },
  { id: 2, broker: 'JPMorgan', apCode: 'JPM_AP_002', etfs: ['SPY', 'QQQ', 'TLT'], maxUnitsPerDay: 80, usedToday: 18, status: 'ACTIVE', permissions: ['CREATION', 'REDEMPTION'] },
  { id: 3, broker: 'Citadel Securities', apCode: 'CIT_AP_003', etfs: ['SPY', 'QQQ', 'IWM'], maxUnitsPerDay: 150, usedToday: 45, status: 'ACTIVE', permissions: ['CREATION', 'REDEMPTION', 'INTRADAY', 'CASH_ONLY'] },
  { id: 4, broker: 'Jane Street', apCode: 'JS_AP_004', etfs: ['SPY', 'GLD'], maxUnitsPerDay: 200, usedToday: 88, status: 'ACTIVE', permissions: ['CREATION', 'REDEMPTION', 'INTRADAY'] },
  { id: 5, broker: 'Virtu Financial', apCode: 'VF_AP_005', etfs: ['SPY', 'QQQ'], maxUnitsPerDay: 60, usedToday: 0, status: 'SUSPENDED', permissions: ['CREATION'] },
  { id: 6, broker: 'Morgan Stanley', apCode: 'MS_AP_006', etfs: ['SPY', 'TLT', 'HYG'], maxUnitsPerDay: 50, usedToday: 12, status: 'ACTIVE', permissions: ['CREATION', 'REDEMPTION'] },
];

const permLabels: Record<string, string> = {
  CREATION: '申购', REDEMPTION: '赎回', INTRADAY: '日内', CASH_ONLY: '纯现金'
};

export default function DSKMPanel() {
  const [brokers, setBrokers] = useState(brokerPermissions);
  const [selectedBroker, setSelectedBroker] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);

  const toggleStatus = (id: number) => {
    setBrokers(prev => prev.map(b => b.id === id ? { ...b, status: b.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : b));
    const broker = brokers.find(b => b.id === id);
    toast.success(`${broker?.broker} 状态已${broker?.status === 'ACTIVE' ? '暂停' : '恢复'}`);
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">DSKM</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">BSKT 券商交易台权限 — AP 机构权限管理</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.info('新增 AP 机构功能')} className="flex items-center gap-1 px-3 py-1.5 bg-[#d4af37] text-black rounded text-[11px] font-bold hover:bg-[#e5c158]">
            <Plus className="w-3 h-3" />新增 AP
          </button>
          <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-0 border-b border-[#222]">
        {[
          { label: '授权 AP 机构', value: String(brokers.length), color: '#d4af37' },
          { label: '活跃', value: String(brokers.filter(b => b.status === 'ACTIVE').length), color: '#4ade80' },
          { label: '已暂停', value: String(brokers.filter(b => b.status === 'SUSPENDED').length), color: '#f87171' },
          { label: '今日使用率', value: `${Math.round(brokers.reduce((s, b) => s + b.usedToday, 0) / brokers.reduce((s, b) => s + b.maxUnitsPerDay, 0) * 100)}%`, color: '#60a5fa' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0d0d14] border-b border-[#222]">
              <tr>
                {['AP 机构', 'AP 代码', '授权 ETF', '日限额', '今日使用', '使用率', '权限', '状态', '操作'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[#666] font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brokers.map((b, i) => (
                <tr key={i} className={`border-b border-[#111] hover:bg-[#1a1a2e] cursor-pointer ${selectedBroker?.id === b.id ? 'bg-[#d4af37]/5' : ''}`}
                  onClick={() => setSelectedBroker(b)}>
                  <td className="px-3 py-2 text-[#ccc] font-bold">{b.broker}</td>
                  <td className="px-3 py-2 text-[#888]">{b.apCode}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-0.5">
                      {b.etfs.map(e => <span key={e} className="px-1 py-0.5 bg-[#1a1a2e] text-[#d4af37] rounded text-[9px]">{e}</span>)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[#ccc]">{b.maxUnitsPerDay}</td>
                  <td className="px-3 py-2 text-[#ccc]">{b.usedToday}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(b.usedToday / b.maxUnitsPerDay * 100)}%`, background: b.usedToday / b.maxUnitsPerDay > 0.8 ? '#f87171' : '#4ade80' }} />
                      </div>
                      <span className="text-[#888]">{Math.round(b.usedToday / b.maxUnitsPerDay * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-0.5">
                      {b.permissions.map(p => <span key={p} className="px-1 py-0.5 bg-blue-400/10 text-blue-400 rounded text-[9px]">{permLabels[p]}</span>)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${b.status === 'ACTIVE' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {b.status === 'ACTIVE' ? '活跃' : '暂停'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); setSelectedBroker(b); setEditMode(true); }}
                        className="p-1 hover:bg-[#333] rounded"><Edit2 className="w-3 h-3 text-[#888]" /></button>
                      <button onClick={e => { e.stopPropagation(); toggleStatus(b.id); }}
                        className="p-1 hover:bg-[#333] rounded">
                        {b.status === 'ACTIVE' ? <XCircle className="w-3 h-3 text-red-400" /> : <CheckCircle className="w-3 h-3 text-green-400" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedBroker && (
          <div className="w-64 bg-[#0d0d14] border-l border-[#1a1a2e] p-4 overflow-auto flex-shrink-0">
            <div className="flex justify-between items-center mb-3">
              <div className="text-[#d4af37] font-bold">{selectedBroker.broker}</div>
              <button onClick={() => setSelectedBroker(null)} className="text-[#555] hover:text-[#ccc]">✕</button>
            </div>
            <div className="space-y-2 text-[11px]">
              <div><span className="text-[#666]">AP 代码: </span><span className="text-[#ccc]">{selectedBroker.apCode}</span></div>
              <div><span className="text-[#666]">状态: </span>
                <span className={selectedBroker.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}>{selectedBroker.status}</span>
              </div>
              <div><span className="text-[#666]">日限额: </span><span className="text-[#ccc]">{selectedBroker.maxUnitsPerDay} 单位</span></div>
              <div><span className="text-[#666]">今日使用: </span><span className="text-[#ccc]">{selectedBroker.usedToday} 单位</span></div>
              <div className="pt-2 border-t border-[#222]">
                <div className="text-[#666] mb-1">授权 ETF:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedBroker.etfs.map((e: string) => <span key={e} className="px-1.5 py-0.5 bg-[#d4af37]/10 text-[#d4af37] rounded text-[10px]">{e}</span>)}
                </div>
              </div>
              <div className="pt-2 border-t border-[#222]">
                <div className="text-[#666] mb-1">操作权限:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedBroker.permissions.map((p: string) => <span key={p} className="px-1.5 py-0.5 bg-blue-400/10 text-blue-400 rounded text-[10px]">{permLabels[p]}</span>)}
                </div>
              </div>
              <button onClick={() => { toggleStatus(selectedBroker.id); setSelectedBroker(null); }}
                className={`w-full mt-3 py-1.5 rounded text-[11px] font-bold ${selectedBroker.status === 'ACTIVE' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                {selectedBroker.status === 'ACTIVE' ? '暂停此 AP' : '恢复此 AP'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

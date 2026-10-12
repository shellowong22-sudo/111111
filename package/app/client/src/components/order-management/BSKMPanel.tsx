import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, Legend } from 'recharts';
import { Wifi, WifiOff, Bell, BellOff, AlertTriangle, Plus, Minus, Activity } from 'lucide-react';
import { useETFWebSocket } from '@/hooks/useETFWebSocket';

const premiumHistoryData = [
  { time: '09:30', SPY: 0.02, QQQ: -0.05, GLD: 0.12 },
  { time: '10:00', SPY: 0.08, QQQ: 0.15, GLD: 0.08 },
  { time: '10:30', SPY: -0.12, QQQ: 0.22, GLD: -0.18 },
  { time: '11:00', SPY: 0.05, QQQ: -0.08, GLD: 0.35 },
  { time: '11:30', SPY: 0.18, QQQ: 0.42, GLD: 0.28 },
  { time: '12:00', SPY: -0.08, QQQ: 0.18, GLD: -0.42 },
  { time: '13:00', SPY: 0.22, QQQ: -0.15, GLD: 0.55 },
  { time: '14:00', SPY: 0.35, QQQ: 0.28, GLD: 0.18 },
  { time: '15:00', SPY: 0.12, QQQ: 0.08, GLD: -0.08 },
];

function PremiumBar({ premium }: { premium: number }) {
  const abs = Math.abs(premium);
  const color = abs >= 1.2 ? '#ef4444' : abs >= 0.8 ? '#facc15' : abs >= 0.3 ? '#f97316' : '#4ade80';
  const width = Math.min(100, abs / 2 * 100);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="w-20 h-2 bg-[#1a1a2e] rounded-full overflow-hidden flex">
        {premium < 0 && <div className="ml-auto h-full rounded-full" style={{ width: `${width}%`, background: color }} />}
        {premium >= 0 && <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />}
      </div>
      <span className={`text-[11px] font-bold w-14 text-right ${abs >= 1.2 ? 'text-red-400' : abs >= 0.8 ? 'text-yellow-400' : abs >= 0.3 ? 'text-orange-400' : 'text-green-400'}`}>
        {premium > 0 ? '+' : ''}{premium.toFixed(3)}%
      </span>
    </div>
  );
}

export default function BSKMPanel() {
  const { quotes, mmQuotes, alerts, connectionStatus, latencyMs, notificationPermission, requestNotificationPermission, sendCreateOrder, sendRedeemOrder } = useETFWebSocket();
  const [activeTab, setActiveTab] = useState<'overview' | 'premium' | 'mm' | 'orders' | 'alerts'>('overview');
  const [selectedETF, setSelectedETF] = useState<string>('SPY');
  const [orderForm, setOrderForm] = useState({ type: 'CREATE' as 'CREATE' | 'REDEEM', units: '1' });
  const [ignoredAlerts, setIgnoredAlerts] = useState<string[]>([]);
  const placeQuoteOrder = (dealer: string, side: 'BUY' | 'SELL', price: number) => {
    setOrderHistory(prev => [{ id: `ORD-${Date.now()}`, etfId: selectedETF, type: side, units: 1, status: 'ACCEPTED', ts: Date.now() }, ...prev].slice(0, 50));
    toast.success(`已提交${side === 'BUY' ? '买入' : '卖出'}委托`, { description: `${selectedETF} · ${dealer} · ${price.toFixed(4)}（委托记录见“委托”页）` });
  };
  const [orderHistory, setOrderHistory] = useState<Array<{ id: string; etfId: string; type: string; units: number; status: string; ts: number }>>([]);

  const connColor = connectionStatus === 'CONNECTED' ? 'text-green-400' : 'text-red-400';
  const connLabel = { CONNECTING: '连接中', CONNECTED: 'LIVE', DISCONNECTED: '断开', ERROR: '错误' }[connectionStatus];

  const selectedQuote = useMemo(() => quotes.find(q => q.id === selectedETF), [quotes, selectedETF]);
  const selectedMM = useMemo(() => mmQuotes.filter(q => q.etfId === selectedETF).sort((a, b) => a.spread - b.spread), [mmQuotes, selectedETF]);
  const premiumBarData = useMemo(() => quotes.map(q => ({ id: q.id, premium: q.premium, abs: Math.abs(q.premium) })).sort((a, b) => b.abs - a.abs), [quotes]);
  const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL').length;
  const warningAlerts = alerts.filter(a => a.level === 'WARNING').length;

  const handleOrder = () => {
    const units = parseInt(orderForm.units) || 1;
    if (orderForm.type === 'CREATE') sendCreateOrder(selectedETF, units);
    else sendRedeemOrder(selectedETF, units);
    setOrderHistory(prev => [{ id: `ORD-${Date.now()}`, etfId: selectedETF, type: orderForm.type, units, status: 'ACCEPTED', ts: Date.now() }, ...prev].slice(0, 50));
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">BSKM</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">ETF创建/赎回管理系统</span>
          <span className={`flex items-center gap-1 text-[10px] ${connColor}`}>
            {connectionStatus === 'CONNECTED' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connLabel}{connectionStatus === 'CONNECTED' && latencyMs > 0 && <span className="text-[#555] ml-1">{latencyMs}ms</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {criticalAlerts > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-red-400 text-[10px] animate-pulse">
              <AlertTriangle className="w-3 h-3" /> {criticalAlerts} 严重预警
            </span>
          )}
          {warningAlerts > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-400/20 border border-yellow-400/40 rounded text-yellow-400 text-[10px]">
              <AlertTriangle className="w-3 h-3" /> {warningAlerts} 预警
            </span>
          )}
          <button onClick={requestNotificationPermission} title="桌面通知"
            className={`p-1 rounded ${notificationPermission === 'granted' ? 'text-[#d4af37]' : 'text-[#555] hover:text-[#d4af37]'}`}>
            {notificationPermission === 'granted' ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-6 border-b border-[#222] flex-shrink-0">
        {[
          { label: 'ETF产品', value: quotes.length, color: '#d4af37' },
          { label: '溢价产品', value: quotes.filter(q => q.premium > 0.3).length, color: '#f97316' },
          { label: '折价产品', value: quotes.filter(q => q.premium < -0.3).length, color: '#60a5fa' },
          { label: '严重预警', value: criticalAlerts, color: '#ef4444' },
          { label: '今日申购', value: quotes.reduce((s, q) => s + q.creationUnits, 0), color: '#4ade80' },
          { label: '今日赎回', value: quotes.reduce((s, q) => s + q.redemptionUnits, 0), color: '#facc15' },
        ].map((k, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{k.label}</div>
            <div className="font-bold text-sm" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#222] flex-shrink-0">
        {[
          { id: 'overview', label: `行情总览 (${quotes.length})` },
          { id: 'premium', label: '溢折价监控' },
          { id: 'mm', label: `做市商报价 (${selectedMM.length})` },
          { id: 'orders', label: `申购/赎回 (${orderHistory.length})` },
          { id: 'alerts', label: `预警记录 (${alerts.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors whitespace-nowrap ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
            {t.id === 'alerts' && criticalAlerts > 0 && <span className="ml-1 w-1.5 h-1.5 bg-red-500 rounded-full inline-block animate-pulse" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0d0d14] border-b border-[#222] z-10">
              <tr>{['代码', '名称', 'NAV', '市价', '溢折价', '买价', '卖价', '成交量', '净流入', '申购单', '赎回单', '最优做市商', '操作'].map(h => (
                <th key={h} className="px-2 py-2 text-left text-[#666] font-normal whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {quotes.map(q => (
                <tr key={q.id} onClick={() => setSelectedETF(q.id)}
                  className={`border-b border-[#111] hover:bg-[#1a1a2e] cursor-pointer transition-colors ${selectedETF === q.id ? 'bg-[#d4af37]/5' : ''} ${q.alert?.level === 'CRITICAL' ? 'bg-red-500/5' : ''}`}>
                  <td className="px-2 py-1.5 text-[#d4af37] font-bold">{q.id}</td>
                  <td className="px-2 py-1.5 text-white whitespace-nowrap max-w-[140px] truncate">{q.name}</td>
                  <td className="px-2 py-1.5 text-[#ccc]">{q.nav.toFixed(4)}</td>
                  <td className="px-2 py-1.5 text-[#ccc]">{q.marketPrice.toFixed(4)}</td>
                  <td className="px-2 py-1.5"><PremiumBar premium={q.premium} /></td>
                  <td className="px-2 py-1.5 text-green-400">{q.bidPrice.toFixed(4)}</td>
                  <td className="px-2 py-1.5 text-red-400">{q.askPrice.toFixed(4)}</td>
                  <td className="px-2 py-1.5 text-[#888]">{(q.volume / 1e6).toFixed(2)}M</td>
                  <td className={`px-2 py-1.5 font-bold ${q.inflow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {q.inflow >= 0 ? '+' : ''}{(q.inflow / 10000).toFixed(1)}亿
                  </td>
                  <td className="px-2 py-1.5 text-green-400">{q.creationUnits}</td>
                  <td className="px-2 py-1.5 text-red-400">{q.redemptionUnits}</td>
                  <td className="px-2 py-1.5 text-[#888] whitespace-nowrap">{q.bestMM}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); sendCreateOrder(q.id); setOrderHistory(p => [{ id: `ORD-${Date.now()}`, etfId: q.id, type: 'CREATE', units: 1, status: 'ACCEPTED', ts: Date.now() }, ...p].slice(0, 50)); }}
                        className="px-1.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] hover:bg-green-500/40 flex items-center gap-0.5">
                        <Plus className="w-2.5 h-2.5" />申
                      </button>
                      <button onClick={e => { e.stopPropagation(); sendRedeemOrder(q.id); setOrderHistory(p => [{ id: `ORD-${Date.now()}`, etfId: q.id, type: 'REDEEM', units: 1, status: 'ACCEPTED', ts: Date.now() }, ...p].slice(0, 50)); }}
                        className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] hover:bg-red-500/40 flex items-center gap-0.5">
                        <Minus className="w-2.5 h-2.5" />赎
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 && <tr><td colSpan={13} className="text-center py-8 text-[#444]">正在连接实时数据...</td></tr>}
            </tbody>
          </table>
        )}

        {activeTab === 'premium' && (
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[#d4af37] font-bold mb-3">实时溢折价排行</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={premiumBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} unit="%" domain={[-2, 2]} />
                  <YAxis type="category" dataKey="id" tick={{ fill: '#d4af37', fontSize: 10 }} width={40} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} formatter={(v: any) => [`${v}%`, '溢折价']} />
                  <ReferenceLine x={0} stroke="#444" />
                  <ReferenceLine x={0.8} stroke="#facc15" strokeDasharray="3 3" />
                  <ReferenceLine x={-0.8} stroke="#facc15" strokeDasharray="3 3" />
                  <ReferenceLine x={1.2} stroke="#ef4444" strokeDasharray="3 3" />
                  <ReferenceLine x={-1.2} stroke="#ef4444" strokeDasharray="3 3" />
                  <Bar dataKey="premium" fill="#d4af37" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-[#d4af37] font-bold mb-3">溢折价历史走势</div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={premiumHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                  <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#666', fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} formatter={(v: any) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={0.8} stroke="#facc15" strokeDasharray="3 3" />
                  <ReferenceLine y={-0.8} stroke="#facc15" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="SPY" stroke="#d4af37" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="QQQ" stroke="#4ade80" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="GLD" stroke="#60a5fa" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'mm' && (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-[#d4af37] font-bold flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 animate-pulse" /> 做市商双边报价
              </div>
              <select value={selectedETF} onChange={e => setSelectedETF(e.target.value)}
                className="bg-[#1a1a2e] border border-[#333] rounded px-2 py-1 text-[#ccc] text-xs">
                {quotes.map(q => <option key={q.id} value={q.id}>{q.id} - {q.name}</option>)}
              </select>
              {selectedQuote && (
                <div className="flex items-center gap-3 ml-auto text-[11px]">
                  <span className="text-[#666]">NAV: <span className="text-[#ccc]">{selectedQuote.nav.toFixed(4)}</span></span>
                  <span className="text-[#666]">溢折价: <span className={Math.abs(selectedQuote.premium) >= 0.8 ? 'text-yellow-400' : 'text-green-400'}>{selectedQuote.premium > 0 ? '+' : ''}{selectedQuote.premium.toFixed(3)}%</span></span>
                </div>
              )}
            </div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-[#222]">
                <tr>{['排名', '做市商', '买价', '卖价', '买量', '卖量', '价差(bps)', '更新时间', '操作'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {selectedMM.map((q, i) => (
                  <tr key={i} className={`border-b border-[#111] hover:bg-[#1a1a2e] transition-colors ${i === 0 ? 'bg-[#d4af37]/5' : ''}`}>
                    <td className="px-3 py-2">{i === 0 ? <span className="text-[#d4af37] font-bold">最优</span> : <span className="text-[#555]">#{i + 1}</span>}</td>
                    <td className="px-3 py-2 text-white font-bold">{q.dealer}</td>
                    <td className="px-3 py-2 text-green-400 font-bold">{q.bidPrice.toFixed(4)}</td>
                    <td className="px-3 py-2 text-red-400 font-bold">{q.askPrice.toFixed(4)}</td>
                    <td className="px-3 py-2 text-[#888]">{q.bidSize.toLocaleString()}</td>
                    <td className="px-3 py-2 text-[#888]">{q.askSize.toLocaleString()}</td>
                    <td className={`px-3 py-2 font-bold ${q.spread < 2 ? 'text-green-400' : q.spread < 4 ? 'text-yellow-400' : 'text-red-400'}`}>{q.spread.toFixed(2)}</td>
                    <td className="px-3 py-2 text-[#555]">{new Date(q.ts).toLocaleTimeString('zh-CN')}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button type="button" onClick={() => placeQuoteOrder(String((q as any).mmName ?? (q as any).mm ?? (q as any).name ?? '做市商'), 'BUY', q.askPrice)} className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] hover:bg-green-500/40">买入</button>
                        <button type="button" onClick={() => placeQuoteOrder(String((q as any).mmName ?? (q as any).mm ?? (q as any).name ?? '做市商'), 'SELL', q.bidPrice)} className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] hover:bg-red-500/40">卖出</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {selectedMM.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-[#444]">等待做市商报价...</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="bg-[#111118] border border-[#222] rounded p-4">
              <div className="text-[#d4af37] font-bold mb-3">新建申购/赎回委托</div>
              <div className="space-y-3 text-[11px]">
                <div>
                  <label className="text-[#666] block mb-1">选择ETF</label>
                  <select value={selectedETF} onChange={e => setSelectedETF(e.target.value)}
                    className="w-full bg-[#0d0d14] border border-[#333] rounded px-2 py-1.5 text-white">
                    {quotes.map(q => <option key={q.id} value={q.id}>{q.id} - {q.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[#666] block mb-1">操作类型</label>
                  <div className="flex gap-2">
                    {(['CREATE', 'REDEEM'] as const).map(t => (
                      <button key={t} onClick={() => setOrderForm(p => ({ ...p, type: t }))}
                        className={`flex-1 py-1.5 rounded font-bold transition-colors ${orderForm.type === t ? (t === 'CREATE' ? 'bg-green-500 text-black' : 'bg-red-500 text-white') : 'bg-[#1a1a2e] text-[#666]'}`}>
                        {t === 'CREATE' ? '申购' : '赎回'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[#666] block mb-1">申购/赎回单数</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOrderForm(p => ({ ...p, units: String(Math.max(1, parseInt(p.units) - 1)) }))} className="w-7 h-7 bg-[#1a1a2e] rounded flex items-center justify-center hover:bg-[#333]"><Minus className="w-3 h-3" /></button>
                    <input type="number" min="1" value={orderForm.units} onChange={e => setOrderForm(p => ({ ...p, units: e.target.value }))} className="flex-1 bg-[#0d0d14] border border-[#333] rounded px-2 py-1.5 text-white text-center" />
                    <button onClick={() => setOrderForm(p => ({ ...p, units: String(parseInt(p.units) + 1) }))} className="w-7 h-7 bg-[#1a1a2e] rounded flex items-center justify-center hover:bg-[#333]"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
                {selectedQuote && (
                  <div className="bg-[#0d0d14] border border-[#222] rounded p-2 space-y-1">
                    <div className="flex justify-between"><span className="text-[#555]">NAV:</span><span className="text-[#ccc]">{selectedQuote.nav.toFixed(4)}</span></div>
                    <div className="flex justify-between"><span className="text-[#555]">溢折价:</span><span className={Math.abs(selectedQuote.premium) >= 0.8 ? 'text-yellow-400 font-bold' : 'text-green-400'}>{selectedQuote.premium > 0 ? '+' : ''}{selectedQuote.premium.toFixed(3)}%</span></div>
                    <div className="flex justify-between"><span className="text-[#555]">最优做市商:</span><span className="text-[#d4af37]">{selectedQuote.bestMM}</span></div>
                  </div>
                )}
                <button onClick={handleOrder}
                  className={`w-full py-2.5 font-bold rounded transition-colors ${orderForm.type === 'CREATE' ? 'bg-green-500 hover:bg-green-400 text-black' : 'bg-red-500 hover:bg-red-400 text-white'}`}>
                  提交{orderForm.type === 'CREATE' ? '申购' : '赎回'}委托
                </button>
              </div>
            </div>
            <div>
              <div className="text-[#d4af37] font-bold mb-3">委托历史</div>
              <div className="space-y-2 max-h-80 overflow-auto">
                {orderHistory.map(o => (
                  <div key={o.id} className={`p-2 rounded border text-[11px] ${o.type === 'CREATE' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-bold ${o.type === 'CREATE' ? 'text-green-400' : 'text-red-400'}`}>{o.type === 'CREATE' ? '申购' : '赎回'} {o.etfId}</span>
                      <span className="text-[10px] bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded">{o.status}</span>
                    </div>
                    <div className="text-[#666] mt-0.5">{o.units} 单 · {new Date(o.ts).toLocaleTimeString('zh-CN')}</div>
                  </div>
                ))}
                {orderHistory.length === 0 && <div className="text-[#444] text-center py-8">暂无委托记录</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#d4af37] font-bold flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> ETF溢折价预警记录
              </div>
              {notificationPermission !== 'granted' && (
                <button onClick={requestNotificationPermission}
                  className="text-[10px] px-2 py-1 bg-[#1a1a2e] border border-[#d4af37]/30 rounded text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors flex items-center gap-1">
                  <Bell className="w-3 h-3" /> 开启桌面通知
                </button>
              )}
            </div>
            {alerts.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-[#444]">
                <div className="text-center">
                  <div className="text-green-400/30 text-4xl mb-2">✓</div>
                  <div>所有ETF溢折价在正常范围内</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.filter((alert, i) => !ignoredAlerts.includes(`${alert.etfId}-${i}`)).map((alert, i) => (
                  <div key={i} className={`p-3 rounded border ${alert.level === 'CRITICAL' ? 'border-red-500/50 bg-red-500/5' : 'border-yellow-400/50 bg-yellow-400/5'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${alert.level === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-400/20 text-yellow-400'}`}>{alert.level}</span>
                      <span className="text-[#d4af37] font-bold">{alert.etfId}</span>
                      <span className="ml-auto text-[#555] text-[10px]">{new Date(alert.ts).toLocaleTimeString('zh-CN')}</span>
                    </div>
                    <div className="text-[#ccc] text-[11px]">{alert.message}</div>
                    <div className="flex gap-4 mt-2 text-[10px]">
                      <span className="text-[#666]">NAV: <span className="text-[#ccc]">{alert.nav.toFixed(4)}</span></span>
                      <span className="text-[#666]">市价: <span className="text-[#ccc]">{alert.marketPrice.toFixed(4)}</span></span>
                      <span className="text-[#666]">溢折价: <span className={alert.premium > 0 ? 'text-red-400' : 'text-blue-400'}>{alert.premium > 0 ? '+' : ''}{alert.premium.toFixed(3)}%</span></span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { if (alert.premium > 0) sendRedeemOrder(alert.etfId); else sendCreateOrder(alert.etfId); }}
                        className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] hover:bg-green-500/40">
                        {alert.premium > 0 ? '套利赎回' : '套利申购'}
                      </button>
                      <button type="button" onClick={() => setIgnoredAlerts(prev => [...prev, `${alert.etfId}-${i}`])} className="px-2 py-1 bg-[#1a1a2e] text-[#888] border border-[#333] rounded text-[10px] hover:text-[#ccc]">忽略</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

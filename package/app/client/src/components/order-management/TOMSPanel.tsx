import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { Activity, Wifi, WifiOff, Bell, BellOff, AlertTriangle, CheckCircle, Clock, X, ChevronRight, Send, RefreshCw, Plus } from 'lucide-react';
import { useTOMSWebSocket, BondOrder, BondOrderStatus } from '@/hooks/useTOMSWebSocket';
import { RowDetailDrawer } from '@/components/RowDetailDrawer';
import { toast } from 'sonner';

const yieldCurveData = [
  { term: '1M', us: 5.32, de: 3.68, jp: 0.08, cn: 1.85 },
  { term: '3M', us: 5.28, de: 3.72, jp: 0.10, cn: 1.92 },
  { term: '6M', us: 5.18, de: 3.65, jp: 0.12, cn: 2.05 },
  { term: '1Y', us: 5.02, de: 3.45, jp: 0.18, cn: 2.15 },
  { term: '2Y', us: 4.72, de: 3.12, jp: 0.22, cn: 2.22 },
  { term: '5Y', us: 4.42, de: 2.85, jp: 0.38, cn: 2.25 },
  { term: '10Y', us: 4.28, de: 2.61, jp: 0.51, cn: 2.28 },
  { term: '30Y', us: 4.49, de: 2.78, jp: 1.62, cn: 2.45 },
];
const spreadData = [
  { time: '09:30', ig: 82, hy: 312, em: 185 },
  { time: '10:00', ig: 85, hy: 318, em: 188 },
  { time: '10:30', ig: 83, hy: 315, em: 190 },
  { time: '11:00', ig: 80, hy: 308, em: 182 },
  { time: '11:30', ig: 78, hy: 302, em: 178 },
  { time: '12:00', ig: 81, hy: 310, em: 185 },
  { time: '13:00', ig: 84, hy: 320, em: 192 },
  { time: '14:00', ig: 79, hy: 305, em: 180 },
  { time: '15:00', ig: 76, hy: 298, em: 175 },
];

const statusColors: Record<BondOrderStatus, string> = {
  FILLED: 'text-green-400 bg-green-400/10',
  PARTIAL: 'text-yellow-400 bg-yellow-400/10',
  PENDING: 'text-blue-400 bg-blue-400/10',
  CANCELLED: 'text-red-400 bg-red-400/10',
  REJECTED: 'text-red-500 bg-red-500/10',
};
const statusLabels: Record<BondOrderStatus, string> = {
  PENDING: '待成交', PARTIAL: '部分成交', FILLED: '全成交', CANCELLED: '已撤单', REJECTED: '已拒绝',
};

function OrderTimeline({ order }: { order: BondOrder }) {
  const statusBg: Record<BondOrderStatus, string> = {
    PENDING: 'border-blue-400/40 bg-blue-400/5',
    PARTIAL: 'border-yellow-400/40 bg-yellow-400/5',
    FILLED: 'border-green-400/40 bg-green-400/5',
    CANCELLED: 'border-red-400/40 bg-red-400/5',
    REJECTED: 'border-red-500/40 bg-red-500/5',
  };
  return (
    <div className="mt-3 border border-[#222] rounded bg-[#0d0d14] p-3">
      <div className="text-[#d4af37] text-[10px] font-bold mb-2 flex items-center gap-1">
        <Clock className="w-3 h-3" /> 状态变更时间线
      </div>
      {order.timeline.map((step, i) => (
        <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
          <div className="flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${statusBg[step.status]}`}>
              {step.status === 'FILLED' ? <CheckCircle className="w-3 h-3 text-green-400" /> :
               step.status === 'CANCELLED' || step.status === 'REJECTED' ? <X className="w-3 h-3 text-red-400" /> :
               step.status === 'PARTIAL' ? <Activity className="w-3 h-3 text-yellow-400" /> :
               <Clock className="w-3 h-3 text-blue-400" />}
            </div>
            {i < order.timeline.length - 1 && <div className="w-px h-4 bg-[#333] mt-0.5" />}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold ${statusColors[step.status].split(' ')[0]}`}>
                {statusLabels[step.status]}
              </span>
              <span className="text-[#555] text-[9px]">
                {new Date(step.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="text-[#666] text-[10px] mt-0.5">{step.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewOrderForm({ onSubmit, onClose }: {
  onSubmit: (p: { isin: string; issuer: string; side: 'BUY' | 'SELL'; faceValue: number; price: number }) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ isin: 'US912796ZT08', issuer: 'US Treasury', side: 'SELL' as 'BUY' | 'SELL', faceValue: '5000000', price: '98.50' });
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#111118] border border-[#d4af37]/30 rounded-lg p-6 w-[480px]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[#d4af37] font-bold">新建债券委托</span>
          <button onClick={onClose} className="text-[#666] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#666] block mb-1">ISIN</label>
              <input value={form.isin} onChange={e => setForm(p => ({ ...p, isin: e.target.value }))}
                className="w-full bg-[#0d0d14] border border-[#333] rounded px-2 py-1.5 text-white font-mono" />
            </div>
            <div>
              <label className="text-[#666] block mb-1">发行人</label>
              <input value={form.issuer} onChange={e => setForm(p => ({ ...p, issuer: e.target.value }))}
                className="w-full bg-[#0d0d14] border border-[#333] rounded px-2 py-1.5 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[#666] block mb-1">方向</label>
              <div className="flex gap-1">
                {(['BUY', 'SELL'] as const).map(s => (
                  <button key={s} onClick={() => setForm(p => ({ ...p, side: s }))}
                    className={`flex-1 py-1.5 rounded font-bold transition-colors ${form.side === s ? (s === 'BUY' ? 'bg-green-500 text-black' : 'bg-red-500 text-white') : 'bg-[#1a1a2e] text-[#666]'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[#666] block mb-1">面值 ($)</label>
              <input value={form.faceValue} onChange={e => setForm(p => ({ ...p, faceValue: e.target.value }))}
                className="w-full bg-[#0d0d14] border border-[#333] rounded px-2 py-1.5 text-white" />
            </div>
            <div>
              <label className="text-[#666] block mb-1">价格</label>
              <input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                className="w-full bg-[#0d0d14] border border-[#333] rounded px-2 py-1.5 text-white" />
            </div>
          </div>
          <button onClick={() => { onSubmit({ isin: form.isin, issuer: form.issuer, side: form.side, faceValue: parseFloat(form.faceValue), price: parseFloat(form.price) }); onClose(); }}
            className="w-full py-2.5 bg-[#d4af37] text-black font-bold rounded hover:bg-[#e5c158] transition-colors">提交委托</button>
        </div>
      </div>
    </div>
  );
}

function TOMSExecutionEvidenceDesk() {
  return <section className="rounded border border-amber-900/60 bg-[#0b0d12] p-4 text-slate-100" data-toms-execution-evidence-desk="true"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" /><div><h2 className="text-sm font-bold text-amber-100">TOMS · 债券执行证据状态</h2><p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-400">当前终端未接入经授权的 OMS、券商路由、交易场所、做市商 RFQ、账户权限、成交回报或风险限额来源。没有这些证据时，终端不显示订单、成交、RFQ、双边报价、P&amp;L、DV01、延迟、风险告警或可执行操作。</p></div></div><div className="mt-3 grid gap-2 md:grid-cols-3"><Evidence label="委托与成交回报" value="未导入" description="无订单状态、成交量、价格、收益率或交易员/账户记录。" /><Evidence label="RFQ 与做市报价" value="未连接" description="无受授权交易商请求、双边报价、点差、规模或最优报价。" /><Evidence label="风控与通知" value="不可计算" description="无账户风险限额、持仓、估值或审批证据，不能产生警报或桌面通知。" /></div><div className="mt-3 rounded border border-dashed border-slate-700 p-3 text-center text-[10px] text-slate-500">没有受授权的债券执行记录。新建、撤销、联动、RFQ 与通知均保持不可用；终端不会模拟提交、接受、成交或撤单。</div></section>;
}

function Evidence({ label, value, description }: { label: string; value: string; description: string }) { return <div className="rounded border border-slate-800 bg-slate-950/35 p-2"><p className="text-[10px] text-slate-300">{label}</p><p className="mt-2 text-xs font-semibold text-amber-200">{value}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{description}</p></div>; }

function HistoricalTOMSPanel() {
  const { orders, rfqList, quotes, riskAlerts, connectionStatus, latencyMs, notificationPermission, requestNotificationPermission, cancelOrder, submitOrder, sendAIMLinkOrder } = useTOMSWebSocket();
  const [activeTab, setActiveTab] = useState<'blotter' | 'curves' | 'spreads' | 'rfq' | 'quotes' | 'risk'>('blotter');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BondOrderStatus>('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<BondOrder | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [rfqForm, setRfqForm] = useState({ isin: '', face: '', side: 'BUY' as 'BUY' | 'SELL' });
  const [rfqSent, setRfqSent] = useState(false);
  const [rfqResponses, setRfqResponses] = useState<any[]>([]);

  const filteredOrders = useMemo(() =>
    orders.filter(o => statusFilter === 'ALL' || o.status === statusFilter),
    [orders, statusFilter]);

  const stats = useMemo(() => ({
    total: orders.length,
    filled: orders.filter(o => o.status === 'FILLED').length,
    partial: orders.filter(o => o.status === 'PARTIAL').length,
    pending: orders.filter(o => o.status === 'PENDING').length,
    totalFace: orders.filter(o => o.status === 'FILLED').reduce((s, o) => s + o.faceValue, 0),
    totalPnL: orders.filter(o => o.status === 'FILLED').reduce((s, o) => s + o.pnl, 0),
    totalDV01: orders.reduce((s, o) => s + (o.dv01 || 0), 0),
  }), [orders]);

  const sendRFQ = () => {
    if (!rfqForm.isin || !rfqForm.face) { toast.error('请填写ISIN和面值'); return; }
    setRfqSent(true);
    setTimeout(() => setRfqResponses([
      { dealer: 'Goldman Sachs', bid: 99.42, ask: 99.48, yld: 4.92, spread: 62 },
      { dealer: 'JP Morgan', bid: 99.40, ask: 99.46, yld: 4.93, spread: 63 },
      { dealer: 'Morgan Stanley', bid: 99.38, ask: 99.44, yld: 4.95, spread: 65 },
      { dealer: 'Citi', bid: 99.35, ask: 99.41, yld: 4.97, spread: 67 },
    ]), 1200);
  };

  const connColor = connectionStatus === 'CONNECTED' ? 'text-green-400' : 'text-red-400';
  const connLabel = { CONNECTING: '连接中', CONNECTED: 'LIVE', DISCONNECTED: '断开', ERROR: '错误' }[connectionStatus];

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">TOMS</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">卖方债券委托单管理系统</span>
          <span className={`flex items-center gap-1 text-[10px] ${connColor}`}>
            {connectionStatus === 'CONNECTED' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connLabel}{connectionStatus === 'CONNECTED' && latencyMs > 0 && <span className="text-[#555]">{latencyMs}ms</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#888]">面值:</span><span className="text-[#d4af37] font-bold">${(stats.totalFace / 1e6).toFixed(1)}M</span>
          <span className="text-[#888]">P&L:</span>
          <span className={`font-bold ${stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toLocaleString()}</span>
          <span className="text-[#888]">DV01:</span><span className="text-[#d4af37]">${(stats.totalDV01 / 1000).toFixed(1)}K</span>
          <button onClick={requestNotificationPermission} title="桌面通知"
            className={`p-1 rounded ${notificationPermission === 'granted' ? 'text-[#d4af37]' : 'text-[#555] hover:text-[#d4af37]'}`}>
            {notificationPermission === 'granted' ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => sendAIMLinkOrder('AIM-DEMO-' + Date.now())} title="AIM买方联动"
            className="px-2 py-1 bg-[#1a1a2e] border border-[#d4af37]/30 rounded text-[#d4af37] text-[10px] hover:bg-[#d4af37]/10 transition-colors">AIM联动</button>
          <button onClick={() => setShowNewOrder(true)}
            className="flex items-center gap-1 px-2 py-1 bg-[#d4af37] text-black rounded font-bold text-[10px] hover:bg-[#e5c158] transition-colors">
            <Plus className="w-3 h-3" /> 新建委托
          </button>
        </div>
      </div>
      {/* KPI */}
      <div className="grid grid-cols-7 gap-0 border-b border-[#222] flex-shrink-0">
        {[
          { label: '今日委托', value: stats.total, color: '#d4af37' },
          { label: '全成交', value: stats.filled, color: '#4ade80' },
          { label: '部分成交', value: stats.partial, color: '#facc15' },
          { label: '待成交', value: stats.pending, color: '#60a5fa' },
          { label: 'IG利差', value: '82bps', color: '#4ade80' },
          { label: 'HY利差', value: '312bps', color: '#facc15' },
          { label: 'EM利差', value: '185bps', color: '#f97316' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      {/* Tabs */}
      <div className="flex border-b border-[#222] flex-shrink-0">
        {[
          { id: 'blotter', label: `委托簿 (${filteredOrders.length})` },
          { id: 'curves', label: '收益率曲线' },
          { id: 'spreads', label: '利差监控' },
          { id: 'rfq', label: `RFQ (${rfqList.length})` },
          { id: 'quotes', label: `做市报价 (${quotes.length})` },
          { id: 'risk', label: `风险预警${riskAlerts.length > 0 ? ` (${riskAlerts.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors whitespace-nowrap ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
            {t.id === 'risk' && riskAlerts.some(a => a.level === 'CRITICAL') && (
              <span className="ml-1 w-1.5 h-1.5 bg-red-500 rounded-full inline-block animate-pulse" />
            )}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* 委托簿 */}
        {activeTab === 'blotter' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0d14] border-b border-[#1a1a2e] flex-shrink-0">
              {(['ALL', 'FILLED', 'PARTIAL', 'PENDING', 'CANCELLED'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 rounded text-[10px] transition-colors ${statusFilter === s ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888] hover:text-[#ccc]'}`}>
                  {s === 'ALL' ? '全部' : statusLabels[s as BondOrderStatus]}
                </button>
              ))}
              <span className="ml-auto text-[#555] text-[10px]">{filteredOrders.length} 笔 | 实时推送</span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[#0d0d14] border-b border-[#222] z-10">
                  <tr>
                    {['', '委托号', '发行人', 'ISIN', '方向', '面值', '已成交', '价格', 'YTM', 'OAS', '状态', '算法', '交易员', '账户', '时间', 'P&L', 'DV01', '操作'].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-[#666] font-normal whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <React.Fragment key={order.id}>
                      <tr className={`border-b border-[#111] hover:bg-[#1a1a2e] cursor-pointer transition-colors ${order._isNew ? 'bg-[#d4af37]/5' : ''}`}
                        onClick={() => { setExpandedOrderId(expandedOrderId === order.id ? null : order.id); setSelectedOrder(order); }}>
                        <td className="px-2 py-1.5">
                          <ChevronRight className={`w-3 h-3 text-[#555] transition-transform ${expandedOrderId === order.id ? 'rotate-90' : ''}`} />
                        </td>
                        <td className="px-2 py-1.5 text-[#d4af37] font-mono">{order.id.slice(-8)}</td>
                        <td className="px-2 py-1.5 text-white font-bold whitespace-nowrap">{order.issuer}</td>
                        <td className="px-2 py-1.5 text-[#666] font-mono text-[10px]">{order.isin}</td>
                        <td className={`px-2 py-1.5 font-bold ${order.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{order.side}</td>
                        <td className="px-2 py-1.5 text-[#ccc]">${(order.faceValue / 1e6).toFixed(1)}M</td>
                        <td className="px-2 py-1.5 text-[#ccc]">${(order.filled / 1e6).toFixed(1)}M</td>
                        <td className="px-2 py-1.5 text-[#ccc]">{order.price.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-[#d4af37]">{order.yieldToMaturity.toFixed(3)}%</td>
                        <td className={`px-2 py-1.5 ${order.spread > 0 ? 'text-red-400' : 'text-green-400'}`}>{order.spread > 0 ? '+' : ''}{order.spread}</td>
                        <td className="px-2 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
                        </td>
                        <td className="px-2 py-1.5 text-[#888]">{order.algo}</td>
                        <td className="px-2 py-1.5 text-[#aaa]">{order.trader}</td>
                        <td className="px-2 py-1.5 text-[#666]">{order.account}</td>
                        <td className="px-2 py-1.5 text-[#666]">{order.time}</td>
                        <td className={`px-2 py-1.5 font-bold ${order.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {order.pnl !== 0 ? `${order.pnl >= 0 ? '+' : ''}$${order.pnl.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-[#888]">${(order.dv01 / 1000).toFixed(1)}K</td>
                        <td className="px-2 py-1.5">
                          {(order.status === 'PENDING' || order.status === 'PARTIAL') && (
                            <button onClick={e => { e.stopPropagation(); cancelOrder(order.id); }}
                              className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] hover:bg-red-500/40 transition-colors">撤单</button>
                          )}
                        </td>
                      </tr>

                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length === 0 && (
                <div className="flex items-center justify-center h-40 text-[#444]">WebSocket 连接中，等待委托数据...</div>
              )}
            </div>
          </div>
        )}
        {/* 收益率曲线 */}
        {activeTab === 'curves' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3">全球主权债收益率曲线对比</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yieldCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="term" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} unit="%" />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} formatter={(v: any) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="us" stroke="#d4af37" dot={{ r: 3 }} name="美国" strokeWidth={2} />
                <Line type="monotone" dataKey="de" stroke="#4ade80" dot={{ r: 3 }} name="德国" strokeWidth={2} />
                <Line type="monotone" dataKey="jp" stroke="#60a5fa" dot={{ r: 3 }} name="日本" strokeWidth={2} />
                <Line type="monotone" dataKey="cn" stroke="#f97316" dot={{ r: 3 }} name="中国" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {[
                { country: '美国', '2Y': '4.72%', '10Y': '4.28%', '30Y': '4.49%', slope: '+0.44', color: '#d4af37' },
                { country: '德国', '2Y': '3.12%', '10Y': '2.61%', '30Y': '2.78%', slope: '+0.49', color: '#4ade80' },
                { country: '日本', '2Y': '0.22%', '10Y': '0.51%', '30Y': '1.62%', slope: '+1.40', color: '#60a5fa' },
                { country: '中国', '2Y': '2.22%', '10Y': '2.28%', '30Y': '2.45%', slope: '+0.23', color: '#f97316' },
              ].map(c => (
                <div key={c.country} className="bg-[#111118] border border-[#222] rounded p-3">
                  <div className="font-bold mb-2" style={{ color: c.color }}>{c.country}</div>
                  <div className="space-y-1 text-[11px]">
                    {(['2Y', '10Y', '30Y'] as const).map(t => (
                      <div key={t} className="flex justify-between"><span className="text-[#666]">{t}:</span><span className="text-[#ccc]">{c[t]}</span></div>
                    ))}
                    <div className="flex justify-between border-t border-[#222] pt-1"><span className="text-[#666]">斜率:</span><span className="text-green-400">{c.slope}%</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 利差监控 */}
        {activeTab === 'spreads' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3">信用利差实时监控 (bps)</div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={spreadData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} unit="bps" />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} formatter={(v: any) => `${v}bps`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="ig" stroke="#4ade80" fill="#4ade80/10" name="IG利差" strokeWidth={2} />
                <Area type="monotone" dataKey="hy" stroke="#facc15" fill="#facc15/10" name="HY利差" strokeWidth={2} />
                <Area type="monotone" dataKey="em" stroke="#f97316" fill="#f97316/10" name="EM利差" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* RFQ */}
        {activeTab === 'rfq' && (
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="bg-[#111118] border border-[#222] rounded p-4">
              <div className="text-[#d4af37] font-bold mb-3 flex items-center gap-2">
                <Activity className="w-3 h-3" /> 实时RFQ流 ({rfqList.length})
              </div>
              <div className="space-y-2 max-h-80 overflow-auto">
                {rfqList.map(rfq => (
                  <div key={rfq.id} className={`p-2 rounded border text-[11px] ${rfq.status === 'OPEN' ? 'border-blue-400/30 bg-blue-400/5' : rfq.status === 'QUOTED' ? 'border-yellow-400/30 bg-yellow-400/5' : rfq.status === 'TRADED' ? 'border-green-400/30 bg-green-400/5' : 'border-[#222] bg-[#0d0d14]'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-bold">{rfq.issuer}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rfq.status === 'OPEN' ? 'bg-blue-400/20 text-blue-400' : rfq.status === 'QUOTED' ? 'bg-yellow-400/20 text-yellow-400' : rfq.status === 'TRADED' ? 'bg-green-400/20 text-green-400' : 'bg-[#333] text-[#666]'}`}>{rfq.status}</span>
                    </div>
                    <div className="flex gap-3 text-[#888]">
                      <span className={rfq.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>{rfq.side}</span>
                      <span>${(rfq.faceValue / 1e6).toFixed(1)}M</span>
                      {rfq.bidPrice && <span>Bid: <span className="text-green-400">{rfq.bidPrice.toFixed(4)}</span></span>}
                      {rfq.askPrice && <span>Ask: <span className="text-red-400">{rfq.askPrice.toFixed(4)}</span></span>}
                    </div>
                    {rfq.bestDealer && <div className="text-[10px] text-[#d4af37] mt-1">最优: {rfq.bestDealer}</div>}
                  </div>
                ))}
                {rfqList.length === 0 && <div className="text-[#444] text-center py-8">等待RFQ数据...</div>}
              </div>
            </div>
            <div className="bg-[#111118] border border-[#222] rounded p-4">
              <div className="text-[#d4af37] font-bold mb-3">发起新RFQ</div>
              <div className="space-y-3 text-[11px]">
                <div><label className="text-[#666] block mb-1">ISIN</label>
                  <input value={rfqForm.isin} onChange={e => setRfqForm(p => ({ ...p, isin: e.target.value }))} placeholder="US912796ZT08"
                    className="w-full bg-[#0d0d14] border border-[#333] rounded px-2 py-1.5 text-white font-mono" /></div>
                <div><label className="text-[#666] block mb-1">面值 ($)</label>
                  <input value={rfqForm.face} onChange={e => setRfqForm(p => ({ ...p, face: e.target.value }))} placeholder="5000000"
                    className="w-full bg-[#0d0d14] border border-[#333] rounded px-2 py-1.5 text-white" /></div>
                <div className="flex gap-2">
                  {(['BUY', 'SELL'] as const).map(s => (
                    <button key={s} onClick={() => setRfqForm(p => ({ ...p, side: s }))}
                      className={`flex-1 py-1.5 rounded font-bold transition-colors ${rfqForm.side === s ? (s === 'BUY' ? 'bg-green-500 text-black' : 'bg-red-500 text-white') : 'bg-[#1a1a2e] text-[#666]'}`}>{s}</button>
                  ))}
                </div>
                <button onClick={sendRFQ} className="w-full py-2.5 bg-[#d4af37] text-black font-bold rounded hover:bg-[#e5c158] transition-colors flex items-center justify-center gap-2">
                  <Send className="w-3 h-3" /> 发送RFQ
                </button>
                {rfqSent && rfqResponses.length === 0 && (
                  <div className="text-center text-[#888] py-4 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" /> 等待交易商回复...
                  </div>
                )}
                {rfqResponses.map((r, i) => (
                  <div key={i} className={`p-2 rounded border ${i === 0 ? 'border-[#d4af37]/50 bg-[#d4af37]/5' : 'border-[#222]'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[#ccc] font-bold">{r.dealer}</span>
                      {i === 0 && <span className="text-[9px] bg-[#d4af37] text-black px-1.5 py-0.5 rounded font-bold">最优</span>}
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      <span className="text-green-400">{r.bid}</span><span className="text-red-400">{r.ask}</span>
                      <span className="text-[#d4af37]">{r.yld}%</span><span className="text-[#888]">{r.spread}bps</span>
                    </div>
                    <button type="button" onClick={() => { const price = Number(rfqForm.side === 'BUY' ? r.ask : r.bid); submitOrder({ isin: rfqForm.isin, issuer: String(r.dealer), side: rfqForm.side, faceValue: Number(rfqForm.face) || 0, price }); toast.success(`已向 ${r.dealer} 提交成交`, { description: `${rfqForm.side} ${rfqForm.isin} @ ${price}` }); }} className="mt-1 w-full py-1 bg-[#1a1a2e] hover:bg-[#d4af37] hover:text-black text-[#ccc] rounded text-[10px] font-bold transition-colors">成交</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* 做市报价 */}
        {activeTab === 'quotes' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3 flex items-center gap-2">
              <Activity className="w-3 h-3 animate-pulse" /> 做市商实时双边报价
            </div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-[#222]">
                <tr>{['发行人', 'ISIN', '买价', '卖价', '买YTM', '卖YTM', '价差(bps)', '规模', '做市商', '更新时间'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {quotes.map((q, i) => (
                  <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e] transition-colors">
                    <td className="px-3 py-2 text-white font-bold">{q.issuer}</td>
                    <td className="px-3 py-2 text-[#666] font-mono text-[10px]">{q.isin}</td>
                    <td className="px-3 py-2 text-green-400 font-bold">{q.bidPrice.toFixed(4)}</td>
                    <td className="px-3 py-2 text-red-400 font-bold">{q.askPrice.toFixed(4)}</td>
                    <td className="px-3 py-2 text-green-400">{q.bidYield.toFixed(3)}%</td>
                    <td className="px-3 py-2 text-red-400">{q.askYield.toFixed(3)}%</td>
                    <td className="px-3 py-2 text-[#d4af37]">{q.spread.toFixed(1)}</td>
                    <td className="px-3 py-2 text-[#ccc]">${(q.size / 1e6).toFixed(1)}M</td>
                    <td className="px-3 py-2 text-[#888]">{q.dealer}</td>
                    <td className="px-3 py-2 text-[#555]">{new Date(q.ts).toLocaleTimeString('zh-CN')}</td>
                  </tr>
                ))}
                {quotes.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-[#444]">等待做市商报价...</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {/* 风险预警 */}
        {activeTab === 'risk' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" /> 实时风险预警
              {notificationPermission !== 'granted' && (
                <button onClick={requestNotificationPermission}
                  className="ml-auto text-[10px] px-2 py-1 bg-[#1a1a2e] border border-[#d4af37]/30 rounded text-[#d4af37] hover:bg-[#d4af37]/10 transition-colors flex items-center gap-1">
                  <Bell className="w-3 h-3" /> 开启桌面通知
                </button>
              )}
            </div>
            {riskAlerts.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-[#444]">
                <div className="text-center"><CheckCircle className="w-8 h-8 text-green-400/30 mx-auto mb-2" /><div>暂无风险预警</div></div>
              </div>
            ) : (
              <div className="space-y-2">
                {riskAlerts.map((alert, i) => (
                  <div key={i} className={`p-3 rounded border ${alert.level === 'CRITICAL' ? 'border-red-500/50 bg-red-500/5' : alert.level === 'WARNING' ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-blue-400/30 bg-blue-400/5'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${alert.level === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : alert.level === 'WARNING' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-400/20 text-blue-400'}`}>{alert.level}</span>
                      <span className="text-[#888] text-[10px]">[{alert.type}]</span>
                      <span className="ml-auto text-[#555] text-[10px]">{new Date(alert.ts).toLocaleTimeString('zh-CN')}</span>
                    </div>
                    <div className="text-[#ccc] text-[11px]">{alert.message}</div>
                    {alert.limit > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-[#666] mb-1">
                          <span>当前: <span className="text-[#ccc]">{alert.value}</span></span>
                          <span>限额: <span className="text-[#ccc]">{alert.limit}</span></span>
                        </div>
                        <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${alert.value / alert.limit > 0.9 ? 'bg-red-500' : alert.value / alert.limit > 0.7 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(100, (alert.value / alert.limit) * 100).toFixed(1)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {showNewOrder && <NewOrderForm onSubmit={submitOrder} onClose={() => setShowNewOrder(false)} />}
      {/* Right-side Detail Drawer */}
      <RowDetailDrawer
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `${selectedOrder.issuer} — ${selectedOrder.id.slice(-8)}` : ''}
        subtitle={selectedOrder ? `${selectedOrder.isin} | ${selectedOrder.side} $${(selectedOrder.faceValue / 1e6).toFixed(1)}M` : ''}
        badge={selectedOrder ? {
          label: statusLabels[selectedOrder.status],
          color: selectedOrder.status === 'FILLED' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
            : selectedOrder.status === 'PARTIAL' ? 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30'
            : selectedOrder.status === 'PENDING' ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
            : 'bg-red-600/20 text-red-300 border-red-500/30'
        } : undefined}
        fields={selectedOrder ? [
          { label: '委托号', value: selectedOrder.id, type: 'mono' },
          { label: 'ISIN', value: selectedOrder.isin, type: 'mono' },
          { label: '发行人', value: selectedOrder.issuer, type: 'text', highlight: true },
          { label: '方向', value: selectedOrder.side, type: 'badge', badgeColor: selectedOrder.side === 'BUY' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30' : 'bg-red-600/20 text-red-300 border-red-500/30' },
          { label: '面值', value: `$${(selectedOrder.faceValue / 1e6).toFixed(2)}M`, type: 'mono' },
          { label: '已成交', value: `$${(selectedOrder.filled / 1e6).toFixed(2)}M`, type: 'mono' },
          { label: '成交率', value: selectedOrder.faceValue > 0 ? `${(selectedOrder.filled / selectedOrder.faceValue * 100).toFixed(1)}%` : '0%', type: 'percent' },
          { label: '价格', value: selectedOrder.price.toFixed(4), type: 'mono' },
          { label: 'YTM', value: `${selectedOrder.yieldToMaturity.toFixed(3)}%`, type: 'percent' },
          { label: 'OAS价差', value: `${selectedOrder.spread > 0 ? '+' : ''}${selectedOrder.spread} bps`, type: 'mono' },
          { label: 'DV01', value: `$${selectedOrder.dv01.toLocaleString()}`, type: 'mono' },
          { label: '实现盈亏', value: selectedOrder.pnl !== 0 ? `${selectedOrder.pnl >= 0 ? '+' : ''}$${selectedOrder.pnl.toLocaleString()}` : '—', type: 'pnl' },
        ] : []}
        sections={selectedOrder ? [{
          title: '债券信息',
          fields: [
            { label: '评级', value: selectedOrder.rating, type: 'badge', badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30' },
            { label: '息票率', value: `${selectedOrder.coupon}%`, type: 'percent' },
            { label: '久期', value: `${selectedOrder.duration}年`, type: 'text' },
            { label: '到期日', value: selectedOrder.maturity, type: 'date' },
            { label: '成交场所', value: selectedOrder.venue, type: 'text' },
            { label: '算法', value: selectedOrder.algo, type: 'badge', badgeColor: 'bg-amber-600/20 text-amber-300 border-amber-500/30' },
            { label: '交易员', value: selectedOrder.trader, type: 'text' },
            { label: '账户', value: selectedOrder.account, type: 'mono' },
            { label: '时间', value: selectedOrder.time, type: 'date' },
          ],
        }] : []}
        actions={selectedOrder && (selectedOrder.status === 'PENDING' || selectedOrder.status === 'PARTIAL') ? [
          { label: '撤销委托', onClick: () => { cancelOrder(selectedOrder.id); setSelectedOrder(null); }, variant: 'danger' },
        ] : []}
      />
    </div>
  );
}

export default function TOMSPanel() {
  const [showHistorical, setShowHistorical] = useState(false);
  return <div className="h-full overflow-auto bg-[#0a0a0f] p-3"><TOMSExecutionEvidenceDesk /><details className="mt-3 rounded border border-[#333] bg-[#0d0d14]" onToggle={(event) => setShowHistorical((event.currentTarget as HTMLDetailsElement).open)} data-toms-historical-content="true"><summary className="cursor-pointer px-3 py-2 text-[10px] text-[#888] hover:text-[#ccc]">保留原 TOMS 委托、RFQ、报价与风险展示（非事实）</summary>{showHistorical && <div className="pointer-events-none select-none border-t border-[#333] opacity-80"><p className="m-3 rounded border border-amber-800/60 bg-amber-950/20 p-2 text-[9px] leading-4 text-amber-100" data-toms-historical-boundary="true">以下区域完整保留原债券委托、收益率曲线、利差、RFQ、报价、风险告警、桌面通知和 AIM 联动结构。其服务端使用随机生成的订单、报价、成交和警报；不是当前执行、账户、市场、做市商或风控事实，且已禁用交互。</p><HistoricalTOMSPanel /></div>}</details></div>;
}

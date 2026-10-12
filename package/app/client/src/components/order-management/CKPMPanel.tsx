import { exportPanelCsv } from '@/components/PanelActionButton';
import React, { useState } from 'react';
import { Activity, CheckCircle, AlertCircle, Clock, XCircle, FileText, Building2, RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { exportDataToExcel, exportDataToCSV } from '@/lib/exportUtils';

// ─── ETF创建/赎回委托数据 ─────────────────────────────────────────────────────
const ORDERS = [
  { id: 'CR-20240702-001', etf: 'SPY', ap: 'Goldman Sachs', type: 'CREATION', units: 500000, nav: 521.38, totalValue: 260690000, status: 'SETTLED', t0: '09:15', t1: '10:00', custodian: 'State Street', confirmed: true, swiftRef: 'GSCO-MT548-001', failReason: null, pcfVersion: 'PCF-20240702-v3' },
  { id: 'CR-20240702-002', etf: 'QQQ', ap: 'Citadel Securities', type: 'REDEMPTION', units: 250000, nav: 448.25, totalValue: 112062500, status: 'IN_SETTLEMENT', t0: '09:32', t1: '10:30', custodian: 'BNY Mellon', confirmed: true, swiftRef: 'CITI-MT548-002', failReason: null, pcfVersion: 'PCF-20240702-v2' },
  { id: 'CR-20240702-003', etf: 'IVV', ap: 'Jane Street', type: 'CREATION', units: 1000000, nav: 519.82, totalValue: 519820000, status: 'PENDING_SETTLEMENT', t0: '10:05', t1: '11:00', custodian: 'JP Morgan', confirmed: false, swiftRef: null, failReason: null, pcfVersion: 'PCF-20240702-v3' },
  { id: 'CR-20240702-004', etf: 'GLD', ap: 'Virtu Financial', type: 'CREATION', units: 100000, nav: 218.45, totalValue: 21845000, status: 'FAILED', t0: '10:18', t1: null, custodian: 'HSBC', confirmed: false, swiftRef: 'VIRT-MT548-004', failReason: '篮子组合股票交割失败：AAPL 数量不足', pcfVersion: 'PCF-20240702-v1' },
  { id: 'CR-20240702-005', etf: 'TLT', ap: 'Flow Traders', type: 'REDEMPTION', units: 300000, nav: 89.24, totalValue: 26772000, status: 'SETTLED', t0: '11:22', t1: '12:15', custodian: 'Citi', confirmed: true, swiftRef: 'FLOW-MT548-005', failReason: null, pcfVersion: 'PCF-20240702-v2' },
  { id: 'CR-20240702-006', etf: 'EEM', ap: 'Susquehanna', type: 'CREATION', units: 750000, nav: 42.18, totalValue: 31635000, status: 'IN_SETTLEMENT', t0: '13:05', t1: '14:00', custodian: 'Deutsche Bank', confirmed: true, swiftRef: 'SUS-MT548-006', failReason: null, pcfVersion: 'PCF-20240702-v4' },
];

// ─── PCF篮子组合数据 ──────────────────────────────────────────────────────────
const PCF_DATA: Record<string, { ticker: string; name: string; shares: number; price: number; weight: number; deliverable: boolean }[]> = {
  SPY: [
    { ticker: 'AAPL', name: '苹果公司', shares: 8842, price: 189.42, weight: 7.12, deliverable: true },
    { ticker: 'MSFT', name: '微软', shares: 7234, price: 415.28, weight: 12.80, deliverable: true },
    { ticker: 'NVDA', name: '英伟达', shares: 3218, price: 875.32, weight: 11.98, deliverable: true },
    { ticker: 'AMZN', name: '亚马逊', shares: 5892, price: 182.15, weight: 4.57, deliverable: true },
    { ticker: 'GOOGL', name: '谷歌A', shares: 4521, price: 175.84, weight: 3.38, deliverable: true },
    { ticker: 'META', name: 'Meta', shares: 2847, price: 502.30, weight: 6.08, deliverable: false },
    { ticker: 'BRK.B', name: '伯克希尔B', shares: 3156, price: 362.48, weight: 4.87, deliverable: true },
    { ticker: 'LLY', name: '礼来', shares: 1245, price: 892.15, weight: 4.73, deliverable: true },
    { ticker: 'JPM', name: '摩根大通', shares: 4892, price: 198.42, weight: 4.13, deliverable: true },
    { ticker: 'V', name: 'Visa', shares: 3421, price: 272.18, weight: 3.97, deliverable: true },
  ],
  GLD: [
    { ticker: 'GOLD_PHYS', name: '实物黄金', shares: 100000, price: 218.45, weight: 100, deliverable: false },
  ],
};

// ─── SWIFT报文模板 ────────────────────────────────────────────────────────────
const SWIFT_MESSAGES: Record<string, string> = {
  'GSCO-MT548-001': `:16R:GENL
:20C::SEME//GSCO-MT548-001
:23G:NEWM
:98A::PREP//20240702
:16S:GENL
:16R:TRADDET
:35B:ISIN US78462F1030
/US/SPY
SPDR S&P 500 ETF TRUST
:36B::SETT//UNIT/500000,
:97A::SAFE//GSCO-ACCT-001
:70E::TRDE//CREATION ORDER
AUTHORIZED PARTICIPANT: GOLDMAN SACHS
PCF VERSION: PCF-20240702-v3
:16S:TRADDET
:16R:SETDET
:22F::SETR//TRAD
:97A::SAFE//SSBT-ACCT-001
:98A::SETT//20240703
:16S:SETDET`,
};

// ─── AP机构对账数据 ───────────────────────────────────────────────────────────
const AP_RECONCILIATION = [
  { ap: 'Goldman Sachs', totalOrders: 12, settled: 10, pending: 1, failed: 1, totalValue: 1842000000, reconciled: true },
  { ap: 'Citadel Securities', totalOrders: 8, settled: 7, pending: 1, failed: 0, totalValue: 892000000, reconciled: true },
  { ap: 'Jane Street', totalOrders: 15, settled: 12, pending: 3, failed: 0, totalValue: 2156000000, reconciled: false },
  { ap: 'Virtu Financial', totalOrders: 6, settled: 4, pending: 0, failed: 2, totalValue: 312000000, reconciled: false },
  { ap: 'Flow Traders', totalOrders: 9, settled: 9, pending: 0, failed: 0, totalValue: 456000000, reconciled: true },
  { ap: 'Susquehanna', totalOrders: 11, settled: 9, pending: 2, failed: 0, totalValue: 678000000, reconciled: false },
];

// ─── 状态配置 ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  SETTLED: { label: '已交割', color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: <CheckCircle className="w-3 h-3" /> },
  IN_SETTLEMENT: { label: '交割中', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: <Clock className="w-3 h-3" /> },
  PENDING_SETTLEMENT: { label: '待交割', color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: <AlertCircle className="w-3 h-3" /> },
  FAILED: { label: '交割失败', color: 'text-red-400', bg: 'bg-red-400/10', icon: <XCircle className="w-3 h-3" /> },
};

// ─── 每日统计图表 ─────────────────────────────────────────────────────────────
const DAILY_STATS = [
  { date: '06/26', creations: 18, redemptions: 12, failed: 1 },
  { date: '06/27', creations: 22, redemptions: 15, failed: 0 },
  { date: '06/28', creations: 15, redemptions: 8, failed: 2 },
  { date: '06/29', creations: 28, redemptions: 18, failed: 1 },
  { date: '06/30', creations: 20, redemptions: 14, failed: 0 },
  { date: '07/01', creations: 25, redemptions: 16, failed: 1 },
  { date: '07/02', creations: 6, redemptions: 3, failed: 1 },
];

export default function CKPMPanel() {
  const [view, setView] = useState<'orders' | 'pcf' | 'swift' | 'reconcile' | 'stats'>('orders');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(ORDERS[0]);
  const [expandedPcf, setExpandedPcf] = useState<string | null>('SPY');

  const filtered = ORDERS.filter(o => filterStatus === 'ALL' || o.status === filterStatus);
  const totalSettled = ORDERS.filter(o => o.status === 'SETTLED').reduce((s, o) => s + o.totalValue, 0);
  const failedCount = ORDERS.filter(o => o.status === 'FAILED').length;

  const handleConfirm = (id: string) => {
    toast.success(`交割确认已发送`, { description: `${id} 已确认，SWIFT MT548 报文已生成` });
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">CKPM</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">ETF 创建/赎回 — 生产环境交割管理</span>
          <span className="px-2 py-0.5 bg-green-400/20 text-green-400 rounded text-[10px] font-bold">PRODUCTION</span>
          {failedCount > 0 && <span className="px-2 py-0.5 bg-red-400/20 text-red-400 rounded text-[10px] font-bold">⚠ {failedCount} 失败</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => toast.info('刷新中...')} className="h-6 text-[10px] bg-[#1a1a2e] hover:bg-[#222] px-2 border border-[#333]">
            <RefreshCw className="w-3 h-3 mr-1" />刷新
          </Button>
          <div className="relative group">
            <Button type="button" onClick={(event) => exportPanelCsv(event.currentTarget)} size="sm" className="h-6 text-[10px] bg-[#1a1a2e] hover:bg-[#222] px-2 border border-[#333]">
              <Download className="w-3 h-3 mr-1" />导出 <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
            </Button>
            <div className="absolute right-0 top-full mt-1 bg-[#111118] border border-[#333] rounded shadow-xl z-50 hidden group-hover:block min-w-[160px]">
              <button onClick={() => {
                const rows = ORDERS.map(o => ({ '委托编号': o.id, 'ETF': o.etf, 'AP机构': o.ap, '类型': o.type === 'CREATION' ? '申购' : '赎回', '份额': o.units, 'NAV': o.nav, '总金额(USD)': o.totalValue, '状态': STATUS_CONFIG[o.status]?.label || o.status, 'T+0时间': o.t0, 'T+1时间': o.t1 ?? '', '托管行': o.custodian, 'SWIFT参考': o.swiftRef ?? '', 'PCF版本': o.pcfVersion }));
                exportDataToCSV(rows, `CKPM_委托流水_${new Date().toISOString().slice(0,10)}`);
                toast.success('CSV 已下载');
              }} className="w-full text-left px-3 py-2 text-[11px] text-[#ccc] hover:bg-[#1a1a2e] flex items-center gap-2 border-b border-[#222]">
                <Download className="w-3 h-3" />委托流水 CSV
              </button>
              <button onClick={() => {
                const ordersData = ORDERS.map(o => ({ '委托编号': o.id, 'ETF': o.etf, 'AP机构': o.ap, '类型': o.type === 'CREATION' ? '申购' : '赎回', '份额': o.units, 'NAV': o.nav, '总金额(USD)': o.totalValue, '状态': STATUS_CONFIG[o.status]?.label || o.status, 'T+0时间': o.t0, 'T+1时间': o.t1 ?? '', '托管行': o.custodian, 'SWIFT参考': o.swiftRef ?? '', 'PCF版本': o.pcfVersion }));
                const pcfRows: Record<string, unknown>[] = [];
                Object.entries(PCF_DATA).forEach(([etf, comps]) => comps.forEach(c => pcfRows.push({ 'ETF': etf, '代码': c.ticker, '名称': c.name, '股数': c.shares, '价格(USD)': c.price, '权重%': c.weight, '可交割': c.deliverable ? '是' : '否', '交割方式': c.deliverable ? '实物交割' : '现金替代' })));
                const apData = AP_RECONCILIATION.map(a => ({ 'AP机构': a.ap, '总委托': a.totalOrders, '已交割': a.settled, '待交割': a.pending, '失败': a.failed, '总金额(USD)': a.totalValue, '对账状态': a.reconciled ? '已对账' : '待对账' }));
                exportDataToExcel(
                  [{ data: ordersData, sheetName: '委托流水' }, { data: pcfRows, sheetName: 'PCF篮子组合' }, { data: apData, sheetName: 'AP对账' }] as any,
                  `CKPM_完整报告_${new Date().toISOString().slice(0,10)}`
                );
                toast.success('Excel 已下载（3个Sheet）');
              }} className="w-full text-left px-3 py-2 text-[11px] text-[#ccc] hover:bg-[#1a1a2e] flex items-center gap-2 border-b border-[#222]">
                <FileText className="w-3 h-3" />完整报告 Excel
              </button>
              <button onClick={() => {
                const pcfRows: Record<string, unknown>[] = [];
                Object.entries(PCF_DATA).forEach(([etf, comps]) => comps.forEach(c => pcfRows.push({ 'ETF': etf, '代码': c.ticker, '名称': c.name, '股数': c.shares, '价格(USD)': c.price, '权重%': c.weight, '可交割': c.deliverable ? '是' : '否' })));
                exportDataToCSV(pcfRows, `PCF_篮子组合_${new Date().toISOString().slice(0,10)}`);
                toast.success('PCF CSV 已下载');
              }} className="w-full text-left px-3 py-2 text-[11px] text-[#ccc] hover:bg-[#1a1a2e] flex items-center gap-2">
                <FileText className="w-3 h-3" />PCF篮子组合 CSV
              </button>
            </div>
          </div>
          <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
        </div>
      </div>

      {/* KPI 条 */}
      <div className="grid grid-cols-6 gap-0 border-b border-[#222]">
        {[
          { label: '今日委托', value: String(ORDERS.length), color: '#d4af37' },
          { label: '已交割', value: String(ORDERS.filter(o => o.status === 'SETTLED').length), color: '#4ade80' },
          { label: '交割中', value: String(ORDERS.filter(o => o.status === 'IN_SETTLEMENT').length), color: '#60a5fa' },
          { label: '待交割', value: String(ORDERS.filter(o => o.status === 'PENDING_SETTLEMENT').length), color: '#facc15' },
          { label: '交割失败', value: String(failedCount), color: '#f87171' },
          { label: '已交割金额', value: `$${(totalSettled / 1e9).toFixed(2)}B`, color: '#4ade80' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* 视图切换 */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#222] bg-[#0d0d14]">
        {[
          { id: 'orders', label: '委托明细' },
          { id: 'pcf', label: 'PCF篮子组合' },
          { id: 'swift', label: 'SWIFT报文' },
          { id: 'reconcile', label: 'AP对账' },
          { id: 'stats', label: '统计分析' },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id as any)}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${view === v.id ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888] hover:text-[#ccc]'}`}>
            {v.label}
          </button>
        ))}
        {view === 'orders' && (
          <div className="ml-auto flex gap-1">
            {['ALL', 'SETTLED', 'IN_SETTLEMENT', 'PENDING_SETTLEMENT', 'FAILED'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${filterStatus === s ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888]'}`}>
                {s === 'ALL' ? '全部' : STATUS_CONFIG[s]?.label || s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── 委托明细视图 ─────────────────────────────────────────────────────── */}
      {view === 'orders' && (
        <div className="flex-1 flex gap-3 overflow-hidden p-3">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[#0d0d14] border-b border-[#222]">
                <tr>
                  {['委托号', 'ETF', 'AP机构', '类型', '单位数', '总金额', '状态', 'T+0确认', 'T+1交割', '托管行', 'SWIFT', '确认', '操作'].map(h => (
                    <th key={h} className="px-2 py-2 text-left text-[#666] font-normal whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const sc = STATUS_CONFIG[o.status];
                  return (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)}
                      className={`border-b border-[#111] cursor-pointer ${selectedOrder.id === o.id ? 'bg-[#1a1a2e]' : 'hover:bg-[#111118]'}`}>
                      <td className="px-2 py-2 text-[#d4af37] font-bold text-[10px]">{o.id}</td>
                      <td className="px-2 py-2 text-[#d4af37] font-bold">{o.etf}</td>
                      <td className="px-2 py-2 text-[#ccc]">{o.ap}</td>
                      <td className="px-2 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${o.type === 'CREATION' ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'}`}>
                          {o.type === 'CREATION' ? '申购' : '赎回'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-[#ccc]">{o.units.toLocaleString()}</td>
                      <td className="px-2 py-2 text-[#ccc]">${(o.totalValue / 1e6).toFixed(1)}M</td>
                      <td className="px-2 py-2">
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${sc.color} ${sc.bg}`}>
                          {sc.icon}{sc.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-[#888]">{o.t0}</td>
                      <td className="px-2 py-2 text-[#888]">{o.t1 || '—'}</td>
                      <td className="px-2 py-2 text-[#888]">{o.custodian}</td>
                      <td className="px-2 py-2">
                        {o.swiftRef ? (
                          <button onClick={e => { e.stopPropagation(); setSelectedOrder(o); setView('swift'); }}
                            className="text-blue-400 hover:underline text-[10px]">{o.swiftRef.substring(0, 12)}</button>
                        ) : <span className="text-[#555]">—</span>}
                      </td>
                      <td className="px-2 py-2">
                        {o.confirmed ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />}
                      </td>
                      <td className="px-2 py-2">
                        {!o.confirmed && o.status !== 'FAILED' && (
                          <button onClick={e => { e.stopPropagation(); handleConfirm(o.id); }}
                            className="px-2 py-0.5 bg-[#d4af37] text-black rounded text-[10px] font-bold hover:bg-[#e5c158]">确认</button>
                        )}
                        {o.status === 'FAILED' && (
                          <button onClick={e => { e.stopPropagation(); toast.info(`重新提交 ${o.id}`); }}
                            className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] hover:bg-red-700">重提</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* 右侧：选中委托详情 */}
          <div className="w-56 flex-shrink-0 space-y-2">
            <div className="bg-[#111118] border border-[#222] rounded-lg p-3">
              <div className="text-[#d4af37] font-bold mb-1">{selectedOrder.id}</div>
              <div className="space-y-1.5">
                {[
                  ['ETF', selectedOrder.etf],
                  ['AP机构', selectedOrder.ap],
                  ['类型', selectedOrder.type === 'CREATION' ? '申购' : '赎回'],
                  ['单位数', selectedOrder.units.toLocaleString()],
                  ['NAV', `$${selectedOrder.nav.toFixed(2)}`],
                  ['总金额', `$${(selectedOrder.totalValue / 1e6).toFixed(1)}M`],
                  ['托管行', selectedOrder.custodian],
                  ['PCF版本', selectedOrder.pcfVersion],
                  ['T+0', selectedOrder.t0],
                  ['T+1', selectedOrder.t1 || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[10px]">
                    <span className="text-[#666]">{k}</span>
                    <span className="text-[#ccc] font-mono">{v}</span>
                  </div>
                ))}
              </div>
              {selectedOrder.failReason && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-700/30 rounded text-[10px] text-red-400">
                  <div className="font-bold mb-0.5">失败原因</div>
                  <div>{selectedOrder.failReason}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── PCF篮子组合视图 ─────────────────────────────────────────────────────── */}
      {view === 'pcf' && (
        <div className="flex-1 overflow-auto p-3 space-y-3">
          <div className="text-[11px] text-[#888] mb-2">PCF (Portfolio Composition File) — 每日公布的ETF申购/赎回篮子组合成分</div>
          {Object.entries(PCF_DATA).map(([etf, components]) => {
            const nonDeliverable = components.filter(c => !c.deliverable);
            return (
              <div key={etf} className="bg-[#111118] border border-[#222] rounded-lg overflow-hidden">
                <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1a1a2e]"
                  onClick={() => setExpandedPcf(expandedPcf === etf ? null : etf)}>
                  <div className="flex items-center gap-3">
                    {expandedPcf === etf ? <ChevronDown className="w-4 h-4 text-[#d4af37]" /> : <ChevronRight className="w-4 h-4 text-[#888]" />}
                    <span className="text-[#d4af37] font-bold">{etf}</span>
                    <span className="text-[#888]">PCF-20240702-v3</span>
                    <span className="text-[11px] text-[#ccc]">{components.length} 只成分股</span>
                    {nonDeliverable.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-red-400/20 text-red-400 rounded text-[10px]">⚠ {nonDeliverable.length} 只不可交割</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#666]">总权重: {components.reduce((s, c) => s + c.weight, 0).toFixed(1)}%</span>
                </button>
                {expandedPcf === etf && (
                  <div className="border-t border-[#222]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[#0d0d14]">
                        <tr>
                          {['代码', '名称', '股数', '价格', '权重', '可交割', '状态'].map(h => (
                            <th key={h} className="px-3 py-1.5 text-left text-[#666] font-normal">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {components.map((c, i) => (
                          <tr key={i} className={`border-b border-[#111] ${!c.deliverable ? 'bg-red-900/10' : 'hover:bg-[#1a1a2e]'}`}>
                            <td className="px-3 py-1.5 text-[#d4af37] font-bold">{c.ticker}</td>
                            <td className="px-3 py-1.5 text-[#ccc]">{c.name}</td>
                            <td className="px-3 py-1.5 text-[#ccc] font-mono">{c.shares.toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-[#ccc] font-mono">${c.price.toFixed(2)}</td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-16 h-1 bg-[#1a1a2e] rounded-full overflow-hidden">
                                  <div className="h-full bg-[#d4af37] rounded-full" style={{ width: `${Math.min(c.weight, 15) / 15 * 100}%` }} />
                                </div>
                                <span className="text-[#ccc] font-mono">{c.weight.toFixed(2)}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5">
                              {c.deliverable
                                ? <span className="text-green-400">✓ 可交割</span>
                                : <span className="text-red-400">✗ 现金替代</span>}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${c.deliverable ? 'bg-green-400/20 text-green-400' : 'bg-orange-400/20 text-orange-400'}`}>
                                {c.deliverable ? '实物交割' : '现金等价'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── SWIFT报文视图 ─────────────────────────────────────────────────────── */}
      {view === 'swift' && (
        <div className="flex-1 p-3 overflow-auto flex gap-3">
          <div className="w-56 flex-shrink-0 space-y-1">
            <div className="text-[11px] text-[#888] mb-2">SWIFT MT548 报文列表</div>
            {ORDERS.filter(o => o.swiftRef).map(o => (
              <button key={o.id} onClick={() => setSelectedOrder(o)}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${selectedOrder.id === o.id ? 'border-[#d4af37]/40 bg-[#1a1a2e]' : 'border-[#222] hover:border-[#333]'}`}>
                <div className="text-[#d4af37] font-bold text-[10px]">{o.swiftRef}</div>
                <div className="text-[#888] text-[10px]">{o.etf} · {o.type === 'CREATION' ? '申购' : '赎回'}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[9px] ${STATUS_CONFIG[o.status].color}`}>{STATUS_CONFIG[o.status].label}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="flex-1 bg-[#0d0d14] border border-[#222] rounded-lg p-3 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#d4af37] font-bold">{selectedOrder.swiftRef || '—'}</div>
              <div className="flex gap-2">
                <span className="text-[10px] text-[#888]">报文类型：MT548 (结算状态)</span>
                <Button size="sm" onClick={() => toast.info('已复制报文')} className="h-5 text-[9px] bg-[#1a1a2e] hover:bg-[#222] px-2 border border-[#333]">复制</Button>
              </div>
            </div>
            {selectedOrder.swiftRef && SWIFT_MESSAGES[selectedOrder.swiftRef] ? (
              <pre className="text-[11px] text-[#4ade80] font-mono whitespace-pre-wrap leading-5">
                {SWIFT_MESSAGES[selectedOrder.swiftRef]}
              </pre>
            ) : (
              <div className="text-[#555] text-center mt-8">
                {selectedOrder.swiftRef ? '报文加载中...' : '该委托暂无SWIFT报文（未确认）'}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-[#222]">
              <div className="text-[11px] text-[#888] mb-2">SWIFT MT报文类型说明</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {[
                  ['MT540', '买入交割指令 (Receive Free)'],
                  ['MT541', '买入交割指令 (Receive Against Payment)'],
                  ['MT542', '卖出交割指令 (Deliver Free)'],
                  ['MT543', '卖出交割指令 (Deliver Against Payment)'],
                  ['MT544', '接收确认'],
                  ['MT545', '付款接收确认'],
                  ['MT546', '交割确认'],
                  ['MT547', '付款交割确认'],
                  ['MT548', '结算状态及处理建议'],
                  ['MT549', '请求结算状态'],
                ].map(([type, desc]) => (
                  <div key={type} className="flex gap-2">
                    <span className="text-[#d4af37] font-bold w-12">{type}</span>
                    <span className="text-[#666]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── AP对账视图 ─────────────────────────────────────────────────────────── */}
      {view === 'reconcile' && (
        <div className="flex-1 overflow-auto p-3">
          <div className="text-[11px] text-[#888] mb-3">AP机构 (Authorized Participant) 日终对账 — {new Date().toLocaleDateString('zh-CN')}</div>
          <table className="w-full text-[11px]">
            <thead className="bg-[#0d0d14] border-b border-[#222]">
              <tr>
                {['AP机构', '总委托', '已交割', '待处理', '失败', '总金额', '对账状态', '操作'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AP_RECONCILIATION.map((ap, i) => (
                <tr key={i} className="border-b border-[#111] hover:bg-[#111118]">
                  <td className="px-3 py-2.5 text-[#ccc] font-bold">{ap.ap}</td>
                  <td className="px-3 py-2.5 text-[#ccc]">{ap.totalOrders}</td>
                  <td className="px-3 py-2.5 text-green-400">{ap.settled}</td>
                  <td className="px-3 py-2.5 text-yellow-400">{ap.pending}</td>
                  <td className="px-3 py-2.5 text-red-400">{ap.failed}</td>
                  <td className="px-3 py-2.5 text-[#ccc] font-mono">${(ap.totalValue / 1e9).toFixed(2)}B</td>
                  <td className="px-3 py-2.5">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold w-fit ${ap.reconciled ? 'bg-green-400/20 text-green-400' : 'bg-yellow-400/20 text-yellow-400'}`}>
                      {ap.reconciled ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {ap.reconciled ? '已对账' : '待对账'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => toast.success(`已发送对账确认：${ap.ap}`)}
                        className="px-2 py-0.5 bg-[#d4af37] text-black rounded text-[10px] font-bold hover:bg-[#e5c158]">确认</button>
                      <button onClick={() => toast.info(`查看 ${ap.ap} 明细`)}
                        className="px-2 py-0.5 bg-[#1a1a2e] text-[#888] rounded text-[10px] border border-[#333] hover:text-[#ccc]">明细</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 p-3 bg-[#111118] border border-[#222] rounded-lg">
            <div className="text-[#d4af37] font-bold mb-2">对账差异处理流程</div>
            <div className="grid grid-cols-4 gap-3 text-[10px]">
              {[
                { step: '1', title: '差异识别', desc: '系统自动比对AP报告与内部记录，标记不一致项' },
                { step: '2', title: '原因分析', desc: '区分时间差异、数量差异、价格差异、状态差异' },
                { step: '3', title: '联系确认', desc: '通过SWIFT MT548/MT549与AP机构确认差异项' },
                { step: '4', title: '调整入账', desc: '差异确认后，更新内部系统并生成调整凭证' },
              ].map(s => (
                <div key={s.step} className="bg-[#0d0d14] border border-[#1a1a2e] rounded p-2">
                  <div className="text-[#d4af37] font-bold mb-1">步骤 {s.step}：{s.title}</div>
                  <div className="text-[#666]">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 统计分析视图 ─────────────────────────────────────────────────────── */}
      {view === 'stats' && (
        <div className="flex-1 p-3 overflow-auto space-y-3">
          <div className="bg-[#111118] border border-[#222] rounded-lg p-3">
            <div className="text-[11px] text-[#888] mb-3">近7日创建/赎回委托统计</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={DAILY_STATS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#0d0d14', border: '1px solid #222', fontSize: 10 }} />
                <Bar dataKey="creations" name="申购" fill="#4ade80" radius={[3, 3, 0, 0]} />
                <Bar dataKey="redemptions" name="赎回" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                <Bar dataKey="failed" name="失败" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { title: '申购成功率', value: '94.2%', sub: '近30日平均', color: '#4ade80' },
              { title: '赎回成功率', value: '96.8%', sub: '近30日平均', color: '#60a5fa' },
              { title: '平均T+1交割时间', value: '09:42', sub: '从T+0确认到T+1完成', color: '#d4af37' },
              { title: '最大单笔金额', value: '$1.28B', sub: '本月最大单笔', color: '#a78bfa' },
              { title: '日均委托笔数', value: '18.5', sub: '近30日平均', color: '#f59e0b' },
              { title: '失败率', value: '2.1%', sub: '近30日平均', color: '#f87171' },
            ].map((s, i) => (
              <div key={i} className="bg-[#111118] border border-[#222] rounded-lg p-3">
                <div className="text-[#666] text-[10px]">{s.title}</div>
                <div className="font-bold text-xl font-mono mt-1" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[#555] text-[10px] mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

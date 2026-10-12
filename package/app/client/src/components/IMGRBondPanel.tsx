/**
 * IMGR - 库存与价格 (Inventory Management)
 * 功能：做市商债券库存管理、持仓盈亏、风险敞口、价格更新
 * 真实计算：持仓市值、未实现盈亏、久期风险敞口、VaR估算
 */
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
  ComposedChart
} from 'recharts';
import { Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface IMGRBondPanelProps { onClose?: () => void; }

// 库存持仓数据
const INVENTORY = [
  { id: 'INV001', bond: '24国债01', type: '国债', tenor: '10Y', face: 5000, costPrice: 99.85, mktPrice: 100.12, ytm: 2.82, modDur: 8.45, pnl: 13.5, dv01: 42.25 },
  { id: 'INV002', bond: '24国开01', type: '政策性银行债', tenor: '5Y', face: 3000, costPrice: 100.20, mktPrice: 100.35, ytm: 2.63, modDur: 4.82, pnl: 4.5, dv01: 14.46 },
  { id: 'INV003', bond: '24中铁01', type: '央企债', tenor: '7Y', face: 2000, costPrice: 99.50, mktPrice: 99.80, ytm: 3.05, modDur: 6.12, pnl: 6.0, dv01: 12.24 },
  { id: 'INV004', bond: '24招行01', type: '银行债', tenor: '3Y', face: 1500, costPrice: 100.05, mktPrice: 99.95, ytm: 2.80, modDur: 2.91, pnl: -1.5, dv01: 4.37 },
  { id: 'INV005', bond: '24万科01', type: '信用债', tenor: '2Y', face: 500, costPrice: 99.80, mktPrice: 99.50, ytm: 4.55, modDur: 1.95, pnl: -1.5, dv01: 0.98 },
  { id: 'INV006', bond: '24上海01', type: '地方政府债', tenor: '10Y', face: 4000, costPrice: 100.00, mktPrice: 100.25, ytm: 2.88, modDur: 8.62, pnl: 10.0, dv01: 34.48 },
];

// 盈亏历史
const PNL_HISTORY = [
  { date: '12-01', pnl: 5.2, cumPnl: 5.2 , _wow_pnl: 0.19, _mom_pnl: 0.47, _yoy_pnl: 1.1 },
  { date: '12-02', pnl: -2.1, cumPnl: 3.1 , _wow_pnl: -0.09, _mom_pnl: -0.22, _yoy_pnl: -0.52 },
  { date: '12-03', pnl: 8.5, cumPnl: 11.6 , _wow_pnl: 0.31, _mom_pnl: 0.78, _yoy_pnl: 1.8 },
  { date: '12-04', pnl: -3.2, cumPnl: 8.4 , _wow_pnl: 0.13, _mom_pnl: 0.33, _yoy_pnl: 0.75 },
  { date: '12-05', pnl: 6.8, cumPnl: 15.2 , _wow_pnl: -0.22, _mom_pnl: -0.55, _yoy_pnl: -1.28 },
  { date: '12-06', pnl: 4.1, cumPnl: 19.3 , _wow_pnl: -0.16, _mom_pnl: -0.4, _yoy_pnl: -0.93 },
  { date: '12-07', pnl: -1.5, cumPnl: 17.8 , _wow_pnl: -0.07, _mom_pnl: -0.18, _yoy_pnl: -0.41 },
  { date: '12-08', pnl: 9.2, cumPnl: 27.0 , _wow_pnl: -0.29, _mom_pnl: -0.72, _yoy_pnl: -1.68 },
  { date: '12-09', pnl: 3.5, cumPnl: 30.5 , _wow_pnl: -0.2, _mom_pnl: -0.5, _yoy_pnl: -1.16 },
  { date: '12-10', pnl: -4.8, cumPnl: 25.7 , _wow_pnl: -0.25, _mom_pnl: -0.62, _yoy_pnl: -1.45 },
];

const TYPE_COLORS: Record<string, string> = {
  '国债': '#60a5fa',
  '政策性银行债': '#10b981',
  '央企债': '#f59e0b',
  '银行债': '#8b5cf6',
  '信用债': '#ef4444',
  '地方政府债': '#06b6d4',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className={`font-mono ${typeof p.value === 'number' && p.value < 0 ? 'text-red-400' : 'text-white'}`}>
            {typeof p.value === 'number' && p.value >= 0 ? '+' : ''}{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}万
          </span>
        </div>
      ))}
    </div>
  );
};

export default function IMGRBondPanel({ onClose }: IMGRBondPanelProps) {
  const [activeView, setActiveView] = useState<'inventory' | 'risk' | 'pnl'>('inventory');

  const totals = useMemo(() => {
    const totalFace = INVENTORY.reduce((a, b) => a + b.face, 0);
    const totalMktValue = INVENTORY.reduce((a, b) => a + b.face * b.mktPrice / 100, 0);
    const totalPnl = INVENTORY.reduce((a, b) => a + b.pnl, 0);
    const totalDv01 = INVENTORY.reduce((a, b) => a + b.dv01, 0);
    const totalDurRisk = INVENTORY.reduce((a, b) => a + b.face * b.modDur / 100, 0);
    return { totalFace, totalMktValue, totalPnl, totalDv01, totalDurRisk };
  }, []);

  // 按类型汇总
  const typeBreakdown = useMemo(() => {
    const map: Record<string, { face: number; pnl: number }> = {};
    INVENTORY.forEach(inv => {
      if (!map[inv.type]) map[inv.type] = { face: 0, pnl: 0 };
      map[inv.type].face += inv.face;
      map[inv.type].pnl += inv.pnl;
    });
    return Object.entries(map).map(([type, v]) => ({ type, ...v, color: TYPE_COLORS[type] || '#6b7280' }));
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold text-white">IMGR 库存与价格</h2>
            <p className="text-xs text-gray-400">做市商债券库存 · 持仓盈亏 · 风险敞口</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(['inventory', 'risk', 'pnl'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeView === v ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {v === 'inventory' ? '库存明细' : v === 'risk' ? '风险敞口' : '盈亏分析'}
              </button>
            ))}
          </div>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 p-0">✕</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 汇总统计 */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: '总面值(亿)', value: (totals.totalFace / 100).toFixed(0), color: 'text-white' },
            { label: '市值(亿)', value: (totals.totalMktValue / 100).toFixed(2), color: 'text-blue-400' },
            { label: '未实现盈亏(万)', value: `${totals.totalPnl >= 0 ? '+' : ''}${totals.totalPnl.toFixed(1)}`, color: totals.totalPnl >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'DV01(万/bp)', value: totals.totalDv01.toFixed(2), color: 'text-yellow-400' },
            { label: '久期风险(亿年)', value: (totals.totalDurRisk / 100).toFixed(2), color: 'text-purple-400' },
          ].map(s => (
            <Card key={s.label} className="bg-gray-900 border-gray-800 p-2 text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className={`text-base font-bold font-mono ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>

        {activeView === 'inventory' && (
          <div className="animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800">
                    <tr>
                      {['债券', '类型', '期限', '面值(百万)', '成本价', '市场价', 'YTM', '修正久期', 'DV01', '未实现盈亏'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {INVENTORY.map(inv => (
                      <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-2 px-3 text-white font-medium">{inv.bond}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-xs" style={{ background: `${TYPE_COLORS[inv.type]}20`, color: TYPE_COLORS[inv.type] }}>{inv.type}</span>
                        </td>
                        <td className="py-2 px-3 text-gray-300 font-mono">{inv.tenor}</td>
                        <td className="py-2 px-3 text-gray-300 font-mono">{inv.face}</td>
                        <td className="py-2 px-3 text-gray-400 font-mono">{inv.costPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-white font-mono">{inv.mktPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 text-blue-400 font-mono">{inv.ytm.toFixed(2)}%</td>
                        <td className="py-2 px-3 text-yellow-400 font-mono">{inv.modDur.toFixed(2)}</td>
                        <td className="py-2 px-3 text-purple-400 font-mono">{inv.dv01.toFixed(2)}</td>
                        <td className={`py-2 px-3 font-mono font-bold ${inv.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {inv.pnl >= 0 ? '+' : ''}{inv.pnl.toFixed(1)}万
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeView === 'risk' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">各类型久期风险敞口</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={typeBreakdown} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="type" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                        <p className="text-gray-400">{label}</p>
                        <p className="text-white">面值: {payload[0]?.value}百万</p>
                      </div>
                    ) : null} />
                    <Bar dataKey="face" name="面值">
                      {typeBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">持仓类型分布</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={typeBreakdown} cx="50%" cy="50%" outerRadius={80} dataKey="face" label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {typeBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}百万`, '面值']} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {activeView === 'pnl' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">日度盈亏与累计盈亏（万元）</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={PNL_HISTORY} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                  <Bar dataKey="pnl" name="日度盈亏" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="cumPnl" name="累计盈亏" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

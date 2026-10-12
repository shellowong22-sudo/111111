import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Brush, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';

const IBMTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-2 text-xs">
      <div className="text-[#d4a853] font-bold mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span></div>
      ))}
    </div>
  );
};

interface Props { onClose?: () => void; }

const priceHistory = [
  { date: '2024-01', price: 101.25, ytm: 4.85, spread: 82 , _wow_price: 2.02, _mom_price: 5.05, _yoy_price: 11.72 },
  { date: '2024-02', price: 100.85, ytm: 4.92, spread: 88 , _wow_price: 5.24, _mom_price: 13.1, _yoy_price: 30.39 },
  { date: '2024-03', price: 101.45, ytm: 4.78, spread: 79 , _wow_price: -3.25, _mom_price: -8.12, _yoy_price: -18.85 },
  { date: '2024-04', price: 100.35, ytm: 5.02, spread: 95 , _wow_price: 4.42, _mom_price: 11.05, _yoy_price: 25.64 },
  { date: '2024-05', price: 101.85, ytm: 4.72, spread: 75 , _wow_price: 3.67, _mom_price: 9.18, _yoy_price: 21.29 },
  { date: '2024-06', price: 101.65, ytm: 4.78, spread: 80 , _wow_price: -3.25, _mom_price: -8.12, _yoy_price: -18.85 },
];

const cashflows = [
  { period: '2024-10', coupon: 3.5, principal: 0, total: 3.5, pv: 3.42 },
  { period: '2025-04', coupon: 3.5, principal: 0, total: 3.5, pv: 3.34 },
  { period: '2025-10', coupon: 3.5, principal: 0, total: 3.5, pv: 3.26 },
  { period: '2026-04', coupon: 3.5, principal: 0, total: 3.5, pv: 3.18 },
  { period: '2026-10', coupon: 3.5, principal: 0, total: 3.5, pv: 3.10 },
  { period: '2027-04', coupon: 3.5, principal: 0, total: 3.5, pv: 3.02 },
  { period: '2027-10', coupon: 3.5, principal: 0, total: 3.5, pv: 2.94 },
  { period: '2028-04', coupon: 3.5, principal: 0, total: 3.5, pv: 2.86 },
  { period: '2028-10', coupon: 3.5, principal: 0, total: 3.5, pv: 2.78 },
  { period: '2029-04', coupon: 3.5, principal: 0, total: 3.5, pv: 2.70 },
  { period: '2030-10', coupon: 3.5, principal: 100, total: 103.5, pv: 72.40 },
];

const riskMetrics = [
  { scenario: '利率+100bp', priceChange: -8.52, pnl: -8520 },
  { scenario: '利率+50bp', priceChange: -4.35, pnl: -4350 },
  { scenario: '利率-50bp', priceChange: 4.58, pnl: 4580 },
  { scenario: '利率-100bp', priceChange: 9.38, pnl: 9380 },
  { scenario: '利差+50bp', priceChange: -4.12, pnl: -4120 },
  { scenario: '利差-50bp', priceChange: 4.25, pnl: 4250 },
];

export default function IBMAnalysisPanel({ onClose }: Props) {
  const [tab, setTab] = useState<'overview' | 'cashflow' | 'risk' | 'history'>('overview');

  return (
    <div className="h-full flex flex-col bg-[#0a0e1a] text-[#e0e6f0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1526] border-b border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <span className="text-[#d4a853] font-bold text-sm">13</span>
          <span className="text-[#4a9eff] font-bold">分析 IBM 7 10/30/25 Corp</span>
          <span className="text-[#6b7fa3]">Bond Analysis — IBM 7% 10/30/2025</span>
        </div>
        {onClose && <button onClick={onClose} className="text-[#6b7fa3] hover:text-white px-2">✕</button>}
      </div>
      <div className="flex border-b border-[#1e3a5f] bg-[#0d1526]">
        {[{ id: 'overview', label: '债券概览' }, { id: 'cashflow', label: '现金流' }, { id: 'risk', label: '情景分析' }, { id: 'history', label: '历史走势' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-xs border-r border-[#1e3a5f] ${tab === t.id ? 'bg-[#1a2a4a] text-[#d4a853] border-b-2 border-b-[#d4a853]' : 'text-[#6b7fa3] hover:text-[#a0b4cc]'}`}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#4a9eff] rounded p-3">
              <div className="text-[#d4a853] font-bold text-sm mb-3">IBM 7% 10/30/2025 Corp — 基本信息</div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['发行人', 'IBM Corp'], ['ISIN', 'US459200HU68'], ['票息率', '7.000%'], ['到期日', '2025-10-30'],
                  ['当前价格', '101.65'], ['YTM', '4.78%'], ['当前收益', '6.89%'], ['信用评级', 'A-/A3'],
                  ['修正久期', '1.28年'], ['凸性', '0.018'], ['DV01', '$128/百万'], ['OAS', '80bp'],
                  ['Z-Spread', '82bp'], ['I-Spread', '78bp'], ['ASW', '75bp'], ['存量规模', '$1.5B'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#060d1a] rounded p-2">
                    <div className="text-[#6b7fa3] text-xs">{k}</div>
                    <div className="text-[#e0e6f0] font-bold mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '利差分解', items: [['无风险利率', '3.98%'], ['流动性溢价', '25bp'], ['违约风险溢价', '45bp'], ['税收溢价', '12bp']] },
                { label: '发行人信息', items: [['行业', '信息技术'], ['市值', '$1,350亿'], ['债务/EBITDA', '1.8x'], ['利息覆盖率', '12.5x']] },
                { label: '市场指标', items: [['买卖价差', '2bp'], ['日成交量', '$45M'], ['流动性评分', '8.5/10'], ['相对价值', '略贵5bp']] },
              ].map(section => (
                <div key={section.label} className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
                  <div className="text-[#d4a853] font-bold mb-2">{section.label}</div>
                  {section.items.map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-[#0a1020]">
                      <span className="text-[#6b7fa3]">{k}</span>
                      <span className="text-[#e0e6f0] font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'cashflow' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">现金流折现分析（面值100，YTM=4.78%）</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cashflows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="period" tick={{ fill: '#6b7fa3', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#6b7fa3', fontSize: 10 }} />
                  <Tooltip content={<IBMTooltip />} />
                  <Bar dataKey="pv" name="现值" fill="#4a9eff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[#1e3a5f] bg-[#060d1a]">
                  {['期间', '票息', '本金', '现金流合计', '现值'].map(h => (
                    <th key={h} className="text-left text-[#6b7fa3] px-3 py-2 font-normal">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {cashflows.map((cf, i) => (
                    <tr key={i} className={`border-b border-[#0a1020] hover:bg-[#0f1a2e] ${cf.principal > 0 ? 'bg-[#0f1a2e]' : ''}`}>
                      <td className="px-3 py-1.5 text-[#4a9eff]">{cf.period}</td>
                      <td className="px-3 py-1.5 text-[#d4a853]">{cf.coupon}</td>
                      <td className="px-3 py-1.5 text-[#f0c040]">{cf.principal > 0 ? cf.principal : '-'}</td>
                      <td className="px-3 py-1.5 text-[#e0e6f0] font-bold">{cf.total}</td>
                      <td className="px-3 py-1.5 text-[#00d4aa]">{cf.pv}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#1a2a4a] font-bold">
                    <td className="px-3 py-2 text-[#d4a853]">合计</td>
                    <td className="px-3 py-2 text-[#d4a853]">{cashflows.reduce((s, c) => s + c.coupon, 0).toFixed(1)}</td>
                    <td className="px-3 py-2 text-[#f0c040]">100.0</td>
                    <td className="px-3 py-2 text-[#e0e6f0]">{cashflows.reduce((s, c) => s + c.total, 0).toFixed(1)}</td>
                    <td className="px-3 py-2 text-[#00d4aa]">{cashflows.reduce((s, c) => s + c.pv, 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'risk' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">利率/利差情景分析（持仓面值 $1,000,000）</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={riskMetrics} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis type="number" tick={{ fill: '#6b7fa3', fontSize: 10 }} unit="$" />
                  <YAxis dataKey="scenario" type="category" tick={{ fill: '#a0b4cc', fontSize: 10 }} width={100} />
                  <Tooltip content={<IBMTooltip />} />
                  <Bar dataKey="pnl" name="盈亏($)" fill="#4a9eff"
                    label={{ position: 'right', fill: '#e0e6f0', fontSize: 10, formatter: (v: number) => v > 0 ? `+$${v.toLocaleString()}` : `-$${Math.abs(v).toLocaleString()}` }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[['VaR (95%, 1天)', '$2,850'], ['CVaR (95%, 1天)', '$4,120'], ['最大回撤', '-8.52%']].map(([k, v]) => (
                <div key={k} className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3 text-center">
                  <div className="text-[#6b7fa3]">{k}</div>
                  <div className="text-xl font-bold text-[#ff6b6b] mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'history' && (
          <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
            <div className="text-[#d4a853] font-bold mb-2">历史价格与利差走势</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="date" tick={{ fill: '#6b7fa3', fontSize: 10 }} />
                <YAxis yAxisId="price" domain={[99, 103]} tick={{ fill: '#6b7fa3', fontSize: 10 }} />
                <YAxis yAxisId="spread" orientation="right" tick={{ fill: '#6b7fa3', fontSize: 10 }} unit="bp" />
                <Tooltip content={<IBMTooltip />} />
                <Legend wrapperStyle={{ color: '#a0b4cc', fontSize: 11 }} />
                <Line yAxisId="price" type="monotone" dataKey="price" name="净价" stroke="#4a9eff" strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="spread" type="monotone" dataKey="spread" name="利差(bp)" stroke="#d4a853" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, Brush, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';

const TACTTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
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

const trades = [
  { id: 'T20240622001', bond: '24国开01', dir: '买入', price: 99.85, ytm: 2.48, vol: 2000, amount: 1997000, dealer: '中信证券', time: '10:15:32', status: '已成交', compliance: '通过', strategy: '利率套利' },
  { id: 'T20240622002', bond: '24煤炭债01', dir: '卖出', price: 99.70, ytm: 3.28, vol: 1000, amount: 997000, dealer: '华泰证券', time: '10:08:45', status: '已成交', compliance: '通过', strategy: '信用利差' },
  { id: 'T20240622003', bond: '24中信债01', dir: '买入', price: 99.78, ytm: 2.80, vol: 500, amount: 498900, dealer: '国泰君安', time: '09:52:18', status: '已成交', compliance: '通过', strategy: '流动性管理' },
  { id: 'T20240622004', bond: '24银行二级资本债', dir: '买入', price: 99.55, ytm: 3.42, vol: 3000, amount: 2986500, dealer: '招商证券', time: '09:45:03', status: '已成交', compliance: '通过', strategy: '收益增强' },
  { id: 'T20240622005', bond: '24万科MTN', dir: '卖出', price: 97.85, ytm: 5.32, vol: 200, amount: 195700, dealer: '中信证券', time: '09:30:15', status: '已成交', compliance: '审查中', strategy: '风险减仓' },
];

const volumeByHour = [
  { hour: '09:30', vol: 1850 }, { hour: '10:00', vol: 3200 }, { hour: '10:30', vol: 2800 },
  { hour: '11:00', vol: 1950 }, { hour: '11:30', vol: 1200 }, { hour: '13:30', vol: 2100 },
  { hour: '14:00', vol: 3500 }, { hour: '14:30', vol: 2900 }, { hour: '15:00', vol: 1600 },
];

const strategyDist = [
  { name: '利率套利', value: 35, color: '#4a9eff' },
  { name: '信用利差', value: 28, color: '#d4a853' },
  { name: '流动性管理', value: 20, color: '#00d4aa' },
  { name: '收益增强', value: 12, color: '#f0c040' },
  { name: '风险减仓', value: 5, color: '#ff6b6b' },
];

export default function TACTEnhancedPanel({ onClose }: Props) {
  const [tab, setTab] = useState<'trades' | 'analytics' | 'compliance'>('trades');

  return (
    <div className="h-full flex flex-col bg-[#0a0e1a] text-[#e0e6f0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1526] border-b border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <span className="text-[#d4a853] font-bold text-sm">19</span>
          <span className="text-[#4a9eff] font-bold">交易分析与合规</span>
          <span className="text-[#6b7fa3]">Trade Analytics & Compliance (TACT)</span>
        </div>
        {onClose && <button onClick={onClose} className="text-[#6b7fa3] hover:text-white px-2">✕</button>}
      </div>
      <div className="flex border-b border-[#1e3a5f] bg-[#0d1526]">
        {[{ id: 'trades', label: '交易记录' }, { id: 'analytics', label: '交易分析' }, { id: 'compliance', label: '合规检查' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-xs border-r border-[#1e3a5f] ${tab === t.id ? 'bg-[#1a2a4a] text-[#d4a853] border-b-2 border-b-[#d4a853]' : 'text-[#6b7fa3] hover:text-[#a0b4cc]'}`}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {tab === 'trades' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {[['今日成交笔数', '5笔', '#4a9eff'], ['成交总金额', '¥6,675,100', '#d4a853'], ['买入金额', '¥5,482,400', '#00d4aa'], ['卖出金额', '¥1,192,700', '#ff6b6b']].map(([k, v, c]) => (
                <div key={k} className="bg-[#0d1526] border border-[#1e3a5f] rounded p-2 text-center">
                  <div className="text-[#6b7fa3]">{k}</div>
                  <div className="font-bold mt-0.5" style={{ color: c as string }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[#1e3a5f] bg-[#060d1a]">
                  {['交易ID', '债券', '方向', '价格', 'YTM', '数量(万)', '金额', '对手方', '时间', '合规', '策略'].map(h => (
                    <th key={h} className="text-left text-[#6b7fa3] px-2 py-2 font-normal whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} className="border-b border-[#0a1020] hover:bg-[#0f1a2e]">
                      <td className="px-2 py-1.5 text-[#6b7fa3] text-xs">{t.id}</td>
                      <td className="px-2 py-1.5 text-[#4a9eff] font-bold">{t.bond}</td>
                      <td className={`px-2 py-1.5 font-bold ${t.dir === '买入' ? 'text-[#00d4aa]' : 'text-[#ff6b6b]'}`}>{t.dir}</td>
                      <td className="px-2 py-1.5 text-[#e0e6f0]">{t.price}</td>
                      <td className="px-2 py-1.5 text-[#d4a853]">{t.ytm}%</td>
                      <td className="px-2 py-1.5 text-[#f0c040]">{t.vol}</td>
                      <td className="px-2 py-1.5 text-[#a0b4cc]">¥{t.amount.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-[#a0b4cc]">{t.dealer}</td>
                      <td className="px-2 py-1.5 text-[#6b7fa3]">{t.time}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${t.compliance === '通过' ? 'bg-[#00d4aa20] text-[#00d4aa]' : 'bg-[#f0c04020] text-[#f0c040]'}`}>{t.compliance}</span>
                      </td>
                      <td className="px-2 py-1.5 text-[#a0b4cc]">{t.strategy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'analytics' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">日内成交量分布（万元）</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={volumeByHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="hour" tick={{ fill: '#6b7fa3', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7fa3', fontSize: 10 }} />
                  <Tooltip content={<TACTTooltip />} />
                  <Bar dataKey="vol" name="成交量" fill="#4a9eff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">交易策略分布（%）</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={strategyDist} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={{ stroke: '#6b7fa3' }}>
                    {strategyDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<TACTTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {tab === 'compliance' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#4a9eff] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-3">合规检查规则</div>
              {[
                { rule: '单券持仓集中度', limit: '≤20%', current: '12.5%', status: '通过' },
                { rule: '信用评级下限', limit: 'AA及以上', current: 'AA~AAA', status: '通过' },
                { rule: '单日交易量限额', limit: '≤5,000万', current: '6,675万', status: '超限' },
                { rule: '关联方交易比例', limit: '≤10%', current: '0%', status: '通过' },
                { rule: '久期偏离度', limit: '±1年', current: '+0.3年', status: '通过' },
                { rule: '流动性资产比例', limit: '≥30%', current: '42%', status: '通过' },
              ].map(r => (
                <div key={r.rule} className="flex items-center justify-between py-2 border-b border-[#0a1020]">
                  <span className="text-[#a0b4cc]">{r.rule}</span>
                  <span className="text-[#6b7fa3]">限制: {r.limit}</span>
                  <span className="text-[#e0e6f0]">当前: {r.current}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.status === '通过' ? 'bg-[#00d4aa20] text-[#00d4aa]' : 'bg-[#ff6b6b20] text-[#ff6b6b]'}`}>{r.status}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#ff6b6b10] border border-[#ff6b6b40] rounded p-3">
              <div className="text-[#ff6b6b] font-bold mb-1">⚠ 合规预警</div>
              <div className="text-[#a0b4cc]">今日交易量 ¥6,675万 超过单日限额 ¥5,000万，请联系合规部门审批后方可继续交易。</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

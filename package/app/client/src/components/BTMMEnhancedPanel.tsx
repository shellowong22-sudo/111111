import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Brush, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';

const YieldCurveTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const cur = payload.find(p => p.dataKey === 'current');
  const m1 = payload.find(p => p.dataKey === 'prev1m');
  const m3 = payload.find(p => p.dataKey === 'prev3m');
  const spread = cur && m3 ? ((cur.value as number) - (m3.value as number)).toFixed(2) : null;
  return (
    <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-3 shadow-xl text-xs min-w-[200px]">
      <div className="text-[#d4a853] font-bold mb-2 border-b border-[#1e3a5f] pb-1">期限：{label}</div>
      {cur && <div className="flex justify-between gap-4 mb-1"><span className="text-[#4a9eff]">当前</span><span className="text-[#4a9eff] font-bold">{(cur.value as number).toFixed(3)}%</span></div>}
      {m1 && <div className="flex justify-between gap-4 mb-1"><span className="text-[#f0c040]">1月前</span><span className="text-[#f0c040] font-bold">{(m1.value as number).toFixed(3)}%</span></div>}
      {m3 && <div className="flex justify-between gap-4 mb-1"><span className="text-[#6b7fa3]">3月前</span><span className="text-[#6b7fa3] font-bold">{(m3.value as number).toFixed(3)}%</span></div>}
      {spread && <div className="border-t border-[#1e3a5f] mt-2 pt-2 flex justify-between"><span className="text-[#a0b4cc]">变动(迓今3月)</span><span className={parseFloat(spread) >= 0 ? 'text-[#ff6b6b]' : 'text-[#00d4aa]'}>{parseFloat(spread) >= 0 ? '+' : ''}{spread}%</span></div>}
    </div>
  );
};

const MoneyMarketTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-3 shadow-xl text-xs min-w-[200px]">
      <div className="text-[#d4a853] font-bold mb-2 border-b border-[#1e3a5f] pb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.color as string }}>{p.name}</span>
          <span className="font-bold" style={{ color: p.color as string }}>{(p.value as number).toFixed(2)}%</span>
        </div>
      ))}
      <div className="border-t border-[#1e3a5f] mt-2 pt-2">
        <div className="text-[#6b7fa3]">OMO政策利率: 1.80% · 超额资金成本评估</div>
      </div>
    </div>
  );
};

interface Props { onClose?: () => void; }

const yieldCurveData = [
  { term: '1M', current: 1.65, prev1m: 1.72, prev3m: 1.80 },
  { term: '3M', current: 1.72, prev1m: 1.78, prev3m: 1.85 },
  { term: '6M', current: 1.85, prev1m: 1.90, prev3m: 1.95 },
  { term: '1Y', current: 1.92, prev1m: 1.98, prev3m: 2.05 },
  { term: '2Y', current: 2.05, prev1m: 2.10, prev3m: 2.18 },
  { term: '3Y', current: 2.12, prev1m: 2.18, prev3m: 2.25 },
  { term: '5Y', current: 2.25, prev1m: 2.30, prev3m: 2.38 },
  { term: '7Y', current: 2.30, prev1m: 2.35, prev3m: 2.42 },
  { term: '10Y', current: 2.34, prev1m: 2.38, prev3m: 2.45 },
  { term: '15Y', current: 2.45, prev1m: 2.50, prev3m: 2.55 },
  { term: '20Y', current: 2.55, prev1m: 2.60, prev3m: 2.65 },
  { term: '30Y', current: 2.68, prev1m: 2.72, prev3m: 2.78 },
];

const moneyMarketData = [
  { date: '06/01', r007: 1.82, dr007: 1.78, omo7d: 1.80, mlf1y: 2.50, slfon: 2.65 },
  { date: '06/05', r007: 1.95, dr007: 1.88, omo7d: 1.80, mlf1y: 2.50, slfon: 2.65 },
  { date: '06/10', r007: 2.10, dr007: 2.02, omo7d: 1.80, mlf1y: 2.50, slfon: 2.65 },
  { date: '06/15', r007: 1.88, dr007: 1.82, omo7d: 1.80, mlf1y: 2.50, slfon: 2.65 },
  { date: '06/20', r007: 1.85, dr007: 1.80, omo7d: 1.80, mlf1y: 2.50, slfon: 2.65 },
];

const policyRates = [
  { name: 'OMO 7天逆回购', rate: 1.80, type: '政策利率', trend: '→ 持平', color: '#4a9eff' },
  { name: 'MLF 1年期', rate: 2.50, type: '中期政策利率', trend: '→ 持平', color: '#00d4aa' },
  { name: 'SLF 隔夜', rate: 2.65, type: '常备借贷便利', trend: '→ 持平', color: '#f0c040' },
  { name: 'LPR 1年期', rate: 3.45, type: '贷款基准利率', trend: '↓ -10bp', color: '#d4a853' },
  { name: 'LPR 5年期', rate: 3.95, type: '房贷基准利率', trend: '↓ -25bp', color: '#ff9f40' },
  { name: 'R007', rate: 1.85, type: '银行间质押回购', trend: '↑ +5bp', color: '#ff6b6b' },
  { name: 'DR007', rate: 1.80, type: '存款类机构回购', trend: '→ 持平', color: '#a0b4cc' },
];

const m2Data = Array.from({ length: 12 }, (_, i) => ({
  month: `2024-${String(i + 1).padStart(2, '0')}`,
  m2: +(8.5 + Math.sin(i / 3) * 0.8 + Math.random() * 0.3).toFixed(1),
  creditGrowth: +(9.2 + Math.cos(i / 4) * 0.6 + Math.random() * 0.2).toFixed(1),
  socialFinancing: +(10.1 + Math.sin(i / 5) * 0.5 + Math.random() * 0.3).toFixed(1),
}));

export default function BTMMEnhancedPanel({ onClose }: Props) {
  const [tab, setTab] = useState<'curve' | 'policy' | 'money' | 'm2'>('curve');
  const [curveType, setCurveType] = useState<'normal' | 'flat' | 'inverted'>('normal');
  const sourceAvailability = {
    available: false,
    reason: '当前恢复资产未包含可核验的中国国债收益率、政策利率、R007/DR007 或 M2、信贷和社融时间序列。',
    checkedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  };

  if (!sourceAvailability.available) {
    return (
      <div className="h-full flex flex-col overflow-auto bg-[#0a0e1a] font-mono text-xs text-[#e0e6f0]">
        <div className="flex items-center justify-between border-b border-[#1e3a5f] bg-[#0d1526] px-3 py-2">
          <div className="flex items-center gap-3"><span className="text-sm font-bold text-[#d4a853]">4</span><span className="font-bold text-[#4a9eff]">国债与货币市场</span><span className="text-[#6b7fa3]">Government Bonds & Money Market (BTMM)</span></div>
          {onClose && <button onClick={onClose} className="px-2 text-[#6b7fa3] hover:text-white">✕</button>}
        </div>
        <main className="m-3 border border-[#d4a853] bg-[#0d1526] p-4">
          <h2 className="font-bold text-[#d4a853]">数据源不可用</h2>
          <p className="mt-3 text-[#a0b4cc]">{sourceAvailability.reason}</p>
          <p className="mt-2 text-[#6b7fa3]">读取时间：{sourceAvailability.checkedAt}。不会显示固定利率、随机 M2/信贷/社融序列、预设利差、情景影响或资金面判断。</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <section className="border border-[#1e3a5f] bg-[#060d1a] p-3"><b className="text-[#4a9eff]">国债收益率与政策利率</b><p className="mt-2 text-[#6b7fa3]">等待可核验的观测日、来源和读取时间。</p></section>
            <section className="border border-[#1e3a5f] bg-[#060d1a] p-3"><b className="text-[#4a9eff]">货币市场与货币信贷</b><p className="mt-2 text-[#6b7fa3]">等待可核验的 R007/DR007、M2、信贷和社融记录。</p></section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0e1a] text-[#e0e6f0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1526] border-b border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <span className="text-[#d4a853] font-bold text-sm">4</span>
          <span className="text-[#4a9eff] font-bold">国债与货币市场</span>
          <span className="text-[#6b7fa3]">Government Bonds & Money Market (BTMM)</span>
        </div>
        {onClose && <button onClick={onClose} className="text-[#6b7fa3] hover:text-white px-2">✕</button>}
      </div>

      {/* Policy Rate Summary Bar */}
      <div className="flex gap-3 px-3 py-2 bg-[#0d1526] border-b border-[#1e3a5f] overflow-x-auto">
        {policyRates.slice(0, 5).map(r => (
          <div key={r.name} className="flex items-center gap-2 bg-[#060d1a] rounded px-2 py-1 border border-[#1e3a5f] whitespace-nowrap">
            <span className="text-[#6b7fa3]">{r.name.split(' ')[0]}</span>
            <span className="font-bold" style={{ color: r.color }}>{r.rate}%</span>
            <span className={`text-xs ${r.trend.includes('↓') ? 'text-[#00d4aa]' : r.trend.includes('↑') ? 'text-[#ff6b6b]' : 'text-[#6b7fa3]'}`}>{r.trend}</span>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#1e3a5f] bg-[#0d1526]">
        {[{ id: 'curve', label: '国债收益率曲线' }, { id: 'policy', label: '货币政策利率' }, { id: 'money', label: '货币市场利率' }, { id: 'm2', label: 'M2与信贷' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-xs border-r border-[#1e3a5f] ${tab === t.id ? 'bg-[#1a2a4a] text-[#d4a853] border-b-2 border-b-[#d4a853]' : 'text-[#6b7fa3] hover:text-[#a0b4cc]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === 'curve' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[#d4a853] font-bold">中国国债收益率曲线（%）</div>
                <div className="flex gap-2">
                  {(['normal', 'flat', 'inverted'] as const).map(t => (
                    <button key={t} onClick={() => setCurveType(t)}
                      className={`px-2 py-1 rounded text-xs ${curveType === t ? 'bg-[#4a9eff] text-white' : 'bg-[#060d1a] text-[#6b7fa3] border border-[#1e3a5f]'}`}>
                      {t === 'normal' ? '正常' : t === 'flat' ? '平坦' : '倒挂'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[#6b7fa3] text-xs mb-1">悬浮查看各期限收益率详情及3月变动幅度</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={yieldCurveData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="term" tick={{ fill: '#6b7fa3', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7fa3', fontSize: 11 }} unit="%" domain={[1.5, 3.0]} />
                  <Tooltip content={<YieldCurveTooltip />} />
                  <Legend wrapperStyle={{ color: '#a0b4cc', fontSize: 11 }} />
                  <ReferenceLine y={2.0} stroke="#d4a853" strokeDasharray="4 3"
                    label={{ value: '2.0%关键关关', fill: '#d4a853', fontSize: 9, position: 'insideTopRight' }} />
                  <Line type="monotone" dataKey="current" name="当前" stroke="#4a9eff" strokeWidth={2.5} dot={{ fill: '#4a9eff', r: 4 }} activeDot={{ r: 7, stroke: '#4a9eff', strokeWidth: 2, fill: '#0a1628' }} />
                  <Line type="monotone" dataKey="prev1m" name="1月前" stroke="#f0c040" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="prev3m" name="3月前" stroke="#6b7fa3" strokeWidth={1.5} strokeDasharray="3 3" dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: '10Y-2Y期限利差', value: '+29bp', status: '正常陡峭', color: '#00d4aa', note: '历史均值+45bp，当前偏平' },
                { name: '10Y-1Y期限利差', value: '+42bp', status: '正常', color: '#4a9eff', note: '曲线形态健康' },
                { name: '30Y-10Y超长端', value: '+34bp', status: '正常', color: '#f0c040', note: '超长端需求旺盛' },
              ].map(item => (
                <div key={item.name} className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
                  <div className="text-[#a0b4cc]">{item.name}</div>
                  <div className="text-xl font-bold mt-1" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-xs mt-1" style={{ color: item.color }}>{item.status}</div>
                  <div className="text-[#6b7fa3] text-xs mt-1">{item.note}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">无风险利率基准说明</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#060d1a] rounded p-2">
                  <div className="text-[#4a9eff]">中国无风险利率基准</div>
                  <div className="text-[#a0b4cc] mt-1">• 短端：DR007（7天存款类回购）</div>
                  <div className="text-[#a0b4cc]">• 中端：MLF利率（1年期）</div>
                  <div className="text-[#a0b4cc]">• 长端：10年期国债收益率</div>
                  <div className="text-[#00d4aa] mt-1">当前10Y国债：2.34%</div>
                </div>
                <div className="bg-[#060d1a] rounded p-2">
                  <div className="text-[#4a9eff]">信用利差基准</div>
                  <div className="text-[#a0b4cc] mt-1">CS = YTM_credit - YTM_treasury</div>
                  <div className="text-[#a0b4cc]">AAA信用债利差：+55bp</div>
                  <div className="text-[#a0b4cc]">AA+信用债利差：+91bp</div>
                  <div className="text-[#a0b4cc]">AA信用债利差：+151bp</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'policy' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded overflow-hidden">
              <div className="bg-[#060d1a] px-3 py-2 text-[#d4a853] font-bold">货币政策利率体系</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e3a5f]">
                    {['工具名称', '当前利率', '类型', '趋势', '说明'].map(h => (
                      <th key={h} className="text-left text-[#6b7fa3] px-3 py-2 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {policyRates.map((row, i) => (
                    <tr key={i} className="border-b border-[#0a1020] hover:bg-[#0f1a2e]">
                      <td className="px-3 py-2 font-bold" style={{ color: row.color }}>{row.name}</td>
                      <td className="px-3 py-2 text-[#e0e6f0] font-bold text-sm">{row.rate}%</td>
                      <td className="px-3 py-2 text-[#a0b4cc]">{row.type}</td>
                      <td className={`px-3 py-2 font-bold ${row.trend.includes('↓') ? 'text-[#00d4aa]' : row.trend.includes('↑') ? 'text-[#ff6b6b]' : 'text-[#6b7fa3]'}`}>{row.trend}</td>
                      <td className="px-3 py-2 text-[#6b7fa3]">
                        {row.name.includes('OMO') ? '公开市场操作，短期流动性调节' :
                         row.name.includes('MLF') ? '中期流动性投放，LPR定价基础' :
                         row.name.includes('SLF') ? '利率走廊上限，应急流动性' :
                         row.name.includes('LPR 1') ? '企业贷款基准，已降10bp' :
                         row.name.includes('LPR 5') ? '房贷基准，2024年大幅下调' :
                         row.name.includes('R007') ? '银行间市场资金面指标' : '存款类机构资金成本'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">利率走廊机制</div>
              <div className="relative h-24 bg-[#060d1a] rounded p-3">
                <div className="flex items-center justify-between h-full">
                  <div className="text-center">
                    <div className="text-[#ff6b6b] font-bold">SLF 2.65%</div>
                    <div className="text-[#6b7fa3] text-xs">利率走廊上限</div>
                  </div>
                  <div className="flex-1 mx-4 relative">
                    <div className="border-t-2 border-[#ff6b6b] border-dashed w-full absolute" style={{ top: '20%' }} />
                    <div className="border-t-2 border-[#4a9eff] w-full absolute" style={{ top: '50%' }} />
                    <div className="border-t-2 border-[#00d4aa] border-dashed w-full absolute" style={{ top: '80%' }} />
                    <div className="absolute text-[#4a9eff] text-xs font-bold" style={{ top: '42%', left: '40%' }}>OMO 1.80%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#00d4aa] font-bold">超额准备金 0.35%</div>
                    <div className="text-[#6b7fa3] text-xs">利率走廊下限</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'money' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">货币市场利率走势（2024年6月）</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={moneyMarketData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7fa3', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7fa3', fontSize: 11 }} unit="%" domain={[1.6, 2.7]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1526', border: '1px solid #1e3a5f', color: '#e0e6f0' }} />
                  <Legend wrapperStyle={{ color: '#a0b4cc', fontSize: 11 }} />
                  <Line type="monotone" dataKey="r007" name="R007" stroke="#ff6b6b" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="dr007" name="DR007" stroke="#4a9eff" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="omo7d" name="OMO 7天" stroke="#f0c040" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="mlf1y" name="MLF 1年" stroke="#00d4aa" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
                <div className="text-[#4a9eff] font-bold mb-2">R007-DR007利差（资金分层）</div>
                <div className="text-3xl font-bold text-[#f0c040]">+5bp</div>
                <div className="text-[#6b7fa3] mt-1">非银机构融资溢价</div>
                <div className="mt-2 text-xs bg-[#060d1a] rounded p-2">
                  <div className="text-[#a0b4cc]">历史均值：+8bp</div>
                  <div className="text-[#00d4aa]">当前偏低，资金面宽松</div>
                  <div className="text-[#6b7fa3] mt-1">当利差&gt;15bp时，非银机构融资压力较大</div>
                </div>
              </div>
              <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
                <div className="text-[#4a9eff] font-bold mb-2">资金面综合评估</div>
                <div className="space-y-2 text-xs">
                  {[
                    { name: '资金面松紧', value: '偏松', color: '#00d4aa' },
                    { name: '月末效应', value: '轻微', color: '#f0c040' },
                    { name: '税期影响', value: '已过', color: '#00d4aa' },
                    { name: '央行态度', value: '呵护', color: '#00d4aa' },
                  ].map(item => (
                    <div key={item.name} className="flex justify-between bg-[#060d1a] rounded p-1.5">
                      <span className="text-[#a0b4cc]">{item.name}</span>
                      <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'm2' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">M2增速与信贷扩张（2024年，%）</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={m2Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="month" tick={{ fill: '#6b7fa3', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7fa3', fontSize: 10 }} unit="%" domain={[7, 12]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1526', border: '1px solid #1e3a5f', color: '#e0e6f0' }} />
                  <Legend wrapperStyle={{ color: '#a0b4cc', fontSize: 11 }} />
                  <Line type="monotone" dataKey="m2" name="M2增速" stroke="#4a9eff" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="creditGrowth" name="信贷增速" stroke="#00d4aa" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="socialFinancing" name="社融增速" stroke="#f0c040" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
              <div className="text-[#d4a853] font-bold mb-2">货币政策对债市影响分析</div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  { scenario: '降息25bp', impact: '债市利好', detail: '国债收益率下行10-15bp，信用利差收窄5-8bp', color: '#00d4aa' },
                  { scenario: '降准50bp', impact: '流动性改善', detail: '资金面宽松，短端利率下行，曲线陡峭化', color: '#4a9eff' },
                  { scenario: '收紧流动性', impact: '债市承压', detail: 'R007上行，短端利率上升，信用利差扩大', color: '#ff6b6b' },
                ].map(item => (
                  <div key={item.scenario} className="bg-[#060d1a] rounded p-3 border border-[#1e3a5f]">
                    <div className="font-bold" style={{ color: item.color }}>{item.scenario}</div>
                    <div className="text-[#a0b4cc] mt-1">{item.impact}</div>
                    <div className="text-[#6b7fa3] mt-1">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Brush, ReferenceLine } from 'recharts';
import type { TooltipProps } from 'recharts';

const NICETooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
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

const newIssuances = [
  { date: '2024-06-24', issuer: '中国铁路建设债', type: '央企债', rating: 'AAA', tenor: '3年', coupon: '2.68%', size: '50亿', spread: '+12bp', status: '簿记中', premium: '一二级利差+5bp' },
  { date: '2024-06-25', issuer: '某省城投债', type: '城投债', rating: 'AA+', tenor: '3年', coupon: '3.45%', size: '10亿', spread: '+85bp', status: '待发行', premium: '一二级利差+12bp' },
  { date: '2024-06-26', issuer: '国家电网债', type: '央企债', rating: 'AAA', tenor: '5年', coupon: '2.85%', size: '30亿', spread: '+18bp', status: '待发行', premium: '一二级利差+8bp' },
  { date: '2024-06-27', issuer: '某股份制银行二级资本债', type: '金融债', rating: 'AA+', tenor: '10年', coupon: '3.52%', size: '100亿', spread: '+95bp', status: '路演中', premium: '一二级利差+15bp' },
  { date: '2024-06-28', issuer: '某房企MTN', type: '产业债', rating: 'AA', tenor: '1年', coupon: '5.80%', size: '5亿', spread: '+325bp', status: '待定', premium: '一二级利差+30bp' },
];

const ratingChanges = [
  { date: '2024-06-20', issuer: '某城投公司', from: 'AA', to: 'AA+', agency: '中诚信', type: '上调', reason: '地方政府支持力度增强，债务化解进展顺利' },
  { date: '2024-06-18', issuer: '某房地产企业', from: 'AA', to: 'AA-', agency: '联合资信', type: '下调', reason: '销售持续下滑，流动性压力加大，再融资能力减弱' },
  { date: '2024-06-15', issuer: '某煤炭企业', from: 'AA-', to: 'AA', agency: '大公国际', type: '上调', reason: '煤炭价格高位运行，盈利能力显著改善' },
  { date: '2024-06-10', issuer: '某民营制造业', from: 'AA+', to: 'AA', agency: '中诚信', type: '下调', reason: '行业竞争加剧，毛利率下滑，债务偿还压力增加' },
];

const corporateEvents = [
  { date: '2024-06-22', issuer: '某城投公司', event: '债务置换', detail: '完成100亿元城投债务置换，期限延长至5年，利率下调50bp', impact: '正面' },
  { date: '2024-06-21', issuer: '某房企', event: '展期公告', detail: '申请20亿元MTN展期6个月，已获持有人会议通过', impact: '中性' },
  { date: '2024-06-20', issuer: '某制造业', event: '股权变更', detail: '国有资本入股30%，实际控制人变更为地方国资委', impact: '正面' },
  { date: '2024-06-19', issuer: '某银行', event: '资本补充', detail: '发行100亿元永续债，补充其他一级资本', impact: '正面' },
];

const issuanceVolume = [
  { month: '2024-01', corp: 3200, city: 2800, fin: 5500, total: 11500 },
  { month: '2024-02', corp: 1800, city: 1500, fin: 3200, total: 6500 },
  { month: '2024-03', corp: 4500, city: 3800, fin: 6800, total: 15100 },
  { month: '2024-04', corp: 3800, city: 3200, fin: 5900, total: 12900 },
  { month: '2024-05', corp: 4200, city: 3500, fin: 6200, total: 13900 },
  { month: '2024-06', corp: 2100, city: 1800, fin: 3100, total: 7000 },
];

export default function NICEPanel({ onClose }: Props) {
  const [tab, setTab] = useState<'issuance' | 'ratings' | 'events' | 'volume'>('issuance');

  return (
    <div className="h-full flex flex-col bg-[#0a0e1a] text-[#e0e6f0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1526] border-b border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <span className="text-[#d4a853] font-bold text-sm">20</span>
          <span className="text-[#4a9eff] font-bold">新发行 / 公司大事 / 评级</span>
          <span className="text-[#6b7fa3]">New Issuance, Corporate Events & Ratings (NICE)</span>
        </div>
        {onClose && <button onClick={onClose} className="text-[#6b7fa3] hover:text-white px-2">✕</button>}
      </div>
      <div className="flex border-b border-[#1e3a5f] bg-[#0d1526]">
        {[{ id: 'issuance', label: '新发行日程' }, { id: 'ratings', label: '评级变化' }, { id: 'events', label: '公司大事' }, { id: 'volume', label: '发行量统计' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2 text-xs border-r border-[#1e3a5f] ${tab === t.id ? 'bg-[#1a2a4a] text-[#d4a853] border-b-2 border-b-[#d4a853]' : 'text-[#6b7fa3] hover:text-[#a0b4cc]'}`}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {tab === 'issuance' && (
          <div className="space-y-3">
            <div className="bg-[#0d1526] border border-[#1e3a5f] rounded overflow-hidden">
              <div className="bg-[#060d1a] px-3 py-2 text-[#d4a853] font-bold">近期新债发行日程（一二级套利分析）</div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[#1e3a5f]">
                  {['发行日', '发行人', '类型', '评级', '期限', '票息', '规模', '利差', '状态', '一二级套利'].map(h => (
                    <th key={h} className="text-left text-[#6b7fa3] px-2 py-2 font-normal whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {newIssuances.map((iss, i) => (
                    <tr key={i} className="border-b border-[#0a1020] hover:bg-[#0f1a2e]">
                      <td className="px-2 py-1.5 text-[#6b7fa3]">{iss.date}</td>
                      <td className="px-2 py-1.5 text-[#4a9eff] font-bold">{iss.issuer}</td>
                      <td className="px-2 py-1.5"><span className="px-1 py-0.5 rounded bg-[#1e3a5f] text-[#a0b4cc]">{iss.type}</span></td>
                      <td className="px-2 py-1.5 text-[#00d4aa] font-bold">{iss.rating}</td>
                      <td className="px-2 py-1.5 text-[#e0e6f0]">{iss.tenor}</td>
                      <td className="px-2 py-1.5 text-[#d4a853] font-bold">{iss.coupon}</td>
                      <td className="px-2 py-1.5 text-[#f0c040]">{iss.size}</td>
                      <td className="px-2 py-1.5 text-[#a0b4cc]">{iss.spread}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${iss.status === '簿记中' ? 'bg-[#4a9eff20] text-[#4a9eff]' : iss.status === '路演中' ? 'bg-[#d4a85320] text-[#d4a853]' : 'bg-[#1e3a5f] text-[#6b7fa3]'}`}>{iss.status}</span>
                      </td>
                      <td className="px-2 py-1.5 text-[#00d4aa] text-xs">{iss.premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'ratings' && (
          <div className="space-y-3">
            {ratingChanges.map((r, i) => (
              <div key={i} className={`bg-[#0d1526] border rounded p-3 ${r.type === '上调' ? 'border-[#00d4aa40]' : 'border-[#ff6b6b40]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#4a9eff] font-bold">{r.issuer}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.type === '上调' ? 'bg-[#00d4aa20] text-[#00d4aa]' : 'bg-[#ff6b6b20] text-[#ff6b6b]'}`}>{r.type}</span>
                    <span className="text-[#6b7fa3]">{r.from}</span>
                    <span className="text-[#d4a853]">→</span>
                    <span className={`font-bold ${r.type === '上调' ? 'text-[#00d4aa]' : 'text-[#ff6b6b]'}`}>{r.to}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#6b7fa3]">{r.agency}</span>
                    <span className="text-[#6b7fa3]">{r.date}</span>
                  </div>
                </div>
                <div className="text-[#a0b4cc] text-xs">{r.reason}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'events' && (
          <div className="space-y-3">
            {corporateEvents.map((ev, i) => (
              <div key={i} className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#4a9eff] font-bold">{ev.issuer}</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-[#1e3a5f] text-[#a0b4cc]">{ev.event}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${ev.impact === '正面' ? 'bg-[#00d4aa20] text-[#00d4aa]' : ev.impact === '负面' ? 'bg-[#ff6b6b20] text-[#ff6b6b]' : 'bg-[#f0c04020] text-[#f0c040]'}`}>{ev.impact}</span>
                  </div>
                  <span className="text-[#6b7fa3]">{ev.date}</span>
                </div>
                <div className="text-[#a0b4cc] text-xs">{ev.detail}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'volume' && (
          <div className="bg-[#0d1526] border border-[#1e3a5f] rounded p-3">
            <div className="text-[#d4a853] font-bold mb-2">月度信用债发行量（亿元）</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={issuanceVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="month" tick={{ fill: '#6b7fa3', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7fa3', fontSize: 10 }} />
                <Tooltip content={<NICETooltip />} />
                <Legend wrapperStyle={{ color: '#a0b4cc', fontSize: 11 }} />
                <Bar dataKey="corp" name="产业债" stackId="a" fill="#4a9eff" />
                <Bar dataKey="city" name="城投债" stackId="a" fill="#d4a853" />
                <Bar dataKey="fin" name="金融债" stackId="a" fill="#00d4aa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

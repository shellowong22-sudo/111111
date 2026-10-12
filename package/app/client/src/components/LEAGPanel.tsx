/**
 * LEAG - 顾问公司排行榜（增强版）
 * 功能：债券承销排行榜、市场份额分析、历史趋势、地区/行业分布、季度对比、机构详情
 */
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Minus, Building2, Globe, Calendar } from 'lucide-react';

interface LEAGPanelProps { onClose?: () => void; }

const LEAGUE_TABLE = [
  { rank: 1, prevRank: 2, firm: '中信证券', volume: 8520, deals: 312, share: 12.8, fee: 85.2, change: 1, region: '全国', specialty: '综合', q1: 2100, q2: 2200, q3: 2050, q4: 2170, govShare: 35, corpShare: 45, finShare: 20 },
  { rank: 2, prevRank: 1, firm: '中金公司', volume: 7890, deals: 285, share: 11.9, fee: 78.9, change: -1, region: '全国', specialty: '投行', q1: 2050, q2: 1980, q3: 1900, q4: 1960, govShare: 30, corpShare: 50, finShare: 20 },
  { rank: 3, prevRank: 3, firm: '华泰证券', volume: 6540, deals: 241, share: 9.8, fee: 65.4, change: 0, region: '华东', specialty: '综合', q1: 1650, q2: 1700, q3: 1580, q4: 1610, govShare: 40, corpShare: 35, finShare: 25 },
  { rank: 4, prevRank: 5, firm: '国泰君安', volume: 5820, deals: 218, share: 8.7, fee: 58.2, change: 1, region: '华东', specialty: '综合', q1: 1450, q2: 1500, q3: 1420, q4: 1450, govShare: 38, corpShare: 40, finShare: 22 },
  { rank: 5, prevRank: 4, firm: '申万宏源', volume: 5340, deals: 198, share: 8.0, fee: 53.4, change: -1, region: '华东', specialty: '研究', q1: 1350, q2: 1380, q3: 1300, q4: 1310, govShare: 42, corpShare: 38, finShare: 20 },
  { rank: 6, prevRank: 7, firm: '招商证券', volume: 4890, deals: 182, share: 7.3, fee: 48.9, change: 1, region: '华南', specialty: '综合', q1: 1220, q2: 1250, q3: 1200, q4: 1220, govShare: 32, corpShare: 48, finShare: 20 },
  { rank: 7, prevRank: 6, firm: '广发证券', volume: 4560, deals: 171, share: 6.8, fee: 45.6, change: -1, region: '华南', specialty: '综合', q1: 1150, q2: 1180, q3: 1100, q4: 1130, govShare: 36, corpShare: 42, finShare: 22 },
  { rank: 8, prevRank: 8, firm: '海通证券', volume: 4120, deals: 155, share: 6.2, fee: 41.2, change: 0, region: '华东', specialty: '综合', q1: 1050, q2: 1080, q3: 980, q4: 1010, govShare: 34, corpShare: 44, finShare: 22 },
  { rank: 9, prevRank: 10, firm: '兴业证券', volume: 3780, deals: 142, share: 5.7, fee: 37.8, change: 1, region: '华东', specialty: '固收', q1: 950, q2: 980, q3: 920, q4: 930, govShare: 45, corpShare: 35, finShare: 20 },
  { rank: 10, prevRank: 9, firm: '平安证券', volume: 3450, deals: 130, share: 5.2, fee: 34.5, change: -1, region: '华南', specialty: '综合', q1: 880, q2: 900, q3: 850, q4: 820, govShare: 30, corpShare: 50, finShare: 20 },
];

const SHARE_TREND = [
  { year: '2019', citic: 10.5, cicc: 13.2, huatai: 8.5, guotai: 7.8, shenwan: 7.2 },
  { year: '2020', citic: 11.0, cicc: 12.8, huatai: 8.8, guotai: 8.0, shenwan: 7.5 },
  { year: '2021', citic: 11.2, cicc: 12.5, huatai: 9.1, guotai: 8.2, shenwan: 7.8 },
  { year: '2022', citic: 11.8, cicc: 12.1, huatai: 9.4, guotai: 8.5, shenwan: 8.0 },
  { year: '2023', citic: 12.3, cicc: 11.9, huatai: 9.6, guotai: 8.6, shenwan: 8.0 },
  { year: '2024', citic: 12.8, cicc: 11.9, huatai: 9.8, guotai: 8.7, shenwan: 8.0 },
];

const SECTOR_DATA = [
  { sector: '政府/城投', volume: 25000, share: 37.5, color: '#60a5fa' },
  { sector: '金融机构', volume: 18000, share: 27.0, color: '#10b981' },
  { sector: '央企/国企', volume: 12000, share: 18.0, color: '#f59e0b' },
  { sector: '民营企业', volume: 6000, share: 9.0, color: '#ef4444' },
  { sector: '外资企业', volume: 5600, share: 8.4, color: '#8b5cf6' },
];

const REGION_DATA = [
  { region: '华东', volume: 28000, share: 42, firms: 5, color: '#3b82f6' },
  { region: '华南', volume: 15000, share: 22.5, firms: 3, color: '#10b981' },
  { region: '华北', volume: 12000, share: 18, firms: 2, color: '#f59e0b' },
  { region: '西部', volume: 6500, share: 9.8, firms: 1, color: '#8b5cf6' },
  { region: '东北', volume: 5000, share: 7.5, firms: 1, color: '#ef4444' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-mono">{p.value}{typeof p.value === 'number' && p.value < 20 ? '%' : '亿'}</span>
        </div>
      ))}
    </div>
  );
};

export default function LEAGPanel({ onClose }: LEAGPanelProps) {
  const [activeView, setActiveView] = useState<'table' | 'trend' | 'sector' | 'quarter' | 'region'>('table');
  const [selectedFirm, setSelectedFirm] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedTable = useMemo(() => {
    return [...LEAGUE_TABLE].sort((a, b) => {
      const v = sortDir === 'asc' ? 1 : -1;
      return v * ((a as any)[sortCol] - (b as any)[sortCol]);
    });
  }, [sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const firmDetail = selectedFirm ? LEAGUE_TABLE.find(f => f.firm === selectedFirm) : null;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <div>
            <h2 className="text-sm font-bold text-white">LEAG 顾问公司排行榜</h2>
            <p className="text-xs text-gray-400">债券承销排行 · 市场份额 · 行业分布 · 季度对比</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {([
              { id: 'table', label: '排行榜', icon: Trophy },
              { id: 'trend', label: '份额趋势', icon: TrendingUp },
              { id: 'quarter', label: '季度对比', icon: Calendar },
              { id: 'sector', label: '行业分布', icon: Building2 },
              { id: 'region', label: '地区分布', icon: Globe },
            ] as const).map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${activeView === v.id ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                <v.icon className="w-3 h-3" />{v.label}
              </button>
            ))}
          </div>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 p-0">✕</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {activeView === 'table' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '总承销规模', value: `${(LEAGUE_TABLE.reduce((s, r) => s + r.volume, 0) / 10000).toFixed(1)}万亿`, color: 'text-yellow-400' },
                { label: '总交易笔数', value: `${LEAGUE_TABLE.reduce((s, r) => s + r.deals, 0)}笔`, color: 'text-blue-400' },
                { label: '平均费率', value: '1.0%', color: 'text-green-400' },
                { label: 'CR5集中度', value: `${LEAGUE_TABLE.slice(0, 5).reduce((s, r) => s + r.share, 0).toFixed(1)}%`, color: 'text-purple-400' },
              ].map(s => (
                <Card key={s.label} className="bg-gray-900 border-gray-800 p-3 text-center">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                </Card>
              ))}
            </div>

            <Card className="bg-gray-900 border-gray-800 p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800">
                    <tr>
                      {[
                        { label: '排名', col: 'rank' }, { label: '变动', col: 'change' }, { label: '机构名称', col: 'firm' },
                        { label: '承销规模(亿)', col: 'volume' }, { label: '承销笔数', col: 'deals' },
                        { label: '市场份额', col: 'share' }, { label: '预计费用(亿)', col: 'fee' }, { label: '操作', col: '' },
                      ].map(h => (
                        <th key={h.label} className="text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap cursor-pointer hover:text-yellow-400"
                          onClick={() => h.col && handleSort(h.col)}>
                          {h.label} {sortCol === h.col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTable.map(r => (
                      <tr key={r.rank} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${selectedFirm === r.firm ? 'bg-yellow-900/20' : ''}`}>
                        <td className="py-2 px-3">
                          <span className={`font-bold text-sm ${r.rank <= 3 ? 'text-yellow-400' : 'text-gray-300'}`}>#{r.rank}</span>
                        </td>
                        <td className="py-2 px-3">
                          {r.change > 0 ? <TrendingUp className="w-3 h-3 text-green-400" /> :
                           r.change < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> :
                           <Minus className="w-3 h-3 text-gray-500" />}
                        </td>
                        <td className="py-2 px-3 text-white font-medium">{r.firm}</td>
                        <td className="py-2 px-3 text-white font-mono">{r.volume.toLocaleString()}</td>
                        <td className="py-2 px-3 text-gray-300 font-mono">{r.deals}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-800 rounded-full h-1.5 w-16">
                              <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${(r.share / 13) * 100}%` }} />
                            </div>
                            <span className="text-yellow-400 font-mono">{r.share}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-green-400 font-mono">{r.fee.toFixed(1)}</td>
                        <td className="py-2 px-3">
                          <button onClick={() => setSelectedFirm(selectedFirm === r.firm ? null : r.firm)}
                            className="px-2 py-0.5 text-xs bg-gray-800 hover:bg-yellow-600 text-gray-300 hover:text-white rounded transition-colors">
                            详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {firmDetail && (
              <Card className="bg-gray-900 border-yellow-800/50 p-4 animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-yellow-400">{firmDetail.firm} 详细分析</h3>
                  <button onClick={() => setSelectedFirm(null)} className="text-gray-400 hover:text-white text-xs">关闭</button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-2">季度承销量</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={[
                        { q: 'Q1', vol: firmDetail.q1 }, { q: 'Q2', vol: firmDetail.q2 },
                        { q: 'Q3', vol: firmDetail.q3 }, { q: 'Q4', vol: firmDetail.q4 },
                      ]}>
                        <XAxis dataKey="q" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} />
                        <Bar dataKey="vol" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-2">业务结构</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={[
                          { name: '政府债', value: firmDetail.govShare },
                          { name: '企业债', value: firmDetail.corpShare },
                          { name: '金融债', value: firmDetail.finShare },
                        ]} dataKey="value" cx="50%" cy="50%" outerRadius={45} label={({ name, value }) => `${name}${value}%`} labelLine={false}>
                          <Cell fill="#60a5fa" /><Cell fill="#10b981" /><Cell fill="#f59e0b" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-gray-400">地区</span><span className="text-white">{firmDetail.region}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">特长</span><span className="text-white">{firmDetail.specialty}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">平均单笔</span><span className="text-yellow-400">{(firmDetail.volume / firmDetail.deals).toFixed(1)}亿</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">费率</span><span className="text-green-400">{(firmDetail.fee / firmDetail.volume * 100).toFixed(2)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">排名变动</span>
                      <span className={firmDetail.change > 0 ? 'text-green-400' : firmDetail.change < 0 ? 'text-red-400' : 'text-gray-400'}>
                        {firmDetail.change > 0 ? `↑${firmDetail.change}` : firmDetail.change < 0 ? `↓${Math.abs(firmDetail.change)}` : '持平'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {activeView === 'trend' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">前五大机构市场份额趋势（2019-2024）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={SHARE_TREND} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[6, 14]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="citic" name="中信证券" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="cicc" name="中金公司" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="huatai" name="华泰证券" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="guotai" name="国泰君安" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="shenwan" name="申万宏源" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">CR5市场集中度变化</h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={SHARE_TREND.map(d => ({ year: d.year, cr5: +(d.citic + d.cicc + d.huatai + d.guotai + d.shenwan).toFixed(1) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[45, 55]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="cr5" name="CR5集中度" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'quarter' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">2024年各季度承销规模对比（亿元）</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={LEAGUE_TABLE.map(r => ({ firm: r.firm, Q1: r.q1, Q2: r.q2, Q3: r.q3, Q4: r.q4 }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis dataKey="firm" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Q1" name="Q1" fill="#60a5fa" />
                  <Bar dataKey="Q2" name="Q2" fill="#10b981" />
                  <Bar dataKey="Q3" name="Q3" fill="#f59e0b" />
                  <Bar dataKey="Q4" name="Q4" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">季度环比增长率</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800">
                    <tr>
                      {['机构', 'Q1→Q2', 'Q2→Q3', 'Q3→Q4', '全年增长'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LEAGUE_TABLE.slice(0, 5).map(r => {
                      const q1q2 = ((r.q2 - r.q1) / r.q1 * 100).toFixed(1);
                      const q2q3 = ((r.q3 - r.q2) / r.q2 * 100).toFixed(1);
                      const q3q4 = ((r.q4 - r.q3) / r.q3 * 100).toFixed(1);
                      const full = ((r.q4 - r.q1) / r.q1 * 100).toFixed(1);
                      return (
                        <tr key={r.firm} className="border-b border-gray-800/50">
                          <td className="py-2 px-3 text-white font-medium">{r.firm}</td>
                          <td className={`py-2 px-3 font-mono ${+q1q2 >= 0 ? 'text-green-400' : 'text-red-400'}`}>{+q1q2 >= 0 ? '+' : ''}{q1q2}%</td>
                          <td className={`py-2 px-3 font-mono ${+q2q3 >= 0 ? 'text-green-400' : 'text-red-400'}`}>{+q2q3 >= 0 ? '+' : ''}{q2q3}%</td>
                          <td className={`py-2 px-3 font-mono ${+q3q4 >= 0 ? 'text-green-400' : 'text-red-400'}`}>{+q3q4 >= 0 ? '+' : ''}{q3q4}%</td>
                          <td className={`py-2 px-3 font-mono font-bold ${+full >= 0 ? 'text-green-400' : 'text-red-400'}`}>{+full >= 0 ? '+' : ''}{full}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeView === 'sector' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">行业承销量分布</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={SECTOR_DATA} cx="50%" cy="50%" outerRadius={80} dataKey="volume" label={({ sector, share }) => `${sector} ${share}%`} labelLine={false}>
                      {SECTOR_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}亿`, '承销量']} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">行业分布详情</h3>
                <div className="space-y-3">
                  {SECTOR_DATA.map(d => (
                    <div key={d.sector} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-gray-300 text-xs flex-1">{d.sector}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${(d.share / 40) * 100}%`, background: d.color }} />
                      </div>
                      <span className="text-white font-mono text-xs w-12 text-right">{d.share}%</span>
                      <span className="text-gray-400 font-mono text-xs w-16 text-right">{(d.volume / 10000).toFixed(2)}万亿</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">各机构行业结构对比</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={LEAGUE_TABLE.slice(0, 5).map(r => ({ firm: r.firm, gov: r.govShare, corp: r.corpShare, fin: r.finShare }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="firm" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="gov" name="政府债" stackId="a" fill="#60a5fa" />
                  <Bar dataKey="corp" name="企业债" stackId="a" fill="#10b981" />
                  <Bar dataKey="fin" name="金融债" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'region' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">地区承销量分布</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={REGION_DATA} cx="50%" cy="50%" outerRadius={80} dataKey="volume" label={({ region, share }) => `${region} ${share}%`} labelLine={false}>
                      {REGION_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}亿`, '承销量']} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">地区详情</h3>
                <div className="space-y-3">
                  {REGION_DATA.map(d => (
                    <div key={d.region} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-gray-300 text-xs w-10">{d.region}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${(d.share / 45) * 100}%`, background: d.color }} />
                      </div>
                      <span className="text-white font-mono text-xs w-10 text-right">{d.share}%</span>
                      <span className="text-gray-400 font-mono text-xs w-14 text-right">{d.firms}家</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-800">
                  <h4 className="text-xs text-gray-400 mb-2">地区竞争格局</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-300">华东地区</span><span className="text-yellow-400">竞争最激烈（5家头部）</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">华南地区</span><span className="text-blue-400">招商/广发/平安三强</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">华北地区</span><span className="text-green-400">中信/中金双寡头</span></div>
                  </div>
                </div>
              </Card>
            </div>
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">地区承销规模对比（亿元）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={REGION_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="region" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="volume" name="承销量(亿)" radius={[4, 4, 0, 0]}>
                    {REGION_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

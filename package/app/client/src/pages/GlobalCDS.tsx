/**
 * WCDS - 全球 CDS 矩阵 (World CDS)
 * 主权/企业 CDS 利差热力图、跨期限利差曲线、CDS-债券基差计算
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// --- 全球 CDS 数据（近似真实市场数据）----------------------------------------

interface CDSEntity {
  name: string; country: string; region: string; type: 'sovereign' | 'corp';
  rating: string; spread1Y: number; spread3Y: number; spread5Y: number;
  spread10Y: number; bondYield5Y: number; change1D: number;
}

const GLOBAL_CDS_DATA: CDSEntity[] = [
  // 主权
  { name: 'United States', country: 'US', region: 'Americas', type: 'sovereign', rating: 'Aaa', spread1Y: 12, spread3Y: 18, spread5Y: 22, spread10Y: 28, bondYield5Y: 4.40, change1D: +1.2 },
  { name: 'Germany', country: 'DE', region: 'Europe', type: 'sovereign', rating: 'Aaa', spread1Y: 8, spread3Y: 12, spread5Y: 15, spread10Y: 20, bondYield5Y: 2.42, change1D: -0.5 },
  { name: 'Japan', country: 'JP', region: 'Asia', type: 'sovereign', rating: 'A1', spread1Y: 18, spread3Y: 28, spread5Y: 35, spread10Y: 45, bondYield5Y: 0.68, change1D: +0.8 },
  { name: 'China', country: 'CN', region: 'Asia', type: 'sovereign', rating: 'A1', spread1Y: 42, spread3Y: 62, spread5Y: 78, spread10Y: 95, bondYield5Y: 1.85, change1D: +2.1 },
  { name: 'Italy', country: 'IT', region: 'Europe', type: 'sovereign', rating: 'Baa3', spread1Y: 88, spread3Y: 112, spread5Y: 135, spread10Y: 162, bondYield5Y: 3.72, change1D: +3.5 },
  { name: 'Spain', country: 'ES', region: 'Europe', type: 'sovereign', rating: 'Baa1', spread1Y: 42, spread3Y: 58, spread5Y: 72, spread10Y: 88, bondYield5Y: 3.18, change1D: +1.8 },
  { name: 'Brazil', country: 'BR', region: 'Americas', type: 'sovereign', rating: 'Ba1', spread1Y: 128, spread3Y: 165, spread5Y: 185, spread10Y: 215, bondYield5Y: 6.85, change1D: -2.3 },
  { name: 'Mexico', country: 'MX', region: 'Americas', type: 'sovereign', rating: 'Baa2', spread1Y: 95, spread3Y: 125, spread5Y: 148, spread10Y: 178, bondYield5Y: 5.92, change1D: +1.5 },
  { name: 'Turkey', country: 'TR', region: 'Europe', type: 'sovereign', rating: 'B2', spread1Y: 285, spread3Y: 345, spread5Y: 385, spread10Y: 425, bondYield5Y: 9.45, change1D: +8.2 },
  { name: 'South Korea', country: 'KR', region: 'Asia', type: 'sovereign', rating: 'Aa2', spread1Y: 22, spread3Y: 32, spread5Y: 38, spread10Y: 48, bondYield5Y: 3.12, change1D: +0.3 },
  // 企业
  { name: 'Apple Inc', country: 'US', region: 'Americas', type: 'corp', rating: 'Aaa', spread1Y: 15, spread3Y: 22, spread5Y: 28, spread10Y: 38, bondYield5Y: 4.68, change1D: -0.8 },
  { name: 'JPMorgan', country: 'US', region: 'Americas', type: 'corp', rating: 'A1', spread1Y: 38, spread3Y: 52, spread5Y: 62, spread10Y: 78, bondYield5Y: 5.02, change1D: +1.2 },
  { name: 'Deutsche Bank', country: 'DE', region: 'Europe', type: 'corp', rating: 'Baa2', spread1Y: 68, spread3Y: 92, spread5Y: 112, spread10Y: 138, bondYield5Y: 3.54, change1D: +4.5 },
  { name: 'Toyota', country: 'JP', region: 'Asia', type: 'corp', rating: 'Aa3', spread1Y: 22, spread3Y: 32, spread5Y: 42, spread10Y: 55, bondYield5Y: 1.12, change1D: +0.5 },
  { name: 'Alibaba', country: 'CN', region: 'Asia', type: 'corp', rating: 'A1', spread1Y: 58, spread3Y: 82, spread5Y: 98, spread10Y: 118, bondYield5Y: 2.85, change1D: +3.2 },
  { name: 'Petrobras', country: 'BR', region: 'Americas', type: 'corp', rating: 'Ba1', spread1Y: 168, spread3Y: 215, spread5Y: 245, spread10Y: 285, bondYield5Y: 7.45, change1D: -1.8 },
];

const TENORS = ['1Y', '3Y', '5Y', '10Y'];
const REGIONS = ['All', 'Americas', 'Europe', 'Asia'];
const TYPES = ['All', 'sovereign', 'corp'];

// 颜色映射（利差 → 热力图颜色）
function spreadToColor(spread: number): string {
  if (spread < 30) return '#22c55e';
  if (spread < 80) return '#84cc16';
  if (spread < 150) return '#f59e0b';
  if (spread < 250) return '#ef4444';
  return '#dc2626';
}

// CDS-债券基差 = CDS利差 - (债券收益率 - 无风险利率)
function calcBasis(entity: CDSEntity, riskFreeRate: number): number {
  const zSpread = entity.bondYield5Y - riskFreeRate;
  return entity.spread5Y - zSpread * 100;
}

export default function GlobalCDS() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'matrix' | 'curves' | 'basis' | 'heatmap' | 'ai'>('matrix');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedTenor, setSelectedTenor] = useState('5Y');
  const [sortBy, setSortBy] = useState<'spread' | 'change' | 'rating'>('spread');
  const [riskFreeRate] = useState(4.40);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const generateStrategy = trpc.derivatives.ai.generateStrategy.useMutation();

  const filteredData = useMemo(() => {
    let data = GLOBAL_CDS_DATA;
    if (selectedRegion !== 'All') data = data.filter(d => d.region === selectedRegion);
    if (selectedType !== 'All') data = data.filter(d => d.type === selectedType);
    return [...data].sort((a, b) => {
      if (sortBy === 'spread') return b.spread5Y - a.spread5Y;
      if (sortBy === 'change') return b.change1D - a.change1D;
      return a.rating.localeCompare(b.rating);
    });
  }, [selectedRegion, selectedType, sortBy]);

  const tenorSpreadKey = `spread${selectedTenor}` as keyof CDSEntity;

  const curveData = useMemo(() => {
    return filteredData.slice(0, 6).map(e => ({
      name: e.name.split(' ')[0],
      '1Y': e.spread1Y, '3Y': e.spread3Y, '5Y': e.spread5Y, '10Y': e.spread10Y,
    }));
  }, [filteredData]);

  const basisData = useMemo(() => {
    return filteredData.map(e => ({
      name: e.name.split(' ')[0],
      basis: parseFloat(calcBasis(e, riskFreeRate).toFixed(1)),
      spread5Y: e.spread5Y,
      zSpread: parseFloat(((e.bondYield5Y - riskFreeRate) * 100).toFixed(1)),
    })).sort((a, b) => b.basis - a.basis);
  }, [filteredData, riskFreeRate]);

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const topWide = filteredData.slice(0, 3).map(e => `${e.name}(${e.spread5Y}bp)`).join(', ');
      const causalEvent = `全球 CDS 市场概况：最宽利差 ${topWide}，土耳其主权 CDS 385bp，意大利 135bp，分析全球信用风险格局和跨市场套利机会`;
      const res = await generateStrategy.mutateAsync({ module: 'WCDS', moduleName: '全球CDS矩阵', causalEvent });
      setAiResult(typeof res.strategy === 'string' ? res.strategy : JSON.stringify(res.strategy));
    } catch { toast.error('AI 分析失败'); }
    finally { setAiLoading(false); }
  };

  const tabs = [
    { id: 'matrix' as const, label: 'CDS 矩阵' },
    { id: 'curves' as const, label: '利差曲线' },
    { id: 'basis' as const, label: 'CDS-债券基差' },
    { id: 'heatmap' as const, label: '热力图' },
    { id: 'ai' as const, label: '🧠 AI 智能体' },
  ];

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <div className="border-b border-[#1a1a2e] bg-[#0d0d1a] px-4 py-2 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="text-purple-400 p-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-purple-400 font-bold text-sm">WCDS</span>
        <span className="text-gray-500 text-xs">全球 CDS 矩阵 · World Credit Default Swap</span>
        <Badge variant="outline" className="text-xs border-purple-800 text-purple-400 ml-auto">
          {filteredData.length} 个实体
        </Badge>
      </div>

      <div className="border-b border-[#1a1a2e] px-4 flex">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-purple-400 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* 过滤器 */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex gap-1 items-center">
            <span className="text-gray-500 text-xs">地区:</span>
            {REGIONS.map(r => (
              <button key={r} onClick={() => setSelectedRegion(r)}
                className={`px-2 py-0.5 text-xs rounded border ${selectedRegion === r ? 'border-purple-500 text-purple-400 bg-purple-950' : 'border-gray-700 text-gray-500'}`}>
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-gray-500 text-xs">类型:</span>
            {TYPES.map(t => (
              <button key={t} onClick={() => setSelectedType(t)}
                className={`px-2 py-0.5 text-xs rounded border ${selectedType === t ? 'border-purple-500 text-purple-400 bg-purple-950' : 'border-gray-700 text-gray-500'}`}>
                {t === 'sovereign' ? '主权' : t === 'corp' ? '企业' : t}
              </button>
            ))}
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-gray-500 text-xs">排序:</span>
            {[{ k: 'spread', l: '利差' }, { k: 'change', l: '日变动' }, { k: 'rating', l: '评级' }].map(({ k, l }) => (
              <button key={k} onClick={() => setSortBy(k as 'spread' | 'change' | 'rating')}
                className={`px-2 py-0.5 text-xs rounded border ${sortBy === k ? 'border-purple-500 text-purple-400 bg-purple-950' : 'border-gray-700 text-gray-500'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'matrix' && (
          <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
            <div className="text-purple-400 text-xs font-bold mb-2">全球 CDS 利差矩阵（bp）</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#1a1a2e]">
                    {['实体', '国家', '类型', '评级', '1Y', '3Y', '5Y', '10Y', '日变动', '5Y债券收益率'].map(h => (
                      <th key={h} className="text-right py-1.5 px-2 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((e, i) => (
                    <tr key={i} className="border-b border-[#0d0d1a] hover:bg-[#1a1a2e]/30">
                      <td className="py-1.5 px-2 text-gray-200 font-medium">{e.name}</td>
                      <td className="py-1.5 px-2 text-right text-gray-400">{e.country}</td>
                      <td className="py-1.5 px-2 text-right">
                        <span className={`text-xs px-1 rounded ${e.type === 'sovereign' ? 'text-blue-400 bg-blue-950' : 'text-orange-400 bg-orange-950'}`}>
                          {e.type === 'sovereign' ? '主权' : '企业'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-300">{e.rating}</td>
                      {[e.spread1Y, e.spread3Y, e.spread5Y, e.spread10Y].map((s, j) => (
                        <td key={j} className="py-1.5 px-2 text-right font-mono font-bold" style={{ color: spreadToColor(s) }}>{s}</td>
                      ))}
                      <td className={`py-1.5 px-2 text-right font-mono ${e.change1D >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {e.change1D >= 0 ? '+' : ''}{e.change1D}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-300 font-mono">{e.bondYield5Y}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-4 text-xs">
              <span className="text-gray-500">颜色图例：</span>
              {[{ color: '#22c55e', label: '<30bp 低风险' }, { color: '#84cc16', label: '30-80bp' }, { color: '#f59e0b', label: '80-150bp' }, { color: '#ef4444', label: '150-250bp' }, { color: '#dc2626', label: '>250bp 高风险' }].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ background: color }} />
                  <span className="text-gray-400">{label}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'curves' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-purple-400 text-xs font-bold mb-1">CDS 期限结构曲线（前6个实体）</div>
              <div className="text-gray-500 text-xs mb-2">横轴：期限，纵轴：CDS 利差（bp）</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
    <LineChart data={[
                      { tenor: '1Y', ...Object.fromEntries(filteredData.slice(0,6).map(e => [e.name.split(' ')[0], e.spread1Y])) },
                      { tenor: '3Y', ...Object.fromEntries(filteredData.slice(0,6).map(e => [e.name.split(' ')[0], e.spread3Y])) },
                      { tenor: '5Y', ...Object.fromEntries(filteredData.slice(0,6).map(e => [e.name.split(' ')[0], e.spread5Y])) },
                      { tenor: '10Y', ...Object.fromEntries(filteredData.slice(0,6).map(e => [e.name.split(' ')[0], e.spread10Y])) },
                    ]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="tenor" tick={{ fill: '#6b7280', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => `${v}bp`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 9 }} formatter={(v: number) => [`${v}bp`, '']} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    {filteredData.slice(0, 6).map((e, i) => (
                      <Line key={e.name} type="monotone" dataKey={e.name.split(' ')[0]} stroke={COLORS[i]} strokeWidth={1.5} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-purple-400 text-xs font-bold mb-2">5Y CDS 利差排名</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredData.slice(0, 10).map(e => ({ name: e.name.split(' ')[0], spread: e.spread5Y, change: e.change1D }))} layout="vertical" margin={{ top: 5, right: 60, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 8 }} tickFormatter={v => `${v}bp`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 8 }} width={55} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 9 }} formatter={(v: number) => [`${v}bp`, '5Y CDS']} />
                    <Bar dataKey="spread" name="5Y CDS" fill="#a855f7" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'basis' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-purple-400 text-xs font-bold mb-1">CDS-债券基差 = CDS利差 - Z-Spread</div>
              <div className="text-gray-500 text-xs mb-2">正基差：CDS偏贵（卖CDS机会）；负基差：债券偏贵（买CDS机会）</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={basisData} layout="vertical" margin={{ top: 5, right: 60, left: 70, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 8 }} tickFormatter={v => `${v}bp`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 8 }} width={65} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 9 }} formatter={(v: number) => [`${v}bp`, '']} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Bar dataKey="spread5Y" name="CDS利差" fill="#a855f7" radius={[0, 2, 2, 0]} />
                    <Bar dataKey="zSpread" name="Z-Spread" fill="#3b82f6" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-purple-400 text-xs font-bold mb-2">基差明细表</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#1a1a2e]">
                      {['实体', 'CDS利差(bp)', 'Z-Spread(bp)', '基差(bp)', '套利信号'].map(h => (
                        <th key={h} className="text-right py-1 px-2 first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {basisData.map((d, i) => (
                      <tr key={i} className="border-b border-[#0d0d1a] hover:bg-[#1a1a2e]/30">
                        <td className="py-1 px-2 text-gray-200">{d.name}</td>
                        <td className="py-1 px-2 text-right text-purple-400 font-mono">{d.spread5Y}</td>
                        <td className="py-1 px-2 text-right text-blue-400 font-mono">{d.zSpread}</td>
                        <td className={`py-1 px-2 text-right font-mono font-bold ${d.basis > 10 ? 'text-red-400' : d.basis < -10 ? 'text-green-400' : 'text-gray-300'}`}>
                          {d.basis > 0 ? '+' : ''}{d.basis}
                        </td>
                        <td className="py-1 px-2 text-right">
                          {d.basis > 20 ? <span className="text-red-400 text-xs">卖CDS机会</span> :
                            d.basis < -20 ? <span className="text-green-400 text-xs">买CDS机会</span> :
                              <span className="text-gray-500 text-xs">中性</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
              <div className="text-purple-400 text-xs font-bold mb-1">全球信用热力图（5Y CDS 利差）</div>
              <div className="text-gray-500 text-xs mb-3">颜色越红表示信用风险越高</div>
              <div className="grid gap-2">
                {['Americas', 'Europe', 'Asia'].map(region => (
                  <div key={region}>
                    <div className="text-gray-500 text-xs mb-1">{region}</div>
                    <div className="flex flex-wrap gap-2">
                      {GLOBAL_CDS_DATA.filter(e => e.region === region).map((e, i) => (
                        <div key={i} className="rounded p-2 min-w-[100px] text-center border border-gray-800"
                          style={{ background: `${spreadToColor(e.spread5Y)}20`, borderColor: spreadToColor(e.spread5Y) }}>
                          <div className="text-xs font-bold" style={{ color: spreadToColor(e.spread5Y) }}>{e.name.split(' ')[0]}</div>
                          <div className="text-lg font-bold font-mono" style={{ color: spreadToColor(e.spread5Y) }}>{e.spread5Y}</div>
                          <div className="text-gray-500 text-xs">{e.rating}</div>
                          <div className={`text-xs font-mono ${e.change1D >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {e.change1D >= 0 ? '▲' : '▼'}{Math.abs(e.change1D)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '最宽利差', value: `${Math.max(...GLOBAL_CDS_DATA.map(e => e.spread5Y))}bp`, sub: GLOBAL_CDS_DATA.find(e => e.spread5Y === Math.max(...GLOBAL_CDS_DATA.map(e => e.spread5Y)))?.name || '', color: 'text-red-400' },
                { label: '最窄利差', value: `${Math.min(...GLOBAL_CDS_DATA.map(e => e.spread5Y))}bp`, sub: GLOBAL_CDS_DATA.find(e => e.spread5Y === Math.min(...GLOBAL_CDS_DATA.map(e => e.spread5Y)))?.name || '', color: 'text-green-400' },
                { label: '平均利差', value: `${(GLOBAL_CDS_DATA.reduce((s, e) => s + e.spread5Y, 0) / GLOBAL_CDS_DATA.length).toFixed(0)}bp`, sub: '全球平均', color: 'text-yellow-400' },
                { label: '最大日变动', value: `+${Math.max(...GLOBAL_CDS_DATA.map(e => e.change1D))}bp`, sub: GLOBAL_CDS_DATA.find(e => e.change1D === Math.max(...GLOBAL_CDS_DATA.map(e => e.change1D)))?.name || '', color: 'text-orange-400' },
              ].map(item => (
                <Card key={item.label} className="bg-[#0d0d1a] border-[#1a1a2e] p-2 text-center">
                  <div className="text-gray-500 text-xs">{item.label}</div>
                  <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
                  <div className="text-gray-600 text-xs">{item.sub}</div>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '感知层（全球信用信号）', items: ['土耳其主权 CDS 385bp，高风险警报', '意大利 135bp，欧债风险溢价上升', '美国主权 22bp，信用质量稳健', '新兴市场利差普遍扩大'] },
                { label: '推理层（跨市场因果链）', items: ['美联储加息 → 新兴市场资金外流 → 利差扩大', '欧洲银行业压力 → 德意志银行 CDS 上升', '中国经济放缓 → 亚洲信用风险上升', 'CDS-债券基差为正 → 套利机会存在'] },
                { label: '执行层（全球信用策略）', items: ['做空高风险主权 CDS（土耳其、巴西）', '做多投资级企业 CDS（苹果、丰田）', '利用 CDS-债券基差套利', '地区轮动：减持新兴市场，增持发达市场'] },
              ].map(panel => (
                <Card key={panel.label} className="bg-[#0d0d1a] border-[#1a1a2e] p-3">
                  <div className="text-purple-400 text-xs font-bold mb-2">{panel.label}</div>
                  <ul className="space-y-1">
                    {panel.items.map((item, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                        <span className="text-purple-500 mt-0.5">›</span>{item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0d0d1a] border-[#1a1a2e] p-4">
              <div className="text-purple-400 text-xs font-bold mb-3">AI 全球信用分析</div>
              <Button onClick={handleAI} disabled={aiLoading}
                className="bg-purple-700 hover:bg-purple-600 text-white text-xs h-8 px-4 mb-3">
                {aiLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                {aiLoading ? '分析中...' : '生成全球信用策略报告'}
              </Button>
              {aiResult ? (
                <div className="bg-[#0a0a0a] rounded border border-[#1a1a2e] p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{aiResult}</div>
              ) : (
                <div className="text-gray-600 text-xs text-center py-4">点击按钮，AI 将基于全球 CDS 数据给出跨市场信用策略建议</div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

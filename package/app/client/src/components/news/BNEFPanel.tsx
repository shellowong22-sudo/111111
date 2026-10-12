import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend, LineChart, Line, AreaChart, Area, Cell, ReferenceLine
} from 'recharts';
import { Zap, TrendingDown, Globe, DollarSign } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';

const CLEAN_ENERGY_INVESTMENT = [
  { year: '2019', solar: 148, wind: 142, storage: 5, ev: 47, total: 342 },
  { year: '2020', solar: 148, wind: 142, storage: 6, ev: 52, total: 348 },
  { year: '2021', solar: 168, wind: 158, storage: 9, ev: 78, total: 413 },
  { year: '2022', solar: 228, wind: 175, storage: 15, ev: 118, total: 536 },
  { year: '2023', solar: 318, wind: 198, storage: 35, ev: 178, total: 729 },
  { year: '2024', solar: 385, wind: 218, storage: 62, ev: 245, total: 910 },
  { year: '2025', solar: 445, wind: 235, storage: 95, ev: 312, total: 1087 },
  { year: '2026E', solar: 520, wind: 258, storage: 142, ev: 385, total: 1305 },
];

const TECH_COST_CURVE = [
  { year: '2010', solar_lcoe: 378, wind_lcoe: 135, battery: 1200, ev_battery: 1100 },
  { year: '2012', solar_lcoe: 280, wind_lcoe: 118, battery: 850, ev_battery: 780 },
  { year: '2014', solar_lcoe: 185, wind_lcoe: 102, battery: 580, ev_battery: 540 },
  { year: '2016', solar_lcoe: 100, wind_lcoe: 88, battery: 320, ev_battery: 295 },
  { year: '2018', solar_lcoe: 62, wind_lcoe: 72, battery: 185, ev_battery: 175 },
  { year: '2020', solar_lcoe: 40, wind_lcoe: 62, battery: 137, ev_battery: 128 },
  { year: '2022', solar_lcoe: 29, wind_lcoe: 52, battery: 152, ev_battery: 138 },
  { year: '2024', solar_lcoe: 22, wind_lcoe: 48, battery: 115, ev_battery: 105 },
  { year: '2026E', solar_lcoe: 18, wind_lcoe: 44, battery: 92, ev_battery: 85 },
];

const POLICY_IMPACT = [
  { country: '美国（IRA）', subsidy: 369, jobs: 280000, capacity_gw: 85, score: 92 },
  { country: '欧盟（绿色协议）', subsidy: 280, jobs: 185000, capacity_gw: 62, score: 85 },
  { country: '中国（14五）', subsidy: 520, jobs: 680000, capacity_gw: 185, score: 95 },
  { country: '印度（MNRE）', subsidy: 48, jobs: 95000, capacity_gw: 28, score: 72 },
  { country: '日本（GX）', subsidy: 35, jobs: 42000, capacity_gw: 18, score: 65 },
];

const BNEF_STOCKS = [
  { ticker: 'ENPH', name: 'Enphase Energy', perf_ytd: -28.5, pe: 18.2, sector: '太阳能' },
  { ticker: 'NEE', name: 'NextEra Energy', perf_ytd: 8.2, pe: 22.5, sector: '可再生' },
  { ticker: 'FSLR', name: 'First Solar', perf_ytd: 15.8, pe: 14.8, sector: '太阳能' },
  { ticker: 'PLUG', name: 'Plug Power', perf_ytd: -45.2, pe: -8.5, sector: '氢能' },
  { ticker: 'RIVN', name: 'Rivian', perf_ytd: -22.8, pe: -12.4, sector: '电动车' },
  { ticker: 'BEP', name: 'Brookfield Renew', perf_ytd: 12.5, pe: 28.4, sector: '可再生' },
];

export default function BNEFPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('investment');
  const loading = useChartLoading(600);
  return (
    <div className="h-full flex flex-col bg-[#060a08] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-900/40 bg-[#090e0b] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 font-bold text-sm">BNEF</span>
          <span className="text-gray-500">佑诚新能源研究 · 清洁能源投资 · 技术成本 · 政策分析</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#090e0b] border-b border-emerald-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'investment',label:'清洁能源投资'},
            {id:'cost',label:'技术成本曲线'},
            {id:'policy',label:'政策影响'},
            {id:'stocks',label:'相关标的'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-emerald-900/40 data-[state=active]:text-emerald-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="investment" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">全球清洁能源投资（十亿美元）2019-2026E</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={CLEAN_ENERGY_INVESTMENT}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 9 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <Bar dataKey="solar" name="太阳能" stackId="a" fill="#f59e0b" fillOpacity={0.8} />
                <Bar dataKey="wind" name="风能" stackId="a" fill="#3b82f6" fillOpacity={0.8} />
                <Bar dataKey="storage" name="储能" stackId="a" fill="#a855f7" fillOpacity={0.8} />
                <Bar dataKey="ev" name="电动车" stackId="a" fill="#22c55e" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="cost" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">清洁能源技术成本曲线（$/MWh 或 $/kWh）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={TECH_COST_CURVE}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 9 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <Line type="monotone" dataKey="solar_lcoe" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="光伏LCOE($/MWh)" />
                <Line type="monotone" dataKey="wind_lcoe" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="陆风LCOE($/MWh)" />
                <Line type="monotone" dataKey="battery" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} name="储能($/kWh)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="policy" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">主要国家清洁能源政策影响评估</div>
          <div className="space-y-2">
            {POLICY_IMPACT.map((p, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2.5 border border-gray-800/50">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-white font-medium flex-1">{p.country}</span>
                  <span className="text-emerald-400 font-bold text-base">{p.score}</span>
                  <span className="text-gray-500 text-xs">政策评分</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-gray-500">补贴: </span><span className="text-yellow-400">${p.subsidy}B</span></div>
                  <div><span className="text-gray-500">就业: </span><span className="text-blue-400">{(p.jobs/1000).toFixed(0)}K</span></div>
                  <div><span className="text-gray-500">装机: </span><span className="text-green-400">{p.capacity_gw}GW</span></div>
                </div>
                <div className="mt-1.5 bg-gray-800 rounded-full h-1">
                  <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${p.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stocks" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">清洁能源相关标的表现（YTD涨跌幅）</div>
          <div className="space-y-2">
            {BNEF_STOCKS.map((s, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2 flex items-center gap-3">
                <span className="text-emerald-400 font-bold w-12">{s.ticker}</span>
                <div className="flex-1">
                  <div className="text-white text-xs">{s.name}</div>
                  <div className="text-gray-500 text-xs">{s.sector} · P/E {s.pe}</div>
                </div>
                <div className="font-bold text-sm" style={{ color: s.perf_ytd >= 0 ? '#22c55e' : '#ef4444' }}>
                  {s.perf_ytd >= 0 ? '+' : ''}{s.perf_ytd}%
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

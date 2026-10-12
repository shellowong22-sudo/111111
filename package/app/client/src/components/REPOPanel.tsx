import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import { useState } from 'react';
import { X } from 'lucide-react';

interface REPOPanelProps {
  onClose?: () => void;
}

const repoRates = [
  { collateral: '美国国债', tenor: 'O/N', rate: 5.28, chg: -0.02, vol: 2842, type: 'GC' },
  { collateral: '美国国债', tenor: 'T/N', rate: 5.29, chg: -0.01, vol: 1284, type: 'GC' },
  { collateral: '美国国债', tenor: '1W', rate: 5.26, chg: -0.02, vol: 842, type: 'GC' },
  { collateral: '美国国债', tenor: '1M', rate: 5.22, chg: -0.03, vol: 624, type: 'GC' },
  { collateral: '美国国债', tenor: '3M', rate: 5.18, chg: -0.04, vol: 412, type: 'GC' },
  { collateral: '德国国债', tenor: 'O/N', rate: 3.82, chg: -0.01, vol: 1242, type: 'GC' },
  { collateral: '德国国债', tenor: 'T/N', rate: 3.83, chg: -0.01, vol: 684, type: 'GC' },
  { collateral: '德国国债', tenor: '1W', rate: 3.80, chg: -0.02, vol: 424, type: 'GC' },
  { collateral: '英国国债', tenor: 'O/N', rate: 5.12, chg: -0.01, vol: 842, type: 'GC' },
  { collateral: '英国国债', tenor: 'T/N', rate: 5.13, chg: -0.01, vol: 524, type: 'GC' },
  { collateral: '日本国债', tenor: 'O/N', rate: 0.06, chg: 0.00, vol: 3842, type: 'GC' },
  { collateral: '日本国债', tenor: 'T/N', rate: 0.06, chg: 0.00, vol: 2124, type: 'GC' },
  { collateral: '中国国债', tenor: 'O/N', rate: 1.68, chg: -0.02, vol: 5842, type: 'GC' },
  { collateral: '中国国债', tenor: '7天', rate: 1.72, chg: -0.01, vol: 3242, type: 'GC' },
];

const specialRepos = [
  { isin: 'US912810TM57', desc: '美国10年期国债 4.625% 2034', rate: 4.82, specialness: 46, vol: 12.4 },
  { isin: 'US912810TL74', desc: '美国30年期国债 4.750% 2053', rate: 4.68, specialness: 60, vol: 8.2 },
  { isin: 'DE0001102580', desc: '德国10年期国债 2.600% 2034', rate: 2.84, specialness: 98, vol: 6.8 },
  { isin: 'GB00BBJNQY21', desc: '英国10年期国债 4.250% 2034', rate: 4.42, specialness: 70, vol: 5.4 },
  { isin: 'JP1201011M46', desc: '日本10年期国债 0.800% 2034', rate: -0.08, specialness: 100, vol: 18.2 },
];

export default function REPOPanel({ onClose }: REPOPanelProps) {
  const [activeTab, setActiveTab] = useState<'gc' | 'special' | 'triparty'>('gc');
  const loading = useChartLoading(600);
  const [collateralFilter, setCollateralFilter] = useState('全部');
  const [vizTab, setVizTab] = useState<'rate_compare' | 'volume_dist' | 'collateral_analysis'>('rate_compare'); // 新增可视化模块的tab状态

  const collaterals = ['全部', '美国国债', '德国国债', '英国国债', '日本国债', '中国国债'];
  const filtered = repoRates.filter(r => collateralFilter === '全部' || r.collateral === collateralFilter);

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono text-xs">
      <div className="flex items-center justify-between bg-[#1a1a2a] px-3 py-1.5 border-b border-indigo-900">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-indigo-300">REPO</span>
          <span className="text-gray-300">回购市场行情</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-300 hover:text-white"><X className="w-4 h-4" /></button>}
      </div>

      <div className="flex border-b border-gray-700 bg-[#0a0a0a]">
        {[['gc', '一般抵押(GC)'], ['special', '特殊回购'], ['triparty', '三方回购']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={`px-4 py-1.5 text-xs border-r border-gray-700 ${activeTab === id ? 'bg-indigo-900/40 text-indigo-300' : 'text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'gc' && (
        <>
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-700 bg-[#0d0d0d] overflow-x-auto">
            <span className="text-gray-500 mr-1">抵押品:</span>
            {collaterals.map(c => (
              <button key={c} onClick={() => setCollateralFilter(c)}
                className={`px-2 py-0.5 text-xs border whitespace-nowrap ${collateralFilter === c ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-400 border-gray-700 hover:border-indigo-400'}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#111]">
                <tr className="border-b border-gray-700">
                  <th className="text-left px-3 py-1.5 text-gray-500">抵押品</th>
                  <th className="text-left px-3 py-1.5 text-gray-500">期限</th>
                  <th className="text-right px-3 py-1.5 text-gray-500">回购利率%</th>
                  <th className="text-right px-3 py-1.5 text-gray-500">变动(bps)</th>
                  <th className="text-right px-3 py-1.5 text-gray-500">成交量(亿)</th>
                  <th className="text-center px-3 py-1.5 text-gray-500">类型</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={`${row.collateral}-${row.tenor}`} className={`border-b border-gray-800 hover:bg-[#111] ${i % 2 === 0 ? 'bg-[#050505]' : 'bg-black'}`}>
                    <td className="px-3 py-1.5 text-yellow-400 font-bold">{row.collateral}</td>
                    <td className="px-3 py-1.5 text-gray-300">{row.tenor}</td>
                    <td className="px-3 py-1.5 text-right text-white font-bold">{row.rate.toFixed(2)}</td>
                    <td className={`px-3 py-1.5 text-right font-bold ${row.chg >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {row.chg >= 0 ? '+' : ''}{(row.chg * 100).toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300">{row.vol}</td>
                    <td className="px-3 py-1.5 text-center text-blue-400">{row.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'special' && (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#111]">
              <tr className="border-b border-gray-700">
                <th className="text-left px-3 py-1.5 text-gray-500">ISIN</th>
                <th className="text-left px-3 py-1.5 text-gray-500">债券描述</th>
                <th className="text-right px-3 py-1.5 text-gray-500">特殊回购利率%</th>
                <th className="text-right px-3 py-1.5 text-gray-500">特殊性(bps)</th>
                <th className="text-right px-3 py-1.5 text-gray-500">成交量(亿)</th>
              </tr>
            </thead>
            <tbody>
              {specialRepos.map((row, i) => (
                <tr key={row.isin} className={`border-b border-gray-800 hover:bg-[#111] ${i % 2 === 0 ? 'bg-[#050505]' : 'bg-black'}`}>
                  <td className="px-3 py-1.5 text-yellow-400 font-bold">{row.isin}</td>
                  <td className="px-3 py-1.5 text-gray-300">{row.desc}</td>
                  <td className={`px-3 py-1.5 text-right font-bold ${row.rate < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {row.rate.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-orange-400 font-bold">{row.specialness}</td>
                  <td className="px-3 py-1.5 text-right text-gray-300">{row.vol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'triparty' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { agent: 'BNY Mellon', vol: '$2.84兆', share: '42%', rate: 5.26 },
              { agent: 'JPMorgan', vol: '$2.12兆', share: '31%', rate: 5.27 },
              { agent: 'Euroclear', vol: '€1.24兆', share: '27%', rate: 3.81 },
            ].map(a => (
              <div key={a.agent} className="bg-[#0a0a0a] border border-gray-700 p-3">
                <div className="text-indigo-300 font-bold mb-1">{a.agent}</div>
                <div className="text-white text-lg font-bold">{a.vol}</div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">市场份额</span>
                  <span className="text-yellow-400">{a.share}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">加权利率</span>
                  <span className="text-green-400">{a.rate.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-gray-400 text-center py-8">三方回购详细数据需连接清算机构数据源</div>
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1 border-t border-gray-800 bg-[#0a0a0a] text-gray-600 text-xs">
        <span>REPO — 回购市场行情</span>
        <span>{new Date().toLocaleTimeString('zh-CN')}</span>
      </div>

      {/* 新增的深度可视化模块 */}
      <div className="mt-4 p-4 bg-[#0d1117] border-t border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-purple-300">REPO利率市场深度分析仪</h3>
        </div>

        <div className="flex border-b border-gray-700 mb-4">
          {[["rate_compare", "利率对比"], ["volume_dist", "成交量"], ["collateral_analysis", "担保品分析"]].map(([id, label]) => (
            <button key={id} onClick={() => setVizTab(id as any)}
              className={`px-4 py-2 text-sm ${vizTab === id ? "bg-indigo-900/40 text-indigo-300 border-b-2 border-indigo-500" : "text-gray-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {vizTab === "rate_compare" && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalRatesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSOFR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBGCR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTGCR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ffc658" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ color: '#e5e7eb' }} />
                <Area type="monotone" dataKey="SOFR" stroke="#8884d8" fillOpacity={1} fill="url(#colorSOFR)" name="SOFR" />
                <Area type="monotone" dataKey="BGCR" stroke="#82ca9d" fillOpacity={1} fill="url(#colorBGCR)" name="BGCR" />
                <Area type="monotone" dataKey="TGCR" stroke="#ffc658" fillOpacity={1} fill="url(#colorTGCR)" name="TGCR" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {vizTab === "volume_dist" && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={volumeRateData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                <XAxis dataKey="collateral" stroke="#6b7280" />
                <YAxis yAxisId="left" stroke="#6b7280" label={{ value: '成交量 (亿)', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" label={{ value: '利率 (%)', angle: 90, position: 'insideRight', fill: '#6b7280' }} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ color: '#e5e7eb' }} />
                <Bar yAxisId="left" dataKey="volume" fill="#4f46e5" name="成交量" />
                <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#ef4444" name="平均利率" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {vizTab === "collateral_analysis" && (
          <div className="h-64 p-4 text-gray-300 overflow-auto">
            <h4 className="text-md font-semibold text-indigo-300 mb-3">主要担保品市场份额</h4>
            <ul className="list-disc list-inside">
              {collateralAnalysisData.map((item, index) => (
                <li key={index} className="mb-1">
                  <span className="font-bold text-white">{item.collateral}:</span> {item.share} - <span className="text-green-400">{item.details}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-gray-500">注：担保品分析数据基于市场公开信息和估算。</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Recharts imports
import { AreaChart, Area, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// Lucide-react imports for icons
import { TrendingUp } from 'lucide-react';

// 新增数据
const historicalRatesData = [
  { date: '2023-01', SOFR: 4.3, BGCR: 4.25, TGCR: 4.28 },
  { date: '2023-02', SOFR: 4.4, BGCR: 4.35, TGCR: 4.38 },
  { date: '2023-03', SOFR: 4.5, BGCR: 4.45, TGCR: 4.48 },
  { date: '2023-04', SOFR: 4.6, BGCR: 4.55, TGCR: 4.58 },
  { date: '2023-05', SOFR: 4.7, BGCR: 4.65, TGCR: 4.68 },
  { date: '2023-06', SOFR: 4.8, BGCR: 4.75, TGCR: 4.78 },
  { date: '2023-07', SOFR: 4.9, BGCR: 4.85, TGCR: 4.88 },
  { date: '2023-08', SOFR: 5.0, BGCR: 4.95, TGCR: 4.98 },
  { date: '2023-09', SOFR: 5.1, BGCR: 5.05, TGCR: 5.08 },
  { date: '2023-10', SOFR: 5.2, BGCR: 5.15, TGCR: 5.18 },
  { date: '2023-11', SOFR: 5.25, BGCR: 5.2, TGCR: 5.23 },
  { date: '2023-12', SOFR: 5.3, BGCR: 5.25, TGCR: 5.28 },
  { date: '2024-01', SOFR: 5.35, BGCR: 5.3, TGCR: 5.33 },
  { date: '2024-02', SOFR: 5.3, BGCR: 5.25, TGCR: 5.28 },
  { date: '2024-03', SOFR: 5.25, BGCR: 5.2, TGCR: 5.23 },
  { date: '2024-04', SOFR: 5.2, BGCR: 5.15, TGCR: 5.18 },
  { date: '2024-05', SOFR: 5.15, BGCR: 5.1, TGCR: 5.13 },
  { date: '2024-06', SOFR: 5.1, BGCR: 5.05, TGCR: 5.08 },
];

const volumeRateData = [
  { collateral: '美国国债', volume: 2800, rate: 5.25 },
  { collateral: '德国国债', volume: 1200, rate: 3.85 },
  { collateral: '英国国债', volume: 800, rate: 5.15 },
  { collateral: '日本国债', volume: 3500, rate: 0.05 },
  { collateral: '中国国债', volume: 5500, rate: 1.70 },
  { collateral: '公司债', volume: 1500, rate: 6.00 },
  { collateral: 'MBS', volume: 1000, rate: 5.50 },
];

const collateralAnalysisData = [
  { collateral: '美国国债', share: '45%', details: '全球最活跃的担保品，流动性极佳。' },
  { collateral: '德国国债', share: '15%', details: '欧元区核心担保品，受欧洲央行政策影响。' },
  { collateral: '日本国债', share: '20%', details: '低利率环境下的避险资产，成交量大。' },
  { collateral: '公司债', share: '10%', details: '信用风险较高，但收益率有吸引力。' },
  { collateral: '其他', share: '10%', details: '包括MBS、ABS等，市场份额较小但种类丰富。' },
];
import { useState } from 'react';
import { X, TrendingUp, TrendingDown, BarChart2, RefreshCw, ExternalLink } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { trpc } from '@/lib/trpc';

interface SovereignDetailPanelProps {
  symbol: string;
  name: string;
  currentValue?: number;
  change?: number;
  changePct?: number;
  onClose: () => void;
}

const RANGE_OPTIONS = [
  { label: '5天', value: '5d' as const },
  { label: '1月', value: '1mo' as const },
  { label: '3月', value: '3mo' as const },
  { label: '6月', value: '6mo' as const },
  { label: '1年', value: '1y' as const },
  { label: '2年', value: '2y' as const },
];

export default function SovereignDetailPanel({
  symbol,
  name,
  currentValue,
  change,
  changePct,
  onClose,
}: SovereignDetailPanelProps) {
  const [range, setRange] = useState<'5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y'>('1y');

  const { data: detail, isLoading, refetch } = trpc.sovereignBonds.getTickerDetail.useQuery(
    { symbol, range },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const chartData = detail?.data?.history?.map((p: { date: string; value: number }) => ({
    date: p.date,
    value: p.value,
  })) ?? [];

  const isPositive = (changePct ?? 0) >= 0;
  const minVal = chartData.length > 0 ? Math.min(...chartData.map((d: { value: number }) => d.value)) : 0;
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((d: { value: number }) => d.value)) : 0;
  const avgVal = chartData.length > 0 ? chartData.reduce((s: number, d: { value: number }) => s + d.value, 0) / chartData.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-[720px] max-h-[85vh] bg-[#0d1117] border border-[#2a3a4a] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#161d27] border-b border-[#2a3a4a]">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">{symbol}</span>
                <span className="text-gray-400 text-xs">{name}</span>
              </div>
              {currentValue !== undefined && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white font-mono text-base font-bold">
                    {currentValue.toFixed(3)}
                  </span>
                  {change !== undefined && changePct !== undefined && (
                    <span className={`flex items-center gap-0.5 text-xs font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositive ? '+' : ''}{change.toFixed(3)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://finance.yahoo.com/quote/${symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-blue-400 transition-colors"
              title="在 Yahoo Finance 查看"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => refetch()}
              className="text-gray-500 hover:text-white transition-colors"
              title="刷新数据"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 px-4 py-2 bg-[#0d1117] border-b border-[#1e2a36]">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                range === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#1e2a36]'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-auto text-gray-600 text-xs">
            {detail?.source ?? 'Yahoo Finance'}
          </span>
        </div>

        {/* Chart */}
        <div className="flex-1 p-4 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              加载历史数据中...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              暂无历史数据（Yahoo Finance 可能不支持该标的）
            </div>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a36" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#1e2a36' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#1e2a36' }}
                      tickFormatter={(v: number) => v.toFixed(2)}
                    />
                    <ChartTooltip
                      contentStyle={{ background: '#161d27', border: '1px solid #2a3a4a', borderRadius: 6, fontSize: 11 }}
                      labelStyle={{ color: '#9ca3af' }}
                      formatter={(v: number) => [v.toFixed(4), '价格']}
                    />
                    <ReferenceLine y={avgVal} stroke="#6b7280" strokeDasharray="4 4" label={{ value: '均值', fill: '#6b7280', fontSize: 10 }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={isPositive ? '#22c55e' : '#ef4444'}
                      strokeWidth={1.5}
                      fill="url(#detailGrad)"
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {[
                  { label: '最高', value: maxVal.toFixed(4), color: 'text-green-400' },
                  { label: '最低', value: minVal.toFixed(4), color: 'text-red-400' },
                  { label: '均值', value: avgVal.toFixed(4), color: 'text-blue-400' },
                  { label: '数据点', value: `${chartData.length} 条`, color: 'text-gray-300' },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#161d27] rounded p-3 text-center">
                    <div className={`font-mono font-bold text-sm ${stat.color}`}>{stat.value}</div>
                    <div className="text-gray-500 text-xs mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent data table */}
              <div className="mt-4">
                <div className="text-gray-400 text-xs mb-2">最近 10 条数据</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1e2a36]">
                        <th className="text-left text-gray-500 py-1 pr-4">日期</th>
                        <th className="text-right text-gray-500 py-1">收盘价</th>
                        <th className="text-right text-gray-500 py-1 pl-4">涨跌</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.slice(-10).reverse().map((row: { date: string; value: number }, i: number, arr: { value: number }[]) => {
                        const prev = arr[i + 1]?.value;
                        const chg = prev !== undefined ? row.value - prev : 0;
                        return (
                          <tr key={row.date} className="border-b border-[#1a2230] hover:bg-[#161d27]">
                            <td className="text-gray-400 py-1 pr-4 font-mono">{row.date}</td>
                            <td className="text-right text-white py-1 font-mono">{row.value.toFixed(4)}</td>
                            <td className={`text-right py-1 pl-4 font-mono ${chg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {prev !== undefined ? `${chg >= 0 ? '+' : ''}${chg.toFixed(4)}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#161d27] border-t border-[#2a3a4a] text-xs text-gray-600 flex items-center justify-between">
          <span>数据来源：Yahoo Finance（实时延迟约 15 分钟）</span>
          <span>{detail?.timestamp ? new Date(detail.timestamp).toLocaleString('zh-CN') : ''}</span>
        </div>
      </div>
    </div>
  );
}

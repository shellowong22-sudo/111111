import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import { useState } from 'react';
import { X, Zap, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line, ReferenceLine } from 'recharts';
interface WEIPanelProps { onClose?: () => void; }
const WEI_WEEKLY = [
  { week:'W26', wei:2.85, gdpNow:2.8, atlanta:2.9 },
  { week:'W25', wei:2.65, gdpNow:2.6, atlanta:2.7 },
  { week:'W24', wei:2.45, gdpNow:2.4, atlanta:2.5 },
  { week:'W23', wei:2.20, gdpNow:2.2, atlanta:2.3 },
  { week:'W22', wei:1.95, gdpNow:2.0, atlanta:2.1 },
  { week:'W21', wei:1.75, gdpNow:1.8, atlanta:1.9 },
  { week:'W20', wei:1.55, gdpNow:1.6, atlanta:1.7 },
  { week:'W19', wei:1.35, gdpNow:1.4, atlanta:1.5 },
];
const REGIONAL = [
  { region:'美国', wei:2.85, trend:'加速' },{ region:'欧元区', wei:1.25, trend:'稳定' },
  { region:'中国', wei:3.15, trend:'加速' },{ region:'日本', wei:0.85, trend:'放缓' },
  { region:'英国', wei:1.45, trend:'稳定' },{ region:'新兴市场', wei:2.55, trend:'加速' },
];
export default function WEIPanel({ onClose }: WEIPanelProps) {
  const [tab, setTab] = useState<'weekly'|'global'>('weekly');
  const loading = useChartLoading(600);
  return (
    <div className="flex flex-col h-full bg-[#0a0e1a] text-white text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1220] border-b border-gray-700">
        <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /><span className="font-bold text-sm text-yellow-400">WEI</span><span className="text-gray-300">周度经济指数</span></div>
        {onClose&&<button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-white" /></button>}
      </div>
      <div className="flex gap-1 px-3 py-1.5 border-b border-gray-700">
        {(['weekly','global'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1 rounded text-[10px] font-medium ${tab===t?'bg-yellow-700 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {t==='weekly'?'周度走势':'全球对比'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab==='weekly'&&(
          <div className="p-2">
            <p className="text-xs text-gray-400 mb-1">WEI vs GDPNow vs Atlanta Fed预测</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={WEI_WEEKLY}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" tick={{fill:'#9ca3af',fontSize:9}} />
                <YAxis tick={{fill:'#9ca3af',fontSize:9}} tickFormatter={v=>`${v}%`} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Line type="monotone" dataKey="wei" stroke="#fbbf24" dot={{r:2}} strokeWidth={2} name="WEI" />
                <Line type="monotone" dataKey="gdpNow" stroke="#60a5fa" dot={{r:2}} strokeWidth={2} name="GDPNow" />
                <Line type="monotone" dataKey="atlanta" stroke="#34d399" dot={{r:2}} strokeWidth={2} name="Atlanta Fed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {tab==='global'&&(
          <div className="p-2 space-y-1.5">
            {REGIONAL.map((r,i)=>(
              <div key={i} className="bg-gray-900 rounded p-2 border border-gray-800">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-white font-medium text-[10px]">{r.region}</span>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono font-bold text-[11px] ${r.wei>=2?'text-green-400':r.wei>=1?'text-yellow-400':'text-red-400'}`}>{r.wei.toFixed(2)}%</span>
                    <span className={`px-1 py-0.5 rounded text-[8px] ${r.trend==='加速'?'bg-green-900/40 text-green-300':r.trend==='放缓'?'bg-red-900/40 text-red-300':'bg-yellow-900/40 text-yellow-300'}`}>{r.trend}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.wei>=2?'bg-green-500':r.wei>=1?'bg-yellow-500':'bg-red-500'}`} style={{width:`${Math.min(r.wei/4*100,100)}%`}} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

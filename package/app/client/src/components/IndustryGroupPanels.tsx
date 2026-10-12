import { EnhancedTooltip, CustomCursor, FilterBadge, useChartInteraction, FilterTrigger } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import { useState } from 'react';
import { X, BarChart2, TrendingUp, TrendingDown, Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line, Legend, ReferenceLine, ScatterChart, Scatter, ZAxis } from 'recharts';

// ===== 行业分组分析Panel集合 =====

interface PanelProps { onClose?: () => void; }

const SECTORS = [
  { name:'信息技术', ticker:'XLK', weight:29.5, ytd:+28.5, pe:32.5, fwdPe:28.2, eps:+18.5, color:'#60a5fa', signal:'超配' },
  { name:'医疗健康', ticker:'XLV', weight:12.8, ytd:+8.2, pe:22.1, fwdPe:19.8, eps:+8.2, color:'#34d399', signal:'标配' },
  { name:'金融', ticker:'XLF', weight:13.2, ytd:+15.8, pe:15.8, fwdPe:13.5, eps:+12.5, color:'#f59e0b', signal:'超配' },
  { name:'可选消费', ticker:'XLY', weight:10.5, ytd:+12.5, pe:28.5, fwdPe:24.8, eps:+15.2, color:'#a78bfa', signal:'标配' },
  { name:'通信服务', ticker:'XLC', weight:8.8, ytd:+22.5, pe:25.2, fwdPe:21.5, eps:+14.8, color:'#f87171', signal:'超配' },
  { name:'工业', ticker:'XLI', weight:8.5, ytd:+18.2, pe:22.8, fwdPe:20.1, eps:+10.5, color:'#2dd4bf', signal:'标配' },
  { name:'必需消费', ticker:'XLP', weight:5.8, ytd:+5.5, pe:20.5, fwdPe:18.8, eps:+5.8, color:'#fb923c', signal:'低配' },
  { name:'能源', ticker:'XLE', weight:4.2, ytd:+8.8, pe:12.5, fwdPe:11.2, eps:+5.2, color:'#e2e8f0', signal:'标配' },
];

const ROTATION_DATA = Array.from({length:8},(_,i)=>({
  sector:SECTORS[i].name.slice(0,4),
  momentum: Math.round((Math.sin(i/2)*25+Math.random()*15-7.5)*10)/10,
  relative: Math.round((Math.cos(i/2)*20+Math.random()*12-6)*10)/10,
  size: SECTORS[i].weight,
}));

export function IGSECTPanel({ onClose }: PanelProps) {
  const [sort, setSort] = useState<'ytd'|'pe'|'weight'>('ytd');
  const loading = useChartLoading(600);
  const sorted = [...SECTORS].sort((a,b)=>sort==='ytd'?b.ytd-a.ytd:sort==='pe'?a.pe-b.pe:b.weight-a.weight);
  return (
    <div className="flex flex-col h-full bg-[#0a0e1a] text-white text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1220] border-b border-gray-700">
        <div className="flex items-center gap-2"><BarChart2 className="w-4 h-4 text-blue-400" /><span className="font-bold text-sm text-blue-400">SECT</span><span className="text-gray-300">行业板块表现</span></div>
        {onClose&&<button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-white" /></button>}
      </div>
      <div className="flex gap-1 px-3 py-1.5 border-b border-gray-700">
        {(['ytd','pe','weight'] as const).map(s=>(
          <button key={s} onClick={()=>setSort(s)} className={`px-2 py-1 rounded text-[9px] ${sort===s?'bg-blue-700 text-white':'bg-gray-800 text-gray-400'}`}>
            {s==='ytd'?'YTD排序':s==='pe'?'PE排序':'权重排序'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sorted.map((s,i)=>(
          <div key={i} className="bg-gray-900 rounded p-1.5 border border-gray-800">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{background:s.color}} />
                <span className="text-white font-medium text-[9px]">{s.name}</span>
                <span className="text-gray-500 text-[8px]">{s.ticker}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`font-mono font-bold text-[10px] ${s.ytd>=0?'text-green-400':'text-red-400'}`}>{s.ytd>=0?'+':''}{s.ytd}%</span>
                <span className={`px-1 py-0.5 rounded text-[7px] ${s.signal==='超配'?'bg-green-900/30 text-green-400':s.signal==='低配'?'bg-red-900/30 text-red-400':'bg-gray-700 text-gray-300'}`}>{s.signal}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[8px]">
              <span className="text-gray-500">权重: <span className="text-white">{s.weight}%</span></span>
              <span className="text-gray-500">PE: <span className="text-yellow-400">{s.pe}x</span></span>
              <span className="text-gray-500">EPS增速: <span className="text-blue-400">+{s.eps}%</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IGROTPanel({ onClose }: PanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#0a0e1a] text-white text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1220] border-b border-gray-700">
        <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-400" /><span className="font-bold text-sm text-purple-400">IROT</span><span className="text-gray-300">行业轮动分析</span></div>
        {onClose&&<button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-white" /></button>}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-xs text-gray-400 mb-1">行业动量 vs 相对强度（气泡大小=权重）</p>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="momentum" name="动量" tick={{fill:'#9ca3af',fontSize:9}} label={{value:'动量',fill:'#9ca3af',fontSize:9,position:'insideBottom',offset:-5}} />
            <YAxis dataKey="relative" name="相对强度" tick={{fill:'#9ca3af',fontSize:9}} label={{value:'相对强度',fill:'#9ca3af',fontSize:9,angle:-90,position:'insideLeft'}} />
            <ZAxis dataKey="size" range={[30,200]} />
            <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
            <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
            <Scatter data={ROTATION_DATA} fill="#8b5cf6" />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[8px]">
          <div className="bg-green-950/20 border border-green-800/30 rounded p-1.5">
            <p className="text-green-400 font-bold mb-0.5">领先（右上）</p>
            <p className="text-gray-400">信息技术、通信服务、金融</p>
          </div>
          <div className="bg-yellow-950/20 border border-yellow-800/30 rounded p-1.5">
            <p className="text-yellow-400 font-bold mb-0.5">改善（右下）</p>
            <p className="text-gray-400">工业、可选消费</p>
          </div>
          <div className="bg-red-950/20 border border-red-800/30 rounded p-1.5">
            <p className="text-red-400 font-bold mb-0.5">落后（左下）</p>
            <p className="text-gray-400">必需消费、公用事业</p>
          </div>
          <div className="bg-blue-950/20 border border-blue-800/30 rounded p-1.5">
            <p className="text-blue-400 font-bold mb-0.5">减弱（左上）</p>
            <p className="text-gray-400">能源、材料</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 默认导出主Panel
export default function IndustryGroupPanels({ onClose }: PanelProps) {
  return <IGSECTPanel onClose={onClose} />;
}

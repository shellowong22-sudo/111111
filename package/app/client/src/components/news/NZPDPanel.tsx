import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { Settings, Bell, Globe, User } from 'lucide-react';
import AdminNewsIngestionDesk from './AdminNewsIngestionDesk';

const CONTENT_PREFS = [
  { category: '宏观经济', weight: 90, articles_seen: 284, click_rate: 78 },
  { category: '股票市场', weight: 85, articles_seen: 342, click_rate: 72 },
  { category: 'AI与科技', weight: 95, articles_seen: 198, click_rate: 88 },
  { category: '固定收益', weight: 70, articles_seen: 156, click_rate: 65 },
  { category: '大宗商品', weight: 60, articles_seen: 128, click_rate: 58 },
  { category: '外汇市场', weight: 75, articles_seen: 142, click_rate: 62 },
  { category: '地缘政治', weight: 80, articles_seen: 168, click_rate: 70 },
  { category: '加密货币', weight: 40, articles_seen: 88, click_rate: 45 },
];

const PUSH_SETTINGS = [
  { type: '市场突破事件', enabled: true, frequency: '实时', channels: ['APP','EMAIL'] },
  { type: '重要经济数据', enabled: true, frequency: '实时', channels: ['APP'] },
  { type: '美联储声明', enabled: true, frequency: '实时', channels: ['APP','EMAIL','SMS'] },
  { type: '持仓标的新闻', enabled: true, frequency: '实时', channels: ['APP'] },
  { type: '每日市场摘要', enabled: true, frequency: '每日07:00', channels: ['EMAIL'] },
  { type: '研究报告发布', enabled: false, frequency: '每日', channels: ['APP'] },
  { type: '社交媒体热点', enabled: false, frequency: '每小时', channels: ['APP'] },
];

const RADAR_DATA = [
  { subject: '宏观', A: 90 },
  { subject: '股票', A: 85 },
  { subject: 'AI科技', A: 95 },
  { subject: '固收', A: 70 },
  { subject: '大宗', A: 60 },
  { subject: '外汇', A: 75 },
];

const READING_BEHAVIOR = [
  { hour: '6时', reads: 12 },
  { hour: '7时', reads: 28 },
  { hour: '8时', reads: 45 },
  { hour: '9时', reads: 38 },
  { hour: '10时', reads: 22 },
  { hour: '12时', reads: 18 },
  { hour: '14时', reads: 15 },
  { hour: '16时', reads: 25 },
  { hour: '18时', reads: 20 },
  { hour: '20时', reads: 14 },
  { hour: '22时', reads: 8 },
];

export default function NZPDPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('prefs');
  const loading = useChartLoading(600);
  return (
    <div className="h-full flex flex-col bg-[#080a0d] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-violet-900/40 bg-[#0b0d18] shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-violet-400" />
          <span className="text-violet-400 font-bold text-sm">NZPD</span>
          <span className="text-gray-500">新闻设定 · 内容偏好 · 推送设置 · 阅读行为分析</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#0b0d18] border-b border-violet-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'prefs',label:'内容偏好'},
            {id:'push',label:'推送设置'},
            {id:'radar',label:'偏好雷达'},
            {id:'behavior',label:'阅读行为'},
            {id:'ingestion',label:'采集审核'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-violet-900/40 data-[state=active]:text-violet-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="prefs" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">内容分类偏好权重（基于历史阅读行为自动学习）</div>
          <div className="space-y-2">
            {CONTENT_PREFS.sort((a,b)=>b.weight-a.weight).map((p, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2 border border-gray-800/50">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-white w-20">{p.category}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div className="h-2 rounded-full bg-violet-500" style={{ width: `${p.weight}%` }} />
                  </div>
                  <span className="text-violet-400 font-bold w-6 text-right">{p.weight}</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500 pl-20">
                  <span>已看 {p.articles_seen}篇</span>
                  <span>点击率 {p.click_rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="push" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">推送通知设置</div>
          <div className="space-y-2">
            {PUSH_SETTINGS.map((p, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2.5 border border-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white">{p.type}</span>
                      <span className="text-gray-500 text-xs">· {p.frequency}</span>
                    </div>
                    <div className="flex gap-1">
                      {p.channels.map(c => <span key={c} className="px-1 py-0.5 rounded text-xs bg-gray-800 text-gray-400">{c}</span>)}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <div className="w-8 h-4 rounded-full flex items-center px-0.5" style={{ backgroundColor: p.enabled ? '#7c3aed' : '#374151' }}>
                      <div className="w-3 h-3 rounded-full bg-white transition-transform" style={{ transform: p.enabled ? 'translateX(16px)' : 'translateX(0)' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="radar" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">内容偏好雷达图</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={RADAR_DATA}>
                <PolarGrid stroke="#1f2937" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 8 }} />
                <Radar name="偏好权重" dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
                <Tooltip content={<EnhancedTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">每日阅读时间分布（过去30日平均）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={READING_BEHAVIOR}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 8 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Bar dataKey="reads" name="阅读量" fill="#7c3aed" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-gray-600 text-xs mt-2 text-center">高峰时段：08:00-09:00（盘前）和 16:00-17:00（收盘后）</div>
        </TabsContent>

        <TabsContent value="ingestion" className="flex-1 overflow-y-auto m-0 p-3">
          <AdminNewsIngestionDesk />
        </TabsContent>
      </Tabs>
    </div>
  );
}

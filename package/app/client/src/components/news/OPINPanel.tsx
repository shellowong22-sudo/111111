import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Legend, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell, ReferenceLine
} from 'recharts';
import { MessageSquare, ThumbsUp, ThumbsDown, Scale } from 'lucide-react';
import { withEventMarkers, useEventMarkers, EventTooltipCard, EventReferenceLines, MARKET_EVENTS } from '@/components/EventMarker';

// 热门观点辩论
const DEBATES = [
  {
    topic: '美联储9月降息25bp',
    bull_pct: 72, bear_pct: 28,
    bull_args: ['通胀持续回落至3.0%', '劳动力市场降温', '实际利率过高'],
    bear_args: ['服务业通胀顽固', '消费依然强劲', '大选前不宜行动'],
    key_analysts: { bull: 'Jan Hatzius (GS)', bear: 'Mohamed El-Erian' },
    market_bet: 'CME FedWatch: 72%概率降息'
  },
  {
    topic: 'NVIDIA估值是否合理',
    bull_pct: 58, bear_pct: 42,
    bull_args: ['AI需求结构性增长', '数据中心支出加速', '护城河极深'],
    bear_args: ['P/E超过40x历史高位', '竞争加剧(AMD/Intel)', '客户资本支出可持续性存疑'],
    key_analysts: { bull: 'Vivek Arya (BofA)', bear: 'Mark Lipacis (Jefferies)' },
    market_bet: '期权市场隐含±8%波动'
  },
  {
    topic: '中国经济能否实现5%增速',
    bull_pct: 45, bear_pct: 55,
    bull_args: ['政策刺激空间充足', '出口超预期强劲', '制造业PMI回升'],
    bear_args: ['房地产持续拖累', '消费信心低迷', '地方债务压力'],
    key_analysts: { bull: 'Nomura China Team', bear: 'Michael Pettis' },
    market_bet: '人民币汇率反映悲观预期'
  },
];

// 观点准确率追踪（历史）
const OPINION_ACCURACY = [
  { analyst: 'Jan Hatzius', correct: 18, total: 24, accuracy: 75, category: '宏观' },
  { analyst: 'Mohamed El-Erian', correct: 14, total: 22, accuracy: 64, category: '宏观' },
  { analyst: 'Vivek Arya', correct: 16, total: 20, accuracy: 80, category: '科技' },
  { analyst: 'Tom Lee', correct: 12, total: 18, accuracy: 67, category: '股市' },
  { analyst: 'Nouriel Roubini', correct: 8, total: 20, accuracy: 40, category: '宏观' },
  { analyst: 'Cathie Wood', correct: 9, total: 22, accuracy: 41, category: '科技' },
];

// 市场共识变化（近6个月）
const CONSENSUS_CHANGE = [
  { month: '1月', bull: 55, bear: 45, neutral: 0 },
  { month: '2月', bull: 62, bear: 38, neutral: 0 },
  { month: '3月', bull: 68, bear: 32, neutral: 0 },
  { month: '4月', bull: 58, bear: 42, neutral: 0 },
  { month: '5月', bull: 65, bear: 35, neutral: 0 },
  { month: '6月', bull: 72, bear: 28, neutral: 0 },
];

// 观点热度（按资产类别）
const OPINION_HEAT = [
  { asset: '美股', bullish: 68, bearish: 32 },
  { asset: '美债', bullish: 72, bearish: 28 },
  { asset: '美元', bullish: 45, bearish: 55 },
  { asset: '黄金', bullish: 62, bearish: 38 },
  { asset: '原油', bullish: 55, bearish: 45 },
  { asset: '新兴市场', bullish: 42, bearish: 58 },
];

export default function OPINPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('debates');
  const loading = useChartLoading(600);
  const [selectedDebate, setSelectedDebate] = useState(0);
  return (
    <div className="h-full flex flex-col bg-[#070a10] text-gray-100 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-900/40 bg-[#090d18] shrink-0">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-bold text-sm">OPIN</span>
          <span className="text-gray-500">佑诚观点 · 多空辩论 · 分析师准确率 · 市场共识</span>
        </div>
        {onClose && <button onClick={onClose} className="text-gray-600 hover:text-gray-300 ml-1">✕</button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 bg-[#090d18] border-b border-cyan-900/30 rounded-none px-2 h-8 gap-1 justify-start overflow-x-auto">
          {[
            {id:'debates',label:'多空辩论'},
            {id:'accuracy',label:'分析师准确率'},
            {id:'consensus',label:'市场共识'},
            {id:'heat',label:'观点热度'},
          ].map(t=>(
            <TabsTrigger key={t.id} value={t.id} className="text-xs px-3 h-6 data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-300 text-gray-500 rounded shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="debates" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="flex gap-1 mb-3 flex-wrap">
            {DEBATES.map((d, i) => (
              <button key={i} onClick={() => setSelectedDebate(i)}
                className={`px-2 py-1 rounded text-xs ${selectedDebate === i ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-300 bg-gray-900/40'}`}>
                {d.topic.slice(0, 10)}...
              </button>
            ))}
          </div>
          {(() => {
            const d = DEBATES[selectedDebate];
            return (
              <div className="space-y-3">
                <div className="bg-gray-900/60 rounded p-3">
                  <div className="text-white font-bold mb-2">{d.topic}</div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div className="h-3 rounded-full bg-green-600 flex items-center justify-end pr-1 text-xs text-white font-bold"
                        style={{ width: `${d.bull_pct}%` }}>{d.bull_pct}%</div>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div className="h-3 rounded-full bg-red-700 flex items-center justify-start pl-1 text-xs text-white font-bold"
                        style={{ width: `${d.bear_pct}%` }}>{d.bear_pct}%</div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs mb-2">
                    <span className="text-green-400">多方: {d.key_analysts.bull}</span>
                    <span className="text-red-400">空方: {d.key_analysts.bear}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-green-400 font-bold mb-1 flex items-center gap-1"><ThumbsUp className="w-3 h-3" />多方论据</div>
                      {d.bull_args.map((a, i) => <div key={i} className="text-gray-400 flex items-start gap-1"><span className="text-green-600">•</span>{a}</div>)}
                    </div>
                    <div>
                      <div className="text-red-400 font-bold mb-1 flex items-center gap-1"><ThumbsDown className="w-3 h-3" />空方论据</div>
                      {d.bear_args.map((a, i) => <div key={i} className="text-gray-400 flex items-start gap-1"><span className="text-red-600">•</span>{a}</div>)}
                    </div>
                  </div>
                  <div className="mt-2 text-amber-400 text-xs border-t border-gray-800 pt-2">市场定价: {d.market_bet}</div>
                </div>
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="accuracy" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">知名分析师观点准确率追踪（近12个月）</div>
          <div className="bg-gray-900/60 rounded p-2 mb-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={OPINION_ACCURACY} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} unit="%" />
                <YAxis dataKey="analyst" type="category" tick={{ fill: '#9ca3af', fontSize: 9 }} width={90} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <ReferenceLine x={50} stroke="#374151" strokeDasharray="3 3" />
                <Bar dataKey="accuracy" name="准确率%" radius={[0,3,3,0]}>
                  {OPINION_ACCURACY.map((e, i) => (
                    <Cell key={i} fill={e.accuracy >= 70 ? '#22c55e' : e.accuracy >= 55 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="consensus" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">市场多空共识变化（近6个月，%）</div>
          <div className="bg-gray-900/60 rounded p-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={CONSENSUS_CHANGE}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} unit="%" />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                <Bar dataKey="bull" name="多方%" stackId="a" fill="#22c55e" fillOpacity={0.8} />
                <Bar dataKey="bear" name="空方%" stackId="a" fill="#ef4444" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="heat" className="flex-1 overflow-y-auto m-0 p-3">
          <div className="text-gray-400 mb-2">各资产类别观点热度（多空比例%）</div>
          <div className="space-y-2">
            {OPINION_HEAT.map((h, i) => (
              <div key={i} className="bg-gray-900/60 rounded px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-cyan-400 font-bold w-20">{h.asset}</span>
                  <span className="text-green-400 text-xs w-12">{h.bullish}%多</span>
                  <span className="text-red-400 text-xs w-12">{h.bearish}%空</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden">
                  <div className="bg-green-600" style={{ width: `${h.bullish}%` }} />
                  <div className="bg-red-700" style={{ width: `${h.bearish}%` }} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
/**
 * IssuanceCalendarPanel — 新发行日历通用组件
 * 支持：月视图日历、发行数据表、统计指标、日期筛选
 */
import { useState, useMemo } from 'react';
import { X, Calendar, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';

interface IssuanceEvent {
  date: string;
  issuer: string;
  size: number; // 百万美元
  coupon: number; // 百分比
  maturity: string; // YYYY格式
  rating: string;
  taxStatus: '免税' | '应税';
  purpose: string;
  callDate: string;
  type: 'CDRN' | 'CDRC' | 'CDRA' | 'CNDS' | 'CDRV'; // 日程类型
}

interface IssuanceCalendarPanelProps {
  title: string;
  code: string;
  accentColor?: string;
  events: IssuanceEvent[];
  onClose?: () => void;
}

const DAYS_OF_WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function IssuanceCalendarPanel({
  title,
  code,
  accentColor = '#f59e0b',
  events,
  onClose,
}: IssuanceCalendarPanelProps) {
  const [view, setView] = useState<'calendar' | 'chart' | 'table'>('calendar');
  const loading = useChartLoading(600);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // 获取当月的事件
  const monthEvents = useMemo(() => {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    return events.filter(e => e.date.startsWith(monthStr));
  }, [events, year, month]);

  // 按日期分组事件
  const eventsByDate = useMemo(() => {
    const map = new Map<string, IssuanceEvent[]>();
    monthEvents.forEach(e => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    });
    return map;
  }, [monthEvents]);

  // 周发行量数据
  const weeklyData = useMemo(() => {
    const weeks: { week: string; volume: number; deals: number }[] = [];
    const now = new Date(year, month, 1);
    let weekNum = 1;
    
    while (now.getMonth() === month) {
      const weekStart = new Date(now);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekEvents = monthEvents.filter(e => {
        const d = new Date(e.date);
        return d >= weekStart && d <= weekEnd;
      });
      
      const volume = weekEvents.reduce((sum, e) => sum + e.size, 0) / 1000; // 转换为十亿
      weeks.push({
        week: `W${weekNum}`,
        volume: parseFloat(volume.toFixed(1)),
        deals: weekEvents.length,
      });
      
      now.setDate(now.getDate() + 7);
      weekNum++;
    }
    
    return weeks;
  }, [monthEvents, year, month]);

  // 统计指标
  const stats = useMemo(() => {
    const totalVolume = monthEvents.reduce((sum, e) => sum + e.size, 0);
    const avgCoupon = monthEvents.length > 0 
      ? monthEvents.reduce((sum, e) => sum + e.coupon, 0) / monthEvents.length 
      : 0;
    const taxExemptCount = monthEvents.filter(e => e.taxStatus === '免税').length;
    const taxExemptRatio = monthEvents.length > 0 ? (taxExemptCount / monthEvents.length * 100) : 0;

    return {
      totalVolume: (totalVolume / 1000).toFixed(1),
      avgCoupon: avgCoupon.toFixed(2),
      dealCount: monthEvents.length,
      taxExemptRatio: taxExemptRatio.toFixed(1),
    };
  }, [monthEvents]);

  // 获取选中日期的事件
  const selectedDateEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  // 生成日历网格
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: accentColor }} />
          <span className="font-mono font-bold text-sm" style={{ color: accentColor }}>{code}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-gray-700">
            {(['calendar', 'chart', 'table'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1 text-xs transition-colors',
                  view === v ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-gray-200'
                )}
              >
                {v === 'calendar' ? '日历' : v === 'chart' ? '图表' : '表格'}
              </button>
            ))}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 统计指标 */}
      <div className="grid grid-cols-4 gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/60 shrink-0">
        {[
          { label: '本月发行量', value: `$${stats.totalVolume}B`, color: accentColor },
          { label: '平均票面利率', value: `${stats.avgCoupon}%`, color: '#22c55e' },
          { label: '发行笔数', value: stats.dealCount, color: '#60a5fa' },
          { label: '免税占比', value: `${stats.taxExemptRatio}%`, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="bg-gray-800/60 rounded p-2 text-center">
            <div className="text-lg font-mono font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[10px] text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {view === 'calendar' && (
          <div className="p-4">
            {/* 日历导航 */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
              <div className="text-center">
                <div className="text-sm font-semibold text-white">
                  {year}年 {MONTHS[month]}
                </div>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* 日历网格 */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {/* 星期标题 */}
              {DAYS_OF_WEEK.map(day => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-gray-400 py-2"
                >
                  {day}
                </div>
              ))}

              {/* 日期 */}
              {calendarDays.map((day, idx) => {
                const dateStr = day
                  ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  : null;
                const dayEvents = dateStr ? (eventsByDate.get(dateStr) || []) : [];
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === new Date().toISOString().split('T')[0];

                return (
                  <button
                    key={idx}
                    onClick={() => dateStr && setSelectedDate(dateStr)}
                    className={cn(
                      'aspect-square rounded border transition-colors flex flex-col items-center justify-center text-xs',
                      !day
                        ? 'bg-transparent border-transparent'
                        : isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : dayEvents.length > 0
                        ? 'bg-gray-800/60 border-gray-700 hover:border-amber-400/50'
                        : isToday
                        ? 'bg-gray-800/30 border-gray-700'
                        : 'bg-gray-800/20 border-gray-800 hover:border-gray-700'
                    )}
                  >
                    {day && (
                      <>
                        <div className="font-semibold text-gray-200">{day}</div>
                        {dayEvents.length > 0 && (
                          <div
                            className="text-[9px] font-mono font-bold mt-0.5"
                            style={{ color: accentColor }}
                          >
                            {dayEvents.length}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 选中日期的事件详情 */}
            {selectedDateEvents.length > 0 && (
              <div className="bg-gray-800/40 rounded border border-gray-700 p-3">
                <div className="text-xs font-semibold text-gray-300 mb-2">
                  {selectedDate} ({selectedDateEvents.length} 笔发行)
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedDateEvents.map((event, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-900/60 rounded p-2 border border-gray-700/50 text-[10px]"
                    >
                      <div className="font-semibold text-white mb-1">{event.issuer}</div>
                      <div className="grid grid-cols-2 gap-1 text-gray-400">
                        <div>规模: <span className="text-green-400">${event.size}M</span></div>
                        <div>利率: <span className="text-amber-300">{event.coupon}%</span></div>
                        <div>评级: <span className="text-gray-300">{event.rating}</span></div>
                        <div>税务: <span className={event.taxStatus === '免税' ? 'text-green-400' : 'text-orange-400'}>{event.taxStatus}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'chart' && (
          <div className="p-4">
            <div className="text-xs text-gray-400 mb-3 font-semibold">
              {year}年{month + 1}月周发行量（十亿美元）
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                <Bar dataKey="volume" name="发行量(B)" radius={[3, 3, 0, 0]}>
                  {weeklyData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === weeklyData.length - 1 ? accentColor : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {view === 'table' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
              <tr>
                {['发行日期', '发行人', '规模(M)', '票面利率', '到期年', '评级', '税务状态', '用途', '赎回日'].map(h => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] text-gray-400 font-semibold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthEvents.map((event, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                  <td className="px-3 py-2 font-mono text-gray-300">{event.date}</td>
                  <td className="px-3 py-2 font-semibold text-white">{event.issuer}</td>
                  <td className="px-3 py-2 font-mono text-right text-green-400">
                    {event.size.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-amber-300">{event.coupon}%</td>
                  <td className="px-3 py-2 font-mono text-gray-300">{event.maturity}</td>
                  <td className="px-3 py-2 font-mono text-gray-300">{event.rating}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-semibold',
                        event.taxStatus === '免税'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-orange-500/20 text-orange-400'
                      )}
                    >
                      {event.taxStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-300">{event.purpose}</td>
                  <td className="px-3 py-2 font-mono text-gray-400">{event.callDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

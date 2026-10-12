/**
 * EventMarker — 图表关键事件节点标记组件库
 *
 * 功能：
 * 1. detectVolatilePoints()  — 自动检测时序数据中的剧烈波动点
 * 2. EventDot               — 自定义 Recharts activeDot/dot，在波动点显示标记图标
 * 3. EventReferenceLines    — 在 Recharts 图表中渲染垂直事件线 + 标签
 * 4. EventTooltipOverlay    — 独立悬浮事件详情卡片
 * 5. useEventMarkers        — Hook，管理事件标记状态（悬浮/选中）
 * 6. MARKET_EVENTS          — 预置市场关键事件库（2024-2026）
 */

import { useState, useCallback, useMemo } from 'react';
import { ReferenceLine } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, Calendar, Zap, DollarSign, BarChart2, Globe, FileText } from 'lucide-react';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────
export type EventCategory =
  | 'fed'        // 美联储决议
  | 'earnings'   // 财报
  | 'macro'      // 宏观数据
  | 'geopolitical' // 地缘政治
  | 'ipo'        // IPO / 上市
  | 'crisis'     // 危机 / 崩盘
  | 'policy'     // 政策变化
  | 'technical'  // 技术突破 / 支撑压力
  | 'custom';    // 自定义

export interface MarketEvent {
  id: string;
  date: string;          // YYYY-MM-DD 或 'MM-DD' 或 'YYYY-MM'
  label: string;         // 简短标签（图表上显示）
  title: string;         // 完整标题（Tooltip 显示）
  description: string;   // 详细说明
  category: EventCategory;
  impact: 'high' | 'medium' | 'low';
  priceChange?: number;  // 事件后价格变化 %
  assets?: string[];     // 相关资产
  source?: string;       // 数据来源
}

export interface VolatilePoint {
  index: number;
  date: string;
  value: number;
  changePercent: number;  // 相对前一点的变化 %
  event?: MarketEvent;    // 匹配到的事件
}

// ─── 预置市场关键事件库 ────────────────────────────────────────────────────────
export const MARKET_EVENTS: MarketEvent[] = [
  // 美联储
  {
    id: 'fed-2024-01',
    date: '2024-01-31',
    label: 'FOMC',
    title: 'FOMC 1月会议 — 维持利率不变',
    description: '联储维持联邦基金利率目标区间5.25%-5.50%不变，暗示降息门槛较高，市场降息预期推迟至6月。',
    category: 'fed',
    impact: 'high',
    priceChange: -1.2,
    assets: ['SPY', 'QQQ', 'TLT', 'DXY'],
    source: 'Federal Reserve',
  },
  {
    id: 'fed-2024-03',
    date: '2024-03-20',
    label: 'FOMC',
    title: 'FOMC 3月会议 — 点阵图暗示3次降息',
    description: '联储维持利率不变，点阵图显示2024年预计降息3次，市场情绪明显改善，科技股大涨。',
    category: 'fed',
    impact: 'high',
    priceChange: 1.8,
    assets: ['SPY', 'QQQ', 'NVDA', 'AAPL'],
    source: 'Federal Reserve',
  },
  {
    id: 'fed-2024-09',
    date: '2024-09-18',
    label: '降息50bp',
    title: 'FOMC 9月会议 — 超预期降息50bp',
    description: '联储意外降息50个基点至4.75%-5.00%，为2020年3月以来首次降息，市场短暂上涨后回落。',
    category: 'fed',
    impact: 'high',
    priceChange: 0.7,
    assets: ['SPY', 'QQQ', 'GLD', 'TLT', 'DXY'],
    source: 'Federal Reserve',
  },
  {
    id: 'fed-2024-11',
    date: '2024-11-07',
    label: '降息25bp',
    title: 'FOMC 11月会议 — 降息25bp',
    description: '联储降息25bp至4.50%-4.75%，鲍威尔表示不急于进一步降息，美元走强。',
    category: 'fed',
    impact: 'high',
    priceChange: -0.4,
    assets: ['SPY', 'DXY', 'GLD'],
    source: 'Federal Reserve',
  },
  {
    id: 'fed-2024-12',
    date: '2024-12-18',
    label: 'FOMC鹰派',
    title: 'FOMC 12月会议 — 鹰派降息，2025预期收紧',
    description: '联储降息25bp，但点阵图大幅上调2025年利率预期，仅预计降息2次，市场大幅下跌。',
    category: 'fed',
    impact: 'high',
    priceChange: -2.9,
    assets: ['SPY', 'QQQ', 'TLT', 'BTC'],
    source: 'Federal Reserve',
  },
  {
    id: 'fed-2025-01',
    date: '2025-01-29',
    label: 'FOMC暂停',
    title: 'FOMC 1月会议 — 暂停降息',
    description: '联储暂停降息周期，维持4.25%-4.50%，强调通胀仍有粘性，就业市场依然强劲。',
    category: 'fed',
    impact: 'medium',
    priceChange: 0.5,
    assets: ['SPY', 'DXY'],
    source: 'Federal Reserve',
  },
  // 财报
  {
    id: 'nvda-q3-2024',
    date: '2024-11-20',
    label: 'NVDA财报',
    title: 'NVIDIA Q3 FY2025 财报 — 营收351亿超预期',
    description: 'NVIDIA Q3营收351亿美元，同比增长94%，数据中心营收308亿，Blackwell芯片需求强劲，盘后涨超4%。',
    category: 'earnings',
    impact: 'high',
    priceChange: 4.2,
    assets: ['NVDA', 'SMH', 'QQQ'],
    source: 'NVIDIA IR',
  },
  {
    id: 'aapl-q1-2025',
    date: '2025-01-30',
    label: 'AAPL财报',
    title: 'Apple Q1 FY2025 财报 — iPhone中国销售承压',
    description: 'Apple营收1243亿美元，EPS 2.40美元均超预期，但大中华区营收下滑11%，盘后小幅下跌。',
    category: 'earnings',
    impact: 'medium',
    priceChange: -1.5,
    assets: ['AAPL', 'QQQ'],
    source: 'Apple IR',
  },
  {
    id: 'meta-q4-2024',
    date: '2025-01-29',
    label: 'META财报',
    title: 'Meta Q4 2024 财报 — 广告收入强劲',
    description: 'Meta营收484亿美元，同比增长21%，MAU达33亿，2025年资本支出指引600-650亿，股价涨超6%。',
    category: 'earnings',
    impact: 'high',
    priceChange: 6.2,
    assets: ['META', 'QQQ'],
    source: 'Meta IR',
  },
  // 宏观数据
  {
    id: 'cpi-2024-03',
    date: '2024-03-12',
    label: 'CPI超预期',
    title: '美国2月CPI — 同比3.2%超预期',
    description: '美国2月CPI同比3.2%，核心CPI同比3.8%，均高于预期，降息预期再度推迟，10年期美债收益率攀升。',
    category: 'macro',
    impact: 'high',
    priceChange: -1.0,
    assets: ['SPY', 'TLT', 'DXY', 'GLD'],
    source: 'BLS',
  },
  {
    id: 'nfp-2024-09',
    date: '2024-09-06',
    label: '非农超预期',
    title: '8月非农就业 — 新增14.2万低于预期',
    description: '8月非农新增14.2万，低于预期16.5万，失业率降至4.2%，市场对经济软着陆担忧加剧，纳指跌超2%。',
    category: 'macro',
    impact: 'high',
    priceChange: -2.1,
    assets: ['SPY', 'QQQ', 'TLT', 'DXY'],
    source: 'BLS',
  },
  {
    id: 'gdp-2025-q1',
    date: '2025-04-30',
    label: 'GDP萎缩',
    title: '美国Q1 2025 GDP — 环比年化-0.3%',
    description: '美国Q1 GDP环比年化萎缩0.3%，为2022年以来首次负增长，主因进口激增（关税抢进口），市场担忧衰退。',
    category: 'macro',
    impact: 'high',
    priceChange: -1.8,
    assets: ['SPY', 'DXY', 'GLD', 'TLT'],
    source: 'BEA',
  },
  // 地缘政治
  {
    id: 'tariff-2025-04',
    date: '2025-04-02',
    label: '关税冲击',
    title: '特朗普宣布"解放日"关税 — 全面加征关税',
    description: '特朗普宣布对全球大多数国家加征10%-50%关税，中国关税升至145%，全球市场暴跌，标普500单日跌逾4%。',
    category: 'geopolitical',
    impact: 'high',
    priceChange: -4.8,
    assets: ['SPY', 'QQQ', 'EEM', 'DXY', 'GLD'],
    source: 'White House',
  },
  {
    id: 'tariff-pause-2025',
    date: '2025-04-09',
    label: '关税暂停',
    title: '特朗普宣布90天关税暂停',
    description: '特朗普宣布对大多数国家暂停90天关税，仅维持对中国145%关税，市场强劲反弹，标普500单日涨超9%。',
    category: 'geopolitical',
    impact: 'high',
    priceChange: 9.5,
    assets: ['SPY', 'QQQ', 'EEM'],
    source: 'White House',
  },
  // 技术性事件
  {
    id: 'sp500-ath-2024',
    date: '2024-01-19',
    label: '历史新高',
    title: '标普500创历史新高 — 突破4800点',
    description: '标普500指数突破4800点，创历史新高，科技股领涨，AI主题持续驱动市场情绪。',
    category: 'technical',
    impact: 'medium',
    priceChange: 1.2,
    assets: ['SPY', 'QQQ', 'NVDA'],
    source: 'Market Data',
  },
  {
    id: 'vix-spike-2024-08',
    date: '2024-08-05',
    label: 'VIX暴涨',
    title: '日元套利交易平仓 — VIX飙升至65',
    description: '日本央行意外加息触发全球套利交易平仓，VIX指数盘中飙升至65，日经225单日跌12%，纳指跌超3%。',
    category: 'crisis',
    impact: 'high',
    priceChange: -3.0,
    assets: ['SPY', 'QQQ', 'VIX', 'JPY', 'USDJPY'],
    source: 'Market Data',
  },
  {
    id: 'deepseek-2025-01',
    date: '2025-01-27',
    label: 'DeepSeek冲击',
    title: 'DeepSeek R1发布 — AI算力股暴跌',
    description: 'DeepSeek R1模型以极低成本媲美GPT-4，引发市场对AI算力需求的质疑，NVDA单日市值蒸发近6000亿美元。',
    category: 'geopolitical',
    impact: 'high',
    priceChange: -17.0,
    assets: ['NVDA', 'SMH', 'QQQ', 'MSFT'],
    source: 'Market Data',
  },
  // 政策
  {
    id: 'ecb-cut-2024-06',
    date: '2024-06-06',
    label: 'ECB降息',
    title: 'ECB首次降息 — 降25bp至4.25%',
    description: '欧洲央行宣布降息25bp，为2019年以来首次降息，但行长拉加德措辞谨慎，欧元小幅下跌。',
    category: 'policy',
    impact: 'medium',
    priceChange: 0.3,
    assets: ['EURUSD', 'EWG', 'EWQ'],
    source: 'ECB',
  },
  {
    id: 'boj-hike-2024-07',
    date: '2024-07-31',
    label: 'BOJ加息',
    title: '日本央行意外加息 — 触发全球波动',
    description: '日本央行将政策利率从0.1%上调至0.25%，并宣布缩减购债规模，触发日元急升和全球套利平仓。',
    category: 'policy',
    impact: 'high',
    priceChange: -2.5,
    assets: ['USDJPY', 'NIKKEI', 'SPY'],
    source: 'Bank of Japan',
  },
];

// ─── 自动波动检测 ─────────────────────────────────────────────────────────────
export interface DetectOptions {
  threshold?: number;      // 触发标记的最小变化幅度 %（默认 2.0）
  maxPoints?: number;      // 最多标记多少个点（默认 5）
  dateField?: string;      // 数据中日期字段名（默认 'date'）
  valueField?: string;     // 数据中数值字段名（默认 'value'）
  events?: MarketEvent[];  // 要匹配的事件列表（默认 MARKET_EVENTS）
}

export function detectVolatilePoints<T extends Record<string, unknown>>(
  data: T[],
  opts?: DetectOptions
): VolatilePoint[] {
  const {
    threshold = 2.0,
    maxPoints = 6,
    dateField = 'date',
    valueField = 'value',
    events = MARKET_EVENTS,
  } = opts ?? {};

  if (data.length < 2) return [];

  const points: VolatilePoint[] = [];

  for (let i = 1; i < data.length; i++) {
    const prev = Number(data[i - 1][valueField]);
    const curr = Number(data[i][valueField]);
    if (isNaN(prev) || isNaN(curr) || prev === 0) continue;

    const changePercent = ((curr - prev) / Math.abs(prev)) * 100;

    if (Math.abs(changePercent) >= threshold) {
      const date = String(data[i][dateField] ?? '');
      // 尝试匹配事件
      const matchedEvent = events.find(e => {
        const ed = e.date.slice(0, 7); // YYYY-MM
        const dd = date.slice(0, 7);
        return ed === dd || e.date === date || date.includes(e.date.slice(5, 10));
      });

      points.push({
        index: i,
        date,
        value: curr,
        changePercent,
        event: matchedEvent,
      });
    }
  }

  // 按绝对变化幅度降序，取前 maxPoints 个
  return points
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, maxPoints)
    .sort((a, b) => a.index - b.index); // 恢复时间顺序
}

// ─── 事件分类配置 ─────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<EventCategory, { color: string; icon: typeof AlertCircle; label: string }> = {
  fed:          { color: '#f59e0b', icon: DollarSign,   label: '央行决议' },
  earnings:     { color: '#34d399', icon: BarChart2,    label: '财报' },
  macro:        { color: '#60a5fa', icon: Globe,        label: '宏观数据' },
  geopolitical: { color: '#f87171', icon: AlertCircle,  label: '地缘政治' },
  ipo:          { color: '#a78bfa', icon: TrendingUp,   label: 'IPO' },
  crisis:       { color: '#ef4444', icon: Zap,          label: '危机' },
  policy:       { color: '#fb923c', icon: FileText,     label: '政策' },
  technical:    { color: '#94a3b8', icon: TrendingUp,   label: '技术' },
  custom:       { color: '#e2e8f0', icon: Calendar,     label: '自定义' },
};

const IMPACT_CONFIG = {
  high:   { size: 10, ring: 2 },
  medium: { size: 8,  ring: 1 },
  low:    { size: 6,  ring: 1 },
};

// ─── EventReferenceLines — 在图表中渲染事件垂直线 ─────────────────────────────
interface EventReferenceLinesProps {
  events: MarketEvent[];
  dataKey?: string;
  onHover?: (event: MarketEvent | null, x?: number, y?: number) => void;
}

export function EventReferenceLines({ events, onHover }: EventReferenceLinesProps) {
  return (
    <>
      {events.map((evt) => {
        const cfg = CATEGORY_CONFIG[evt.category];
        const impactCfg = IMPACT_CONFIG[evt.impact];
        return (
          <ReferenceLine
            key={evt.id}
            x={evt.date}
            stroke={cfg.color}
            strokeWidth={evt.impact === 'high' ? 1.5 : 1}
            strokeDasharray={evt.impact === 'high' ? '0' : '4 3'}
            opacity={0.7}
            label={{
              value: evt.label,
              position: 'top',
              fill: cfg.color,
              fontSize: 8,
              fontWeight: 600,
            }}
          />
        );
      })}
    </>
  );
}

// ─── EventDot — 自定义 Recharts dot，在波动点显示标记 ─────────────────────────
interface EventDotProps {
  cx?: number;
  cy?: number;
  payload?: Record<string, unknown>;
  volatilePoints?: VolatilePoint[];
  onHover?: (point: VolatilePoint | null, x?: number, y?: number) => void;
  dateField?: string;
}

export function EventDot({ cx = 0, cy = 0, payload, volatilePoints = [], onHover, dateField = 'date' }: EventDotProps) {
  const date = String(payload?.[dateField] ?? '');
  const vp = volatilePoints.find(p => p.date === date);

  if (!vp) return null;

  const evt = vp.event;
  const category = evt?.category ?? (vp.changePercent > 0 ? 'technical' : 'crisis');
  const cfg = CATEGORY_CONFIG[category];
  const impact = evt?.impact ?? (Math.abs(vp.changePercent) > 5 ? 'high' : 'medium');
  const impactCfg = IMPACT_CONFIG[impact];
  const r = impactCfg.size / 2;

  return (
    <g
      transform={`translate(${cx},${cy})`}
      style={{ cursor: 'pointer' }}
      onMouseEnter={(e) => onHover?.(vp, e.clientX, e.clientY)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* 外圈光晕 */}
      <circle
        r={r + impactCfg.ring + 2}
        fill={cfg.color}
        opacity={0.15}
        style={{ animation: 'pulse 2s infinite' }}
      />
      {/* 外圈边框 */}
      <circle
        r={r + impactCfg.ring}
        fill="none"
        stroke={cfg.color}
        strokeWidth={1}
        opacity={0.6}
      />
      {/* 主圆点 */}
      <circle
        r={r}
        fill={cfg.color}
        opacity={0.9}
      />
      {/* 涨跌箭头 */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={r * 1.2}
        fill="white"
        fontWeight="bold"
      >
        {vp.changePercent > 0 ? '▲' : '▼'}
      </text>
    </g>
  );
}

// ─── useEventMarkers — 管理事件标记状态 ──────────────────────────────────────
export function useEventMarkers() {
  const [hoveredPoint, setHoveredPoint] = useState<VolatilePoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedEvent, setSelectedEvent] = useState<MarketEvent | null>(null);

  const handleHover = useCallback((point: VolatilePoint | null, x?: number, y?: number) => {
    setHoveredPoint(point);
    if (x !== undefined && y !== undefined) {
      setTooltipPos({ x, y });
    }
  }, []);

  const handleSelect = useCallback((event: MarketEvent | null) => {
    setSelectedEvent(event);
  }, []);

  return { hoveredPoint, tooltipPos, selectedEvent, handleHover, handleSelect };
}

// ─── EventTooltipCard — 事件详情悬浮卡片 ─────────────────────────────────────
interface EventTooltipCardProps {
  point: VolatilePoint;
  x: number;
  y: number;
}

export function EventTooltipCard({ point, x, y }: EventTooltipCardProps) {
  const evt = point.event;
  const category = evt?.category ?? (point.changePercent > 0 ? 'technical' : 'crisis');
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;
  const isPositive = point.changePercent > 0;

  // 防止卡片超出视口
  const cardX = Math.min(x + 12, window.innerWidth - 320);
  const cardY = Math.min(y - 20, window.innerHeight - 200);

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left: cardX, top: cardY, animation: 'tooltipFadeIn 0.15s ease-out' }}
    >
      <div className="bg-[#070d1a] border rounded-lg shadow-2xl p-3 w-72"
        style={{ borderColor: cfg.color + '50' }}>
        {/* 头部 */}
        <div className="flex items-start gap-2 mb-2">
          <div className="p-1 rounded flex-shrink-0" style={{ background: cfg.color + '20' }}>
            <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: cfg.color + '20', color: cfg.color }}>
                {cfg.label}
              </span>
              <span className="text-[9px] text-gray-500">{point.date}</span>
            </div>
            <p className="text-white text-[11px] font-semibold mt-1 leading-tight">
              {evt?.title ?? (isPositive ? '价格急涨' : '价格急跌')}
            </p>
          </div>
        </div>

        {/* 价格变化 */}
        <div className="flex items-center gap-3 mb-2 px-2 py-1.5 rounded"
          style={{ background: (isPositive ? '#34d39920' : '#f8717120') }}>
          <div className="flex items-center gap-1">
            {isPositive
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
            <span className="font-mono font-bold text-sm"
              style={{ color: isPositive ? '#34d399' : '#f87171' }}>
              {isPositive ? '+' : ''}{point.changePercent.toFixed(2)}%
            </span>
          </div>
          <span className="text-gray-400 text-[9px]">当期变化</span>
          {evt?.priceChange !== undefined && (
            <span className="text-gray-500 text-[9px] ml-auto">
              事件后: {evt.priceChange > 0 ? '+' : ''}{evt.priceChange}%
            </span>
          )}
        </div>

        {/* 事件描述 */}
        {evt?.description && (
          <p className="text-gray-400 text-[9px] leading-relaxed mb-2">
            {evt.description}
          </p>
        )}

        {/* 相关资产 */}
        {evt?.assets && evt.assets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {evt.assets.slice(0, 5).map(a => (
              <span key={a} className="px-1.5 py-0.5 bg-gray-800 text-gray-300 text-[8px] rounded font-mono">
                {a}
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── EventLegend — 事件图例 ──────────────────────────────────────────────────
interface EventLegendProps {
  events: MarketEvent[];
  compact?: boolean;
}

export function EventLegend({ events, compact = false }: EventLegendProps) {
  const categories = useMemo(() => {
    const cats = new Set(events.map(e => e.category));
    return Array.from(cats);
  }, [events]);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {categories.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <div key={cat} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
              <span className="text-[8px] text-gray-500">{cfg.label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(cat => {
        const cfg = CATEGORY_CONFIG[cat];
        const Icon = cfg.icon;
        const count = events.filter(e => e.category === cat).length;
        return (
          <div key={cat} className="flex items-center gap-1 px-2 py-0.5 rounded"
            style={{ background: cfg.color + '15', border: `1px solid ${cfg.color}30` }}>
            <Icon className="w-2.5 h-2.5" style={{ color: cfg.color }} />
            <span className="text-[9px]" style={{ color: cfg.color }}>{cfg.label}</span>
            <span className="text-[8px] text-gray-500">×{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── EventTimeline — 事件时间线组件 ──────────────────────────────────────────
interface EventTimelineProps {
  events: MarketEvent[];
  maxItems?: number;
}

export function EventTimeline({ events, maxItems = 8 }: EventTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const displayEvents = expanded ? events : events.slice(0, maxItems);

  return (
    <div className="space-y-1">
      {displayEvents.map((evt) => {
        const cfg = CATEGORY_CONFIG[evt.category];
        const Icon = cfg.icon;
        const isPositive = (evt.priceChange ?? 0) > 0;

        return (
          <div key={evt.id}
            className="flex items-start gap-2 p-2 rounded hover:bg-gray-800/50 transition-colors cursor-default">
            <div className="flex-shrink-0 mt-0.5 p-1 rounded"
              style={{ background: cfg.color + '20' }}>
              <Icon className="w-2.5 h-2.5" style={{ color: cfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-200 text-[10px] font-medium truncate">{evt.title}</span>
                {evt.priceChange !== undefined && (
                  <span className="text-[9px] font-mono flex-shrink-0"
                    style={{ color: isPositive ? '#34d399' : '#f87171' }}>
                    {isPositive ? '+' : ''}{evt.priceChange}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-500 text-[8px]">{evt.date}</span>
                <span className="text-[8px] px-1 py-0.5 rounded"
                  style={{ background: cfg.color + '15', color: cfg.color }}>
                  {cfg.label}
                </span>
                {evt.impact === 'high' && (
                  <span className="text-[8px] text-red-400">高影响</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {events.length > maxItems && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-[9px] text-blue-400 hover:text-blue-300 py-1 transition-colors">
          {expanded ? '收起' : `查看全部 ${events.length} 个事件`}
        </button>
      )}
    </div>
  );
}

// ─── withEventMarkers HOC — 为任意图表数据注入事件标记 ────────────────────────
/**
 * 使用方式：
 * const { markedData, volatilePoints, eventDotRenderer } = withEventMarkers(data, {
 *   dateField: 'date', valueField: 'close', threshold: 2.0
 * });
 *
 * 然后在 LineChart 中：
 * <Line dot={eventDotRenderer} ... />
 * {volatilePoints.map(vp => <ReferenceLine x={vp.date} ... />)}
 */
export function withEventMarkers<T extends Record<string, unknown>>(
  data: T[],
  opts?: DetectOptions & { onHover?: (point: VolatilePoint | null, x?: number, y?: number) => void }
) {
  const volatilePoints = detectVolatilePoints(data, opts);
  const { onHover, dateField = 'date' } = opts ?? {};

  const eventDotRenderer = (props: Record<string, unknown>) => (
    <EventDot
      {...props as EventDotProps}
      volatilePoints={volatilePoints}
      onHover={onHover}
      dateField={dateField}
    />
  );

  return { markedData: data, volatilePoints, eventDotRenderer };
}

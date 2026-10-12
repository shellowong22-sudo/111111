/**
 * ChartSkeleton — 图表骨架屏组件库
 *
 * 提供各种图表类型的骨架屏加载动画，支持：
 * - LineChartSkeleton：折线图骨架屏
 * - BarChartSkeleton：柱状图骨架屏
 * - AreaChartSkeleton：面积图骨架屏
 * - PieChartSkeleton：饼图骨架屏
 * - TableSkeleton：表格骨架屏
 * - CardSkeleton：卡片骨架屏
 * - DashboardSkeleton：仪表板骨架屏
 * - useChartLoading：图表加载状态 Hook
 */
import { useState, useEffect, ReactNode } from 'react';

// ─── 基础脉冲动画 CSS ──────────────────────────────────────────────────────────
const pulse = 'animate-pulse';
const shimmer = 'bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]';

// ─── 折线图骨架屏 ──────────────────────────────────────────────────────────────
export function LineChartSkeleton({ height = 200, lines = 2 }: { height?: number; lines?: number }) {
  return (
    <div className={`w-full rounded ${pulse}`} style={{ height }}>
      <svg width="100%" height={height} className="opacity-30">
        {/* Y轴刻度 */}
        {[0, 1, 2, 3, 4].map(i => (
          <line
            key={i}
            x1="40" y1={20 + i * ((height - 40) / 4)}
            x2="100%" y2={20 + i * ((height - 40) / 4)}
            stroke="#374151" strokeWidth="1" strokeDasharray="4 4"
          />
        ))}
        {/* Y轴标签 */}
        {[0, 1, 2, 3, 4].map(i => (
          <rect key={i} x="0" y={14 + i * ((height - 40) / 4)} width="32" height="8" rx="2" fill="#374151" />
        ))}
        {/* X轴标签 */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <rect key={i} x={40 + i * ((100 - 40) / 5) + '%'} y={height - 16} width="24" height="8" rx="2" fill="#374151" />
        ))}
        {/* 折线 */}
        {Array.from({ length: lines }).map((_, li) => {
          const points = Array.from({ length: 20 }, (_, i) => {
            const x = 40 + (i / 19) * (100 - 40);
            const base = 40 + li * 30;
            const y = base + Math.sin(i * 0.5 + li) * 20 + Math.cos(i * 0.3) * 10;
            return `${x}%,${Math.max(20, Math.min(height - 20, y))}`;
          }).join(' ');
          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
          return (
            <polyline
              key={li}
              points={points}
              fill="none"
              stroke={colors[li % colors.length]}
              strokeWidth="2"
              strokeOpacity="0.4"
            />
          );
        })}
      </svg>
    </div>
  );
}

// ─── 柱状图骨架屏 ──────────────────────────────────────────────────────────────
export function BarChartSkeleton({ height = 200, bars = 8, grouped = false }: { height?: number; bars?: number; grouped?: boolean }) {
  const barWidth = grouped ? 8 : 14;
  const gap = grouped ? 4 : 8;
  const groupWidth = grouped ? barWidth * 2 + gap + 8 : barWidth + gap;

  return (
    <div className={`w-full rounded ${pulse}`} style={{ height }}>
      <svg width="100%" height={height} className="opacity-30">
        {/* 网格线 */}
        {[0, 1, 2, 3].map(i => (
          <line
            key={i}
            x1="40" y1={20 + i * ((height - 40) / 3)}
            x2="100%" y2={20 + i * ((height - 40) / 3)}
            stroke="#374151" strokeWidth="1" strokeDasharray="4 4"
          />
        ))}
        {/* 柱子 */}
        {Array.from({ length: bars }).map((_, i) => {
          const x = 48 + i * groupWidth;
          const barHeights = [
            (height - 40) * (0.3 + Math.sin(i * 0.7) * 0.3 + 0.2),
            (height - 40) * (0.2 + Math.cos(i * 0.5) * 0.25 + 0.15),
          ];
          const colors = ['#3b82f6', '#10b981'];
          return (
            <g key={i}>
              {(grouped ? [0, 1] : [0]).map(gi => (
                <rect
                  key={gi}
                  x={x + gi * (barWidth + gap)}
                  y={height - 20 - barHeights[gi]}
                  width={barWidth}
                  height={barHeights[gi]}
                  rx="2"
                  fill={colors[gi]}
                  fillOpacity="0.5"
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── 面积图骨架屏 ──────────────────────────────────────────────────────────────
export function AreaChartSkeleton({ height = 200 }: { height?: number }) {
  const points = Array.from({ length: 20 }, (_, i) => {
    const x = 40 + (i / 19) * 55;
    const y = 40 + Math.sin(i * 0.4) * 25 + Math.cos(i * 0.2) * 15;
    return `${x}%,${Math.max(25, Math.min(height - 25, y))}`;
  });
  const areaPoints = [...points, `95%,${height - 20}`, `40%,${height - 20}`].join(' ');

  return (
    <div className={`w-full rounded ${pulse}`} style={{ height }}>
      <svg width="100%" height={height} className="opacity-30">
        {[0, 1, 2, 3].map(i => (
          <line
            key={i}
            x1="40" y1={20 + i * ((height - 40) / 3)}
            x2="100%" y2={20 + i * ((height - 40) / 3)}
            stroke="#374151" strokeWidth="1" strokeDasharray="4 4"
          />
        ))}
        <defs>
          <linearGradient id="skelGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#skelGrad)" />
        <polyline points={points.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.5" />
      </svg>
    </div>
  );
}

// ─── 饼图骨架屏 ──────────────────────────────────────────────────────────────
export function PieChartSkeleton({ size = 160 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const innerR = size * 0.22;
  const segments = [
    { start: 0, end: 110, color: '#3b82f6' },
    { start: 110, end: 200, color: '#10b981' },
    { start: 200, end: 280, color: '#f59e0b' },
    { start: 280, end: 360, color: '#8b5cf6' },
  ];

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
    const s1 = polarToCartesian(cx, cy, outerR, startDeg);
    const e1 = polarToCartesian(cx, cy, outerR, endDeg - 1);
    const s2 = polarToCartesian(cx, cy, innerR, endDeg - 1);
    const e2 = polarToCartesian(cx, cy, innerR, startDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s1.x} ${s1.y} A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y} Z`;
  }

  return (
    <div className={`flex items-center gap-4 ${pulse}`}>
      <svg width={size} height={size} className="opacity-40 flex-shrink-0">
        {segments.map((seg, i) => (
          <path
            key={i}
            d={arcPath(cx, cy, r, innerR, seg.start, seg.end)}
            fill={seg.color}
            fillOpacity="0.5"
          />
        ))}
      </svg>
      <div className="space-y-2 flex-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color, opacity: 0.5 }} />
            <div className="h-2.5 rounded flex-1" style={{ backgroundColor: seg.color, opacity: 0.2, maxWidth: `${40 + i * 15}%` }} />
            <div className="h-2.5 rounded w-10" style={{ backgroundColor: seg.color, opacity: 0.3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 表格骨架屏 ──────────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  const colWidths = [120, 80, 80, 80, 80, 80, 80];
  return (
    <div className={`w-full ${pulse}`}>
      {/* 表头 */}
      <div className="flex gap-2 px-2 py-1.5 border-b border-gray-800 mb-1">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-gray-700" style={{ width: colWidths[i] || 80, opacity: 0.6 }} />
        ))}
      </div>
      {/* 数据行 */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-2 px-2 py-1.5 border-b border-gray-800/50">
          {Array.from({ length: cols }).map((_, ci) => (
            <div
              key={ci}
              className="h-2.5 rounded bg-gray-800"
              style={{
                width: (colWidths[ci] || 80) * (0.64 + ((ri * 17 + ci * 13) % 30) / 100),
                opacity: 0.4 + (ri % 2) * 0.1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 卡片骨架屏 ──────────────────────────────────────────────────────────────
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${pulse}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-900/60 rounded-lg p-3 space-y-2">
          <div className="h-2.5 rounded bg-gray-700 w-3/4" />
          <div className="h-6 rounded bg-gray-800 w-1/2" />
          <div className="h-2 rounded bg-gray-800 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// ─── 仪表板骨架屏（综合布局）─────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className={`p-3 space-y-3 ${pulse}`}>
      {/* 顶部指标卡片 */}
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900/60 rounded p-2.5 space-y-1.5">
            <div className="h-2 rounded bg-gray-700 w-2/3" />
            <div className="h-5 rounded bg-gray-800 w-3/4" />
            <div className="h-2 rounded bg-gray-800 w-1/2" />
          </div>
        ))}
      </div>
      {/* 主图表区 */}
      <div className="bg-gray-900/60 rounded p-3">
        <div className="h-2.5 rounded bg-gray-700 w-1/4 mb-3" />
        <AreaChartSkeleton height={160} />
      </div>
      {/* 底部两列 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-900/60 rounded p-3">
          <div className="h-2.5 rounded bg-gray-700 w-1/3 mb-3" />
          <BarChartSkeleton height={120} bars={6} />
        </div>
        <div className="bg-gray-900/60 rounded p-3">
          <div className="h-2.5 rounded bg-gray-700 w-1/3 mb-2" />
          <TableSkeleton rows={4} cols={3} />
        </div>
      </div>
    </div>
  );
}

// ─── 新闻列表骨架屏 ───────────────────────────────────────────────────────────
export function NewsListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className={`space-y-0 ${pulse}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="px-3 py-2.5 border-b border-gray-800/50 flex gap-3">
          <div className="shrink-0 space-y-1 pt-0.5">
            <div className="h-2 rounded bg-gray-700 w-14" />
            <div className="h-3.5 rounded bg-gray-800 w-10 mt-1" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex gap-2">
              <div className="h-3.5 rounded bg-gray-800 w-12" />
              <div className="h-3.5 rounded bg-gray-700 w-8" />
            </div>
            <div className="h-3 rounded bg-gray-700 w-full" />
            <div className="h-3 rounded bg-gray-700 w-4/5" />
            <div className="flex gap-1 mt-1">
              {[0, 1, 2].map(j => (
                <div key={j} className="h-4 rounded bg-gray-800 w-10" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 雷达图骨架屏 ─────────────────────────────────────────────────────────────
export function RadarChartSkeleton({ size = 180 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const axes = 6;
  const rings = 3;

  return (
    <div className={`flex justify-center ${pulse}`}>
      <svg width={size} height={size} className="opacity-35">
        {/* 网格环 */}
        {Array.from({ length: rings }).map((_, ri) => {
          const rr = r * ((ri + 1) / rings);
          const pts = Array.from({ length: axes }, (_, ai) => {
            const angle = (ai / axes) * 2 * Math.PI - Math.PI / 2;
            return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`;
          }).join(' ');
          return <polygon key={ri} points={pts} fill="none" stroke="#374151" strokeWidth="1" />;
        })}
        {/* 轴线 */}
        {Array.from({ length: axes }).map((_, ai) => {
          const angle = (ai / axes) * 2 * Math.PI - Math.PI / 2;
          return (
            <line
              key={ai}
              x1={cx} y1={cy}
              x2={cx + r * Math.cos(angle)}
              y2={cy + r * Math.sin(angle)}
              stroke="#374151" strokeWidth="1"
            />
          );
        })}
        {/* 数据区域 */}
        {[
          { color: '#3b82f6', scale: [0.8, 0.6, 0.9, 0.7, 0.85, 0.65] },
          { color: '#10b981', scale: [0.5, 0.75, 0.6, 0.85, 0.55, 0.7] },
        ].map((series, si) => {
          const pts = Array.from({ length: axes }, (_, ai) => {
            const angle = (ai / axes) * 2 * Math.PI - Math.PI / 2;
            const rr = r * series.scale[ai];
            return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`;
          }).join(' ');
          return (
            <polygon key={si} points={pts} fill={series.color} fillOpacity="0.15" stroke={series.color} strokeWidth="1.5" strokeOpacity="0.5" />
          );
        })}
      </svg>
    </div>
  );
}

// ─── 散点图骨架屏 ─────────────────────────────────────────────────────────────
export function ScatterChartSkeleton({ height = 200 }: { height?: number }) {
  const points = Array.from({ length: 25 }, (_, i) => ({
    x: 10 + Math.random() * 80,
    y: 15 + Math.random() * 70,
    r: 3 + Math.random() * 5,
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 4)],
  }));

  return (
    <div className={`w-full rounded ${pulse}`} style={{ height }}>
      <svg width="100%" height={height} className="opacity-30">
        {[0, 1, 2, 3].map(i => (
          <line
            key={`h${i}`}
            x1="40" y1={20 + i * ((height - 40) / 3)}
            x2="100%" y2={20 + i * ((height - 40) / 3)}
            stroke="#374151" strokeWidth="1" strokeDasharray="4 4"
          />
        ))}
        {[0, 1, 2, 3].map(i => (
          <line
            key={`v${i}`}
            x1={`${20 + i * 20}%`} y1="20"
            x2={`${20 + i * 20}%`} y2={height - 20}
            stroke="#374151" strokeWidth="1" strokeDasharray="4 4"
          />
        ))}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={`${p.x}%`}
            cy={(p.y / 100) * (height - 40) + 20}
            r={p.r}
            fill={p.color}
            fillOpacity="0.4"
          />
        ))}
      </svg>
    </div>
  );
}

// ─── 图表加载 Hook ────────────────────────────────────────────────────────────
export function useChartLoading(delay = 800) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return loading;
}

// ─── 带骨架屏的图表容器 ───────────────────────────────────────────────────────
interface ChartWithSkeletonProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartWithSkeleton({ loading, skeleton, children, className = '' }: ChartWithSkeletonProps) {
  return (
    <div className={`relative transition-opacity duration-300 ${className}`}>
      {loading ? (
        <div className="transition-opacity duration-300 opacity-100">
          {skeleton}
        </div>
      ) : (
        <div className="transition-opacity duration-500 opacity-100 animate-[fadeIn_0.4s_ease-out]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Panel 级别骨架屏（整个Panel加载时使用）────────────────────────────────────
export function PanelSkeleton({ type = 'dashboard' }: { type?: 'dashboard' | 'news' | 'chart' | 'table' }) {
  return (
    <div className="h-full flex flex-col bg-[#050810] overflow-hidden">
      {/* 标题栏骨架 */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0 ${pulse}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-700" />
          <div className="h-3.5 rounded bg-gray-700 w-16" />
          <div className="h-3 rounded bg-gray-800 w-32" />
        </div>
        <div className="h-3 rounded bg-gray-800 w-8" />
      </div>
      {/* 标签栏骨架 */}
      <div className={`flex gap-1 px-2 py-1.5 border-b border-gray-800 shrink-0 ${pulse}`}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-5 rounded bg-gray-800 w-14" />
        ))}
      </div>
      {/* 内容骨架 */}
      <div className="flex-1 overflow-hidden">
        {type === 'dashboard' && <DashboardSkeleton />}
        {type === 'news' && (
          <div className="p-3 space-y-2">
            <CardSkeleton count={4} />
            <NewsListSkeleton items={5} />
          </div>
        )}
        {type === 'chart' && (
          <div className="p-3 space-y-3">
            <CardSkeleton count={4} />
            <AreaChartSkeleton height={180} />
            <BarChartSkeleton height={140} bars={8} />
          </div>
        )}
        {type === 'table' && (
          <div className="p-3 space-y-3">
            <CardSkeleton count={4} />
            <TableSkeleton rows={8} cols={6} />
          </div>
        )}
      </div>
    </div>
  );
}

export type DataLoadingVariant = 'line' | 'bar' | 'area' | 'table' | 'list' | 'dashboard';

interface DataLoadingSkeletonProps {
  variant?: DataLoadingVariant;
  height?: number;
  rows?: number;
  cols?: number;
  label?: string;
  className?: string;
}

/**
 * 统一的数据视图加载占位：保留目标内容的空间与层级，避免图表或列表加载时跳动。
 * 不用于提交、导出等短时按钮状态；这些场景继续使用按钮自身的 spinner。
 */
export function DataLoadingSkeleton({
  variant = 'table',
  height = 240,
  rows = 6,
  cols = 5,
  label = '正在加载数据',
  className = '',
}: DataLoadingSkeletonProps) {
  const content = {
    line: <LineChartSkeleton height={height} />,
    bar: <BarChartSkeleton height={height} />,
    area: <AreaChartSkeleton height={height} />,
    table: <TableSkeleton rows={rows} cols={cols} />,
    list: <NewsListSkeleton items={rows} />,
    dashboard: <DashboardSkeleton />,
  }[variant];

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className={`relative overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950/30 p-3 ${className}`}
    >
      <span className="sr-only">{label}</span>
      <div className="pointer-events-none select-none" aria-hidden="true">
        {content}
      </div>
    </section>
  );
}

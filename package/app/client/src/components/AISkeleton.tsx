/**
 * AISkeleton — 通用 AI 模块骨架屏动画组件
 * 用于 FIT/SOVM/MIPR/WIR/GCDS/FICM 等 AI 计算面板的加载状态
 */
import { cn } from '@/lib/utils';

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-muted/40', className)} />
  );
}

/** 图表骨架屏：模拟折线图/柱状图的加载状态 */
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="w-full animate-pulse" style={{ height }}>
      <div className="flex items-end gap-1 h-full px-4 pb-6 pt-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-muted/40 rounded-t"
            style={{ height: `${30 + Math.sin(i * 0.8) * 40 + 30}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** 表格骨架屏：模拟数据表格的加载状态 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full animate-pulse space-y-2">
      {/* 表头 */}
      <div className="flex gap-2 pb-2 border-b border-border/30">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBar key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-2 py-1">
          {Array.from({ length: cols }).map((_, ci) => (
            <SkeletonBar
              key={ci}
              className={cn('h-3 flex-1', ci === 0 ? 'max-w-[120px]' : '')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 卡片骨架屏：模拟统计卡片的加载状态 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={cn('grid gap-3', count === 3 ? 'grid-cols-3' : count === 4 ? 'grid-cols-4' : 'grid-cols-2')}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border/30 rounded p-3 animate-pulse space-y-2">
          <SkeletonBar className="h-2 w-16" />
          <SkeletonBar className="h-5 w-24" />
          <SkeletonBar className="h-2 w-12" />
        </div>
      ))}
    </div>
  );
}

/** 完整 AI 面板骨架屏：卡片 + 图表 + 表格 */
export function AIPanelSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <CardSkeleton count={3} />
      <ChartSkeleton height={180} />
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}

/** 自定义 Recharts Tooltip 样式 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  unit = '',
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | string; color?: string }>;
  label?: string;
  unit?: string;
  formatter?: (value: number | string, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border shadow-lg rounded px-3 py-2 text-xs min-w-[120px]">
      {label && <div className="text-muted-foreground mb-1 font-medium">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: entry.color || '#888' }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
          </span>
          <span className="font-semibold text-foreground">
            {formatter ? formatter(entry.value, entry.name) : `${entry.value}${unit}`}
          </span>
        </div>
      ))}
    </div>
  );
}

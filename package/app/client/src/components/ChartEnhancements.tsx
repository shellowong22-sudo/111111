/**
 * ChartEnhancements — 可复用图表增强组件库
 *
 * 包含：
 * - EnhancedTooltip：深度自定义Tooltip（支持多系列、单位、涨跌色、环比数据WoW/MoM/YoY）
 * - CrosshairCursor：十字线光标（通过 Recharts cursor prop）
 * - FilterBadge：跨Panel联动过滤标签
 * - ChartContainer：带交互状态的图表容器
 * - useChartZoom：图表缩放/刷选 hook
 * - formatValue：统一数值格式化
 */
import { useState, useCallback, ReactNode } from 'react';
export { useChartInteraction } from '@/contexts/ChartInteractionContext';
import { X, Filter, ZoomIn, ZoomOut, RotateCcw, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useChartInteraction as _useChartInteraction, ChartFilter, FilterType } from '@/contexts/ChartInteractionContext';

// ─── 数值格式化 ───────────────────────────────────────────────────────────────
export function formatValue(
  value: number | string,
  opts?: {
    unit?: string;
    prefix?: string;
    decimals?: number;
    compact?: boolean;
    signed?: boolean;
  }
): string {
  if (typeof value === 'string') return value;
  const { unit = '', prefix = '', decimals = 2, compact = false, signed = false } = opts ?? {};
  let formatted: string;
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) formatted = `${(value / 1_000_000_000).toFixed(1)}B`;
    else if (Math.abs(value) >= 1_000_000) formatted = `${(value / 1_000_000).toFixed(1)}M`;
    else if (Math.abs(value) >= 1_000) formatted = `${(value / 1_000).toFixed(1)}K`;
    else formatted = value.toFixed(decimals);
  } else {
    formatted = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${prefix}${formatted}${unit}`;
}

// ─── 颜色工具 ─────────────────────────────────────────────────────────────────
export function getChangeColor(value: number): string {
  if (value > 0) return '#34d399';
  if (value < 0) return '#f87171';
  return '#9ca3af';
}

// ─── 环比变化指示器 ───────────────────────────────────────────────────────────
interface ChangeIndicatorProps {
  value: number;
  label: string;
  unit?: string;
  decimals?: number;
}

function ChangeIndicator({ value, label, unit = '%', decimals = 2 }: ChangeIndicatorProps) {
  const color = getChangeColor(value);
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const sign = value > 0 ? '+' : '';
  return (
    <div className="flex items-center justify-between text-[9px]">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-0.5" style={{ color }}>
        <Icon className="w-2.5 h-2.5" />
        <span className="font-mono font-medium">{sign}{value.toFixed(decimals)}{unit}</span>
      </div>
    </div>
  );
}

// ─── 增强Tooltip ──────────────────────────────────────────────────────────────
interface TooltipEntry {
  name: string;
  value: number | string;
  color: string;
  unit?: string;
  prefix?: string;
  decimals?: number;
}

interface EnhancedTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number | string;
    color: string;
    dataKey: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number | string, name: string) => string;
  entries?: TooltipEntry[];
  title?: string;
  showDelta?: boolean;
  compact?: boolean;
  /** 是否显示环比数据（从 payload 中读取 _wow_/_mom_/yoy_ 前缀字段）*/
  showComparison?: boolean;
}

export function EnhancedTooltip({
  active, payload, label,
  labelFormatter, valueFormatter,
  title, showDelta = false, compact = false,
  showComparison = true,
}: EnhancedTooltipProps) {
  if (!active || !payload?.length) return null;

  const displayLabel = label !== undefined
    ? (labelFormatter ? labelFormatter(label) : String(label))
    : '';

  // 从第一个 payload 中提取环比字段
  const extraData = payload[0]?.payload ?? {};
  const wowKeys = Object.keys(extraData).filter(k => k.startsWith('_wow_'));
  const momKeys = Object.keys(extraData).filter(k => k.startsWith('_mom_'));
  const yoyKeys = Object.keys(extraData).filter(k => k.startsWith('_yoy_'));
  const tipKeys = Object.keys(extraData).filter(k => k.startsWith('_tip_'));
  const hasComparison = showComparison && (wowKeys.length > 0 || momKeys.length > 0 || yoyKeys.length > 0);

  return (
    <div className="bg-[#0a0f1e] border border-blue-500/25 rounded-lg shadow-2xl shadow-blue-900/30 p-2.5 min-w-[160px] max-w-[280px] text-xs backdrop-blur-sm"
      style={{ animation: 'tooltipFadeIn 0.12s ease-out' }}>
      {/* 标题行 */}
      {(title || displayLabel) && (
        <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-gray-700/60">
          <span className="text-gray-200 font-semibold text-[10px]">{title || displayLabel}</span>
          {title && displayLabel && (
            <span className="text-gray-500 text-[9px] ml-2">{displayLabel}</span>
          )}
        </div>
      )}

      {/* 主数据行 */}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const rawVal = entry.value;
          const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
          const displayVal = valueFormatter
            ? valueFormatter(rawVal, entry.name)
            : (isNaN(numVal) ? String(rawVal) : formatValue(numVal, { decimals: compact ? 1 : 2 }));

          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                <span className="text-gray-400 text-[9px] truncate">{entry.name}</span>
              </div>
              <span
                className="font-mono font-bold text-[10px] flex-shrink-0"
                style={{ color: showDelta && typeof numVal === 'number' ? getChangeColor(numVal) : entry.color }}
              >
                {showDelta && numVal > 0 ? '+' : ''}{displayVal}
              </span>
            </div>
          );
        })}
      </div>

      {/* 环比变化数据区 */}
      {hasComparison && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-700/60 space-y-0.5">
          <div className="text-[8px] text-gray-600 mb-0.5 uppercase tracking-wider">环比变化</div>
          {wowKeys.map(k => (
            <ChangeIndicator
              key={k}
              label={`WoW · ${k.replace('_wow_', '')}`}
              value={Number(extraData[k])}
            />
          ))}
          {momKeys.map(k => (
            <ChangeIndicator
              key={k}
              label={`MoM · ${k.replace('_mom_', '')}`}
              value={Number(extraData[k])}
            />
          ))}
          {yoyKeys.map(k => (
            <ChangeIndicator
              key={k}
              label={`YoY · ${k.replace('_yoy_', '')}`}
              value={Number(extraData[k])}
            />
          ))}
        </div>
      )}

      {/* 附加信息（_tip_ 前缀字段）*/}
      {tipKeys.length > 0 && (
        <div className="mt-1.5 pt-1 border-t border-gray-700/60 space-y-0.5">
          {tipKeys.map(k => (
            <div key={k} className="flex items-center justify-between text-[9px]">
              <span className="text-gray-500">{k.replace('_tip_', '')}</span>
              <span className="text-gray-300 font-mono">{String(extraData[k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 过滤标签 ─────────────────────────────────────────────────────────────────
export function FilterBadge() {
  const { filter, clearFilter } = _useChartInteraction();
  if (!filter) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-blue-900/30 border border-blue-500/40 rounded-full text-[9px]">
      <Filter className="w-2.5 h-2.5 text-blue-400" />
      <span className="text-blue-300 font-medium">
        {filter.label}
        {filter.source && <span className="text-blue-500 ml-1">← {filter.source}</span>}
      </span>
      <button
        onClick={clearFilter}
        className="ml-0.5 text-blue-400 hover:text-white transition-colors"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ─── 图表工具栏 ───────────────────────────────────────────────────────────────
interface ChartToolbarProps {
  title?: string;
  onExport?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  showZoom?: boolean;
  children?: ReactNode;
}

export function ChartToolbar({
  title, onExport, onZoomIn, onZoomOut, onReset, showZoom = false, children,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1 border-b border-gray-800">
      {title && <span className="text-gray-400 text-[9px] font-medium">{title}</span>}
      <div className="flex items-center gap-1 ml-auto">
        {children}
        {showZoom && (
          <>
            {onZoomIn && (
              <button onClick={onZoomIn} className="p-0.5 text-gray-500 hover:text-white transition-colors" title="放大">
                <ZoomIn className="w-3 h-3" />
              </button>
            )}
            {onZoomOut && (
              <button onClick={onZoomOut} className="p-0.5 text-gray-500 hover:text-white transition-colors" title="缩小">
                <ZoomOut className="w-3 h-3" />
              </button>
            )}
            {onReset && (
              <button onClick={onReset} className="p-0.5 text-gray-500 hover:text-white transition-colors" title="重置">
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </>
        )}
        {onExport && (
          <button onClick={onExport} className="p-0.5 text-gray-500 hover:text-white transition-colors" title="导出">
            <Download className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 图表容器（带联动状态指示）────────────────────────────────────────────────
interface ChartContainerProps {
  children: ReactNode;
  panelId: string;
  filterType?: FilterType;
  className?: string;
  onFilterApplied?: (filter: ChartFilter) => void;
}

export function ChartContainer({
  children, panelId, filterType, className = '', onFilterApplied,
}: ChartContainerProps) {
  const { filter } = _useChartInteraction();
  const isActive = filter?.type === filterType;

  return (
    <div
      className={`relative transition-all duration-200 ${isActive ? 'ring-1 ring-blue-500/40 rounded' : ''} ${className}`}
      data-panel-id={panelId}
    >
      {isActive && (
        <div className="absolute top-0 right-0 z-10 px-1 py-0.5 bg-blue-900/60 rounded-bl text-[8px] text-blue-300 border-l border-b border-blue-500/30">
          已过滤: {filter?.label}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── 自定义十字线 ─────────────────────────────────────────────────────────────
export const CustomCursor = {
  stroke: '#3b82f6',
  strokeWidth: 1,
  strokeDasharray: '4 2',
  opacity: 0.6,
};

// ─── 图表缩放 Hook ────────────────────────────────────────────────────────────
export function useChartZoom(data: unknown[], defaultWindow = 30) {
  const total = data.length;
  const [startIdx, setStartIdx] = useState(Math.max(0, total - defaultWindow));
  const [endIdx, setEndIdx] = useState(total - 1);

  const visibleData = data.slice(startIdx, endIdx + 1);

  const zoomIn = useCallback(() => {
    const mid = Math.floor((startIdx + endIdx) / 2);
    const half = Math.max(5, Math.floor((endIdx - startIdx) / 4));
    setStartIdx(Math.max(0, mid - half));
    setEndIdx(Math.min(total - 1, mid + half));
  }, [startIdx, endIdx, total]);

  const zoomOut = useCallback(() => {
    const mid = Math.floor((startIdx + endIdx) / 2);
    const half = Math.min(total, (endIdx - startIdx + 1) * 2);
    setStartIdx(Math.max(0, mid - half));
    setEndIdx(Math.min(total - 1, mid + half));
  }, [startIdx, endIdx, total]);

  const reset = useCallback(() => {
    setStartIdx(Math.max(0, total - defaultWindow));
    setEndIdx(total - 1);
  }, [total, defaultWindow]);

  return { visibleData, startIdx, endIdx, zoomIn, zoomOut, reset };
}

// ─── 联动过滤按钮 ─────────────────────────────────────────────────────────────
interface FilterTriggerProps {
  type: FilterType;
  value: string;
  label: string;
  source: string;
  color?: string;
  className?: string;
}

export function FilterTrigger({ type, value, label, source, color, className = '' }: FilterTriggerProps) {
  const { setFilter, isFiltered } = _useChartInteraction();
  const active = isFiltered(type, value);

  return (
    <button
      onClick={() => setFilter({ type, value, label, source })}
      className={`px-1.5 py-0.5 rounded text-[8px] font-medium transition-all duration-150 ${
        active
          ? 'bg-blue-600 text-white ring-1 ring-blue-400'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
      } ${className}`}
      style={active && color ? { backgroundColor: color + '33', borderColor: color } : {}}
      title={active ? `取消过滤: ${label}` : `过滤: ${label}`}
    >
      {active ? '✓ ' : ''}{label}
    </button>
  );
}

// ─── 全局联动状态栏 ───────────────────────────────────────────────────────────
export function GlobalFilterBar() {
  const { filter, clearFilter } = _useChartInteraction();

  if (!filter) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 bg-[#0d1220] border border-blue-500/50 rounded-full shadow-lg shadow-blue-900/30 text-xs">
      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
      <span className="text-gray-400">联动过滤:</span>
      <span className="text-blue-300 font-bold">{filter.label}</span>
      {filter.source && <span className="text-gray-500 text-[9px]">来自 {filter.source}</span>}
      <button
        onClick={clearFilter}
        className="ml-1 text-gray-400 hover:text-white transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── 带环比数据的数据生成工具 ─────────────────────────────────────────────────
/**
 * 为时序数据自动生成环比字段
 * 用法：const data = addComparisonFields(rawData, ['value', 'volume'])
 * 会自动添加 _wow_value, _mom_value, _yoy_value 等字段
 */
export function addComparisonFields<T extends Record<string, number | string>>(
  data: T[],
  fields: string[],
  opts?: { wowPeriod?: number; momPeriod?: number; yoyPeriod?: number }
): Array<T & Record<string, number>> {
  const { wowPeriod = 5, momPeriod = 20, yoyPeriod = 252 } = opts ?? {};

  return data.map((item, i) => {
    const extra: Record<string, number> = {};
    for (const field of fields) {
      const curr = Number(item[field]);
      if (isNaN(curr)) continue;

      const wowIdx = i - wowPeriod;
      const momIdx = i - momPeriod;
      const yoyIdx = i - yoyPeriod;

      if (wowIdx >= 0) {
        const prev = Number(data[wowIdx][field]);
        if (!isNaN(prev) && prev !== 0) {
          extra[`_wow_${field}`] = ((curr - prev) / Math.abs(prev)) * 100;
        }
      }
      if (momIdx >= 0) {
        const prev = Number(data[momIdx][field]);
        if (!isNaN(prev) && prev !== 0) {
          extra[`_mom_${field}`] = ((curr - prev) / Math.abs(prev)) * 100;
        }
      }
      if (yoyIdx >= 0) {
        const prev = Number(data[yoyIdx][field]);
        if (!isNaN(prev) && prev !== 0) {
          extra[`_yoy_${field}`] = ((curr - prev) / Math.abs(prev)) * 100;
        }
      }
    }
    return { ...item, ...extra };
  });
}

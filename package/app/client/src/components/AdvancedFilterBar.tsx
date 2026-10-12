/**
 * AdvancedFilterBar — 通用多条件组合筛选栏
 * 只包含 React 组件，工具函数和类型在 filterUtils.ts
 */

// 重新导出所有工具函数和类型，保持向后兼容
export type {
  FilterSelectOption, FilterSelectConfig, FilterRangeConfig,
  FilterBarConfig, FilterState, SortState,
} from './filterUtils';
export { buildInitialFilterState, countActiveFilters, useTableSort } from './filterUtils';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Search, Filter, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { FilterBarConfig, FilterState, SortState } from './filterUtils';
import { buildInitialFilterState, countActiveFilters } from './filterUtils';

// ─── AdvancedFilterBar 主组件 ─────────────────────────────────────────────────

interface AdvancedFilterBarProps {
  config: FilterBarConfig;
  state: FilterState;
  onChange: (state: FilterState) => void;
  rightSlot?: React.ReactNode;
  className?: string;
}

export function AdvancedFilterBar({ config, state, onChange, rightSlot, className = '' }: AdvancedFilterBarProps) {
  const [rangeOpen, setRangeOpen] = useState(false);

  const setSearch = useCallback((v: string) => onChange({ ...state, search: v }), [state, onChange]);
  const setSelect = useCallback((key: string, v: string) => onChange({ ...state, selects: { ...state.selects, [key]: v } }), [state, onChange]);
  const setRange = useCallback((key: string, v: [number, number]) => onChange({ ...state, ranges: { ...state.ranges, [key]: v } }), [state, onChange]);
  const resetAll = useCallback(() => onChange(buildInitialFilterState(config)), [config, onChange]);

  const activeCount = countActiveFilters(state, config);
  const hasRanges = (config.ranges ?? []).length > 0;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <Input
          value={state.search}
          onChange={e => setSearch(e.target.value)}
          placeholder={config.searchPlaceholder ?? '搜索...'}
          className="pl-7 h-7 w-40 text-xs bg-slate-800 border-slate-600 focus:border-cyan-500 transition-colors"
        />
        {state.search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 下拉筛选器 */}
      {(config.selects ?? []).map(sel => (
        <Select key={sel.key} value={state.selects[sel.key] ?? 'All'} onValueChange={v => setSelect(sel.key, v)}>
          <SelectTrigger
            className={`h-7 text-xs bg-slate-800 border-slate-600 hover:border-cyan-600 transition-colors ${sel.width ?? 'w-28'} ${state.selects[sel.key] && state.selects[sel.key] !== 'All' ? 'border-cyan-500 text-cyan-300' : ''}`}
          >
            <SelectValue placeholder={sel.label} />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            <SelectItem value="All" className="text-xs text-slate-400">全部 {sel.label}</SelectItem>
            {sel.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* 数值范围筛选（弹出面板） */}
      {hasRanges && (
        <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className={`h-7 text-xs px-2 gap-1 bg-slate-800 border-slate-600 hover:border-cyan-600 transition-colors ${
                (config.ranges ?? []).some(r => { const [lo, hi] = state.ranges[r.key] ?? [r.min, r.max]; return lo > r.min || hi < r.max; })
                  ? 'border-cyan-500 text-cyan-300'
                  : 'text-slate-400'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              数值范围
              <ChevronDown className={`w-3 h-3 transition-transform ${rangeOpen ? 'rotate-180' : ''}`} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-slate-900 border-slate-700 p-4 shadow-xl" align="start">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  数值范围筛选
                </span>
                <button
                  onClick={() => {
                    const resetRanges: Record<string, [number, number]> = {};
                    (config.ranges ?? []).forEach(r => { resetRanges[r.key] = [r.min, r.max]; });
                    onChange({ ...state, ranges: resetRanges });
                  }}
                  className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                >
                  重置范围
                </button>
              </div>
              {(config.ranges ?? []).map(r => {
                const [lo, hi] = state.ranges[r.key] ?? [r.min, r.max];
                const fmt = r.format ?? ((v: number) => `${v}${r.unit ?? ''}`);
                const isActive = lo > r.min || hi < r.max;
                return (
                  <div key={r.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}>{r.label}</span>
                      <span className="text-xs text-slate-500 font-mono">{fmt(lo)} — {fmt(hi)}</span>
                    </div>
                    <Slider
                      min={r.min} max={r.max} step={r.step ?? 1}
                      value={[lo, hi]}
                      onValueChange={v => setRange(r.key, v as [number, number])}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>{fmt(r.min)}</span>
                      <span>{fmt(r.max)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* 激活筛选数量 + 清空 */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Badge className="bg-cyan-900/60 text-cyan-300 border-cyan-700 text-[10px] h-5 px-1.5">
            <Filter className="w-2.5 h-2.5 mr-0.5" />
            {activeCount} 个筛选
          </Badge>
          <Button size="sm" variant="ghost" onClick={resetAll}
            className="h-5 text-[10px] px-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors">
            <X className="w-2.5 h-2.5 mr-0.5" />清空
          </Button>
        </div>
      )}

      {rightSlot && <div className="ml-auto flex items-center gap-1">{rightSlot}</div>}
    </div>
  );
}

// ─── SortableTh 可排序表头 ────────────────────────────────────────────────────

interface SortableThProps<T extends string> {
  field: T;
  label: string;
  sort: SortState<T>;
  onSort: (field: T) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export function SortableTh<T extends string>({ field, label, sort, onSort, className = '', align = 'right' }: SortableThProps<T>) {
  const active = sort.field === field;
  const alignClass = align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right';
  return (
    <th
      onClick={() => onSort(field)}
      className={`py-2 px-2 cursor-pointer select-none group transition-colors hover:text-cyan-300 ${alignClass} ${active ? 'text-cyan-400' : 'text-slate-400'} ${className}`}
    >
      <span className="inline-flex items-center gap-0.5 justify-end">
        {label}
        <span className={`text-[10px] ml-0.5 transition-all ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          {active ? (sort.dir === 'desc' ? '↓' : '↑') : '↕'}
        </span>
      </span>
    </th>
  );
}

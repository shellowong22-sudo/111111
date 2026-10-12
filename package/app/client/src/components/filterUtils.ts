// 独立的筛选工具函数和类型，不含 React 组件
// 分离自 AdvancedFilterBar.tsx，解决 Vite Fast Refresh 兼容性问题

import { useState, useCallback } from 'react';

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface FilterSelectConfig {
  key: string;
  label: string;
  width?: string;
  options: FilterSelectOption[];
}

export interface FilterRangeConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (v: number) => string;
}

export interface FilterBarConfig {
  searchPlaceholder?: string;
  selects?: FilterSelectConfig[];
  ranges?: FilterRangeConfig[];
}

export interface FilterState {
  search: string;
  selects: Record<string, string>;
  ranges: Record<string, [number, number]>;
}

export function buildInitialFilterState(config: FilterBarConfig): FilterState {
  const selects: Record<string, string> = {};
  (config.selects ?? []).forEach(s => { selects[s.key] = ''; });
  const ranges: Record<string, [number, number]> = {};
  (config.ranges ?? []).forEach(r => { ranges[r.key] = [r.min, r.max]; });
  return { search: '', selects, ranges };
}

export function countActiveFilters(state: FilterState, config: FilterBarConfig): number {
  let count = 0;
  if (state.search.trim()) count++;
  // Select controls use the explicit "All" sentinel after a user clears a
  // filter. Treat that value as inactive; otherwise returning to the default
  // view incorrectly leaves a phantom active-filter badge behind.
  (config.selects ?? []).forEach(s => {
    const value = state.selects[s.key];
    if (value && value !== 'All') count++;
  });
  (config.ranges ?? []).forEach(r => {
    const [lo, hi] = state.ranges[r.key] ?? [r.min, r.max];
    if (lo > r.min || hi < r.max) count++;
  });
  return count;
}

export interface SortState<T extends string> {
  field: T;
  dir: 'asc' | 'desc';
}

export function useTableSort<T extends string>(defaultField: T, defaultDir: 'asc' | 'desc' = 'desc') {
  const [sort, setSort] = useState<SortState<T>>({ field: defaultField, dir: defaultDir });
  const handleSort = useCallback((field: T) => {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { field, dir: 'desc' }
    );
  }, []);
  return { sort, handleSort };
}

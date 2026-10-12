/**
 * ChartInteractionContext
 * 全局图表交互上下文 — 实现跨Panel点击联动过滤
 *
 * 使用方式：
 *   const { filter, setFilter, clearFilter } = useChartInteraction();
 *   // 在图表onClick中：setFilter({ type: 'sector', value: 'XLK', label: '信息技术' })
 *   // 在其他Panel中：if (filter?.type === 'sector') { ... }
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type FilterType =
  | 'sector'      // 行业板块
  | 'symbol'      // 证券代码
  | 'currency'    // 货币对
  | 'date'        // 日期/时间段
  | 'region'      // 地区/国家
  | 'commodity'   // 大宗商品
  | 'indicator'   // 经济指标
  | 'rating'      // 信用评级
  | 'custom';     // 自定义

export interface ChartFilter {
  type: FilterType;
  value: string;
  label: string;
  source?: string;       // 来源Panel名称
  extra?: Record<string, unknown>; // 附加数据
}

export interface HoveredPoint {
  panelId: string;
  dataKey: string;
  value: number | string;
  payload?: Record<string, unknown>;
}

interface ChartInteractionState {
  filter: ChartFilter | null;
  hoveredPoint: HoveredPoint | null;
  highlightedSeries: string | null;
  setFilter: (f: ChartFilter) => void;
  clearFilter: () => void;
  setHoveredPoint: (p: HoveredPoint | null) => void;
  setHighlightedSeries: (s: string | null) => void;
  isFiltered: (type: FilterType, value: string) => boolean;
}

const ChartInteractionContext = createContext<ChartInteractionState>({
  filter: null,
  hoveredPoint: null,
  highlightedSeries: null,
  setFilter: () => {},
  clearFilter: () => {},
  setHoveredPoint: () => {},
  setHighlightedSeries: () => {},
  isFiltered: () => false,
});

export function ChartInteractionProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<ChartFilter | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [highlightedSeries, setHighlightedSeries] = useState<string | null>(null);

  const setFilter = useCallback((f: ChartFilter) => {
    setFilterState(prev => (prev?.type === f.type && prev?.value === f.value) ? null : f);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterState(null);
    setHighlightedSeries(null);
  }, []);

  const isFiltered = useCallback((type: FilterType, value: string) => {
    return filter?.type === type && filter?.value === value;
  }, [filter]);

  return (
    <ChartInteractionContext.Provider value={{
      filter, hoveredPoint, highlightedSeries,
      setFilter, clearFilter, setHoveredPoint, setHighlightedSeries, isFiltered,
    }}>
      {children}
    </ChartInteractionContext.Provider>
  );
}

export function useChartInteraction() {
  return useContext(ChartInteractionContext);
}

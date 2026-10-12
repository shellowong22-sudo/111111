/**
 * useChartTheme - 提供图表主题配置
 * 为 recharts 等图表库提供统一的暗色主题配置
 */
export function useChartTheme() {
  return {
    // 顶层快捷属性
    background: '#111827',
    grid: '#374151',
    axis: '#9ca3af',
    axisLabel: '#9ca3af',
    // 颜色配置
    colors: {
      primary: '#3b82f6',
      secondary: '#10b981',
      positive: '#10b981',
      negative: '#ef4444',
      danger: '#ef4444',
      warning: '#f59e0b',
      purple: '#a855f7',
      cyan: '#06b6d4',
      grid: '#374151',
      axis: '#9ca3af',
      tooltip: {
        bg: '#1f2937',
        border: '#374151',
        text: '#f9fafb',
      },
    },
    // 渐变配置
    gradients: {
      positive: 'rgba(16, 185, 129, 0.2)',
      negative: 'rgba(239, 68, 68, 0.2)',
      primary: 'rgba(59, 130, 246, 0.2)',
      secondary: 'rgba(16, 185, 129, 0.2)',
    },
    // Tooltip 配置
    tooltip: {
      background: '#1f2937',
      border: '#374151',
      text: '#f9fafb',
      bg: '#1f2937',
    },
    chartDefaults: {
      background: '#111827',
      gridColor: '#374151',
      axisColor: '#9ca3af',
      tooltipBg: '#1f2937',
    },
    getLineColor: (index: number) => {
      const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];
      return palette[index % palette.length];
    },
    tooltipStyle: {
      backgroundColor: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '6px',
      color: '#f9fafb',
    },
  };
}

export type ChartTheme = ReturnType<typeof useChartTheme>;

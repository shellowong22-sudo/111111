export type ResearchPathStep = { module: 'commodities' | 'forex' | 'indices' | 'economics'; itemId: string; label: string };
export type ResearchPathId = 'energy-fx-policy' | 'fx-index-macro' | 'commodity-seasonality-index';
export type ResearchPath = { id: ResearchPathId; label: string; description: string; steps: readonly ResearchPathStep[] };

export const CROSS_MODULE_RESEARCH_PATHS: readonly ResearchPath[] = [
  { id: 'energy-fx-policy', label: '能源冲击 → 汇率观察 → 政策背景', description: '在原油冲击、外汇信息与宏观政策工作区之间逐步核验公开观察。', steps: [{ module: 'commodities', itemId: 'oils', label: 'OILS 石油冲击' }, { module: 'forex', itemId: 'fxip', label: 'FXIP 外汇信息门户' }, { module: 'economics', itemId: 'fomc', label: 'FOMC 公开市场委员会' }] },
  { id: 'fx-index-macro', label: '外汇 → 指数 → 宏观情景', description: '用于从汇率参考观察进入指数工作区和宏观情景阅读，不推断因果或交易结论。', steps: [{ module: 'forex', itemId: 'fxip', label: 'FXIP 外汇信息门户' }, { module: 'indices', itemId: 'wbix', label: 'WBIX 世界债券指数' }, { module: 'economics', itemId: 'taylr', label: 'TAYLR 政策规则分析' }] },
  { id: 'commodity-seasonality-index', label: '商品季节性 → 指数工作区 → 央行观察', description: '先查看商品季节性，再转入指数与央行公开观察；缺失字段保持真实空状态。', steps: [{ module: 'commodities', itemId: 'seag', label: 'SEAG 季节性图' }, { module: 'indices', itemId: 'cix', label: 'CIX 自设指数库' }, { module: 'economics', itemId: 'cbrt', label: 'CBRT 央行利率分析' }] },
] as const;

export function resolveTerminalResearchPathHref(step: ResearchPathStep) {
  return `/?open=${encodeURIComponent(step.itemId)}&module=${encodeURIComponent(step.module)}`;
}

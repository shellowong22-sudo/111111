import { describe, expect, it } from 'vitest';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';
import { ADMIN_CRAWLER_CAPABILITY_CATALOG, ADMIN_CRAWLER_STRATEGIES, validateAdminCrawlerStrategies } from '../shared/adminCrawlerStrategies';

describe('terminal and sovereign submodule crawler strategy registry', () => {
  it('maps every preserved frontend module to a unique strategy, prompt and view', () => {
    const audit = validateAdminCrawlerStrategies();
    expect(ADMIN_DATA_MODULES).toHaveLength(338);
    expect(ADMIN_CRAWLER_STRATEGIES).toHaveLength(338);
    expect(audit).toMatchObject({ valid: true, missing: [], uniqueModuleIds: true, uniqueStrategyKeys: true, uniquePromptKeys: true, uniqueViewTypes: true });
  });

  it('keeps 24 sovereign functions independently selectable', () => {
    const sovereign = ADMIN_CRAWLER_STRATEGIES.filter((strategy) => strategy.moduleId.startsWith('sov-'));
    expect(sovereign).toHaveLength(24);
    expect(new Set(sovereign.map((strategy) => strategy.targetPath)).size).toBe(24);
  });

  it('assigns all 26 mortgage functions distinct specialist crawl semantics', () => {
    const mortgage = ADMIN_CRAWLER_STRATEGIES.filter((strategy) => strategy.moduleId.startsWith('mortgage-'));
    expect(mortgage).toHaveLength(26);
    expect(new Set(mortgage.map((strategy) => strategy.focus)).size).toBe(26);
    expect(new Set(mortgage.map((strategy) => strategy.processingSteps[2])).size).toBe(26);
    expect(mortgage.find((strategy) => strategy.moduleId === 'mortgage-09-market')?.queryTerms).toContain('Freddie Mac PMMS');
    expect(mortgage.find((strategy) => strategy.moduleId === 'mortgage-21-cmap')?.queryTerms).toContain('FHFA state HPI');
  });

  it('keeps every strategy pointed at the original module path and name', () => {
    for (const strategy of ADMIN_CRAWLER_STRATEGIES) {
      const module = ADMIN_DATA_MODULES.find((entry) => entry.id === strategy.moduleId);
      expect(module).toBeDefined();
      expect(strategy.moduleName).toBe(module?.name);
      expect(strategy.targetPath).toBe(module?.path);
      expect(strategy.transformationVersion).toContain(strategy.strategyKey.split(':')[1]);
      expect(strategy.contentLabel.length).toBeGreaterThan(3);
      expect(strategy.contentDescription.length).toBeGreaterThan(8);
      expect(strategy.targetLabel).toContain(strategy.moduleName);
      expect(strategy.processingSteps).toContain('AI 改写');
    }
  });

  it('covers the complete financial crawler capability catalog', () => {
    expect(ADMIN_CRAWLER_CAPABILITY_CATALOG).toHaveLength(18);
    expect(ADMIN_CRAWLER_CAPABILITY_CATALOG.map((item) => item.key)).toEqual(expect.arrayContaining(['global_news', 'equity_universe', 'fundamental_value', 'analyst_rating', 'dragon_tiger', 'fund_flow', 'quantitative', 'derivatives', 'ai_rewrite', 'auto_gap_scan']));
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = readFileSync(`${root}/client/src/components/econ/OfficialResearchWorkbench.tsx`, 'utf8');
const wrapper = readFileSync(`${root}/client/src/components/econ/EconomicDataHubPreservedRoute.tsx`, 'utf8');

describe('截图区域官方研究证据终端完全脱钩契约', () => {
  it('在保留双栏终端框架的前提下，将材料架、原文锚点、成对阅览和摘录册实现为不同研究操作', () => {
    expect(source).toContain('FEDS PRIMARY-TEXT READING DESK');
    expect(source).toContain('submitSearch');
    expect(source).toContain('THEMES');
    expect(source).toContain('data-research-publication-catalogue="true"');
    expect(source).toContain('selectForAnchoring');
    expect(source).toContain('togglePair');
    expect(source).toContain('runPairedReading');
    expect(source).toContain('data-research-evidence-extractor="true"');
    expect(source).toContain('data-research-comparison="true"');
    expect(source).toContain('data-anchor-breakdown="true"');
    expect(source).toContain('downloadDossier');
    expect(source).toContain('data-research-citation-package="true"');
    expect(source).toContain('URL.createObjectURL');
    expect(source).toContain('不输出系统比较结论');
  });

  it('以真实来源响应、筛选条件和恢复动作替代固定高度空白栏', () => {
    expect(source).toContain('data-research-empty-state="true"');
    expect(source).toContain('data-research-source-unavailable="true"');
    expect(source).toContain('OFFICIAL SOURCE UNAVAILABLE');
    expect(source).toContain('这不是筛选无匹配');
    expect(source).toContain('来源已成功读取');
    expect(source).toContain('清除条件');
    expect(source).toContain('重新读取官方源');
    expect(source).toContain('重新读取');
    expect(source).not.toContain('max-h-[620px]');
    expect(source).not.toContain('RESEARCH CATALOGUE / COMPARISON SLATE');
    expect(source).not.toContain('ON-DEMAND EVIDENCE EXTRACTION');
  });

  it('旧统一工作台的官方研究边界仍可审计，但当前保留路由不得挂载它', () => {
    expect(source).toContain('newsResearch.getOfficialFeed');
    expect(source).toContain('moneyMarketPolicy.inspectResearchDocument');
    expect(source).not.toMatch(/legacyMarketData|blsMacroEvidence|treasuryDailyYield|EconomicCalendar|MacroEvidenceWorkflowDesk|EconomicFieldSourceDirectory|window\.open|target="_blank"|https?:\/\//);
    expect(wrapper).not.toContain('OfficialResearchWorkbench');
  });
});

import { describe, expect, it } from 'vitest';
import { sovereignWorkflowCatalog } from '../client/src/lib/sovereignWorkflowCatalog';

describe('主权债差异化工作流目录', () => {
  it('完整覆盖目录的 24 个主功能', () => {
    expect(Object.keys(sovereignWorkflowCatalog).sort((a, b) => Number(a) - Number(b))).toEqual(Array.from({ length: 24 }, (_, index) => String(index + 1)));
  });

  it('每个功能都声明独立目标、数据依据、输出和风险边界', () => {
    for (const profile of Object.values(sovereignWorkflowCatalog)) {
      expect(profile.objective.length).toBeGreaterThan(8);
      expect(profile.dataBasis.length).toBeGreaterThan(5);
      expect(profile.output.length).toBeGreaterThan(5);
      expect(profile.guardrail.length).toBeGreaterThan(8);
    }
  });

  it('每个功能都提供可核验证据链、可视化观察、复核触发和每日事实字段', () => {
    for (const profile of Object.values(sovereignWorkflowCatalog)) {
      expect(profile.evidenceChain.length).toBeGreaterThanOrEqual(3);
      expect(profile.visualLens.length).toBeGreaterThanOrEqual(3);
      expect(profile.reviewTriggers.length).toBeGreaterThanOrEqual(3);
      expect(profile.dailyFacts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('交易、定价和新闻模块明确保留研究与执行边界', () => {
    expect(sovereignWorkflowCatalog['5'].guardrail).toContain('不自动下单');
    expect(sovereignWorkflowCatalog['20'].guardrail).toContain('不是可成交报价');
    expect(sovereignWorkflowCatalog['18'].guardrail).toContain('价格验证');
    expect(sovereignWorkflowCatalog['23'].dailyFacts).toContain('财政部拍卖数据');
    expect(sovereignWorkflowCatalog['7'].guardrail).toContain('不等于主权或单一 CDS 合约报价');
  });
});

import { describe, expect, it } from 'vitest';
import { validateStockSecSummary, validateStockWorkspaceLayout } from './stockMarketResearch';

const source = 'Revenue for the fiscal year ended September 30, 2025 was $100. The company faces risks related to supply chain disruption.';

describe('stock market SEC summary evidence guard', () => {
  it('retains only structured facts and risks with an exact source evidence fragment', () => {
    const summary = validateStockSecSummary({
      headline: '年度申报披露收入与供应链风险。',
      headlineEvidence: 'Revenue for the fiscal year ended September 30, 2025 was $100.',
      keyPoints: [{ point: '披露年度收入。', evidence: 'Revenue for the fiscal year ended September 30, 2025 was $100.' }],
      financialFacts: [{ label: '营业收入', period: '截至 2025-09-30 的财政年度', value: '$100', evidence: 'Revenue for the fiscal year ended September 30, 2025 was $100.' }],
      riskAlerts: [{ category: '供应链', evidence: 'risks related to supply chain disruption.' }],
      sourceLimitations: '仅依据当前主文件节选。',
    }, source);
    expect(summary?.financialFacts).toHaveLength(1);
    expect(summary?.riskAlerts).toHaveLength(1);
  });

  it('rejects a summary when every claimed evidence fragment is absent from the filing text', () => {
    const summary = validateStockSecSummary({
      headline: '无依据断言。',
      headlineEvidence: 'Management expects revenue to double next year.',
      keyPoints: [{ point: '预期增长。', evidence: 'Management expects revenue to double next year.' }],
      financialFacts: [],
      riskAlerts: [],
      sourceLimitations: '—',
    }, source);
    expect(summary).toBeNull();
  });

  it('rejects a headline with no independently verifiable source evidence', () => {
    const summary = validateStockSecSummary({
      headline: '无依据标题。',
      headlineEvidence: 'Revenue will grow 300% next year.',
      keyPoints: [{ point: '披露年度收入。', evidence: 'Revenue for the fiscal year ended September 30, 2025 was $100.' }],
      financialFacts: [],
      riskAlerts: [],
      sourceLimitations: '—',
    }, source);
    expect(summary).toBeNull();
  });

  it('accepts each workspace card exactly once and rejects duplicate or unknown card identifiers', () => {
    const valid = validateStockWorkspaceLayout({ layout: [
      { id: 'environment', visible: true }, { id: 'ticker', visible: true }, { id: 'issuer', visible: false }, { id: 'facts', visible: true }, { id: 'filing', visible: true },
    ] });
    const duplicate = validateStockWorkspaceLayout({ layout: [
      { id: 'environment', visible: true }, { id: 'environment', visible: true }, { id: 'issuer', visible: false }, { id: 'facts', visible: true }, { id: 'filing', visible: true },
    ] });
    const unknown = validateStockWorkspaceLayout({ layout: [
      { id: 'environment', visible: true }, { id: 'ticker', visible: true }, { id: 'issuer', visible: false }, { id: 'facts', visible: true }, { id: 'unsupported', visible: true },
    ] });
    expect(valid.success).toBe(true);
    expect(duplicate.success).toBe(false);
    expect(unknown.success).toBe(false);
  });
});

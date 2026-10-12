import { describe, expect, it } from 'vitest';
import { industryGroupPrivateResearchRouter } from './routers/industryGroupPrivateResearch';

describe('行业研究导入契约', () => {
  it('rejects duplicate recordId before writing a batch', async () => {
    const parse = industryGroupPrivateResearchRouter._def.procedures.importBatch._def.inputs[0]!;
    const result = parse.safeParse({ name: 'test', classification: 'GICS', sourceLabel: 'source', asOfAt: '2026-08-23T00:00:00Z', observations: [
      { recordId: 'same', industryGroup: '半导体', metric: '毛利率', value: 55, unit: '%', observedAt: '2026-08-23T00:00:00Z' },
      { recordId: 'same', industryGroup: '软件', metric: '毛利率', value: 65, unit: '%', observedAt: '2026-08-23T00:00:00Z' },
    ] });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const router = readFileSync(resolve(import.meta.dirname, 'routers/moneyMarketResearch.ts'), 'utf8');
const observability = readFileSync(resolve(import.meta.dirname, 'moneyMarketObservabilityDb.ts'), 'utf8');
const panel = readFileSync(resolve(import.meta.dirname, '../client/src/components/mm/MoneyMarketObservability.tsx'), 'utf8');

describe('公开来源读取延迟', () => {
  it('只记录实际读取耗时，并随可用率快照一起保存', () => {
    expect(router).toContain('async function measurePublicRead');
    expect(router).toContain('sourceLatencyMs');
    expect(observability).toContain('latencyMs: number | null');
    expect(observability).toContain('...probe, sampledAt');
    expect(observability).toContain('COALESCE(${moneyMarketSourceAvailabilitySnapshots.latencyMs}, ${probe.latencyMs})');
  });

  it('明确延迟不是上游发布时间或市场实时性，并展示趋势', () => {
    expect(panel).toContain('不等同于上游数据发布时间或市场实时性');
    expect(panel).toContain('实测读取延迟');
    expect(panel).toContain('medianLatency');
  });
});

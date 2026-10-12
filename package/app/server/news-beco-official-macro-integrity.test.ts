import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBecoOfficialMacroSnapshot } from './routers/newsResearch';

const observation = (
  id: string,
  label: string,
  unit: string,
  history: Array<{ observationDate: string; value: number }>,
) => ({ id, label, unit, status: 'available' as const, history });

describe('BECO official macro unique data contract', () => {
  it('keeps every official series in its own slice and removes duplicate series-period rows', () => {
    const snapshot = buildBecoOfficialMacroSnapshot([
      observation('EUROSTAT_GDP_EA20', '欧元区 GDP', '百万欧元', [
        { observationDate: '2024-01-01', value: 100 },
        { observationDate: '2024-01-01', value: 100 },
      ]),
      observation('BLS_CUUR0000SA0', '美国 CPI', '指数', [{ observationDate: '2024-02-01', value: 311.1 }]),
      observation('BLS_LNS14000000', '美国失业率', '%', [{ observationDate: '2024-03-01', value: 3.9 }]),
      observation('BOJ_CALL_RATE', '日本隔夜利率', '年率 %', [{ observationDate: '2024-04-01', value: 0.1 }]),
      observation('FED_INDPRO', '美国工业产出', '指数', [{ observationDate: '2024-05-01', value: 102.4 }]),
    ], '2026-09-21T00:00:00.000Z');

    expect(snapshot.dataContractId).toBe('news-beco-official-macro');
    expect(snapshot.dataStatus).toBe('available');
    expect(snapshot.growth).toHaveLength(1);
    expect(snapshot.inflation.map(point => point.label)).toEqual(['美国 CPI']);
    expect(snapshot.employment.map(point => point.label)).toEqual(['美国失业率']);
    expect(snapshot.rates.map(point => point.label)).toEqual(['日本隔夜利率']);
    expect(snapshot.cycle.map(point => point.label)).toEqual(['美国工业产出']);

    const slices = [snapshot.growth, snapshot.inflation, snapshot.employment, snapshot.rates, snapshot.cycle];
    const sliceLabels = slices.map(slice => new Set(slice.map(point => point.label)));
    for (let left = 0; left < sliceLabels.length; left += 1) {
      for (let right = left + 1; right < sliceLabels.length; right += 1) {
        expect([...sliceLabels[left]].filter(label => sliceLabels[right].has(label))).toEqual([]);
      }
    }
    for (const slice of slices) {
      const keys = slice.map(point => `${point.label}\u0000${point.period}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('returns explicit empty slices instead of fabricated fallback values', () => {
    const snapshot = buildBecoOfficialMacroSnapshot([], '2026-09-21T00:00:00.000Z');
    expect(snapshot.dataStatus).toBe('unavailable');
    expect(snapshot.growth).toEqual([]);
    expect(snapshot.inflation).toEqual([]);
    expect(snapshot.employment).toEqual([]);
    expect(snapshot.rates).toEqual([]);
    expect(snapshot.cycle).toEqual([]);
    expect(snapshot.limitation).toContain('不以 BECO 固定数组、随机数或相邻模块数据替代');
  });

  it('keeps the five existing tabs while removing static values, randomness and external navigation', () => {
    const source = readFileSync(new URL('../client/src/components/news/BECOPanel.tsx', import.meta.url), 'utf8');
    expect(source).toContain('trpc.newsResearch.getBecoOfficialMacroStatus.useQuery');
    for (const label of ['GDP增速', '通胀走势', '就业数据', '利率路径', '经济周期']) expect(source).toContain(label);
    expect(source).not.toMatch(/GDP_DATA|INFLATION_DATA|EMPLOYMENT_DATA|RATE_PATH|CYCLE_INDICATORS|Math\.random/);
    expect(source).not.toMatch(/window\.open|location\.href|target=["']_blank|https?:\/\//);
  });

  it('does not expose provider URLs or source fields through the BECO response contract', () => {
    const snapshot = buildBecoOfficialMacroSnapshot([
      observation('BOJ_CALL_RATE', '日本隔夜利率', '年率 %', [{ observationDate: '2024-04-01', value: 0.1 }]),
    ], '2026-09-21T00:00:00.000Z');
    const keys = new Set<string>();
    const visit = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        keys.add(key.toLowerCase());
        visit(child);
      }
    };
    visit(snapshot);
    expect(keys.has('url')).toBe(false);
    expect(keys.has('endpoint')).toBe(false);
    expect(keys.has('source')).toBe(false);
    expect(keys.has('sourceurl')).toBe(false);
  });
});

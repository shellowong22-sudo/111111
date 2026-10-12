import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INDEX_MODULE_CONFIG, INDEX_REFERENCE_SERIES, buildIndexModuleStudy, parseIndexFredCsv } from './routers/indexResearch';

describe('index terminal research layer', () => {
  it('parses only verifiable public FRED observations', () => {
    expect(parseIndexFredCsv('DATE,SP500\n2026-08-19,7600.10\n2026-08-20,.\n')).toEqual([{ date: '2026-08-19', value: 7600.1 }]);
  });

  it('keeps the real index study configuration available to the API layer', () => {
    const expected = ['SECF', 'HELP_INDX', 'WEI', 'WEIF', 'WBIX', 'GMM', 'IN', 'INP', 'CIX', 'CIXB', 'AGG', 'FDFD', 'OTHER_INDEX', 'RRG', 'WT', 'CIXN', 'CIXS', 'CIXR', 'CIXC', 'CIXX', 'CIXI', 'INDEX_DERIV', 'BBG'];
    expect(expected.every((moduleId) => moduleId in INDEX_MODULE_CONFIG)).toBe(true);
    expect(new Set(expected.map((moduleId) => INDEX_MODULE_CONFIG[moduleId as keyof typeof INDEX_MODULE_CONFIG].focus)).size).toBe(expected.length);
  });

  it('keeps unavailable series empty and derives timeline changes only from returned observations', () => {
    const sp500 = INDEX_REFERENCE_SERIES.find((row) => row.id === 'SP500')!;
    const nasdaq = INDEX_REFERENCE_SERIES.find((row) => row.id === 'NASDAQCOM')!;
    const study = buildIndexModuleStudy('WEI', [
      { ...sp500, status: 'available', latest: 110, observationDate: '2026-01-02', change: 10, history: [{ date: '2026-01-01', value: 100 }, { date: '2026-01-02', value: 110 }] },
      { ...nasdaq, status: 'unavailable', latest: null, observationDate: null, change: null, history: [] },
    ], '1y');
    expect(study.readings).toMatchObject([{ id: 'SP500', windowChangePercent: 10 }, { id: 'NASDAQCOM', latest: null, historyPoints: 0 }]);
    expect(study.timeline).toEqual([{ date: '2026-01-01', value_SP500: 100, base100_SP500: 100 }, { date: '2026-01-02', value_SP500: 110, base100_SP500: 110 }]);
  });

  it('does not append a duplicate research drill-down layer to the original index workspace', () => {
    const preserved = readFileSync(join(process.cwd(), 'client/src/components/index/IndexPreservedModule.tsx'), 'utf8');
    expect(existsSync(join(process.cwd(), 'client/src/components/index/IndexResearchLayer.tsx'))).toBe(false);
    expect(preserved).not.toContain('IndexResearchLayer');
    expect(preserved).toContain('return <div className="min-h-full">{children}</div>');
  });
});

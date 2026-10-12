import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseFredObservations } from './fredObservationParser';
import { parseFredCsv, preferredStockResearchRouter } from './routers/preferredStockResearch';
import { parseStockFredCsv, stockMarketResearchRouter } from './routers/stockMarketResearch';

describe('FRED observation normalization', () => {
  it('orders dates, removes duplicate observations, and keeps the last valid revision', () => {
    const parsed = parseFredObservations('DATE,DGS10\n2020-08-19,4.71\n2020-08-18,4.68\n2020-08-19,4.71\n2020-08-19,4.72\n2020-08-19, \n', 'DGS10', '2020-08-20');
    expect(parsed.history).toEqual([{ date: '2020-08-18', value: 4.68 }, { date: '2020-08-19', value: 4.72 }]);
    expect(parsed.quality).toMatchObject({ duplicateRows: 1, revisionRows: 1, missingRows: 1, rejectedRows: 0 });
  });

  it('rejects invalid/future dates, non-decimal values and malformed rows without converting blanks to zero', () => {
    const parsed = parseFredObservations('DATE,DGS10\n2020-02-30,9\n2020-13-01,9\ninvalid,9\n2099-01-01,9\n2020-08-18,Infinity\n2020-08-18,NaN\n2020-08-18,0x10\n2020-08-18,1,2\n2020-08-18, \n2020-08-18,.\n2020-08-18,NA\n2020-08-18,null\n2020-08-19,0\n2020-08-20,-.25\n', 'DGS10', '2020-08-20');
    expect(parsed.history).toEqual([{ date: '2020-08-19', value: 0 }, { date: '2020-08-20', value: -0.25 }]);
    expect(parsed.quality).toMatchObject({ rejectedRows: 8, missingRows: 4 });
  });

  it('uses the requested series column and supports BOM, quoted cells, CRLF and scientific notation', () => {
    const parsed = parseFredObservations('\uFEFF"DGS2","observation_date","DGS10"\r\n"9","2020-08-18","4.68e0"\r\n', 'DGS10', '2020-08-20');
    expect(parsed.history).toEqual([{ date: '2020-08-18', value: 4.68 }]);
    expect(parsed.quality.headerValid).toBe(true);
  });

  it('rejects a wrong series or an HTML error response rather than labeling it as source data', () => {
    for (const payload of ['DATE,DGS2\n2020-08-18,9\n', '<html>request blocked</html>', '2020-08-18,9']) {
      const parsed = parseFredObservations(payload, 'DGS10', '2020-08-20');
      expect(parsed.history).toEqual([]);
      expect(parsed.quality.headerValid).toBe(false);
    }
  });
});

const parsers = [
  { name: 'preferred stocks', parse: (csv: string) => parseFredCsv(csv, { id: 'DGS10', label: '10 年期国债参照', group: 'rate' }) },
  { name: 'stocks', parse: (csv: string) => parseStockFredCsv(csv, { id: 'DGS10', label: '10 年期国债', group: 'rates' }) },
];

describe.each(parsers)('$name environment series contract', ({ parse }) => {
  it('derives latest/change from unique chronological observations, and explicitly labels historical data', () => {
    const data = parse('DATE,DGS10\n2020-08-20,4.74\n2020-08-18,4.68\n2020-08-19,4.71\n2020-08-19,4.71\n');
    expect(data.value).toBe(4.74);
    expect(data.observationDate).toBe('2020-08-20');
    expect(data.history).toHaveLength(3);
    expect('changeBps' in data ? data.changeBps : data.change).toBe('changeBps' in data ? 3 : 0.03);
    expect(data).toMatchObject({ source: 'FRED', indicatorId: 'fred:DGS10', unit: '%', realtime: false, frequency: 'daily', status: 'available' });
  });

  it('caps the chronological history at 180 genuine points and excludes duplicate rows', () => {
    const rows = Array.from({ length: 200 }, (_, index) => `${new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10)},${index}`);
    const data = parse(`DATE,DGS10\n${[...rows].reverse().join('\n')}\n${rows[0]}\n`);
    expect(data.history).toHaveLength(180);
    expect(data.history[0].value).toBe(20);
    expect(data.value).toBe(199);
    expect(new Set(data.history.map((point) => point.date)).size).toBe(180);
  });

  it('keeps missing-only payloads unavailable and never emits a synthetic zero observation', () => {
    const data = parse('DATE,DGS10\n2020-08-18, \n2020-08-19,.\n');
    expect(data).toMatchObject({ value: null, observationDate: null, status: 'unavailable', history: [], realtime: false });
    expect('changeBps' in data ? data.changeBps : data.change).toBeNull();
  });
});

describe('research environment route refresh and source failure', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it.each([
    { name: 'preferred', count: 7, run: () => preferredStockResearchRouter.createCaller({} as never).getMarketEnvironment() },
    { name: 'stock', count: 4, run: () => stockMarketResearchRouter.createCaller({} as never).getEnvironment() },
  ])('$name keeps retrieval time distinct, coalesces requests and exposes failed/partial sources', async ({ run, count }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-09-10T00:00:00.000Z'));
    let version = 1;
    let state: 'ok' | 'failed' | 'partial' = 'ok';
    const fetchStub = vi.fn(async (url: string) => {
      const id = new URL(url).searchParams.get('id')!;
      if (state === 'failed' || state === 'partial' && id !== 'DGS10') throw new Error('TEST_SOURCE_OFFLINE');
      return { ok: true, text: async () => `DATE,${id}\n2020-08-18,4\n2020-08-19,${version}\n` };
    });
    vi.stubGlobal('fetch', fetchStub);
    const [first, concurrent] = await Promise.all([run(), run()]);
    expect(fetchStub).toHaveBeenCalledTimes(count);
    expect(concurrent).toEqual(first);
    expect(first).toMatchObject({ asOf: '2030-09-10T00:00:00.000Z', retrievedAt: '2030-09-10T00:00:00.000Z', observationMode: 'historical', refreshAfterMs: 30_000, schemaVersion: 1, sourceStatus: 'available' });
    expect(first.series.every((item: any) => item.observationDate === '2020-08-19' && item.realtime === false)).toBe(true);

    vi.setSystemTime(new Date('2030-09-10T00:00:29.999Z'));
    expect(await run()).toEqual(first);
    expect(fetchStub).toHaveBeenCalledTimes(count);

    version = 2;
    vi.setSystemTime(new Date('2030-09-10T00:00:30.001Z'));
    const refreshed = await run();
    expect(fetchStub).toHaveBeenCalledTimes(2 * count);
    expect(refreshed.series.every((item: any) => item.value === 2)).toBe(true);
    expect(refreshed.retrievedAt).not.toBe(first.retrievedAt);

    state = 'failed';
    vi.setSystemTime(new Date('2030-09-10T00:01:01.000Z'));
    const failed = await run();
    expect(failed.sourceStatus).toBe('unavailable');
    expect(failed.series.every((item: any) => item.value === null && item.history.length === 0 && item.realtime === false)).toBe(true);

    state = 'partial';
    vi.setSystemTime(new Date('2030-09-10T00:01:32.000Z'));
    const partial = await run();
    expect(partial.sourceStatus).toBe('partial');
    expect(partial.series.filter((item: any) => item.status === 'available').map((item: any) => item.id)).toEqual(['DGS10']);
  });
});

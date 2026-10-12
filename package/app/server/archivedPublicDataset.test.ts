import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock('./db', () => ({ getDb: vi.fn(async () => null) }));
vi.mock('./publicDatasetPersistence', () => ({ readPublicDatasetObservations: vi.fn(async () => []) }));
vi.mock('./aksharePersistence', () => ({ readAkShareObservations: vi.fn(async () => []) }));
import { getDb } from './db';
import { readAkShareObservations } from './aksharePersistence';
import { projectArchivedPublicObservations, readArchivedPublicDataset } from "./archivedPublicDataset";

describe("archived public dataset contract", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reports missing storage without fabricating observations", async () => {
    await expect(readArchivedPublicDataset("rates.us.sofr.fred.v1")).resolves.toMatchObject({ available: false, status: 'storage_unavailable', observations: [] });
  });
  it("rejects unknown contract without querying a provider", async () => {
    await expect(readArchivedPublicDataset("not-a-contract")).resolves.toMatchObject({
      available: false, status: "not_configured", observations: [],
    });
    expect(getDb).not.toHaveBeenCalled();
  });
  it('selects latest revisions and strips raw URLs and private provenance', () => {
    const fetchedAt = new Date('2026-09-21T00:00:00Z');
    const result = projectArchivedPublicObservations([
      { id: 1, observationDate: '2026-08', fetchedAt, payload: { value: 5 } },
      { id: 3, observationDate: '2026-08', fetchedAt, payload: { value: 4, sourceUrl: 'https://example.com', secret: 'hidden' } },
      { id: 2, observationDate: '2026-07', fetchedAt, payload: { value: '3' } },
    ]);
    expect(result).toEqual([
      { date: '2026-07', retrievedAt: fetchedAt.toISOString(), source: null, payload: { value: '3' } },
      { date: '2026-08', retrievedAt: fetchedAt.toISOString(), source: null, payload: { value: 4 } },
    ]);
    expect(JSON.stringify(result)).not.toContain('savedAt');
    expect(JSON.stringify(result)).not.toContain('sourceUrl');
  });
  it('removes legacy wording from a saved underlying name without altering the archived record', () => {
    const payload = { underlyingName: '台湾加权股价指数（非个股）', contractName: '台股指数选择权' };
    const rows = projectArchivedPublicObservations([{
      id: 1, symbol: 'TXO', observationDate: '2026-09-24',
      fetchedAt: new Date('2026-09-24T00:00:00Z'), payload,
    }]);
    expect(rows[0].payload.underlyingName).toBe('台湾加权股价指数');
    expect(payload.underlyingName).toBe('台湾加权股价指数（非个股）');
  });
  it('projects only verified Chinese index sessions while retaining older ledger revisions for audit', async () => {
    vi.mocked(readAkShareObservations).mockResolvedValueOnce([
      {
        moduleId: 'index-hub', dataContractId: 'index.cn.snapshot.akshare.v1',
        symbol: '000001', observationDate: '2026-10-01', fetchedAt: '2026-10-01T08:00:00Z',
        source: 'public', sourceReference: '', contentHash: 'a',
        payload: { symbol: '000001', value: 999, frequency: 'unverified' },
      },
      {
        moduleId: 'index-hub', dataContractId: 'index.cn.snapshot.akshare.v1',
        symbol: '000001', observationDate: '2026-09-30', fetchedAt: '2026-09-30T08:00:00Z',
        source: 'public', sourceReference: '', contentHash: 'b',
        payload: { symbol: '000001', value: 3882.78, frequency: 'verified_market_session' },
      },
    ]);
    const result = await readArchivedPublicDataset('index.cn.snapshot.akshare.v1');
    expect(result.observations).toEqual([{
      date: '2026-09-30',
      retrievedAt: '2026-09-30T08:00:00.000Z',
      source: 'public',
      payload: {
        value: 3882.78, symbol: '000001', frequency: 'verified_market_session',
      },
    }]);
    expect(readAkShareObservations).toHaveBeenCalledWith('index.cn.snapshot.akshare.v1', 10_000);
  });
});

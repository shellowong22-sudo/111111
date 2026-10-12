import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const csv = (value: number) => `TIME_PERIOD,OBS_VALUE\n2026-09-18,${value}`;

describe('ECB reference refresh and observation integrity', () => {
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-21T00:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  async function setup(body = csv(1.1)) {
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => body });
    vi.stubGlobal('fetch', fetch);
    const { ecbForeignExchangeRouter } = await import('./routers/ecbForeignExchange');
    return { fetch, caller: ecbForeignExchangeRouter.createCaller({} as any) };
  }
  it('polling never extends cache lifetime and timestamps only change on an upstream read', async () => {
    const { fetch, caller } = await setup();
    const first = await caller.getReferenceRates();
    expect(fetch).toHaveBeenCalledTimes(7);
    for (let minute = 1; minute < 5; minute++) {
      vi.setSystemTime(new Date(`2026-09-21T00:0${minute}:00Z`));
      expect((await caller.getReferenceRates()).fetchedAt).toBe(first.fetchedAt);
    }
    expect(fetch).toHaveBeenCalledTimes(7);
    fetch.mockResolvedValue({ ok: true, text: async () => csv(1.2) });
    vi.setSystemTime(new Date('2026-09-21T00:05:00Z'));
    const updated = await caller.getReferenceRates();
    expect(fetch).toHaveBeenCalledTimes(14);
    expect(updated.rows[0].rate).toBe(1.2);
    expect(updated.fetchedAt).not.toBe(first.fetchedAt);
  });
  it('coalesces concurrent refreshes into one upstream batch', async () => {
    const { fetch, caller } = await setup();
    const results = await Promise.all([caller.getReferenceRates(), caller.getReferenceRates(), caller.getReferenceRates()]);
    expect(fetch).toHaveBeenCalledTimes(7);
    expect(results[0]).toEqual(results[2]);
  });
  it('retries failed batches after 30 seconds without turning them into observations', async () => {
    const { fetch, caller } = await setup();
    fetch.mockRejectedValue(new Error('offline'));
    expect((await caller.getReferenceRates()).available).toBe(false);
    fetch.mockResolvedValue({ ok: true, text: async () => csv(1.3) });
    vi.setSystemTime(new Date('2026-09-21T00:00:31Z'));
    expect((await caller.getReferenceRates()).rows[0].rate).toBe(1.3);
    expect(fetch).toHaveBeenCalledTimes(14);
  });
  it('rejects blank/zero/invalid observations and conflicting duplicate dates', async () => {
    const body = 'TIME_PERIOD,OBS_VALUE\n2026-09-18,1.1\n2026-09-18,1.1\n2026-09-19,\n2026-09-20,0\n2026-02-30,2\n2026-09-17,1.2\n2026-09-17,1.3';
    const { caller } = await setup(body);
    const result = await caller.getReferenceRates();
    expect(result.rows[0].history).toEqual([{ date: '2026-09-18', value: 1.1 }]);
    expect(result.rows[0].change7dPct).toBeNull();
  });
});

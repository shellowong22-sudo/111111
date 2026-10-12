import {afterEach,describe,expect,it,vi} from 'vitest';
// Isolate archive IO: mocked economic observations must never enter production archives.
vi.mock('node:fs/promises',()=>({mkdir:vi.fn(),readFile:vi.fn().mockRejectedValue(Object.assign(new Error('absent'),{code:'ENOENT'})),writeFile:vi.fn()}));
vi.mock('./atomicFileReplace',()=>({replaceFileWithRetry:vi.fn()}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();});
describe('economic manual refresh',()=>{
 it('bypasses ordinary cache, coalesces parallel reads and limits repeated manual requests',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-19T00:00:00Z'));
  let value=15;
  const fetch=vi.fn(async()=>({ok:true,text:async()=>`observation_date,VIXCLS\n2026-09-17,${value}`}));vi.stubGlobal('fetch',fetch);
  const {getEconomicSeries}=await import('./economicObservationService');
  const first=await getEconomicSeries('VIXCLS');
  vi.setSystemTime(new Date('2026-09-19T00:01:00Z'));value=16;
  expect(await getEconomicSeries('VIXCLS')).toEqual(first);
  const [fresh,parallel]=await Promise.all([getEconomicSeries('VIXCLS',true),getEconomicSeries('VIXCLS',true)]);
  expect(fresh).toEqual(parallel);expect(fresh.history[0].value).toBe(16);
  expect(fresh.retrievedAt).toBe('2026-09-19T00:01:00.000Z');
  expect(fetch).toHaveBeenCalledTimes(2);
  await getEconomicSeries('VIXCLS',true);expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('does not report failed refresh as available or modify the immutable archive',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-19T00:00:00Z'));
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('upstream offline')));
  const {getEconomicSeries}=await import('./economicObservationService');
  const data=await getEconomicSeries('STLFSI4',true);
  expect(data.status).toBe('unavailable');expect(data.history).toEqual([]);expect(data.error).toContain('offline');
 });
 it('retains last good history and acquisition time across failed refreshes, then recovers',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-19T00:00:00Z'));
  const fetch=vi.fn().mockResolvedValue({ok:true,text:async()=> 'observation_date,VIXCLS\n2026-09-17,15'});
  vi.stubGlobal('fetch',fetch);
  const {getEconomicSeries}=await import('./economicObservationService');
  const first=await getEconomicSeries('VIXCLS');
  const {writeFile}=await import('node:fs/promises');const writes=vi.mocked(writeFile).mock.calls.length;
  fetch.mockRejectedValue(new Error('offline'));
  vi.advanceTimersByTime(60_000);
  const failed=await getEconomicSeries('VIXCLS',true);
  expect(failed.status).toBe('unavailable');expect(failed.history).toEqual(first.history);
  expect(failed.retrievedAt).toBe(first.retrievedAt);expect(failed.checksum).toBe(first.checksum);
  expect(vi.mocked(writeFile).mock.calls.length).toBe(writes);
  vi.advanceTimersByTime(60_000);
  expect((await getEconomicSeries('VIXCLS',true)).history).toEqual(first.history);
  fetch.mockResolvedValue({ok:true,text:async()=> 'observation_date,VIXCLS\n2026-09-17,16'});
  vi.advanceTimersByTime(60_000);
  const recovered=await getEconomicSeries('VIXCLS',true);
  expect(recovered.status).toBe('available');expect(recovered.error).toBeNull();
  expect(recovered.history[0].value).toBe(16);expect(recovered.retrievedAt).not.toBe(first.retrievedAt);
 });
});

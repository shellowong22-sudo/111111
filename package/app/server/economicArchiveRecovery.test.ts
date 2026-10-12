import {createHash} from 'node:crypto';
import {afterEach,describe,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({readFile:vi.fn(),writeFile:vi.fn(),mkdir:vi.fn()}));
vi.mock('node:fs/promises',()=>io);
vi.mock('./atomicFileReplace',()=>({replaceFileWithRetry:vi.fn()}));
const history=[{date:'2010-01-01',value:20},{date:'2026-09-17',value:15}];
const archived=()=>({id:'VIXCLS',label:'VIX 恐慌指数',unit:'指数点',frequency:'工作日',status:'available',sourceUrl:'internal-provenance',retrievedAt:'2026-09-18T00:00:00Z',history,checksum:createHash('sha256').update(JSON.stringify(history)).digest('hex')});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();vi.resetModules();});
async function offline(data:unknown){
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-19T00:00:00Z'));
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 io.readFile.mockResolvedValue(JSON.stringify(data));
 const {getEconomicSeries}=await import('./economicObservationService');
 return getEconomicSeries('VIXCLS');
}
describe('economic observation cold-start recovery',()=>{
 it('retains verified history across process restarts without relabelling it as a successful update',async()=>{
  const result=await offline(archived());
  expect(result.history).toEqual(history.slice(1));expect(result.status).toBe('unavailable');
  expect(result.retrievedAt).toBe('2026-09-18T00:00:00Z');expect(result.error).toBe('offline');
  expect(io.writeFile).not.toHaveBeenCalled();
 });
 it.each([
  ['wrong series',{id:'STLFSI4'}],['wrong units',{unit:'%'}],['future acquisition',{retrievedAt:'2099-01-01T00:00:00Z'}],
  ['altered contents',{history:[{date:'2026-09-17',value:999}]}],['invalid checksum',{checksum:'bad'}],
 ])('rejects %s instead of importing unverified archived values',async(_label,patch)=>{
  const result=await offline({...archived(),...patch});expect(result.history).toEqual([]);expect(result.status).toBe('unavailable');
 });
});

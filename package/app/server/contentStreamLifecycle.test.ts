import {EventEmitter} from 'node:events';
import {afterEach, describe, expect, it, vi} from 'vitest';
const stubs=vi.hoisted(()=>({feeds:vi.fn(),refreshes:vi.fn().mockResolvedValue([])}));
vi.mock('./_core/sdk',()=>({sdk:{authenticateRequest:vi.fn().mockResolvedValue({id:1,role:'admin'})}}));
vi.mock('./adminModulePublicFeed',()=>({getPublicFeedsForPath:stubs.feeds,getPublicRefreshSignalsForPath:stubs.refreshes,publicFeedSignature:()=> 'empty'}));
vi.mock('./db',()=>({getDb:vi.fn()}));
vi.mock('./storage',()=>({storagePut:vi.fn()}));
vi.mock('./realDataService',()=>({fetchMultipleFred:vi.fn()}));
import {registerUploadAndSse} from './uploadAndSse';
function fixture(){
 const routes=new Map<string,Function>();
 registerUploadAndSse({get:(path:string,fn:Function)=>routes.set(path,fn),post:vi.fn()} as never);
 const req=Object.assign(new EventEmitter(),{query:{path:'/econ-hub?tab=ecsu'}});
 const res=Object.assign(new EventEmitter(),{setHeader:vi.fn(),flushHeaders:vi.fn(),write:vi.fn(),writableEnded:false,destroyed:false});
 return {req,res,run:()=>routes.get('/api/terminal/content-stream')!(req,res)};
}
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
describe('content SSE lifecycle',()=>{
 it('cleans a connection closed during the first pending read without creating orphan timers',async()=>{
  vi.useFakeTimers();let resolve!:(data:[])=>void;
  stubs.feeds.mockReturnValue(new Promise<[]>(done=>{resolve=done;}));
  const {req,res,run}=fixture();const running=run();await Promise.resolve();
  req.emit('close');resolve([]);await running;
  expect(res.write).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
 });
 it('does not overlap slow database reads and removes polling/heartbeat on close',async()=>{
  vi.useFakeTimers();stubs.feeds.mockResolvedValueOnce([]).mockImplementation(()=>new Promise(()=>{}));
  const {res,run}=fixture();await run();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(stubs.feeds).toHaveBeenCalledTimes(2);
  res.emit('close');expect(vi.getTimerCount()).toBe(0);
 });
});

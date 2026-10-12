import { it,expect,vi } from 'vitest';
import { replaceFileWithRetry } from './atomicFileReplace';
it('retries only transient Windows sharing failures',async()=>{
 const replace=vi.fn().mockRejectedValueOnce({code:'EPERM'}).mockResolvedValue(undefined);const pause=vi.fn().mockResolvedValue(undefined);
 await replaceFileWithRetry('a','b',replace,pause);expect(replace).toHaveBeenCalledTimes(2);expect(pause).toHaveBeenCalledWith(50);
});
it('does not turn permanent failures into success',async()=>{
 const replace=vi.fn().mockRejectedValue({code:'ENOENT'});
 await expect(replaceFileWithRetry('a','b',replace,async()=>{})).rejects.toEqual({code:'ENOENT'});expect(replace).toHaveBeenCalledTimes(1);
});

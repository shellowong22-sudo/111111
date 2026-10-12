import { rename } from 'node:fs/promises';
/** Windows readers/virus scanners can transiently hold the destination. */
export async function replaceFileWithRetry(source:string,target:string,replace=rename,pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){
  for(let attempt=0;;attempt++){
    try{await replace(source,target);return;}
    catch(error){
      const code=(error as NodeJS.ErrnoException).code;
      if(attempt>=5||!['EPERM','EACCES','EBUSY'].includes(code??''))throw error;
      await pause(50*2**attempt);
    }
  }
}

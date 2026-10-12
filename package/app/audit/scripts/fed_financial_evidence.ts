import {getFedFinancialStatements} from '../../server/fedFinancialStatements';
import {PDFParse} from 'pdf-parse';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

async function main(){
  const snapshot=await getFedFinancialStatements();
  const root=path.resolve('recovery-evidence/api-expansion-20260919');
  await writeFile(path.join(root,'fed-financial-live.json'),JSON.stringify(snapshot,null,2));
  const folder=path.resolve('.runtime/fed-financial-statements',String(snapshot.reportYear));
  const archive=JSON.parse(await readFile(path.join(folder,snapshot.contentVersion+'.json'),'utf8'));
  const parser=new PDFParse({data:new Uint8Array(await readFile(path.join(folder,archive.documentVersion+'.pdf')))});
  try{
    const shots=await parser.getScreenshot({partial:[archive.pages.operations,archive.pages.distribution],scale:1.4});
    for(const page of shots.pages)await writeFile(path.join(root,`fed-report-page-${page.pageNumber}.png`),page.data);
  }finally{await parser.destroy();}
  console.log(JSON.stringify({reportYear:snapshot.reportYear,rows:snapshot.rows,contentVersion:snapshot.contentVersion,archiveFiles:(await readdir(folder)).length},null,2));
}
void main().catch(error=>{console.error(error);process.exitCode=1;});

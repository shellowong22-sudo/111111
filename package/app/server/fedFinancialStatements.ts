import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { FED_FINANCIAL_FIELDS, type FedFinancialYear, type FedFinancialSnapshot } from '../shared/fedFinancialStatements';

const INDEX_URL = 'https://www.federalreserve.gov/aboutthefed/audited-annual-financial-statements.htm';
let cached: { at: number; value: FedFinancialSnapshot } | undefined;
let pending: Promise<FedFinancialSnapshot> | undefined;

export function discoverFedReport(html: string): { year: number; url: string } {
  const reports = [...html.matchAll(/href\s*=\s*["']([^"']*\/combinedfinstmt(20\d{2})\.pdf)["']/gi)]
    .map(m => ({ year: Number(m[2]), url: new URL(m[1], INDEX_URL).href }))
    .filter(r => new URL(r.url).origin === 'https://www.federalreserve.gov');
  reports.sort((a,b) => b.year-a.year);
  if (!reports.length) throw new Error('FED_REPORT_LINK_NOT_FOUND');
  return reports[0];
}

// Last two numeric cells are year columns; preceding numbers are note references.
function pair(text: string, pattern: RegExp): [number, number] {
  const lines = text.split(/\r?\n/).filter(line => pattern.test(line.trim()));
  if (lines.length !== 1) throw new Error('FED_REPORT_FIELD_AMBIGUOUS: '+pattern.source);
  const cells = lines[0].match(/\(?-?\d[\d,]*(?:\.\d+)?\)?|[—–]/g) ?? [];
  if (cells.length < 2) throw new Error('FED_REPORT_VALUE_MISSING: '+pattern.source);
  const values = cells.slice(-2).map(cell => {
    if (/^[—–]$/.test(cell)) return 0;
    const value = Number(cell.replace(/[,()]/g, ''));
    if (!Number.isFinite(value)) throw new Error('FED_REPORT_NON_NUMERIC');
    return cell.startsWith('(') ? -value : value;
  });
  return [values[0], values[1]];
}

export function parseFedFinancialPages(pages: Array<{ text: string; num: number }>, reportYear: number) {
  const operations = pages.filter(p => /^Combined Statements of Operations for the years ended/m.test(p.text) && p.text.includes('Total interest income'));
  const distribution = pages.filter(p => /^Remittances transferred to the Treasury/m.test(p.text));
  if (operations.length !== 1 || distribution.length !== 1) throw new Error('FED_REPORT_REQUIRED_TABLE_MISSING');
  const op = operations[0], note = distribution[0];
  if (![op, note].every(p => /\(in millions\)/i.test(p.text))) throw new Error('FED_REPORT_UNITS_MISMATCH');
  const years = op.text.match(/years ended December 31, (\d{4}) and December 31, (\d{4})/);
  if (!years || Number(years[1]) !== reportYear || Number(years[2]) !== reportYear-1 || !new RegExp(reportYear+'\\s+'+(reportYear-1)).test(note.text)) throw new Error('FED_REPORT_YEAR_MISMATCH');
  const extracted = {
    interestIncome: pair(op.text, /^Total interest income\s/),
    treasuryInterest: pair(op.text, /^Treasury securities, net\s/),
    mbsInterest: pair(op.text, /^Federal agency and government-sponsored enterprise mortgage-backed securities, net\s/),
    interestExpense: pair(op.text, /^Total interest expense\s/),
    reserveInterestExpense: pair(op.text, /^Depository institutions and others\s/),
    repoInterestExpense: pair(op.text, /^Securities sold under agreements to repurchase\s/),
    netInterest: pair(op.text, /^Net interest (?:expense|income)\s/),
    otherIncome: pair(op.text, /^Total other items of income(?: \(loss\))?\s/),
    operatingExpenses: pair(op.text, /^Total operating expenses\s/),
    operatingNet: pair(op.text, /^Reserve Bank net (?:loss|income) from operations\s/),
    remittances: pair(note.text, /^Remittances transferred to the Treasury\s/),
    deferredAssetChange: pair(note.text, /^Deferred asset (?:increase|decrease)\s/),
    remittanceAccrual: pair(note.text, /^Earnings remittances to the Treasury, net\s/),
    netIncomeAfterRemittances: pair(op.text, /^Net income after providing for remittances to the Treasury\s/),
  };
  const rows: FedFinancialYear[] = [reportYear, reportYear-1].map((year,i) => ({ year, ...Object.fromEntries(Object.entries(extracted).map(([key,values]) => [key, values[i]])) } as FedFinancialYear));
  for (const row of rows) {
    if (Math.abs(row.interestIncome-row.interestExpense-row.netInterest)>1 ||
      Math.abs(row.netInterest+row.otherIncome-row.operatingExpenses-row.operatingNet)>1 ||
      Math.abs(row.remittances+row.deferredAssetChange-row.remittanceAccrual)>1) throw new Error('FED_REPORT_ACCOUNTING_RECONCILIATION_FAILED');
  }
  return { rows, pages: { operations: op.num, distribution: note.num } };
}

async function fetchBounded(url: string, maxBytes: number) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25_000), redirect: 'error' });
  if (!response.ok) throw new Error('FED_REPORT_HTTP_'+response.status);
  if (Number(response.headers.get('content-length') ?? 0)>maxBytes) throw new Error('FED_REPORT_TOO_LARGE');
  const reader=response.body?.getReader(); if(!reader) throw new Error('FED_REPORT_EMPTY');
  const chunks: Uint8Array[]=[]; let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new Error('FED_REPORT_TOO_LARGE');chunks.push(value);} }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}

async function readReport(): Promise<FedFinancialSnapshot> {
  const report=discoverFedReport((await fetchBounded(INDEX_URL,2_000_000)).toString('utf8'));
  const bytes=await fetchBounded(report.url,20_000_000);
  if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('FED_REPORT_NOT_PDF');
  const parser=new PDFParse({data:new Uint8Array(bytes)});
  try {
    const text=await parser.getText();
    const parsed=parseFedFinancialPages(text.pages,report.year);
    const retrievedAt=new Date().toISOString();
    const contentVersion=createHash('sha256').update(JSON.stringify(parsed.rows)).digest('hex');
    const documentVersion=createHash('sha256').update(bytes).digest('hex');
    const folder=path.resolve('.runtime','fed-financial-statements',String(report.year));
    await mkdir(folder,{recursive:true});
    for(const [file,data] of [[documentVersion+'.pdf',bytes],[contentVersion+'.json',JSON.stringify({...parsed,sourceUrl:report.url,retrievedAt,contentVersion,documentVersion,fields:FED_FINANCIAL_FIELDS},null,2)]] as const){
      try{await writeFile(path.join(folder,file),data,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
    }
    return { retrievedAt,reportYear:report.year,contentVersion,rows:parsed.rows,unit:'百万美元',frequency:'年度审计',status:'available' };
  } finally {await parser.destroy();}
}

export async function getFedFinancialStatements(): Promise<FedFinancialSnapshot> {
  if(cached&&Date.now()-cached.at<3600_000)return cached.value;
  if(pending)return pending;
  pending=readReport().then(value=>{cached={at:Date.now(),value};return value;}).finally(()=>{pending=undefined;});
  return pending;
}

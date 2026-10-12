import { createHash } from 'crypto';
import { desc } from 'drizzle-orm';
import { getDb } from './db';
import { forexCentralBankDecisionEvents } from '../drizzle/schema';

type CentralBankId = 'FED' | 'ECB' | 'BOE' | 'BOJ' | 'SNB' | 'BOC' | 'RBA' | 'RBNZ';
type Source = { centralBankId: CentralBankId; centralBankName: string; currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NZD'; sourceUrl: string; decisionDate?: string; format?: 'html' | 'pdf' };
type PolicyRate = { key: string; label: string; ratePct: number; minRatePct?: number; maxRatePct?: number };

const SOURCES: Source[] = [
  { centralBankId: 'FED', centralBankName: '美联储 FOMC', currency: 'USD', decisionDate: '2026-07-29', sourceUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm' },
  { centralBankId: 'FED', centralBankName: '美联储 FOMC', currency: 'USD', decisionDate: '2026-06-17', sourceUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm' },
  { centralBankId: 'ECB', centralBankName: '欧洲央行', currency: 'EUR', decisionDate: '2026-07-23', sourceUrl: 'https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260723~29f24d99bc.en.html' },
  { centralBankId: 'ECB', centralBankName: '欧洲央行', currency: 'EUR', decisionDate: '2026-06-11', sourceUrl: 'https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.mp260611~4d41bd5e83.en.html' },
  { centralBankId: 'BOE', centralBankName: '英格兰银行 MPC', currency: 'GBP', decisionDate: '2026-07-29', sourceUrl: 'https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/2026/july-2026' },
  { centralBankId: 'BOE', centralBankName: '英格兰银行 MPC', currency: 'GBP', decisionDate: '2026-06-17', sourceUrl: 'https://www.bankofengland.co.uk/monetary-policy-summary-and-minutes/2026/june-2026' },
  { centralBankId: 'BOJ', centralBankName: '日本银行', currency: 'JPY', decisionDate: '2026-07-31', format: 'pdf', sourceUrl: 'https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2026/k260731a.pdf' },
  { centralBankId: 'SNB', centralBankName: '瑞士国家银行', currency: 'CHF', decisionDate: '2026-06-18', sourceUrl: 'https://www.snb.ch/en/publications/communication/press-releases-restricted/pre_20260618' },
  { centralBankId: 'BOC', centralBankName: '加拿大银行', currency: 'CAD', decisionDate: '2026-07-15', sourceUrl: 'https://www.bankofcanada.ca/2026/07/fad-press-release-2026-07-15/' },
  { centralBankId: 'RBA', centralBankName: '澳洲联储', currency: 'AUD', decisionDate: '2026-08-11', sourceUrl: 'https://www.rba.gov.au/media-releases/2026/mr-26-19.html' },
  { centralBankId: 'RBA', centralBankName: '澳洲联储', currency: 'AUD', decisionDate: '2026-06-16', sourceUrl: 'https://www.rba.gov.au/media-releases/2026/mr-26-15.html' },
  { centralBankId: 'RBNZ', centralBankName: '新西兰联储', currency: 'NZD', decisionDate: '2026-07-08', sourceUrl: 'https://www.rbnz.govt.nz/news-and-events/news/2026/07/ocr-increased-to-2-50-to-return-inflation-to-2-percent' },
  { centralBankId: 'RBNZ', centralBankName: '新西兰联储', currency: 'NZD', decisionDate: '2026-05-27', sourceUrl: 'https://www.rbnz.govt.nz/monetary-policy/monetary-policy-statement/monetary-policy-statement-filtered-listing-page/2026/may-270/monetary-policy-statement-may-2026' },
];

let refreshPromise: Promise<void> | null = null;
let refreshedAt = 0;

function clean(value: string) { return value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }
function toIso(value: string | undefined) { if (!value) return null; const parsed = new Date(`${value} UTC`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10); }
function fraction(value: string) { const match = value.match(/^(\d+)-(\d+)\/(\d+)$/); return match ? Number(match[1]) + Number(match[2]) / Number(match[3]) : Number(value); }
function actionState(value: string | undefined) { const action = value?.toLowerCase(); return action === 'raise' || action === 'increase' ? 'raise' : action === 'reduce' || action === 'lower' || action === 'cut' ? 'cut' : action === 'keep' || action === 'maintain' || action === 'held' || action === 'hold' || action === 'leaving' || action === 'leave' || action === 'remain' ? 'hold' : null; }
function dateFromText(text: string, bank: CentralBankId) { const match = bank === 'BOE' ? text.match(/meeting ending on\s+(\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})/i) : text.match(/\b([A-Z][a-z]+\s+\d{1,2},\s+20\d{2}|\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})\b/); return toIso(match?.[1]); }

export function parseOfficialRateDecision(raw: string, source: Source) {
  const text = clean(raw); const decisionDate = source.decisionDate ?? dateFromText(text, source.centralBankId); if (!decisionDate) return null;
  let policyRates: PolicyRate[] = []; let voteSummary: string | null = null; let effectiveDate: string | null = null; let changeBps: number | null = null; let decision: 'raise' | 'cut' | 'hold' | null = null;
  if (source.centralBankId === 'FED') {
    decision = actionState(text.match(/The Committee decided to\s+(maintain|raise|increase|reduce|lower|cut)\b/i)?.[1]);
    const match = text.match(/target range for the federal funds rate at\s+(\d+(?:-\d+\/\d+)?)\s+to\s+(\d+(?:-\d+\/\d+)?)\s+percent/i); if (!match) return null;
    policyRates = [{ key: 'fed_funds_target', label: '联邦基金目标区间', ratePct: fraction(match[2]), minRatePct: fraction(match[1]), maxRatePct: fraction(match[2]) }];
    const vote = text.match(/release by a\s+(\d+)\s*[–-]\s*(\d+)\s+vote/i); voteSummary = vote ? `${vote[1]}–${vote[2]}` : null;
  } else if (source.centralBankId === 'ECB') {
    decision = actionState(text.match(/today decided to\s+(keep|maintain|raise|increase|reduce|lower|cut)\b/i)?.[1]);
    const match = text.match(/deposit facility, the main refinancing operations and the marginal lending facility[^.]{0,160}?(?:at|to)\s+(\d+(?:\.\d+)?)%,\s+(\d+(?:\.\d+)?)%\s+and\s+(\d+(?:\.\d+)?)%/i); if (!match) return null;
    policyRates = [{ key: 'deposit_facility', label: '存款便利', ratePct: Number(match[1]) }, { key: 'main_refinancing', label: '主要再融资', ratePct: Number(match[2]) }, { key: 'marginal_lending', label: '边际贷款', ratePct: Number(match[3]) }];
    const bps = text.match(/(?:raise|increase)[^.]*?\b(\d+)\s+basis points/i); changeBps = bps ? Number(bps[1]) : null; effectiveDate = toIso(text.match(/effect from\s+(\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})/i)?.[1]);
  } else if (source.centralBankId === 'BOE') {
    decision = actionState(text.match(/(?:voted by a majority of\s+\d+\s*[–-]\s*\d+\s+to|Committee judges that it is appropriate to)\s+(maintain|keep|raise|increase|reduce|lower|cut)\s+Bank Rate/i)?.[1]);
    const match = text.match(/(?:maintain|held|keep|hold)[^.%]{0,100}?Bank Rate at\s+(\d+(?:\.\d+)?)%/i); if (!match) return null;
    policyRates = [{ key: 'bank_rate', label: 'Bank Rate', ratePct: Number(match[1]) }];
    const vote = text.match(/majority of\s+(\d+)\s*[–-]\s*(\d+)/i); voteSummary = vote ? `${vote[1]}–${vote[2]}` : null;
    const bps = text.match(/(?:increase|raise|cut|reduce)[^.]{0,100}?(\d+)\s+(?:basis points|percentage points)/i); changeBps = bps ? ((decision === 'cut' ? -1 : 1) * Number(bps[1])) : null;
  } else if (source.centralBankId === 'BOJ') {
    decision = actionState(text.match(/call rate to\s+(remain|be maintained)\s+at around/i)?.[1]);
    const match = text.match(/uncollateralized overnight call rate to\s+(?:remain|be maintained)\s+at around\s+(\d+(?:\.\d+)?)\s+percent/i); if (!match) return null;
    policyRates = [{ key: 'overnight_call_rate', label: '无担保隔夜拆借利率指引', ratePct: Number(match[1]) }];
    const vote = text.match(/by an\s+(\d+)\s*[–-]\s*(\d+)\s+majority vote/i); voteSummary = vote ? `${vote[1]}–${vote[2]}` : null;
  } else if (source.centralBankId === 'SNB') {
    decision = actionState(text.match(/(?:is\s+)?(leaving|raising|increasing|lowering|reducing)\s+the SNB policy rate/i)?.[1]);
    const match = text.match(/SNB policy rate (?:unchanged )?at\s+(\d+(?:\.\d+)?)%/i); if (!match) return null;
    policyRates = [{ key: 'snb_policy_rate', label: 'SNB 政策利率', ratePct: Number(match[1]) }];
  } else if (source.centralBankId === 'RBA') {
    decision = actionState(text.match(/Board decided to\s+(leave|maintain|keep|raise|increase|reduce|lower|cut)\s+the cash rate target/i)?.[1]);
    const match = text.match(/cash rate target(?:\s+unchanged)?\s+(?:at|to)\s+(\d+(?:\.\d+)?)\s+per cent/i); if (!match) return null;
    policyRates = [{ key: 'cash_rate_target', label: '现金利率目标', ratePct: Number(match[1]) }];
    voteSummary = /policy decision was unanimous/i.test(text) ? '一致通过' : null;
    const bps = text.match(/(?:raise|increase|reduce|lower|cut)[^.]{0,80}?cash rate target[^.]{0,80}?(\d+)\s+basis points/i); changeBps = bps ? ((decision === 'cut' ? -1 : 1) * Number(bps[1])) : null;
  } else if (source.centralBankId === 'RBNZ') {
    decision = actionState(text.match(/(?:reached consensus to|Committee agreed to)\s+(increase|raise|hold|maintain|keep|lower|reduce|cut)\s+(?:the\s+)?(?:OCR|Official Cash Rate)/i)?.[1]);
    const match = text.match(/(?:Official Cash Rate\s+at|OCR(?:\s+by\s+\d+\s+basis points)?\s+to)\s+(\d+(?:\.\d+)?)\s*(?:percent|%)/i); if (!match) return null;
    policyRates = [{ key: 'official_cash_rate', label: '官方现金利率', ratePct: Number(match[1]) }];
    voteSummary = /reached consensus/i.test(text) ? '共识' : null;
    const bps = text.match(/(?:increase|raise)\s+(?:the\s+)?OCR\s+by\s+(\d+)\s+basis points/i); changeBps = bps ? Number(bps[1]) : null;
  } else {
    decision = actionState(text.match(/(?:today\s+)?(held|maintained|raised|increased|lowered|reduced|cut)\s+(?:its\s+)?target for the overnight rate/i)?.[1]);
    const match = text.match(/target for the overnight rate at\s+(\d+(?:\.\d+)?)%,\s+with the Bank Rate at\s+(\d+(?:\.\d+)?)%\s+and the deposit rate at\s+(\d+(?:\.\d+)?)%/i); if (!match) return null;
    policyRates = [{ key: 'overnight_target', label: '隔夜目标利率', ratePct: Number(match[1]) }, { key: 'bank_rate', label: 'Bank Rate', ratePct: Number(match[2]) }, { key: 'deposit_rate', label: '存款利率', ratePct: Number(match[3]) }];
  }
  if (!decision) return null;
  const summary = text.slice(0, 900); const sourceFingerprint = createHash('sha256').update(JSON.stringify({ centralBankId: source.centralBankId, sourceUrl: source.sourceUrl, decisionDate, decision, effectiveDate, policyRates })).digest('hex');
  return { sourceFingerprint, centralBankId: source.centralBankId, centralBankName: source.centralBankName, currency: source.currency, decisionDate, effectiveDate, decision, changeBps, policyRates, voteSummary, officialSummary: summary, sourceUrl: source.sourceUrl, retrievedAt: new Date() };
}

async function readOfficialSource(response: Response, source: Source) {
  if (source.format !== 'pdf') return response.text();
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(await response.arrayBuffer()) });
  try { return (await parser.getText({ first: 1 })).text; } finally { await parser.destroy(); }
}

function parseArchiveDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('FOREX_CENTRAL_BANK_ARCHIVE_DATE_INVALID');
  return parsed;
}

async function refreshArchive() {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await Promise.all(SOURCES.map(async (source) => { try { const response = await fetch(source.sourceUrl, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'FinanceHub FX official archive/1.0' } }); if (!response.ok) return; const parsed = parseOfficialRateDecision(await readOfficialSource(response, source), source); if (!parsed) return; const record = { ...parsed, decisionDate: parseArchiveDate(parsed.decisionDate)!, effectiveDate: parseArchiveDate(parsed.effectiveDate) }; await db.insert(forexCentralBankDecisionEvents).values(record).onDuplicateKeyUpdate({ set: { centralBankName: record.centralBankName, currency: record.currency, effectiveDate: record.effectiveDate, decision: record.decision, changeBps: record.changeBps, policyRates: record.policyRates, voteSummary: record.voteSummary, officialSummary: record.officialSummary, sourceUrl: record.sourceUrl, retrievedAt: record.retrievedAt, updatedAt: new Date() } }); } catch { /* 仅归档实际可读且可解析的官方公告 */ } }));
}

export async function listForexCentralBankArchive(limit = 24) {
  const now = Date.now(); if (!refreshPromise || now - refreshedAt > 5 * 60_000) refreshPromise = refreshArchive().then(() => { refreshedAt = Date.now(); }).finally(() => { refreshPromise = null; }); await refreshPromise;
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); return db.select().from(forexCentralBankDecisionEvents).orderBy(desc(forexCentralBankDecisionEvents.decisionDate), desc(forexCentralBankDecisionEvents.retrievedAt)).limit(Math.min(Math.max(limit, 1), 50));
}

import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';

const POLICY_SOURCES = [
  { id: 'FED', label: '美联储 / FOMC', region: '美国', homeUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', allowedHosts: ['federalreserve.gov'] },
  { id: 'ECB', label: '欧洲央行', region: '欧元区', homeUrl: 'https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html', allowedHosts: ['ecb.europa.eu'] },
  { id: 'BOE', label: '英格兰银行', region: '英国', homeUrl: 'https://www.bankofengland.co.uk/monetary-policy', allowedHosts: ['bankofengland.co.uk'] },
  { id: 'PBOC', label: '中国人民银行', region: '中国', homeUrl: 'https://www.pbc.gov.cn/en/3688006/index.html', allowedHosts: ['pbc.gov.cn'] },
  { id: 'CBC', label: '台湾中央银行', region: '台湾', homeUrl: 'https://www.cbc.gov.tw/en/', allowedHosts: ['cbc.gov.tw'] },
  { id: 'BCB', label: '巴西中央银行', region: '巴西', homeUrl: 'https://www.bcb.gov.br/en/monetarypolicy', allowedHosts: ['bcb.gov.br'] },
] as const;

type PolicySourceId = typeof POLICY_SOURCES[number]['id'];
type EvidenceHighlight = { category: 'key_rate' | 'policy_action' | 'forward_guidance'; phrase: string; start: number; end: number; context: string };
type ResearchEvidenceHighlight = { category: 'research_question' | 'method' | 'reported_finding'; phrase: string; start: number; end: number; context: string };

function sourceById(id: PolicySourceId) { const source = POLICY_SOURCES.find((item) => item.id === id); if (!source) throw new Error('POLICY_SOURCE_NOT_FOUND'); return source; }
export function getPolicySourceDirectory() { return POLICY_SOURCES.map(({ allowedHosts: _allowedHosts, ...source }) => source); }
function isAllowedSourceUrl(value: string, source: ReturnType<typeof sourceById>) { try { const url = new URL(value); return url.protocol === 'https:' && source.allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)); } catch { return false; } }
function toPlainText(html: string) { return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); }
export function extractFedPolicyMainText(html: string) {
  const articleById = html.match(/<div\b[^>]*\bid=["']article["'][^>]*>([\s\S]*?)<div\b[^>]*\b(?:id|class)=["'][^"']*lastUpdate[^"']*["'][^>]*>/i)?.[1];
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const article = main?.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const content = articleById ?? article ?? main;
  return content ? toPlainText(content) : '';
}
const HIGHLIGHT_RULES: Array<{ category: EvidenceHighlight['category']; regex: RegExp }> = [
  { category: 'key_rate', regex: /target range for the federal funds rate|federal funds rate|Bank Rate|deposit facility rate|main refinancing operations rate|Selic rate|policy rate|利率走廊|政策利率|存款便利利率|再融资利率|基准利率/gi },
  { category: 'policy_action', regex: /maintain(?:ed)?|raise(?:d)?|lower(?:ed)?|reduce(?:d)?|increase(?:d)?|hold(?:ing)?|维持|上调|下调|降低|提高|加息|降息/gi },
  { category: 'forward_guidance', regex: /will assess|will continue to|expects? that|prepared to|data[- ]dependent|closely monitor|future path|forward guidance|将继续|将评估|将密切关注|取决于数据|前瞻性指引|必要时/gi },
];
export function extractPolicyEvidence(text: string): EvidenceHighlight[] { const highlights: EvidenceHighlight[] = []; for (const rule of HIGHLIGHT_RULES) { for (const match of text.matchAll(rule.regex)) { const start = match.index ?? 0; const end = start + match[0].length; if (highlights.some((item) => start >= item.start && start < item.end)) continue; highlights.push({ category: rule.category, phrase: match[0], start, end, context: text.slice(Math.max(0, start - 180), Math.min(text.length, end + 260)) }); if (highlights.length >= 36) return highlights; } } return highlights.sort((a, b) => a.start - b.start); }

const RESEARCH_HIGHLIGHT_RULES: Array<{ category: ResearchEvidenceHighlight['category']; regex: RegExp }> = [
  { category: 'research_question', regex: /\b(?:this paper|this study|we|i)\s+(?:propose|examine|investigate|evaluate|estimate|develop)\b/gi },
  { category: 'method', regex: /\b(?:method|methodology|model|estimat(?:e|ion)|specification|sample|empirical|data)\b/gi },
  { category: 'reported_finding', regex: /\b(?:results?|evidence|find(?:s|ing)?|show(?:s|ed)?|exhibits?|yields?|implies?)\b/gi },
];

export function extractFedResearchBodyText(html: string) {
  const contentStart = html.indexOf('<!-- Content Area -->');
  if (contentStart < 0) return '';
  const bodyArea = html.slice(contentStart);
  const match = bodyArea.match(/<div\s+class=["'][^"']*col-lg-8[^"']*["'][^>]*>([\s\S]*?)<div\s+class=["']col-xs-12\s+col-md-12\s+footnotes\s+feds-note["']/i);
  return match ? toPlainText(match[1]) : '';
}

export function extractResearchEvidence(text: string): ResearchEvidenceHighlight[] {
  const highlights: ResearchEvidenceHighlight[] = [];
  for (const rule of RESEARCH_HIGHLIGHT_RULES) {
    for (const match of text.matchAll(rule.regex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (highlights.some((item) => start >= item.start && start < item.end)) continue;
      highlights.push({ category: rule.category, phrase: match[0], start, end, context: text.slice(Math.max(0, start - 180), Math.min(text.length, end + 260)) });
      if (highlights.length >= 36) return highlights;
    }
  }
  return highlights.sort((a, b) => a.start - b.start);
}

export async function inspectOfficialPolicyDocument(sourceId: PolicySourceId, url: string) { const source = sourceById(sourceId); if (!isAllowedSourceUrl(url, source)) throw new Error('POLICY_DOCUMENT_URL_NOT_ALLOWED'); const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'manual', headers: { Accept: 'text/html, text/plain;q=0.9' } }); if (!response.ok) throw new Error(`POLICY_DOCUMENT_FETCH_${response.status}`); const contentType = response.headers.get('content-type') ?? ''; if (!contentType.includes('text/html') && !contentType.includes('text/plain')) throw new Error('POLICY_DOCUMENT_HTML_OR_TEXT_REQUIRED'); const html = (await response.text()).slice(0, 240_000); const text = (sourceId === 'FED' && contentType.includes('text/html') ? extractFedPolicyMainText(html) : toPlainText(html)).slice(0, 60_000); if (!text) throw new Error(sourceId === 'FED' ? 'POLICY_DOCUMENT_MAIN_CONTENT_NOT_FOUND' : 'POLICY_DOCUMENT_EMPTY'); return { source: { id: source.id, label: source.label, region: source.region, homeUrl: source.homeUrl }, url, retrievedAt: new Date().toISOString(), text, highlights: extractPolicyEvidence(text), limitation: '仅展示白名单央行官方 HTML/文本主内容区的规则关键词命中上下文。命中不构成自动政策立场、利率预测或投资结论，须回到原文完整核验。' }; }

export async function inspectOfficialResearchDocument(url: string) {
  const source = sourceById('FED');
  if (!isAllowedSourceUrl(url, source) || !new URL(url).pathname.startsWith('/econres/feds/')) throw new Error('RESEARCH_DOCUMENT_URL_NOT_ALLOWED');
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'manual', headers: { Accept: 'text/html' } });
  if (!response.ok) throw new Error(`RESEARCH_DOCUMENT_FETCH_${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) throw new Error('RESEARCH_DOCUMENT_HTML_REQUIRED');
  const text = extractFedResearchBodyText((await response.text()).slice(0, 240_000)).slice(0, 60_000);
  if (!text) throw new Error('RESEARCH_DOCUMENT_BODY_NOT_FOUND');
  return { source: { id: 'FED_RESEARCH' as const, label: '美联储理事会 · FEDS 研究', region: source.region }, url, retrievedAt: new Date().toISOString(), text, highlights: extractResearchEvidence(text), limitation: '仅展示用户选取的 FEDS 官方研究正文及规则关键词上下文。正文从官方研究内容区提取；命中不构成模型摘要、机构立场、预测、评级或投资结论。' };
}

export const moneyMarketPolicyRouter = router({
  getSources: publicProcedure.query(() => ({ generatedAt: new Date().toISOString(), sources: getPolicySourceDirectory() })),
  inspectDocument: publicProcedure.input(z.object({ sourceId: z.enum(['FED', 'ECB', 'BOE', 'PBOC', 'CBC', 'BCB']), url: z.string().url().max(2000) })).mutation(async ({ input }) => inspectOfficialPolicyDocument(input.sourceId, input.url)),
  inspectResearchDocument: publicProcedure.input(z.object({ url: z.string().url().max(2000) })).mutation(async ({ input }) => inspectOfficialResearchDocument(input.url)),
});

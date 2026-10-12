import { createHash } from 'node:crypto';
import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm';
import { adminNewsIngestionArticles, adminNewsIngestionSources, newsResearchEvidenceAuditEvents, newsResearchEvidenceCards, newsResearchEvidenceReviewSubmissions, newsResearchEvidenceReviews, newsResearchEvidenceShares, newsResearchSourceFreshnessEvents, newsResearchSourceFreshnessRules, notificationPreferences, notifications, officialNewsFeedItems, users } from '../drizzle/schema';
import { getDb, listChecklistMemberDirectory } from './db';

export type NewsEvidenceStatus = 'captured' | 'reading' | 'verified' | 'closed';
export type NewsSourceKind = 'sec_press' | 'fed_monetary' | 'fed_research' | 'sec_filing';
export type OfficialNewsSourceKind = Exclude<NewsSourceKind, 'sec_filing'>;
export type NewsEvidencePermission = 'viewer' | 'editor' | 'reviewer';

const SEC_HEADERS = { 'User-Agent': 'Finance Hub official research terminal contact@finance-hub.local', Accept: 'application/json,application/rss+xml,application/xml,text/xml,text/plain,*/*' };
const OFFICIAL_SOURCES = {
  sec_press: { label: '美国证券交易委员会 · 新闻稿', institution: 'U.S. Securities and Exchange Commission', url: 'https://www.sec.gov/news/pressreleases.rss' },
  fed_monetary: { label: '美联储理事会 · 货币政策', institution: 'Board of Governors of the Federal Reserve System', url: 'https://www.federalreserve.gov/feeds/press_monetary.xml' },
  fed_research: { label: '美联储理事会 · 研究', institution: 'Board of Governors of the Federal Reserve System', url: 'https://www.federalreserve.gov/feeds/feds.xml' },
} as const;

type OfficialNewsItem = { sourceKind: OfficialNewsSourceKind; sourceId: string; institution: string; sourceLabel: string; headline: string; excerpt: string | null; publishedAt: Date | null; sourceUrl: string; retrievedAt: Date };
type CacheRow = { at: number; rows: OfficialNewsItem[]; failure: string | null };
type FreshnessSnapshot = { id: OfficialNewsSourceKind; label: string; status: 'available' | 'unavailable'; cachedAt: Date; latestPublishedAt: Date | null };
type Emitted = { id: number; userId: number; title: string; content: string; type: 'alert' | 'info' };
const feedCache = new Map<string, CacheRow>();

function decodeXml(value: string | undefined) { return (value ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim(); }
function xmlField(block: string, field: string) { const match = block.match(new RegExp(`<${field}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${field}>`, 'i')); return decodeXml(match?.[1]); }

function parseFeed(xml: string, sourceKind: OfficialNewsSourceKind): OfficialNewsItem[] {
  const source = OFFICIAL_SOURCES[sourceKind]; const blocks = [...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)].map((match) => match[1]);
  return blocks.flatMap((block, index) => {
    const headline = xmlField(block, 'title'); const sourceUrl = xmlField(block, 'link') || decodeXml(block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)?.[1]) || source.url; const publishedRaw = xmlField(block, 'pubDate') || xmlField(block, 'published') || xmlField(block, 'updated'); const published = publishedRaw ? new Date(publishedRaw) : null;
    const sourceId = xmlField(block, 'guid') || xmlField(block, 'id') || (sourceUrl !== source.url ? sourceUrl : `${sourceKind}:${headline}:${publishedRaw || index}`);
    if (!headline || (published && published.getTime() > Date.now() + 5 * 60_000)) return [];
    return [{ sourceKind, sourceId: sourceId.slice(0, 320), institution: source.institution, sourceLabel: source.label, headline: headline.slice(0, 600), excerpt: (xmlField(block, 'description') || xmlField(block, 'summary') || xmlField(block, 'content') || null)?.slice(0, 3000) ?? null, publishedAt: published && !Number.isNaN(published.getTime()) ? published : null, sourceUrl: sourceUrl.slice(0, 1200), retrievedAt: new Date() }];
  });
}

async function archiveOfficialRows(rows: OfficialNewsItem[]) {
  const db = await getDb();
  if (!db) throw new Error('OFFICIAL_NEWS_DATABASE_UNAVAILABLE');
  for (const row of rows) {
    const sourceIdHash = createHash('sha256').update(`${row.sourceKind}|${row.sourceId}`).digest('hex');
    await db.insert(officialNewsFeedItems).values({
      sourceKind: row.sourceKind, sourceIdHash, sourceId: row.sourceId,
      headline: row.headline, excerpt: row.excerpt, sourceUrl: row.sourceUrl,
      publishedAt: row.publishedAt, retrievedAt: row.retrievedAt,
    }).onDuplicateKeyUpdate({ set: {
      headline: row.headline, excerpt: row.excerpt, retrievedAt: row.retrievedAt,
    } });
  }
}

let priorOfficialArchiveImported = false;
/** Only backfill publisher-identified articles already kept in the terminal. */
async function backfillPriorOfficialNews() {
  if (priorOfficialArchiveImported) return;
  const db = await getDb();
  if (!db) return;
  const sourceRows = await db.select({
    article: adminNewsIngestionArticles, feedUrl: adminNewsIngestionSources.feedUrl,
  }).from(adminNewsIngestionArticles)
    .innerJoin(adminNewsIngestionSources, eq(adminNewsIngestionArticles.sourceId, adminNewsIngestionSources.id))
    .where(inArray(adminNewsIngestionSources.feedUrl, [
      OFFICIAL_SOURCES.sec_press.url, 'https://www.federalreserve.gov/feeds/press_all.xml',
      OFFICIAL_SOURCES.fed_monetary.url, OFFICIAL_SOURCES.fed_research.url,
    ]))
    .orderBy(desc(adminNewsIngestionArticles.sourcePublishedAt), desc(adminNewsIngestionArticles.id))
    .limit(500);
  const known: OfficialNewsItem[] = sourceRows.flatMap(({ article, feedUrl }) => {
    const url = article.sourceUrl;
    let parsed: URL;
    try { parsed = new URL(url); } catch { return []; }
    let kind: OfficialNewsSourceKind | null = null;
    if (feedUrl === OFFICIAL_SOURCES.sec_press.url && parsed.hostname === 'www.sec.gov' &&
      parsed.pathname.startsWith('/newsroom/press-releases/')) kind = 'sec_press';
    else if ((feedUrl === OFFICIAL_SOURCES.fed_monetary.url || feedUrl === 'https://www.federalreserve.gov/feeds/press_all.xml') &&
      parsed.hostname === 'www.federalreserve.gov' && /\/pressreleases\/monetary[^/]*\.htm$/i.test(parsed.pathname)) kind = 'fed_monetary';
    else if (feedUrl === OFFICIAL_SOURCES.fed_research.url && parsed.hostname === 'www.federalreserve.gov')
      kind = 'fed_research';
    const published = article.sourcePublishedAt;
    if (!kind || !article.sourceHeadline?.trim() ||
      published && (published.getTime() > Date.now() + 5 * 60_000 || Number.isNaN(published.getTime())))
      return [];
    return [{
      sourceKind: kind, sourceId: url.slice(0, 320), institution: OFFICIAL_SOURCES[kind].institution,
      sourceLabel: OFFICIAL_SOURCES[kind].label, headline: article.sourceHeadline.slice(0, 600),
      excerpt: article.sourceExcerpt?.slice(0, 3000) ?? null, publishedAt: published,
      sourceUrl: url.slice(0, 1200), retrievedAt: article.retrievedAt,
    }];
  });
  if (known.length) await archiveOfficialRows(known);
  priorOfficialArchiveImported = true;
}

async function readOfficialFeed(sourceKind: OfficialNewsSourceKind) {
  const cached = feedCache.get(sourceKind); if (cached && Date.now() - cached.at < 5 * 60_000) return cached;
  const source = OFFICIAL_SOURCES[sourceKind];
  try { const response = await fetch(source.url, { headers: SEC_HEADERS, signal: AbortSignal.timeout(12_000) }); if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`); const rows = parseFeed(await response.text(), sourceKind); if (rows.length) await archiveOfficialRows(rows); const result = { at: Date.now(), rows, failure: rows.length ? null : 'SOURCE_EMPTY' }; feedCache.set(sourceKind, result); return result; }
  catch (error) { const result = { at: Date.now(), rows: [], failure: error instanceof Error ? error.message : 'SOURCE_UNAVAILABLE' }; feedCache.set(sourceKind, result); return result; }
}

export async function getOfficialNewsFeed(input: { source?: 'all' | OfficialNewsSourceKind; keyword?: string; limit?: number }) {
  const sourceIds = input.source && input.source !== 'all' ? [input.source] : Object.keys(OFFICIAL_SOURCES) as OfficialNewsSourceKind[]; const values = await Promise.all(sourceIds.map(readOfficialFeed)); const keyword = input.keyword?.trim().toLowerCase() ?? '';
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 60);
  const db = await getDb();
  let archivedRows: OfficialNewsItem[] = [];
  let archiveTotal = 0;
  let archiveAvailable = false;
  if (db) {
    try {
      await backfillPriorOfficialNews();
      const term = keyword.replace(/[\\%_]/g, '\\$&');
      const condition = and(
        inArray(officialNewsFeedItems.sourceKind, sourceIds),
        term ? or(like(officialNewsFeedItems.headline, `%${term}%`),
          like(officialNewsFeedItems.excerpt, `%${term}%`)) : undefined,
      );
      const [[total], rows] = await Promise.all([
        db.select({ value: count() }).from(officialNewsFeedItems).where(condition),
        db.select().from(officialNewsFeedItems).where(condition)
          .orderBy(desc(officialNewsFeedItems.publishedAt), desc(officialNewsFeedItems.id))
          .limit(limit),
      ]);
      archiveAvailable = true;
      archiveTotal = Number(total?.value ?? 0);
      archivedRows = rows.map(row => {
        const kind = row.sourceKind as OfficialNewsSourceKind;
        return {
          sourceKind: kind, sourceId: row.sourceId, institution: OFFICIAL_SOURCES[kind].institution,
          sourceLabel: OFFICIAL_SOURCES[kind].label, headline: row.headline,
          excerpt: row.excerpt, publishedAt: row.publishedAt, sourceUrl: row.sourceUrl,
          retrievedAt: row.retrievedAt,
        };
      });
    } catch { archiveAvailable = false; }
  }
  const liveRows = values.flatMap(value => value.rows)
    .filter(row => !keyword || `${row.headline} ${row.excerpt ?? ''}`.toLowerCase().includes(keyword));
  const rows = (archiveAvailable ? archivedRows : liveRows)
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)).slice(0, limit);
  return {
    rows, archiveTotal: archiveAvailable ? archiveTotal : null, archiveAvailable,
    sources: sourceIds.map((id, index) => ({
      id, label: OFFICIAL_SOURCES[id].label, institution: OFFICIAL_SOURCES[id].institution,
      status: values[index].failure ? 'unavailable' as const : 'available' as const,
      failure: values[index].failure, cachedAt: new Date(values[index].at),
      latestPublishedAt: values[index].rows.reduce<Date | null>((latest, row) => !row.publishedAt || (latest && latest >= row.publishedAt) ? latest : row.publishedAt, null),
    })),
    boundary: archiveAvailable
      ? '官方 RSS/XML 的标题、日期与公开摘要首次成功读取后存入数据库，来源失联时保留历史资料并显示来源状态；历史资料不代表实时新闻。'
      : '当前新闻归档不可用，仅展示本次成功获取的真实官方摘要，未承诺永久保存。',
  };
}

type SecTickerRow = { cik_str?: number; ticker?: string; title?: string };
type SecSubmissions = { name?: string; filings?: { recent?: { form?: string[]; filingDate?: string[]; accessionNumber?: string[]; primaryDocument?: string[]; primaryDocDescription?: string[]; reportDate?: string[] } } };

export async function getNewsSecFilings(tickerInput: string) {
  const ticker = tickerInput.trim().toUpperCase();
  try {
    const indexResponse = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: SEC_HEADERS, signal: AbortSignal.timeout(10_000) }); if (!indexResponse.ok) throw new Error(`SEC_TICKERS_${indexResponse.status}`); const index = await indexResponse.json() as Record<string, SecTickerRow>; const entity = Object.values(index).find((row) => row.ticker?.toUpperCase() === ticker);
    if (!entity?.cik_str) return { available: false as const, ticker, issuer: null, cik: null, filings: [], boundary: 'SEC 官方 ticker 目录未找到该发行人；仅支持美国公开发行人的实际 SEC EDGAR 申报。' };
    const cik = String(entity.cik_str).padStart(10, '0'); const submissionResponse = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: SEC_HEADERS, signal: AbortSignal.timeout(12_000) }); if (!submissionResponse.ok) throw new Error(`SEC_SUBMISSIONS_${submissionResponse.status}`); const submissions = await submissionResponse.json() as SecSubmissions; const recent = submissions.filings?.recent;
    const filings = (recent?.form ?? []).flatMap((form, index) => { if (!['10-K', '10-Q', '8-K', '20-F', '40-F', '6-K'].includes(form)) return []; const accessionNumber = recent?.accessionNumber?.[index]; const primaryDocument = recent?.primaryDocument?.[index]; if (!accessionNumber || !primaryDocument) return []; const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${entity.cik_str}/${accessionNumber.replaceAll('-', '')}/${encodeURIComponent(primaryDocument)}`; return [{ sourceKind: 'sec_filing' as const, sourceId: `${cik}:${accessionNumber}:${primaryDocument}`, institution: 'U.S. Securities and Exchange Commission', sourceLabel: 'SEC EDGAR 发行人申报', ticker, issuer: submissions.name ?? entity.title ?? ticker, cik, form, filingDate: recent?.filingDate?.[index] ?? null, reportDate: recent?.reportDate?.[index] ?? null, primaryDocument, description: recent?.primaryDocDescription?.[index] ?? null, sourceUrl }]; }).slice(0, 12);
    return { available: true as const, ticker, issuer: submissions.name ?? entity.title ?? ticker, cik, filings, boundary: '仅展示 SEC EDGAR 实际申报目录字段；申报目录不等同于投资建议、实时新闻或完整法律解释。' };
  } catch { return { available: false as const, ticker, issuer: null, cik: null, filings: [], boundary: '当前无法读取 SEC EDGAR；系统不显示静态申报样本、模拟文件或第三方页面替代。' }; }
}

function plainText(html: string) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim(); }
export async function getNewsSecFilingExcerpt(input: { cik: string; accessionNumber: string; primaryDocument: string; keyword: string }) {
  const cik = input.cik.replace(/\D/g, '').padStart(10, '0'); const accession = input.accessionNumber.replace(/\D/g, ''); if (!accession || !input.primaryDocument) throw new Error('SEC_FILING_IDENTIFIER_REQUIRED'); const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${encodeURIComponent(input.primaryDocument)}`;
  try { const response = await fetch(sourceUrl, { headers: SEC_HEADERS, signal: AbortSignal.timeout(12_000) }); if (!response.ok) throw new Error(`SEC_FILING_${response.status}`); const text = plainText(await response.text()); const keyword = input.keyword.trim(); const index = text.toLowerCase().indexOf(keyword.toLowerCase()); const excerpt = index < 0 ? null : text.slice(Math.max(0, index - 500), Math.min(text.length, index + keyword.length + 1200)); return { status: excerpt ? 'available' as const : 'not_found' as const, excerpt, sourceUrl, keyword, retrievedAt: new Date(), boundary: excerpt ? '终端内仅展示关键词附近的受限长度 SEC 原文片段；不重述条款、不生成法律结论或投资建议。' : '该关键词未在当前可读取主文件正文中命中；系统不以推断性摘要替代。' }; }
  catch { return { status: 'unavailable' as const, excerpt: null, sourceUrl, keyword: input.keyword, retrievedAt: new Date(), boundary: '当前无法读取 SEC 主文件；系统不显示缓存条款、虚构摘录或第三方页面内容。' }; }
}

async function audit(cardId: number, actorUserId: number, action: 'captured' | 'status_updated' | 'note_updated' | 'member_added' | 'member_removed' | 'review_submitted' | 'review_approved' | 'review_changes_requested', note?: string) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.insert(newsResearchEvidenceAuditEvents).values({ cardId, actorUserId, action, note: note?.slice(0, 1000) ?? null }); }

async function resolveEvidenceAccess(userId: number, cardId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const card = (await db.select().from(newsResearchEvidenceCards).where(eq(newsResearchEvidenceCards.id, cardId)).limit(1))[0]; if (!card) throw new Error('NEWS_EVIDENCE_NOT_FOUND');
  if (card.userId === userId) return { card, access: 'owner' as const };
  const share = (await db.select().from(newsResearchEvidenceShares).where(and(eq(newsResearchEvidenceShares.cardId, cardId), eq(newsResearchEvidenceShares.sharedWithUserId, userId))).limit(1))[0]; if (!share) throw new Error('FORBIDDEN_NEWS_EVIDENCE'); return { card, access: share.permission as NewsEvidencePermission };
}

export async function listNewsEvidence(userId: number, input: { status?: NewsEvidenceStatus | 'all'; query?: string }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const own = await db.select().from(newsResearchEvidenceCards).where(eq(newsResearchEvidenceCards.userId, userId)); const shares = await db.select().from(newsResearchEvidenceShares).where(eq(newsResearchEvidenceShares.sharedWithUserId, userId)); const ids = shares.map((item) => item.cardId); const shared = ids.length ? await db.select().from(newsResearchEvidenceCards).where(inArray(newsResearchEvidenceCards.id, ids)) : []; const permission = new Map(shares.map((item) => [item.cardId, item.permission])); const query = input.query?.trim().toLowerCase() ?? '';
  return [...own.map((card) => ({ ...card, access: 'owner' as const })), ...shared.map((card) => ({ ...card, access: permission.get(card.id) ?? 'viewer' as const }))].filter((card) => (!input.status || input.status === 'all' || card.status === input.status) && (!query || card.headline.toLowerCase().includes(query) || card.institution.toLowerCase().includes(query))).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 160);
}

export async function captureNewsEvidence(userId: number, input: { sourceKind: NewsSourceKind; sourceId: string; institution: string; headline: string; publishedAt: Date | null; sourceUrl: string; excerpt?: string | null; researchNote?: string | null }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const existing = (await db.select().from(newsResearchEvidenceCards).where(and(eq(newsResearchEvidenceCards.userId, userId), eq(newsResearchEvidenceCards.sourceKind, input.sourceKind), eq(newsResearchEvidenceCards.sourceId, input.sourceId))).limit(1))[0]; if (existing) return { card: existing, existed: true };
  const result = await db.insert(newsResearchEvidenceCards).values({ userId, sourceKind: input.sourceKind, sourceId: input.sourceId.slice(0, 320), institution: input.institution.slice(0, 180), headline: input.headline.slice(0, 600), publishedAt: input.publishedAt, sourceUrl: input.sourceUrl.slice(0, 1200), excerpt: input.excerpt?.slice(0, 12_000) ?? null, researchNote: input.researchNote?.slice(0, 12_000) ?? null }); const id = Number((result as any)[0]?.insertId ?? (result as any).insertId); if (!Number.isInteger(id) || id <= 0) throw new Error('NEWS_EVIDENCE_CREATE_FAILED'); await audit(id, userId, 'captured', '归档官方来源证据'); const card = (await db.select().from(newsResearchEvidenceCards).where(and(eq(newsResearchEvidenceCards.id, id), eq(newsResearchEvidenceCards.userId, userId))).limit(1))[0]; return { card, existed: false };
}

export async function updateNewsEvidence(userId: number, input: { cardId: number; status?: NewsEvidenceStatus; researchNote?: string }) {
  const resolved = await resolveEvidenceAccess(userId, input.cardId); if (resolved.access !== 'owner' && resolved.access !== 'editor') throw new Error('FORBIDDEN_NEWS_EVIDENCE_WRITE'); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const set: Partial<typeof newsResearchEvidenceCards.$inferInsert> = { updatedAt: new Date() }; if (input.status) set.status = input.status; if (input.researchNote !== undefined) set.researchNote = input.researchNote.slice(0, 12_000); await db.update(newsResearchEvidenceCards).set(set).where(eq(newsResearchEvidenceCards.id, input.cardId)); if (input.status) await audit(input.cardId, userId, 'status_updated', `状态更新为 ${input.status}`); if (input.researchNote !== undefined) await audit(input.cardId, userId, 'note_updated', '更新终端内研究注释'); return { cardId: input.cardId };
}

export async function listNewsEvidenceMembers(userId: number, cardId: number) {
  await resolveEvidenceAccess(userId, cardId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const shares = await db.select().from(newsResearchEvidenceShares).where(eq(newsResearchEvidenceShares.cardId, cardId)); const ids = shares.map((item) => item.sharedWithUserId); const directory = ids.length ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, ids)) : []; return { shares, directory };
}

export async function addNewsEvidenceMember(ownerUserId: number, input: { cardId: number; sharedWithUserId: number; permission: NewsEvidencePermission }) {
  const resolved = await resolveEvidenceAccess(ownerUserId, input.cardId); if (resolved.access !== 'owner') throw new Error('FORBIDDEN_NEWS_EVIDENCE_OWNER'); if (input.sharedWithUserId === ownerUserId) throw new Error('NEWS_EVIDENCE_OWNER_ALREADY_HAS_ACCESS'); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const member = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0]; if (!member) throw new Error('NEWS_EVIDENCE_MEMBER_NOT_FOUND'); await db.insert(newsResearchEvidenceShares).values({ cardId: input.cardId, ownerUserId, sharedWithUserId: input.sharedWithUserId, permission: input.permission }).onDuplicateKeyUpdate({ set: { permission: input.permission, ownerUserId, updatedAt: new Date() } }); await audit(input.cardId, ownerUserId, 'member_added', `授予${input.permission}权限给账户 ${input.sharedWithUserId}`); return input;
}

export async function removeNewsEvidenceMember(ownerUserId: number, input: { cardId: number; sharedWithUserId: number }) { const resolved = await resolveEvidenceAccess(ownerUserId, input.cardId); if (resolved.access !== 'owner') throw new Error('FORBIDDEN_NEWS_EVIDENCE_OWNER'); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.delete(newsResearchEvidenceShares).where(and(eq(newsResearchEvidenceShares.cardId, input.cardId), eq(newsResearchEvidenceShares.ownerUserId, ownerUserId), eq(newsResearchEvidenceShares.sharedWithUserId, input.sharedWithUserId))); await audit(input.cardId, ownerUserId, 'member_removed', `撤销账户 ${input.sharedWithUserId} 的授权`); return { ...input, removed: true };
}

export async function submitNewsEvidenceReview(ownerUserId: number, input: { cardId: number; summary: string }) {
  const resolved = await resolveEvidenceAccess(ownerUserId, input.cardId); if (resolved.access !== 'owner') throw new Error('FORBIDDEN_NEWS_EVIDENCE_OWNER'); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const latest = (await db.select({ version: newsResearchEvidenceReviewSubmissions.version }).from(newsResearchEvidenceReviewSubmissions).where(eq(newsResearchEvidenceReviewSubmissions.cardId, input.cardId)).orderBy(desc(newsResearchEvidenceReviewSubmissions.version)).limit(1))[0]; const version = (latest?.version ?? 0) + 1; const inserted = await db.insert(newsResearchEvidenceReviewSubmissions).values({ cardId: input.cardId, ownerUserId, version, summary: input.summary.slice(0, 12_000), status: 'submitted', submittedAt: new Date() }); const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId); if (!id) throw new Error('NEWS_EVIDENCE_REVIEW_SUBMIT_FAILED'); await audit(input.cardId, ownerUserId, 'review_submitted', `提交第 ${version} 版审阅摘要`); return { id, version, status: 'submitted' as const };
}

export async function reviewNewsEvidence(reviewerUserId: number, input: { submissionId: number; decision: 'approved' | 'changes_requested'; note: string }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const submission = (await db.select().from(newsResearchEvidenceReviewSubmissions).where(eq(newsResearchEvidenceReviewSubmissions.id, input.submissionId)).limit(1))[0]; if (!submission) throw new Error('NEWS_EVIDENCE_REVIEW_NOT_FOUND'); const resolved = await resolveEvidenceAccess(reviewerUserId, submission.cardId); if (resolved.access !== 'reviewer') throw new Error('FORBIDDEN_NEWS_EVIDENCE_REVIEW'); if (submission.status !== 'submitted' && submission.status !== 'changes_requested') throw new Error('NEWS_EVIDENCE_REVIEW_NOT_OPEN'); await db.insert(newsResearchEvidenceReviews).values({ submissionId: submission.id, reviewerUserId, decision: input.decision, note: input.note.slice(0, 1000) || null }).onDuplicateKeyUpdate({ set: { decision: input.decision, note: input.note.slice(0, 1000) || null, updatedAt: new Date() } }); const status = input.decision === 'approved' ? 'approved' as const : 'changes_requested' as const; await db.update(newsResearchEvidenceReviewSubmissions).set({ status, finalizedAt: status === 'approved' ? new Date() : null, updatedAt: new Date() }).where(eq(newsResearchEvidenceReviewSubmissions.id, submission.id)); await audit(submission.cardId, reviewerUserId, status === 'approved' ? 'review_approved' : 'review_changes_requested', input.note || (status === 'approved' ? '审阅确认' : '要求修订')); return { submissionId: submission.id, status };
}

export async function getNewsEvidenceDetail(userId: number, cardId: number) {
  const resolved = await resolveEvidenceAccess(userId, cardId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const [auditRows, shares, submissions] = await Promise.all([db.select().from(newsResearchEvidenceAuditEvents).where(eq(newsResearchEvidenceAuditEvents.cardId, cardId)).orderBy(desc(newsResearchEvidenceAuditEvents.createdAt)).limit(120), db.select().from(newsResearchEvidenceShares).where(eq(newsResearchEvidenceShares.cardId, cardId)), db.select().from(newsResearchEvidenceReviewSubmissions).where(eq(newsResearchEvidenceReviewSubmissions.cardId, cardId)).orderBy(desc(newsResearchEvidenceReviewSubmissions.version))]); const ids = submissions.map((item) => item.id); const reviews = ids.length ? await db.select().from(newsResearchEvidenceReviews).where(inArray(newsResearchEvidenceReviews.submissionId, ids)).orderBy(desc(newsResearchEvidenceReviews.updatedAt)) : []; const people = [...new Set([resolved.card.userId, ...shares.map((item) => item.sharedWithUserId), ...auditRows.map((item) => item.actorUserId), ...reviews.map((item) => item.reviewerUserId)])]; const directory = people.length ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, people)) : []; return { card: resolved.card, access: resolved.access, audit: auditRows, shares, submissions, reviews, directory };
}

export async function listNewsSourceFreshnessRules(userId: number) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); return db.select().from(newsResearchSourceFreshnessRules).where(eq(newsResearchSourceFreshnessRules.userId, userId)).orderBy(newsResearchSourceFreshnessRules.sourceKind); }
export async function saveNewsSourceFreshnessRule(userId: number, input: { sourceKind: OfficialNewsSourceKind; thresholdHours: number; isActive: boolean }) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.insert(newsResearchSourceFreshnessRules).values({ userId, ...input }).onDuplicateKeyUpdate({ set: { thresholdHours: input.thresholdHours, isActive: input.isActive, updatedAt: new Date() } }); return (await db.select().from(newsResearchSourceFreshnessRules).where(and(eq(newsResearchSourceFreshnessRules.userId, userId), eq(newsResearchSourceFreshnessRules.sourceKind, input.sourceKind))).limit(1))[0]; }
export async function deleteNewsSourceFreshnessRule(userId: number, sourceKind: OfficialNewsSourceKind) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); await db.delete(newsResearchSourceFreshnessRules).where(and(eq(newsResearchSourceFreshnessRules.userId, userId), eq(newsResearchSourceFreshnessRules.sourceKind, sourceKind))); return { sourceKind, deleted: true }; }
export async function listNewsSourceFreshnessEvents(userId: number, input: { sourceKind?: OfficialNewsSourceKind | 'all'; state?: 'stale' | 'unavailable' | 'all'; limit?: number }) { const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const rows = await db.select().from(newsResearchSourceFreshnessEvents).where(eq(newsResearchSourceFreshnessEvents.userId, userId)).orderBy(desc(newsResearchSourceFreshnessEvents.createdAt)).limit(Math.min(Math.max(input.limit ?? 80, 1), 160)); return rows.filter((row) => (!input.sourceKind || input.sourceKind === 'all' || row.sourceKind === input.sourceKind) && (!input.state || input.state === 'all' || row.state === input.state)); }

export async function processNewsSourceFreshnessNotifications(now = new Date()) {
  const snapshot = await getOfficialNewsFeed({ source: 'all', limit: 60 }); const sources: FreshnessSnapshot[] = snapshot.sources.map((item) => ({ id: item.id, label: item.label, status: item.status, cachedAt: item.cachedAt, latestPublishedAt: item.latestPublishedAt })); const sourceMap = new Map(sources.map((item) => [item.id, item])); const db = await getDb(); if (!db) return [] as Emitted[]; const rules = await db.select().from(newsResearchSourceFreshnessRules).where(eq(newsResearchSourceFreshnessRules.isActive, true)); const emitted: Emitted[] = [];
  for (const rule of rules) { const preference = (await db.select({ marketAlerts: notificationPreferences.marketAlerts }).from(notificationPreferences).where(eq(notificationPreferences.userId, rule.userId)).limit(1))[0]; if (preference && !preference.marketAlerts) continue; const source = sourceMap.get(rule.sourceKind as OfficialNewsSourceKind); const ageHours = source?.latestPublishedAt ? Math.max(0, Math.floor((now.getTime() - source.latestPublishedAt.getTime()) / 3_600_000)) : null; const state = source?.status === 'available' && source.latestPublishedAt ? (ageHours !== null && ageHours > rule.thresholdHours ? 'stale' as const : null) : 'unavailable' as const; if (!state) continue; const keyPart = state === 'stale' ? source!.latestPublishedAt!.toISOString() : `${now.toISOString().slice(0, 10)}:unavailable`; const key = `news-source-freshness:${rule.sourceKind}:${rule.thresholdHours}:${keyPart}`; const content = state === 'unavailable' ? `${source?.label ?? rule.sourceKind} 当前无法实际读取；账户阈值为 ${rule.thresholdHours} 小时。系统未使用缓存新闻或替代来源填充。` : `${source!.label} 最近实际官方发布日期为 ${source!.latestPublishedAt!.toISOString()}，距本次读取约 ${ageHours} 小时，超过账户时效阈值 ${rule.thresholdHours} 小时。`;
    const created = await db.transaction(async (tx) => { const duplicate = (await tx.select({ id: newsResearchSourceFreshnessEvents.id }).from(newsResearchSourceFreshnessEvents).where(and(eq(newsResearchSourceFreshnessEvents.userId, rule.userId), eq(newsResearchSourceFreshnessEvents.notificationKey, key))).limit(1))[0]; if (duplicate) return null; const inserted = await tx.insert(newsResearchSourceFreshnessEvents).values({ notificationKey: key, ruleId: rule.id, userId: rule.userId, sourceKind: rule.sourceKind, latestPublishedAt: source?.latestPublishedAt ?? null, retrievedAt: source?.cachedAt ?? now, ageHours, state }); const eventId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId); const notification = await tx.insert(notifications).values({ userId: rule.userId, title: `官方来源时效提醒：${source?.label ?? rule.sourceKind}`, content, type: 'alert', relatedType: 'news_source_freshness', relatedId: eventId }); const id = Number((notification as any)[0]?.insertId ?? (notification as any).insertId); await tx.update(newsResearchSourceFreshnessEvents).set({ notificationId: id }).where(eq(newsResearchSourceFreshnessEvents.id, eventId)); return id ? { id, userId: rule.userId, title: `官方来源时效提醒：${source?.label ?? rule.sourceKind}`, content, type: 'alert' as const } : null; }); if (created) emitted.push(created);
  }
  return emitted;
}

export { listChecklistMemberDirectory as listNewsEvidenceMemberDirectory };

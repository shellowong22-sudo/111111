/**
 * Stable business-facing contract for an approved article.  Publication and
 * ingestion internals (URLs, providers, source labels, retrieval timestamps,
 * audit identifiers, and model metadata) deliberately never cross this
 * boundary.  The same DTO is used by the existing news panels, so a panel can
 * render useful content without learning how it was collected.
 */
import { cleanPublicFeedText } from './adminModulePublicFeed';

export function toPublicPublishedAdminNews(article: any, _sectionLabel?: string | null, _serviceLabel?: string | null) {
  const title = cleanPublicFeedText(article.aiTitle ?? article.sourceHeadline);
  const rawSummary = [article.aiSummary, article.sourceExcerpt].map(value => String(value ?? '').trim())
    .find(value => value && !/(?:来源未提供|已保存来源|只能概括标题|暂无摘要|待审核|尚未发布|严禁自动发布)/i.test(value)) ?? '';
  const cleanedSummary = cleanPublicFeedText(rawSummary);
  const summary = rawSummary && !/(?:来源未提供|已保存来源|只能概括标题|暂无摘要|待审核|尚未发布|严禁自动发布)/i.test(rawSummary)
    ? (cleanedSummary ? `${cleanedSummary}${/[。！？.!?]$/.test(rawSummary) && !/[。！？.!?]$/.test(cleanedSummary) ? '。' : ''}` : '正文摘要暂未返回。')
    : '正文摘要暂未返回。';
  if (!title) return null;
  return {
    id: article.id,
    title: title.slice(0, 255),
    summary: summary.slice(0, 2_000),
    category: article.category ?? '财经要闻',
    sentiment: article.sentiment ?? 'uncertain',
    tickers: Array.isArray(article.tickers) ? article.tickers.slice(0, 8) : [],
    publishedAt: article.publishedAt ?? article.sourcePublishedAt ?? null,
    updatedAt: article.updatedAt ?? article.publishedAt ?? article.retrievedAt ?? null,
  };
}

export function toPublicNewsAnalyticsSource(source: any) {
  return {
    name: source.name,
    lastStatus: source.lastStatus,
    lastFetchedAt: source.lastFetchedAt,
  };
}

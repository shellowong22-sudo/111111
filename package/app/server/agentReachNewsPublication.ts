/**
 * Agent Reach may archive a whole web page for private research, but a
 * successful web read is not evidence of either a single article or
 * permission to republish its contents in the news terminal.
 */
import { isFederalReservePressReleaseUrl } from "./agentReachOfficialNews";

export function agentReachNewsRejectionReason(input: {
  subType: string;
  title: string;
  body: string;
  summary?: string | null;
  sourceUrl: string;
  rssFeedUrl?: string | null;
  verifiedOfficialFullText?: boolean;
}): string | null {
  const { subType, title, body, summary, sourceUrl, rssFeedUrl, verifiedOfficialFullText } = input;
  const internal = sourceUrl.startsWith("https://company.internal/");
  if (!title.trim() || /^Title:\s*/i.test(title)) return "NEWS_REQUIRES_SINGLE_ARTICLE_TITLE";
  if (/^(?:首页|主页|Home|新闻|资讯)(?:\s*[-—|].*)?$/i.test(title.trim()))
    return "NEWS_PORTAL_IS_NOT_AN_ARTICLE";
  if (/^\s*Title:\s|Markdown Content:|URL Source:|(?:^|\s)Menu\s+\d+\s*[.、]|登录注册.*(?:首页|Menu)/i.test(body) ||
    (body.match(/https?:\/\/|(?:\]\(https?:\/\/)/gi) ?? []).length >= 5)
    return "NEWS_PAGE_CHROME_OR_ARTICLE_LIST";
  if (internal) {
    if (body.trim().length < 120) return "NEWS_FULL_ARTICLE_BODY_REQUIRED";
    return null;
  }
  let article: URL;
  try { article = new URL(sourceUrl); } catch { return "NEWS_ARTICLE_URL_REQUIRED"; }
  if (article.protocol !== "https:") return "NEWS_HTTPS_ARTICLE_URL_REQUIRED";
  const host = article.hostname.toLowerCase();
  if (host === "ft.com" || host.endsWith(".ft.com") ||
      host === "ftchinese.com" || host.endsWith(".ftchinese.com"))
    return "FT_NEEDS_LICENSED_REPUBLISHING_FEED";
  // A manually pasted web page is private source material, not a source
  // connector. RSS/Atom entries carry their own article URL and excerpt.
  if (subType !== "rss") return "EXTERNAL_WEB_NEWS_REQUIRES_AUTHORIZED_FEED";
  let feed: URL;
  try { feed = new URL(rssFeedUrl ?? ""); } catch { return "NEWS_VERIFIED_RSS_FEED_REQUIRED"; }
  if (feed.protocol !== "https:" || feed.username || feed.password)
    return "NEWS_VERIFIED_RSS_FEED_REQUIRED";
  const articleHost = article.hostname.toLowerCase().replace(/^www\./, "");
  const feedHost = feed.hostname.toLowerCase().replace(/^www\./, "");
  if (articleHost !== feedHost && !articleHost.endsWith(`.${feedHost}`) &&
    !feedHost.endsWith(`.${articleHost}`))
    return "NEWS_ARTICLE_SOURCE_MUST_MATCH_APPROVED_FEED";
  const path = article.pathname.replace(/\/+$/, "");
  if (!path || /^\/(?:index|default)(?:\.[a-z]+)?$/i.test(path) ||
    /^\/(?:news|article|articles|rss|feed|category|tag|search|home)$/i.test(path) ||
    /\/(?:feed|rss)(?:\.[a-z]+)?$/i.test(path) ||
    sourceUrl === rssFeedUrl)
    return "NEWS_ARTICLE_URL_REQUIRED";
  if (!summary || summary.trim().length < 24)
    return "NEWS_PUBLIC_EXCERPT_REQUIRED";
  if (/^\s*Title:\s|Markdown Content:|URL Source:|(?:^|\s)Menu\s+\d+\s*[.、]/i.test(summary))
    return "NEWS_PAGE_CHROME_OR_ARTICLE_LIST";
  if (verifiedOfficialFullText && (!isFederalReservePressReleaseUrl(sourceUrl) ||
    feed.toString() !== "https://www.federalreserve.gov/feeds/press_all.xml" ||
    body.trim().length < 500 || body.split(/\n{2,}/).length < 3))
    return "NEWS_FULL_ARTICLE_VERIFICATION_FAILED";
  return null;
}

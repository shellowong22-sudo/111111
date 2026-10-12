import { load } from "cheerio";

/**
 * Intentionally narrow: only the Board's own press-release HTML is eligible
 * for full-text publication. A third-party RSS item or a generic web page
 * must never acquire this flag merely by having a long description.
 */
export function isFederalReservePressReleaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.federalreserve.gov" &&
      /^\/newsevents\/pressreleases\/[a-z]+20\d{6}[a-z]\.htm$/i.test(url.pathname) &&
      !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}

export function extractFederalReservePressRelease(html: string, sourceUrl: string) {
  if (!isFederalReservePressReleaseUrl(sourceUrl) || html.length > 2_000_000) return null;
  const $ = load(html);
  const canonical = $('meta[property="og:url"]').attr("content");
  const title = $('meta[property="og:title"]').attr("content")?.trim();
  if ($('meta[property="og:type"]').attr("content") !== "article" ||
    canonical !== sourceUrl || !title || title.length < 24 || title.length > 700) return null;
  const paragraphs = $('#content .col-xs-12.col-sm-8.col-md-8 > p, main .col-xs-12.col-sm-8.col-md-8 > p')
    .toArray().map(node => $(node).text().replace(/\s+/g, " ").trim())
    .filter(text => text.length >= 35 && !/^For media inquiries,/i.test(text))
    .slice(0, 45);
  // The same paragraph can match both selectors; never duplicate the article.
  const distinct = paragraphs.filter((text, index) => paragraphs.indexOf(text) === index);
  const content = distinct.join("\n\n");
  if (distinct.length < 3 || content.length < 500 || /(?:^|\n)Menu\s+\d/i.test(content)) return null;
  return { title, content, paragraphCount: distinct.length };
}

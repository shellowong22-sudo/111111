import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { extractFederalReservePressRelease, isFederalReservePressReleaseUrl } from "./agentReachOfficialNews";
import { agentReachNewsRejectionReason } from "./agentReachNewsPublication";
import { toPublicFeedItem } from "./adminModulePublicFeed";

const articleUrl = "https://www.federalreserve.gov/newsevents/pressreleases/bcreg20260930a.htm";
const feedUrl = "https://www.federalreserve.gov/feeds/press_all.xml";
const title = "Federal Reserve Board finalizes changes to its supervisory stress tests";
const paragraph = "The Board published an actual decision with specific rules, dates, and affected institutions. ".repeat(3);
const body = `${paragraph}\n\n${paragraph}Second paragraph.\n\n${paragraph}Third paragraph.`;

describe("Agent Reach official complete-article boundary", () => {
  it("extracts an article without navigation, attachments, contact details or sidebar text", () => {
    const html = `<html><head><meta property="og:url" content="${articleUrl}"><meta property="og:type" content="article"><meta property="og:title" content="${title}"></head>
      <body><nav>Menu 1. 首页 首页</nav><div id="content"><div class="col-xs-12 col-sm-8 col-md-8">
      <p>${paragraph}</p><p>${paragraph}Second paragraph.</p><p>${paragraph}Third paragraph.</p>
      <p>For media inquiries, please email test@example.org or call 1234.</p></div>
      <div class="panel panel-attachments"><p>External PDF attachment</p></div></div></body></html>`;
    const extracted = extractFederalReservePressRelease(html, articleUrl);
    expect(extracted?.paragraphCount).toBe(3);
    expect(extracted?.content).not.toMatch(/Menu|media inquiries|External PDF/);
    expect(extracted?.content.split("\n\n")).toHaveLength(3);
    expect(extractFederalReservePressRelease(html, "https://www.ftchinese.com/")).toBeNull();
  });

  it("allows a verified official full article without exposing internal provenance in TOP", () => {
    expect(isFederalReservePressReleaseUrl(articleUrl)).toBe(true);
    expect(agentReachNewsRejectionReason({
      subType: "rss", title, body, summary: "Board announces stress test transparency changes.",
      sourceUrl: articleUrl, rssFeedUrl: feedUrl, verifiedOfficialFullText: true,
    })).toBeNull();
    const item = toPublicFeedItem({
      moduleId: "news-top", title, body, category: "新闻全文", topic: "金融政策",
      sourceReference: articleUrl, sourceKind: "real",
      payload: { source: "agent-reach", rssFeedUrl: feedUrl, verifiedOfficialFullText: true },
    });
    expect(item?.body.split("\n\n")).toHaveLength(3);
    expect(item?.category).toBe("新闻全文");
    expect(JSON.stringify(item)).not.toMatch(/https?:\/\/|sourceReference|agent-reach|rssFeedUrl/);
    expect(toPublicFeedItem({
      moduleId: "news-top", title, body, category: "新闻全文", sourceReference: articleUrl,
      sourceKind: "real", payload: { source: "agent-reach", rssFeedUrl: feedUrl },
    })).toBeNull();
  });

  it("never treats an external publisher or a homepage as the official full-article exception", () => {
    expect(agentReachNewsRejectionReason({
      subType: "rss", title, body, summary: "Board announces stress test transparency changes.",
      sourceUrl: "https://other-publisher.example/news/123", rssFeedUrl: feedUrl,
      verifiedOfficialFullText: true,
    })).not.toBeNull();
    expect(isFederalReservePressReleaseUrl("https://www.federalreserve.gov/")).toBe(false);
  });

  it.skipIf(process.env.RUN_AGENT_REACH_OFFICIAL_NETWORK !== "1" || process.platform !== "win32")("extracts the real official press release", () => {
    const html = execFileSync("curl.exe", [
      "--noproxy", "*", "--proto", "=https", "--max-time", "15",
      "--max-filesize", "2000000", "--silent", "--show-error", "--fail", articleUrl,
    ], { encoding: "utf8", timeout: 17_000, maxBuffer: 2_004_096 });
    const extracted = extractFederalReservePressRelease(html, articleUrl);
    expect(extracted?.paragraphCount).toBeGreaterThanOrEqual(5);
    expect(extracted?.content.length).toBeGreaterThan(1_000);
    expect(extracted?.content).not.toMatch(/For media inquiries|shareDL|Menu\s+\d/);
  }, 20_000);
});

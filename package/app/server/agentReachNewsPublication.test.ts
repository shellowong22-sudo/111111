import { describe, expect, it } from "vitest";
import { agentReachNewsRejectionReason } from "./agentReachNewsPublication";
import { toPublicFeedItem } from "./adminModulePublicFeed";

const ftHomepage = {
  subType: "web", title: "Title: FT中文网 — 全球财经精粹 - FT中文网",
  sourceUrl: "https://www.ftchinese.com/", rssFeedUrl: null,
  body: "Title: FT中文网 — 全球财经精粹 - FT中文网 URL Source: https://www.ftchinese.com/ Markdown Content: 查看回复 登录注册 Menu 1. 首页首页 更多链接与不同新闻的内容。",
};

describe("Agent Reach publication boundary", () => {
  it("rejects the archived Jina homepage even when ingestion labelled it high quality", () => {
    expect(agentReachNewsRejectionReason(ftHomepage)).toBeTruthy();
    expect(toPublicFeedItem({
      moduleId: "news-top", contentKey: "ar:ard_example:news-top", sourceKind: "real",
      title: ftHomepage.title, body: ftHomepage.body, category: "市场研究",
      sourceReference: ftHomepage.sourceUrl, payload: { source: "agent-reach" },
    })).toBeNull();
  });

  it("does not turn an arbitrary external page or an RSS homepage into a full article", () => {
    expect(agentReachNewsRejectionReason({
      subType: "web", title: "市场分析报告", body: "完整网页材料。".repeat(80),
      sourceUrl: "https://example.org/research/2026-10-01", rssFeedUrl: null,
    })).toBe("EXTERNAL_WEB_NEWS_REQUIRES_AUTHORIZED_FEED");
    expect(agentReachNewsRejectionReason({
      subType: "rss", title: "市场分析报告", body: "市场分析。".repeat(30),
      summary: "公开订阅摘要解释了新闻事件的时间和背景。",
      sourceUrl: "https://example.org/", rssFeedUrl: "https://example.org/feed",
    })).toBe("NEWS_ARTICLE_URL_REQUIRED");
    expect(agentReachNewsRejectionReason({
      subType: "rss", title: "转载的其他发布方新闻", body: "公开新闻正文。".repeat(30),
      summary: "公开摘要提供来源事实和时间，足以构成一篇新闻简介。",
      sourceUrl: "https://different-publisher.example/news/123",
      rssFeedUrl: "https://example.org/feed",
    })).toBe("NEWS_ARTICLE_SOURCE_MUST_MATCH_APPROVED_FEED");
  });

  it("allows a distinct RSS article excerpt and never replaces it with the fetched full text", () => {
    const excerpt = "财政部公布了债券发行安排，并列出本月的发行日期和期限结构。";
    expect(agentReachNewsRejectionReason({
      subType: "rss", title: "财政部公布本月发行安排",
      body: "该篇真实文章的完整内容不得通过摘要订阅自动公开。".repeat(12),
      summary: excerpt, sourceUrl: "https://example.org/news/2026/bond-issue",
      rssFeedUrl: "https://example.org/rss.xml",
    })).toBeNull();
    const item = toPublicFeedItem({
      moduleId: "news-top", contentKey: "ar:ard_article:news-top", sourceKind: "real",
      title: "财政部公布本月发行安排", body: excerpt, category: "新闻摘要",
      sourceReference: "https://example.org/news/2026/bond-issue",
      payload: { source: "agent-reach", rssFeedUrl: "https://example.org/rss.xml" },
    });
    expect(item?.body).toContain("债券发行安排");
    expect(item?.body).not.toContain("完整内容");
  });

  it("does not hide unrelated source articles", () => {
    expect(toPublicFeedItem({
      moduleId: "news-top", sourceKind: "real",
      title: "独立新闻标题", body: "公开新闻渠道的事实描述和后续影响。".repeat(4),
      sourceReference: "https://example.org/news/article",
    })).not.toBeNull();
  });
});

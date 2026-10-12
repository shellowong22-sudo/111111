import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decideUcheerSearch, officialSearchQuery, parseBingRssResults, parseDuckDuckGoResults,
  rankUcheerEvidence, rankUcheerSearchResults, searchGlobalInformation, validateUcheerCitations,
} from "./ucheerAiSearch";

vi.mock("./db", () => ({ getDb: async () => null }));

describe("Ucheer AI search routing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("routes fresh-data requests to global search without a TypeSafe key", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const decision = await decideUcheerSearch({
      messages: [{ role: "user", content: "查询今天全球央行利率新闻和研究资料" }],
      market: "全球利率",
    });
    expect(decision).toMatchObject({
      shouldSearch: true,
      evaluatedBy: "deterministic",
    });
  });

  it("does not route a self-contained concept explanation to search", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const decision = await decideUcheerSearch({
      messages: [{ role: "user", content: "解释久期和凸性的区别" }],
    });
    expect(decision).toMatchObject({
      shouldSearch: false,
      evaluatedBy: "deterministic",
    });
  });

  it("does not misroute an explanation of progressive recall to search", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const decision = await decideUcheerSearch({
      messages: [{ role: "user", content: "请解释渐进式历史检索如何减少无关上下文" }],
    });
    expect(decision).toMatchObject({
      shouldSearch: false,
      evaluatedBy: "deterministic",
    });
  });

  it("extracts clean, deduplicated public links from the search page", () => {
    const html = `
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.federalreserve.gov%2Fresearch">全球利率研究</a>
        <a class="result__snippet">研究摘要与最新数据</a>
      </div>
      <div class="result">
        <a class="result__a" href="https://www.federalreserve.gov/research">全球利率研究（重复）</a>
        <a class="result__snippet">重复条目</a>
      </div>
    `;
    expect(parseDuckDuckGoResults(html)).toEqual([
      {
        title: "全球利率研究",
        url: "https://www.federalreserve.gov/research",
        excerpt: "研究摘要与最新数据",
        rank: 1,
      },
    ]);
  });

  it("extracts real URLs and descriptions from the secondary public search feed", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Federal Reserve September statement</title>
        <link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm</link>
        <description>Monetary policy statement &amp; release.</description></item>
      <item><title>duplicate</title>
        <link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm</link></item>
      <item><title>private</title><link>http://127.0.0.1:8080/admin</link></item>
    </channel></rss>`;
    expect(parseBingRssResults(xml)).toEqual([{
      title: "Federal Reserve September statement",
      url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
      excerpt: "Monetary policy statement & release.",
      rank: 1,
    }]);
  });

  it("recovers readable official evidence through the second index when the first has no results", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const documentUrl = "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("duckduckgo.com")) return new Response("", { status: 503 });
      if (url.includes("bing.com")) return new Response(
        `<rss><channel><item><title>Federal Reserve FOMC decision</title><link>${documentUrl}</link><description>Official release.</description></item></channel></rss>`,
        { status: 200, headers: { "content-type": "application/xml" } },
      );
      if (url === documentUrl) return new Response(
        "<html><article><h1>Federal Reserve FOMC decision</h1><p>The committee published a monetary policy statement.</p></article></html>",
        { status: 200, headers: { "content-type": "text/html" } },
      );
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const results = await searchGlobalInformation("FOMC decision September 2026");
    expect(results).toMatchObject([{
      url: documentUrl,
      rank: 1,
    }]);
    expect(results[0]?.content).toContain("published a monetary policy statement");
  });

  it("uses optional TypeSafe judgments only to rank documents already retrieved", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    const first = { title: "Old release", excerpt: "", content: "Unrelated old release", url: "https://www.bis.org/old", rank: 1 };
    const second = { title: "Relevant release", excerpt: "", content: "Requested FOMC decision", url: "https://www.federalreserve.gov/recent", rank: 2 };
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      answers: {
        relevant_0: { type: "noul", noul: 0.1 },
        relevant_1: { type: "noul", noul: 0.9 },
      },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const ranked = await rankUcheerEvidence("Recent FOMC decision", [first, second]);
    expect(ranked.map(row => row.url)).toEqual([second.url, first.url]);
    const request = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(request.state.documents).toHaveLength(2);
    expect(request.questions.relevant_0.type).toBe("noul");
    fetchMock.mockImplementationOnce(async () => new Response("unauthorized", { status: 401 }));
    expect(await rankUcheerEvidence("Recent FOMC decision", [first, second])).toEqual([first, second]);
  });

  it("rejects loopback and credential-bearing URLs and removes tracking parameters", () => {
    const html = `<div class="result"><a class="result__a" href="http://127.0.0.1:3000/secret">internal</a></div>
      <div class="result"><a class="result__a" href="https://user:pass@sec.gov/release">credential</a></div>
      <div class="result"><a class="result__a" href="https://www.sec.gov/release?utm_source=test&id=42">SEC release</a></div>`;
    expect(parseDuckDuckGoResults(html)).toMatchObject([
      { title: "SEC release", url: "https://www.sec.gov/release?id=42" },
    ]);
  });

  it("prioritizes topical sources but never invents citation links", () => {
    const results = [
      { title: "General markets", excerpt: "Market update", url: "https://market.example.org/general", rank: 1 },
      { title: "Federal Reserve interest rates", excerpt: "Rate decision", url: "https://www.federalreserve.gov/newsevents/pressreleases/a.htm", rank: 2 },
    ];
    expect(rankUcheerSearchResults("Federal Reserve interest rates", results)[0].title).toContain("Federal Reserve");
    const checked = validateUcheerCitations(
      "[政策声明](https://www.federalreserve.gov/newsevents/pressreleases/a.htm) 与 [虚构资料](https://evil.org/fake)",
      results,
    );
    expect(checked.rejected).toBe(1);
    expect(checked.text).toContain("[政策声明](https://www.federalreserve.gov/newsevents/pressreleases/a.htm)");
    expect(checked.text).not.toContain("evil.org");
  });

  it("supplements central-bank searches with the appropriate official document domain", () => {
    expect(officialSearchQuery("请查找2026年9月美联储新闻")).toBe("site:federalreserve.gov FOMC press releases September 2026");
    expect(officialSearchQuery("日本央行货币政策")).toContain("site:boj.or.jp");
    expect(officialSearchQuery("解释久期和凸性")).toBeNull();
  });
});

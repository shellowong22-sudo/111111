import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deterministicNewsCategory,
  judgePublicNewsWithTypeSafe,
  TYPESAFE_NEWS_DUPLICATE_THRESHOLD,
} from "./typesafeNewsJudgment";

describe("TypeSafe public-news judgments", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps automatic publication deterministic when no API key is configured", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const result = await judgePublicNewsWithTypeSafe({
      headline: "日本銀行、金融政策決定会合の結果を公表",
      excerpt: "政策金利と今後の金融政策運営について公表した。",
    });
    expect(result).toMatchObject({
      category: "央行与政策",
      duplicateArticleId: null,
      evaluatedBy: "deterministic",
    });
  });

  it("uses one typed request for category and duplicate judgments without sending URLs or provider metadata", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: "jev-1.13.0",
      answers: {
        category: {
          type: "choice",
          choice: "central_bank_policy",
          confidence: 0.96,
          probabilities: { central_bank_policy: 0.96, company_specific: 0.01, energy_transition: 0.01, market_economy: 0.01, institutional_research: 0.005, general_publication: 0.005 },
        },
        duplicate_0: { type: "noul", noul: 0.97 },
      },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await judgePublicNewsWithTypeSafe({
      headline: "日本銀行、金融政策決定会合の結果を公表 https://example.test/new",
      excerpt: "政策金利に関する公表。",
      candidates: [{ id: 42, headline: "日銀が金融政策決定会合の結果を発表", excerpt: "金融政策の決定を発表。" }],
    });

    expect(result).toMatchObject({
      category: "央行与政策",
      duplicateArticleId: 42,
      duplicateProbability: 0.97,
      routeConfidence: 0.96,
      evaluatedBy: "typesafe",
    });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = String(request.body);
    expect(body).not.toContain("https://example.test");
    expect(body).not.toContain("test-key");
    expect(body).not.toContain('"id":42');
    expect(body).not.toMatch(/provider|sourceUrl|token|secret/i);
    expect(JSON.parse(body).questions).toHaveProperty("category");
    expect(JSON.parse(body).questions).toHaveProperty("duplicate_0");
  });

  it("does not reject a related but distinct article below the strict duplicate threshold", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answers: {
        category: { type: "choice", choice: "market_economy", confidence: 0.74, probabilities: { market_economy: 0.74, general_publication: 0.26 } },
        duplicate_0: { type: "noul", noul: TYPESAFE_NEWS_DUPLICATE_THRESHOLD - 0.01 },
      },
    }), { status: 200 })));
    const result = await judgePublicNewsWithTypeSafe({
      headline: "最新通胀数据公布",
      candidates: [{ id: 7, headline: "上月通胀数据公布" }],
    });
    expect(result.duplicateArticleId).toBeNull();
    expect(result.duplicateProbability).toBeCloseTo(TYPESAFE_NEWS_DUPLICATE_THRESHOLD - 0.01);
  });

  it("keeps deterministic category rules narrow and repeatable", () => {
    expect(deterministicNewsCategory("企业发布年度财报")).toBe("公司动态");
    expect(deterministicNewsCategory("清洁能源与储能展望报告")).toBe("能源与转型");
    expect(deterministicNewsCategory("网站维护通知")).toBe("公开要闻");
  });
});

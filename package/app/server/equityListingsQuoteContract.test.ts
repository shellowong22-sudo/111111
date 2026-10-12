import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const routeSource = readFileSync(`${root}/server/routers/equityListings.ts`, "utf8");
const schemaSource = readFileSync(`${root}/drizzle/schema.ts`, "utf8");
const realDataSource = readFileSync(`${root}/server/realDataService.ts`, "utf8");

describe("全球股票真实行情契约", () => {
  it("仅对已导入证券调用真实行情服务，并返回来源、时点和可用状态而不改写恢复快照", () => {
    expect(routeSource).toContain("fetchPublicTicker(");
    expect(routeSource).toContain("listing.symbol,");
    expect(routeSource).toContain('input.range,');
    expect(routeSource).toContain('"stocks"');
    expect(routeSource).toContain("fetchIfindMarketSnapshots");
    expect(routeSource).toContain("marketMatrix:");
    expect(routeSource).toContain('"Tonghuashun iFinD SDK"');
    expect(routeSource).not.toContain("equityQuoteSnapshots");
    expect(routeSource).not.toContain("db.insert(");
    expect(routeSource).toContain("queriedAt");
    expect(routeSource).toContain("observedAt");
    expect(routeSource).toContain("bidSize1");
    expect(routeSource).toContain("inflow");
    expect(routeSource).toContain("公开历史行情当前不可用；终端未以合成价格、静态样例或替代证券填充。");
    expect(routeSource).toContain("该证券不在已导入的全球股票清单中；终端不会按名称猜测或替代证券代码。");
    expect(schemaSource).toContain("equity_quote_snapshots");
    expect(schemaSource).toContain("unavailableReason");
    expect(realDataSource).toContain("Yahoo Finance chart via platform data API");
    expect(realDataSource).toContain("Yahoo Finance public chart");
    expect(realDataSource).toContain("https://query2.finance.yahoo.com/v8/finance/chart/");
    expect(realDataSource).toContain("Platform data API unavailable; trying public chart endpoint");
    expect(realDataSource).toMatch(
      /countryCode\s*===\s*["']US["'][\s\S]*?symbol\s*\.\s*trim\(\)\s*\.\s*toUpperCase\(\)\s*\.\s*replace/
    );
  });

  it("新闻只读取免费公开来源中关联代码匹配的条目，并生成非全文复写的白话解读", () => {
    expect(routeSource).toContain("fetchYahooNews(listing.symbol, 6, listing.countryCode)");
    expect(realDataSource).toContain("https://query2.finance.yahoo.com/v1/finance/search");
    expect(realDataSource).toContain("relatedTickers");
    expect(realDataSource).toContain("Yahoo Finance public search");
    expect(realDataSource).toContain("plainLanguage");
    expect(realDataSource).toContain("来源把这条列为");
    expect(realDataSource).toContain("关联代码");
    expect(realDataSource).toContain("未获得正文");
    expect(realDataSource).toContain("不能进一步判断事件细节、业绩、分红、融资、并购或价格影响");
    expect(realDataSource).not.toContain("业绩类消息");
    expect(realDataSource).not.toContain("资本回报类消息");
    expect(realDataSource).not.toContain("融资类消息");
    expect(realDataSource).not.toContain("公司事件消息");
    expect(realDataSource).toContain("当前免费公开新闻源没有返回与该证券代码直接关联的可验证条目");
  });

  it("CN 页面契约仅合并已发布且精确关联证券代码的站内文章", () => {
    expect(routeSource).toContain('eq(adminNewsIngestionArticles.status, "published")');
    expect(routeSource).toContain('eq(adminNewsIngestionArticles.aiGenerationCatalogCode, "CN")');
    expect(routeSource).toContain("JSON_CONTAINS");
    expect(routeSource).toContain("relatedTickers");
    expect(routeSource).toContain("审批但尚未发布的草稿不会显示");
    expect(routeSource).toContain("站内已发布公司新闻");
    expect(routeSource).not.toContain('status, "approved"');
  });
});

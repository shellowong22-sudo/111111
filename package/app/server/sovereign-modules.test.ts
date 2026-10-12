import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { buildSovereignSearchUniverse } from "./routers/secf";
import type { TreasuryAuctionReference } from "./realDataService";

// 公共 procedure 不依赖登录用户，构造最小 context 即可
function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

const caller = appRouter.createCaller(createCtx());

describe("主权债 - 证券简介 DES", () => {
  it("listSecurities 返回非空证券列表", async () => {
    const list = await caller.des.listSecurities();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
  it("getProfile 返回多模态画像与隐藏风险", async () => {
    const p = await caller.des.getProfile({ symbol: "US10Y" });
    expect(p.success).toBe(true);
    expect(p).toHaveProperty("hiddenRisks");
  });
});

describe("主权债 - 收益率与利差分析 YAS", () => {
  it("getSpreadStructure 返回利差结构", async () => {
    const r = await caller.yas.getSpreadStructure({ benchmark: "US10Y" });
    expect(r.success).toBe(true);
  }, 20_000);
  it("getSpreadAttribution 返回利差归因", async () => {
    const r = await caller.yas.getSpreadAttribution({
      segment: "投资级公司债 BBB",
    });
    expect(r.success).toBe(true);
  }, 20_000);
  it("getAnomalyAlerts 返回异动预警", async () => {
    const r = await caller.yas.getAnomalyAlerts();
    expect(r.success).toBe(true);
  });
  it("getArbitrageOpportunities 返回套利机会", async () => {
    const r = await caller.yas.getArbitrageOpportunities();
    expect(r.success).toBe(true);
  });
});

describe("主权债 - 债券新闻 TOP BON", () => {
  it("getResearchChecklist 返回来源与市场核验流程", async () => {
    const r = await caller.topbon.getResearchChecklist();
    expect(r.success).toBe(true);
    expect(r.sections.length).toBeGreaterThan(0);
  });
  it("calculateDurationSensitivity 返回可复算的一阶久期影响", async () => {
    const r = await caller.topbon.calculateDurationSensitivity({
      portfolioValue: 10_000_000,
      modifiedDuration: 7,
      yieldShockBps: 25,
    });
    expect(r.success).toBe(true);
    expect(r.estimatedPnl).toBeLessThan(0);
  });
});

describe("主权债 - 分析 CT10 Govt", () => {
  it("getMicrostructure 返回微观结构", async () => {
    const r = await caller.ct10.getMicrostructure();
    expect(r.success).toBe(true);
  });
  it("getShockTransmission 返回冲击传导路径", async () => {
    const r = await caller.ct10.getShockTransmission({
      shock: "CPI_SURPRISE",
      magnitude: 1,
    });
    expect(r.success).toBe(true);
  });
  it("getAssetLinkage 返回跨资产联动", async () => {
    const r = await caller.ct10.getAssetLinkage();
    expect(r.success).toBe(true);
  });
});

describe("主权债 - 计算器与分析", () => {
  it("getUniverse 返回可选标的", async () => {
    const u = await caller.calc.getUniverse();
    expect(Array.isArray(u)).toBe(true);
  });
  it("optimize 返回量子组合优化结果", async () => {
    const r = await caller.calc.optimize({
      objective: "MAX_SHARPE",
      riskAversion: 3,
    });
    expect(r.success).toBe(true);
    expect(r).toHaveProperty("weights");
  });
  it("getRiskBudget 返回动态风险预算", async () => {
    const r = await caller.calc.getRiskBudget();
    expect(r.success).toBe(true);
  });
  it("stressTest 返回压力测试", async () => {
    const r = await caller.calc.stressTest({ scenario: "RATE_SHOCK_UP" });
    expect(r.success).toBe(true);
  });
});

describe("主权债 - 定价", () => {
  it("listProducts 返回产品列表", async () => {
    const r = await caller.pricing.listProducts();
    expect(r.success).toBe(true);
  });
  it("price 返回可复算的固定票息现金流估值", async () => {
    const r = await caller.pricing.price({
      productId: "UST10Y",
      notional: 10_000_000,
      couponRate: 0.04,
      yieldRate: 0.045,
      frequency: 2,
    });
    expect(r.success).toBe(true);
    expect(r.valuation.modifiedDuration).toBeGreaterThan(0);
  });
  it("getLiquidityDepth 返回非虚构的执行核验清单", async () => {
    const r = await caller.pricing.getLiquidityDepth({ productId: "UST10Y" });
    expect(r.success).toBe(true);
    expect(r.status).toBe("需要核验");
  });
});

describe("主权债 - 库存与价格 IMGR", () => {
  it("getInventoryOverview 返回库存总览", async () => {
    const r = await caller.imgr.getInventoryOverview();
    expect(r.success).toBe(true);
  });
  it("getInventoryPriceCausality 返回库存价格因果", async () => {
    const r = await caller.imgr.getInventoryPriceCausality({ symbol: "CL1" });
    expect(r.success).toBe(true);
  });
  it("getSupplyChainAlerts 返回供应链预警", async () => {
    const r = await caller.imgr.getSupplyChainAlerts();
    expect(r.success).toBe(true);
  });
});

describe("主权债 - Runs管理 RUNZ", () => {
  it("getInstruments 返回标的列表", async () => {
    const r = await caller.runz.getInstruments();
    expect(Array.isArray(r)).toBe(true);
  });
  it("getVenueLiquidity 返回场所流动性", async () => {
    const r = await caller.runz.getVenueLiquidity({ symbol: "US10Y" });
    expect(r.success).toBe(true);
  });
  it("getRoutingPlan 返回智能路由方案", async () => {
    const r = await caller.runz.getRoutingPlan({
      symbol: "US10Y",
      orderSize: 100,
      side: "BUY",
    });
    expect(r.success).toBe(true);
  });
  it("getMicroArb 返回微观结构套利", async () => {
    const r = await caller.runz.getMicroArb();
    expect(r.success).toBe(true);
  });
  it("getCounterpartyPrediction 返回对手方行为预测", async () => {
    const r = await caller.runz.getCounterpartyPrediction();
    expect(r.success).toBe(true);
  });
});

describe("主权债 - 新发行/公司大事/评级", () => {
  it("getNewIssuances 返回官方一级市场拍卖参考或真实空状态", async () => {
    const r = await caller.issuance.getNewIssuances();
    expect(r.success).toBe(true);
    expect(r.source).toBe("U.S. Treasury Fiscal Data");
    expect(r.classification).toBe("official_primary_market_auction_reference");
    expect(r).not.toHaveProperty("synthetic");
    expect(
      r.items.every(
        item =>
          !("offerYield" in item) &&
          !("fairYield" in item) &&
          !("demandMultiple" in item)
      )
    ).toBe(true);
  }, 20_000);
  it("getCorporateEvents 在无原始来源时返回明确空状态", async () => {
    const r = await caller.issuance.getCorporateEvents();
    expect(r.success).toBe(true);
    expect(r.available).toBe(false);
    expect(r.events).toEqual([]);
    expect(r.limitation).toContain("不会生成情绪");
  });
  it("getRatingsWatch 在无原始来源时不生成评级概率或隐含评分", async () => {
    const r = await caller.issuance.getRatingsWatch();
    expect(r.success).toBe(true);
    expect(r.available).toBe(false);
    expect(r.issuers).toEqual([]);
    expect(r.limitation).toContain("不会生成隐含评分");
  });
});

describe("主权债 - IR与通胀衍生品及SN", () => {
  it("getInflationTwin 返回通胀数字孪生", async () => {
    const r = await caller.inflation.getInflationTwin({ region: "US" });
    expect(r.success).toBe(true);
  });
  it("getBreakevenArb 返回盈亏平衡套利", async () => {
    const r = await caller.inflation.getBreakevenArb();
    expect(r.success).toBe(true);
  });
  it("getStructuredNotes 返回结构化票据", async () => {
    const r = await caller.inflation.getStructuredNotes({
      principal: 1_000_000,
      participationRate: 1,
      capPct: 20,
    });
    expect(r.success).toBe(true);
  });
});

describe("主权债 - 证券设定与功能说明", () => {
  it("getDigitalTwin 返回数字孪生画像", async () => {
    const r = await caller.secinfo.getDigitalTwin();
    expect(r.success).toBe(true);
    expect(Array.isArray(r.history)).toBe(true);
  });
  it("getEmotionResonance 返回情绪共振", async () => {
    const r = await caller.secinfo.getEmotionResonance();
    expect(r.success).toBe(true);
  });
  it("counterfactual 返回反事实模拟", async () => {
    const r = await caller.secinfo.counterfactual({ shock: "RATE_UP_100BP" });
    expect(r.success).toBe(true);
  });
  it("getStrategySwarm 返回策略蜂群", async () => {
    const r = await caller.secinfo.getStrategySwarm();
    expect(r.success).toBe(true);
    expect(Array.isArray(r.history)).toBe(true);
  });
  it("askAssistant 在外部分析服务不可用时仍返回可核验回答", async () => {
    const r = await caller.secinfo.askAssistant({
      question:
        "当前研究对象的主要利率风险是什么？\n研究对象：美国 10 年期国债基准；识别码：US91282CJZ23；期限：2034-11-15；当前价格：4.77。",
    });
    expect(r.success).toBe(true);
    expect(r.answer).toContain("市场事实");
    expect(r.answer).not.toContain("分析服务不可用");
  });
});

describe("主权债 - 证券查找 SECF", () => {
  it("证券主表保持唯一口径、原始历史和正确单位", () => {
    const auctions: TreasuryAuctionReference[] = [
      { recordDate: "2026-08-10", cusip: "912TEST01", securityType: "Note", securityTerm: "2-Year", auctionDate: "2026-08-08", issueDate: "2026-08-10", maturityDate: "2028-08-10", offeringAmount: 30_000_000_000, bidToCoverRatio: 2.7, resultMetricLabel: "最高收益率", resultMetricValue: 4.2, couponRate: 4.125 },
      { recordDate: "2026-09-10", cusip: "912TEST01", securityType: "Note", securityTerm: "2-Year", auctionDate: "2026-09-08", issueDate: "2026-09-10", maturityDate: "2028-09-10", offeringAmount: 32_000_000_000, bidToCoverRatio: 2.9, resultMetricLabel: "最高收益率", resultMetricValue: 4.3, couponRate: 4.25 },
    ];
    const rows = buildSovereignSearchUniverse({
      DGS2: [{ date: "2026-09-01", value: 4.31 }, { date: "2026-09-03", value: 4.34 }],
      DGS10: [{ date: "2026-09-01", value: 4.79 }, { date: "2026-09-03", value: 4.77 }],
    }, auctions, "2026-09-05T00:00:00.000Z");
    expect(rows.length).toBe(3);
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.some(row => row.symbol === "^TNX" || row.symbol === "US10Y")).toBe(false);
    const dgs10 = rows.find(row => row.symbol === "DGS10");
    expect(dgs10).toMatchObject({ value: 4.77, unit: "%", change: -2, observedAt: "2026-09-03", sourceLabel: "FRED DGS10" });
    expect(dgs10?.history.at(-1)?.value).toBe(dgs10?.value);
    const auction = rows.find(row => row.symbol === "912TEST01");
    expect(auction).toMatchObject({ value: 4.3, change: 10, observedAt: "2026-09-08" });
    expect(auction?.history).toEqual([{ date: "2026-08-08", value: 4.2 }, { date: "2026-09-08", value: 4.3 }]);
  });

  it("sovereignUniverse 返回可追溯证券且不包含随机补位字段", async () => {
    const r = await caller.secf.sovereignUniverse();
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every(row => Boolean(row.sourceLabel && row.sourceUrl && row.observedAt))).toBe(true);
    expect(new Set(r.rows.map(row => row.id)).size).toBe(r.rows.length);
    expect(JSON.stringify(r.rows)).not.toContain("synthetic");
  }, 20_000);

  it("semanticSearch 返回语义搜索结果", async () => {
    const r = await caller.secf.semanticSearch({ query: "美国国债" });
    expect(r.success).toBe(true);
  });
  it("scenarioAnalysis 返回情景推演", async () => {
    const r = await caller.secf.scenarioAnalysis({ scenario: "FED_CUT" });
    expect(r.success).toBe(true);
  });
});

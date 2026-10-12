import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("economic and quote surfaces keep truthful data boundaries", () => {
  it("keeps every PMI view while removing generated observations", () => {
    const source = read("../client/src/components/econ/PMITab.tsx");
    expect(source).not.toContain("Math.random");
    expect(source).toContain("pmiPublic.getLatestUsManufacturing");
    for (const label of ["圆形仪表盘", "分项热力图", "历史周期色块图", "全球PMI排名", "PMI领先GDP验证", "分项贡献分解"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain("不以模拟数据填充");
  });

  it("keeps every WIRP view and does not invent market probabilities", () => {
    const source = read("../client/src/components/econ/WIRPTab.tsx");
    expect(source).not.toContain("Math.random");
    expect(source).toContain("macro.getCentralBankRates");
    for (const label of ["FOMC 会议概率树", "OIS 远期利率曲线", "历史预测准确率", "市场隐含路径", "联邦基金期货", "全球利率预期对比"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain("不以模拟概率或历史快照填充");
  });

  it("does not synthesize ALLQ dealer quotes, depth, RFQs, or fills", () => {
    const router = read("./routers/allq.ts");
    const page = read("../client/src/pages/ALLQ.tsx");
    expect(router).not.toContain("Math.random");
    expect(router).toMatch(/function generateDealerQuotes[\s\S]*?return \[\];/);
    expect(router).toContain("depth: generateMarketDepth");
    expect(router).toContain("success: false as const");
    expect(router).toContain("不会伪造成交回执");
    expect(page).toContain("未接入交易商报价");
    for (const label of ["报价聚合", "市场深度", "报价历史", "价差分析", "交易商评估"]) {
      expect(page).toContain(label);
    }
  });

  it("keeps fixed-income tabs while refusing synthetic bonds and executions", () => {
    const router = read("./routers/fixedIncomeTrade.ts");
    const page = read("../client/src/pages/FixedIncomeTrade.tsx");
    expect(router).not.toContain("Math.random");
    expect(router).toContain("available: false");
    expect(router).toContain("不会伪造成交");
    for (const label of ["FIT Bond Universe", "FITG Trading Grid", "BOLT Multi-Dealer", "BLOT E-Blotter", "TSOX Execution", "PTBB Portfolio Basket", "IMGR Inventory"]) {
      expect(page).toContain(label);
    }
  });

  it("keeps curve and secondary-market workspaces while removing random fallback data", () => {
    const regional = read("../client/src/pages/RegionalCurvesHub.tsx");
    const secondary = read("../client/src/pages/SecondaryMarketsHub.tsx");
    const spread = read("../client/src/pages/SpreadAndDrop.tsx");
    const curveData = read("../client/src/lib/globalCurvesData.ts");
    const secondaryData = read("../client/src/lib/secondaryMarketsData.ts");
    const spreadData = read("../client/src/lib/spreadDropData.ts");
    const menuData = read("../client/src/lib/menuItemHandler.ts");
    for (const source of [regional, secondary, spread, curveData, secondaryData, spreadData, menuData]) expect(source).not.toContain("Math.random");
    expect(regional).toContain("useModuleLiveFeed('/regional-curves'");
    expect(secondary).toContain("useModuleLiveFeed('/secondary-markets'");
    expect(spread).toContain("useModuleLiveFeed('/spread-drop'");
    for (const label of ["选择地域", "国家", "2Y", "5Y", "10Y", "30Y", "利差", "变化"]) expect(regional).toContain(label);
    for (const label of ["信用债市场", "CDS 市场", "掉期市场", "ETF 市场", "市场详情展开面板"]) expect(secondary + secondaryData).toContain(label);
    for (const label of ["C+R 类型", "视图类型", "期限范围", "Y轴指标", "图表", "数据", "债券数据"]) expect(spread).toContain(label);
    expect(secondary).toContain("未使用随机报价或静态成交记录填充");
    expect(spread).toContain("未使用随机利差或静态债券值填充");
  });

  it("does not surface stale global snapshots or random legacy economic scenarios", () => {
    const ticker = read("../client/src/components/GlobalTickerTape.tsx");
    const legacyEconomic = read("../client/src/pages/EconomicDataHub_new.tsx");
    expect(ticker).toContain("24 * 60 * 60 * 1000");
    expect(ticker).toContain("Date.now() - observedAt < -5 * 60 * 1000");
    expect(ticker).not.toContain("Number.isFinite(price) ? price : 0");
    expect(legacyEconomic).not.toContain("Math.random");
    expect(legacyEconomic).toContain("不会使用固定结论、随机结果或历史样例替代计算");
  });
});

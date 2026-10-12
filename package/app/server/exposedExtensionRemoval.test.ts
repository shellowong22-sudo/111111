import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pricing = readFileSync(`${root}/client/src/components/pricing/PricingRiskPreservedRoute.tsx`, "utf8");
const portfolio = readFileSync(`${root}/client/src/components/portfolio/PortfolioRiskPreservedModule.tsx`, "utf8");
const economics = readFileSync(`${root}/client/src/components/econ/EconomicDataHubPreservedRoute.tsx`, "utf8");
const news = readFileSync(`${root}/client/src/components/news/NewsPreservedModule.tsx`, "utf8");
const comms = readFileSync(`${root}/client/src/components/comms/CommsPreservedModule.tsx`, "utf8");
const workflow = readFileSync(`${root}/client/src/components/electronic-trading/WorkflowPanel.tsx`, "utf8");
const portfolioManagement = readFileSync(`${root}/client/src/components/portfolio/PortfolioManagementPanel.tsx`, "utf8");
const moduleNavigation = readFileSync(`${root}/client/src/components/ModuleNavigation.tsx`, "utf8");
const terminal = readFileSync(`${root}/client/src/pages/Terminal.tsx`, "utf8");
const pricingPage = readFileSync(`${root}/client/src/pages/PricingRisk.tsx`, "utf8");
const index = readFileSync(`${root}/client/src/components/index/IndexPreservedModule.tsx`, "utf8");
const orderManagement = readFileSync(`${root}/client/src/components/order-management/OrderManagementPreservedRoute.tsx`, "utf8");
const electronicTrading = readFileSync(`${root}/client/src/components/electronic-trading/ElectronicTradingPreservedRoute.tsx`, "utf8");
const stp = readFileSync(`${root}/client/src/components/stp/StpProcessingPreservedRoute.tsx`, "utf8");
const tradeBook = readFileSync(`${root}/client/src/components/trade-book/TradeBookPreservedRoute.tsx`, "utf8");

describe("截图暴露层撤回与 EMSX 布局保护", () => {
  it("仅保留定价、投资组合、经济、新闻和通讯模块的原始工作区容器", () => {
    expect(pricing).toContain("<PricingRisk />");
    expect(pricing).not.toContain("ValuationAutomationLayer");
    expect(portfolio).toContain('data-preserved-portfolio-workspace="true"');
    expect(portfolio).not.toMatch(/PortfolioRiskResearchLayer|PortfolioRiskDossierPanel|PortfolioRiskTrendPanel|PortfolioRiskGovernanceAuditPanel|OasViewPresetPanel/);
    expect(economics).toContain('data-preserved-economic-hub="true"');
    expect(economics).not.toMatch(/EconomicCalendarOfficialObservations|OfficialMacroObservationDesk|EconomicFieldSourceDirectory/);
    expect(news).toContain("{children}");
    expect(news).not.toContain("NewsResearchLayer");
    expect(comms).toContain("{children}");
    expect(comms).not.toContain("CommsResearchLayer");
  });

  it("定价与风险、指数及四个交易区域不再挂载重复追加层", () => {
    expect(portfolio).toContain('data-preserved-portfolio-workspace="true"');
    expect(portfolio).not.toMatch(/PortfolioRiskDistinctExtension|PortfolioRiskDossierPanel|PortfolioRiskTrendPanel|PortfolioRiskResearchLayer/);
    expect(index).toContain('data-preserved-index-workspace="true"');
    expect(index).toContain('{children}');
    expect(index).not.toMatch(/IndexDistinctExtension|IndexEventWorkspace|IndexOfficialWeightImportPanel|IndexBasketCollaborationPanel|index-research-|查看本入口独立工具/);
    expect(orderManagement).toContain('<OrderManagement />');
    expect(orderManagement).not.toMatch(/OrderManagementResearchLayer|OrderManagementDistinctExtension/);
    expect(electronicTrading).toContain('<ElectronicTrading/>');
    expect(electronicTrading).not.toMatch(/ElectronicTradingResearchLayer|ElectronicTradingDataListExperience|ElectronicTradingDistinctExtension/);
    expect(stp).toContain('<STPProcessing/>');
    expect(stp).not.toMatch(/StpPrivateResearchLayer|StpPrivateTimelineOverlay|StpDistinctExtension/);
    expect(tradeBook).toContain('<TradeBook/>');
    expect(tradeBook).not.toMatch(/TradeBookPrivateResearchLayer|TradeBookDistinctExtension/);
  });

  it("为 EMSX 图表、规则表和执行表建立独立尺寸与滚动边界", () => {
    expect(workflow).toContain("overflow-x-hidden overflow-y-auto");
    expect(workflow).toContain('height={260}');
    expect(workflow).toContain('min-h-[440px] shrink-0');
    expect(workflow).toContain("minTickGap={48}");
    expect(workflow).toContain('flex min-h-0 flex-col rounded border border-slate-800 bg-slate-900 p-4');
  });

  it("不再渲染截图所示的投资组合顶部绿色功能入口栏", () => {
    expect(portfolioManagement).toContain("{renderPanel()}");
    expect(portfolioManagement).not.toContain('aria-label="投资组合工作台功能"');
    expect(portfolioManagement).not.toContain("TABS.map((tab) =>");
  });

  it("仍通过主终端原有菜单和功能码映射打开各投资组合工作区", () => {
    expect(moduleNavigation).toContain("<PortfolioManagementMenu");
    expect(moduleNavigation).toContain("onOpenPortfolioTab?.(tabId)");
    expect(terminal).toContain("PORTFOLIO_CODE_TO_TAB[itemId]");
    expect(terminal).toContain("<PortfolioManagementPanel initialTab={tabId} />");
  });

  it("不再渲染截图所示的定价与风险顶部功能代码横条", () => {
    expect(pricingPage).toContain("const tab = params.get('tab')");
    expect(pricingPage).toContain("{renderPanel()}");
    expect(pricingPage).not.toContain("{/* Tab 导航栏 */}");
    expect(pricingPage).not.toContain("{TABS.map(tab => (");
  });
});

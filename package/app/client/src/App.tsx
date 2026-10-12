import { useState, useEffect } from 'react';
import { useAuth } from './_core/hooks/useAuth';
import { startLogin } from './const';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTheme } from "./contexts/ThemeContext";
import ShortcutsHelpDialog from "./components/ShortcutsHelpDialog";
import GlobalTickerTape from "./components/GlobalTickerTape";
import TerminalSecurityOverlay from "./components/TerminalSecurityOverlay";
import AdminOpenBB from "./pages/admin/AdminOpenBB";
import AdminAgentReach from "./pages/admin/AdminAgentReach";
import Terminal from "@/pages/Terminal";
import IndexHub from "@/pages/IndexHub";
import IndexPreservedModule from "@/components/index/IndexPreservedModule";
import HelpPage from "@/pages/HelpPage";
import MarketDataPage from "@/pages/MarketDataPage";
import CurveSearch from "@/pages/CurveSearch";
import YieldCurveAnalysis from "@/pages/YieldCurveAnalysis";
import BondMarketData from "@/pages/BondMarketData";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import RateTraderByTerm from "./pages/RateTraderByTerm";
import SecondaryMarketsHub from "./pages/SecondaryMarketsHub";
import SpreadAndDrop from "./pages/SpreadAndDrop";
import G7CurvesHub from "./pages/G7CurvesHub";
import RegionalCurvesHub from "./pages/RegionalCurvesHub";
import ForexCurvesHub from "./pages/ForexCurvesHub";
import MacroeconomicDashboard from "./pages/MacroeconomicDashboard";
import CreditAnalysis from "./pages/CreditAnalysis";
import EquityMarket from "./pages/EquityMarket";
import CommodityMarket from "./pages/CommodityMarket";
import CryptoMarket from "./pages/CryptoMarket";
import EnergyMarket from "./pages/EnergyMarket";
import CurvesList from "./pages/CurvesList";
import CurveDetail from "./pages/CurveDetail";
import { GfLive } from "./components/live/GfLive";
import ModelPredictions from "./pages/ModelPredictions";
import Help from "./pages/Help";
import Settings from "./pages/Settings";
import ETFDetail from "./pages/ETFDetail";
import ETFHoldingsAdmin from "./pages/ETFHoldingsAdmin";
import FundBrowse from "./pages/FundBrowse";
import FundHoldings from "./pages/FundHoldings";
import FundCompare from "./pages/FundCompare";
import SearchResults from "./pages/SearchResults";
import MenuItemDetail from "./pages/MenuItemDetail";
import { DlibLive } from "./components/live/DerivLibLive";
import { BicoLive } from "./components/live/FxDeskLive2";
import { CdswLive, WbfLive, WbmvLive } from "./components/live/BondRatesLive";
import { SOVRLive } from "./components/live/CreditXLive2";
import { WvolLive } from "./components/live/RatesFxLive2";
import { MarsLive, VcaLive } from "./components/live/RiskVolLive";
import { LiveValuation, LiveYieldCurve } from "./components/live/PricingLive";
import { MosoLive, SwpmLive } from "./components/live/DerivXLive";
import MarketManagePage from "./pages/MarketManagePage";
import FuturesOptionsMonitor from "./pages/FuturesOptionsMonitor";
import CreditMonitorAdvanced from "./pages/CreditMonitorAdvanced";
import UcRouteDock from "./uc/UcRouteDock";
import SourceVeil from "./uc/SourceVeil";
import CommunicationsHubPreservedRoute from "./components/comms/CommunicationsHubPreservedRoute";
import FxTerminal from "./uc/hubs/FxTerminal";
import BondTerminal from "./uc/hubs/BondTerminal";
import { AuctionDesk, RatesDesk } from "./uc/hubs/RatesDesk";
import { CommodityTerminal, MetalsDesk } from "./uc/hubs/FuturesDesk";
import { CreditTerminal } from "./uc/hubs/CreditDesk";
import { DerivNewsDesk, FxOptionDesk } from "./uc/hubs/VolDesk";
import { AllocationDesk, SectorDesk, StressDesk } from "./uc/hubs/AllocDesk";
import { ConvertibleDesk, RealEstateDesk } from "./uc/hubs/PropertyDesk";
import DerivTerminal from "./uc/hubs/DerivTerminal";
import PortfolioTerminal from "./uc/hubs/PortfolioTerminal";
import NewsResearchHubPreservedRoute from "./components/news/NewsResearchHubPreservedRoute";
import EconomicDataHubPreservedRoute from "./components/econ/EconomicDataHubPreservedRoute";
import IndustryGroupPreservedRoute from "./components/industry-group/IndustryGroupPreservedRoute";
import ElectronicTradingPreservedRoute from "./components/electronic-trading/ElectronicTradingPreservedRoute";
import TradeBookPreservedRoute from "./components/trade-book/TradeBookPreservedRoute";
import PricingRiskPreservedRoute from "./components/pricing/PricingRiskPreservedRoute";
import BQuant from "./pages/BQuant";
import StpProcessingPreservedRoute from "./components/stp/StpProcessingPreservedRoute";
import ALLQ from "./pages/ALLQ";
import OrderManagementPreservedRoute from "./components/order-management/OrderManagementPreservedRoute";
import TradeBlotter from "./pages/TradeBlotter";
import FixedIncomeTrade from "./pages/FixedIncomeTrade";
import BMAP from "./pages/BMAP";
import BSRCH from "./pages/BSRCH";
import BVOL from "./pages/BVOL";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SecureAdminConsole from "./pages/admin/SecureAdminConsole";
import PersonalWorkspace from "./pages/PersonalWorkspace";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMarketData from "./pages/admin/AdminMarketData";
import AdminDataIngestion from "./pages/admin/AdminDataIngestion";
import AdminAiManagement from "./pages/admin/AdminAiManagement";
import AdminAiCrawler from "./pages/admin/AdminAiCrawler";
import AdminScrapling from "./pages/admin/AdminScrapling";
import AdminDataModules from "./pages/admin/AdminDataModules";
import AdminAutomationCenter from "./pages/admin/AdminAutomationCenter";
import AdminMonitor from "./pages/admin/AdminMonitor";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminExportRegistry from "./pages/admin/AdminExportRegistry";
import NotificationCenter from "./pages/NotificationCenter";
import ExportSignatureVerification from "./pages/ExportSignatureVerification";
import TradingLedger from "./pages/TradingLedger";
import CommodityDerivatives from "./pages/CommodityDerivatives";
import CommodityFutures from "./pages/CommodityFutures";
import ComponentShowcase from "./pages/ComponentShowcase";
import ConvertibleBondsCategory from "./pages/ConvertibleBondsCategory";
import CreditDerivatives from "./pages/CreditDerivatives";
import DerivativesBaseRaw from "./pages/DerivativesBase";
const DerivativesBase = () => <DerivativesBaseRaw title="衍生品基础" code="DERI" description="衍生品基础分析" apiEndpoint="/api/derivatives" dataType="dashboard" />;
import DerivativesEnhanced from "./pages/DerivativesEnhanced";
import DerivativesNews from "./pages/DerivativesNews";
import DerivativesResearch from "./pages/DerivativesResearch";
import EquityDerivatives from "./pages/EquityDerivatives";
import FXDerivatives from "./pages/FXDerivatives";
import GlobalCDS from "./pages/GlobalCDS";
import IndexDerivatives from "./pages/IndexDerivatives";
import IndexFutures from "./pages/IndexFutures";
import IndexOptions from "./pages/IndexOptions";
import LatestFeatures from "./pages/LatestFeatures";
import PricingAndRisk from "./pages/PricingAndRisk";
import RateInflationDerivatives from "./pages/RateInflationDerivatives";
import FilesAndResources from "./pages/FilesAndResources";
import UcheerAi from "./pages/UcheerAi";
// ProtectedRoute: 角色守卫组件，未授权时显示权限不足提示
function ProtectedRoute({
  component: Component,
  check,
  label,
}: {
  component: React.ComponentType;
  check: (auth: ReturnType<typeof useAuth>) => boolean;
  label?: string;
}) {
  const auth = useAuth();
  if (auth.loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }
  if (!auth.isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 max-w-md p-8 rounded-xl border border-border bg-card">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-semibold">需要登录</h2>
          <p className="text-muted-foreground text-sm">请先登录后再访问此页面。</p>
          <button onClick={() => startLogin(`${window.location.pathname}${window.location.search}`)}
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 transition-opacity">
            立即登录
          </button>
        </div>
      </div>
    );
  }
  if (!check(auth)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 max-w-md p-8 rounded-xl border border-border bg-card">
          <div className="text-4xl">🚫</div>
          <h2 className="text-xl font-semibold">权限不足</h2>
          <p className="text-muted-foreground text-sm">
            您没有访问{label ? `「${label}」` : '此页面'}的权限。
            {auth.role === 'user' && (
              <span className="block mt-1">请联系管理员为您分配相应角色。</span>
            )}
          </p>
          <div className="text-xs text-muted-foreground/60 border border-border/50 rounded px-3 py-2 bg-muted/30">
            当前角色：<span className="font-mono font-medium text-foreground">{auth.role ?? '未登录'}</span>
          </div>
          <button onClick={() => window.history.back()}
            className="inline-block px-4 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors">
            返回上一页
          </button>
        </div>
      </div>
    );
  }
  return <Component />;
}

/**
 * 指数综合分析中心总览已删除：股票指数数据统一由股票 WEI 工作台承载，
 * 因此不带 panel 的 /index-hub 仍转到 WEI。
 * 带 panel 的深链（SECF、HELP_INDX、IN、INP、CIX、CIXB、AGG、WT、CIXN、
 * CIXS、CIXR、CIXC、CIXX、CIXI、WEIF、WBIX、GMM、RRG 等）是指数菜单各条目
 * 的专属工具，必须打开 IndexHub 中对应的面板，不能一律落到 WEI。
 */
function IndexHubRoute() {
  const [, setLocation] = useLocation();
  const panel = new URLSearchParams(window.location.search).get("panel")?.toUpperCase();
  const hasDedicatedPanel = Boolean(panel && panel !== "WEI");
  useEffect(() => {
    if (!hasDedicatedPanel) setLocation("/terminal?module=stocks&open=wei");
  }, [hasDedicatedPanel, setLocation]);
  if (!hasDedicatedPanel) return null;
  return <IndexPreservedModule><IndexHub /></IndexPreservedModule>;
}
const ForexHubPreservedRoute = () => <FxTerminal />;
const RatesRoute = () => <RatesDesk />;
const RatesTermRoute = () => <RatesDesk initial="buckets" />;
const CommodityRoute = () => <CommodityTerminal />;
/** 与终端小窗同一实现（原页面为空壳 / 写死数据，已替换） */
const DlibRoute = () => <div className="h-screen bg-[#03070c]"><DlibLive /></div>;
const BicoRoute = () => <div className="h-screen bg-[#03070c]"><BicoLive /></div>;
/** 同一功能代码的页面与小窗共用同一实现（页面只是满屏外壳） */
const Full = ({ children }: { children: React.ReactNode }) => <div className="h-screen bg-[#03070c]">{children}</div>;
const WbfRoute = () => <Full><WbfLive /></Full>;
const FinancialAnalysisRoute = () => <Full><GfLive /></Full>;
const CdswRoute = () => <Full><CdswLive /></Full>;
const WcdsRoute = () => <Full><SOVRLive /></Full>;
const WvolRoute = () => <Full><WvolLive /></Full>;
const VcaRoute = () => <Full><VcaLive /></Full>;
const MarsRoute = () => <Full><MarsLive /></Full>;
const GrmRoute = () => <Full><WbmvLive /></Full>;
const OvmeRoute = () => <Full><LiveValuation /></Full>;
const SwpmRoute = () => <Full><SwpmLive /></Full>;
const MosoRoute = () => <Full><MosoLive /></Full>;
const CurvesRoute = () => <Full><LiveYieldCurve /></Full>;
const CommodityPerfRoute = () => <CommodityTerminal initial="perf" />;


function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Terminal} />
      <Route path={"/terminal"} component={Terminal} />
      <Route path={"/home"} component={Terminal} />
      <Route path={"/market"} component={MarketDataPage} />
      <Route path={"/curve-search"} component={CurveSearch} />
      <Route path={"/yield-curve"} component={YieldCurveAnalysis} />
      <Route path={"/bond-market"} component={BondMarketData} />
      <Route path={"/interest-rates"} component={GrmRoute} />
      <Route path={"/rate-trader"} component={RatesRoute} />
      <Route path={"/rate-trader-by-term"} component={RateTraderByTerm} />
      <Route path={"/multi-term-dashboard"} component={RatesTermRoute} />
      <Route path={"/secondary-markets"} component={SecondaryMarketsHub} />
      <Route path={"/spread-drop"} component={SpreadAndDrop} />
      <Route path={"/g7-curves"} component={G7CurvesHub} />
      <Route path={"/regional-curves"} component={RegionalCurvesHub} />
      <Route path={"/forex-curves"} component={ForexCurvesHub} />
      <Route path={"/bond-trader"} component={AuctionDesk} />
      <Route path={"/derivatives-trader"} component={DerivTerminal} />
      <Route path={"/industry-analysis"} component={IndustryGroupPreservedRoute} />
      <Route path={"/risk-management"} component={() => <ProtectedRoute component={StressDesk} check={(a) => a.canAccessRiskManagement} label="风险管理" />} />
      <Route path={"/portfolio-optimizer"} component={PortfolioTerminal} />
      <Route path={"/macro-dashboard"} component={MacroeconomicDashboard} />
      <Route path={"/sector-analysis"} component={SectorDesk} />
      <Route path={"/asset-allocation"} component={AllocationDesk} />
      <Route path={"/fixed-income"} component={BondTerminal} />
      <Route path={"/credit-analysis"} component={CreditAnalysis} />
      <Route path={"/equity-market"} component={EquityMarket} />
      <Route path={"/commodity-market"} component={CommodityMarket} />
      <Route path={"/crypto-market"} component={() => <CryptoMarket />} />
      <Route path={"/real-estate"} component={RealEstateDesk} />
      <Route path={"/energy-market"} component={EnergyMarket} />
      <Route path={"/precious-metals"} component={MetalsDesk} />
      <Route path={"/curves-list"} component={CurvesList} />
      <Route path={"/curve-detail/:curveId"} component={CurveDetail} />
      <Route path={"/financial-analysis"} component={FinancialAnalysisRoute} />
      <Route path={"/credit-ratings"} component={CreditTerminal} />
      <Route path={"/model-predictions"} component={ModelPredictions} />
      <Route path={"/help"} component={Help} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/curves-compare"} component={CurvesRoute} />
      <Route path={"/etf-detail/:etfId"} component={ETFDetail} />
      <Route path={"/etf-holdings-admin"} component={ETFHoldingsAdmin} />
      <Route path={"/fund-browse"} component={FundBrowse} />
      <Route path={"/fund-holdings"} component={FundHoldings} />
      <Route path={"/fund-compare"} component={FundCompare} />
      <Route path={"/search-results"} component={SearchResults} />
      <Route path={"/menu-item/:itemId"} component={MenuItemDetail} />
      <Route path={"/swpm"} component={SwpmRoute} />
      <Route path={"/wbf"} component={WbfRoute} />
      <Route path={"/cdsw"} component={CdswRoute} />
      <Route path={"/wcds"} component={WcdsRoute} />
      <Route path={"/ovme"} component={OvmeRoute} />
      <Route path={"/moso"} component={MosoRoute} />
      <Route path={"/fom"} component={FuturesOptionsMonitor} />
      <Route path={"/wbf-ai"} component={WbfRoute} />
      <Route path={"/credit-monitor"} component={CreditMonitorAdvanced} />
      <Route path={"/ovml"} component={FxOptionDesk} />
      <Route path={"/wvol"} component={WvolRoute} />
      <Route path={"/glco"} component={CommodityRoute} />
      <Route path={"/commodity-prices"} component={CommodityPerfRoute} />
      <Route path={"/ovcv"} component={ConvertibleDesk} />
      <Route path={"/dlib"} component={DlibRoute} />
      <Route path={"/vca"} component={VcaRoute} />
      <Route path={"/mars"} component={MarsRoute} />
      <Route path={"/ni-drv"} component={DerivNewsDesk} />
      <Route path={"/deri"} component={DerivativesEnhanced} />
      <Route path={"/bico"} component={BicoRoute} />
      <Route path={"/market-manage"} component={MarketManagePage} />
      <Route path={"/index-hub"} component={IndexHubRoute} />
      <Route path={"/forex-hub"} component={ForexHubPreservedRoute} />
      <Route path={"/comms-hub"} component={CommunicationsHubPreservedRoute} />
      <Route path={"/news-hub"} component={NewsResearchHubPreservedRoute} />
      <Route path={"/ucheer-ai"} component={UcheerAi} />
      <Route path={"/econ-hub"} component={EconomicDataHubPreservedRoute} />
      <Route path={"/industry-group"} component={IndustryGroupPreservedRoute} />
      <Route path={"/electronic-trading"} component={() => <ProtectedRoute component={ElectronicTradingPreservedRoute} check={(a) => a.canAccessTrading} label="电子交易" />} />
      <Route path={"/trade-book"} component={() => <ProtectedRoute component={TradeBookPreservedRoute} check={(a) => a.canAccessTrading} label="交易账簿" />} />
      <Route path={"/pricing-risk"} component={() => <ProtectedRoute component={PricingRiskPreservedRoute} check={(a) => a.canAccessRiskManagement} label="定价风险" />} />
      <Route path={"/bquant"} component={BQuant} />
      <Route path={"/stp-processing"} component={StpProcessingPreservedRoute} />
      <Route path={"/allq"} component={ALLQ} />
      <Route path={"/order-management"} component={() => <ProtectedRoute component={OrderManagementPreservedRoute} check={(a) => a.canAccessTrading} label="订单管理" />} />
      <Route path={"/trade-blotter"} component={TradeBlotter} />
      <Route path={"/fixed-income-trade"} component={FixedIncomeTrade} />
      <Route path={"/bmap"} component={BMAP} />
      <Route path={"/bsrch"} component={BSRCH} />
      <Route path={"/bvol"} component={BVOL} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} check={(a) => a.canAccessAdmin} label="管理后台" />} />
      <Route path="/secure-admin" component={() => <ProtectedRoute component={SecureAdminConsole} check={(a) => a.canAccessAdmin} label="安全管理后台" />} />
      <Route path="/workspace" component={PersonalWorkspace} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} check={(a) => a.canAccessAdmin} label="用户管理" />} />
      <Route path="/admin/market-data" component={() => <ProtectedRoute component={AdminMarketData} check={(a) => a.canAccessAdmin} label="行情数据管理" />} />
      <Route path="/admin/data-ingestion" component={() => <ProtectedRoute component={AdminDataIngestion} check={(a) => a.canAccessAdmin} label="AI 数据采集" />} />
      <Route path="/admin/data-modules" component={() => <ProtectedRoute component={AdminDataModules} check={(a) => a.canAccessAdmin || !!a.user} label="佑诚数据工作台" />} />
      <Route path="/admin/automation-center" component={() => <ProtectedRoute component={AdminAutomationCenter} check={(a) => a.canAccessAdmin} label="自动化任务中心" />} />
      <Route path="/admin/ai-management" component={() => <ProtectedRoute component={AdminAiManagement} check={(a) => a.canAccessAdmin} label="AI 管理" />} />
      <Route path="/admin/ai-crawler" component={() => <ProtectedRoute component={AdminAiCrawler} check={(a) => a.canAccessAdmin} label="专属 AI 爬虫" />} />
      <Route path="/admin/scrapling" component={() => <ProtectedRoute component={AdminScrapling} check={(a) => a.canAccessAdmin} label="Scrapling 采集引擎" />} />
      <Route path="/admin/monitor" component={() => <ProtectedRoute component={AdminMonitor} check={(a) => a.canAccessAdmin} label="系统监控" />} />
      <Route path="/admin/settings" component={() => <ProtectedRoute component={AdminSettings} check={(a) => a.canAccessAdmin} label="系统设置" />} />
      <Route path="/admin/announcements" component={() => <ProtectedRoute component={AdminAnnouncements} check={(a) => a.canAccessAdmin} label="公告管理" />} />
  <Route path="/admin/export-registry" component={() => <ProtectedRoute component={AdminExportRegistry} check={(a) => a.canAccessAdmin} label="下载登记" />} />
  <Route path="/admin/openbb" component={() => <ProtectedRoute component={AdminOpenBB} check={(a) => a.canAccessAdmin} label="OpenBB 研究引擎" />} />
  <Route path="/admin/agent-reach" component={() => <ProtectedRoute component={AdminAgentReach} check={(a) => a.canAccessAdmin} label="Agent Reach 互联网能力" />} />
      <Route path="/notifications" component={NotificationCenter} />
      <Route path="/verify-export" component={ExportSignatureVerification} />
      <Route path="/trading-ledger" component={TradingLedger} />
      <Route path={"/bond-futures"} component={WbfRoute} />
      <Route path={"/commodity-derivatives"} component={CommodityDerivatives} />
      <Route path={"/commodity-futures"} component={CommodityFutures} />
      <Route path={"/_showcase"} component={ComponentShowcase} />
      <Route path={"/_latest"} component={LatestFeatures} />
      <Route path={"/_files"} component={FilesAndResources} />
      <Route path={"/_pricing-and-risk"} component={PricingAndRisk} />
      <Route path={"/_derivatives-base"} component={DerivativesBase} />
      <Route path={"/_derivatives-news"} component={DerivativesNews} />
      <Route path={"/_derivatives-research"} component={DerivativesResearch} />
      <Route path={"/_rate-inflation-derivatives"} component={RateInflationDerivatives} />
      <Route path={"/_convertible-bonds-category"} component={ConvertibleBondsCategory} />
      <Route path={"/_credit-derivatives"} component={CreditDerivatives} />
      <Route path={"/_equity-derivatives"} component={EquityDerivatives} />
      <Route path={"/_fx-derivatives"} component={FXDerivatives} />
      <Route path={"/_global-cds"} component={GlobalCDS} />
      <Route path={"/_index-derivatives"} component={IndexDerivatives} />
      <Route path={"/_index-futures"} component={IndexFutures} />
      <Route path={"/_index-options"} component={IndexOptions} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

// NOTE: About Keyboard Shortcuts
// - Global shortcuts are registered via useKeyboardShortcuts() hook in AppContent
// - F1-F9: Quick navigation to different pages
// - Ctrl+K: Open command palette
// - Ctrl+/: Show shortcuts help
// - Ctrl+T: Toggle theme
// - Ctrl+R: Refresh data
// - Ctrl+L: Clear search

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { toggleTheme } = useTheme();
  const [location] = useLocation();
  const routePath = location.split('?')[0];
  const isAdminSurface = routePath.startsWith('/admin') || routePath === '/secure-admin';
  const isTerminalWorkspace = routePath === '/' || routePath === '/home' || routePath.startsWith('/terminal');
  const isScopedResearch = routePath === '/econ-hub' || routePath === '/news-hub';

  // Register global keyboard shortcuts
  useKeyboardShortcuts();

  // Listen for custom events from shortcuts
  useEffect(() => {
    const handleOpenShortcutsHelp = () => setShowShortcutsHelp(true);
    const handleToggleTheme = () => toggleTheme?.();

    window.addEventListener('open-shortcuts-help', handleOpenShortcutsHelp);
    window.addEventListener('toggle-theme', handleToggleTheme);

    return () => {
      window.removeEventListener('open-shortcuts-help', handleOpenShortcutsHelp);
      window.removeEventListener('toggle-theme', handleToggleTheme);
    };
  }, [toggleTheme]);

  return (
    <>
      <Router />
      {!isAdminSurface && <TerminalSecurityOverlay />}
      {!isAdminSurface && <UcRouteDock />}
      {!isAdminSurface && <SourceVeil />}
      <ShortcutsHelpDialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp} />
      {!isAdminSurface && !isTerminalWorkspace && !isScopedResearch && routePath !== '/commodity-futures' && routePath !== '/_index-options' && <GlobalTickerTape />}
    </>
  );
}

export default App;

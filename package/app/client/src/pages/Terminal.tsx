import React, { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import TerminalCommandBar from "@/components/TerminalCommandBar";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import ModuleNavigation from "@/components/ModuleNavigation";
import TerminalLayout, { WindowConfig } from "@/components/TerminalLayout";
import MarketDataPanel from "@/components/MarketDataPanel";
import YieldCurveChart from "@/components/YieldCurveChart";
import CandleChart from "@/components/CandleChart";
import MessagingPanel from "@/components/MessagingPanel";
import CommsPreservedModule from "@/components/comms/CommsPreservedModule";
import NewsPanel from "@/components/NewsPanel";
import NewsPreservedModule from "@/components/news/NewsPreservedModule";
import EconomicDashboard from "@/components/EconomicDashboard";
import PortfolioManagementPanel, {
  PORTFOLIO_CODE_TO_TAB,
} from "@/components/portfolio/PortfolioManagementPanel";
import PortfolioRiskPreservedModule from "@/components/portfolio/PortfolioRiskPreservedModule";
import OrderBookPanel from "@/components/OrderBookPanel";
import TradingPanel from "@/components/TradingPanel";
import PricingRiskPanel from "@/components/PricingRiskPanel";
import STPPanel from "@/components/STPPanel";
import TradeBookPanel from "@/components/TradeBookPanel";
import SettingsPanel from "@/components/SettingsPanel";
import SECFPanel from "@/components/SECFPanel";
import PSCHPanel from "@/components/PSCHPanel";
import GlobalBondMarketPanel from "@/components/GlobalBondMarketPanel";
import FITPanel from "@/components/FITPanel";
import BTMMPanel from "@/components/BTMMPanel";
import GCDSPanel from "@/components/GCDSPanel";
import COUNPanel from "@/components/COUNPanel";
import DEBTPanel from "@/components/DEBTPanel";
import MIPRPanel from "@/components/MIPRPanel";
import SRSKPanel from "@/components/SRSKPanel";
import GMMPanel from "@/components/GMMPanel";
import YCURVEPanel from "@/components/YCURVEPanel";
import GCPanel from "@/components/GCPanel";
import SOVMPanel from "@/components/SOVMPanel";
import WBMVPanel from "@/components/WBMVPanel";
import GOVIPanel from "@/components/GOVIPanel";
import GRMPanel from "@/components/GRMPanel";
import { DesBondLive, WbfLive, WbmvLive } from "@/components/live/BondRatesLive";
import BondMarketDataPage from "@/pages/BondMarketData";
import HSPanel from "@/components/HSPanel";
import GOVYPanel from "@/components/GOVYPanel";
import WBIPanel from "@/components/WBIPanel";
import ILBPanel from "@/components/ILBPanel";
import IFMOPanel from "@/components/IFMOPanel";
import GCPIPanel from "@/components/GCPIPanel";
import GIYPanel from "@/components/GIYPanel";
import ECSTPanel from "@/components/ECSTPanel";
import TFLOPanel from "@/components/TFLOPanel";
import WCDMPanel from "@/components/WCDMPanel";
import DMMVPanel from "@/components/DMMVPanel";
import USSWPanel from "@/components/USSWPanel";
import BCMPPanel from "@/components/BCMPPanel";
import WETFPanel from "@/components/WETFPanel";
import WBFPanel from "@/components/WBFPanel";
import CDSWPanel from "@/components/CDSWPanel";
import VCAPanel from "@/components/VCAPanel";
import MARSPanel from "@/components/MARSPanel";
import OVCVPanel from "@/components/OVCVPanel";
import DLIBPanel from "@/components/DLIBPanel";
import MOSOPanel from "@/components/MOSOPanel";
import NCEOPanel from "@/components/NCEOPanel";
import OVMLPanel from "@/components/OVMLPanel";
import WIRPanel from "@/components/WIRPanel";
import FICMPanel from "@/components/FICMPanel";
import CDXPanel from "@/components/CDXPanel";
import WCDSPanel from "@/components/WCDSPanel";
import SOVRPanel from "@/components/SOVRPanel";
import FXCPanel from "@/components/FXCPanel";
import WCRPanel from "@/components/WCRPanel";
import WVOLPanel from "@/components/WVOLPanel";
import XCCYPanel from "@/components/XCCYPanel";
import FXSWPanel from "@/components/FXSWPanel";
import FXFCPanel from "@/components/FXFCPanel";
import WCRSPanel from "@/components/WCRSPanel";
import FIRSPanel from "@/components/FIRSPanel";
import TCONPanel from "@/components/TCONPanel";
import BOOMPanel from "@/components/BOOMPanel";
import EDSFPanel from "@/components/EDSFPanel";
import MMCVPanel from "@/components/MMCVPanel";
import REPOPanel from "@/components/REPOPanel";
import CRPRPanel from "@/components/CRPRPanel";
import RATCPanel from "@/components/RATCPanel";
import BYFCPanel from "@/components/BYFCPanel";
import MPAYPanel from "@/components/MPAYPanel";
import BCLOPanel from "@/components/BCLOPanel";
import CRVFPanel from "@/components/CRVFPanel";
import WEIPanel from "@/components/WEIPanel";
import GFPanel from "@/components/GFPanel";
import OVPanel from "@/components/OVPanel";
import FXCORRPanel from "@/components/FXCORRPanel";
import CORRPanel from "@/components/CORRPanel";
import TAYLRPanel from "@/components/TAYLRPanel";
import ECSUPanel from "@/components/ECSUPanel";
import FXIVPanel from "@/components/FXIVPanel";
import OILSPanel from "@/components/OILSPanel";
import GIPOPanel from "@/components/GIPOPanel";
import IMAPPanel from "@/components/IMAPPanel";
import EQSPanel from "@/components/EQSPanel";
import ETFPanel from "@/components/ETFPanel";
import FundBrowse from "@/pages/FundBrowse";
import QuickToolsPanel from "@/components/QuickToolsPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import TechnicalAnalysisPanel from "@/components/TechnicalAnalysisPanel";
import PortfolioAnalysisPanel from "@/components/PortfolioAnalysisPanel";
import MarketNewsPanel from "@/components/MarketNewsPanel";
import StockScreenerPanel from "@/components/StockScreenerPanel";
import PriceAlertPanel from "@/components/PriceAlertPanel";
import EconomicCalendarPanel from "@/components/EconomicCalendarPanel";
import BacktestEnginePanel from "@/components/BacktestEnginePanel";
import MarketSentimentPanel from "@/components/MarketSentimentPanel";
import InvestmentNotesPanel from "@/components/InvestmentNotesPanel";
import IRSMonitorPanel from "@/components/IRSMonitorPanel";
import ExpertMonitorPanel from "@/components/ExpertMonitorPanel";
import CountryMonitorPanel from "@/components/CountryMonitorPanel";
import SovereignSearchPanel from "@/components/SovereignSearchPanel";
import SovereignMarketSearchPanel from "@/components/SovereignMarketSearchPanel";
import SecInfoPanel from "@/components/SecInfoPanel";
import DESPanel from "@/components/DESPanel";
import YASPanel from "@/components/YASPanel";
import TopBonPanel from "@/components/TopBonPanel";
import CT10Panel from "@/components/CT10Panel";
import CalcPanel from "@/components/CalcPanel";
import PricingPanel from "@/components/PricingPanel";
import IMGRPanel from "@/components/IMGRPanel";
import RUNZPanel from "@/components/RUNZPanel";
import IssuancePanel from "@/components/IssuancePanel";
import InflationPanel from "@/components/InflationPanel";
import FuturesOptionsMonitor from "@/pages/FuturesOptionsMonitor";
import CreditMonitorAdvanced from "@/pages/CreditMonitorAdvanced";
import SECDESCPanel from "@/components/SECDESCPanel";
import MKTOVPanel from "@/components/MKTOVPanel";
import GLBBONDPanel from "@/components/GLBBONDPanel";
import GCDSEnhancedPanel from "@/components/GCDSEnhancedPanel";
import YCURVEEnhancedPanel from "@/components/YCURVEEnhancedPanel";
import GCEnhancedPanel from "@/components/GCEnhancedPanel";
import NEWSRPTPanel from "@/components/NEWSRPTPanel";
import INPanel from "@/components/INPanel";
import WBIXPanel from "@/components/WBIXPanel";
import INSPanel from "@/components/INSPanel";
import IBMAnalysisPanel from "@/components/IBMAnalysisPanel";
import PRICINGEnhancedPanel from "@/components/PRICINGEnhancedPanel";
import IMGREnhancedPanel from "@/components/IMGREnhancedPanel";
import RUNZEnhancedPanel from "@/components/RUNZEnhancedPanel";
import NIMPanel from "@/components/NIMPanel";
import DESBondPanel from "@/components/DESBondPanel";
import FTWPanel from "@/components/FTWPanel";
import FactorLabPanel from "@/components/FactorLabPanel";
import EVTSPanel from "@/components/EVTSPanel";
import MOSTPanel from "@/components/MOSTPanel";
import ANRPanel from "@/components/ANRPanel";
import RVPanel from "@/components/RVPanel";
import DDISPanel from "@/components/DDISPanel";
import OMONPanel from "@/components/OMONPanel";
import PEPanel from "@/components/PEPanel";
import EMSXPanel from "@/components/EMSXPanel";
import CACTPanel from "@/components/CACTPanel";
import MunicipalCACTPanel from "@/components/MunicipalCACTPanel";
import MAPanel from "@/components/MAPanel";
import IPOPanel from "@/components/IPOPanel";
import TACTEnhancedPanel from "@/components/TACTEnhancedPanel";
import NICEPanel from "@/components/NICEPanel";
import CDERIVPanel from "@/components/CDERIVPanel";
import CREDANALPanel from "@/components/CREDANALPanel";
import FIWSPanel from "@/components/FIWSPanel";
import CRANPanel from "@/components/CRANPanel";
import LOANSPanel from "@/components/LOANSPanel";
import CRMXPanel from "@/components/CRMXPanel";
import CreditCoreSpecialistPanels from "@/components/credit/CreditCoreSpecialistPanels";
import CreditIssuerAndAnalyticsPanels from "@/components/credit/CreditIssuerAndAnalyticsPanels";
import CreditPostTradeDeliveryPanels from "@/components/credit/CreditPostTradeDeliveryPanels";
import CreditModuleLiveDelivery from "@/components/credit/CreditModuleLiveDelivery";
import CTMPanel from "@/components/CTMPanel";
import SEAGPanel from "@/components/SEAGPanel";
import CCRVPanel from "@/components/CCRVPanel";
import WEIFPanel from "@/components/WEIFPanel";
import RRGPanel from "@/components/RRGPanel";
import FOECPanel from "@/components/FOECPanel";
import PMIPanel from "@/components/PMIPanel";
import WIRPPanel from "@/components/WIRPPanel";
import ECTRPanel from "@/components/ECTRPanel";
import WFIIPanel from "@/components/WFIIPanel";
import RSANPanel from "@/components/RSANPanel";
import ECFCPanel from "@/components/ECFCPanel";
import FCONPanel from "@/components/FCONPanel";
import ECANPanel from "@/components/ECANPanel";
import CENBPanel from "@/components/CENBPanel";
import CBRTPanel from "@/components/CBRTPanel";
import { useIsMobile } from "@/hooks/useMobile";
import { Menu, X } from "lucide-react";
import MAPPanel from "@/components/MAPPanel";
import CPLYPanel from "@/components/CPLYPanel";
import COSYPanel from "@/components/COSYPanel";
import GPPanel from "@/components/GPPanel";
import CommodityPreservedModule from "@/components/commodity/CommodityPreservedModule";
import CftcCommodityPanel from "@/components/commodity/CftcCommodityPanel";
import CIXPanel from "@/components/CIXPanel";
import CDRNPanel from "@/components/CDRNPanel";
import CDRCPanel from "@/components/CDRCPanel";
import CDRAPanel from "@/components/CDRAPanel";
import CNDSPanel from "@/components/CNDSPanel";
import CDRVPanel from "@/components/CDRVPanel";
import DEALPanel from "@/components/DEALPanel";
import MCALPanel from "@/components/MCALPanel";
import MSRCPanel from "@/components/MSRCPanel";
import SMUNPanel from "@/components/SMUNPanel";
import MBIXPanel from "@/components/MBIXPanel";
import VRDNPanel from "@/components/VRDNPanel";
import BMAPanel from "@/components/BMAPanel";
import MSRBPanel from "@/components/MSRBPanel";
import SLGSPanel from "@/components/SLGSPanel";
import MuniSecInfoPanel from "@/components/MuniSecInfoPanel";
import MunicipalPreservedModule from "@/components/municipal/MunicipalPreservedModule";
import AAAPanel from "@/components/AAAPanel";
import PICKPanel from "@/components/PICKPanel";
import MBWDPanel from "@/components/MBWDPanel";
import {
  CIXBPanel,
  CIXNPanel,
  CIXSPanel,
  CIXRPanel,
  CIXCPanel,
  CIXXPanel,
  CIXIPanel,
  INPPanel,
} from "@/components/CIXEditors";
import { XdshLive as XDSHPanel, AllqLive as ALLQPanel, FrdLive as FRDPanel, BfixLive as BFIXPanel, FxfaLive as FXFAPanel } from "@/components/live/FxDeskLive3";
import { FxipLive as FXIPPanel, EcmiLive as ECMIPanel } from "@/components/live/FxInfoLive";
import { FxdsLive as FXDSPanel, FxtfLive as FXTFPanel, StniLive as STNIPanel } from "@/components/live/RatesFxLive2";
import { MarsFxLive, TopFxLive, BicoLive, MyqLive } from "@/components/live/FxDeskLive2";
import ForexPreservedModule from "@/components/forex/ForexPreservedModule";
import ForexOriginalInteractionBridge from "@/components/forex/ForexOriginalInteractionBridge";
import {
  FXInformationPortalWorkspace,
  FXCrossMatrixWorkspace,
  FXRelativePerformanceWorkspace,
  FXVolatilitySurfaceWorkspace,
  FXCrossCurrencyBasisWorkspace,
  FXMacroDriverWorkspace,
  FXStrategyHypothesisWorkspace,
  FXResearchCatalogWorkspace,
  FXTransmissionRuleWorkspace,
  FXOptionScenarioWorkspace,
} from "@/components/forex/ForexRestoredWorkspaces";
import {
  FXDataCatalogWorkspace,
  FXConventionWorkspace,
  FXCrossReferenceDesk,
  FXForwardInputLab,
  FXWorkspaceLayoutStudio,
  FXObservationChangeArchive,
  FXStrengthRankingDesk,
} from "@/components/forex/ForexIndependentWorkspaces";
import DerivativesPreservedModule from "@/components/derivatives/DerivativesPreservedModule";
import {
  MBSSecInfoPanel,
  MBSSECFPanel,
  MBSMTGSPanel,
  MBSMTGHPanel,
  MBSNewIssuesPanel,
  MBSMCALPanel,
  MBSIMGRPanel,
} from "@/components/MBSPanels1to7";
import {
  MBSSTSHPanel,
  MBSCurrentMarketPanel,
  MBSTBPFPanel,
  MBSRatingTrendPanel,
  MBSBMMIPanel,
  MBSNewsResearchPanel,
  MBSFIRSPanel,
} from "@/components/MBSPanels8to14";
import {
  MBSNIPanel,
  MBSGNAnalysisPanel,
  MBSDESPanel,
  MBSYTPanel,
  MBSFIBCPanel,
  MBSQPanel,
  MBSCMAPPanel,
} from "@/components/MBSPanels15to21";
import {
  MBSIndexPanel,
  MBSTBPFMCCNPanel,
  MBSAssetClassPanel,
  MBSRMBSvsCMBSPanel,
  MBSVolumePerformancePanel,
} from "@/components/MBSPanels22to26";
import MortgageModuleLiveDelivery from "@/components/mortgage/MortgageModuleLiveDelivery";
import {
  MBSRiskCenter,
  FavoriteSignalsSidebar,
} from "@/components/MBSRiskCenter";
import { Star } from "lucide-react";
// ===== 货币市场功能（全部为 live 实现） =====
import { BtmmLive, CdieLive, FibcLive, MmidxLive, TwdiLive } from "@/components/live/MMLive2";
import { MMNewsResearchLive, PBOCLive, PGMLive } from "@/components/live/MMLive";
import { IrsLive, YcqLive } from "@/components/live/RatesFxLive";
import { EqBCMP } from "@/components/live/EqFlowLive2";
import { EDSFLive, EFSFLive } from "@/components/live/CreditXLive2";
import { GovtLive } from "@/components/live/EmsxLive";
import { CenbLive } from "@/components/live/EconLive";
import { IntegrationMonitorLive } from "@/components/live/PortOpsLive";
// ===== 行业分组分析22个功能面板 =====
import {
  IGBLAWPanel,
  IGBTAXPanel,
  IGBGOVPanel,
  IGINDGPanel,
  IGCLPanel,
  IGBCYPanel,
  IGDCKMPanel,
  IGBBLSPanel,
  IGBLSSPanel,
  IGBLDAPanel,
  IGBIP_LITIGATIONPanel,
} from "@/components/ig/IGPanels1to11";
import {
  IGTOP_LAWPanel,
  IGHELPPanel,
  IGPRACPanel,
  IGBILLPanel,
  IGSPENPanel,
  IGBGSPanel,
  IGBI_BUDGPanel,
  IGBIP_GOVTPanel,
  IGNH_BGVPanel,
  IGGNRPanel,
  IGMAP_VOTEPanel,
} from "@/components/ig/IGPanels12to22";
import IndustryGroupPreservedModule from "@/components/ig/IndustryGroupPreservedModule";
import {
  INDUSTRY_GROUP_CAPABILITIES,
  PREFERRED_STOCK_CAPABILITIES,
  STOCK_CAPABILITIES,
} from "@shared/threeModuleCapabilityCatalog";
// ===== 优先股深度面板 =====
import {
  PFSECFPanel,
  PFPSCHPanel,
  PFWBPanel,
  PFWEIPanel,
  PFFITPanel,
  PFQFMPanel,
} from "@/components/pf/PFPanels1";
import {
  PFEDSPanel,
  PFCMAPanel,
  PFPORPanel,
  PFAIDEPanel,
  PFVIZPanel,
  PFPORDPanel,
  PFRPAPanel,
  PFAIDPanel,
} from "@/components/pf/PFPanels2";
import {
  PFDATPanel,
  PFMDLPanel,
  PFAPPPanel,
  PFINFPanel,
  PFPRCPanel,
  PFCRDPanel,
  PFLIQPanel,
  PFCASEPanel,
  PFSOPPanel,
} from "@/components/pf/PFPanels3";
import PreferredStockPreservedModule from "@/components/preferredstock/PreferredStockPreservedModule";
import StockMarketPreservedModule from "@/components/stock/StockMarketPreservedModule";
import { EconomicFieldSourceBoundary } from "@/components/econ/EconomicDataHubPreservedRoute";
// ===== 股市二级功能新增面板 =====
import TOPPanel from "@/components/TOPPanel";
import TRENPanel from "@/components/TRENPanel";
import EQBTPanel from "@/components/EQBTPanel";
import DSPanel from "@/components/DSPanel";
import BIPanel from "@/components/BIPanel";
import RESPanel from "@/components/RESPanel";
import TLTSPanel from "@/components/TLTSPanel";
import PORTPanel from "@/components/PORTPanel";
import FSRCPanel from "@/components/FSRCPanel";
import StockNCEOCockpitPanel from "@/components/StockNCEOCockpitPanel";
import StockCategoryDeepWorkspace from "@/components/stock/StockCategoryDeepWorkspace";
import {
  canonicalizeTerminalModule,
  getCanonicalPathForTerminalItem,
  resolveTerminalRoute,
} from "@/config/terminalFeatureRegistry";

function SovereignCurrentMarketWindow() {
  return (
    <MarketDataPanel
      title="主权债当前市场"
      data={[]}
      referenceState="legacy-unverified"
      feedPath="/terminal?open=3&module=sovereign-bonds"
    />
  );
}

/**
 * 顶层资产入口的唯一工作台。这里不再创建一个没有数据契约的
 * MarketDataPanel；点击模块后直接进入已有页面自己的实时数据层。
 */
const CANONICAL_MODULE_PATHS: Record<string, string> = {
  "sovereign-bonds": "/bond-market",
  stocks: "/equity-market",
  commodities: "/commodity-market",
  indices: "/terminal?module=stocks&open=wei",
  forex: "/forex-hub",
  "news-research": "/news-hub?tab=top",
  economics: "/econ-hub?tab=ecst",
  "credit-bonds": "/credit-analysis",
  "money-market": "/market",
  "preferred-stock": "/equity-market",
};

// 主权债子面板使用单一工作区。连续点选不同功能时卸载上一个面板，
// 避免多个全高面板叠在一起造成内容残留、滚动失控和浏览器崩溃。
const SOVEREIGN_CHILD_WINDOW_IDS = new Set([
  "sovereign-current-market",
  "secinfo-panel",
  "secf-panel",
  "global-bond-market",
  "fit-panel",
  "btmm-panel",
  "gcds-panel",
  "mipr-panel",
  "debt-panel",
  "srsk-panel",
  "gmm-panel",
  "ycurve-panel",
  "gc-panel",
  "ct10-panel",
  "des-panel",
  "yas-panel",
  "topbon-panel",
  "calc-panel",
  "pricing-panel",
  "imgr-panel",
  "runz-panel",
  "issuance-panel",
  "inflation-panel",
  "wbmv-panel",
  "sovm-panel",
  "govi-panel",
  "grm-panel",
  "hs-panel",
  "govy-panel",
  "wbi-panel",
  "ilb-panel",
  "ifmo-panel",
  "gcpi-panel",
  "sovereign-search-panel",
  "tflo-panel",
  "wcdm-panel",
  "dmmv-panel",
  "ussw-panel",
  "bcmp-panel",
  "irs-monitor-panel",
  "expert-monitor-panel",
  "country-monitor-panel",
  "wetf-panel",
  "wbf-panel",
  "wir-panel",
  "ficm-panel",
  "cdx-panel",
  "wcds-panel",
  "sovr-panel",
  "giy-panel",
  "ecst-panel",
  "fom-current-panel",
  "credit-current-panel",
]);
const SOVEREIGN_ITEM_WINDOW_IDS: Record<string, string> = {
  "1": "secinfo-panel",
  "2": "secf-panel",
  "3": "sovereign-current-market",
  "4": "global-bond-market",
  "5": "fit-panel",
  "6": "btmm-panel",
  "7": "gcds-panel",
  "8": "coun-panel",
  "9": "mipr-panel",
  "10": "debt-panel",
  "11": "srsk-panel",
  "12": "gmm-panel",
  "13": "ycurve-panel",
  "14": "gc-panel",
  "15": "ct10-panel",
  "16": "des-panel",
  "17": "yas-panel",
  "18": "topbon-panel",
  "19": "calc-panel",
  "20": "pricing-panel",
  "21": "imgr-panel",
  "22": "runz-panel",
  "23": "issuance-panel",
  "24": "inflation-panel",
  wbmv: "wbmv-panel",
  "cm-3": "wbmv-panel",
  sovm: "sovm-panel",
  "cm-5": "sovm-panel",
  govi: "govi-panel",
  grm: "grm-panel",
  hs: "hs-panel",
  govy: "govy-panel",
  "cm-govy": "govy-panel",
  wbi: "wbi-panel",
  "cm-wbi": "wbi-panel",
  ilb: "ilb-panel",
  "cm-ilb": "ilb-panel",
  ifmo: "ifmo-panel",
  "cm-ifmo": "ifmo-panel",
  gcpi: "gcpi-panel",
  "cm-gcpi": "gcpi-panel",
  search: "sovereign-search-panel",
  "cm-0": "sovereign-search-panel",
  tflo: "tflo-panel",
  "cm-13": "tflo-panel",
  wcdm: "wcdm-panel",
  "cm-18": "wcdm-panel",
  dmmv: "dmmv-panel",
  "cm-19": "dmmv-panel",
  ussw: "ussw-panel",
  "cm-22": "ussw-panel",
  bcmp: "bcmp-panel",
  "cm-23": "bcmp-panel",
  irs: "irs-monitor-panel",
  "cm-21": "irs-monitor-panel",
  expert: "expert-monitor-panel",
  "cm-24": "expert-monitor-panel",
  country: "country-monitor-panel",
  "cm-27": "country-monitor-panel",
  wetf: "wetf-panel",
  "cm-26": "wetf-panel",
  wbf: "wbf-panel",
  "cm-8": "wbf-panel",
  wir: "wir-panel",
  "cm-9": "wir-panel",
  ficm: "ficm-panel",
  "cm-11": "ficm-panel",
  "fom-current": "fom-current-panel",
  "cm-7": "fom-current-panel",
  "credit-current": "credit-current-panel",
  "cm-10": "credit-current-panel",
  cdx: "cdx-panel",
  "cm-14": "cdx-panel",
  wcds: "wcds-panel",
  "cm-15": "wcds-panel",
  sovr: "sovr-panel",
  "cm-16": "sovr-panel",
  giy: "giy-panel",
  ecst: "ecst-panel",
};
function isSovereignChildWindow(id: string) {
  return (
    SOVEREIGN_CHILD_WINDOW_IDS.has(id) ||
    id.startsWith("coun-") ||
    id.startsWith("sovereign-bonds-")
  );
}

export default function Terminal() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const isMobile = useIsMobile();
  const [activeModule, setActiveModule] = useState("markets");
  const [windows, setWindows] = useState<WindowConfig[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [favSidebarOpen, setFavSidebarOpen] = useState(false);
  const [portfolioInitialTab, setPortfolioInitialTab] = useState<
    string | undefined
  >(undefined);

  useEffect(() => {
    setSidebarOpen(!isMobile);
    if (isMobile) setFavSidebarOpen(false);
  }, [isMobile]);

  // 深链：支持 /terminal?open=<itemId> 自动打开默认主权债面板；module 可直达信用债、抵押债或货币市场功能码。
  useEffect(() => {
    const params = new URLSearchParams(search);
    const open = params.get("open");
    if (open) {
      // 技术分析是终端已有功能面板，不属于某个侧边栏模块的占位项。
      // 深链必须直接复用现有面板，避免落入通用静态 DynamicFunctionPanel。
      // 价格预警同样是终端已有工具面板（面板内铃铛按钮的去处）。
      if (open === "technical-analysis" || open === "price-alert") {
        const timer = window.setTimeout(
          () => handleModuleSelect(open),
          50
        );
        return () => window.clearTimeout(timer);
      }
      const requestedModule = params.get("module");
      const resolvedRoute = resolveTerminalRoute(requestedModule, open);
      const routeFromAlias = getCanonicalPathForTerminalItem(
        requestedModule ?? "",
        open
      );
      if (
        routeFromAlias &&
        (requestedModule === "news" ||
          requestedModule === "news-research" ||
          requestedModule === "news-hub" ||
          requestedModule === "economics" ||
          requestedModule === "econ-hub" ||
          requestedModule === "macro")
      ) {
        setLocation(routeFromAlias);
        return;
      }
      const resolvedModule = canonicalizeTerminalModule(
        resolvedRoute.moduleId
      );
      const moduleId =
        resolvedModule === "credit-bonds" ||
        resolvedModule === "mortgage-bonds" ||
        resolvedModule === "money-market" ||
        resolvedModule === "local-bonds" ||
        resolvedModule === "preferred-stock" ||
        resolvedModule === "stocks" ||
        resolvedModule === "industry-group" ||
        resolvedModule === "derivatives" ||
        resolvedModule === "commodities" ||
        resolvedModule === "forex" ||
        resolvedModule === "indices" ||
        resolvedModule === "economics" ||
        resolvedModule === "portfolio-management"
          ? resolvedModule
          : "sovereign-bonds";
      const timer = window.setTimeout(
        () => handleSubItemSelect(moduleId, open, ""),
        50
      );
      return () => window.clearTimeout(timer);
    }
    const requestedModule = params.get("module");
    const canonicalModulePath = requestedModule
      ? CANONICAL_MODULE_PATHS[requestedModule]
      : undefined;
    if (canonicalModulePath) {
      setLocation(canonicalModulePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, search]);

  // Handle module selection
  const handleModuleSelect = (moduleId: string) => {
    setActiveModule(moduleId);

    // 顶部模块切换必须先卸载当前活动窗口，避免旧子页继续留在 DOM 中。
    // 入口仍全部保留；每次只显示当前模块的一份内容。
    setWindows([]);

    const canonicalPath = CANONICAL_MODULE_PATHS[moduleId];
    if (canonicalPath) {
      // 资产主入口统一进入已经存在的真实工作台。不要再在 Terminal
      // 内创建一张 data=[] 的替身面板。
      setLocation(canonicalPath);
      return;
    }

    let newWindow: WindowConfig | null = null;

    switch (moduleId) {
      case "credit-bonds":
        // 已由 CANONICAL_MODULE_PATHS 统一进入信用分析工作台。
        break;
      case "mortgage-bonds":
        newWindow = {
          id: moduleId,
          title: "抵押债 — 风险预警中心",
          content: (
            <MBSRiskCenter
              onModuleOpen={moduleId => {
                const mbsClose2 = (id: string) => () =>
                  setWindows(w => w.filter(x => x.id !== id));
                const qmap: Record<
                  string,
                  { title: string; component: React.ReactNode }
                > = {
                  "1": {
                    title: "证券与功能说明",
                    component: <MBSSecInfoPanel onClose={mbsClose2("mb-q1")} />,
                  },
                  "2": {
                    title: "SECF 证券查找",
                    component: <MBSSECFPanel onClose={mbsClose2("mb-q2")} />,
                  },
                  "3": {
                    title: "MTGS 抵押债检索",
                    component: <MBSMTGSPanel onClose={mbsClose2("mb-q3")} />,
                  },
                  "4": {
                    title: "MTGH 功能说明",
                    component: <MBSMTGHPanel onClose={mbsClose2("mb-q4")} />,
                  },
                  "5": {
                    title: "新发行及发售",
                    component: (
                      <MBSNewIssuesPanel onClose={mbsClose2("mb-q5")} />
                    ),
                  },
                  "6": {
                    title: "MCAL 结构金融日历",
                    component: <MBSMCALPanel onClose={mbsClose2("mb-q6")} />,
                  },
                  "7": {
                    title: "IMGR 库存与价格",
                    component: <MBSIMGRPanel onClose={mbsClose2("mb-q7")} />,
                  },
                  "8": {
                    title: "STSH 结构化工具",
                    component: <MBSSTSHPanel onClose={mbsClose2("mb-q8")} />,
                  },
                  "9": {
                    title: "当前市场",
                    component: (
                      <MBSCurrentMarketPanel onClose={mbsClose2("mb-q9")} />
                    ),
                  },
                  "10": {
                    title: "TBPF TBA表现",
                    component: <MBSTBPFPanel onClose={mbsClose2("mb-q10")} />,
                  },
                  "11": {
                    title: "评级趋势",
                    component: (
                      <MBSRatingTrendPanel onClose={mbsClose2("mb-q11")} />
                    ),
                  },
                  "12": {
                    title: "BMMI 市场洞察",
                    component: <MBSBMMIPanel onClose={mbsClose2("mb-q12")} />,
                  },
                  "13": {
                    title: "新闻与研究报告",
                    component: (
                      <MBSNewsResearchPanel onClose={mbsClose2("mb-q13")} />
                    ),
                  },
                  "14": {
                    title: "FIRS 率先报道",
                    component: <MBSFIRSPanel onClose={mbsClose2("mb-q14")} />,
                  },
                  "15": {
                    title: "NI 结构融资管道",
                    component: <MBSNIPanel onClose={mbsClose2("mb-q15")} />,
                  },
                  "16": {
                    title: "GN 455993 分析",
                    component: (
                      <MBSGNAnalysisPanel onClose={mbsClose2("mb-q16")} />
                    ),
                  },
                  "17": {
                    title: "DES 证券简介",
                    component: <MBSDESPanel onClose={mbsClose2("mb-q17")} />,
                  },
                  "18": {
                    title: "YT 收益率表",
                    component: <MBSYTPanel onClose={mbsClose2("mb-q18")} />,
                  },
                  "19": {
                    title: "FIBC 债券计算器",
                    component: <MBSFIBCPanel onClose={mbsClose2("mb-q19")} />,
                  },
                  "20": {
                    title: "Q 市场报价",
                    component: <MBSQPanel onClose={mbsClose2("mb-q20")} />,
                  },
                  "21": {
                    title: "CMAP CMBS地图",
                    component: <MBSCMAPPanel onClose={mbsClose2("mb-q21")} />,
                  },
                  "22": {
                    title: "抵押债指数",
                    component: <MBSIndexPanel onClose={mbsClose2("mb-q22")} />,
                  },
                  "23": {
                    title: "TBPF MCCN 实时监测",
                    component: (
                      <MBSTBPFMCCNPanel onClose={mbsClose2("mb-q23")} />
                    ),
                  },
                  "24": {
                    title: "资产类别对比",
                    component: (
                      <MBSAssetClassPanel onClose={mbsClose2("mb-q24")} />
                    ),
                  },
                  "25": {
                    title: "美国民用及商用",
                    component: (
                      <MBSRMBSvsCMBSPanel onClose={mbsClose2("mb-q25")} />
                    ),
                  },
                  "26": {
                    title: "成交量与表现",
                    component: (
                      <MBSVolumePerformancePanel
                        onClose={mbsClose2("mb-q26")}
                      />
                    ),
                  },
                };
                const panel = qmap[moduleId];
                if (panel) {
                  const winId = `mb-q${moduleId}`;
                  // 抵押债子页采用单一活动窗口，切换入口时卸载上一页，避免
                  // 风险中心与子页、或两个子页同时挂载造成重复数据与错误联动。
                  setWindows([
                    {
                      id: winId,
                      title: panel.title,
                      content: (
                        <MortgageModuleLiveDelivery open={moduleId}>
                          {panel.component}
                        </MortgageModuleLiveDelivery>
                      ),
                    },
                  ]);
                }
              }}
            />
          ),
        };
        break;
      case "money-market":
        // 已由 CANONICAL_MODULE_PATHS 统一进入市场数据工作台。
        break;
      case "local-bonds":
        newWindow = {
          id: moduleId,
          title: "\u5730\u65b9\u503a",
          content: (
            <MunicipalPreservedModule
              moduleId="MBIX"
              original={<MBIXPanel />}
            />
          ),
        };
        break;
      case "CDRN":
        newWindow = {
          id: moduleId,
          title: "\u5546\u8bae\u627f\u9500\u65e5\u7a0b",
          content: (
            <MunicipalPreservedModule
              moduleId="CDRN"
              original={<CDRNPanel />}
            />
          ),
        };
        break;
      case "CDRC":
        newWindow = {
          id: moduleId,
          title: "\u7ade\u4ef7\u627f\u9500\u65e5\u7a0b",
          content: (
            <MunicipalPreservedModule
              moduleId="CDRC"
              original={<CDRCPanel />}
            />
          ),
        };
        break;
      case "CDRA":
        newWindow = {
          id: moduleId,
          title: "\u5730\u65b9\u503a\u56fa\u5b9a\u5229\u7387\u65e5\u5386",
          content: (
            <MunicipalPreservedModule
              moduleId="CDRA"
              original={<CDRAPanel />}
            />
          ),
        };
        break;
      case "CNDS":
        newWindow = {
          id: moduleId,
          title: "\u77ed\u671f\u65e5\u7a0b",
          content: (
            <MunicipalPreservedModule
              moduleId="CNDS"
              original={<CNDSPanel />}
            />
          ),
        };
        break;
      case "CDRV":
        newWindow = {
          id: moduleId,
          title: "\u5730\u65b9\u503a\u53ef\u53d8\u5229\u7387\u65e5\u5386",
          content: (
            <MunicipalPreservedModule
              moduleId="CDRV"
              original={<CDRVPanel />}
            />
          ),
        };
        break;
      case "DEAL":
        newWindow = {
          id: moduleId,
          title: "\u4ea4\u6613\u7ba1\u7406",
          content: (
            <MunicipalPreservedModule
              moduleId="DEAL"
              original={<DEALPanel />}
            />
          ),
        };
        break;
      case "MCAL":
        newWindow = {
          id: moduleId,
          title: "\u7ed3\u6784\u91d1\u878d\u65e5\u5386",
          content: (
            <MunicipalPreservedModule
              moduleId="MCAL"
              original={<MCALPanel />}
            />
          ),
        };
        break;
      case "MSRC":
        newWindow = {
          id: moduleId,
          title: "\u5730\u65b9\u503a\u68c0\u7d22",
          content: (
            <MunicipalPreservedModule
              moduleId="MSRC"
              original={<MSRCPanel />}
            />
          ),
        };
        break;
      case "SMUN":
        newWindow = {
          id: moduleId,
          title: "\u5730\u65b9\u503a\u53d1\u884c\u4eba\u68c0\u7d22",
          content: (
            <MunicipalPreservedModule
              moduleId="SMUN"
              original={<SMUNPanel />}
            />
          ),
        };
        break;
      case "MBIX":
        newWindow = {
          id: moduleId,
          title: "\u6700\u65b0\u5730\u65b9\u503a\u6307\u6570",
          content: (
            <MunicipalPreservedModule
              moduleId="MBIX"
              original={<MBIXPanel />}
            />
          ),
        };
        break;
      case "VRDN":
        newWindow = {
          id: moduleId,
          title: "\u5f6d\u535a7\u5929VRDN",
          content: (
            <MunicipalPreservedModule
              moduleId="VRDN"
              original={<VRDNPanel />}
            />
          ),
        };
        break;
      case "BMA":
        newWindow = {
          id: moduleId,
          title: "BMA\u5730\u65b9\u503a\u6389\u671f\u6307\u6570",
          content: (
            <MunicipalPreservedModule moduleId="BMA" original={<BMAPanel />} />
          ),
        };
        break;
      case "MSRB":
        newWindow = {
          id: moduleId,
          title: "MSRB\u7edf\u8ba1\u6570\u636e",
          content: (
            <MunicipalPreservedModule
              moduleId="MSRB"
              original={<MSRBPanel />}
            />
          ),
        };
        break;
      case "SLGS":
        newWindow = {
          id: moduleId,
          title: "SLGS\u56fd\u503a\u548c\u5e02\u653f\u503a\u5229\u7387",
          content: (
            <MunicipalPreservedModule
              moduleId="SLGS"
              original={<SLGSPanel />}
            />
          ),
        };
        break;
      case "preferred-stock":
        // 已由 CANONICAL_MODULE_PATHS 统一进入权益工作台。
        break;
      case "messaging-community":
        newWindow = {
          id: moduleId,
          title: "通讯与社区",
          content: (
            <CommsPreservedModule moduleId="COMMS-TERMINAL">
              <MessagingPanel title="通讯与社区" channel="general" />
            </CommsPreservedModule>
          ),
        };
        break;
      case "news-research":
        newWindow = {
          id: moduleId,
          title: "新闻与研究报告",
          content: (
            <NewsPreservedModule moduleId="NEWS-TERMINAL">
              <NewsPanel title="新闻与研究报告" />
            </NewsPreservedModule>
          ),
        };
        break;
      case "economics":
        newWindow = {
          id: moduleId,
          title: "经济数据及分析",
          content: (
            <EconomicFieldSourceBoundary>
              <EconomicDashboard title="经济数据及分析" />
            </EconomicFieldSourceBoundary>
          ),
        };
        break;
      case "portfolio-management":
        newWindow = {
          id: moduleId,
          title: "投资组合管理与风险",
          content: (
            <PortfolioRiskPreservedModule moduleId="PORTFOLIO-TERMINAL">
              <PortfolioManagementPanel initialTab={portfolioInitialTab} />
            </PortfolioRiskPreservedModule>
          ),
        };
        break;
      case "order-book":
        newWindow = {
          id: moduleId,
          title: "交易委托簿",
          content: <OrderBookPanel title="交易委托簿" />,
        };
        break;
      case "trading":
        newWindow = {
          id: moduleId,
          title: "电子交易",
          content: <TradingPanel title="电子交易界面" />,
        };
        break;
      case "pricing":
        newWindow = {
          id: moduleId,
          title: "定价与风险",
          content: <PricingRiskPanel title="定价与风险分析" />,
        };
        break;
      case "stp":
        newWindow = {
          id: moduleId,
          title: "STP",
          content: <STPPanel title="STP 直通处理" />,
        };
        break;
      case "trade-book":
        newWindow = {
          id: moduleId,
          title: "交易账簿",
          content: <TradeBookPanel title="交易账簿管理" />,
        };
        break;
      case "settings":
        newWindow = {
          id: moduleId,
          title: "设置",
          content: <SettingsPanel title="系统设定" />,
        };
        break;
      case "market-news":
        newWindow = {
          id: moduleId,
          title: "财经新闻",
          content: <MarketNewsPanel title="财经新闻" />,
        };
        break;
      case "economic-calendar":
        newWindow = {
          id: moduleId,
          title: "经济日历",
          content: <EconomicCalendarPanel title="经济日历" />,
        };
        break;
      case "market-sentiment":
        newWindow = {
          id: moduleId,
          title: "市场情绪",
          content: <MarketSentimentPanel title="市场情绪指标" />,
        };
        break;
      case "investment-notes":
        newWindow = {
          id: moduleId,
          title: "投资笔记",
          content: <InvestmentNotesPanel title="投资笔记" />,
        };
        break;
      case "backtest-engine":
        newWindow = {
          id: moduleId,
          title: "量化回测",
          content: <BacktestEnginePanel title="量化回测" />,
        };
        break;
      case "price-alert":
        newWindow = {
          id: moduleId,
          title: "价格预警",
          content: <PriceAlertPanel title="价格预警" />,
        };
        break;
      case "stock-screener":
        newWindow = {
          id: moduleId,
          title: "选股筛选器",
          content: <StockScreenerPanel title="选股筛选器" />,
        };
        break;
      case "portfolio-analysis":
        newWindow = {
          id: moduleId,
          title: "投资组合分析",
          content: <PortfolioAnalysisPanel title="投资组合分析" />,
        };
        break;
      case "watchlist":
        newWindow = {
          id: moduleId,
          title: "自选品种",
          content: <WatchlistPanel title="自选品种" />,
        };
        break;
      case "technical-analysis":
        newWindow = {
          id: moduleId,
          title: "技术指标分析",
          content: <TechnicalAnalysisPanel title="技术指标分析" />,
        };
        break;
      case "shortcuts":
      case "docs":
      case "about":
      case "bquant":
      case "flexible-screen":
      case "data-export":
      case "mobile":
        const titleMap: Record<string, string> = {
          shortcuts: "快捷键参考",
          docs: "文档中心",
          about: "关于 Finance Hub",
          bquant: "UQuant 量化工具",
          "flexible-screen": "灵活屏",
          "data-export": "数据导出",
          mobile: "移动版",
        };
        newWindow = {
          id: moduleId,
          title: titleMap[moduleId] || moduleId.replace(/-/g, " "),
          content: (
            <QuickToolsPanel
              title={titleMap[moduleId] || moduleId.replace(/-/g, " ")}
            />
          ),
        };
        break;
      default:
        // 未注册模块不创建标题占位页。没有真实组件和数据契约时，
        // 入口应保持未发布状态，而不是制造一个看起来可用的空面板。
        return;
    }

    if (newWindow) {
      // 模块切换后的窗口列表以当前模块为唯一来源；不要使用旧闭包
      // windows 重新拼接，否则已卸载的子页会再次挂回 DOM。
      setWindows([newWindow]);
    }
  };

  const handleSubItemSelect = (
    moduleId: string,
    itemId: string,
    itemName: string
  ) => {
    // 先处理跨目录的 canonical 入口，避免后面的历史分发器再
    // 创建一份重复面板。只有注册过真实页面/数据契约的项才会返回路径。
    // WEI 是股票模块中原有的完整工作台；它的 canonical URL 本身就是
    // 当前 Terminal 深链。若把它当作“需要再次跳转”的入口，会先清空
    // windows，再把 location 设置为同一个地址，最终只剩基础行情页，
    // 看起来就像 WEI 数据被删除。让它继续走原有 stockPanelMap。
    const isWeiWorkbench = moduleId === "stocks" && itemId.toLowerCase() === "wei";
    const canonicalPath = isWeiWorkbench
      ? undefined
      : getCanonicalPathForTerminalItem(moduleId, itemId);
    if (canonicalPath) {
      setWindows([]);
      setLocation(canonicalPath);
      return;
    }

    if (moduleId === "portfolio-management") {
      const tabId =
        PORTFOLIO_CODE_TO_TAB[itemId] ??
        PORTFOLIO_CODE_TO_TAB[itemId.toUpperCase()] ??
        "prtu";
      const winId = "portfolio-management";
      setPortfolioInitialTab(tabId);
      setActiveModule("portfolio-management");
      setWindows(prev => [
        ...prev.filter(window => window.id !== winId),
        {
          id: winId,
          title: "投资组合管理与风险",
          content: (
            <PortfolioRiskPreservedModule moduleId={`PORTFOLIO-${tabId}`}>
              <PortfolioManagementPanel initialTab={tabId} />
            </PortfolioRiskPreservedModule>
          ),
        },
      ]);
      return;
    }
    if (moduleId === "sovereign-bonds") {
      const targetId = SOVEREIGN_ITEM_WINDOW_IDS[itemId];
      // 点击当前已打开的面板只激活现有内容；否则跨模块旧窗口必须全部卸载。
      // 旧信用债/抵押债窗口不属于主权子窗口集合，不能只按前缀过滤。
      if (targetId && windows.some(window => window.id === targetId)) {
        return;
      }
      setWindows([]);
    }
    // 主权债 - 通用面板打开器（itemId 1/15-24 新模块）
    const openSov = (
      winId: string,
      title: string,
      node: (close: () => void) => React.ReactElement
    ) => {
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev.filter(window => !isSovereignChildWindow(window.id)),
        {
          id: winId,
          title,
          content: node(() => setWindows(w => w.filter(x => x.id !== winId))),
        },
      ]);
    };
    // 主权债 - 当前市场（itemId='3'）：复用已订阅的债券实时行情，不创建静态副本。
    if (moduleId === "sovereign-bonds" && itemId === "3") {
      const winId = "sovereign-current-market";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "主权债当前市场",
          content: <SovereignCurrentMarketWindow />,
        },
      ]);
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "1") {
      openSov("secinfo-panel", "证券、设定与功能说明", c => (
        <SecInfoPanel onClose={c} />
      ));
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "15") {
      openSov("ct10-panel", "分析 CT10 Govt", c => <CT10Panel onClose={c} />);
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "16") {
      openSov("des-panel", "DES 证券简介", c => <DESPanel onClose={c} />);
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "17") {
      openSov("yas-panel", "YAS 收益率与利差分析", c => (
        <YASPanel onClose={c} />
      ));
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "18") {
      openSov("topbon-panel", "TOP BON 债券新闻", c => (
        <TopBonPanel onClose={c} />
      ));
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "19") {
      openSov("calc-panel", "计算器与分析", c => <CalcPanel onClose={c} />);
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "20") {
      openSov("pricing-panel", "定价", c => <PricingPanel onClose={c} />);
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "21") {
      openSov("imgr-panel", "IMGR 库存与价格", c => <IMGRPanel onClose={c} />);
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "22") {
      openSov("runz-panel", "RUNZ Runs管理", c => <RUNZPanel onClose={c} />);
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "23") {
      openSov("issuance-panel", "新发行、公司大事、评级", c => (
        <IssuancePanel onClose={c} />
      ));
      return;
    }
    if (moduleId === "sovereign-bonds" && itemId === "24") {
      openSov("inflation-panel", "IR与通胀衍生产品及SN", c => (
        <InflationPanel onClose={c} />
      ));
      return;
    }
    // 主权债 - 固定收益交易 (itemId='5', ticker=FIT)
    if (moduleId === "sovereign-bonds" && itemId === "5") {
      const winId = "fit-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "FIT 固定收益交易",
          content: (
            <FITPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 国债与货币市场 (itemId='6', ticker=BTMM)
    if (moduleId === "sovereign-bonds" && itemId === "6") {
      const winId = "btmm-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "BTMM 国债与货币市场",
          content: (
            <BTMMPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 全球债券市场 (itemId='4', ticker=WB)
    if (moduleId === "sovereign-bonds" && itemId === "4") {
      const winId = "global-bond-market";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "WB 全球债券市场",
          content: (
            <div className="w-full h-full overflow-auto">
              <BondMarketDataPage />
            </div>
          ),
        },
      ]);
      return;
    }
    // 主权债 - 国家指南 (itemId='8', ticker=COUN)
    if (moduleId === "sovereign-bonds" && itemId === "8") {
      const winId = "coun-panel";
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "COUN 国家指南",
          content: (
            <COUNPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 市场隐含政策利率 (itemId='9', ticker=MIPR)
    if (moduleId === "sovereign-bonds" && itemId === "9") {
      const winId = "mipr-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "MIPR 市场隐含政策利率",
          content: (
            <MIPRPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 全局CDS图表 (itemId='7', ticker=GCDS)
    if (moduleId === "sovereign-bonds" && itemId === "7") {
      const winId = "gcds-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "GCDS 全球CDS图表",
          content: (
            <GCDSPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 证券查找 (itemId='2', ticker=SECF)
    if (moduleId === "sovereign-bonds" && itemId === "2") {
      const winId = "secf-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "SECF 证券查找",
          content: (
            <SovereignSearchPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
              onOpenPanel={(code, name) =>
                handleSubItemSelect("sovereign-bonds", code, name)
              }
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 全球宏观市场驱动者 (itemId='12', ticker=GMM)
    if (moduleId === "sovereign-bonds" && itemId === "12") {
      const winId = "gmm-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "GMM 全球宏观市场驱动者",
          content: (
            <GMMPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 主权债信用风险 (itemId='11', ticker=SRSK)
    if (moduleId === "sovereign-bonds" && itemId === "11") {
      const winId = "srsk-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "SRSK 主权债信用风险",
          content: (
            <SRSKPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 收益曲线 (itemId='13', 子菜单)
    if (moduleId === "sovereign-bonds" && itemId === "13") {
      const winId = "ycurve-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "收益曲线",
          content: (
            <YCURVEPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - GC 绘制曲线图 (itemId='14', ticker=GC)
    if (moduleId === "sovereign-bonds" && itemId === "14") {
      const winId = "gc-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "GC 绘制曲线图",
          content: (
            <GCPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
              onBack={() => {
                setWindows(w => w.filter(x => x.id !== winId));
                const ycurveId = "ycurve-panel";
                if (!windows.find(w => w.id === ycurveId)) {
                  setWindows(prev2 => [
                    ...prev2,
                    {
                      id: ycurveId,
                      title: "收益曲线",
                      content: (
                        <YCURVEPanel
                          onClose={() =>
                            setWindows(w => w.filter(x => x.id !== ycurveId))
                          }
                        />
                      ),
                    },
                  ]);
                }
              }}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 主权债所有权 (itemId='10', ticker=DEBT)
    if (moduleId === "sovereign-bonds" && itemId === "10") {
      const winId = "debt-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "DEBT 主权债所有权",
          content: (
            <DEBTPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - WBMV 全球债券驱动者
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "wbmv" || itemId === "cm-3")
    ) {
      const winId = "wbmv-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "WBMV 全球债券驱动者",
          content: (
            <WBMVPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - SOVM 主权债行情显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "sovm" || itemId === "cm-5")
    ) {
      const winId = "sovm-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "SOVM 主权债行情显示",
          content: (
            <SOVMPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - GOVI 国债市场间利差矩阵
    if (moduleId === "sovereign-bonds" && itemId === "govi") {
      const winId = "govi-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "GOVI 国债市场间利差矩阵",
          content: (
            <GOVIPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - GRM 全球利率行情显示
    if (moduleId === "sovereign-bonds" && itemId === "grm") {
      const winId = "grm-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "GRM 全球利率行情显示",
          content: (
            <div className="w-full h-full overflow-auto">
              <WbmvLive />
            </div>
          ),
        },
      ]);
      return;
    }
    // 主权债 - HS 历史价差分析
    if (moduleId === "sovereign-bonds" && itemId === "hs") {
      const winId = "hs-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "HS 历史价差分析",
          content: (
            <HSPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - GOVY 利率交易员
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "govy" || itemId === "cm-govy")
    ) {
      const winId = "govy-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "GOVY 利率交易员",
          content: (
            <GOVYPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - WBI 全球通胀债券
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "wbi" || itemId === "cm-wbi")
    ) {
      const winId = "wbi-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "WBI 全球通胀债券",
          content: (
            <WBIPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - ILB 通胀挂钩债券
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "ilb" || itemId === "cm-ilb")
    ) {
      const winId = "ilb-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "ILB 通胀挂钩债券",
          content: (
            <ILBPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - IFMO 通胀行情显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "ifmo" || itemId === "cm-ifmo")
    ) {
      const winId = "ifmo-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "IFMO 通胀行情显示",
          content: (
            <IFMOPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - GCPI 通胀指数显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "gcpi" || itemId === "cm-gcpi")
    ) {
      const winId = "gcpi-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "GCPI 通胀指数显示",
          content: (
            <GCPIPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - TFLO TRACE市场行情
    // 主权债 - 全局搜索
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "search" || itemId === "cm-0")
    ) {
      const winId = "sovereign-search-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "SOVS 主权债全局搜索",
          content: (
            <SovereignMarketSearchPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
              onOpenPanel={(code, name) => {
                handleSubItemSelect("sovereign-bonds", code, name);
              }}
            />
          ),
        },
      ]);
      return;
    }
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "tflo" || itemId === "cm-13")
    ) {
      const winId = "tflo-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "TFLO TRACE市场行情",
          content: (
            <TFLOPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - WCDM 全球各国债务行情显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "wcdm" || itemId === "cm-18")
    ) {
      const winId = "wcdm-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "WCDM 全球各国债务行情显示",
          content: (
            <WCDMPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - DMMV 发达国家市场行情表
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "dmmv" || itemId === "cm-19")
    ) {
      const winId = "dmmv-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "DMMV 发达国家市场行情表",
          content: (
            <DMMVPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - USSW 掉期市场
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "ussw" || itemId === "cm-22")
    ) {
      const winId = "ussw-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "USSW 掉期市场",
          content: (
            <USSWPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - BCMP 彭博资本市场
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "bcmp" || itemId === "cm-23")
    ) {
      const winId = "bcmp-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "BCMP 佑诚资本市场",
          content: (
            <BCMPPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 利率掉期行情显示 (cm-21)
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "irs" || itemId === "cm-21")
    ) {
      const winId = "irs-monitor-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "IRS 利率掉期行情显示",
          content: (
            <IRSMonitorPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 专家行情显示 (cm-24)
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "expert" || itemId === "cm-24")
    ) {
      const winId = "expert-monitor-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "专家行情显示",
          content: (
            <ExpertMonitorPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - 特定国家行情显示 (cm-27)
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "country" || itemId === "cm-27")
    ) {
      const winId = "country-monitor-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "特定国家行情显示",
          content: (
            <CountryMonitorPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - WETF 固定收益ETF行情显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "wetf" || itemId === "cm-26")
    ) {
      const winId = "wetf-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "WETF 固定收益ETF行情显示",
          content: (
            <WETFPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - WBF 全球债券期货
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "fom-current" || itemId === "cm-7")
    ) {
      const winId = "fom-current-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "期货与期权行情显示",
          content: (
            <div className="h-full overflow-auto">
              <FuturesOptionsMonitor />
            </div>
          ),
        },
      ]);
      return;
    }
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "wbf" || itemId === "cm-8")
    ) {
      const winId = "wbf-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "WBF 全球债券期货",
          content: (
            <WBFPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - WIR 全球利率期货
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "wir" || itemId === "cm-9")
    ) {
      const winId = "wir-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "WIR 全球利率期货",
          content: (
            <WIRPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - FICM 固定收益信用行情显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "credit-current" || itemId === "cm-10")
    ) {
      const winId = "credit-current-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "信用行情显示",
          content: (
            <div className="h-full overflow-auto">
              <CreditMonitorAdvanced />
            </div>
          ),
        },
      ]);
      return;
    }
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "ficm" || itemId === "cm-11")
    ) {
      const winId = "ficm-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "FICM 固定收益信用行情显示",
          content: (
            <FICMPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - CDX CDS指数行情显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "cdx" || itemId === "cm-14")
    ) {
      const winId = "cdx-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "CDX CDS指数行情显示",
          content: (
            <CDXPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - WCDS 全球CDS行情显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "wcds" || itemId === "cm-15")
    ) {
      const winId = "wcds-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "WCDS 全球CDS行情显示",
          content: (
            <WCDSPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - SOVR 主权债CDS行情显示
    if (
      moduleId === "sovereign-bonds" &&
      (itemId === "sovr" || itemId === "cm-16")
    ) {
      const winId = "sovr-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "SOVR 主权债CDS行情显示",
          content: (
            <SOVRPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - GIY 日内收益率图
    if (moduleId === "sovereign-bonds" && itemId === "giy") {
      const winId = "giy-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "GIY 日内收益率图",
          content: (
            <GIYPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // 主权债 - ECST 经济指数简介
    if (moduleId === "sovereign-bonds" && itemId === "ecst") {
      const winId = "ecst-panel";
      if (windows.find(w => w.id === winId)) return;
      setWindows(prev => [
        ...prev,
        {
          id: winId,
          title: "ECST 经济指数简介",
          content: (
            <ECSTPanel
              onClose={() => setWindows(w => w.filter(x => x.id !== winId))}
            />
          ),
        },
      ]);
      return;
    }
    // ===== 外汇模块 =====
    if (moduleId === "forex") {
      const panelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        fxc: {
          title: "FXC 汇率矩阵",
          component: (
            <ForexPreservedModule moduleId="FXC">
              <FXCPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        wcr: {
          title: "WCR 全球汇率",
          component: (
            <ForexPreservedModule moduleId="WCR">
              <WCRPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        wvol: {
          title: "WVOL 外汇隐含波动率矩阵",
          component: (
            <ForexPreservedModule moduleId="WVOL">
              <WVOLPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        xccy: {
          title: "XCCY 交叉货币基点差",
          component: (
            <ForexPreservedModule moduleId="XCCY">
              <XCCYPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        fxsw: {
          title: "FXSW 外汇策略工作台",
          component: (
            <ForexPreservedModule moduleId="FXSW">
              <FXSWPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        fxfc: {
          title: "FXFC 外汇预测",
          component: (
            <ForexPreservedModule moduleId="FXFC">
              <FXFCPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        wcrs: {
          title: "WCRS 全球货币排行榜",
          component: (
            <ForexPreservedModule moduleId="WCRS">
              <WCRSPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        fxcorr: {
          title: "FXCORR 外汇相关系数矩阵",
          component: (
            <ForexPreservedModule moduleId="FXCORR">
              <FXCORRPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        fxiv: {
          title: "FXIV 外汇波动率比较",
          component: (
            <ForexPreservedModule moduleId="FXIV">
              <FXIVPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        gmm: {
          title: "GMM 全球宏观市场驱动者",
          component: (
            <ForexPreservedModule moduleId="GMM">
              <GMMPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        fxip: {
          title: "FXIP 外汇信息门户",
          component: (
            <ForexPreservedModule moduleId="FXIP">
              <>
                <FXIPPanel
                  onClose={() =>
                    setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                  }
                />
              </>
            </ForexPreservedModule>
          ),
        },
        firs: {
          title: "FIRS 率先报道-外汇",
          component: (
            <ForexPreservedModule moduleId="FIRS">
              <FIRSPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        fxds: {
          title: "FXDS 外汇数据检索",
          component: (
            <ForexPreservedModule moduleId="FXDS">
              <FXDSPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        fxtf: {
          title: "FXTF 外汇代码查找",
          component: (
            <ForexPreservedModule moduleId="FXTF">
              <FXTFPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        xdsh: {
          title: "XDSH 外汇控制面板",
          component: (
            <ForexPreservedModule moduleId="XDSH">
              <XDSHPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        ecmi: {
          title: "ECMI 市场冲击行情显示",
          component: (
            <ForexPreservedModule moduleId="ECMI">
              <ECMIPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        allq: {
          title: "ALLQ 全部报价",
          component: (
            <ForexPreservedModule moduleId="ALLQ">
              <ALLQPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        frd: {
          title: "FRD 外汇远期计算器",
          component: (
            <ForexPreservedModule moduleId="FRD">
              <FRDPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        bfix: {
          title: "BFIX 佑诚外汇定价",
          component: (
            <ForexPreservedModule moduleId="BFIX">
              <BFIXPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        fxfa: {
          title: "FXFA 外汇利率套利",
          component: (
            <ForexPreservedModule moduleId="FXFA">
              <FXFAPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        stni: {
          title: "STNI 建议新闻传输",
          component: (
            <ForexPreservedModule moduleId="STNI">
              <STNIPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        myq: {
          title: "MYQ My Quotes",
          component: (
            <ForexPreservedModule moduleId="MYQ">
              <MyqLive />
            </ForexPreservedModule>
          ),
        },
        ovml: {
          title: "OVML 外汇/商品期权定价",
          component: (
            <ForexPreservedModule moduleId="OVML">
              <OVMLPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        topfx: {
          title: "TOP FX 要闻报道",
          component: (
            <ForexPreservedModule moduleId="TOP_FX">
              <TopFxLive />
            </ForexPreservedModule>
          ),
        },
        res: {
          title: "RES 研究报告主页",
          component: (
            <ForexPreservedModule moduleId="RES">
              <RESPanel
                onClose={() =>
                  setWindows(w => w.filter(x => x.id !== `forex-${itemId}`))
                }
              />
            </ForexPreservedModule>
          ),
        },
        bico: {
          title: "BICO 佑诚行业研究概况",
          component: (
            <ForexPreservedModule moduleId="BICO">
              <BicoLive />
            </ForexPreservedModule>
          ),
        },
        marsfx: {
          title: "MARS FX 外汇",
          component: (
            <ForexPreservedModule moduleId="MARS_FX">
              <MarsFxLive />
            </ForexPreservedModule>
          ),
        },
      };
      const normalizedItemId = itemId.toLowerCase();
      const panel = panelMap[normalizedItemId];
      if (panel) {
        const winId = `forex-${normalizedItemId}`;
        if (windows.find(w => w.id === winId)) return;
        setWindows(prev => [
          ...prev,
          { id: winId, title: panel.title, content: panel.component },
        ]);
        return;
      }
    }

    // ===== 货币市场模块 =====
    if (moduleId === "money-market") {
      const cmmClose = (id: string) => () =>
        setWindows(w => w.filter(x => x.id !== `mm-${id}`));
      const mmPanelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        // 功能1: DES 证券与功能说明
        "des-mm": {
          title: "1 DES 证券与功能说明",
          component: <DesBondLive />,
        },
        // 功能2: PGM 货币市场项目列表
        pgm: {
          title: "2 PGM 货币市场项目列表",
          component: <PGMLive />,
        },
        // 功能3: 当前市场心跳
        mktbeat: {
          title: "3 MKTBEAT 当前市场",
          component: <BtmmLive code="MKTBEAT" />,
        },
        // 功能4: BTMM 国债与货币市场
        btmm: {
          title: "4 BTMM 国债与货币市场",
          component: <BtmmLive />,
        },
        // 功能5: BOOM 货币市场发售
        boom: {
          title: "5 BOOM 货币市场发售",
          component: <PGMLive />,
        },
        // 功能6: TCON 国债控制面板
        tcon: {
          title: "6 TCON 国债控制面板",
          component: <BtmmLive code="TCON" />,
        },
        // 功能7: RV 相对价值套利引擎
        rv: {
          title: "7 RV 相对价值套利引擎",
          component: <IrsLive />,
        },
        // 功能8: 收益率曲线量子模拟
        ycqsim: {
          title: "8 YCQSIM 收益曲线量子模拟",
          component: <YcqLive />,
        },
        // 功能9: GC 绘制曲线图
        gc: {
          title: "9 GC 绘制曲线图",
          component: <GCPanel onClose={cmmClose("gc")} />,
        },
        // 功能10: CRVF MMKT 查找曲线-货币市场
        "crvf-mmkt": {
          title: "10 CRVF MMKT 查找曲线-货币市场",
          component: <EqBCMP />,
        },
        // 功能11: CRVF 查找曲线
        crvf: {
          title: "11 CRVF 查找曲线",
          component: <EqBCMP />,
        },
        // 功能12: FIBC 债券计算器
        fibc: {
          title: "12 FIBC 债券计算器",
          component: <FibcLive />,
        },
        // 功能13: CDIE 预测CDI对实际DI期货
        cdie: {
          title: "13 CDIE 预测CDI对实际DI期货",
          component: <CdieLive />,
        },
        // 功能14: EFSF 分析EMTN M-Mkt
        efsf: {
          title: "14 EFSF 分析EMTN M-Mkt",
          component: <EFSFLive />,
        },
        // 功能15: 货币市场指数
        mmidx: {
          title: "15 MMIDX 货币市场指数",
          component: <MmidxLive />,
        },
        // 功能16: 定价、写单、电子交易
        etrade: {
          title: "16 ETRADE 定价、写单、电子交易",
          component: <GovtLive />,
        },
        // 功能17: EDSF ED合成FRA
        edsf: {
          title: "17 EDSF ED合成FRA",
          component: <EDSFLive />,
        },
        // 功能18: WBF 全球债券期货
        wbf: {
          title: "18 WBF 全球债券期货",
          component: <WbfLive />,
        },
        // 功能19: PBOC 中国人民銀行
        pboc: {
          title: "19 PBOC 中国人民銀行",
          component: <PBOCLive />,
        },
        // 功能20: TWDI 台北拆款利率
        twdi: {
          title: "20 TWDI 台北金融业拆款定盘利率",
          component: <TwdiLive />,
        },
        // 功能21: CENB 央行查找
        cenb: {
          title: "21 CENB 央行查找",
          component: <CenbLive />,
        },
        // 功能22: 新闻与研究报告
        "news-mm": {
          title: "22 NEWS 新闻与研究报告",
          component: <MMNewsResearchLive />,
        },
        // 功能23: 公开资料时效监控
        "source-mm": {
          title: "23 SOURCE 公开资料时效监控台",
          component: <IntegrationMonitorLive />,
        },
        // 功能24: 货币市场研究交付
        mmflow: {
          title: "24 MMFLOW 货币市场研究交付",
          component: <MMNewsResearchLive />,
        },
      };
      const mmPanel = mmPanelMap[itemId];
      if (mmPanel) {
        const winId = `mm-${itemId}`;
        if (windows.find(w => w.id === winId)) return;
        // 货币市场原入口采用单工作区替换：切换子功能时卸载上一入口，
        // 避免同一模块的多个旧 DOM 继续保留并造成重复数据或交互串线。
        setWindows(prev => [
          ...prev.filter(window => !window.id.startsWith("mm-")),
          { id: winId, title: mmPanel.title, content: mmPanel.component },
        ]);
        return;
      }
    }

    // ===== 信用债模块 =====
    if (moduleId === "credit-bonds") {
      const cw = (id: string) => () =>
        setWindows(w => w.filter(x => x.id !== `cr-${id}`));
      const creditPanelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        // 数字 ID 1-26（CreditBondMenu 传递的 itemId）
        "1": {
          title: "1 证券与功能说明",
          component: <SECDESCPanel onClose={cw("1")} />,
        },
        "2": {
          title: "2 当前市场总览",
          component: <CreditCoreSpecialistPanels moduleId="2" />,
        },
        "3": {
          title: "3 全球债券市场",
          component: <GLBBONDPanel onClose={cw("3")} />,
        },
        "4": {
          title: "4 国债与货币市场",
          component: <BTMMPanel onClose={cw("4")} />,
        },
        "5": {
          title: "5 全球CDS图表",
          component: <GCDSEnhancedPanel onClose={cw("5")} />,
        },
        "6": {
          title: "6 收益曲线分析",
          component: <YCURVEEnhancedPanel onClose={cw("6")} />,
        },
        "7": {
          title: "7 绘制曲线图",
          component: <GCEnhancedPanel onClose={cw("7")} />,
        },
        "8": {
          title: "8 新闻/研究报告",
          component: <NEWSRPTPanel onClose={cw("8")} />,
        },
        "9": {
          title: "9 计算器与分析",
          component: <CalcPanel onClose={cw("9")} />,
        },
        "10": {
          title: "10 信债浏览器",
          component: <CreditCoreSpecialistPanels moduleId="10" />,
        },
        "11": {
          title: "11 全球债券指数",
          component: <WBIXPanel onClose={cw("11")} />,
        },
        "12": {
          title: "12 指数检索",
          component: <INSPanel onClose={cw("12")} />,
        },
        "13": {
          title: "13 分析 IBM 7 10/30/25 Corp",
          component: <CreditIssuerAndAnalyticsPanels moduleId="13" />,
        },
        "14": {
          title: "14 证券简介 DES",
          component: <DESPanel onClose={cw("14")} />,
        },
        "15": {
          title: "15 收益率与利差分析 YAS",
          component: <YASPanel onClose={cw("15")} />,
        },
        "16": {
          title: "16 定价",
          component: <PRICINGEnhancedPanel onClose={cw("16")} />,
        },
        "17": {
          title: "17 库存与价格 IMGR",
          component: <IMGREnhancedPanel onClose={cw("17")} />,
        },
        "18": {
          title: "18 Runs管理 RUNZ",
          component: <RUNZEnhancedPanel onClose={cw("18")} />,
        },
        "19": {
          title: "19 TACT TRACE 活动",
          component: <CreditPostTradeDeliveryPanels moduleId="19" />,
        },
        "20": {
          title: "20 新发行/公司大事/评级",
          component: <CreditPostTradeDeliveryPanels moduleId="20" />,
        },
        "21": {
          title: "21 信用衍生产品",
          component: <CDERIVPanel onClose={cw("21")} />,
        },
        "22": {
          title: "22 信用分析",
          component: <CREDANALPanel onClose={cw("22")} />,
        },
        "23": {
          title: "23 固定收益工作表",
          component: <FIWSPanel onClose={cw("23")} />,
        },
        "24": {
          title: "24 信用研究分析 CRAN",
          component: <CRANPanel onClose={cw("24")} />,
        },
        "25": {
          title: "25 贷款",
          component: <LOANSPanel onClose={cw("25")} />,
        },
        "26": {
          title: "26 BMS保险系统 CRMX",
          component: <CRMXPanel onClose={cw("26")} />,
        },
        // 旧 ticker 映射（兼容其他模块可能调用）
        ficm: {
          title: "FICM 固定收益信用行情显示",
          component: <FICMPanel onClose={cw("ficm")} />,
        },
        cdx: {
          title: "CDX CDS指数行情显示",
          component: <CDXPanel onClose={cw("cdx")} />,
        },
        wcds: {
          title: "WCDS 全球CDS行情显示",
          component: <WCDSPanel onClose={cw("wcds")} />,
        },
        crpr: {
          title: "CRPR 信用价差",
          component: <CRPRPanel onClose={cw("crpr")} />,
        },
        ratc: {
          title: "RATC 评级变动追踪",
          component: <RATCPanel onClose={cw("ratc")} />,
        },
        byfc: {
          title: "BYFC 债券收益率预测",
          component: <BYFCPanel onClose={cw("byfc")} />,
        },
        bclo: {
          title: "BCLO CLO市场概览",
          component: <BCLOPanel onClose={cw("bclo")} />,
        },
        firs: {
          title: "FIRS 率先报道",
          component: <FIRSPanel onClose={cw("firs")} />,
        },
      };
      const creditPanel = creditPanelMap[itemId];
      if (creditPanel) {
        const winId = `cr-${itemId}`;
        if (windows.length === 1 && windows[0]?.id === winId) return;
        // 每个信用债入口只装配一次原有功能面板。
        // 统一研究/字段登记层曾在此处再次追加，造成同一模块出现两套标题、空状态和数据说明。
        // 深度内容应归属于对应原面板，不能通过额外工作台重复叠加。
        // 信用债工作流采用单一活动窗口：切换原入口时卸载前一功能，避免
        // 多个原模块在同一 DOM 中持续堆叠、重复取数并最终拖垮终端。
        // 这里只改变当前工作区状态，不删除任何菜单入口或组件。
        setWindows([
          {
            id: winId,
            title: creditPanel.title,
            content: (
              <CreditModuleLiveDelivery open={itemId}>
                <div className="h-full overflow-auto p-2">
                  {creditPanel.component}
                </div>
              </CreditModuleLiveDelivery>
            ),
          },
        ]);
        return;
      }
    }

    // ===== 优先股专用子菜单路由 =====
    if (moduleId === "preferred-stock") {
      // 菜单传入的 itemId 带 pf- 前缀（如 pf-qfm），路由 map 键不带前缀，需先剥离
      const normalizedItemId = itemId.startsWith("pf-")
        ? itemId.slice(3)
        : itemId;
      const prefPanelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        secf: {
          title: "SECF 智能证券查找器",
          component: (
            <PreferredStockPreservedModule
              moduleId="secf"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFSECFPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        dat: {
          title: "PFDQ 报价与时效",
          component: (
            <PreferredStockPreservedModule
              moduleId="dat"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFDATPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        inf: {
          title: "PFDB 买卖盘口",
          component: (
            <PreferredStockPreservedModule
              moduleId="inf"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFINFPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        fit: {
          title: "FIT 智能固定收益交易",
          component: (
            <PreferredStockPreservedModule
              moduleId="fit"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFFITPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        psch: {
          title: "PSCH 深度检索与条款解析",
          component: (
            <PreferredStockPreservedModule
              moduleId="psch"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFPSCHPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        wb: {
          title: "DIVR 票面股息率",
          component: (
            <PreferredStockPreservedModule
              moduleId="wb"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFWBPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        eds: {
          title: "DIVH 股息支付记录",
          component: (
            <PreferredStockPreservedModule
              moduleId="eds"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFEDSPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        app: {
          title: "CUM 累积与非累积",
          component: (
            <PreferredStockPreservedModule
              moduleId="app"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFAPPPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        sop: {
          title: "PART 参与与非参与",
          component: (
            <PreferredStockPreservedModule
              moduleId="sop"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFSOPPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        case: {
          title: "CONV 可转换条款",
          component: (
            <PreferredStockPreservedModule
              moduleId="case"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFCASEPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        pord: {
          title: "CALL 可赎回条款",
          component: (
            <PreferredStockPreservedModule
              moduleId="pord"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFPORDPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        aid: {
          title: "PUT 回售条款",
          component: (
            <PreferredStockPreservedModule
              moduleId="aid"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFAIDPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        cma: {
          title: "CV 转股价值",
          component: (
            <PreferredStockPreservedModule
              moduleId="cma"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFCMAPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        viz: {
          title: "CP 转换溢价",
          component: (
            <PreferredStockPreservedModule
              moduleId="viz"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFVIZPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        prc: {
          title: "YTM 到期收益分析",
          component: (
            <PreferredStockPreservedModule
              moduleId="prc"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFPRCPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        qfm: {
          title: "CY 当前收益率",
          component: (
            <PreferredStockPreservedModule
              moduleId="qfm"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFQFMPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        mdl: {
          title: "RATE 利率敏感性",
          component: (
            <PreferredStockPreservedModule
              moduleId="mdl"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFMDLPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        crd: {
          title: "RTG 信用评级",
          component: (
            <PreferredStockPreservedModule
              moduleId="crd"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFCRDPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        wei: {
          title: "ISSCR 发行人信用",
          component: (
            <PreferredStockPreservedModule
              moduleId="wei"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFWEIPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        rpa: {
          title: "SNR 偿付顺序",
          component: (
            <PreferredStockPreservedModule
              moduleId="rpa"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFRPAPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        liq: {
          title: "LIQ 流动性分析",
          component: (
            <PreferredStockPreservedModule
              moduleId="liq"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFLIQPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        por: {
          title: "COMP 同类证券比较",
          component: (
            <PreferredStockPreservedModule
              moduleId="por"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFPORPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
        aide: {
          title: "RISK 风险与情景分析",
          component: (
            <PreferredStockPreservedModule
              moduleId="aide"
              onNavigate={targetId =>
                handleSubItemSelect("preferred-stock", targetId, "")
              }
              original={
                <PFAIDEPanel
                  onClose={() =>
                    setWindows(w =>
                      w.filter(x => x.id !== `pf-${normalizedItemId}`)
                    )
                  }
                />
              }
            />
          ),
        },
      };
      const prefPanel = prefPanelMap[normalizedItemId];
      if (prefPanel) {
        const winId = `pf-${normalizedItemId}`;
        if (windows.find(w => w.id === winId)) return;
        const capability = PREFERRED_STOCK_CAPABILITIES.find(
          item => item.id === normalizedItemId
        );
        setWindows([
          {
            id: winId,
            title: capability
              ? `${capability.code} ${capability.name}`
              : prefPanel.title,
            content: prefPanel.component,
          },
        ]);
        return;
      }
      // The preferred-stock namespace is closed: an unknown or retired ID
      // must not fall through to stock routes or the generic placeholder.
      return;
    }

    // ===== 股票模块 =====
    if (moduleId === "stocks") {
      const preserveStock = (
        stockModuleId: string,
        original: React.ReactNode
      ) => (
        <StockMarketPreservedModule
          moduleId={stockModuleId}
          onNavigate={targetId => handleSubItemSelect("stocks", targetId, "")}
          original={original}
        />
      );
      const stockPanelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        "8": {
          title: "TOPD Top-Down 分析",
          component: preserveStock(
            "8",
            <StockCategoryDeepWorkspace initialId="8" />
          ),
        },
        "15": {
          title: "PORT-R 投资组合管理与风险",
          component: preserveStock(
            "15",
            <StockCategoryDeepWorkspace initialId="15" />
          ),
        },
        "18": {
          title: "EQA 单一股票分析",
          component: preserveStock(
            "18",
            <StockCategoryDeepWorkspace initialId="18" />
          ),
        },
        "19": {
          title: "EQD 股票衍生品",
          component: preserveStock(
            "19",
            <StockCategoryDeepWorkspace initialId="19" />
          ),
        },
        "21": {
          title: "FUND 基金",
          component: preserveStock(
            "21",
            <FundBrowse />
          ),
        },
        "25": {
          title: "EQTR 股票交易",
          component: preserveStock(
            "25",
            <StockCategoryDeepWorkspace initialId="25" />
          ),
        },
        "27": {
          title: "ECM 资本市场活动",
          component: preserveStock(
            "27",
            <StockCategoryDeepWorkspace initialId="27" />
          ),
        },
        "31": {
          title: "CLNT 客户管理解决方案",
          component: preserveStock(
            "31",
            <StockCategoryDeepWorkspace initialId="31" />
          ),
        },
        "32": {
          title: "因子研究与量化策略",
          component: preserveStock(
            "32",
            <StockCategoryDeepWorkspace initialId="32" />
          ),
        },
        wei: {
          // 保留原始功能 ID 契约：'wei': { title: 'WEI 全球股票指数' }
          title: "WEI 全球股票指数",
          component: preserveStock(
            "wei",
            <WEIPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        imap: {
          title: "IMAP 日内市场图",
          component: preserveStock(
            "imap",
            <IMAPPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        eqs: {
          title: "EQS 股票筛选",
          component: preserveStock(
            "eqs",
            <EQSPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        etf: {
          title: "ETF 交易型开放式指数基金",
          component: preserveStock(
            "etf",
            <ETFPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        gf: {
          title: "GF 基本面图表",
          component: preserveStock(
            "gf",
            <GFPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        gipo: {
          title: "GIPO 日内价格图",
          component: preserveStock(
            "gipo",
            <GIPOPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        corr: {
          title: "CORR 我的相关系数矩阵",
          component: preserveStock(
            "corr",
            <CORRPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        ftw: {
          title: "FTW 关注因子",
          component: preserveStock(
            "ftw",
            <FTWPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        evts: {
          title: "EVTS 大事日历",
          component: preserveStock(
            "evts",
            <EVTSPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        most: {
          title: "MOST 最活跃证券",
          component: preserveStock(
            "most",
            <MOSTPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        anr: {
          title: "ANR 分析师建议",
          component: preserveStock(
            "anr",
            <ANRPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        rv: {
          title: "RV 相对价值",
          component: preserveStock(
            "rv",
            <RVPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        ddis: {
          title: "DDIS 股息分配",
          component: preserveStock(
            "ddis",
            <DDISPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        omon: {
          title: "OMON 期权行情",
          component: preserveStock(
            "omon",
            <OMONPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        pe: {
          title: "PE 私募股权概览",
          component: preserveStock(
            "pe",
            <PEPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        emsx: {
          title: "EMSX 执行管理系统",
          component: preserveStock(
            "emsx",
            <EMSXPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        cact: {
          title: "CACT 公司大事检索",
          component: preserveStock(
            "cact",
            <CACTPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        ma: {
          title: "MA 兼并与收购",
          component: preserveStock(
            "ma",
            <MAPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        ipo: {
          title: "IPO 股票发行",
          component: preserveStock(
            "ipo",
            <IPOPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        weif: {
          title: "WEIF 全球股指期货",
          component: preserveStock(
            "weif",
            <WEIFPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        rrg: {
          title: "RRG 相对旋转图",
          component: preserveStock(
            "rrg",
            <RRGPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        top: {
          title: "TOP 要闻精选",
          component: preserveStock(
            "top",
            <TOPPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        tren: {
          title: "TREN 新闻趋势",
          component: preserveStock(
            "tren",
            <TRENPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        eqbt: {
          title: "EQBT 股票回溯测试",
          component: preserveStock(
            "eqbt",
            <EQBTPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        ds: {
          title: "DS 文件检索",
          component: preserveStock(
            "ds",
            <DSPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        "bi-stox": {
          title: "BI STOX 行业研究",
          component: preserveStock(
            "bi-stox",
            <BIPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        res: {
          title: "RES 研究报告主页",
          component: preserveStock(
            "res",
            <RESPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        tlts: {
          title: "TLTS 风险暴露倾向",
          component: preserveStock(
            "tlts",
            <TLTSPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        port: {
          title: "PORT 投资组合与风险分析",
          component: preserveStock(
            "port",
            <PORTPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        fsrc: {
          title: "FSRC 基金筛选",
          component: preserveStock(
            "fsrc",
            <FSRCPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        cockpit: {
          title: "股票智能驾驶舱",
          component: preserveStock(
            "cockpit",
            <StockNCEOCockpitPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
              onOpenNceo={symbol => {
                const nceoWindowId = `dv-nceo-${symbol}`;
                setWindows(current =>
                  current.some(window => window.id === nceoWindowId)
                    ? current
                    : [
                        ...current,
                        {
                          id: nceoWindowId,
                          title: `NCEO 诺诚增强期权 · ${symbol}`,
                          content: (
                            <NCEOPanel
                              initialSymbol={symbol}
                              onClose={() =>
                                setWindows(items =>
                                  items.filter(item => item.id !== nceoWindowId)
                                )
                              }
                            />
                          ),
                        },
                      ]
                );
              }}
            />
          ),
        },
        in: {
          title: "IN 指数浏览器",
          component: preserveStock(
            "in",
            <INPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        moso: {
          title: "MOSO 交易最活跃期权",
          component: preserveStock(
            "moso",
            <MOSOPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
        factorlab: {
          title: "FACTOR LAB 全球因子研究实验室",
          component: preserveStock(
            "factorlab",
            <FactorLabPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `st-${itemId}`))
              }
            />
          ),
        },
      };
      const stockPanel = stockPanelMap[itemId];
      if (stockPanel) {
        const winId = `st-${itemId}`;
        if (windows.length === 1 && windows[0]?.id === winId) return;
        const capability = STOCK_CAPABILITIES.find(item => item.id === itemId);
        setWindows([
          {
            id: winId,
            title: capability
              ? [capability.code, capability.name].filter(Boolean).join(" ")
              : stockPanel.title,
            content: stockPanel.component,
          },
        ]);
        return;
      }
    }

    // ===== 经济分析模块 子面板 =====
    if (moduleId === "economics") {
      const econPanelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        taylr: {
          title: "TAYLR 泰勒规则货币政策模型",
          component: (
            <TAYLRPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        ecsu: {
          title: "ECSU 经济意外情显示",
          component: (
            <ECSUPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        fomc: {
          title: "FOMC 美联储公开市场委员会",
          component: (
            <FOECPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        pmi: {
          title: "PMI 标普全球PMI",
          component: (
            <PMIPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        wirp: {
          title: "WIRP 利率概率",
          component: (
            <WIRPPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        ectr: {
          title: "ECTR 贸易流量",
          component: (
            <ECTRPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        wfii: {
          title: "WFII 外国投资组合投资",
          component: (
            <WFIIPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        rsan: {
          title: "RSAN 地缘政治风险分析",
          component: (
            <RSANPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        ecfc: {
          title: "ECFC 经济预测",
          component: (
            <ECFCPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        fcon: {
          title: "FCON 财务状况指数",
          component: (
            <FCONPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        ecan: {
          title: "ECAN 世界经济分析",
          component: (
            <ECANPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        cenb: {
          title: "CENB 央行查找",
          component: (
            <CENBPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
        cbrt: {
          title: "CBRT 央行利率分析",
          component: (
            <CBRTPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `eco-${itemId}`))
              }
            />
          ),
        },
      };
      const econPanel = econPanelMap[itemId];
      if (econPanel) {
        const winId = `eco-${itemId}`;
        if (windows.find(w => w.id === winId)) return;
        setWindows(prev => [
          ...prev,
          {
            id: winId,
            title: econPanel.title,
            content: (
              <EconomicFieldSourceBoundary
                path={`/terminal?module=economics&open=${encodeURIComponent(itemId)}`}
              >
                {econPanel.component}
              </EconomicFieldSourceBoundary>
            ),
          },
        ]);
        return;
      }
    }

    // ===== 衍生品模块 =====
    if (moduleId === "derivatives") {
      const preserveDerivatives = (
        derivativeModuleId:
          | "ov"
          | "oils"
          | "fom"
          | "wbf-ai"
          | "credit-monitor"
          | "cdsw"
          | "vca"
          | "mars"
          | "ovcv"
          | "dlib"
          | "moso"
          | "ovml",
        original: React.ReactNode
      ) => (
        <DerivativesPreservedModule moduleId={derivativeModuleId}>
          {original}
        </DerivativesPreservedModule>
      );
      const derivPanelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        ov: {
          title: "OV 期权损益分析",
          component: preserveDerivatives(
            "ov",
            <OVPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        oils: {
          title: "OILS 石油冲击",
          component: preserveDerivatives(
            "oils",
            <OILSPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        fom: {
          title: "FOM 期货与期权行情监控",
          component: preserveDerivatives("fom", <FuturesOptionsMonitor />),
        },
        "wbf-ai": {
          title: "WBF AI 全球债券期货增强",
          component: preserveDerivatives("wbf-ai", <WbfLive />),
        },
        "credit-monitor": {
          title: "信用监控综合面板",
          component: preserveDerivatives(
            "credit-monitor",
            <CreditMonitorAdvanced />
          ),
        },
        cdsw: {
          title: "CDSW CDS估值",
          component: preserveDerivatives(
            "cdsw",
            <CDSWPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        vca: {
          title: "VCA 波动率与相关系数分析",
          component: preserveDerivatives(
            "vca",
            <VCAPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        mars: {
          title: "MARS 多资产风险系统",
          component: preserveDerivatives(
            "mars",
            <MARSPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        ovcv: {
          title: "OVCV 可转换债券估价",
          component: preserveDerivatives(
            "ovcv",
            <OVCVPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        dlib: {
          title: "DLIB 衍生品库",
          component: preserveDerivatives(
            "dlib",
            <DLIBPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        moso: {
          title: "MOSO 交易最活跃期权",
          component: preserveDerivatives(
            "moso",
            <MOSOPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        nceo: {
          title: "佑诚期权 · NCEO 诺诚增强期权",
          component: (
            <NCEOPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
        ovml: {
          title: "OVML 外汇/商品期权定价",
          component: preserveDerivatives(
            "ovml",
            <OVMLPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `dv-${itemId}`))
              }
            />
          ),
        },
      };
      const derivPanel = derivPanelMap[itemId];
      if (derivPanel) {
        const winId = `dv-${itemId}`;
        if (windows.find(w => w.id === winId)) return;
        setWindows(prev => [
          ...prev,
          { id: winId, title: derivPanel.title, content: derivPanel.component },
        ]);
        return;
      }
    }

    // ===== 大宗商品模块 =====
    if (moduleId === "commodities") {
      const preserveCommodity = (
        commodityModuleId: string,
        original: React.ReactNode
      ) => (
        <CommodityPreservedModule moduleId={commodityModuleId}>
          {original}
        </CommodityPreservedModule>
      );
      const commPanelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        cftc: {
          title: "CFTC 全球期货持仓周报",
          component: <CftcCommodityPanel />,
        },
        oils: {
          title: "OILS 石油冲击",
          component: preserveCommodity(
            "oils",
            <OILSPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `cm-${itemId}`))
              }
            />
          ),
        },
        ctm: {
          title: "CTM 交易所合约",
          component: preserveCommodity(
            "ctm",
            <CTMPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `cm-${itemId}`))
              }
            />
          ),
        },
        seag: {
          title: "SEAG 季节性图",
          component: preserveCommodity(
            "seag",
            <SEAGPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `cm-${itemId}`))
              }
            />
          ),
        },
        ccrv: {
          title: "CCRV 商品曲线",
          component: preserveCommodity(
            "ccrv",
            <CCRVPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `cm-${itemId}`))
              }
            />
          ),
        },
        map: {
          title: "MAP 自设地图",
          component: preserveCommodity(
            "map",
            <MAPPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `cm-${itemId}`))
              }
            />
          ),
        },
        cply: {
          title: "CPLY 商品操作簿",
          component: preserveCommodity(
            "cply",
            <CPLYPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `cm-${itemId}`))
              }
            />
          ),
        },
        cosy: {
          title: "COSY 商品分析",
          component: preserveCommodity(
            "cosy",
            <COSYPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `cm-${itemId}`))
              }
            />
          ),
        },
        gp: {
          title: "GP 线段图",
          component: preserveCommodity(
            "gp",
            <GPPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `cm-${itemId}`))
              }
            />
          ),
        },
      };
      const commPanel = commPanelMap[itemId];
      if (commPanel) {
        const winId = `cm-${itemId}`;
        if (windows.find(w => w.id === winId)) return;
        setWindows(prev => [
          ...prev,
          { id: winId, title: commPanel.title, content: commPanel.component },
        ]);
        return;
      }
    }

    // ===== 指数模块 =====
    if (moduleId === "indices") {
      const idxPanelMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        wbix: {
          title: "WBIX 世界债券指数",
          component: (
            <WBIXPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        inp: {
          title: "INP 指数出版物",
          component: (
            <INPPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        cix: {
          title: "CIX 自设指数库",
          component: (
            <CIXPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        cixb: {
          title: "CIXB 自设篮子",
          component: (
            <CIXBPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        cixn: {
          title: "CIXN 表达式指数",
          component: (
            <CIXNPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        cixs: {
          title: "CIXS 利差指数",
          component: (
            <CIXSPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        cixr: {
          title: "CIXR 比率指数",
          component: (
            <CIXRPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        cixc: {
          title: "CIXC 转换指数",
          component: (
            <CIXCPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        cixx: {
          title: "CIXX 本地数据",
          component: (
            <CIXXPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
        cixi: {
          title: "CIXI 时间序列",
          component: (
            <CIXIPanel
              onClose={() =>
                setWindows(w => w.filter(x => x.id !== `idx-${itemId}`))
              }
            />
          ),
        },
      };
      const idxPanel = idxPanelMap[itemId];
      if (idxPanel) {
        const winId = `idx-${itemId}`;
        if (windows.find(w => w.id === winId)) return;
        setWindows(prev => [
          ...prev,
          { id: winId, title: idxPanel.title, content: idxPanel.component },
        ]);
        return;
      }
    }

    // ===== 抵押债模块 26个功能 =====
    if (moduleId === "mortgage-bonds") {
      const mbsClose = (id: string) => () =>
        setWindows(w => w.filter(x => x.id !== id));
      const mbsMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        "1": {
          title: "证券与功能说明",
          component: <MBSSecInfoPanel onClose={mbsClose("mb-1")} />,
        },
        "2": {
          title: "SECF 证券查找",
          component: <MBSSECFPanel onClose={mbsClose("mb-2")} />,
        },
        "3": {
          title: "MTGS 抵押债检索",
          component: <MBSMTGSPanel onClose={mbsClose("mb-3")} />,
        },
        "4": {
          title: "MTGH 功能说明屏幕",
          component: <MBSMTGHPanel onClose={mbsClose("mb-4")} />,
        },
        "5": {
          title: "新发行及发售",
          component: <MBSNewIssuesPanel onClose={mbsClose("mb-5")} />,
        },
        "6": {
          title: "MCAL 结构金融日历",
          component: <MBSMCALPanel onClose={mbsClose("mb-6")} />,
        },
        "7": {
          title: "IMGR 库存与价格",
          component: <MBSIMGRPanel onClose={mbsClose("mb-7")} />,
        },
        "8": {
          title: "STSH 结构化工具",
          component: <MBSSTSHPanel onClose={mbsClose("mb-8")} />,
        },
        "9": {
          title: "当前市场",
          component: <MBSCurrentMarketPanel onClose={mbsClose("mb-9")} />,
        },
        "10": {
          title: "TBPF TBA表现",
          component: <MBSTBPFPanel onClose={mbsClose("mb-10")} />,
        },
        "11": {
          title: "评级趋势",
          component: <MBSRatingTrendPanel onClose={mbsClose("mb-11")} />,
        },
        "12": {
          title: "BMMI 市场洞察",
          component: <MBSBMMIPanel onClose={mbsClose("mb-12")} />,
        },
        "13": {
          title: "新闻与研究报告",
          component: <MBSNewsResearchPanel onClose={mbsClose("mb-13")} />,
        },
        "14": {
          title: "FIRS 佑诚率先报道",
          component: <MBSFIRSPanel onClose={mbsClose("mb-14")} />,
        },
        "15": {
          title: "NI 结构融资管道",
          component: <MBSNIPanel onClose={mbsClose("mb-15")} />,
        },
        "16": {
          title: "GN 455993 分析",
          component: <MBSGNAnalysisPanel onClose={mbsClose("mb-16")} />,
        },
        "17": {
          title: "DES 证券简介",
          component: <MBSDESPanel onClose={mbsClose("mb-17")} />,
        },
        "18": {
          title: "YT 收益率表",
          component: <MBSYTPanel onClose={mbsClose("mb-18")} />,
        },
        "19": {
          title: "FIBC 债券计算器",
          component: <MBSFIBCPanel onClose={mbsClose("mb-19")} />,
        },
        "20": {
          title: "Q 市场报价",
          component: <MBSQPanel onClose={mbsClose("mb-20")} />,
        },
        "21": {
          title: "CMAP CMBS地图",
          component: <MBSCMAPPanel onClose={mbsClose("mb-21")} />,
        },
        "22": {
          title: "抵押债指数",
          component: <MBSIndexPanel onClose={mbsClose("mb-22")} />,
        },
        "23": {
          title: "TBPF MCCN 实时监测",
          component: <MBSTBPFMCCNPanel onClose={mbsClose("mb-23")} />,
        },
        "24": {
          title: "资产类别对比",
          component: <MBSAssetClassPanel onClose={mbsClose("mb-24")} />,
        },
        "25": {
          title: "美国民用及商用",
          component: <MBSRMBSvsCMBSPanel onClose={mbsClose("mb-25")} />,
        },
        "26": {
          title: "成交量与表现",
          component: <MBSVolumePerformancePanel onClose={mbsClose("mb-26")} />,
        },
        // 保留旧映射兼容
        mpay: {
          title: "MPAY 抵押贷款溢价矩阵",
          component: <MPAYPanel onClose={mbsClose(`mb-mpay`)} />,
        },
        firs: {
          title: "FIRS 率先报道",
          component: <FIRSPanel onClose={mbsClose(`mb-firs`)} />,
        },
      };
      const mbsPanel = mbsMap[itemId];
      if (mbsPanel) {
        const winId = `mb-${itemId}`;
        if (windows.length === 1 && windows[0]?.id === winId) return;
        setWindows([
          {
            id: winId,
            title: mbsPanel.title,
            content: (
              <MortgageModuleLiveDelivery open={itemId}>
                {mbsPanel.component}
              </MortgageModuleLiveDelivery>
            ),
          },
        ]);
        return;
      }
    }

    // ===== 行业分组分析 =====
    if (moduleId === "industry-group") {
      const capability = INDUSTRY_GROUP_CAPABILITIES.find(
        item => item.id === itemId
      );
      if (capability) {
        const winId = `ig-${itemId}`;
        if (windows.length === 1 && windows[0]?.id === winId) return;
        const close = () =>
          setWindows(current => current.filter(window => window.id !== winId));
        const originalTools: Record<string, React.ReactNode> = {
          CLASS: <IGBLAWPanel onClose={close} />,
          MEMBERS: <IGBTAXPanel onClose={close} />,
          QUOTES: <IGBGOVPanel onClose={close} />,
          RETURNS: <IGINDGPanel onClose={close} />,
          VOLUME: <IGCLPanel onClose={close} />,
          FLOW: <IGBCYPanel onClose={close} />,
          BREADTH: <IGDCKMPanel onClose={close} />,
          VALUATION: <IGBBLSPanel onClose={close} />,
          EARNINGS: <IGBLSSPanel onClose={close} />,
          FORECAST: <IGBLDAPanel onClose={close} />,
          REVENUE: <IGBIP_LITIGATIONPanel onClose={close} />,
          PROFIT: <IGTOP_LAWPanel onClose={close} />,
          BALANCE: <IGHELPPanel onClose={close} />,
          CASHFLOW: <IGPRACPanel onClose={close} />,
          CAPEX: <IGBILLPanel onClose={close} />,
          DIVIDEND: <IGSPENPanel onClose={close} />,
          VOLATILITY: <IGBGSPanel onClose={close} />,
          CORRELATION: <IGBI_BUDGPanel onClose={close} />,
          ROTATION: <IGBIP_GOVTPanel onClose={close} />,
          CONTRIBUTION: <IGNH_BGVPanel onClose={close} />,
          CYCLE: <IGGNRPanel onClose={close} />,
          STRESS: <IGMAP_VOTEPanel onClose={close} />,
        };
        setWindows([
          {
            id: winId,
            title: `${capability.code} ${capability.name}`,
            content: (
              <IndustryGroupPreservedModule
                moduleId={itemId}
                original={originalTools[itemId]}
              />
            ),
          },
        ]);
        return;
      }
      // Industry-group owns a closed set of 22 capabilities. Retired IDs must
      // not fall through to the generic panel, which would recreate duplicates.
      return;
    }

    // ===== 地方债21个功能子面板 =====
    if (moduleId === "local-bonds") {
      const lbClose = (id: string) => () =>
        setWindows(w => w.filter(x => x.id !== id));
      const retained = (id: string, original: React.ReactNode) => (
        <MunicipalPreservedModule moduleId={id} original={original} />
      );
      const lbMap: Record<
        string,
        { title: string; component: React.ReactNode }
      > = {
        "1": {
          title: "证券与功能说明",
          component: retained(
            "1",
            <MuniSecInfoPanel
              onClose={lbClose("lb-1")}
              onNavigate={targetId => {
                const target = lbMap[targetId];
                if (!target) return;
                const targetWindowId = `lb-${targetId}`;
                setWindows([
                  {
                    id: targetWindowId,
                    title: target.title,
                    content: target.component,
                  },
                ]);
              }}
            />
          ),
        },
        MSRC: {
          title: "MSRC 地方债检索",
          component: retained(
            "MSRC",
            <MSRCPanel onClose={lbClose("lb-MSRC")} />
          ),
        },
        SMUN: {
          title: "SMUN 地方债发行人检索",
          component: retained(
            "SMUN",
            <SMUNPanel onClose={lbClose("lb-SMUN")} />
          ),
        },
        AAA: {
          title: "AAA BVAL地方债AAA曲线",
          component: retained("AAA", <AAAPanel onClose={lbClose("lb-AAA")} />),
        },
        BTMM: {
          title: "BTMM 国债与货币市场",
          component: <BtmmLive onClose={lbClose("lb-BTMM")} />,
        },
        PICK: {
          title: "PICK 地方债发行",
          component: retained(
            "PICK",
            <PICKPanel onClose={lbClose("lb-PICK")} />
          ),
        },
        MBWD: {
          title: "MBWD 地方债买价询价",
          component: retained(
            "MBWD",
            <MBWDPanel onClose={lbClose("lb-MBWD")} />
          ),
        },
        CDRN: {
          title: "CDRN 商议承销日程",
          component: retained(
            "CDRN",
            <CDRNPanel onClose={lbClose("lb-CDRN")} />
          ),
        },
        CDRC: {
          title: "CDRC 竞价承销日程",
          component: retained(
            "CDRC",
            <CDRCPanel onClose={lbClose("lb-CDRC")} />
          ),
        },
        CDRA: {
          title: "CDRA 地方债固定利率日历",
          component: retained(
            "CDRA",
            <CDRAPanel onClose={lbClose("lb-CDRA")} />
          ),
        },
        CNDS: {
          title: "CNDS 短期日程",
          component: retained(
            "CNDS",
            <CNDSPanel onClose={lbClose("lb-CNDS")} />
          ),
        },
        CDRV: {
          title: "CDRV 地方债可变利率日历",
          component: retained(
            "CDRV",
            <CDRVPanel onClose={lbClose("lb-CDRV")} />
          ),
        },
        DEAL: {
          title: "DEAL 交易管理",
          component: retained(
            "DEAL",
            <DEALPanel onClose={lbClose("lb-DEAL")} />
          ),
        },
        CACT: {
          title: "CACT 公司大事检索",
          component: retained(
            "CACT",
            <MunicipalCACTPanel onClose={lbClose("lb-CACT")} />
          ),
        },
        MCAL: {
          title: "MCAL 结构金融日历",
          component: retained(
            "MCAL",
            <MCALPanel onClose={lbClose("lb-MCAL")} />
          ),
        },
        MBIX: {
          title: "MBIX 最新地方债指数",
          component: retained(
            "MBIX",
            <MBIXPanel onClose={lbClose("lb-MBIX")} />
          ),
        },
        VRDN: {
          title: "VRDN 佑诚7天VRDN",
          component: retained(
            "VRDN",
            <VRDNPanel onClose={lbClose("lb-VRDN")} />
          ),
        },
        BMA: {
          title: "BMA 地方债掉期指数",
          component: retained("BMA", <BMAPanel onClose={lbClose("lb-BMA")} />),
        },
        BOOM: {
          title: "BOOM VRDN库存",
          component: retained(
            "BOOM",
            <BOOMPanel onClose={lbClose("lb-BOOM")} />
          ),
        },
        MSRB: {
          title: "MSRB 统计数据",
          component: retained(
            "MSRB",
            <MSRBPanel onClose={lbClose("lb-MSRB")} />
          ),
        },
        SLGS: {
          title: "SLGS 国债和市政债利率",
          component: retained(
            "SLGS",
            <SLGSPanel onClose={lbClose("lb-SLGS")} />
          ),
        },
      };
      const lbPanel = lbMap[itemId];
      if (lbPanel) {
        const winId = `lb-${itemId}`;
        if (windows.find(w => w.id === winId)) return;
        setWindows([
          { id: winId, title: lbPanel.title, content: lbPanel.component },
        ]);
        return;
      }
    }

    // 未注册、没有真实组件或没有数据契约的项目不再生成通用
    // DynamicFunctionPanel。这样不会把“标题存在”误报成“功能已完成”。
    return;
  };

  const handleWindowClose = (id: string) => {
    setWindows(windows.filter(w => w.id !== id));
  };

  const handleWindowMinimize = (id: string) => {
    setWindows(
      windows.map(w => (w.id === id ? { ...w, minimized: !w.minimized } : w))
    );
  };

  const handleWindowMaximize = (id: string) => {
    setWindows(
      windows.map(w => (w.id === id ? { ...w, maximized: !w.maximized } : w))
    );
  };

  // The WEI workbench owns its own market-terminal navigation rail. Hide the
  // shell rail only while that workbench is open so the reference layout has
  // a single, unambiguous left navigation.
  const isWeiWorkbenchOpen = windows.some(window => window.id === "st-wei");

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden pb-9 md:pb-0">
      {/* Command Bar */}
      <TerminalCommandBar onNavigate={handleModuleSelect} />
      {/* Announcements */}
      <AnnouncementBanner />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-0 relative">
        {!isWeiWorkbenchOpen && (
          <>
            {/* Mobile Sidebar Overlay */}
            {isMobile && sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Navigation Sidebar */}
            <div
              className={`${
                isMobile
                  ? `fixed left-0 top-16 h-[calc(100vh-4rem)] z-50 transition-transform duration-200 ${
                      sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`
                  : "relative"
              }`}
            >
              <ModuleNavigation
                activeModule={activeModule}
                onModuleSelect={moduleId => {
                  handleModuleSelect(moduleId);
                  if (isMobile) setSidebarOpen(false);
                }}
                onSubItemSelect={(moduleId, itemId, itemName) => {
                  handleSubItemSelect(moduleId, itemId, itemName);
                  // A selected child already owns the content area. On narrow
                  // screens close the overlay so the chosen original panel is
                  // immediately usable without hiding its first data frame.
                  if (isMobile) setSidebarOpen(false);
                }}
                onOpenPortfolioTab={tabId => {
                  setPortfolioInitialTab(tabId);
                  setActiveModule("portfolio-management");
                  // Remove existing portfolio window and create new one with the selected tab
                  setWindows(prev => {
                    const filtered = prev.filter(
                      w => w.id !== "portfolio-management"
                    );
                    return [
                      ...filtered,
                      {
                        id: "portfolio-management",
                        title: "投资组合管理与风险",
                        content: (
                          <PortfolioRiskPreservedModule
                            moduleId={`PORTFOLIO-${tabId}`}
                          >
                            <PortfolioManagementPanel initialTab={tabId} />
                          </PortfolioRiskPreservedModule>
                        ),
                      },
                    ];
                  });
                  if (isMobile) setSidebarOpen(false);
                }}
                collapsed={false}
              />
            </div>

            {/* Mobile Menu Toggle */}
            {isMobile && !sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors border-r border-border flex-shrink-0"
                title="打开功能导航"
                aria-label="打开功能导航"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Close button in mobile sidebar */}
            {isMobile && sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors z-50"
                title="关闭功能导航"
                aria-label="关闭功能导航"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {/* Terminal Layout */}
        <div className="flex flex-1 overflow-hidden relative">
          <TerminalLayout
            windows={windows.map(window => ({
              ...window,
              hideHeader: isSovereignChildWindow(window.id),
            }))}
            onWindowClose={handleWindowClose}
            onWindowMinimize={handleWindowMinimize}
            onWindowMaximize={handleWindowMaximize}
            gridLayout={isMobile ? "single" : "double"}
          />
          {/* 自选信号侧边栏切换按钮 */}
          <button
            onClick={() => setFavSidebarOpen(f => !f)}
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-0.5 px-1 py-3 rounded-l-md border border-r-0 transition-colors text-xs font-medium ${
              favSidebarOpen
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/30"
                : "bg-muted/30 text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
            }`}
            title={favSidebarOpen ? "关闭自选追踪" : "打开自选追踪"}
            style={{ writingMode: "vertical-rl", letterSpacing: "0.05em" }}
          >
            <Star
              className="w-3 h-3 mb-0.5"
              style={{ writingMode: "horizontal-tb" }}
            />
            自选
          </button>
          {/* 自选信号侧边栏 */}
          {favSidebarOpen && (
            <div className="w-64 flex-shrink-0 border-l border-border overflow-hidden bg-background">
              <FavoriteSignalsSidebar
                onClose={() => setFavSidebarOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

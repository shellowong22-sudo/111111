import React, { useState } from "react";
import {
  TrendingUp,
  BarChart3,
  MessageSquare,
  Newspaper,
  LineChart,
  Briefcase,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SovereignBondMenu from "./SovereignBondMenu";
import CreditBondMenu from "./CreditBondMenu";
import MortgageBondMenu from "./MortgageBondMenu";
import { MoneyMarketMenu } from "./MoneyMarketMenu";
import { PreferredStockMenu } from "./PreferredStockMenu";
import { StockMarketMenu } from "./StockMarketMenu";
import { CommoditiesMenu } from "./CommoditiesMenu";
import { IndicesMenu } from "./IndicesMenu";
import { DerivativesMenu } from "./DerivativesMenu";
import { MessagingCommunityMenu } from "./MessagingCommunityMenu";
import { NewsResearchMenu } from "./NewsResearchMenu";
import { EconomicsMenu } from "./EconomicsMenu";
import { PortfolioManagementMenu } from "./PortfolioManagementMenu";
import { PricingRiskMenu } from "./PricingRiskMenu";
import { OrderManagementMenu } from "./OrderManagementMenu";
import { ElectronicTradingMenu } from "./ElectronicTradingMenu";
import { STPMenu } from "./STPMenu";
import { TradeBookMenu } from "./TradeBookMenu";
import { ForexMenu } from "./ForexMenu";
import { IndustryGroupMenu } from "./IndustryGroupMenu";
import { BloombergDataMenu } from "./BloombergDataMenu";
import { SettingsToolsMenu } from "./SettingsToolsMenu";
import LocalBondMenu from "./LocalBondMenu";
import { LayoutDashboard, Sparkles } from "lucide-react";

interface ModuleItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: ModuleItem[];
}

interface ModuleNavigationProps {
  activeModule: string;
  onModuleSelect: (moduleId: string) => void;
  onSubItemSelect?: (
    moduleId: string,
    itemId: string,
    itemName: string
  ) => void;
  onOpenPortfolioTab?: (tabId: string) => void;
  collapsed?: boolean;
}

const MODULES: ModuleItem[] = [
  // 七组核心功能（模块合并方案）：只调整分组与顺序，每个入口的 id、名称与行为保持不变。
  {
    id: "markets",
    label: "固定收益",
    icon: <TrendingUp className="w-4 h-4" />,
    children: [
      { id: "sovereign-bonds", label: "主权债" },
      { id: "credit-bonds", label: "信用债" },
      { id: "mortgage-bonds", label: "抵押债" },
      { id: "money-market", label: "货币市场" },
      { id: "local-bonds", label: "地方债" },
      { id: "preferred-stock", label: "优先股" },
    ],
  },
  {
    id: "equities",
    label: "权益与衍生品",
    icon: <BarChart3 className="w-4 h-4" />,
    children: [
      { id: "stocks", label: "股市" },
      { id: "industry-group", label: "行业分组分析" },
      { id: "indices", label: "指数" },
      { id: "commodities", label: "大宗商品" },
      { id: "forex", label: "外汇" },
      { id: "derivatives", label: "衍生品" },
    ],
  },
  {
    id: "macro",
    label: "宏观与资讯",
    icon: <LineChart className="w-4 h-4" />,
    children: [
      { id: "economics", label: "经济数据及分析菜单" },
      { id: "news-research", label: "新闻与研究报告菜单" },
      { id: "messaging-community", label: "通讯与社区菜单" },
    ],
  },
  {
    id: "portfolio",
    label: "组合与风险",
    icon: <Briefcase className="w-4 h-4" />,
    children: [
      { id: "portfolio-management", label: "投资组合管理与风险" },
      { id: "pricing", label: "定价与风险分析" },
    ],
  },
  {
    id: "trading-desk",
    label: "交易工作台",
    icon: <MessageSquare className="w-4 h-4" />,
    children: [
      { id: "order-book", label: "交易委托管理" },
      { id: "trading", label: "电子交易界面" },
      { id: "stp", label: "STP" },
      { id: "trade-book", label: "交易账簿管理" },
    ],
  },
  {
    id: "ai",
    label: "智能与工具",
    icon: <Sparkles className="w-4 h-4" />,
    children: [
      { id: "ucheer-ai", label: "Ucheer AI" },
      { id: "personal-workspace", label: "我的看板" },
    ],
  },
  {
    id: "tools",
    label: "平台工具",
    icon: <Settings className="w-4 h-4" />,
    children: [
      { id: "flexible-screen", label: "灵活屏" },
      { id: "data-export", label: "数据导出" },
      { id: "bquant", label: "UQuant" },
      { id: "mobile", label: "移动版" },
      { id: "settings", label: "设定" },
      { id: "admin-console", label: "管理后台" },
    ],
  },
  {
    id: "help",
    label: "帮助与关于",
    icon: <HelpCircle className="w-4 h-4" />,
    children: [
      { id: "shortcuts", label: "快捷键" },
      { id: "docs", label: "文档" },
      { id: "about", label: "关于" },
    ],
  },
];

export default function ModuleNavigation({
  activeModule,
  onModuleSelect,
  onSubItemSelect,
  onOpenPortfolioTab,
  collapsed = false,
}: ModuleNavigationProps) {
  const [, setLocation] = useLocation();
  const navigate = setLocation;
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(["markets", "equities", "macro", "portfolio", "trading-desk", "ai"])
  );
  const [showSovereignBondMenu, setShowSovereignBondMenu] = useState(false);
  const [showCreditBondMenu, setShowCreditBondMenu] = useState(false);
  const [showMortgageBondMenu, setShowMortgageBondMenu] = useState(false);
  const [showMoneyMarketMenu, setShowMoneyMarketMenu] = useState(false);
  const [showPreferredStockMenu, setShowPreferredStockMenu] = useState(false);
  const [showStockMarketMenu, setShowStockMarketMenu] = useState(false);
  const [showCommoditiesMenu, setShowCommoditiesMenu] = useState(false);
  const [showIndicesMenu, setShowIndicesMenu] = useState(false);
  const [showDerivativesMenu, setShowDerivativesMenu] = useState(false);
  const [showMessagingCommunityMenu, setShowMessagingCommunityMenu] =
    useState(false);
  const [showNewsResearchMenu, setShowNewsResearchMenu] = useState(false);
  const [showEconomicsMenu, setShowEconomicsMenu] = useState(false);
  const [showPortfolioManagementMenu, setShowPortfolioManagementMenu] =
    useState(false);
  const [showPricingRiskMenu, setShowPricingRiskMenu] = useState(false);
  const [showOrderManagementMenu, setShowOrderManagementMenu] = useState(false);
  const [showElectronicTradingMenu, setShowElectronicTradingMenu] =
    useState(false);
  const [showSTPMenu, setShowSTPMenu] = useState(false);
  const [showTradeBookMenu, setShowTradeBookMenu] = useState(false);
  const [showForexMenu, setShowForexMenu] = useState(false);
  const [showIndustryGroupMenu, setShowIndustryGroupMenu] = useState(false);
  const [showBloombergDataMenu, setShowBloombergDataMenu] = useState(false);
  const [showSettingsToolsMenu, setShowSettingsToolsMenu] = useState(false);
  const [showLocalBondMenu, setShowLocalBondMenu] = useState(false);

  const toggleExpanded = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const isExpanded = (moduleId: string) => expandedModules.has(moduleId);

  const handleSovereignBondItemSelect = (itemId: string, itemName: string) => {
    setShowSovereignBondMenu(false);
    onSubItemSelect?.("sovereign-bonds", itemId, itemName);
  };

  const handleCreditBondItemSelect = (itemId: string, itemName: string) => {
    setShowCreditBondMenu(false);
    onSubItemSelect?.("credit-bonds", itemId, itemName);
  };

  const handleMortgageBondItemSelect = (itemId: string, itemName: string) => {
    setShowMortgageBondMenu(false);
    onSubItemSelect?.("mortgage-bonds", itemId, itemName);
  };

  const handleForexItemSelect = (itemId: string, itemName: string) => {
    setShowForexMenu(false);
    onSubItemSelect?.("forex", itemId, itemName);
  };

  const handleMoneyMarketItemSelect = (itemId: string, itemName: string) => {
    setShowMoneyMarketMenu(false);
    onSubItemSelect?.("money-market", itemId, itemName);
  };

  const handleLocalBondItemSelect = (itemId: string, itemName: string) => {
    setShowLocalBondMenu(false);
    onSubItemSelect?.("local-bonds", itemId, itemName);
  };

  return (
    <>
      <div
        className={cn(
          "bg-card border-r border-border overflow-y-auto transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="p-2">
          {MODULES.map(module => (
            <div key={module.id} className="mb-1">
              {/* Module Header */}
              <button
                onClick={() => {
                  if (module.children) {
                    toggleExpanded(module.id);
                  } else {
                    onModuleSelect(module.id);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-sm text-sm transition-colors",
                  activeModule === module.id ||
                    activeModule.startsWith(module.id + "-")
                    ? "bg-accent/20 text-accent"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                title={collapsed ? module.label : undefined}
              >
                <span className="flex-shrink-0">{module.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left font-mono text-xs font-semibold uppercase tracking-wider">
                      {module.label}
                    </span>
                    {module.children && (
                      <span className="flex-shrink-0">
                        {isExpanded(module.id) ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Sub-modules */}
              {!collapsed && module.children && isExpanded(module.id) && (
                <div className="ml-2 mt-1 border-l border-border/50 pl-2">
                  {module.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => {
                        if (child.id === "sovereign-bonds") {
                          setShowSovereignBondMenu(true);
                        } else if (child.id === "credit-bonds") {
                          setShowCreditBondMenu(true);
                        } else if (child.id === "mortgage-bonds") {
                          setShowMortgageBondMenu(true);
                        } else if (child.id === "money-market") {
                          setShowMoneyMarketMenu(true);
                        } else if (child.id === "local-bonds") {
                          setShowLocalBondMenu(true);
                        } else if (child.id === "preferred-stock") {
                          setShowPreferredStockMenu(true);
                        } else if (child.id === "stocks") {
                          setShowStockMarketMenu(true);
                        } else if (child.id === "commodities") {
                          setShowCommoditiesMenu(true);
                        } else if (child.id === "indices") {
                          setShowIndicesMenu(true);
                        } else if (child.id === "derivatives") {
                          setShowDerivativesMenu(true);
                        } else if (child.id === "messaging-community") {
                          setShowMessagingCommunityMenu(true);
                        } else if (child.id === "news-research") {
                          setShowNewsResearchMenu(true);
                        } else if (child.id === "economics") {
                          setShowEconomicsMenu(true);
                        } else if (child.id === "portfolio-management") {
                          setShowPortfolioManagementMenu(true);
                        } else if (child.id === "pricing") {
                          setShowPricingRiskMenu(true);
                        } else if (child.id === "order-book") {
                          setShowOrderManagementMenu(true);
                        } else if (child.id === "trading") {
                          setShowElectronicTradingMenu(true);
                        } else if (child.id === "stp") {
                          setShowSTPMenu(true);
                        } else if (child.id === "trade-book") {
                          setShowTradeBookMenu(true);
                        } else if (child.id === "forex") {
                          setShowForexMenu(true);
                        } else if (child.id === "industry-group") {
                          setShowIndustryGroupMenu(true);
                        } else if (child.id === "bloomberg-data") {
                          setShowBloombergDataMenu(true);
                        } else if (child.id === "settings-tools") {
                          setShowSettingsToolsMenu(true);
                        } else if (child.id === "bquant") {
                          navigate("/bquant");
                        } else if (child.id === "admin-console") {
                          navigate("/admin");
                        } else if (child.id === "ucheer-ai") {
                          navigate("/ucheer-ai");
                        } else if (child.id === "personal-workspace") {
                          navigate("/workspace");
                        } else {
                          onModuleSelect(child.id);
                        }
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 rounded-sm text-xs transition-colors",
                        activeModule === child.id
                          ? "bg-accent/20 text-accent font-semibold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <span className="font-mono">{child.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
      {showSovereignBondMenu && (
        <SovereignBondMenu
          onClose={() => setShowSovereignBondMenu(false)}
          onSelectItem={handleSovereignBondItemSelect}
        />
      )}
      {showCreditBondMenu && (
        <CreditBondMenu
          onClose={() => setShowCreditBondMenu(false)}
          onSelectItem={handleCreditBondItemSelect}
        />
      )}
      {showMortgageBondMenu && (
        <MortgageBondMenu
          onClose={() => setShowMortgageBondMenu(false)}
          onSelectItem={handleMortgageBondItemSelect}
        />
      )}
      {showMoneyMarketMenu && (
        <MoneyMarketMenu
          onClose={() => setShowMoneyMarketMenu(false)}
          onSelectItem={handleMoneyMarketItemSelect}
        />
      )}
      {showLocalBondMenu && (
        <LocalBondMenu
          onClose={() => setShowLocalBondMenu(false)}
          onSelectItem={handleLocalBondItemSelect}
        />
      )}
      {showPreferredStockMenu && (
        <PreferredStockMenu
          onClose={() => setShowPreferredStockMenu(false)}
          onSelectItem={(itemId, itemName) => {
            setShowPreferredStockMenu(false);
            onSubItemSelect?.("preferred-stock", itemId, itemName);
          }}
        />
      )}
      {showStockMarketMenu && (
        <StockMarketMenu
          onClose={() => setShowStockMarketMenu(false)}
          onSelectItem={(itemId, itemName) => {
            setShowStockMarketMenu(false);
            onSubItemSelect?.("stocks", itemId, itemName);
          }}
        />
      )}
      {showCommoditiesMenu && (
        <CommoditiesMenu onClose={() => setShowCommoditiesMenu(false)} />
      )}
      {showIndicesMenu && (
        <IndicesMenu onClose={() => setShowIndicesMenu(false)} />
      )}
      {showDerivativesMenu && (
        <DerivativesMenu onClose={() => setShowDerivativesMenu(false)} />
      )}
      {showMessagingCommunityMenu && (
        <MessagingCommunityMenu
          onClose={() => setShowMessagingCommunityMenu(false)}
        />
      )}
      {showNewsResearchMenu && (
        <NewsResearchMenu onClose={() => setShowNewsResearchMenu(false)} />
      )}
      {showEconomicsMenu && (
        <EconomicsMenu onClose={() => setShowEconomicsMenu(false)} />
      )}
      {showPortfolioManagementMenu && (
        <PortfolioManagementMenu
          onClose={() => setShowPortfolioManagementMenu(false)}
          onOpenTab={tabId => {
            setShowPortfolioManagementMenu(false);
            onOpenPortfolioTab?.(tabId);
          }}
        />
      )}
      {showPricingRiskMenu && (
        <PricingRiskMenu onClose={() => setShowPricingRiskMenu(false)} />
      )}
      {showOrderManagementMenu && (
        <OrderManagementMenu
          onClose={() => setShowOrderManagementMenu(false)}
        />
      )}
      {showElectronicTradingMenu && (
        <ElectronicTradingMenu
          onClose={() => setShowElectronicTradingMenu(false)}
        />
      )}
      {showSTPMenu && <STPMenu onClose={() => setShowSTPMenu(false)} />}
      {showTradeBookMenu && (
        <TradeBookMenu onClose={() => setShowTradeBookMenu(false)} />
      )}
      {showForexMenu && (
        <ForexMenu
          onClose={() => setShowForexMenu(false)}
          onSelectItem={handleForexItemSelect}
        />
      )}
      {showIndustryGroupMenu && (
        <IndustryGroupMenu
          onClose={() => setShowIndustryGroupMenu(false)}
          onSelectItem={(itemId, itemName) => {
            setShowIndustryGroupMenu(false);
            onSubItemSelect?.("industry-group", itemId, itemName);
          }}
        />
      )}
      {showBloombergDataMenu && (
        <BloombergDataMenu onClose={() => setShowBloombergDataMenu(false)} />
      )}
      {showSettingsToolsMenu && (
        <SettingsToolsMenu onClose={() => setShowSettingsToolsMenu(false)} />
      )}
    </>
  );
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OpenBB priority A front-end ACK surfaces', () => {
  it('renders the macro delivery dataset inside the existing macro page', () => {
    const source = readFileSync('client/src/pages/MacroeconomicDashboard.tsx', 'utf8');
    expect(source).toContain('useModuleLiveFeed("/macro-dashboard", true)');
    expect(source).toContain('<ModuleLiveDeliveryTable {...openBBDelivery}');
  });

  it('renders the economic delivery dataset inside the existing economic route without replacing preserved content', () => {
    const source = readFileSync('client/src/components/econ/EconomicDataHubPreservedRoute.tsx', 'utf8');
    expect(source).toContain("useModuleLiveFeed(path, true,");
    expect(source).toContain("path = '/terminal?module=economics'");
    expect(source).toContain('path={feedPath}');
    expect(source).toContain('remaining.length > 0');
    expect(source).toContain('data-preserved-economic-hub="true"');
    expect(source).toContain('<ModuleLiveDeliveryTable {...openBBDelivery}');
    expect(source).not.toContain('<EconOneToOneExtensionBridge />');
    expect(source).not.toContain('ZIP CONTEXT EXTENSION');
  });

  it('renders the derivatives dataset inside the existing enhanced derivatives route', () => {
    const source = readFileSync('client/src/pages/DerivativesEnhanced.tsx', 'utf8');
    const base = readFileSync('client/src/pages/DerivativesBase.tsx', 'utf8');
    expect(source).toContain("useModuleLiveFeed('/deri', true)");
    expect(source).toContain('collectOpenBBDatasetRows(items)');
    expect(source).toContain('合约观察明细');
    expect(source).toContain('rows.slice(0, 500)');
    expect(base).not.toContain('generateMockData');
    expect(base).toContain('页面不以静态、随机或合成数据替代');
    expect(source).toContain("? '期货数据服务已连接'");
    expect(source).toContain('DERI · FinMind 期货');
  });

  it('does not depend on animation frames for ACK in background terminal tabs', () => {
    const source = readFileSync('client/src/hooks/useModuleLiveFeed.ts', 'utf8');
    expect(source).toContain('useEffect` 本身只会在 React 已提交本批 DOM 后运行');
    expect(source).not.toContain('window.requestAnimationFrame');
    expect(source).toContain('acknowledgeRef.current');
  });

  it('shows real interface success counts and runs the automatic delivery pipeline', () => {
    const admin = readFileSync('client/src/pages/admin/OpenBBPriorityAWorkspace.tsx', 'utf8');
    const server = readFileSync('server/_core/index.ts', 'utf8');
    for (const label of ['运行接口合同', '已绑定前端接口', '成功取数接口', '未绑定运行接口', '已有成功数据功能', '自动数据链路']) {
      expect(admin).toContain(label);
    }
    expect(server).toContain('syncOpenBBAutomation({ actorUserId, maxRuns: 8 })');
    expect(server).toContain('Promise.all([');
  });

  it('keeps the remaining OpenBB primary shards on their existing pages and crypto on its own market API', () => {
    const source = readFileSync('client/src/components/OpenBBModuleDataBand.tsx', 'utf8');
    expect(source).toContain('useModuleLiveFeed(path, true)');
    const crypto = readFileSync('client/src/pages/CryptoMarket.tsx', 'utf8');
    const fund = readFileSync('client/src/pages/FundBrowse.tsx', 'utf8');
    const navigation = readFileSync('client/src/components/ModuleNavigation.tsx', 'utf8');
    expect(crypto).toContain('trpc.crypto.getCoinList.useQuery');
    expect(crypto).toContain('trpc.crypto.getPriceHistory.useQuery');
    expect(crypto).not.toContain('OpenBBModuleDataBand');
    expect(navigation).not.toContain('{ id: "crypto-market", label: "加密货币" }');
    expect(fund).toContain("useModuleLiveFeed('/fund-browse')");
    const wei = readFileSync('client/src/components/WEIPanel.tsx', 'utf8');
    expect(wei).toContain('trpc.equityListings.quote.useQuery');
    expect(wei).toContain('trpc.equityListings.sessionQuote.useQuery');
    expect(wei).toContain('activeSidebarItem === "加密货币"');
    expect(wei).toContain('<CryptoMarket embedded />');
    const pageContracts: Array<[string, string]> = [
      ['client/src/pages/CommodityMarket.tsx', "useModuleLiveFeed('/commodity-market', true)"],
      ['client/src/pages/IndexHub.tsx', 'path=\"/index-hub\"'],
      ['client/src/pages/ForexHub.tsx', 'path=\"/forex-hub\"'],
      ['client/src/pages/CreditAnalysis.tsx', 'path=\"/credit-analysis\"'],
      ['client/src/pages/ETFHoldingsAdmin.tsx', 'path=\"/etf-holdings-admin\"'],
      ['client/src/pages/NewsResearchHub.tsx', 'useModuleLiveFeed(`/news-hub?tab=${encodeURIComponent(activeTab)}`'],
      ['client/src/pages/IndustryGroupAnalysis.tsx', 'path=\"/industry-analysis\"'],
      ['client/src/components/EQSPanel.tsx', 'useModuleLiveFeed(\"/terminal?open=eqs&module=stocks\", true)'],
      ['client/src/components/EVTSPanel.tsx', 'path=\"/terminal?open=evts&module=stocks\"'],
      ['client/src/components/PORTPanel.tsx', 'path=\"/terminal?open=port&module=stocks\"'],
      ['client/src/components/StockNCEOCockpitPanel.tsx', 'path=\"/terminal?open=cockpit&module=stocks\"'],
    ];
    for (const [file, contract] of pageContracts) {
      expect(readFileSync(file, 'utf8'), file).toContain(contract);
    }
  });
});

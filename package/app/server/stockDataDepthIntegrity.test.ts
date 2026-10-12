import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STOCK_CAPABILITIES } from "../shared/threeModuleCapabilityCatalog";

const read = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

describe("stock 33 in-place data depth integrity", () => {
  it("keeps the closed 33-entry catalog and mounts no parallel research page", () => {
    const terminal = read("client/src/pages/Terminal.tsx");
    const wrapper = read(
      "client/src/components/stock/StockMarketPreservedModule.tsx"
    );
    expect(STOCK_CAPABILITIES).toHaveLength(33);
    for (const item of STOCK_CAPABILITIES) {
      const key = item.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(terminal).toMatch(new RegExp(`(?:['"]${key}['"]|${key})\\s*:`));
    }
    expect(wrapper).not.toContain("StockMarketResearchLayer");
    expect(terminal).not.toContain("<StockMarketResearchLayer");
    expect(wrapper).not.toContain("StockInlineDataLayer");
    expect(wrapper).not.toContain("data-stock-inline-data-layer");
  });

  it("keeps data depth inside the original DS, FSRC, PORT, CACT and IPO components", () => {
    const ds = read("client/src/components/DSPanel.tsx");
    const fsrc = read("client/src/components/FSRCPanel.tsx");
    const port = read("client/src/components/PORTPanel.tsx");
    const cact = read("client/src/components/CACTPanel.tsx");
    const ipo = read("client/src/components/IPOPanel.tsx");
    expect(ds).toContain("getFilingExcerpt.useQuery");
    expect(ds).not.toContain("const DOCUMENTS");
    expect(fsrc).toContain("getCompanyFacts.useQuery");
    expect(fsrc).not.toContain("QUARTERLY_DATA");
    expect(port).toContain("getWatchlistObservations.useQuery");
    expect(port).not.toContain("const PORTFOLIO");
    expect(cact).toContain("getIssuerFilings.useQuery");
    expect(cact).toContain("getCompanyFacts.useQuery");
    expect(cact).not.toContain("EARNINGS_SURPRISE");
    expect(ipo).toContain("getIssuerFilings.useQuery");
    expect(ipo).toContain("getTickerObservation.useQuery");
    expect(ipo).not.toContain("IPO_CALENDAR");
    expect(ipo).not.toContain("RECENT_IPOS");
  });

  it("preserves every original IMAP function area before in-place enrichment", () => {
    const imap = read("client/src/components/IMAPPanel.tsx");
    for (const label of [
      "板块热力图",
      "大单净流入",
      "流动性真空区",
      "资金时序",
      "个股大单排行",
      "全球资金净流向 & G4宏观趋势",
    ]) {
      expect(imap).toContain(label);
    }
    expect(imap).toContain("getWatchlistObservations.useQuery");
    expect(imap).toContain("d.quality");
    expect(imap).toContain("资金流来源未配置");
    expect(imap).toContain("Level 2 买卖盘和可执行报价源未配置");
    expect(imap).toContain("不把价格涨跌伪装成资金净流入");
    expect(imap).toMatch(/typeof s\.changePct === ["']number["']/);
    expect(imap).not.toMatch(/Math\.random|Math\.sin|setInterval/);
  });

  it("keeps stock and forex RES on the original RES workspace", () => {
    const terminal = read("client/src/pages/Terminal.tsx");
    const res = read("client/src/components/RESPanel.tsx");
    expect(terminal).toMatch(
      /res:\s*\{[\s\S]*?component:\s*preserveStock\(\s*["']res["'],\s*<RESPanel/
    );
    expect(terminal).toMatch(
      /<ForexPreservedModule\s+moduleId="RES">\s*<RESPanel/
    );
    for (const label of [
      "评级变更",
      "一致预期",
      "评级分布",
      "多股对比",
      "历史档案",
    ]) {
      expect(res).toContain(label);
    }
  });

  it("keeps the cockpit unavailable when real history or licensed option data is absent", () => {
    const cockpit = read("client/src/components/StockNCEOCockpitPanel.tsx");
    expect(cockpit).toContain("本页保持不可用状态，不生成或回退到本地价格");
    expect(cockpit).toContain("不生成 ATM 合约");
    expect(cockpit).not.toMatch(
      /makeWorkspaceHistory|makeWorkspaceOptionChain|futuresOptions\.getOptionChain|Math\.random/
    );
  });

  it("formats WEI as index points rather than a percentage axis", () => {
    const wei = read("client/src/components/WEIPanel.tsx");
    expect(wei).toContain("activeChartLabel");
    expect(wei).toContain("FRED SP500 公开观察");
    expect(wei).toMatch(/tickFormatter=\{v\s*=>\s*Number\(v\)\.toLocaleString/);
    expect(wei).not.toContain("tickFormatter={v=>`${v.toFixed(1)}%`}");
  });
});

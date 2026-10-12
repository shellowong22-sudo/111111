import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("stock market research contracts", () => {
  it("keeps the original stock panel as the only full-width workspace", () => {
    const source = read(
      "client/src/components/stock/StockMarketPreservedModule.tsx"
    );
    expect(source).toContain("data-stock-original-workspace={moduleId}");
    expect(source).toContain("{original}");
    expect(source).not.toContain("data-stock-analysis-in-place");
    expect(source).not.toContain("StockCapabilityAnalysisTool");
    expect(source).not.toContain("StockMarketResearchLayer");
  });

  it("offers only SEC forms supported by the event route", () => {
    const source = read("client/src/components/EVTSPanel.tsx");
    expect(source).toContain('["8-K", "10-K", "10-Q", "S-1", "S-1/A", "S-3", "S-4", "424B2", "424B3", "424B5", "DEFM14A"]');
    expect(source).toContain('getIssuerFilings.useQuery');
    expect(source).toContain('getTickerObservation.useQuery');
  });

  it("keeps the 33-entry backend catalog while hiding the duplicated TOP entry from the stock menu", () => {
    const menu = read("client/src/components/StockMarketMenu.tsx");
    const terminal = read("client/src/pages/Terminal.tsx");
    expect(menu).toContain("STOCK_CAPABILITIES.slice");
    expect(menu).toContain('aria-label="股市 32 项功能目录"');
    expect(menu).toContain('32 / 32');
    expect(menu).toContain('item.id !== "top"');
    expect(terminal).toContain("preserveStock('cockpit'");
    expect(terminal).not.toContain('<StockMarketResearchLayer');
  });

  it("keeps the EQS analysis tool but derives every analytical layer from the typed public observation query", () => {
    const source = read("client/src/components/EQSPanel.tsx");
    expect(source).toContain("getWatchlistObservations.useQuery");
    expect(source).toContain("getWatchlistFundamentals.useQuery");
    expect(source).toContain("includeHistory: true");
    expect(source).toContain("量化打分（质量）");
    expect(source).toContain("回报—波动散点");
    expect(source).toContain("已实现组合路径");
    expect(source).toContain("最大回撤");
    expect(source).toContain("SEC 年度基本面截面");
    expect(source).toContain("dataUpdatedAt");
    expect(source).not.toMatch(
      /Math\.random|STOCK_DATABASE|BACKTEST_RESULTS|composite_score|analyst_score/
    );
  });

  it("keeps the stock research desk graphical and transmits the real bounded OHLCV series used by its charts", () => {
    const layer = read("client/src/components/stock/StockLegacyLivePanels.tsx");
    const route = read("server/routers/stockMarketResearch.ts");
    expect(layer).toContain("实际成交量覆盖排序");
    expect(layer).toContain("相关矩阵与样本明细");
    expect(layer).toContain("相对价格路径与共同日明细");
    expect(layer).toContain("基本面事实与报告期曲线");
    expect(layer).toContain("申报目录与正文证据");
    expect(route).toContain("history: item.history.slice(-120)");
    expect(route).toContain("quality: 'source-observed'");
  });

  it("uses a disclosure-evidence desk for preferred stock instead of copying the equity price workspace", () => {
    const source = read(
      "client/src/components/preferredstock/PreferredStockResearchLayer.tsx"
    );
    expect(source).toContain("PREFERRED_STOCK_CAPABILITIES.find");
    expect(source).toContain("当前账户导入条款");
    expect(source).toContain("数据源未配置");
    expect(source).toContain("不使用其他优先股页面的数据替代");
    expect(source).not.toContain("getTickerObservation");
  });

  it("labels every preserved workspace with its unique responsibility instead of a repeated generic slogan", () => {
    const workspace = read("client/src/components/stock/StockLegacyLivePanels.tsx");
    expect(workspace).toContain("唯一职责：{item.duty}");
    expect(workspace).toContain("const meta: Record<StockLegacyLiveMode");
    expect(workspace).not.toContain("数据研究与分析工具统一入口");
  });
});

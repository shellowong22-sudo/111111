import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("导入行情数据库快照台账", () => {
  it("直接读取数据库行情路由而不接入客户端模拟或第三方跳转", () => {
    const source = readFileSync(`${root}/client/src/components/market/ImportedMarketSnapshotLedger.tsx`, "utf8");
    expect(source).toContain("trpc.market.getAll.useQuery");
    expect(source).toContain("row.updatedAt");
    expect(source).toContain("不使用原页面的客户端模拟实时流");
    expect(source).not.toContain("useRealtimePrices");
    expect(source).not.toContain("window.open");
  });

  it("作为原行情页历史内容之外的独立工作台呈现", () => {
    const marketPage = readFileSync(`${root}/client/src/pages/MarketDataPage.tsx`, "utf8");
    expect(marketPage).toContain("ImportedMarketSnapshotLedger");
    expect(marketPage).toContain("<ImportedMarketSnapshotLedger />");
    expect(marketPage).toContain("data-market-data-historical-content=\"true\"");
    expect(marketPage.indexOf("<ImportedMarketSnapshotLedger />")).toBeLessThan(marketPage.indexOf("<PublicMarketObservationDesk />"));
  });

  it("把历史台账与当前公开观察分开，且当前入口不显示旧快照", () => {
    const source = readFileSync(`${root}/client/src/components/PublicMarketObservationDesk.tsx`, "utf8");
    const ticker = readFileSync(`${root}/client/src/components/GlobalTickerTape.tsx`, "utf8");
    const newsTicker = readFileSync(`${root}/client/src/components/LiveNewsTicker.tsx`, "utf8");
    expect(source).toContain("const [externalEnabled, setExternalEnabled] = useState(false)");
    expect(source).toContain("enabled: externalEnabled");
    expect(source).toContain("按需读取公开观察");
    expect(ticker).toContain("trpc.market.headerObservations.useQuery");
    expect(ticker).toContain("market.freshnessState !== 'current'");
    expect(ticker).toContain("暂无时效合格的当前行情");
    expect(newsTicker).toContain("trpc.market.headerObservations.useQuery");
    expect(newsTicker).toContain("不显示旧快照");
  });
});

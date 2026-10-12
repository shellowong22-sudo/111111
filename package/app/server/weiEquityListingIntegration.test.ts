import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const weiPanel = readFileSync(`${root}/client/src/components/WEIPanel.tsx`, "utf8");
const terminal = readFileSync(`${root}/client/src/pages/Terminal.tsx`, "utf8");
const stockMenu = readFileSync(`${root}/client/src/components/StockMarketMenu.tsx`, "utf8");

describe("WEI 佑诚行情终端内的全球证券数据", () => {
  it("把全球证券清单并入唯一行情工作台且保留原时间序列能力", () => {
    expect(weiPanel).toContain("美国每周经济指数（52周）");
    expect(weiPanel).toContain("全球股市工作台");
    expect(weiPanel).toContain('aria-label="当前国家市场证券行情表"');
    expect(weiPanel).toContain("48,756 条证券记录按 40 个国家或地区归入对应市场");
    expect(weiPanel).toContain("trpc.equityListings.countries.useQuery");
    expect(weiPanel).toContain("trpc.equityListings.list.useQuery");
    expect(weiPanel).toContain("trpc.equityListings.marketMatrix.useQuery");
    expect(weiPanel).toContain("trpc.equityListings.quote.useQuery");
    expect(weiPanel).toContain('return /ifind|同花顺/i.test(source) ? "授权行情源" : source');
    expect(weiPanel).not.toContain("<IfindSdkDataWorkbench");
    expect(weiPanel).not.toContain('{ label: "iFinD数据"');
    expect(terminal).toContain("'wei': { title: 'WEI 全球股票指数'");
    expect(terminal).not.toContain("GlobalEquityCoverageDesk");
    expect(stockMenu).toContain("code: 'WEI', name: '全球股票指数'");
  });

  it("支持国家筛选、检索、真实分页和证券到走势图的键盘联动", () => {
    expect(weiPanel).toContain('value={countryCode}');
    expect(weiPanel).toContain('aria-label="当前市场国家筛选"');
    expect(weiPanel).toContain('aria-label="当前市场证券检索"');
    expect(weiPanel).toContain('aria-label="上一页当前市场证券"');
    expect(weiPanel).toContain('aria-label="下一页当前市场证券"');
    expect(weiPanel).toContain("并联动走势图");
    expect(weiPanel).toContain('event.key === "ArrowDown"');
    expect(weiPanel).toContain('event.key === "ArrowUp"');
    expect(weiPanel).toContain("setEquityPage(0)");
  });
});

/* @vitest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import GlobalEquityCoverageDesk from "../client/src/components/stock/GlobalEquityCoverageDesk";

const runtime = vi.hoisted(() => ({
  countryFailure: false, listFailure: false, empty: false,
  countryRefetch: vi.fn(), listRefetch: vi.fn(), requests: [] as any[],
}));
// Vitest resolves this library's node/SSR build by default, which intentionally omits
// browser resize effects. Use its actual browser implementation for interaction QA.
vi.mock("react-resizable-panels", () => vi.importActual("../node_modules/react-resizable-panels/dist/react-resizable-panels.browser.development.js"));
vi.mock("../client/src/lib/trpc", () => {
  const countries = [
    { countryCode: "AE", country: "阿联酋", listingCount: 1 }, { countryCode: "AT", country: "奥地利", listingCount: 1 },
    { countryCode: "AU", country: "澳大利亚", listingCount: 1 }, { countryCode: "BR", country: "巴西", listingCount: 1 },
    { countryCode: "JP", country: "日本", listingCount: 1 }, { countryCode: "US", country: "美国", listingCount: 21 },
  ];
  const rows = countries.flatMap(country => Array.from({ length: country.listingCount }, (_, index) => ({
    country: country.country, countryCode: country.countryCode, exchange: index % 2 ? "XNYS" : "XNAS",
    symbol: country.countryCode + String(index).padStart(2, "0"), name: country.country + "测试证券" + index,
    sourceFile: "authorized-listings.xlsx", sourceSheet: "Imported Listings", sourceRow: index + 2,
  })));
  return { trpc: { equityListings: {
    countries: { useQuery: () => ({ data: runtime.countryFailure ? undefined : runtime.empty ? [] : countries,
      isLoading: false, isFetching: false, isError: runtime.countryFailure, dataUpdatedAt: 1725951600000,
      refetch: runtime.countryRefetch }) },
    list: { useQuery: (input: any) => {
      runtime.requests.push(input);
      const filtered = runtime.empty ? [] : rows.filter(row => (!input.countryCode || row.countryCode === input.countryCode)
        && (!input.query || (row.symbol + row.name).includes(input.query)));
      return { data: runtime.listFailure ? undefined : { rows: filtered.slice(input.offset, input.offset + input.limit),
        offset: input.offset, limit: input.limit, total: filtered.length }, isLoading: false, isFetching: false,
        isError: runtime.listFailure, dataUpdatedAt: 1725951600000, refetch: runtime.listRefetch };
    } },
  } } };
});
Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: true,
  addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
afterEach(() => { cleanup(); runtime.countryFailure = false; runtime.listFailure = false;
  runtime.empty = false; runtime.requests = []; vi.clearAllMocks(); });

const root = process.cwd();

describe("股票市场全球目录覆盖工作台", () => {
  it("仅使用已导入的全球股票目录接口并保留来源工作表字段", () => {
    const desk = readFileSync(`${root}/client/src/components/stock/GlobalEquityCoverageDesk.tsx`, "utf8");
    expect(desk).toContain("trpc.equityListings.countries.useQuery");
    expect(desk).toContain("trpc.equityListings.list.useQuery");
    expect(desk).toContain("row.sourceFile");
    expect(desk).toContain("row.sourceSheet");
    expect(desk).toContain("不显示行情、新闻、目标价或第三方页面");
    expect(desk).not.toContain("equityListings.quote");
    expect(desk).not.toContain("equityListings.news");
  });

  it("独立目录入口已移除，清单只归入 WEI 唯一行情工作台", () => {
    const terminal = readFileSync(`${root}/client/src/pages/Terminal.tsx`, "utf8");
    const wei = readFileSync(`${root}/client/src/components/WEIPanel.tsx`, "utf8");
    expect(terminal).not.toContain("GlobalEquityCoverageDesk");
    expect(terminal).not.toContain("'coverage':");
    expect(terminal).toContain("preserveStock('wei', <WEIPanel");
    expect(wei).toContain('aria-label="当前国家市场证券行情表"');
    expect(wei).toContain("trpc.equityListings.list.useQuery");
  });

  it("选择目录记录后只展示原始来源溯源字段，不触发行情或新闻读取", () => {
    const desk = readFileSync(`${root}/client/src/components/stock/GlobalEquityCoverageDesk.tsx`, "utf8");
    expect(desk).toContain('data-equity-listing-lineage="true"');
    expect(desk).toContain("LISTING LINEAGE · 已导入目录溯源");
    expect(desk).toContain("selectedListing.sourceFile");
    expect(desk).toContain("selectedListing.sourceSheet");
    expect(desk).toContain("selectedListing.sourceRow");
    expect(desk).toContain("未发起行情、新闻、公司基本面或第三方页面请求");
    expect(desk).toContain('event.key === "Enter" || event.key === " "');
    expect(desk).toContain("setSelectedListingKey(null)");
  });

  it("所有国家进入覆盖矩阵且国家点击联动真实目录查询", () => {
    render(React.createElement(GlobalEquityCoverageDesk));
    const matrix = screen.getByRole("table", { name: "全部国家覆盖矩阵" });
    expect(within(matrix).getAllByRole("button")).toHaveLength(6);
    fireEvent.click(within(matrix).getByRole("button", { name: "JP · 日本" }));
    expect(runtime.requests.at(-1)).toMatchObject({ countryCode: "JP", offset: 0 });
    expect(screen.getByRole("button", { name: "查看 JP00 的导入来源" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "查看 US00 的导入来源" })).toBeNull();
    expect((screen.getByLabelText("全球股票国家筛选") as HTMLSelectElement).value).toBe("JP");
  });

  it("证券行点击与键盘选择把来源字段放入同一可调分栏，而不是复制在列表下方", () => {
    render(React.createElement(GlobalEquityCoverageDesk));
    expect(screen.queryByRole("table", { name: "选中证券来源字段" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "查看 AE00 的导入来源" }));
    const fields = screen.getByRole("table", { name: "选中证券来源字段" });
    expect(within(fields).getByText("authorized-listings.xlsx")).toBeTruthy();
    expect(within(fields).getByText("Imported Listings")).toBeTruthy();
    expect(within(fields).getByText("2")).toBeTruthy();
    expect(screen.getAllByText("authorized-listings.xlsx")).toHaveLength(1);
    const keyboardRow = screen.getByRole("button", { name: "查看 AT00 的导入来源" }).closest("tr")!;
    fireEvent.keyDown(keyboardRow, { key: "Enter" });
    expect(screen.getByRole("heading", { name: "AT00 · 奥地利测试证券0" })).toBeTruthy();
    const divider = screen.getByRole("separator", { name: "调整目录与详情分栏" });
    const before = Number(divider.getAttribute("aria-valuenow"));
    fireEvent.keyDown(divider, { key: "ArrowLeft" });
    expect(Number(divider.getAttribute("aria-valuenow"))).toBeLessThan(before);
    fireEvent.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(screen.queryByRole("table", { name: "选中证券来源字段" })).toBeNull();
  });

  it("重复检索同一条件仍发出刷新，分页清掉旧证券详情", () => {
    render(React.createElement(GlobalEquityCoverageDesk));
    fireEvent.click(screen.getByRole("button", { name: "查看 AE00 的导入来源" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(runtime.requests.at(-1)).toMatchObject({ offset: 20 });
    expect(screen.queryByRole("table", { name: "选中证券来源字段" })).toBeNull();
    fireEvent.change(screen.getByLabelText("全球股票目录检索"), { target: { value: "US00" } });
    fireEvent.click(screen.getByRole("button", { name: "检索目录" }));
    expect(runtime.requests.at(-1)).toMatchObject({ query: "US00", offset: 0 });
    expect(runtime.listRefetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "检索目录" }));
    expect(runtime.listRefetch).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(screen.getByLabelText("全球股票目录检索"), { key: "Enter" });
    expect(runtime.listRefetch).toHaveBeenCalledTimes(3);
    expect(runtime.listRefetch).toHaveBeenLastCalledWith({ cancelRefetch: false });
  });

  it("国家接口失败不是零覆盖，目录接口失败有实际重试入口", () => {
    runtime.countryFailure = true; runtime.listFailure = true;
    render(React.createElement(GlobalEquityCoverageDesk));
    expect(screen.getByLabelText("目录覆盖状态").textContent).toBe("覆盖总量暂不可用");
    expect(screen.queryByText("0 条已导入目录记录")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重试国家覆盖" }));
    expect(runtime.countryRefetch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "重试目录" }));
    expect(runtime.listRefetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole("table", { name: "当前页交易所矩阵" })).toBeNull();
  });

  it("空目录不画虚假覆盖且交易所统计只聚合当前页", () => {
    const mounted = render(React.createElement(GlobalEquityCoverageDesk));
    const exchange = screen.getByRole("table", { name: "当前页交易所矩阵" });
    const counts = within(exchange).getAllByRole("row").slice(1).map(row => Number(within(row).getAllByRole("cell")[1].textContent));
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(20);
    runtime.empty = true; mounted.rerender(React.createElement(GlobalEquityCoverageDesk));
    expect(screen.getByLabelText("目录覆盖状态").textContent).toBe("0 条已导入目录记录");
    expect(screen.queryByRole("table", { name: "当前页交易所矩阵" })).toBeNull();
    expect(screen.queryByRole("table", { name: "全部国家覆盖矩阵" })).toBeNull();
  });
});

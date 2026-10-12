// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectChange: (_value: string) => {},
  mode: "ready" as "ready" | "loading" | "error",
  listCalls: [] as Array<Record<string, unknown>>,
  quoteCalls: [] as Array<Record<string, unknown>>,
  quoteRefetch: vi.fn(),
  quoteMode: "available" as "available" | "unavailable",
  newsCalls: [] as Array<Record<string, unknown>>,
  newsRefetch: vi.fn(),
  newsMode: "available" as "available" | "unavailable",
  matrixRefetch: vi.fn(),
}));

const cnListings = Array.from({ length: 120 }, (_, index) => ({
  country: "中国",
  countryCode: "CN",
  exchange: "中国境内交易所",
  symbol: index === 0 ? "000001.SZ" : `CN${String(index).padStart(4, "0")}`,
  name: index === 0 ? "平安银行" : `中国证券${index}`,
  sourceFile: "全部A股.xlsx",
  sourceSheet: "全部A股",
  sourceRow: index + 2,
}));

const jpListings = [
  { country: "日本", countryCode: "JP", exchange: "东京证券交易所", symbol: "1301.T", name: "Kyokuyo", sourceFile: "东证所全部股票.xlsx", sourceSheet: "东证所全部股票", sourceRow: 2 },
  { country: "日本", countryCode: "JP", exchange: "东京证券交易所", symbol: "130A.T", name: "Veritas In Silico", sourceFile: "东证所全部股票.xlsx", sourceSheet: "东证所全部股票", sourceRow: 3 },
];
const usListings = [
  { country: "美国", countryCode: "US", exchange: "美国证券市场", symbol: "AAPL.O", name: "苹果", sourceFile: "全部美股.xlsx", sourceSheet: "全部美股", sourceRow: 2572 },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      stockMarketResearch: { getEnvironment: { invalidate: vi.fn() } },
      preferredStockResearch: { getMarketEnvironment: { invalidate: vi.fn() } },
    }),
    adminDataModules: {
      getFeedsForPath: {
        useQuery: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
      },
      acknowledgeFeeds: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    stockMarketResearch: {
      getEnvironment: {
        useQuery: () => ({
          data: { series: [], asOf: "2026-08-25T06:16:26.227Z" },
          isLoading: false,
          isFetching: false,
          isError: false,
        }),
      },
    },
    equityListings: {
      countries: {
        useQuery: () => ({ data: [
          { country: "中国", countryCode: "CN", listingCount: 5544 },
          { country: "日本", countryCode: "JP", listingCount: 3894 },
          { country: "美国", countryCode: "US", listingCount: 6257 },
        ] }),
      },
      list: {
        useQuery: (input: { countryCode?: string; query?: string; offset: number; limit: number }) => {
          state.listCalls.push(input);
          if (state.mode === "loading") return { data: undefined, isLoading: true, isError: false };
          if (state.mode === "error") return { data: undefined, isLoading: false, isError: true };
          const byCountry = input.countryCode === "JP" ? jpListings : input.countryCode === "US" ? usListings : cnListings;
          const query = (input.query ?? "").toLowerCase();
          const filtered = byCountry.filter((listing) => !query || listing.symbol.toLowerCase().includes(query) || listing.name.toLowerCase().includes(query));
          return { data: { rows: filtered.slice(input.offset, input.offset + input.limit), total: filtered.length }, isLoading: false, isError: false };
        },
      },
      marketMatrix: {
        useQuery: (input: { instruments: Array<{ countryCode: string; symbol: string }> }) => ({
          data: {
            rows: input.instruments.map((instrument, index) => ({
              ...instrument,
              country: instrument.countryCode === "JP" ? "日本" : "中国",
              exchange: instrument.countryCode === "JP" ? "东京证券交易所" : "中国境内交易所",
              name: instrument.symbol,
              market: {
                requestedSymbol: instrument.symbol,
                providerSymbol: instrument.symbol,
                price: 10 + index,
                preClose: 9.8 + index,
                change: 0.2,
                changePct: 2,
                open: 9.9,
                high: 10.2,
                low: 9.7,
                volume: 100000,
                amount: 1000000,
                bid1: 9.99,
                ask1: 10.01,
                bidSize1: 1000,
                askSize1: 800,
                inflow: 600000,
                outflow: 400000,
                currency: "CNY",
                observedAt: "2026-08-25T06:01:24.000Z",
                retrievedAt: "2026-08-25T06:02:24.000Z",
                realtime: true,
                source: "Tonghuashun iFinD SDK",
              },
            })),
            availableCount: input.instruments.length,
            realtimeCount: input.instruments.length,
            dailyCount: 0,
            requestedCount: input.instruments.length,
            queriedAt: "2026-08-25T06:02:24.000Z",
          },
          isFetching: false,
          isError: false,
          refetch: state.matrixRefetch,
        }),
      },
      extendedSession: {
        useQuery: (input: { countryCode: string; symbol: string }) => ({
          data: input.countryCode === "US" && input.symbol === "AAPL.O"
            ? { session: { symbol: "AAPL", session: "pre_market", price: 331.225, observedAt: new Date().toISOString(), providerTimestamp: "Oct 2, 2026 4:26 AM ET", providerRealtime: true } }
            : { session: null, limitation: "当前时段暂无可验证盘前/盘后成交" },
          isFetching: false, isError: false,
        }),
      },
      quote: {
        useQuery: (input: { countryCode: string; symbol: string; range: string }) => {
          state.quoteCalls.push(input);
          if (input.symbol === "__NOT_SELECTED__") return { data: undefined, isLoading: false, isFetching: false, isError: false, refetch: state.quoteRefetch };
          if (state.quoteMode === "unavailable") return {
            data: { available: false, source: "Yahoo Finance chart", queriedAt: "2026-08-25T06:16:26.227Z", observedAt: null, quote: null, history: [], limitation: "公开历史行情当前不可用；终端未以合成价格、静态样例或替代证券填充。" },
            isLoading: false,
            isFetching: false,
            isError: false,
            refetch: state.quoteRefetch,
          };
          return {
            data: {
              available: true,
              source: "Yahoo Finance chart",
              queriedAt: "2026-08-25T06:16:26.227Z",
              observedAt: "2026-08-25T06:01:24.000Z",
              quote: { price: 11.56, change: 0.46, changePct: 4.144, currency: "CNY", marketState: "实时", realtime: true, providerSymbol: "000001.SZ", preClose: 11.1, open: 11.2, high: 11.6, low: 11.1, volume: 120000, amount: 1360000, bid1: 11.55, ask1: 11.56, bidSize1: 1200, askSize1: 900, inflow: 800000, outflow: 560000 },
              history: [
                { date: "2026-08-22", close: 11.1, volume: 100000, open: 11, high: 11.2, low: 10.9, value: 11.1 },
                { date: "2026-08-25", close: 11.56, volume: 120000, open: 11.2, high: 11.6, low: 11.1, value: 11.56 },
              ],
              limitation: "公开历史行情仅在本次请求实际可用时展示；不是交易所可执行报价、订单簿或投资建议。",
            },
            isLoading: false,
            isFetching: false,
            isError: false,
            refetch: state.quoteRefetch,
          };
        },
      },
      news: {
        useQuery: (input: { countryCode: string; symbol: string }) => {
          state.newsCalls.push(input);
          if (input.symbol === "__NOT_SELECTED__") return { data: undefined, isLoading: false, isFetching: false, isError: false, refetch: state.newsRefetch };
          if (state.newsMode === "unavailable") return { data: { available: false, source: "Yahoo Finance public search", items: [], limitation: "当前免费公开新闻源不可用；终端不生成摘要、标题或替代新闻。" }, isLoading: false, isFetching: false, isError: false, refetch: state.newsRefetch };
          return { data: { available: true, source: "Yahoo Finance public search", limitation: "新闻标题、发布者与时间来自免费公开搜索的本次实际返回；白话解读仅说明标题线索不足以推断事实，不复写新闻全文。", items: [{ id: "news-1", title: "平安银行披露实际公告", publisher: "验证新闻源", publishedAt: "2026-08-25T06:01:24.000Z", sourceUrl: "https://example.com/news-1", itemType: "STORY", relatedTickers: ["000001.SZ"], plainLanguage: "大白话：来源把这条列为文字报道，并关联代码 000001.SZ；标题线索是“平安银行披露实际公告”。终端只能确认这些来源元数据，未获得正文，不能进一步判断事件细节、业绩、分红、融资、并购或价格影响；需以来源页面核实。发布者为验证新闻源。" }, { id: "news-2", title: "市场板块变化视频", publisher: "第二验证源", publishedAt: "2026-08-25T06:02:24.000Z", sourceUrl: "https://example.com/news-2", itemType: "VIDEO", relatedTickers: ["000001.SZ", "CNTEST"], plainLanguage: "大白话：来源把这条列为视频报道，并关联代码 000001.SZ、CNTEST；标题线索是“市场板块变化视频”。终端只能确认这些来源元数据，未获得正文，不能进一步判断事件细节、业绩、分红、融资、并购或价格影响；需以来源页面核实。发布者为第二验证源。" }] }, isLoading: false, isFetching: false, isError: false, refetch: state.newsRefetch };
        },
      },
    },
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: { onValueChange: (value: string) => void; children: React.ReactNode }) => {
    state.selectChange = onValueChange;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <button onClick={() => state.selectChange(value)}>{children}</button>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div role="separator" />,
}));

vi.mock("@/components/ChartEnhancements", () => ({ EnhancedTooltip: () => null, CustomCursor: null }));
vi.mock("@/components/OpenBBModuleDataBand", () => ({ default: () => null }));
vi.mock("@/components/ChartSkeleton", () => ({ useChartLoading: () => false, ChartWithSkeleton: ({ children }: { children: React.ReactNode }) => children, AreaChartSkeleton: () => null, BarChartSkeleton: () => null, LineChartSkeleton: () => null, DashboardSkeleton: () => null }));
vi.mock("recharts", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { LineChart: Box, Line: Box, XAxis: Box, YAxis: Box, Tooltip: Box, ResponsiveContainer: Box, CartesianGrid: Box, Legend: Box, ReferenceLine: Box, AreaChart: Box, Area: Box, BarChart: Box, Bar: Box };
});

vi.stubGlobal("React", React);

import WEIPanel from "../client/src/components/WEIPanel";

describe("WEI 佑诚行情终端运行时行为", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    state.mode = "ready";
    state.listCalls = [];
    state.quoteCalls = [];
    state.quoteRefetch.mockReset();
    state.quoteMode = "available";
    state.newsCalls = [];
    state.newsRefetch.mockReset();
    state.newsMode = "available";
    state.matrixRefetch.mockReset();
  });

  afterEach(() => cleanup());

  it("实际按国家筛选并按代码或名称检索已导入清单", () => {
    render(<WEIPanel />);
    expect(screen.getByLabelText("当前国家市场证券行情").textContent).toContain("全球全部国家/地区 · 证券行情 120 条");
    expect(screen.getByRole("row", { name: /中国 000001\.SZ 平安银行/ })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("当前市场证券检索"), { target: { value: "平安" } });
    expect(screen.getAllByText("平安银行").length).toBeGreaterThan(0);
    expect(state.listCalls.at(-1)).toMatchObject({ query: "平安", offset: 0 });

    fireEvent.change(screen.getByLabelText("当前市场证券检索"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("当前市场国家筛选"), { target: { value: "JP" } });
    expect(screen.getByRole("button", { name: "选择 1301.T Kyokuyo 并联动走势图" })).toBeTruthy();
    expect(state.listCalls.at(-1)).toMatchObject({ countryCode: "JP", offset: 0 });
  });

  it("实际支持下一页与上一页分页", () => {
    render(<WEIPanel />);
    fireEvent.click(screen.getByRole("button", { name: "下一页当前市场证券" }));
    expect(screen.getByRole("button", { name: "选择 CN0030 中国证券30 并联动走势图" })).toBeTruthy();
    expect(state.listCalls.at(-1)).toMatchObject({ offset: 30, limit: 30 });

    fireEvent.click(screen.getByRole("button", { name: "上一页当前市场证券" }));
    expect(screen.getByRole("row", { name: /中国 000001\.SZ 平安银行/ })).toBeTruthy();
    expect(state.listCalls.at(-1)).toMatchObject({ offset: 0, limit: 30 });
  });

  it("选择证券后读取真实行情、显示来源时间并触发实际刷新", () => {
    render(<WEIPanel />);
    fireEvent.click(screen.getByRole("button", { name: "选择 000001.SZ 平安银行 并联动走势图" }));

    expect(screen.getByText("000001.SZ · 平安银行 · 时间序列")).toBeTruthy();
    expect(screen.getByText("Yahoo Finance chart", { exact: false })).toBeTruthy();
    expect(state.quoteCalls.at(-1)).toMatchObject({ countryCode: "CN", symbol: "000001.SZ", range: "1mo" });
  });

  it("终端深链指定国家和代码时，列表与详情在同一可见工作区呈现", () => {
    window.history.replaceState({}, "", "/terminal?module=stocks&open=wei&country=CN&symbol=000001.SZ");
    render(<WEIPanel />);
    expect(screen.getByText("000001.SZ · 平安银行 · 时间序列")).toBeTruthy();
    expect(screen.getByLabelText("当前国家市场证券行情").textContent).toContain("中国 · 证券行情 1 条");
    expect(state.quoteCalls.at(-1)).toMatchObject({ countryCode: "CN", symbol: "000001.SZ" });
  });

  it("美股深链在原有明细中呈现真实时段字段，不给现金指数或其他市场复制盘前价", () => {
    window.history.replaceState({}, "", "/terminal?module=stocks&open=wei&country=US&symbol=AAPL.O");
    render(<WEIPanel />);
    expect(state.listCalls.at(-1)).toMatchObject({ countryCode: "US", query: "AAPL.O" });
    expect(screen.getByText("AAPL.O · 苹果 · 时间序列")).toBeTruthy();
    const session = screen.getByRole("group", { name: "所选美股盘前盘后行情" });
    expect(session.textContent).toContain("盘前 331.225");
    expect(session.textContent).toContain("盘后 —");
    expect(session.textContent).toContain("Oct 2, 2026 4:26 AM ET");
    expect(screen.getByLabelText("当前国家市场证券行情").textContent).toContain("美国 · 证券行情 1 条");
  });

  it("公开行情不可用时显示明确边界而不展示伪造价格或图表", () => {
    state.quoteMode = "unavailable";
    render(<WEIPanel />);
    fireEvent.click(screen.getByRole("button", { name: "选择 000001.SZ 平安银行 并联动走势图" }));
    expect(screen.getByText("公开历史行情当前不可用；终端未以合成价格、静态样例或替代证券填充。")).toBeTruthy();
    expect(screen.queryByText("11.56")).toBeNull();
  });

  it("在同一走势图工作区保留全球新闻区，不新增证券新闻入口", () => {
    render(<WEIPanel />);
    expect(screen.getByText("全球新闻", { exact: true })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "读取新闻" })).toBeNull();
  });

  it("新闻区在免费源不可用时显示真实边界而非伪造条目", () => {
    state.newsMode = "unavailable";
    render(<WEIPanel />);
    expect(screen.getByText("新闻源未返回可验证条目，不生成替代标题。")).toBeTruthy();
    expect(screen.queryByText("平安银行披露实际公告")).toBeNull();
  });

  it("呈现清单加载、错误和空状态，并只保留佑诚行情终端入口", () => {
    state.mode = "loading";
    const { rerender } = render(<WEIPanel />);
    expect(screen.getByText("正在读取当前市场证券…")).toBeTruthy();

    state.mode = "error";
    rerender(<WEIPanel />);
    expect(screen.getByText("当前市场证券读取失败；未使用静态数据替代。")).toBeTruthy();

    state.mode = "ready";
    rerender(<WEIPanel />);
    fireEvent.change(screen.getByLabelText("当前市场证券检索"), { target: { value: "不存在的证券" } });
    expect(screen.getByText("当前国家和检索条件没有证券记录。")).toBeTruthy();
    expect(screen.getByText("佑诚行情终端", { exact: true })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "基准矩阵" })).toBeNull();
    expect(screen.queryByRole("button", { name: "全球股票清单" })).toBeNull();
  });
});

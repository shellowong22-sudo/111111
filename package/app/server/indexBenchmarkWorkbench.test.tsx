/* @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import IndexBenchmarkWorkbench from "../client/src/components/stock/IndexBenchmarkWorkbench";
import { compareIndexBenchmarks, equityPriceBenchmarks, indexBenchmarkCsv, type BenchmarkSeries } from "../client/src/components/stock/indexBenchmarkAnalytics";

const runtime = vi.hoisted(() => ({ data: null as any, isError: false, isLoading: false, isFetching: false, refetch: vi.fn(), options: null as any }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { stockMarketResearch: { getEnvironment: { useQuery: (_input: unknown, options: unknown) => {
  runtime.options = options; return { ...runtime };
} } } } }));
vi.mock("recharts", async () => {
  const original = await vi.importActual<typeof import("recharts")>("recharts");
  return { ...original, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => React.cloneElement(children as React.ReactElement<any>, { width: 640, height: 300 }) };
});
vi.mock("react-resizable-panels", () => vi.importActual("../node_modules/react-resizable-panels/dist/react-resizable-panels.browser.development.js"));
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", TestResizeObserver);
const points = (values: number[], dates = ["2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"]) => values.map((value, index) => ({ date: dates[index], value }));
const series = (id = "SP500", values = [100, 110, 120, 125]): BenchmarkSeries => ({ id, label: id, source: "FRED", group: "equity", unit: "index_points", status: "available", observationDate: "2026-01-07", history: points(values) });
const left = () => series();
const right = () => series("NASDAQCOM", [200, 210, 220, 240]);
beforeEach(() => {
  runtime.data = { retrievedAt: new Date().toISOString(), series: [left(), right(), { ...series("DGS10"), group: "rates", unit: "%" }] };
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => { cleanup(); runtime.data = null; runtime.isError = false; runtime.isLoading = false; runtime.isFetching = false; vi.clearAllMocks(); });

describe("IN price benchmark definitions and alignment", () => {
  it("allows equity price indices only and deduplicates IDs without substituting interest rates", () => {
    expect(equityPriceBenchmarks([left(), left(), right(), { ...left(), id: "VIXCLS", group: "volatility", unit: "%" }]).map(row => row.id)).toEqual(["SP500", "NASDAQCOM"]);
    expect(compareIndexBenchmarks(left(), { ...right(), group: "rates", unit: "%" }).reason).toMatch(/仅接受股票价格指数/);
    expect(compareIndexBenchmarks(left(), undefined).rows).toEqual([]);
    expect(compareIndexBenchmarks(left(), left()).reason).toMatch(/不同/);
    expect(compareIndexBenchmarks(left(), { ...right(), source: "unknown" }).rows).toEqual([]);
  });

  it("rebases both paths at the first shared date and distinguishes percentage-point excess from price ratios", () => {
    const result = compareIndexBenchmarks(left(), right());
    expect(result.reason).toBeNull(); expect(result.count).toBe(4);
    expect(result.rows[0]).toMatchObject({ leftIndex: 100, rightIndex: 100, intervalStart: null, calendarDays: null, leftIntervalReturnPct: null });
    expect(result.rows[1]).toMatchObject({ intervalStart: "2026-01-02", calendarDays: 3 });
    expect(result.rows[1].leftIntervalReturnPct).toBeCloseTo(10);
    expect(result.leftReturnPct).toBeCloseTo(25); expect(result.rightReturnPct).toBeCloseTo(20);
    expect(result.rows.at(-1)?.excessReturnPp).toBeCloseTo(5);
    expect(result.rows.at(-1)?.relativePerformancePct).toBeCloseTo(4.1666666667);
  });

  it("matches real common dates only, never forward fills and records unpaired samples", () => {
    const result = compareIndexBenchmarks(left(), { ...right(), history: points([220, 240], ["2026-01-06", "2026-01-07"]) });
    expect(result.count).toBe(2); expect(result.unmatchedLeft).toBe(2); expect(result.unmatchedRight).toBe(0);
    expect(result.start).toBe("2026-01-06");
    expect(result.rows[0]).toMatchObject({ leftIndex: 100, rightIndex: 100, left: 120, right: 220 });
  });

  it("drops conflicting dates, invalid calendar dates, missing values, and nonpositive points", () => {
    const invalid = { ...left(), history: [...points([100, 110, 120, 125]), { date: "2026-01-05", value: 999 }, { date: "2026-01-08", value: null }, { date: "2026-02-30", value: 123 }, { date: "2026-01-09", value: 0 }, { date: "2026-01-10", value: -10 }] };
    const result = compareIndexBenchmarks(invalid, right());
    expect(result.rows.map(row => row.date)).toEqual(["2026-01-02", "2026-01-06", "2026-01-07"]);
    expect(result.leftCount).toBe(3);
    const repeated = compareIndexBenchmarks({ ...left(), history: [...points([100, 110, 120, 125]), ...points([100, 110, 120, 125])] }, right());
    expect(repeated.count).toBe(4);
  });

  it("recomputes selected-date bases and stops on invalid dates, unavailable sources or insufficient evidence", () => {
    const filtered = compareIndexBenchmarks(left(), right(), "2026-01-05", "2026-01-06");
    expect(filtered.rows).toHaveLength(2); expect(filtered.start).toBe("2026-01-05");
    expect(filtered.rows[0].leftIndex).toBe(100); expect(filtered.leftReturnPct).toBeCloseTo(120 / 110 * 100 - 100);
    expect(compareIndexBenchmarks(left(), right(), "2026-01-08", "2026-01-02").reason).toMatch(/起止日期无效/);
    expect(compareIndexBenchmarks(left(), right(), "2026-02-30").rows).toEqual([]);
    expect(compareIndexBenchmarks(left(), { ...right(), status: "unavailable" }).reason).toMatch(/暂不可用/);
    expect(compareIndexBenchmarks(left(), right(), "2026-01-07").reason).toMatch(/少于两条/);
  });

  it("exports only the selected calculation window with source, interval, base date and safe text metadata", () => {
    const result = compareIndexBenchmarks(left(), right(), "2026-01-05", "2026-01-06");
    const csv = indexBenchmarkCsv(result, left(), right(), '=HYPERLINK("malicious")');
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).not.toContain("2026-01-02"); expect(csv).not.toContain("2026-01-07");
    expect(csv).toContain("fred:SP500"); expect(csv).toContain("fred:NASDAQCOM");
    expect(csv).toContain("relativePerformancePct"); expect(csv).toContain("price-only; excludes reinvested dividends; not total return");
    expect(csv).toContain("'=HYPERLINK");
    expect(indexBenchmarkCsv(compareIndexBenchmarks(left(), left()), left(), left(), "today").split("\r\n")).toHaveLength(1);
  });
});

describe("IN workbench real component behavior", () => {
  it("renders shared-date comparisons instead of an environment quote matrix, with selectable rows and keyboard-linked chart layers", () => {
    render(<IndexBenchmarkWorkbench />);
    expect(screen.getByLabelText("IN 共同样本数").textContent).toBe("4");
    expect(screen.queryByRole("option", { name: /DGS10/ })).toBeNull();
    const rows = within(screen.getByRole("table", { name: "IN 共同观察明细" })).getAllByRole("row");
    fireEvent.click(rows[1]); expect(rows[1].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("IN 已选观察说明").textContent).toMatch(/共同基准日/);
    fireEvent.keyDown(rows[1], { key: "ArrowDown" }); expect(rows[2].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByLabelText("IN 已选观察说明").textContent).toMatch(/间隔 3 自然日/);
    fireEvent.click(screen.getByRole("tab", { name: "相对价格比率" }));
    expect(screen.getByRole("tabpanel", { name: "相对价格比率" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tab", { name: "相对价格比率" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "累计回报差" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("separator", { name: "IN 曲线与共同观察分栏调节" })).toBeTruthy();
    expect(runtime.options).toMatchObject({ refetchInterval: 60_000, refetchOnReconnect: true, refetchOnWindowFocus: true });
  });

  it("recomputes date filters and blocks identical index selections rather than silently substituting sources", () => {
    render(<IndexBenchmarkWorkbench />);
    fireEvent.change(screen.getByLabelText("IN 开始日期"), { target: { value: "2026-01-05" } });
    fireEvent.change(screen.getByLabelText("IN 结束日期"), { target: { value: "2026-01-06" } });
    expect(screen.getByLabelText("IN 共同样本数").textContent).toBe("2");
    expect(within(screen.getByRole("table", { name: "IN 共同观察明细" })).getAllByRole("row")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "全部已接入历史" }));
    expect(screen.getByLabelText("IN 共同样本数").textContent).toBe("4");
    fireEvent.change(screen.getByLabelText("IN 参考指数"), { target: { value: "SP500" } });
    expect(screen.getByRole("alert").textContent).toMatch(/不同的价格指数/);
    expect(screen.queryByRole("table", { name: "IN 共同观察明细" })).toBeNull();
    expect((screen.getByRole("button", { name: "导出比较样本" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("responds to changed backend values, query errors and real browser offline/reconnect state without a false live status", () => {
    const mounted = render(<IndexBenchmarkWorkbench />);
    runtime.data = { ...runtime.data, series: [series("SP500", [100, 110, 120, 130]), right()] };
    mounted.rerender(<IndexBenchmarkWorkbench />);
    expect(within(screen.getByRole("table", { name: "IN 比较区间结果" })).getByText("30")).toBeTruthy();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    fireEvent(window, new Event("offline"));
    expect(screen.getByText(/断线 · 保留已读取历史，非实时/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "重新读取指数" }) as HTMLButtonElement).disabled).toBe(true);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    fireEvent(window, new Event("online"));
    runtime.isError = true; mounted.rerender(<IndexBenchmarkWorkbench />);
    expect(screen.queryByRole("table", { name: "IN 比较区间结果" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/停止输出比较结果/);
    fireEvent.click(screen.getByRole("button", { name: "重新读取指数" })); expect(runtime.refetch).toHaveBeenCalledOnce();
  });

  it("shows loading, missing sources, insufficient samples and historical freshness explicitly", () => {
    runtime.isLoading = true; const mounted = render(<IndexBenchmarkWorkbench />);
    expect(screen.getByText(/正在读取 FRED 实际指数历史/)).toBeTruthy();
    runtime.isLoading = false; runtime.data = { ...runtime.data, series: [left()] }; mounted.rerender(<IndexBenchmarkWorkbench />);
    expect(screen.getByRole("alert").textContent).toMatch(/数据源未配置/);
    runtime.data = { ...runtime.data, series: [left(), { ...right(), history: points([200]) }] }; mounted.rerender(<IndexBenchmarkWorkbench />);
    expect(screen.getByRole("alert").textContent).toMatch(/少于两条/);
    runtime.data = { ...runtime.data, retrievedAt: "2026-01-08T00:00:00Z", series: [left(), right()] }; mounted.rerender(<IndexBenchmarkWorkbench />);
    expect(screen.getByText(/采集快照过期/)).toBeTruthy(); expect(screen.getByText(/观察滞后/)).toBeTruthy();
    expect(screen.getByText(/最多返回每个系列最近180条观察/)).toBeTruthy();
  });

  it("downloads the actual filtered CSV Blob, not an unfiltered second query", async () => {
    const create = vi.fn((_blob: Blob) => "blob:index-comparison"), revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<IndexBenchmarkWorkbench />);
    fireEvent.change(screen.getByLabelText("IN 开始日期"), { target: { value: "2026-01-06" } });
    fireEvent.click(screen.getByRole("button", { name: "导出比较样本" }));
    expect(create).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce();
    const csv = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(create.mock.calls[0][0]); });
    expect(csv).toContain("2026-01-06"); expect(csv).toContain("2026-01-07");
    expect(csv).not.toContain("2026-01-02"); expect(csv).not.toContain("2026-01-05");
    expect(csv.split("\r\n")).toHaveLength(3); expect(revoke).toHaveBeenCalledWith("blob:index-comparison");
    click.mockRestore();
  });
});

/* @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { toast, refetch, setData } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }, refetch: vi.fn().mockResolvedValue({ data: {} }), setData: vi.fn() }));

const publicReferenceData = {
  readings: [
    { pair: "EUR/USD", base: "EUR", quote: "USD", label: "欧元 / 美元", dataMode: "public_daily" as const, status: "available" as const, observationDate: "2026-08-26", rate: 1.17, previousRate: 1.16, changePct: 0.8621, history: [{ date: "2026-08-25", value: 1.16 }, { date: "2026-08-26", value: 1.17 }], limitation: "公开日频参考边界" },
    { pair: "USD/JPY", base: "USD", quote: "JPY", label: "美元 / 日元", dataMode: "public_daily" as const, status: "available" as const, observationDate: "2026-08-26", rate: 159.21, previousRate: 158.8, changePct: 0.2582, history: [{ date: "2026-08-25", value: 158.8 }, { date: "2026-08-26", value: 159.21 }], limitation: "公开日频参考边界" },
  ],
  asOf: "2026-08-26",
  source: "Frankfurter · 公开中央银行日频参考汇率",
};

vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ forexResearch: { getPublicReferenceRates: { fetch: refetch, setData } } }), forexResearch: { getPublicReferenceRates: { useQuery: () => ({ data: publicReferenceData, isLoading: false, isFetching: false, error: null, refetch }) } } } }));
vi.mock("recharts", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Shape = () => null;
  return { ResponsiveContainer: Container, LineChart: Container, BarChart: Container, Line: Shape, Bar: Shape, XAxis: Shape, YAxis: Shape, CartesianGrid: Shape, Tooltip: Shape, ReferenceLine: Shape };
});

import { FXDSPanel, FXTFPanel } from "../client/src/components/ForexExtPanels";

afterEach(() => {
  cleanup();
  toast.success.mockClear();
  toast.error.mockClear();
  toast.info.mockClear();
  refetch.mockClear();
  setData.mockClear();
});

describe("FXDS 外汇数据检索交互", () => {
  it("搜索和品类筛选实际改变公开日频参考列表，并明确无数据状态", () => {
    render(<FXDSPanel />);

    fireEvent.change(screen.getByPlaceholderText("搜索货币对... (如 EUR, USD, JPY)"), { target: { value: "EUR" } });
    expect(screen.getByText("EUR/USD")).toBeTruthy();
    expect(screen.queryByText("USD/JPY")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "远期" }));
    expect(screen.getByText("当前筛选没有可验证的公开日频参考数据。")).toBeTruthy();

    expect(screen.queryByRole("button", { name: "模拟" })).toBeNull();
  });

  it("刷新、导出、监控与行项详情均使用公开日频数据状态", () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:fxds-test");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<FXDSPanel />);
    fireEvent.click(screen.getByRole("button", { name: "重新请求公开日频参考" }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledWith({ refresh: true });

    fireEvent.click(screen.getByRole("button", { name: "导出当前筛选日频参考" }));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "加入 EUR/USD 监控" }));
    expect(screen.getByRole("button", { name: "从 EUR/USD 监控移除" })).toBeTruthy();

    fireEvent.click(screen.getByText("EUR/USD").closest("tr")!);
    expect(screen.getByText("EUR/USD 公开日频走势")).toBeTruthy();

    click.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });
});

describe("FXTF 外汇代码查找交互", () => {
  it("代码选择和走势图按钮展示同一公开日频序列，而非演示路径", () => {
    render(<FXTFPanel />);
    fireEvent.click(screen.getByText("EURUSD"));
    expect(screen.getByText("2026-08-26")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看公开日频走势图" }));
    expect(screen.getByText("EURUSD 公开日频走势图")).toBeTruthy();
    expect(screen.getByText(/Frankfurter/)).toBeTruthy();
  });
});

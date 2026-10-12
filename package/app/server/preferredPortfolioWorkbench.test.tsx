/* @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import PreferredPortfolioWorkbench from "../client/src/components/preferredstock/PreferredPortfolioWorkbench";

vi.mock("recharts", () => {
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Bar: () => null,
    BarChart: Container,
    CartesianGrid: () => null,
    ResponsiveContainer: Container,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("POR and PORD linked workbenches", () => {
  it("loads one validated snapshot and updates both independent analytical views", () => {
    render(
      <>
        <PreferredPortfolioWorkbench mode="holdings" />
        <PreferredPortfolioWorkbench mode="rebalance" />
      </>
    );
    const por = within(
      screen.getByRole("region", { name: "优先股持仓集中度工作台" })
    );
    const pord = within(
      screen.getByRole("region", { name: "优先股再平衡偏离工作台" })
    );
    expect(pord.queryByLabelText("持仓数据 TSV")).toBeNull();
    fireEvent.change(por.getByLabelText("持仓来源"), {
      target: { value: "用户校验快照" },
    });
    fireEvent.change(por.getByLabelText("持仓观察时间"), {
      target: { value: "2026-09-10T01:00:00Z" },
    });
    fireEvent.change(por.getByLabelText("持仓数据 TSV"), {
      target: {
        value: "A-P\tIssuer A\t600\t50\tUSD\nB-P\tIssuer B\t400\t50\tUSD",
      },
    });
    fireEvent.click(por.getByRole("button", { name: "校验并载入共同持仓" }));
    expect(por.getByText("HHI 0.5200")).toBeTruthy();
    expect(pord.getByText("单边换手 10.00%")).toBeTruthy();
    expect(pord.getByText("-100.00")).toBeTruthy();
    expect(pord.queryByText("发行人集中度 · 同一主体证券合并")).toBeNull();
    fireEvent.change(pord.getByLabelText("筛选持仓证券"), {
      target: { value: "B-P" },
    });
    expect(pord.queryByText("A-P")).toBeNull();
    expect(pord.getByText("B-P")).toBeTruthy();
  });
  it("keeps the previous snapshot intact when a duplicate import is rejected", () => {
    render(<PreferredPortfolioWorkbench mode="holdings" />);
    fireEvent.change(screen.getByLabelText("持仓来源"), {
      target: { value: "观察来源" },
    });
    fireEvent.change(screen.getByLabelText("持仓观察时间"), {
      target: { value: "2026-09-10T01:00:00Z" },
    });
    const valid = "A-P\tIssuer A\t100\t100\tUSD";
    fireEvent.change(screen.getByLabelText("持仓数据 TSV"), {
      target: { value: valid },
    });
    fireEvent.click(screen.getByRole("button", { name: "校验并载入共同持仓" }));
    fireEvent.change(screen.getByLabelText("持仓数据 TSV"), {
      target: { value: `${valid}\n${valid}` },
    });
    fireEvent.click(screen.getByRole("button", { name: "校验并载入共同持仓" }));
    expect(screen.getByRole("alert").textContent).toContain("重复");
    expect(
      JSON.parse(localStorage.getItem("preferred-research-holdings-v1")!).rows
    ).toHaveLength(1);
  });
});

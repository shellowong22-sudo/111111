/* @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Shape = () => null;
  return {
    ResponsiveContainer: Container,
    BarChart: Container,
    LineChart: Container,
    AreaChart: Container,
    ScatterChart: Container,
    ComposedChart: Container,
    PieChart: Container,
    Bar: Shape,
    Line: Shape,
    Area: Shape,
    Scatter: Shape,
    Pie: Shape,
    Cell: Shape,
    CartesianGrid: Shape,
    XAxis: Shape,
    YAxis: Shape,
    ZAxis: Shape,
    Tooltip: Shape,
    Legend: Shape,
  };
});

import IMGRPanel from "../client/src/components/electronic-trading/IMGRPanel";
import WorkflowPanel from "../client/src/components/electronic-trading/WorkflowPanel";
import FstnPanel from "../client/src/components/stp/FstnPanel";

afterEach(cleanup);

describe("保留面板运行时交互", () => {
  it("IMGR 的筛选和设置按钮展开控件，并将风险筛选聚焦到原有风险视图", () => {
    render(<IMGRPanel />);

    fireEvent.click(screen.getByRole("button", { name: "筛选" }));
    expect(screen.getByText("风险使用率阈值：")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "≥ 70%" }));
    expect(screen.getByText("风险限额使用率仪表盘")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "紧凑" }));
    expect(screen.getByText("设置仅影响当前面板的显示密度，不改变原有指标或计算。")).toBeTruthy();
  });

  it("工作流新增规则会打开编辑器并在保存后显示面板内状态反馈", () => {
    render(<WorkflowPanel />);

    fireEvent.click(screen.getByRole("button", { name: "+ Add Rule" }));
    expect(screen.getByText(/Edit Rule: RULE-/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Runtime Rule" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Rule" }));
    expect(screen.getByRole("status").textContent).toContain("已在当前面板中保存");
  });

  it("工作流在未接入授权执行流时不伪造待审批交易", () => {
    render(<WorkflowPanel />);
    expect(screen.getByText("No executions found matching your criteria.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("FSTN 补救操作要求选择方案，并在确认后登记请求且禁用重复提交", () => {
    render(<FstnPanel />);

    fireEvent.click(screen.getAllByRole("button", { name: "管理" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "选择" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "确认补救" }));
    expect(screen.getByText(/已记录“/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认补救" })).toHaveProperty("disabled", true);
  });
});

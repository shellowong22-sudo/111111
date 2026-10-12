/* @vitest-environment jsdom */
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PFSECFPanel, PFFITPanel } from "../client/src/components/pf/PFPanels1";
const runtime = vi.hoisted(() => ({
  authenticated: true,
  rows: [] as any[],
  refetch: vi.fn(),
}));
vi.mock("../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: runtime.authenticated }),
}));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    preferredStockResearch: {
      listTerms: {
        useQuery: () => ({
          data: runtime.rows,
          isLoading: false,
          isFetching: false,
          isError: false,
          dataUpdatedAt: 0,
          refetch: runtime.refetch,
        }),
      },
    },
  },
}));
vi.mock("../client/src/components/ChartEnhancements", () => ({
  EnhancedTooltip: () => null,
  CustomCursor: () => null,
}));
vi.mock("../client/src/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: any) => <div>{children}</div>,
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: () => <hr />,
}));
vi.mock("recharts", () => {
  const Box = ({ children }: any) => <div>{children}</div>;
  return {
    Bar: () => null,
    BarChart: Box,
    CartesianGrid: () => null,
    Line: () => null,
    LineChart: Box,
    ResponsiveContainer: Box,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});
afterEach(() => {
  cleanup();
  runtime.rows = [];
  runtime.authenticated = true;
  vi.clearAllMocks();
});
describe("real original SECF and FIT tool routes", () => {
  it("preserves both exports but removes their random implementation, not just styling", () => {
    const panels = readFileSync(
      resolve(import.meta.dirname, "../client/src/components/pf/PFPanels1.tsx"),
      "utf8"
    );
    const secf = panels.slice(
      panels.indexOf("export function PFSECFPanel"),
      panels.indexOf("// ─── 2. PSCH")
    );
    const fit = panels.slice(
      panels.indexOf("export function PFFITPanel"),
      panels.indexOf("// ─── 6. QFM")
    );
    expect(secf).toContain("PreferredTermScreeningTool");
    expect(fit).toContain("PreferredExecutionAnalysisTool");
    expect(secf + fit).not.toMatch(
      /Math\.random|useAutoRefresh|WFC-L|orderBook|tcaData|LIVE/
    );
  });
  it("loads and filters real account terms with rule explanations", () => {
    runtime.rows = [
      {
        id: 1,
        securityIdentifier: "ACTUAL-P",
        issuerName: "Actual issuer",
        cik: "123",
        dividendType: "fixed",
        couponRatePct: "5",
        paymentFrequency: "quarterly",
        firstCallDate: "2028-01-01",
        asOfDate: "2026-09-01",
        sourceReference: "User licensed terms",
      },
    ];
    const close = vi.fn();
    render(<PFSECFPanel onClose={close} />);
    fireEvent.change(screen.getByLabelText("SECF 评估日期"), {
      target: { value: "2026-09-10" },
    });
    expect(screen.getByRole("button", { name: "ACTUAL-P" })).toBeTruthy();
    expect(screen.queryByText("LIVE")).toBeNull();
    fireEvent.change(screen.getByLabelText("SECF 最低分配率 %"), {
      target: { value: "6" },
    });
    expect(screen.getAllByText("不符合").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("SECF 规则状态"), {
      target: { value: "符合当前规则" },
    });
    expect(screen.getByRole("status").textContent).toContain("无匹配");
    fireEvent.click(screen.getByRole("button", { name: "刷新账户条款" }));
    expect(runtime.refetch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "关闭 SECF" }));
    expect(close).toHaveBeenCalledOnce();
  });
  it("does not render account data to a signed-out screening tool", () => {
    runtime.authenticated = false;
    render(<PFSECFPanel onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("登录");
    expect(screen.queryByRole("button", { name: "ACTUAL-P" })).toBeNull();
  });
  it("accepts real fills, activates all analytical tabs and rejects replay", () => {
    render(<PFFITPanel onClose={() => {}} />);
    expect(screen.queryByText("LIVE")).toBeNull();
    const fill =
      "ORD1\tF1\tTEST-P\t2026-09-10T09:00:00+08:00\tBUY\t10\t101\t100\t2\tUSD\tBroker record";
    fireEvent.change(screen.getByLabelText("FIT 成交记录 TSV"), {
      target: { value: fill },
    });
    fireEvent.click(screen.getByRole("button", { name: "校验并载入成交" }));
    expect(screen.getByText("Broker record")).toBeTruthy();
    for (const tab of screen.getAllByRole("tab")) {
      fireEvent.click(tab);
      expect(tab.getAttribute("aria-selected")).toBe("true");
      expect(screen.getByRole("tabpanel").textContent?.length).toBeGreaterThan(
        20
      );
    }
    fireEvent.change(screen.getByLabelText("FIT 成交记录 TSV"), {
      target: { value: `${fill}\n${fill}` },
    });
    fireEvent.click(screen.getByRole("button", { name: "校验并载入成交" }));
    expect(screen.getByRole("alert").textContent).toContain("重复");
    expect(screen.getByText("1 笔实际输入记录")).toBeTruthy();
  });
});

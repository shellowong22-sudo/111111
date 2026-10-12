/* @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INDUSTRY_GROUP_CAPABILITIES } from "../shared/threeModuleCapabilityCatalog";

const { dossierRefetch, referenceRefetch } = vi.hoisted(() => ({ dossierRefetch: vi.fn(), referenceRefetch: vi.fn() }));

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/hooks/useModuleLiveFeed", () => ({
  useModuleLiveFeed: () => ({ items: [], connection: "live", receivedAt: "2026-09-12T10:00:00.000Z", refetch: vi.fn(), isLoading: false, error: null }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    industryGroupPrivateResearch: {
      getDossier: {
        useQuery: () => ({
          data: {
            batch: { name: "验收批次", classification: "GICS 2026-Q3" },
            recordCount: 6,
            summaries: [
              { industryGroup: "半导体", metric: "return", unit: "%", currency: null, coverage: 2, average: 12, median: 12, minimum: 10, maximum: 14, latestObservedAt: "2026-09-11T00:00:00.000Z" },
              { industryGroup: "软件", metric: "return", unit: "%", currency: null, coverage: 2, average: 7, median: 7, minimum: 6, maximum: 8, latestObservedAt: "2026-09-11T00:00:00.000Z" },
            ],
            observations: [
              { recordId: "semi-a", industryGroup: "半导体", ticker: "AAA", metric: "return", value: 10, unit: "%", currency: null, observedAt: "2026-09-10T00:00:00.000Z", sourceReference: "account://semi-a" },
              { recordId: "semi-b", industryGroup: "半导体", ticker: "AAA", metric: "return", value: 14, unit: "%", currency: null, observedAt: "2026-09-11T00:00:00.000Z", sourceReference: "account://semi-b" },
              { recordId: "soft-a", industryGroup: "软件", ticker: "BBB", metric: "return", value: 6, unit: "%", currency: null, observedAt: "2026-09-10T00:00:00.000Z", sourceReference: "account://soft-a" },
              { recordId: "soft-b", industryGroup: "软件", ticker: "BBB", metric: "return", value: 8, unit: "%", currency: null, observedAt: "2026-09-11T00:00:00.000Z", sourceReference: "account://soft-b" },
            ],
            series: [
              { industryGroup: "半导体", metric: "return", unit: "%", currency: null, observedDate: "2026-09-10", average: 10, coverage: 1 },
              { industryGroup: "半导体", metric: "return", unit: "%", currency: null, observedDate: "2026-09-11", average: 14, coverage: 1 },
              { industryGroup: "软件", metric: "return", unit: "%", currency: null, observedDate: "2026-09-10", average: 6, coverage: 1 },
              { industryGroup: "软件", metric: "return", unit: "%", currency: null, observedDate: "2026-09-11", average: 8, coverage: 1 },
            ],
          },
          isLoading: false,
          isFetching: false,
          isError: false,
          error: null,
          refetch: dossierRefetch,
        }),
      },
    },
    industryGroupReference: {
      getSnapshot: {
        useQuery: () => ({
          data: { series: [{ id: "INDPRO", label: "工业生产指数", unit: "指数", frequency: "月度", source: "FRED", latest: { observedAt: "2026-08-01", value: 102.9 }, change: 0.4 }] },
          isLoading: false,
          isFetching: false,
          refetch: referenceRefetch,
        }),
      },
    },
  },
}));

import IndustryGroupModuleWorkbench from "../client/src/components/ig/IndustryGroupModuleWorkbench";

afterEach(() => { cleanup(); dossierRefetch.mockClear(); referenceRefetch.mockClear(); });

describe("行业分组 22 项运行工作台", () => {
  it("按目录逐项渲染唯一职责、数据定义、工具栏、推送区和状态栏", () => {
    for (const capability of INDUSTRY_GROUP_CAPABILITIES) {
      const { container, unmount } = render(<IndustryGroupModuleWorkbench code={capability.id} />);
      expect(container.querySelector(`[data-industry-module-workbench="${capability.id}"]`)).toBeTruthy();
      expect(screen.getByText(capability.name)).toBeTruthy();
      expect(screen.getByText(`唯一职责：${capability.responsibility}`)).toBeTruthy();
      expect(screen.getByRole("table", { name: `${capability.name} 数据定义` })).toBeTruthy();
      expect(screen.getByRole("toolbar", { name: `${capability.name} 工具栏` })).toBeTruthy();
      expect(screen.getByLabelText(`${capability.name} 后台定向内容`)).toBeTruthy();
      expect(screen.getByRole("button", { name: "刷新" })).toBeTruthy();
      unmount();
    }
  });

  it("相关性使用共同观察日计算矩阵，轮动使用首末观测计算排序", () => {
    const correlation = render(<IndustryGroupModuleWorkbench code="CORRELATION" />);
    expect(screen.getByRole("table", { name: "行业相关矩阵" })).toBeTruthy();
    expect(screen.getAllByTitle("2 个共同观察日").length).toBeGreaterThanOrEqual(4);
    correlation.unmount();

    render(<IndustryGroupModuleWorkbench code="ROTATION" />);
    expect(screen.getByRole("table", { name: "行业轮动排序" })).toBeTruthy();
    expect(screen.getByText("40.00%")).toBeTruthy();
    expect(screen.getByText("33.33%")).toBeTruthy();
  });

  it("景气和压力页可刷新官方参考，普通行业页不会重复刷新该来源", () => {
    const cycle = render(<IndustryGroupModuleWorkbench code="CYCLE" />);
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    expect(dossierRefetch).toHaveBeenCalledTimes(1);
    expect(referenceRefetch).toHaveBeenCalledTimes(1);
    cycle.unmount();

    render(<IndustryGroupModuleWorkbench code="RETURNS" />);
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    expect(dossierRefetch).toHaveBeenCalledTimes(2);
    expect(referenceRefetch).toHaveBeenCalledTimes(1);
  });

  it("未知或退休功能码不会回落为另一个行业页面", () => {
    const { container } = render(<IndustryGroupModuleWorkbench code="BLAW" />);
    expect(container.innerHTML).toBe("");
  });
});

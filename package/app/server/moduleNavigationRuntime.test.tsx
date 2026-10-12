/* @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ModuleNavigation from "../client/src/components/ModuleNavigation";

afterEach(cleanup);

describe("主终端核心导航运行时", () => {
  it("可展开核心分组，普通工具入口会调用原有模块回调", () => {
    const onModuleSelect = vi.fn();
    render(<ModuleNavigation activeModule="" onModuleSelect={onModuleSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /平台工具/i }));
    fireEvent.click(screen.getByRole("button", { name: "数据导出" }));
    expect(onModuleSelect).toHaveBeenCalledWith("data-export");

    fireEvent.click(screen.getByRole("button", { name: /帮助与关于/i }));
    fireEvent.click(screen.getByRole("button", { name: "文档" }));
    expect(onModuleSelect).toHaveBeenCalledWith("docs");
  });

  it("市场分组可折叠并恢复显示既有主权债入口", () => {
    render(<ModuleNavigation activeModule="" onModuleSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "主权债" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^市场$/ }));
    expect(screen.queryByRole("button", { name: "主权债" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^市场$/ }));
    expect(screen.getByRole("button", { name: "主权债" })).toBeTruthy();
  });

  it("全部一级导航均可展开、收起并恢复其原有首个子入口", () => {
    render(<ModuleNavigation activeModule="" onModuleSelect={vi.fn()} />);
    const groups = [
      ["市场", "主权债"], ["权益与衍生品", "股市"], ["通讯与社区", "通讯与社区菜单"],
      ["新闻与研究", "新闻与研究报告菜单"], ["经济分析", "经济数据及分析菜单"],
      ["专业应用", "投资组合管理与风险"], ["平台工具", "灵活屏"], ["个性化工作台", "我的看板"], ["帮助与关于", "快捷键"],
    ] as const;

    for (const [group, child] of groups) {
      const header = screen.getByRole("button", { name: new RegExp(`^${group}$`) });
      if (screen.queryByRole("button", { name: child })) {
        fireEvent.click(header);
        expect(screen.queryByRole("button", { name: child })).toBeNull();
      }
      fireEvent.click(header);
      expect(screen.getByRole("button", { name: child })).toBeTruthy();
    }
  });
});

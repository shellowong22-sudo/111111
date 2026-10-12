import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/components/order-management/AIMPanel.tsx"), "utf8");

describe("AIM 订单管理受限状态", () => {
  it("保留可访问的 AIM 面板与明确的授权连接边界", () => {
    expect(source).toContain("data-aim-order-management-panel");
    expect(source).toContain("受控订单执行边界");
    expect(source).toContain("未接入经授权的订单管理系统、券商路由或交易场所连接");
    expect(source).toContain("当接入已授权订单来源");
  });

  it("不将演示订单管理接口或无效交易按钮伪装为真实交易功能", () => {
    expect(source).not.toContain("trpc.orderManagement");
    expect(source).not.toMatch(/<button\b/);
    expect(source).toContain("不会发送、修改、撤销或模拟交易指令");
  });
});

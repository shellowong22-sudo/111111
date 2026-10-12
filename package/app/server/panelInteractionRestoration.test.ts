import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const imgrSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/electronic-trading/IMGRPanel.tsx"), "utf8");
const workflowSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/electronic-trading/WorkflowPanel.tsx"), "utf8");
const fstnSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/stp/FstnPanel.tsx"), "utf8");

describe("保留面板的交互修复契约", () => {
  it("IMGR 的筛选与设置按钮修改本地显示状态，而不是弹出待实现提示", () => {
    expect(imgrSource).not.toContain('alert("筛选功能待实现!")');
    expect(imgrSource).not.toContain('alert("设置功能待实现!")');
    expect(imgrSource).toContain("visibleRiskLimitData");
    expect(imgrSource).toContain("minimumRiskUsage");
    expect(imgrSource).toContain("compactDensity");
  });

  it("工作流审批和规则操作保留面板内状态更新，并明确不提交外部订单", () => {
    expect(workflowSource).not.toMatch(/alert\(/);
    expect(workflowSource).toContain("updateExecutionStatus");
    expect(workflowSource).toContain("toggleRuleStatus");
    expect(workflowSource).toContain("saveRuleEdit");
    expect(workflowSource).toContain("未提交外部订单");
  });

  it("FSTN 的补救操作需先选择方案并仅登记请求，不伪造结算执行", () => {
    expect(fstnSource).not.toMatch(/alert\(/);
    expect(fstnSource).toContain("selectedRemedyType");
    expect(fstnSource).toContain("submittedRemedies");
    expect(fstnSource).toContain("不会伪造外部结算执行");
  });
});

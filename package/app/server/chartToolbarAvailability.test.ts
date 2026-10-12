import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/components/ChartToolbar.tsx", import.meta.url), "utf8");

describe("图表工具栏动作可用性", () => {
  it("在未提供回调或图表节点时禁用时间筛选和导出入口", () => {
    expect(source).toContain("const timeframeAvailable = Boolean(onTimeframeChange)");
    expect(source).toContain("const csvAvailable = Boolean(onExportCSV)");
    expect(source).toContain("const pdfAvailable = Boolean(onExportPDF || chartId)");
    expect(source).toContain("disabled={!timeframeAvailable}");
    expect(source).toContain("disabled={!csvAvailable}");
    expect(source).toContain("disabled={exporting || !pdfAvailable}");
  });

  it("为禁用入口提供明确未接入文案，而非以 toast 冒充导出", () => {
    expect(source).toContain("CSV 导出未接入此图表");
    expect(source).toContain("PDF 导出未接入此图表");
    expect(source).toContain("时间筛选未接入此图表");
    expect(source).not.toContain("请在图表组件中配置 onExportCSV 回调");
    expect(source).not.toContain("PDF 导出：请使用浏览器打印功能");
  });
});

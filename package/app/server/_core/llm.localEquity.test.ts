import { describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./llm";

describe("local-equity-editor-v1", () => {
  it("produces a comparison without contacting a remote model", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await invokeLLM({
      model: "local-equity-editor-v1",
      messages: [
        {
          role: "user",
          content:
            "请对比：\n\nNVDA(英伟达): 买入74% | 目标价均值$766 | 当前价$678 | 潜在涨幅13.0% | 分析师34人\nAAPL(苹果): 买入65% | 目标价均值$220 | 当前价$205 | 潜在涨幅7.3% | 分析师40人",
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "stock_comparison", schema: { type: "object" } },
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(String(result.choices[0].message.content))).toMatchObject(
      { winner: "NVDA" }
    );
    fetchSpy.mockRestore();
  });

  it("produces a source-bounded report summary", async () => {
    const result = await invokeLLM({
      model: "local-equity-editor-v1",
      messages: [
        {
          role: "user",
          content:
            "【股票代码】NVDA (英伟达)\n【最新评级】买入\n【当前价】$678\n【潜在涨幅】13.0%\n【市场一致预期】买入 74%，共 34 位分析师覆盖\n【一致目标价均值】$766（区间 $600 - $900）",
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "report_summary", schema: { type: "object" } },
      },
    });
    const summary = JSON.parse(String(result.choices[0].message.content));
    expect(summary.targetPrice).toBe(766);
    expect(summary.conclusion).toContain("仅依据页面提供");
  });

  it("summarizes verified market observations without inventing a rating", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await invokeLLM({
      model: "local-equity-editor-v1",
      messages: [
        {
          role: "user",
          content: [
            "【股票代码】AAPL (苹果)",
            "【最新评级】评级源未配置",
            "【当前价】$225.4",
            "【当期涨跌幅】-1.25%",
            "【5日收益】2.1%",
            "【20日收益】4.8%",
            "【60日收益】-3.2%",
            "【20日年化波动率】24.6%",
            "【六个月最大回撤】-12.4%",
            "【市场时间】2026-09-11T20:00:00.000Z",
            "【数据来源】Yahoo Finance public chart",
          ].join("\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "report_summary", schema: { type: "object" } },
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    const summary = JSON.parse(String(result.choices[0].message.content));
    expect(summary.recommendation).toBe("hold");
    expect(summary.investmentThesis.join(" ")).toContain("评级源未接入");
    expect(summary.keyMetrics).toContainEqual({
      label: "20日收益",
      value: "4.80%",
    });
    expect(summary.conclusion).toContain("Yahoo Finance public chart");
    fetchSpy.mockRestore();
  });
});

import { describe, expect, it } from "vitest";
import { buildCrawlerEditorialSummary } from "./spiderPlatform";

describe("crawler editorial processing", () => {
  it("本地解析保留英文事实而不生成重复中文分析模板", () => {
    const text = buildCrawlerEditorialSummary({
      title:
        "SEC Publishes Updated Market Statistics, Highlighting Increase in IPOs and Proceeds Raised",
      summary: "The statistics cover IPO activity in 2026 and proceeds raised.",
      sourceName: "美国 SEC RSS",
      dataType: "监管新闻",
    });
    expect(text).toBe("The statistics cover IPO activity in 2026 and proceeds raised.");
    expect(text).toContain("2026");
    expect(text).not.toMatch(/简单说|换句话说|重点：/);
    expect(text).not.toContain("SEC Publishes Updated Market Statistics");
  });

  it("不同事件采用不同的事实框架，不复刻同一正文", () => {
    const transfer = buildCrawlerEditorialSummary({
      title: "SEC Proposes to Modernize Rules for Registered Transfer Agents",
      sourceName: "美国 SEC RSS",
      dataType: "监管新闻",
    });
    const minutes = buildCrawlerEditorialSummary({
      title: "Minutes of the Federal Open Market Committee, July 28–29, 2026",
      sourceName: "美国联邦储备",
      dataType: "央行与宏观",
    });
    expect(transfer).toContain("SEC Proposes to Modernize Rules for Registered Transfer Agents");
    expect(minutes).toContain("Minutes of the Federal Open Market Committee");
    expect(transfer).not.toBe(minutes);
  });

  it("欧盟债务规则新闻保留法律事实，不退化为通用监管模板", () => {
    const text = buildCrawlerEditorialSummary({
      title:
        "SEC Proposes Amendments to Exchange Act Rule 3a12-8 to Add European Union Debt Obligations",
      sourceName: "美国 SEC RSS",
      dataType: "监管新闻",
    });
    expect(text).toContain("Rule 3a12-8");
    expect(text).toContain("Proposes Amendments");
    expect(text).toContain("European Union Debt Obligations");
    expect(text).not.toContain("更新一项监管新闻事项");
  });

  it("中文内容去掉重复开场并保留数字证据", () => {
    const text = buildCrawlerEditorialSummary({
      title: "国债拍卖结果公布",
      summary: "简单说：本次发行规模 42bn，投标覆盖率 2.53。",
      sourceName: "美国财政部",
      dataType: "国债拍卖与发行",
    });
    expect(text).toContain("42bn");
    expect(text).toContain("2.53");
    expect(text).not.toContain("简单说");
  });
});

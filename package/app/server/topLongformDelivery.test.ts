import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ensureTopNewsLongform,
  ensureNewsLongformForModule,
  isTopLongformModule,
  toPlainNewsHeadline,
  TOP_NEWS_MIN_CHARACTERS,
} from "./newsLongform";

const automation = readFileSync("server/adminDataModuleDelivery.ts", "utf8");
const spider = readFileSync("server/spiderPlatform.ts", "utf8");
const terminal = readFileSync("client/src/components/TOPPanel.tsx", "utf8");

describe("TOP 三千字正文交付链", () => {
  it("本地长篇编辑器把短消息形成不少于三千字的差异化事件解读", () => {
    const text = ensureTopNewsLongform(
      "央行批准银行机构申请",
      "央行宣布批准一家银行机构提交的申请。"
    );
    const paragraphs = text
      .split("\n\n")
      .map(paragraph =>
        paragraph
          .replace(/[\s，。；：、,.!?！？:;"'“”‘’()（）\[\]—-]/g, "")
          .toLowerCase()
      );
    expect(text.length).toBeGreaterThanOrEqual(TOP_NEWS_MIN_CHARACTERS);
    expect(text).toContain("事件脉络");
    expect(text).toMatch(/成交结构检查|盘口与流动性|价格跳动的交易解释/);
    expect(text).toMatch(/组合敞口|资产配置影响|持仓层面的传导/);
    expect(paragraphs.length).toBeGreaterThanOrEqual(15);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
    expect(text).not.toContain("央行批准银行机构申请");
    expect(text).not.toMatch(/简单说|公开来源|后台|爬虫|crawler|spider_/i);
  });

  it("不同事件按自己的主题生成不同正文，而不是换标题复用同一篇文章", () => {
    const policy = ensureTopNewsLongform(
      "央行公布下一阶段利率安排",
      "政策声明强调将结合通胀和就业变化评估后续节奏。"
    );
    const company = ensureTopNewsLongform(
      "企业发布年度经营结果",
      "公司披露收入、现金流和债务安排出现新的变化。"
    );
    expect(policy).not.toBe(company);
    expect(policy).toContain("政策路径");
    expect(company).toContain("经营结果");
    expect(policy.length).toBeGreaterThanOrEqual(TOP_NEWS_MIN_CHARACTERS);
    expect(company.length).toBeGreaterThanOrEqual(TOP_NEWS_MIN_CHARACTERS);
  });

  it("同类新闻也使用各自主体与事实，不在正文重复标题", () => {
    const firstTitle =
      "Federal Reserve Board issues enforcement action against Alpha Bank";
    const secondTitle =
      "Federal Reserve Board issues enforcement action against Beta Capital";
    const first = ensureTopNewsLongform(
      firstTitle,
      "The order requires Alpha Bank to strengthen internal controls."
    );
    const second = ensureTopNewsLongform(
      secondTitle,
      "The order concerns conduct by a former employee of Beta Capital."
    );
    expect(first).not.toBe(second);
    expect(first).not.toContain(toPlainNewsHeadline(firstTitle));
    expect(second).not.toContain(toPlainNewsHeadline(secondTitle));
    expect(first).toContain("Alpha Bank");
    expect(second).toContain("Beta Capital");
    expect(first.match(/Alpha Bank/g)?.length ?? 0).toBeLessThanOrEqual(3);
    expect(second.match(/Beta Capital/g)?.length ?? 0).toBeLessThanOrEqual(3);
    const firstParagraphs = first.split("\n\n");
    const secondParagraphs = new Set(second.split("\n\n"));
    expect(
      firstParagraphs.filter(paragraph => secondParagraphs.has(paragraph))
    ).toHaveLength(0);
  });

  it("把转让代理机构规则标题和正文主体完整改写为中文", () => {
    const title =
      "SEC Proposes to Modernize Rules for Registered Transfer Agents";
    const source =
      "The Securities and Exchange Commission today proposed to update the rules and forms that apply to registered transfer agents. Transfer agents are a key component of the national clearance and settlement system. Transfer agents now perform a more diverse…";
    const article = ensureTopNewsLongform(title, source);
    const reread = ensureTopNewsLongform(title, article);
    expect(toPlainNewsHeadline(title)).toBe(
      "美国证交会提出注册转让代理机构规则现代化方案"
    );
    expect(article).toContain("注册转让代理机构规则现代化方案");
    expect(article).not.toContain("to Modernize");
    expect(article).toContain("转让代理机构是全国清算结算体系的重要组成部分");
    expect(article).not.toContain("The Securities and Exchange Commission");
    expect(reread).toContain("转让代理机构是全国清算结算体系的重要组成部分");
    expect(reread).not.toContain("The Securities and Exchange Commission");
    expect(article.length).toBeGreaterThanOrEqual(3000);
    expect(reread.length).toBeGreaterThanOrEqual(3000);
  });

  it("资本市场统计新闻不会复读英文标题，重复读取也保持同一正文", () => {
    const title =
      "SEC Publishes Updated Market Statistics, Highlighting Increase in IPOs and Proceeds Raised";
    const source =
      "The Securities and Exchange Commission’s Division of Economic and Risk Analysis (DERA) published updated statistics and data visualizations covering key segments of the U.S. capital markets, including three new asset-backed securities (ABS) issuance data series.";
    const article = ensureTopNewsLongform(title, source);
    const reread = ensureTopNewsLongform(title, article);
    expect(toPlainNewsHeadline(title)).toBe(
      "美国证交会更新资本市场统计，IPO数量与募资额增加"
    );
    expect(article.length).toBeGreaterThanOrEqual(3000);
    expect(article).not.toContain("SEC Publishes Updated Market Statistics");
    expect(article).not.toContain("The Securities and Exchange Commission");
    expect(article.match(/资本市场统计/g)?.length ?? 0).toBeLessThanOrEqual(3);
    expect(article).not.toMatch(/围绕的|关于，|本次信息为提供|若对的/);
    expect(reread).toBe(article);
  });

  it("旧记录即使把英文标题连续塞进正文也会完全剔除标题回声", () => {
    const title = "美联储批准National Westminster Bank Plc提交的申请";
    const repeated =
      "Federal Reserve Board announces approval of application by National Westminster Bank Plc Federal Reserve Board announces approval of application by National Westminster Bank Plc.";
    const article = ensureTopNewsLongform(title, repeated);
    expect(article).not.toContain("Federal Reserve Board announces approval");
    expect(article).not.toContain(title);
    expect(article).not.toContain("现有材料补充的信息是");
  });

  it("真实新闻在读取和推送时不再补齐模板长文", () => {
    expect(isTopLongformModule("credit-08-news")).toBe(true);
    expect(isTopLongformModule("credit-24-cran")).toBe(true);
    expect(isTopLongformModule("mm-22-news")).toBe(true);
    expect(automation).toContain('isTopLongformModule(module.id) && simulated');
    expect(spider).not.toContain('ensureNewsLongformForModule');
    expect(spider).toContain('const moduleBody = body;');
    expect(spider).toContain('eq(adminDataModuleContentItems.contentHash, contentHash)');
    expect(spider).not.toContain('payload.sourceDataUuid === selected.uuid');
  });

  it("货币市场 NEWS 使用独立的短端资金长文结构", () => {
    const article = ensureNewsLongformForModule(
      "mm-22-news",
      "Minutes of the Federal Open Market Committee, July 28–29, 2026",
      "议息会议纪要补充政策路径线索。纪要提供决策分歧、风险权衡和政策条件的更多背景。"
    );
    expect(article.length).toBeGreaterThanOrEqual(3000);
    expect(article).toContain("操作利率与资金走廊");
    expect(article).toContain("隔夜基准核验");
    expect(article).toContain("拍卖与结算联动");
    expect(article).not.toMatch(/股价反应怎么验证|权益估值核对|偿付与融资检验/);
    expect(article).not.toMatch(/后台|爬虫|crawler|spider_/i);
    const paragraphs = article.split(/\n\n+/).map((item) => item.trim()).filter(Boolean);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
  });

  it("信用债新闻移除采集编辑话术并形成可研读正文", () => {
    const title =
      "SEC Proposes Amendments to Exchange Act Rule 3a12-8 to Add European Union Debt Obligations";
    const source =
      "美国 SEC RSS更新一项监管新闻事项。该事项应与同类历史记录对照，区分一次性公告与持续性制度变化。原文可复核的数字或时间标记包括：12、1934。原文题名和链接继续保留在来源栏，编辑结果不虚构人物、金额、评级、预测或交易指令。";
    const article = ensureTopNewsLongform(title, source);
    const reread = ensureTopNewsLongform(title, article);
    expect(article.length).toBeGreaterThanOrEqual(TOP_NEWS_MIN_CHARACTERS);
    expect(article).toContain("欧盟债务工具");
    expect(article).toContain("Rule 3a12-8");
    expect(article).toContain("法律状态仍是提案");
    expect(article).toContain("清算托管并非自动改变");
    expect(article).not.toMatch(/该市场事件|这轮行情线索|有关交易信号/);
    expect(article).not.toMatch(/关键条款与执行边界|股价反应怎么验证|权益估值核对/);
    expect(article.split(/\n\n+/)).toHaveLength(25);
    expect(article).not.toMatch(/RSS|来源栏|公开来源|后台|管理端|人工定向推送|爬虫|crawler|spider_/i);
    expect(reread).toBe(article);
  });

  it("信用债研究入口收到规则更新时形成中文长篇信用研究正文", () => {
    const title = "SEC Proposes Amendments to Exchange Act Rule 3a12-8 to Add European Union Debt Obligations";
    const article = ensureTopNewsLongform(title, "The proposal would add European Union debt obligations to the rule and remains subject to the rulemaking process.");
    expect(toPlainNewsHeadline(title)).toBe("美国证交会拟将欧盟债务工具纳入交易法规则适用范围");
    expect(article.length).toBeGreaterThanOrEqual(TOP_NEWS_MIN_CHARACTERS);
    expect(article).toContain("欧盟债务工具");
    expect(article).not.toMatch(/后台|爬虫|crawler|spider_/i);
  });

  it("终端详情只展示新闻正文，不显示采集性质标签", () => {
    expect(terminal).toContain("data-top-news-body");
    expect(terminal).not.toContain("item.sourceKind === 'public' ? '公开来源'");
    expect(terminal).not.toContain(
      "{selectedNews.time} · {selectedNews.source}"
    );
  });
});

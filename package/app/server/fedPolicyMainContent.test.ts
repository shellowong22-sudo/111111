import { describe, expect, it } from "vitest";
import { extractFedPolicyMainText } from "./routers/moneyMarketPolicy";
import fs from "node:fs";
import path from "node:path";

describe("美联储官方政策正文边界", () => {
  it("只从 main/article 内容提取文本，不把页面导航作为政策证据", () => {
    const html = '<header>Main Menu Bank Rate</header><main><article><h1>Minutes</h1><p>The Committee maintained the target range for the federal funds rate.</p></article></main><footer>Bank Rate</footer>';
    const text = extractFedPolicyMainText(html);
    expect(text).toContain("Minutes");
    expect(text).toContain("maintained the target range");
    expect(text).not.toContain("Main Menu");
    expect(text).not.toContain("<");
  });

  it("兼容美联储纪要页面的 #article 内容区和 lastUpdate 正文边界", () => {
    const html = '<header>Main Menu Bank Rate</header><div id="article" class="col-md-9"><h1>FOMC Minutes</h1><p>The Committee maintained the target range for the federal funds rate.</p><div class="lastUpdate" id="lastUpdate">Last update</div><footer>Bank Rate</footer>';
    const text = extractFedPolicyMainText(html);
    expect(text).toContain("FOMC Minutes");
    expect(text).toContain("maintained the target range");
    expect(text).not.toContain("Main Menu");
    expect(text).not.toContain("Last update");
  });

  it("第 18 项从 RSS 标题动态派生 FOMC 纪要 HTML，而非长期依赖新闻稿公告页", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const route = fs.readFileSync(path.join(root, "server/routers/econ29Data.ts"), "utf8");
    expect(route).toContain("function deriveFedMinutesHtmlUrl");
    expect(route).toContain("fomcminutes${match[4]}");
    expect(route).toContain('kind === "minutes" ? deriveFedMinutesHtmlUrl(item.headline, item.sourceUrl)');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const topSource = readFileSync(`${root}/client/src/components/news/TOPPanel.tsx`, 'utf8');
const factsSource = readFileSync(`${root}/client/src/components/news/OfficialTopNewsDesk.tsx`, 'utf8');
const hubSource = readFileSync(`${root}/client/src/pages/NewsResearchHub.tsx`, 'utf8');

describe('TOP 官方事实阅读窗口', () => {
  it('默认进入实际投递头条并保留事实阅读入口', () => {
    expect(topSource).toContain("const [activeTab, setActiveTab] = useState('headlines')");
    expect(topSource).toContain("useModuleLiveFeed('/menu-item/TOP', true, { publicOnly: true })");
    expect(topSource).toContain('const newsRows = deliveredNews');
    expect(topSource).toContain("{ id: 'official', label: '官方事实阅读' }");
    expect(topSource).toContain('<OfficialTopNewsDesk />');
    expect(factsSource).toContain('trpc.newsResearch.getOfficialFeed.useQuery');
    expect(factsSource).toContain('监管公告');
    expect(factsSource).toContain('美联储货币政策');
    expect(factsSource).toContain('美联储研究');
  });

  it('只显示可追溯元数据与实际摘要，不生成热度、情绪或价格影响', () => {
    expect(factsSource).toContain('不生成热度、情绪、价格冲击、阅读量或投资结论');
    expect(factsSource).toContain('内容定位已留档');
    expect(factsSource).not.toMatch(/href=|window.open/);
    expect(factsSource).toContain('终端不据此推断宏观影响、证券价格反应、市场情绪或交易方向');
    expect(factsSource).not.toContain('Math.random');
  });

  it('保留原 TOP 功能标签，行情影响无数据时不能以合成数据补齐', () => {
    expect(topSource).toContain("{ id: 'headlines', label: '头条新闻' }");
    expect(topSource).toContain("{ id: 'heat', label: '热度趋势' }");
    for (const label of ['情绪雷达', '标的热词', '价格反应', '影响力矩阵', '跨资产联动']) expect(topSource).toContain(`label: '${label}'`);
    expect(topSource).not.toContain('const NEWS_PRICE_REACTION = Array.from');
    expect(topSource).toContain("heat: null, sentiment: 'unknown'");
  });

  it('在原导航实际进入的 News Hub TOP 页默认显示官方事实阅读，旧目录不再重复展示其他功能', () => {
    expect(hubSource).toContain("import OfficialTopNewsDesk from '@/components/news/OfficialTopNewsDesk'");
    expect(hubSource).toContain('data-news-hub-official-top="true"');
    expect(hubSource).toContain('<OfficialTopNewsDesk deliveredItems={delivery.items} />');
    expect(factsSource).toContain('feed.isLoading && !supplied.length');
    expect(factsSource).toContain('feed.error && !supplied.length');
    expect(hubSource).not.toContain('data-news-hub-original-top-directory="true"');
    expect(hubSource).not.toContain('保留原 TOP 模块目录与历史示例展示（非事实）');
    for (const tab of ['media', 'third', 'intl', 'commentary', 'personal', 'social', 'docs']) {
      expect(hubSource).toContain(`TabsContent value="${tab}"`);
    }
    const topWindow = hubSource.match(/<TabsContent value="top"[\s\S]*?<\/TabsContent>/)?.[0] ?? '';
    expect(topWindow).toContain('<OfficialTopNewsDesk deliveredItems={delivery.items} />');
    for (const duplicate of ['MDIA', '3RD', 'INTL', 'CMNT', 'PERS', 'SOCL', 'DOCS', '多媒体', '第三方优质新闻', '非英语新闻', '评论与分析', '个性化新闻', '社交媒体与分析', '文件与资料']) {
      expect(topWindow).not.toContain(duplicate);
    }
  });

  it('在 News Hub 的 BECO 原窗口默认显示官方宏观观察，并明确降级原固定宏观指标', () => {
    expect(hubSource).toContain("import PublicMacroObservationDesk from '@/components/econ/PublicMacroObservationDesk'");
    expect(hubSource).toContain('data-news-hub-beco-official-observations="true"');
    expect(hubSource).toContain('<PublicMacroObservationDesk />');
    expect(hubSource).toContain('data-news-hub-beco-historical-boundary="true"');
    expect(hubSource).toContain('固定 GDP、CPI、政策利率、国债收益率、国家比较和历史曲线均**不是当前事实或可执行依据**');
  });
});

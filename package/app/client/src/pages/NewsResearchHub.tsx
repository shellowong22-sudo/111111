/**
 * 新闻与研究中心：实时多语种新闻终端（头条、快讯、标的研究、行业、宏观央行、热度、趋势、情绪、全球、观点、公告、能源商品、简报、我的新闻、提醒、设置）。
 * 原 29 个功能代码保留为入口，同质化的合并到对应功能（?tab=旧代码 仍可直达）。
 */
import NewsTerminal from "@/uc/news/NewsTerminal";

export default function NewsResearchHub() {
  return <NewsTerminal />;
}

/** 新闻与研究报告：与新闻终端同一实现（实时清洗去重新闻；原写死数据已移除） */
import NewsTerminal from "@/uc/news/NewsTerminal";
export default function NewsPanel(_p: { title?: string; onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-hidden"><NewsTerminal /></div>;
}

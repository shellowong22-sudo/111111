/** TREN 新闻趋势：新闻类功能统一进入新闻终端对应功能（同一实现） */
import NewsGoto from "@/components/news/NewsGoto";
export default function TRENPanel(_props: { onClose?: () => void } & Record<string, unknown>) {
  return <NewsGoto tab="tren" />;
}

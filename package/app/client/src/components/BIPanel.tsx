/** BI 行业研究：新闻类功能统一进入新闻终端对应功能（同一实现） */
import NewsGoto from "@/components/news/NewsGoto";
export default function BIPanel(_props: { onClose?: () => void } & Record<string, unknown>) {
  return <NewsGoto tab="bi" />;
}

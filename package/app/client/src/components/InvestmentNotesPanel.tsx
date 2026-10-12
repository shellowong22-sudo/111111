/** 投资笔记：与 NOTE 个人笔记为同一功能，统一实现（数据库永久保存，原示例笔记已移除） */
import { NoteLive } from "@/components/live/CommsLive";
export default function InvestmentNotesPanel(_props: { title?: string } & Record<string, unknown>) {
  return <NoteLive />;
}

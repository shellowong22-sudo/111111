/** 已改为实时数据版本（原模拟推演实现已移除） */
import { MMNewsResearchLive } from "@/components/live/MMLive";
export default function NewsResearchPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <MMNewsResearchLive onClose={props.onClose} />;
}

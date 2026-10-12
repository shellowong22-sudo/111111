/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IndustryIntelLive } from "@/components/live/NewsDeskLive";
export default function BIPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IndustryIntelLive onClose={props.onClose} />;
}

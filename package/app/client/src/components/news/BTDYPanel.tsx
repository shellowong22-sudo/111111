/** 已改为实时数据版本（原模拟推演实现已移除） */
import { DailyBriefLive } from "@/components/live/NewsDeskLive";
export default function BTDYPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <DailyBriefLive onClose={props.onClose} />;
}

/** 已改为实时数据版本（原模拟推演实现已移除） */
import { FrontPageLive } from "@/components/live/NewsDeskLive";
export default function FRNTPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <FrontPageLive onClose={props.onClose} />;
}

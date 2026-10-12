/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IdxWT } from "@/components/live/IndexLive";
export default function WTPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxWT onClose={props.onClose} />;
}

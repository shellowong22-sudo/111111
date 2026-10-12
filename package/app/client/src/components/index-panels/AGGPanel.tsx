/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IdxAGG } from "@/components/live/IndexLive";
export default function AGGPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxAGG onClose={props.onClose} />;
}

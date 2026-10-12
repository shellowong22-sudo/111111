/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IdxBBG } from "@/components/live/IndexLive";
export default function BBGIndexPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxBBG onClose={props.onClose} />;
}

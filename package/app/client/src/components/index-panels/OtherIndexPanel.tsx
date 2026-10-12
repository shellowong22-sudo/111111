/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IdxOther } from "@/components/live/IndexLive";
export default function OtherIndexPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxOther onClose={props.onClose} />;
}

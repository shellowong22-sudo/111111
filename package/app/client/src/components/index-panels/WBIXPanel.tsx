/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IdxWBIX } from "@/components/live/IndexLive";
export default function WBIXPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxWBIX onClose={props.onClose} />;
}

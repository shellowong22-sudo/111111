/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IdxFDFD } from "@/components/live/IndexLive";
export default function FDFDPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxFDFD onClose={props.onClose} />;
}

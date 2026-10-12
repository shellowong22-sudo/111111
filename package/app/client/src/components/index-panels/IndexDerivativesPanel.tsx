/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IdxDeriv } from "@/components/live/IndexLive";
export default function IndexDerivativesPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxDeriv onClose={props.onClose} />;
}

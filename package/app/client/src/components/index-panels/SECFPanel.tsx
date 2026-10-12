/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IdxSECF } from "@/components/live/IndexLive";
export default function SECFPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxSECF onClose={props.onClose} />;
}

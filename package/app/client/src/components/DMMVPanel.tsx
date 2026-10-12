/** DMMV：已改为实时数据版本（原模拟实现已移除） */
import { EqDMMV } from "@/components/live/EqFlowLive2";
export default function DMMVPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqDMMV onClose={onClose} />;
}

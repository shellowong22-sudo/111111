/** BCMP：已改为实时数据版本（原模拟实现已移除） */
import { EqBCMP } from "@/components/live/EqFlowLive2";
export default function BCMPPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqBCMP onClose={onClose} />;
}

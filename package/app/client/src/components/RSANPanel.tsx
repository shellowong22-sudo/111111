/** RSAN：已改为实时数据版本（原模拟实现已移除） */
import { EqRSAN } from "@/components/live/EqFlowLive2";
export default function RSANPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqRSAN onClose={onClose} />;
}

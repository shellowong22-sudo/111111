/** WETF：已改为实时数据版本（原模拟实现已移除） */
import { EqWETF } from "@/components/live/EqFlowLive";
export default function WETFPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqWETF onClose={onClose} />;
}

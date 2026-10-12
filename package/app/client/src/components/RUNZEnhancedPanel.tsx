/** RUNZ：已改为实时数据版本（原模拟实现已移除） */
import { EqRUNZ } from "@/components/live/EqFlowLive";
export default function RUNZEnhancedPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqRUNZ onClose={onClose} />;
}

/** PICK：已改为实时数据版本（原模拟实现已移除） */
import { EqPICK } from "@/components/live/EqFlowLive";
export default function PICKPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqPICK onClose={onClose} />;
}

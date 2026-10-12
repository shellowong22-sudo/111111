/** SRSK：已改为实时数据版本（原模拟实现已移除） */
import { EqSRSK } from "@/components/live/EqFlowLive2";
export default function SRSKPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqSRSK onClose={onClose} />;
}

/** CDERIV：已改为实时数据版本（原模拟实现已移除） */
import { CDERIVLive } from "@/components/live/CreditXLive";
export default function CDERIVPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CDERIVLive onClose={onClose} />;
}

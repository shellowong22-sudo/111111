/** EDSF：已改为实时数据版本（原模拟实现已移除） */
import { EDSFLive } from "@/components/live/CreditXLive2";
export default function EDSFPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EDSFLive onClose={onClose} />;
}

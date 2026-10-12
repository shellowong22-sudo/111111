/** LOANS：已改为实时数据版本（原模拟实现已移除） */
import { LOANSLive } from "@/components/live/CreditXLive";
export default function LOANSPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <LOANSLive onClose={onClose} />;
}

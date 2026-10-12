/** SOVR：已改为实时数据版本（原模拟实现已移除） */
import { SOVRLive } from "@/components/live/CreditXLive2";
export default function SOVRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <SOVRLive onClose={onClose} />;
}

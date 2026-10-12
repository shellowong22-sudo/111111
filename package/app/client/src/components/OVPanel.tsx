/** OV 期权情景估值：已改为实时数据版本（原模拟实现已移除） */
import { OvLive } from "@/components/live/DerivLibLive";
export default function OVPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <OvLive onClose={onClose} />;
}

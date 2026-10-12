/** IRS：已改为实时数据版本（原模拟实现已移除） */
import { IrsLive } from "@/components/live/RatesFxLive";
export default function IRSMonitorPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <IrsLive onClose={onClose} />;
}

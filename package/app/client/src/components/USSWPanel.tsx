/** USSW：已改为实时数据版本（原模拟实现已移除） */
import { UsswLive } from "@/components/live/RatesFxLive";
export default function USSWPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <UsswLive onClose={onClose} />;
}

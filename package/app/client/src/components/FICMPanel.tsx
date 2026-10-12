/** FICM：已改为实时数据版本（原模拟实现已移除） */
import { FicmLive } from "@/components/live/RatesFxLive";
export default function FICMPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FicmLive onClose={onClose} />;
}

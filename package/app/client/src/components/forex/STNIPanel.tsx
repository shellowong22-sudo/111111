/** STNI：已改为实时数据版本（原模拟实现已移除） */
import { StniLive } from "@/components/live/RatesFxLive2";
export default function STNIPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <StniLive onClose={onClose} />;
}

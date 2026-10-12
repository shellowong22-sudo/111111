/** FXTF：已改为实时数据版本（原模拟实现已移除） */
import { FxtfLive } from "@/components/live/RatesFxLive2";
export default function FXTFPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FxtfLive onClose={onClose} />;
}

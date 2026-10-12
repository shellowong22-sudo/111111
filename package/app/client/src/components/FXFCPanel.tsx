/** FXFC：已改为实时数据版本（原模拟实现已移除） */
import { FxfcLive } from "@/components/live/RatesFxLive2";
export default function FXFCPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FxfcLive onClose={onClose} />;
}

/** FXDS：已改为实时数据版本（原模拟实现已移除） */
import { FxdsLive } from "@/components/live/RatesFxLive2";
export default function FXDSPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FxdsLive onClose={onClose} />;
}

/** WVOL：已改为实时数据版本（原模拟实现已移除） */
import { WvolLive } from "@/components/live/RatesFxLive2";
export default function WVOLPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <WvolLive onClose={onClose} />;
}

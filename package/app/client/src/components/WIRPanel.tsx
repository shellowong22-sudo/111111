/** WIR：已改为实时数据版本（原模拟实现已移除） */
import { WirLive } from "@/components/live/RatesFxLive";
export default function WIRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <WirLive onClose={onClose} />;
}

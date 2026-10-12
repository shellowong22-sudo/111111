/** YCQ：已改为实时数据版本（原模拟实现已移除） */
import { YcqLive } from "@/components/live/RatesFxLive";
export default function YieldCurveQuantumPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <YcqLive onClose={onClose} />;
}

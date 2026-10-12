/** XCCY：已改为实时数据版本（原模拟实现已移除） */
import { XccyLive } from "@/components/live/RatesFxLive2";
export default function XCCYPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <XccyLive onClose={onClose} />;
}

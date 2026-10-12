/** RRG：已改为实时数据版本（原模拟实现已移除） */
import { MacroRRG } from "@/components/live/MacroXLive3";
export default function RRGPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroRRG onClose={onClose} />;
}

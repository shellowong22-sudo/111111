/** FOEC：已改为实时数据版本（原模拟实现已移除） */
import { MacroFOEC } from "@/components/live/MacroXLive";
export default function FOECPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroFOEC onClose={onClose} />;
}

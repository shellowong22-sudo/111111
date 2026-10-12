/** FIWS：已改为实时数据版本（原模拟实现已移除） */
import { MacroFIWS } from "@/components/live/MacroXLive3";
export default function FIWSPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroFIWS onClose={onClose} />;
}

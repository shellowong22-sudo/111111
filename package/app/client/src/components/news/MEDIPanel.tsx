/** MEDI：已改为实时数据版本（原模拟实现已移除） */
import { MacroMEDI } from "@/components/live/MacroXLive2";
export default function MEDIPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroMEDI onClose={onClose} />;
}

/** MIPR：已改为实时数据版本（原模拟实现已移除） */
import { MacroMIPR } from "@/components/live/MacroXLive";
export default function MIPRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroMIPR onClose={onClose} />;
}

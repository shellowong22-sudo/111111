/** HELP INDX：已改为实时数据版本（原模拟实现已移除） */
import { MacroHELPINDX } from "@/components/live/MacroXLive2";
export default function HELPINDXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroHELPINDX onClose={onClose} />;
}

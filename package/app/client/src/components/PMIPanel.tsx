/** PMI：已改为实时数据版本（原模拟实现已移除） */
import { MacroPMI } from "@/components/live/MacroXLive";
export default function PMIPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroPMI onClose={onClose} />;
}

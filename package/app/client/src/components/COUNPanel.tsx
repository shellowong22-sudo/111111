/** COUN：已改为实时数据版本（原模拟实现已移除） */
import { MacroCOUN } from "@/components/live/MacroXLive";
export default function COUNPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroCOUN onClose={onClose} />;
}

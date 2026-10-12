/** EXPERT：已改为实时数据版本（原模拟实现已移除） */
import { MacroExpert } from "@/components/live/MacroXLive2";
export default function ExpertMonitorPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroExpert onClose={onClose} />;
}

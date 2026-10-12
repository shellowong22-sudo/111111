/** CTRY：已改为实时数据版本（原模拟实现已移除） */
import { MacroCountryMonitor } from "@/components/live/MacroXLive";
export default function CountryMonitorPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroCountryMonitor onClose={onClose} />;
}

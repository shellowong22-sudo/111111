/** GCPI：已改为实时数据版本（原模拟实现已移除） */
import { MacroGCPI } from "@/components/live/MacroXLive";
export default function GCPIPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroGCPI onClose={onClose} />;
}

/** GMM：已改为实时数据版本（原模拟实现已移除） */
import { MacroGMM } from "@/components/live/MacroXLive2";
export default function GMMPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroGMM onClose={onClose} />;
}

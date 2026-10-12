/** GMM 全球宏观异动：已改为实时数据版本（与同代码其他入口同一实现，原写死数据已移除） */
import { MacroGMM } from "@/components/live/MacroXLive2";
export default function GMMPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroGMM onClose={onClose} />;
}

/** GMM 全球宏观驱动：各入口统一为同一实现 */
import { MacroGMM } from "@/components/live/MacroXLive2";
export default function GMMPanel({ onClose }: { onClose?: () => void } & Record<string, unknown> = {}) {
  return <MacroGMM onClose={onClose} />;
}

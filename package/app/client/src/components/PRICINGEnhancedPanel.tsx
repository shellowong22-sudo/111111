/** 定价（债券）：与 FIBC / YAS / CALC 债券计算器为同一功能，统一实现 */
import { FibcLive } from "@/components/live/MMLive2";
export default function PRICINGEnhancedPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FibcLive onClose={onClose} />;
}

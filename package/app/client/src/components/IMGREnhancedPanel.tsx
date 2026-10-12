/** IMGR 库存与定价：与电子交易 IMGR 为同一实现 */
import { ImgrLive } from "@/components/live/EmsxLive2";
export default function IMGREnhancedPanel({ onClose }: { onClose?: () => void } & Record<string, unknown> = {}) {
  return <ImgrLive onClose={onClose} />;
}

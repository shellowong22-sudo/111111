/** GP 价格走势图：各入口统一为同一实现（单标的走势、K 线与区间统计） */
import { GpMarketsLive } from "@/components/live/MarketsLive";
export default function GPPanel({ onClose }: { onClose?: () => void } & Record<string, unknown> = {}) {
  return <GpMarketsLive onClose={onClose} />;
}

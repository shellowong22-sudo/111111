/** GP 价格走势图（单标的 + 区间统计）：已改为实时数据版本（原实现已移除） */
import { GpMarketsLive } from "@/components/live/MarketsLive";
export default function GPPanel({ onClose }: { onClose?: () => void } = {}) {
  return <GpMarketsLive onClose={onClose} />;
}

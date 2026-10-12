/** SPOT 商品现货价格：已改为实时数据版本（原模拟实现已移除） */
import { SpotLive } from "@/components/live/MarketsLive";
export default function SPOTPanel({ onClose }: { onClose?: () => void }) {
  return <SpotLive onClose={onClose} />;
}

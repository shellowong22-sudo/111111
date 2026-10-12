/** CPLY 商品供需：已改为实时数据版本（原模拟实现已移除） */
import { CplyLive } from "@/components/live/MarketsLive";
export default function CPLYPanel({ onClose }: { onClose?: () => void }) {
  return <CplyLive onClose={onClose} />;
}

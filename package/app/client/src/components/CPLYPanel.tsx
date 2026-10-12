/** CPLY 商品供需：已改为实时数据版本（与同代码其他入口同一实现，原写死数据已移除） */
import { CplyLive } from "@/components/live/MarketsLive";
export default function CPLYPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CplyLive onClose={onClose} />;
}

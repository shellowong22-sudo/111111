/** COSY 商品综合分析：已改为实时数据版本（原模拟实现已移除） */
import { COSYLive } from "@/components/live/CommodityLive";
export default function COSYPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <COSYLive onClose={onClose} />;
}

/** CCRV 商品期货曲线：已改为实时数据版本（原模拟实现已移除） */
import { CcrvLive } from "@/components/live/MarketsLive";
export default function CCRVPanel({ onClose }: { onClose?: () => void }) {
  return <CcrvLive onClose={onClose} />;
}

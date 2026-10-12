/** CCRV 商品期货曲线：已改为实时数据版本（与同代码其他入口同一实现，原写死数据已移除） */
import { CcrvLive } from "@/components/live/MarketsLive";
export default function CCRVPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CcrvLive onClose={onClose} />;
}

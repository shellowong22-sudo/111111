/** WCR 全球汇率 · 有效汇率与估值：已改为实时数据版本（原模拟实现已移除） */
import { WcrLive } from "@/components/live/FxDeskLive";
export default function WCRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <WcrLive onClose={onClose} />;
}

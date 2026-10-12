/** WCRS 全球央行政策利率：已改为实时数据版本（原模拟实现已移除） */
import { WcrsLive } from "@/components/live/FxDeskLive";
export default function WCRSPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <WcrsLive onClose={onClose} />;
}

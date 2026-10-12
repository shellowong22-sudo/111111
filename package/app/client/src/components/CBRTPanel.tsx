/** CBRT 央行利率：与 WCRS 全球央行政策利率为同一功能，统一实现（28 个经济体，真实数据） */
import { WcrsLive } from "@/components/live/FxDeskLive";
export default function CBRTPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <WcrsLive onClose={onClose} />;
}

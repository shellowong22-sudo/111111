/** WEIF 全球股指期货：各入口统一为同一实现（原此处展示的周度经济指标与代码不符） */
import { WeifFuturesLive } from "@/components/live/RiskVolLive";
export default function WEIFPanel({ onClose }: { onClose?: () => void } & Record<string, unknown> = {}) {
  return <WeifFuturesLive onClose={onClose} />;
}

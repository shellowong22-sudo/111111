/** WEIF 全球股指期货：已改为实时数据版本（原模拟实现已移除） */
import { WeifFuturesLive } from "@/components/live/RiskVolLive";
export default function WEIFPanel({ onClose }: { onClose?: () => void }) {
  return <WeifFuturesLive onClose={onClose} />;
}

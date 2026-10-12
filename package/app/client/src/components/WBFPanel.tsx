/** WBF 全球债券期货：已改为实时数据版本（原模拟实现已移除） */
import { WbfLive } from "@/components/live/BondRatesLive";
export default function WBFPanel({ onClose }: { onClose?: () => void }) {
  return <WbfLive onClose={onClose} />;
}

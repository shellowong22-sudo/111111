/** HS 历史利差：已改为真实数据版本（原模拟实现已移除） */
import { HsLive } from "@/components/live/BondRatesLive";
export default function HSPanel({ onClose }: { onClose: () => void }) {
  return <HsLive onClose={onClose} />;
}

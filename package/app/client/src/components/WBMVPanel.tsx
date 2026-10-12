/** WBMV 全球债券市场概览：已改为实时数据版本（原模拟实现已移除） */
import { WbmvLive } from "@/components/live/BondRatesLive";
export default function WBMVPanel({ onClose }: { onClose: () => void }) {
  return <WbmvLive onClose={onClose} />;
}

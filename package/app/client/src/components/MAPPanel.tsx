/** MAP 利率地图 / 自设地图：已改为真实数据版本，自设地图永久保存（原模拟实现已移除） */
import { MapRatesLive } from "@/components/live/BondRatesLive";
export default function MAPPanel({ onClose }: { onClose: () => void }) {
  return <MapRatesLive onClose={onClose} />;
}

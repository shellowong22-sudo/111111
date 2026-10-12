/** MAP 地图：各入口统一为利率地图 / 自设地图实现（全球市场热力图见 BMAP） */
import { MapRatesLive } from "@/components/live/BondRatesLive";
export default function MAPPanel({ onClose }: { onClose?: () => void } & Record<string, unknown> = {}) {
  return <MapRatesLive onClose={onClose} />;
}

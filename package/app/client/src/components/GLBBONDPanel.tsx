/** GLBBOND：全球债券市场与 WBMV 全球债券市场概览为同一功能，统一实现 */
import { WbmvLive } from "@/components/live/BondRatesLive";
export default function GLBBONDPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <WbmvLive onClose={onClose} />;
}

/** BYFC 债券收益率预测：统一为同一实时实现 */
import { ByfcLive } from "@/components/live/BondXLive";
export default function BYFCPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <ByfcLive onClose={onClose} />;
}

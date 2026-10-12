/** BYFC 债券收益率预测：已改为实时数据版本（原写死数据已移除） */
import { ByfcLive } from "@/components/live/BondXLive";
export default function BCLOPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <ByfcLive onClose={onClose} />;
}

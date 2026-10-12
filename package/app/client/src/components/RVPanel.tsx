/** RV 相对估值：已改为实时数据版本（原写死数据已移除） */
import { RvLive } from "@/components/live/StockXLive";
export default function RVPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <RvLive onClose={onClose} />;
}

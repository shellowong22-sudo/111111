/** ANR 分析师建议：已改为实时数据版本（原写死数据已移除） */
import { AnrLive } from "@/components/live/StockXLive";
export default function ANRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <AnrLive onClose={onClose} />;
}

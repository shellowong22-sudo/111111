/** MOST 最活跃证券：已改为实时数据版本（原写死数据已移除） */
import { MostLive } from "@/components/live/StockXLive";
export default function MOSTPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MostLive onClose={onClose} />;
}

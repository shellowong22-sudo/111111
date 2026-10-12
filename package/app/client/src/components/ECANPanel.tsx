/** ECAN 世界经济分析：已改为实时数据版本（原写死数据已移除） */
import { EcanLive } from "@/components/live/EconLive";
export default function ECANPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EcanLive onClose={onClose} />;
}

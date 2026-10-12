/** GCDS：已改为实时数据版本（原模拟实现已移除） */
import { GCDSLive } from "@/components/live/CreditXLive";
export default function GCDSPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <GCDSLive onClose={onClose} />;
}

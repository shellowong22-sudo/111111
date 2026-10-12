/** GCDS 全球 CDS：已改为实时数据版本（与同代码其他入口同一实现，原写死数据已移除） */
import { GCDSLive } from "@/components/live/CreditXLive";
export default function GCDSEnhancedPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <GCDSLive onClose={onClose} />;
}

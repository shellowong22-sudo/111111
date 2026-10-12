/** CDX 信用指数：已改为实时数据版本（原模拟实现已移除） */
import { CDXLive } from "@/components/live/CreditXLive";
export default function CDXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CDXLive onClose={onClose} />;
}

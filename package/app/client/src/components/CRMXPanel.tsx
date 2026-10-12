/** CRMX：已改为实时数据版本（原模拟实现已移除） */
import { CRMXLive } from "@/components/live/CreditXLive";
export default function CRMXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CRMXLive onClose={onClose} />;
}

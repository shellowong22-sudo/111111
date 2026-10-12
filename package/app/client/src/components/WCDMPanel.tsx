/** WCDM：已改为实时数据版本（原模拟实现已移除） */
import { WCDMLive } from "@/components/live/CreditXLive2";
export default function WCDMPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <WCDMLive onClose={onClose} />;
}

/** TCON：已改为实时数据版本（原模拟实现已移除） */
import { EqTCON } from "@/components/live/EqFlowLive2";
export default function TCONPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqTCON onClose={onClose} />;
}

/** WTWTR：已改为实时数据版本（原模拟实现已移除） */
import { EqWTWTR } from "@/components/live/EqFlowLive2";
export default function WTWTRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqWTWTR onClose={onClose} />;
}

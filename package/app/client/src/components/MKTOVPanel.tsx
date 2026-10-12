/** MKTOV：已改为实时数据版本（原模拟实现已移除） */
import { EqMKTOV } from "@/components/live/EqFlowLive";
export default function MKTOVPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqMKTOV onClose={onClose} />;
}

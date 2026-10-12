/** TFLO：已改为实时数据版本（原模拟实现已移除） */
import { EqTFLO } from "@/components/live/EqFlowLive";
export default function TFLOPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqTFLO onClose={onClose} />;
}

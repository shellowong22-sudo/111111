/** 已改为实时数据版本（原模拟推演实现已移除） */
import { PortVaRLive } from "@/components/live/PortOpsLive";
export default function PORTVRPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortVaRLive onClose={props.onClose} />;
}

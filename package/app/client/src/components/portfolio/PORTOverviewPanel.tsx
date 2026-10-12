/** 已改为实时数据版本（原模拟推演实现已移除） */
import { PortOverviewLive } from "@/components/live/PortOpsLive";
export default function PORTOverviewPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortOverviewLive onClose={props.onClose} />;
}

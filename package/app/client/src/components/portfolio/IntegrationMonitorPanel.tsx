/** 已改为实时数据版本（原模拟推演实现已移除） */
import { IntegrationMonitorLive } from "@/components/live/PortOpsLive";
export default function IntegrationMonitorPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IntegrationMonitorLive onClose={props.onClose} />;
}

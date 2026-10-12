/** 已改为实时数据版本（原模拟推演实现已移除） */
import { SystemMaintenanceLive } from "@/components/live/PortOpsLive";
export default function SystemMaintenancePanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <SystemMaintenanceLive onClose={props.onClose} />;
}

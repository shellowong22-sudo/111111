/** 已改为实时数据版本（原模拟推演实现已移除） */
import { AuditLogLive } from "@/components/live/PortOpsLive";
export default function AuditLogPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <AuditLogLive onClose={props.onClose} />;
}

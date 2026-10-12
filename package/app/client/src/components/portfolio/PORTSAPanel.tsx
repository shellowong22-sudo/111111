/** 已改为实时数据版本（原模拟推演实现已移除） */
import { PortScenarioLive } from "@/components/live/PortOpsLive";
export default function PORTSAPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortScenarioLive onClose={props.onClose} />;
}

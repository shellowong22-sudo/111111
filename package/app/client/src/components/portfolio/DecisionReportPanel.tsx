/** DRPT：已改为真实数据版本（原示例实现已移除）；决策报告与报告快照为同一功能，统一到 PREP */
import { PrepLive } from "@/components/live/PortLive3";
export default function DecisionReportPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PrepLive onClose={props.onClose as (() => void) | undefined} />;
}

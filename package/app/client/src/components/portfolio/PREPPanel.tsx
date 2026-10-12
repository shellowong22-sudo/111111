/** PREP：已改为真实数据版本（原示例实现已移除）；组合报告快照与前后对比 */
import { PrepLive } from "@/components/live/PortLive3";
export default function PREPPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PrepLive onClose={props.onClose as (() => void) | undefined} />;
}

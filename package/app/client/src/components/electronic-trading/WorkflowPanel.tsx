/** WORKFLOW 交易限额与预检：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { WorkflowLive } from "@/components/live/EmsxLive2";
export default function WorkflowPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <WorkflowLive onClose={props.onClose} />;
}

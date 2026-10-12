/** PDSP：已改为真实数据版本（原示例实现已移除）；持仓行情位置与动量展示 */
import { PdspLive } from "@/components/live/PortLive2";
export default function PDSPPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PdspLive onClose={props.onClose as (() => void) | undefined} />;
}

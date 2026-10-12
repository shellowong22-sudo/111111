/** PORT TE：已改为真实数据版本（原示例实现已移除）；相对当前基准的主动风险 */
import { PortTeLive } from "@/components/live/PortLive2";
export default function PORTTEPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortTeLive onClose={props.onClose as (() => void) | undefined} />;
}

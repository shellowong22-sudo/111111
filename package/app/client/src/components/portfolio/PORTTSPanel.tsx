/** PORT TS：已改为真实数据版本（原示例实现已移除）；下单前交易模拟测算 */
import { PortTsLive } from "@/components/live/PortLive3";
export default function PORTTSPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortTsLive onClose={props.onClose as (() => void) | undefined} />;
}

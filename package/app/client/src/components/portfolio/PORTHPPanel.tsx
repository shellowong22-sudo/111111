/** PORT HP：已改为真实数据版本（原示例实现已移除）；交易账户已实现历史业绩 */
import { PortHpLive } from "@/components/live/PortLive3";
export default function PORTHPPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortHpLive onClose={props.onClose as (() => void) | undefined} />;
}

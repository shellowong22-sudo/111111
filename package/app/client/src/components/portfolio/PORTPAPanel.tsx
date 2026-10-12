/** PORT PA：已改为真实数据版本（原示例实现已移除）；区间收益的本币 / 汇率归因 */
import { PortPaLive } from "@/components/live/PortLive3";
export default function PORTPAPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortPaLive onClose={props.onClose as (() => void) | undefined} />;
}

/** PORT CH：已改为真实数据版本（原示例实现已移除）；组合基本面特征与行业分布 */
import { PortCharLive } from "@/components/live/PortLive2";
export default function PORTCHPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortCharLive onClose={props.onClose as (() => void) | undefined} />;
}

/** PORT IP：已改为真实数据版本（原示例实现已移除）；持仓日内盈亏路径与贡献 */
import { PortIntradayLive } from "@/components/live/PortLive2";
export default function PORTIPPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortIntradayLive onClose={props.onClose as (() => void) | undefined} />;
}

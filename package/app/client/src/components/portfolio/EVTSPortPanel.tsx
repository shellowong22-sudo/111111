/** EVTS：已改为真实数据版本（原示例实现已移除）；持仓业绩预期与监管申报 */
import { PortEventsLive } from "@/components/live/PortLive3";
export default function EVTSPortPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortEventsLive onClose={props.onClose as (() => void) | undefined} />;
}

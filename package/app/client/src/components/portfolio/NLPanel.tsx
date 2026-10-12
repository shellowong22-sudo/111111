/** NL：已改为真实数据版本（原示例实现已移除）；持仓新闻情绪 */
import { PortNewsLive } from "@/components/live/PortLive3";
export default function NLPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortNewsLive onClose={props.onClose as (() => void) | undefined} />;
}

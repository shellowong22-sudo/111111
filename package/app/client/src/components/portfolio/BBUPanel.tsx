/** BBU：已改为真实数据版本（原示例实现已移除）；候选基准拟合度比较与保存基准 */
import { BbuLive } from "@/components/live/PortLive2";
export default function BBUPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <BbuLive onClose={props.onClose as (() => void) | undefined} />;
}

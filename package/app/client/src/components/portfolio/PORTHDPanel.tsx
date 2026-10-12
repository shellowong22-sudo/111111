/** PORT HD：已改为真实数据版本（原示例实现已移除）；持仓分析与组合特征为同一功能，统一到 PORT CH */
import { PortCharLive } from "@/components/live/PortLive2";
export default function PORTHDPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PortCharLive onClose={props.onClose as (() => void) | undefined} />;
}

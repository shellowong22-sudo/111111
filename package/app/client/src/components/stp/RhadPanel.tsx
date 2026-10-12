/** RHAD：已改为真实数据版本（原模拟数据实现已移除）；监管报告管理与监管报告中心为同一功能，统一到 RHUB */
import { StpRHUB } from "@/components/live/STPLive3";
export default function RhadPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpRHUB onClose={props.onClose} />;
}

/** VCON：已改为真实数据版本（原模拟数据实现已移除）；语音成交确认与成交确认核验为同一功能，统一到 VCAD */
import { StpVCAD } from "@/components/live/STPLive2";
export default function VconPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpVCAD onClose={props.onClose} />;
}

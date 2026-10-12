/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive2.tsx */
import { StpALOS } from "@/components/live/STPLive2";
export default function AlosPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpALOS onClose={props.onClose} />;
}

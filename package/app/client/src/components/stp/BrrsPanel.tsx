/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive.tsx */
import { StpBRRS } from "@/components/live/STPLive";
export default function BrrsPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpBRRS onClose={props.onClose} />;
}

/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive.tsx */
import { StpRESD } from "@/components/live/STPLive";
export default function ResdPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpRESD onClose={props.onClose} />;
}

/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive3.tsx */
import { StpRHAB } from "@/components/live/STPLive3";
export default function RhabPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpRHAB onClose={props.onClose} />;
}

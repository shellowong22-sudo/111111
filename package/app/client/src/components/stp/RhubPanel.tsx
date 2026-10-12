/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive3.tsx */
import { StpRHUB } from "@/components/live/STPLive3";
export default function RhubPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpRHUB onClose={props.onClose} />;
}

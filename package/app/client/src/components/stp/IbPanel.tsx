/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive3.tsx */
import { StpIB } from "@/components/live/STPLive3";
export default function IbPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpIB onClose={props.onClose} />;
}

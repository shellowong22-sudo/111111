/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive2.tsx */
import { StpMIFI } from "@/components/live/STPLive2";
export default function MifiPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpMIFI onClose={props.onClose} />;
}

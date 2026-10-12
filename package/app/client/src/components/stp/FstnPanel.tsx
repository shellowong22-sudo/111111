/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive.tsx */
import { StpFSTN } from "@/components/live/STPLive";
export default function FstnPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpFSTN onClose={props.onClose} />;
}

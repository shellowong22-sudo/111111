/** 已改为真实数据版本（原模拟数据实现已移除），实现见 components/live/STPLive2.tsx */
import { StpESTP } from "@/components/live/STPLive2";
export default function EstpPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpESTP onClose={props.onClose} />;
}

/** ALEX：已改为真实数据版本（原模拟数据实现已移除）；分配异常与母单分配为同一功能，统一到 ALOB */
import { StpALOB } from "@/components/live/STPLive2";
export default function AlexPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpALOB onClose={props.onClose} />;
}

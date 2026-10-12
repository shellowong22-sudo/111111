/** MIFI：已改为真实数据版本（原示例实现已移除）；与直通处理 MIFI 为同一功能代码，统一实现 */
import { StpMIFI } from "@/components/live/STPLive2";
export default function MIFIPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpMIFI onClose={props.onClose as (() => void) | undefined} />;
}

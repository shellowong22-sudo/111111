/** FXTB：已改为真实数据版本（原模拟数据实现已移除）；外汇交易簿与外汇确认交收为同一功能，统一到 FXSS */
import { StpFXSS } from "@/components/live/STPLive";
export default function FxtbPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpFXSS onClose={props.onClose} />;
}

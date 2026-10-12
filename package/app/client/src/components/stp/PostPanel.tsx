/** POST：已改为真实数据版本（原模拟数据实现已移除）；交易后生命周期与直通处理漏斗为同一功能，统一到 ESTP */
import { StpESTP } from "@/components/live/STPLive2";
export default function PostPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpESTP onClose={props.onClose} />;
}

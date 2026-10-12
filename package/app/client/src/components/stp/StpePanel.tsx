/** STPE：已改为真实数据版本（原模拟数据实现已移除）；直通权限与直通处理配置为同一功能，统一到 ESTP */
import { StpESTP } from "@/components/live/STPLive2";
export default function StpePanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpESTP onClose={props.onClose} />;
}

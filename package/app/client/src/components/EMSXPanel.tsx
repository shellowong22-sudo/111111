/** EMSX：与电子交易页 EMSX 订单录入为同一实现（原委托草稿 / 未配置路由审计视图已移除）。 */
import { EmsxOrderLive } from "@/components/live/EmsxOrderLive";

export default function EMSXPanel({ onClose }: { onClose?: () => void }) {
  return <EmsxOrderLive onClose={onClose} />;
}

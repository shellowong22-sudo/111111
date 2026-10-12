/** CMRV 商品比值与相对价值：已改为实时数据版本（原模拟实现已移除） */
import { CmrvLive } from "@/components/live/CommodityLive";
export default function CMRVPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CmrvLive onClose={onClose} />;
}

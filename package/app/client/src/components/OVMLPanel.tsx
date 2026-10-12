/** OVML 外汇 / 商品期权估值：与 /ovml 页面同一实现（避免同一功能两套内容） */
import { FxOptionDesk } from "@/uc/hubs/VolDesk";
export default function OVMLPanel(_props: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-hidden"><FxOptionDesk /></div>;
}

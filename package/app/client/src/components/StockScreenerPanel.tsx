/** 选股筛选器：已改为真实行情（原写死数据已移除），实现见 live/MarketXLive.tsx */
import { ScreenLive } from "@/components/live/MarketXLive";
export default function StockScreenerPanel({ title, onClose }: { title?: string; onClose?: () => void } & Record<string, unknown>) {
  return <ScreenLive onClose={onClose} title={title} />;
}

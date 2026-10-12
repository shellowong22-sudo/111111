/** RATC 评级变动追踪：按真实新闻报道归类上调 / 下调（原写死评级表已移除） */
import { RatcLive } from "@/components/live/MarketXLive";
export default function RATCPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <RatcLive onClose={onClose} />;
}

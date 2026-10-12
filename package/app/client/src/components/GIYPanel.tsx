/** GIY 日内收益率：已改为美债收益率 5 分钟真实走势（原写死数据已移除） */
import { GiyLive } from "@/components/live/MarketXLive";
export default function GIYPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <GiyLive onClose={onClose} />;
}

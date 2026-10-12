/** 市场情绪：已改为价格与期权隐含的真实情绪指标（原写死数据已移除），实现见 live/MarketXLive.tsx */
import { SentLive } from "@/components/live/MarketXLive";
export default function MarketSentimentPanel({ title, onClose }: { title?: string; onClose?: () => void } & Record<string, unknown>) {
  return <SentLive onClose={onClose} title={title} />;
}

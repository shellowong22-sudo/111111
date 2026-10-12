/** GF 图形化基本面：已改为真实财报数据（原写死数据已移除），实现见 components/live/GfLive.tsx */
import { GfLive } from "@/components/live/GfLive";
export default function GFPanel({ onClose, ticker }: { onClose?: () => void; ticker?: string } & Record<string, unknown>) {
  return <GfLive onClose={onClose} symbol={ticker} />;
}

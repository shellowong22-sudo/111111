/** SEAG 季节性分析：已改为真实多年日线计算版本（原模拟实现已移除） */
import { SeagLive } from "@/components/live/MarketsLive";
export default function SEAGPanel({ onClose }: { onClose?: () => void }) {
  return <SeagLive onClose={onClose} />;
}

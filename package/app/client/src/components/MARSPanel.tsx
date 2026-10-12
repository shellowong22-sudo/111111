/** MARS 多资产风险：已改为真实日线计算版本（原模拟实现已移除） */
import { MarsLive } from "@/components/live/RiskVolLive";
export default function MARSPanel({ onClose }: { onClose?: () => void }) {
  return <MarsLive onClose={onClose} />;
}

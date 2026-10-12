/** VCA 波动率与相关性分析：已改为真实数据版本（原模拟实现已移除） */
import { VcaLive } from "@/components/live/RiskVolLive";
export default function VCAPanel({ onClose }: { onClose?: () => void }) {
  return <VcaLive onClose={onClose} />;
}

/** IFMO 通胀预测监控：已改为真实数据版本（原模拟实现已移除） */
import { IfmoLive } from "@/components/live/BondRatesLive";
export default function IFMOPanel({ onClose }: { onClose: () => void }) {
  return <IfmoLive onClose={onClose} />;
}

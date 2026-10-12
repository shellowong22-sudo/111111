/** ECMI 新兴市场货币与经济指标：已改为实时数据版本（原模拟实现已移除） */
import { EcmiLive } from "@/components/live/FxInfoLive";
export default function ECMIPanel({ onClose }: { onClose?: () => void }) {
  return <EcmiLive onClose={onClose} />;
}

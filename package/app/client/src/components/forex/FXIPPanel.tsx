/** FXIP 外汇信息：已改为实时数据版本（原模拟实现已移除） */
import { FxipLive } from "@/components/live/FxInfoLive";
export default function FXIPPanel({ onClose }: { onClose?: () => void }) {
  return <FxipLive onClose={onClose} />;
}

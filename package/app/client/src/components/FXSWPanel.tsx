/** FXSW 外汇策略工作台：已改为实时数据版本（原模拟实现已移除） */
import { FxswLive } from "@/components/live/FxDeskLive";
export default function FXSWPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FxswLive onClose={onClose} />;
}

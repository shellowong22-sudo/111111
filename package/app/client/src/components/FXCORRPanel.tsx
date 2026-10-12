/** FXCORR 外汇相关性：已改为实时数据版本（原模拟实现已移除） */
import { FxcorrLive } from "@/components/live/FxDeskLive";
export default function FXCORRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FxcorrLive onClose={onClose} />;
}

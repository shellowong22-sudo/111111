/** FXFA 套息交易分析：已改为实时数据版本（与终端外汇窗口同一实现） */
import { FxfaLive } from "@/components/live/FxDeskLive3";
export default function FXFAPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FxfaLive onClose={onClose} />;
}

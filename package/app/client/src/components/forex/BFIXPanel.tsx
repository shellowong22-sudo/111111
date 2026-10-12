/** BFIX 平台半小时定盘：已改为实时数据版本（与终端外汇窗口同一实现） */
import { BfixLive } from "@/components/live/FxDeskLive3";
export default function BFIXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <BfixLive onClose={onClose} />;
}
